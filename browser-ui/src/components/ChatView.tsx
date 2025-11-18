/**
 * ChatView - Browser Platform
 *
 * Uses Model handlers from lama.core and chat.core via hooks.
 * - useMessages hook provides access to model.chatPlan
 * - AI streaming through model.aiAssistantModel
 *
 * TODO: Remove Electron IPC event listeners and replace with Model-based
 * event subscriptions when available.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { flushSync } from 'react-dom'
import { Card, CardContent } from '@lama/ui'
import { Button } from '@lama/ui'
import { Badge } from '@lama/ui'
import { MessageView } from './MessageView'
import { useMessages } from '@/hooks/useMessages'
import { useModel } from '@/model/index.js'
import { ChatHeader } from './chat/ChatHeader'
import { ChatContext } from './chat/ChatContext'
import { KeywordDetailPanel } from './KeywordDetail/KeywordDetailPanel'
import { useChatSubjects } from '@/hooks/useChatSubjects'
import { addAIEventListener, AIEventNames } from '../events/AIEventTypes'

// TODO: Replace these with worker equivalents
const useLamaPeers = () => ({ peers: [] })

export const ChatView = memo(function ChatView({
  conversationId = 'lama',
  onProcessingChange,
  onMessageUpdate,
  isInitiallyProcessing = false,
  hasAIParticipant: hasAIParticipantProp,
  onAddUsers
}: {
  conversationId?: string
  onProcessingChange?: (conversationId: string, isProcessing: boolean) => void
  onMessageUpdate?: (lastMessage: string) => void
  isInitiallyProcessing?: boolean
  hasAIParticipant?: boolean
  onAddUsers?: () => void
}) {
  const model = useModel()
  const { messages, isLoading: loading, sendMessage } = useMessages({ topicId: conversationId })
  const { subjects } = useChatSubjects(conversationId)

  // Track last message ID to avoid redundant updates
  const lastMessageIdRef = useRef<string | null>(null)

  // Separate effect for updating parent - only when last message actually changes
  useEffect(() => {
    if (messages.length > 0 && onMessageUpdate) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.content && lastMessage.id !== lastMessageIdRef.current) {
        lastMessageIdRef.current = lastMessage.id
        onMessageUpdate(lastMessage.content)
      }
    }
  }, [messages, onMessageUpdate]) // Proper dependencies

  const { peers } = useLamaPeers()
  const [conversationName, setConversationName] = useState<string>('Messages')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAIProcessing, setIsAIProcessing] = useState(isInitiallyProcessing)
  const [aiStreamingContent, setAiStreamingContent] = useState('')
  const [aiModelName, setAiModelName] = useState<string | undefined>()
  const [aiError, setAiError] = useState<string | null>(null)
  const [streamingTimeout, setStreamingTimeout] = useState<NodeJS.Timeout | null>(null)
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
    setIsAIProcessing(false)
    setAiStreamingContent('')
  }, [conversationId])

  // Check if welcome message is still being generated on mount or when messages load
  useEffect(() => {
    // Only show spinner for default chats (hi/lama) with 0 messages
    // User-created chats don't auto-generate welcome messages
    const isDefaultChat = conversationId === 'hi' || conversationId === 'lama'

    // If there are no messages and this is a default AI chat, show spinner
    // This covers the case where welcome message generation is in progress
    if (messages.length === 0 && hasAIParticipant && !loading && isDefaultChat) {
      setIsAIProcessing(true)
      onProcessingChange?.(conversationId, true)

      // Safety timeout: Clear spinner after 10 seconds if no messages arrive
      // This prevents infinite spinner if welcome message fails or takes too long
      const timeout = setTimeout(() => {
        console.log('[ChatView] Welcome message timeout - clearing spinner')
        setIsAIProcessing(false)
        onProcessingChange?.(conversationId, false)
      }, 10000) // 10 second timeout

      return () => clearTimeout(timeout)
    } else if (messages.length > 0 && isAIProcessing) {
      // Messages arrived - clear the spinner
      setIsAIProcessing(false)
      onProcessingChange?.(conversationId, false)
    }
  }, [messages.length, hasAIParticipant, loading, conversationId, onProcessingChange, isAIProcessing]) // Watch for message arrival

  // Prevent duplicate display: Clear streaming content when persisted message arrives
  // This is the ONLY place streaming content should be cleared (not in MESSAGE_COMPLETE)
  useEffect(() => {
    if (!aiStreamingContent) return; // No streaming content to check

    // Check if the last persisted message matches the streaming content
    // This means the message has been saved to ONE.core and arrived via channel update
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.content) {
      // Normalize both for comparison (trim whitespace, remove markdown formatting)
      const streamingNormalized = aiStreamingContent.trim().toLowerCase();
      const persistedNormalized = lastMessage.content.trim().toLowerCase();

      // Check if they're the same message (allowing for minor differences)
      // Use a similarity check: if 90% of streaming content is in persisted content
      const similarity = streamingNormalized.length > 0
        ? (persistedNormalized.includes(streamingNormalized) ? 1.0 :
           streamingNormalized.includes(persistedNormalized) ? 1.0 : 0)
        : 0;

      if (similarity > 0.5) {
        // Clear the streaming content
        setAiStreamingContent('');

        // Cancel the timeout since we found the persisted message
        if (streamingTimeout) {
          clearTimeout(streamingTimeout);
          setStreamingTimeout(null);
        }
      }
    }
    // ONLY run when messages change - not when aiStreamingContent or streamingTimeout change
    // (avoids infinite loop: effect modifies aiStreamingContent → triggers effect again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Listen for AI streaming events via type-safe event system (Browser Direct)
  useEffect(() => {
    // Handle progress/thinking indicator (type-safe)
    const cleanupProgress = addAIEventListener(AIEventNames.PROGRESS, (event) => {
      const data = event.detail;
      if (data.topicId === conversationId) {
        setIsAIProcessing(true);
        setAiStreamingContent('');
        setAiError(null); // Clear any previous errors
        onProcessingChange?.(conversationId, true);
      }
    });

    // Handle streaming chunks (type-safe)
    const cleanupStream = addAIEventListener(AIEventNames.MESSAGE_STREAM, (event) => {
      const data = event.detail;
      if (data.topicId === conversationId) {
        // Keep isAIProcessing=true during streaming - only set to false on complete
        setAiStreamingContent(data.partial);
        setAiModelName(data.modelName); // Capture model name from streaming event
        setAiError(null); // Clear any errors during successful streaming
      }
    });

    // Handle message complete (type-safe)
    // NOTE: We don't clear aiStreamingContent here because the persisted message
    // arrives later via channel update. The duplicate detection will clear it.
    const cleanupComplete = addAIEventListener(AIEventNames.MESSAGE_COMPLETE, (event) => {
      const data = event.detail;
      if (data.topicId === conversationId) {
        setIsAIProcessing(false);
        setAiError(null); // Clear errors on success
        onProcessingChange?.(conversationId, false);

        // DON'T clear aiStreamingContent here - let duplicate detection handle it
        // But set a timeout fallback in case persisted message never arrives
        const timeout = setTimeout(() => {
          setAiStreamingContent('');
        }, 5000); // 5 second safety timeout
        setStreamingTimeout(timeout);
      }
    });

    // Handle errors (type-safe)
    const cleanupError = addAIEventListener(AIEventNames.ERROR, (event) => {
      const data = event.detail;
      console.error('[ChatView] AI Error:', data);
      if (data.topicId === conversationId) {
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : data.error.message || 'An error occurred while generating the response';

        setAiError(errorMessage);
        setIsAIProcessing(false);
        setAiStreamingContent('');
        onProcessingChange?.(conversationId, false);
      }
    });

    return () => {
      cleanupProgress();
      cleanupStream();
      cleanupComplete();
      cleanupError();
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
    onProcessingChange?.(conversationId, true)

    console.log('[ChatView] handleSendMessage - hasAIParticipant:', hasAIParticipant, 'conversationId:', conversationId)

    // Use hasAIParticipant to determine if this is an AI conversation
    // This is consistent with the prop passed from ChatLayout
    if (hasAIParticipant) {
      console.log('[ChatView] Setting isAIProcessing = true')
      // Use flushSync to force an immediate synchronous render
      // This ensures the spinner appears BEFORE any async events can fire
      flushSync(() => {
        setIsAIProcessing(true)
        setAiStreamingContent('')
      })
    } else {
      console.warn('[ChatView] NOT setting spinner - hasAIParticipant is false!')
    }

    try {
      await sendMessage(content, attachments)

      // Update last message preview with the sent message
      if (onMessageUpdate) {
        onMessageUpdate(content)
      }
    } finally {
      setIsProcessing(false)
      // For AI conversations, keep the spinner active until MESSAGE_COMPLETE fires
      // For non-AI conversations, clear the spinner immediately
      if (!hasAIParticipant) {
        onProcessingChange?.(conversationId, false)
      }
      // AI processing indicator will be cleared by streaming events (MESSAGE_COMPLETE)
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
      // TODO: Implement clearConversation via model.chatPlan
      console.log('[ChatView] TODO: Implement clearConversation for:', conversationId)
      // When implemented: await model.chatPlan.clearConversation({ conversationId })
      // Reload the page to reset everything
      // window.location.reload()
    }
  }

  return (
    <Card className="h-full w-full flex flex-col">
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
            <div className="border-b bg-muted/30 max-h-[40vh] overflow-y-auto ios-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
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
          aiModelName={aiModelName}
          aiError={aiError}
          topicId={conversationId}
        />
      </CardContent>
    </Card>
  )
})