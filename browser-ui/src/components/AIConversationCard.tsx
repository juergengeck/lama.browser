import { useState } from 'react'
import { Loader2, MoreVertical, Edit, CheckCheck, UserPlus, Trash2, Settings, ChevronDown, History, Brain, VolumeX, Headphones, MessageCircle } from 'lucide-react'
import { Button } from '@lama/ui'
import { ParticipantAvatars } from '@lama/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@lama/ui'

export interface Participant {
  id: string
  name: string
  isLLM: boolean
  color?: string
}

export interface Conversation {
  id: string
  name: string
  type?: 'direct' | 'group'
  participants: Participant[]
  participantCount?: number
  lastMessage?: string
  lastMessageTime?: Date | string
  modelName?: string
  isGroup?: boolean
  hasAIParticipant?: boolean
  isAITopic?: boolean
  ownerId?: string  // ID of the topic owner
}

export interface PastIdentity {
  personId: string
  name: string
}

interface AIConversationCardProps {
  conversation: Conversation
  isSelected: boolean
  isProcessing: boolean
  isCollapsed: boolean
  pastIdentities?: PastIdentity[]
  onSelect: (id: string) => void
  onRename?: (id: string) => void
  onAddUsers?: (id: string) => void
  onConfigureMCP?: (id: string) => void
  onConfigureLLM?: (id: string) => void
  onSetAIMode?: (id: string, mode: 'off' | 'listen' | 'speak') => void
  onDelete: (id: string) => void
  formatTime: (time?: Date | string) => string
  stripMarkdown: (text: string) => string
}

