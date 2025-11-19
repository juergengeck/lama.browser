/**
 * EnhancedMessageBubble
 * 
 * Enhanced message bubble component that displays Subject hashtags and trust information.
 * Web-compatible version for LAMA desktop integration.
 */

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import './EnhancedMessageBubble.css';
import './FormattedMessageContent.css';
import { MessageContextMenu } from './MessageContextMenu';
import './MessageContextMenu.css';
import { createAttachmentView } from '@/components/attachments/AttachmentViewFactory';
import type { MessageAttachment, BlobDescriptor } from '@/types/attachments';

// Enhanced message data
export interface EnhancedMessageData {
  id: string;
  content: string;  // Changed from 'text' to match handler output
  senderId: string;
  senderName: string;
  timestamp: Date;
  isOwn: boolean;
  topicName?: string; // The topic/channel this message belongs to

  // Version information
  versionId?: string;
  version?: number;
  previousVersion?: string | null;
  editedAt?: Date | null;
  editReason?: string | null;
  isRetracted?: boolean;
  retractedAt?: Date | null;
  retractReason?: string | null;

  // Format and markup
  format?: 'plain' | 'markdown' | 'html' | 'onecore';
  metadata?: any;

  // Subject hashtags and keywords
  subjects: string[];
  keywords?: string[];

  // Attachments - using MessageAttachment type from attachment system
  attachments?: MessageAttachment[];

  // Trust information
  trustLevel: number;
  canDownload?: boolean;

  // Assertion certificate
  assertionCertificate?: string;
}

export interface EnhancedMessageBubbleProps {
  message: EnhancedMessageData;
  onHashtagClick?: (hashtag: string) => void;
  onAttachmentClick?: (attachmentId: string) => void;
  onDownloadAttachment?: (attachmentId: string) => void;
  theme?: 'light' | 'dark';
  attachmentDescriptors?: Map<string, BlobDescriptor>;
}

