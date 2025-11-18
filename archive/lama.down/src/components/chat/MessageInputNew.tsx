/**
 * Modern MessageInput Component
 * Uses Tailwind CSS via NativeWind for styling
 */

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface MessageInputProps {
  /**
   * Callback when a message is sent
   */
  onSend: (message: string) => void;

  /**
   * Whether the LLM is currently processing
   */
  isProcessing?: boolean;

  /**
   * Placeholder text for the input
   */
  placeholder?: string;

  /**
   * Called when attachment button is pressed
   */
  onAttachment?: () => void;

  /**
   * Custom class name
   */
  className?: string;
}

export function MessageInput({
  onSend,
  isProcessing = false,
  placeholder = 'Type a message...',
  onAttachment,
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const insets = useSafeAreaInsets();

  const handleSend = () => {
    if (message.trim() && !isProcessing) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View
        className={cn(
          'bg-background border-t border-border px-4 py-2',
          className
        )}
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      >
        <View className="flex-row items-end gap-2">
          {/* Attachment Button */}
          {onAttachment && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 mb-1"
              onPress={onAttachment}
            >
              <Text className="text-xl">📎</Text>
            </Button>
          )}

          {/* Text Input */}
          <View className="flex-1 bg-secondary rounded-2xl px-4 py-2 min-h-[40px] max-h-[120px]">
            <TextInput
              className="text-base text-foreground"
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={4000}
              editable={!isProcessing}
              textAlignVertical="center"
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>

          {/* Send Button */}
          <Button
            variant={message.trim() ? 'default' : 'ghost'}
            size="icon"
            className={cn(
              'h-10 w-10 mb-1 rounded-full',
              !message.trim() && 'opacity-50'
            )}
            onPress={handleSend}
            disabled={!message.trim() || isProcessing}
          >
            <Text className={cn(
              'text-xl',
              message.trim() ? 'text-primary-foreground' : 'text-foreground'
            )}>
              {isProcessing ? '⏳' : '➤'}
            </Text>
          </Button>
        </View>

        {/* Processing Indicator */}
        {isProcessing && (
          <View className="mt-2">
            <Text className="text-xs text-muted-foreground text-center">
              AI is thinking...
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