export function AIConversationCard({
  conversation,
  isSelected,
  isProcessing,
  isCollapsed,
  pastIdentities = [],
  onSelect,
  onRename,
  onAddUsers,
  onConfigureMCP,
  onConfigureLLM,
  onSetAIMode,
  onDelete,
  formatTime,
  stripMarkdown
}: AIConversationCardProps) {
  const [showPastIdentities, setShowPastIdentities] = useState(false)
  const hasPastIdentities = pastIdentities.length > 0

  // Separate owner from other participants
  const owner = conversation.ownerId
    ? conversation.participants.find(p => p.id === conversation.ownerId)
    : null
  const otherParticipants = conversation.ownerId
    ? conversation.participants.filter(p => p.id !== conversation.ownerId)
    : conversation.participants

  if (isCollapsed) {
    // Collapsed: show participant count in a badge
    const participantCount = conversation.participants?.length || 0
    return (
      <div
        onClick={() => onSelect(conversation.id)}
        className={`cursor-pointer transition-all mx-auto relative ${
          isSelected ? 'ring-2 ring-primary/50' : ''
        }`}
        title={`${conversation.name} (${participantCount} ${participantCount === 1 ? 'participant' : 'participants'})`}
      >
        {isProcessing ? (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs shadow-sm">
            {participantCount}
          </div>
        )}
        {hasPastIdentities && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-background border border-border rounded-full flex items-center justify-center">
            <History className="w-2 h-2 text-primary" />
          </div>
        )}
      </div>
    )
  }

  // Expanded: full conversation card with past identities
  const isGroupChat = conversation.participants.length > 2

  return (
    <div className="relative">
      {/* Other Participants (shown above card ONLY for group chats with 3+ participants) */}
      {isGroupChat && otherParticipants.length > 0 && (
        <div className="flex items-center gap-1 mb-1 ml-2">
          <ParticipantAvatars participants={otherParticipants} size="xs" maxDisplay={5} />
          {otherParticipants.length > 1 && (
            <span className="text-[9px] text-muted-foreground">
              +{otherParticipants.length - 1} other{otherParticipants.length > 2 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div
        onClick={() => onSelect(conversation.id)}
        className={`group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-primary/10 border border-primary/30'
            : 'hover:bg-muted/50 border border-transparent'
        }`}
      >
        {/* Avatar on LEFT - show other participant for 1-on-1, owner for group */}
        {!isProcessing && (
          isGroupChat && owner ? (
            <div className="flex-shrink-0 pt-0.5">
              <ParticipantAvatars participants={[owner]} size="sm" maxDisplay={1} />
            </div>
          ) : otherParticipants.length > 0 ? (
            <div className="flex-shrink-0 pt-0.5">
              <ParticipantAvatars participants={[otherParticipants[0]]} size="sm" maxDisplay={1} />
            </div>
          ) : (
            <div className="flex-shrink-0 pt-0.5">
              <ParticipantAvatars participants={conversation.participants} size="sm" maxDisplay={1} />
            </div>
          )
        )}

        {/* Content - full width */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <h3 className="font-medium text-xs overflow-hidden relative pr-2 flex-1">
                <span className="block truncate">{conversation.name}</span>
                <span className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-current to-transparent pointer-events-none opacity-20" style={{
                  background: isSelected
                    ? 'linear-gradient(to left, hsl(var(--primary) / 0.1), transparent)'
                    : 'linear-gradient(to left, hsl(var(--background)), transparent)'
                }} />
              </h3>
              {hasPastIdentities && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPastIdentities(!showPastIdentities)
                  }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-primary/10 transition-colors"
                  title={`${pastIdentities.length} past ${pastIdentities.length === 1 ? 'identity' : 'identities'}`}
                >
                  <ChevronDown
                    className={`h-3 w-3 text-primary/70 transition-transform ${
                      showPastIdentities ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            {/* Time and Menu on RIGHT */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">{formatTime(conversation.lastMessageTime)}</span>
              {isProcessing && (
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-primary animate-spin" />
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    onClick={(e) => e.stopPropagation()}
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onRename && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onRename(conversation.id)
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                  )}
                  {onAddUsers && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddUsers(conversation.id)
                      }}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add User
                    </DropdownMenuItem>
                  )}
                  {onConfigureMCP && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onConfigureMCP(conversation.id)
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      MCP Settings
                    </DropdownMenuItem>
                  )}
                  {onConfigureLLM && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onConfigureLLM(conversation.id)
                      }}
                    >
                      <Brain className="mr-2 h-4 w-4" />
                      Model Settings
                    </DropdownMenuItem>
                  )}
                  {onSetAIMode && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetAIMode(conversation.id, 'off')
                        }}
                      >
                        <VolumeX className="mr-2 h-4 w-4 text-gray-500" />
                        AI: Off
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetAIMode(conversation.id, 'listen')
                        }}
                      >
                        <Headphones className="mr-2 h-4 w-4 text-blue-500" />
                        AI: Listen
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetAIMode(conversation.id, 'speak')
                        }}
                      >
                        <MessageCircle className="mr-2 h-4 w-4 text-green-500" />
                        AI: Speak
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(conversation.id)
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {conversation.lastMessage && (
            <p className="text-[10px] text-muted-foreground mb-0.5 line-clamp-1">
              {(() => {
                const cleaned = stripMarkdown(conversation.lastMessage)
                return cleaned.length > 40
                  ? cleaned.substring(0, 40) + '...'
                  : cleaned
              })()}
            </p>
          )}

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              {conversation.lastMessage && (
                <CheckCheck className="h-3 w-3 text-primary/70" />
              )}
            </div>
            {conversation.modelName && (
              <span className="text-primary text-[10px] font-medium">{conversation.modelName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Past Identities Section */}
      {showPastIdentities && hasPastIdentities && (
        <div className="ml-4 mt-1 mb-2 p-2 bg-muted/30 rounded-md border border-border/50">
          <div className="flex items-center gap-1.5 mb-1.5">
            <History className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">
              Past Identities
            </span>
          </div>
          <div className="space-y-1">
            {pastIdentities.map((identity) => (
              <div
                key={identity.personId}
                className="text-[10px] text-muted-foreground/80 italic pl-2 py-0.5"
              >
                {identity.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