// Subject hashtag chip component
const SubjectHashtagChip: React.FC<{
  hashtag: string;
  onClick?: () => void;
  size?: 'small' | 'normal';
  theme?: 'light' | 'dark';
}> = ({ hashtag, onClick, size = 'normal', theme = 'dark' }) => {
  
  return (
    <button
      className={`hashtag-chip ${size} ${theme} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      #{hashtag}
    </button>
  );
};

// Trust level indicator
const TrustLevelIndicator: React.FC<{
  trustLevel: number;
  compact?: boolean;
  theme?: 'light' | 'dark';
}> = ({ trustLevel, compact = false, theme = 'dark' }) => {
  
  const getTrustInfo = (level: number) => {
    switch (level) {
      case 1: return { label: 'Acquaintance', color: '#9E9E9E' };
      case 2: return { label: 'Contact', color: '#2196F3' };
      case 3: return { label: 'Colleague', color: '#4CAF50' };
      case 4: return { label: 'Friend', color: '#FF9800' };
      case 5: return { label: 'Close Friend', color: '#E91E63' };
      default: return { label: 'Unknown', color: '#666' };
    }
  };
  
  const { label, color } = getTrustInfo(trustLevel);
  
  if (compact) {
    return (
      <div 
        className="trust-dot"
        style={{ backgroundColor: color }}
        title={label}
      />
    );
  }
  
  return (
    <div className="trust-indicator" style={{ borderColor: color }}>
      <div className="trust-dot" style={{ backgroundColor: color }} />
      <span className="trust-label">{label}</span>
    </div>
  );
};


// Message text parser that highlights hashtags
const MessageTextWithHashtags: React.FC<{
  text: string;
  onHashtagClick?: (hashtag: string) => void;
  theme?: 'light' | 'dark';
}> = ({ text, onHashtagClick, theme = 'dark' }) => {
  
  // Split text by hashtags and render with clickable hashtag spans
  const renderTextWithHashtags = () => {
    const hashtagRegex = /(#[\w-]+)/g;
    const parts = text.split(hashtagRegex);
    
    return parts.map((part, index) => {
      if (part.match(hashtagRegex)) {
        return (
          <span
            key={index}
            className={`inline-hashtag ${theme} ${onHashtagClick ? 'clickable' : ''}`}
            onClick={() => onHashtagClick?.(part.slice(1))}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };
  
  return <div className="message-text">{renderTextWithHashtags()}</div>;
};

// Main enhanced message bubble component
export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({
  message,
  onHashtagClick,
  onAttachmentClick,
  onDownloadAttachment,
  theme = 'dark',
  attachmentDescriptors
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('[EnhancedMessageBubble] Context menu triggered at:', e.clientX, e.clientY);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleLike = async () => {
    setLiked(!liked);
    if (disliked) setDisliked(false);

    // Record feedback for all subjects in this message
    if (message.subjects && message.subjects.length > 0) {
      console.log('[EnhancedMessageBubble] Recording like for subjects:', message.subjects);

      for (const subjectId of message.subjects) {
        try {
          const result = await (window as any).electronAPI.invoke('topics:recordFeedback', {
            subjectId,
            feedbackType: 'like'
          });

          if (result.success) {
            console.log('[EnhancedMessageBubble] Feedback recorded for subject:', subjectId, result.subject);
          } else {
            console.error('[EnhancedMessageBubble] Failed to record feedback:', result.error);
          }
        } catch (error) {
          console.error('[EnhancedMessageBubble] Error recording feedback:', error);
        }
      }
    } else {
      console.log('[EnhancedMessageBubble] No subjects to record feedback for');
    }
  };

  const handleDislike = async () => {
    setDisliked(!disliked);
    if (liked) setLiked(false);

    // Record feedback for all subjects in this message
    if (message.subjects && message.subjects.length > 0) {
      console.log('[EnhancedMessageBubble] Recording dislike for subjects:', message.subjects);

      for (const subjectId of message.subjects) {
        try {
          const result = await (window as any).electronAPI.invoke('topics:recordFeedback', {
            subjectId,
            feedbackType: 'dislike'
          });

          if (result.success) {
            console.log('[EnhancedMessageBubble] Feedback recorded for subject:', subjectId, result.subject);
          } else {
            console.error('[EnhancedMessageBubble] Failed to record feedback:', result.error);
          }
        } catch (error) {
          console.error('[EnhancedMessageBubble] Error recording feedback:', error);
        }
      }
    } else {
      console.log('[EnhancedMessageBubble] No subjects to record feedback for');
    }
  };

  const [showFullTimestamp, setShowFullTimestamp] = useState(false);
  
  const formatTimestamp = (date: Date, full: boolean = false) => {
    if (full) {
      return date.toLocaleString();
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  // Check if message contains tables or code blocks (for wide layout)
  const hasWideContent = message.content && (
    message.content.includes('```') || // Code blocks
    message.content.includes('|') // Likely a table
  );

  return (
    <>
      <div
        className={`enhanced-message-bubble ${message.isOwn ? 'own' : 'other'} ${theme} ${hasWideContent ? 'has-wide-content' : ''}`}
        onContextMenu={handleContextMenu}
      >
        <div className="message-header">
        <span className="sender-name">{message.senderName}</span>
        {/* Show topic/channel if not General Chat */}
        {message.topicName && message.topicName !== 'General Chat' && (
          <span className="topic-name" style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '0.5rem' }}>
            #{message.topicName}
          </span>
        )}
        {/* Show edited indicator */}
        {message.version && message.version > 1 && !message.isRetracted && (
          <span className="edited-indicator" style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '0.5rem' }}>
            (edited)
          </span>
        )}
        {/* Show certified indicator */}
        {message.assertionCertificate && (
          <span
            className="certified-indicator"
            style={{
              fontSize: '0.75rem',
              marginLeft: '0.5rem',
              color: theme === 'dark' ? '#4CAF50' : '#2E7D32',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px'
            }}
            title={`Certified: ${message.assertionCertificate.substring(0, 8)}...`}
          >
            🔐
          </span>
        )}
        <TrustLevelIndicator
          trustLevel={message.trustLevel}
          compact
          theme={theme}
        />
      </div>
      
      <div className="message-content">
        {/* Message actions in upper right corner for non-own messages */}
        {!message.isOwn && (
          <div className="message-actions-top-right">
            <button
              onClick={handleCopy}
              className="action-button-top"
              title="Copy message"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              onClick={handleLike}
              className="action-button-top"
              title="Like message"
              style={{
                background: liked ? (theme === 'dark' ? '#065f46' : '#d1fae5') : 'transparent',
                color: liked ? (theme === 'dark' ? '#34d399' : '#10b981') : (theme === 'dark' ? '#9ca3af' : '#6b7280')
              }}
            >
              <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleDislike}
              className="action-button-top"
              title="Dislike message"
              style={{
                background: disliked ? (theme === 'dark' ? '#7f1d1d' : '#fee2e2') : 'transparent',
                color: disliked ? (theme === 'dark' ? '#f87171' : '#ef4444') : (theme === 'dark' ? '#9ca3af' : '#6b7280')
              }}
            >
              <ThumbsDown size={14} fill={disliked ? 'currentColor' : 'none'} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            {message.isRetracted ? (
              <div className="retracted-message" style={{
                opacity: 0.6,
                fontStyle: 'italic',
                color: theme === 'dark' ? '#999' : '#666'
              }}>
                [Message retracted{message.retractReason ? `: ${message.retractReason}` : ''}]
              </div>
            ) : message.content ? (
              <div className="formatted-message-content markdown-content" style={{
                overflowX: 'auto',
                maxWidth: '100%'
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div style={{color: 'red'}}>[No message text]</div>
            )}
            
            {!message.isRetracted && message.attachments && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment) => {
                  const descriptor = attachmentDescriptors?.get(attachment.hash as string);
                  return (
                    <div key={attachment.hash as string} className="mb-2">
                      {createAttachmentView(attachment, descriptor, {
                        mode: 'inline',
                        showMetadata: true,
                        maxWidth: 400,
                        maxHeight: 300
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            
            {!message.isRetracted && message.subjects.length > 0 && (!message.attachments || message.attachments.length === 0) && (
              <div className="message-subjects">
                {message.subjects.map((subject, index) => (
                  <SubjectHashtagChip
                    key={index}
                    hashtag={subject}
                    onClick={() => onHashtagClick?.(subject)}
                    theme={theme}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Timestamp and checkmarks in bottom right of bubble */}
          <div className="flex items-end gap-1 text-xs opacity-60 shrink-0 ml-2 mr-1">
            <span className="text-[10px]">
              {new Date(message.timestamp).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }).toLowerCase()}
            </span>
            {message.isOwn && (
              <span className="text-xs">✓✓</span>
            )}
          </div>
        </div>
      </div>
      </div>

      {contextMenu && (
        <MessageContextMenu
          message={message}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onCopy={(text) => console.log('Copied:', text)}
        />
      )}
    </>
  );
};