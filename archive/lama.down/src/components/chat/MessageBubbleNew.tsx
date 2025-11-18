/**
 * Modern MessageBubble Component
 * Uses Tailwind CSS via NativeWind for styling
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'error';

export interface MessageBubbleProps {
  /**
   * The message text
   */
  text: string;

  /**
   * Whether this is a user message (right) or other person/AI (left)
   */
  isUser: boolean;

  /**
   * Sender name (for non-user messages)
   */
  senderName?: string;

  /**
   * Sender avatar URL
   */
  avatarSource?: string;

  /**
   * Timestamp of the message
   */
  timestamp: Date;

  /**
   * Current status of the message
   */
  status?: MessageStatus;

  /**
   * Whether this is an AI message
   */
  isAI?: boolean;

  /**
   * Message keywords/tags
   */
  keywords?: string[];

  /**
   * Custom class name
   */
  className?: string;
}

export function MessageBubble({
  text,
  isUser,
  senderName,
  avatarSource,
  timestamp,
  status = 'sent',
  isAI = false,
  keywords = [],
  className,
}: MessageBubbleProps) {
  const timeString = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return '⏱';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'seen':
        return '✓✓';
      case 'error':
        return '⚠️';
      default:
        return '';
    }
  };

  return (
    <View
      className={cn(
        'flex-row w-full px-4 py-2',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {/* Left Avatar (for non-user messages) */}
      {!isUser && (
        <Avatar size={32} className="mt-1 mr-2">
          {avatarSource ? (
            <AvatarImage source={{ uri: avatarSource }} />
          ) : null}
          <AvatarFallback
            label={senderName ? getInitials(senderName) : '?'}
          />
        </Avatar>
      )}

      {/* Message Content */}
      <View className={cn('max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        {/* Sender Name (for non-user messages) */}
        {!isUser && senderName && (
          <Text className="text-xs text-muted-foreground mb-1 ml-1">
            {senderName}
            {isAI && ' 🤖'}
          </Text>
        )}

        {/* Message Bubble */}
        <View
          className={cn(
            'rounded-2xl px-4 py-2 shadow-sm',
            isUser
              ? 'bg-primary rounded-tr-sm'
              : isAI
              ? 'bg-accent rounded-tl-sm'
              : 'bg-secondary rounded-tl-sm'
          )}
        >
          <Text
            className={cn(
              'text-base leading-5',
              isUser
                ? 'text-primary-foreground'
                : isAI
                ? 'text-accent-foreground'
                : 'text-secondary-foreground'
            )}
            selectable
          >
            {text}
          </Text>

          {/* Keywords */}
          {keywords.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-2">
              {keywords.map((keyword, idx) => (
                <Badge
                  key={idx}
                  label={keyword}
                  variant="outline"
                  className="opacity-70"
                  textClassName="text-xs"
                />
              ))}
            </View>
          )}
        </View>

        {/* Timestamp and Status */}
        <View className="flex-row items-center gap-1 mt-1 px-1">
          <Text className="text-xs text-muted-foreground">{timeString}</Text>
          {isUser && (
            <Text className="text-xs text-muted-foreground">
              {getStatusIcon()}
            </Text>
          )}
        </View>
      </View>

      {/* Right Spacer (for user messages, to keep alignment) */}
      {isUser && <View className="w-9" />}
    </View>
  );
}
