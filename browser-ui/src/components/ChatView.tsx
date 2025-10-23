/**
 * ChatView - Browser Platform
 *
 * Uses Model handlers from lama.core and chat.core via hooks.
 * - useMessages hook provides access to model.chatHandler
 * - AI streaming through model.aiAssistantModel
 *
 * TODO: Remove Electron IPC event listeners and replace with Model-based
 * event subscriptions when available.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageView } from './MessageView'
import { useMessages } from '@/hooks/useMessages'
import { useModel } from '@/model/index.js'
import { ChatHeader } from './chat/ChatHeader'
import { ChatContext } from './chat/ChatContext'
import { KeywordDetailPanel } from './KeywordDetail/KeywordDetailPanel'

// TODO: Replace these with worker equivalents
const useLamaPeers = () => ({ peers: [] })
const useChatSubjects = () => ({ subjects: [], subjectsJustAppeared: [] })
const topicAnalysisService = { analyzeMessages: async () => {} }

export const ChatView = memo(function ChatView({
  conversationId = 'lama',
  onProcessingChange,
  onMessageUpdate,
  isInitiallyProcessing = false,
  hasAIParticipant: hasAIParticipantProp,
  onAddUsers
}: {
  conversationId?: string
  onProcessingChange?: (isProcessing: boolean) => void
  onMessageUpdate?: (lastMessage: string) => void
  isInitiallyProcessing?: boolean
  hasAIParticipant?: boolean
  onAddUsers?: () => void
}) {
  const model = useModel()
  const { messages, isLoading: loading, sendMessage } = useMessages({ topicId: conversationId })
  const { subjects, subjectsJustAppeared } = useChatSubjects(conversationId)
  const chatHeaderRef = useRef<HTMLDivElement>(null)

  // Debug: log messages received from hook
  console.log('[ChatView] Received from hook - messages:', messages?.length || 0, 'loading:', loading)
  if (messages && messages.length > 0) {
    console.log('[ChatView] First message in ChatView:', messages[0])
  }

  // Separate effect for updating parent
  useEffect(() => {
    if (messages.length > 0 && onMessageUpdate) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.content) {
        onMessageUpdate(lastMessage.content)
      }
    }
  }, [messages, onMessageUpdate]) // Proper dependencies

  const { peers } = useLamaPeers()
  const [conversationName, setConversationName] = useState<string>('Messages')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAIProcessing, setIsAIProcessing] = useState(isInitiallyProcessing)
  const [aiStreamingContent, setAiStreamingContent] = useState('')
  const [lastAnalysisMessageCount, setLastAnalysisMessageCount] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [showSubjectDetail, setShowSubjectDetail] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null)

  // Check if this is an AI conversation
  // Use the authoritative value from backend conversation metadata
  const hasAIParticipant = hasAIParticipantProp || false


  // Analysis is handled automatically by chatWithAnalysis() in ai-assistant-model.ts
  // Keywords and subjects are extracted from each AI response in the background
  // No need for separate analysis trigger from UI

  // Clear AI processing state when conversation changes
  useEffect(() => {
    console.log(`[ChatView] Conversation changed to: ${conversationId}, clearing AI state`)
    setIsAIProcessing(false)
    setAiStreamingContent('')
  }, [conversationId])

  // Check if welcome message is still being generated on mount or when messages load
  useEffect(() => {
    // If there are no messages and this is an AI conversation, show spinner immediately
    // This covers the case where welcome message generation is in progress
    if (messages.length === 0 && hasAIParticipant && !loading) {
      console.log('[ChatView] No messages in AI topic - showing spinner for welcome generation')
      setIsAIProcessing(true)
      onProcessingChange?.(true)
    } else if (messages.length > 0 && isAIProcessing) {
      // Messages arrived - clear the spinner
      console.log('[ChatView] Messages arrived - clearing welcome spinner')
      setIsAIProcessing(false)
      onProcessingChange?.(false)
    }
  }, [messages.length, hasAIParticipant, loading]) // Watch for message arrival

  // Listen for AI streaming events via window custom events (Browser Direct)
  useEffect(() => {
    // Handle progress/thinking indicator
    const handleProgress = (event: Event) => {
      const data = (event as CustomEvent).detail;
      console.log(`[ChatView-${conversationId}] 🔔 Progress event:`, data);
      if (data.conversationId === conversationId) {
        console.log(`[ChatView-${conversationId}] ✅ Setting AI processing to TRUE`);
        setIsAIProcessing(true);
        setAiStreamingContent('');
        onProcessingChange?.(true);
      }
    }

    // Handle streaming chunks
    const handleStream = (event: Event) => {
      const data = (event as CustomEvent).detail;
      console.log('[ChatView] Stream data received:', data);
      if (data.conversationId === conversationId) {
        setIsAIProcessing(false);
        // Combine thinking and response for display
        let content = '';
        if (data.thinking) {
          content += `[THINKING] ${data.thinking}\n\n`;
        }
        if (data.partial) {
          content += data.partial;
        }
        setAiStreamingContent(content);
      }
    }

    // Handle message complete
    const handleComplete = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (data.conversationId === conversationId) {
        setIsAIProcessing(false);
        setAiStreamingContent('');
        onProcessingChange?.(false);
      }
    }

    // Subscribe to window custom events
    window.addEventListener('ai:progress', handleProgress);
    window.addEventListener('ai:messageStream', handleStream);
    window.addEventListener('ai:messageComplete', handleComplete);

    return () => {
      window.removeEventListener('ai:progress', handleProgress);
      window.removeEventListener('ai:messageStream', handleStream);
      window.removeEventListener('ai:messageComplete', handleComplete);
    }
  }, [conversationId, onProcessingChange])
  
  useEffect(() => {
    // Get the conversation/contact name
    const loadConversationDetails = async () => {
      try {
        // Check if this is the Hi introductory chat
        if (conversationId === 'hi') {
          setConversationName('Hi')
          return
        }

        // Check if this is an AI conversation
        if (conversationId === 'lama' || conversationId === 'ai-chat') {
          // For the lama conversation, check if it's with the AI
          // based on message content
          if (messages.length > 0) {
            const aiMessage = messages.find(m => 
              m.sender?.toLowerCase().includes('ai') || 
              m.sender?.toLowerCase().includes('local') ||
              m.sender?.toLowerCase().includes('ollama') ||
              m.content?.includes('Ollama') ||
              m.content?.includes('AI assistant')
            )
            if (aiMessage) {
              // It's an AI conversation - try to get the model name
              // Try to get AI model name from IPC (future enhancement)
              // For now, use fallback logic
              
              // Fallback based on message content
              if (messages[0]?.content?.toLowerCase().includes('ollama')) {
                setConversationName('Ollama')
              } else {
                setConversationName('AI Assistant')
              }
              return
            }
          }
          
          // No messages yet, but it's the lama conversation
          setConversationName('LAMA')
          return
        }
        
        // Try to find the peer/contact for this conversation
        const peer = peers.find(p => p.id === conversationId)
        if (peer) {
          setConversationName(peer.name)
          return
        }
        
        // Try to get contact info via IPC (future enhancement)
        // For now, use peer name or fallback
        
        // Default fallback
        setConversationName('Messages')
      } catch (error) {
        console.error('[ChatView] Failed to load conversation details:', error)
        setConversationName('Messages')
      }
    }

    loadConversationDetails()
  }, [conversationId, messages, peers])

  const handleSendMessage = async (content: string, attachments?: any[]) => {
    setIsProcessing(true)
    onProcessingChange?.(true)

    // Check if this is an AI conversation to show processing indicator
    const isAIConversation = conversationId === 'lama' ||
                             conversationId === 'ai-chat' ||
                             messages.some(m => m.isAI)

    if (isAIConversation) {
      setIsAIProcessing(true)
      setAiStreamingContent('')
    }

    try {
      await sendMessage(content, attachments)

      // Update last message preview with the sent message
      if (onMessageUpdate) {
        onMessageUpdate(content)
      }
    } finally {
      setIsProcessing(false)
      onProcessingChange?.(false)
      // AI processing indicator will be cleared by streaming events
    }
  }

  // Test function to trigger message update
  const testMessageUpdate = useCallback(async () => {
    console.log('[ChatView] TEST: Triggering message update for:', conversationId)
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.invoke('test:triggerMessageUpdate', { conversationId })
        console.log('[ChatView] TEST: Trigger result:', result)
      } catch (error) {
        console.error('[ChatView] TEST: Failed to trigger:', error)
      }
    } else {
      console.error('[ChatView] TEST: No electronAPI available')
    }
  }, [conversationId])

  // Add test function to window for debugging
  useEffect(() => {
    (window as any).testMessageUpdate = testMessageUpdate
    console.log('[ChatView] Test function available: window.testMessageUpdate()')
    return () => {
      delete (window as any).testMessageUpdate
    }
  }, [testMessageUpdate])
  
  const handleClearConversation = async () => {
    if (confirm('Clear all messages in this conversation? This cannot be undone.')) {
      // TODO: Implement clearConversation via model.chatHandler
      console.log('[ChatView] TODO: Implement clearConversation for:', conversationId)
      // When implemented: await model.chatHandler.clearConversation({ conversationId })
      // Reload the page to reset everything
      // window.location.reload()
    }
  }

  return (
    <Card className="h-full w-full flex flex-col">
      <div ref={chatHeaderRef}>
        <ChatHeader
          conversationName={conversationName}
          conversationId={conversationId}
          subjects={subjects}
          messageCount={messages.length}
          hasAI={hasAIParticipant}
          showSummary={showSummary}
          onToggleSummary={() => setShowSummary(!showSummary)}
          onAddUsers={onAddUsers}
          onSubjectClick={(subject) => {
            console.log('[ChatView] Subject clicked:', subject)
            setSelectedSubject(subject)
            setShowSubjectDetail(true)
          }}
        />
      </div>

      <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
        {/* AI Summary Panel - Shows at top when visible */}
        {showSummary && hasAIParticipant && (
          <div className="border-b bg-muted/30">
            <ChatContext
              topicId={conversationId}
              messages={messages}
              messageCount={messages.length}
              className="border-0"
            />
          </div>
        )}

        {/* Subject Detail Panel - Shows ALL subjects with the same name */}
        {showSubjectDetail && selectedSubject && (() => {
          // Find all subjects with the same name as the selected one
          const selectedName = selectedSubject.id || selectedSubject.name || 'Subject';
          const matchingSubjects = subjects.filter(s =>
            (s.id || s.name) === selectedName
          );

          return (
            <div className="border-b bg-muted/30 max-h-[40vh] overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedName}</h3>
                    {matchingSubjects.length > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {matchingSubjects.length} versions
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSubjectDetail(false)}
                  >
                    ×
                  </Button>
                </div>

                {/* List all matching subjects */}
                <div className="space-y-3">
                  {matchingSubjects.map((subject, idx) => (
                    <div key={idx} className="p-3 bg-background/50 rounded border">
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-sm">Keywords:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {subject.keywords?.map((kw: string, kwIdx: number) => {
                              if (kw.length === 64 && /^[0-9a-f]+$/.test(kw)) {
                                console.warn('[ChatView] Keyword is still a hash:', kw);
                              }
                              return (
                                <Badge key={kwIdx} variant="secondary" className="text-xs">
                                  {kw}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span><span className="font-medium">Messages:</span> {subject.messageCount}</span>
                          <span><span className="font-medium">Last:</span> {new Date(subject.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Messages */}
        <MessageView
          messages={messages}
          currentUserId={model.ownerId || undefined}
          onSendMessage={handleSendMessage}
          placeholder="Type a message..."
          showSender={true}
          loading={loading}
          isAIProcessing={isAIProcessing}
          aiStreamingContent={aiStreamingContent}
          topicId={conversationId}
          subjectsJustAppeared={subjectsJustAppeared}
          chatHeaderRef={chatHeaderRef}
        />
      </CardContent>
    </Card>
  )
})