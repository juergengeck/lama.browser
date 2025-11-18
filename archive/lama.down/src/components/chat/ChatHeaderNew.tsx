/**
 * Modern ChatHeader Component
 * Combines lama.ui design with React Native compatibility
 * Uses Tailwind CSS via NativeWind
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface Subject {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  messageCount: number;
  timestamp: number;
}

export interface ChatHeaderProps {
  conversationName: string;
  subjects?: Subject[];
  messageCount?: number;
  participantCount?: number;
  avatarSource?: string;
  hasAI?: boolean;
  onBack?: () => void;
  onSubjectClick?: (subject: Subject) => void;
  onToggleSummary?: () => void;
  showSummary?: boolean;
  onAddUsers?: () => void;
  onExportChat?: () => void;
  onSettings?: () => void;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  subjects = [],
  messageCount = 0,
  participantCount,
  avatarSource,
  hasAI = false,
  onBack,
  onSubjectClick,
  onToggleSummary,
  showSummary = false,
  onAddUsers,
  onExportChat,
  onSettings,
  className,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);

  // Get initials from conversation name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Collect unique keywords from all subjects
  const allKeywords = subjects.reduce((acc, subject) => {
    if (subject.keywords) {
      subject.keywords.forEach(keyword => {
        if (!acc.some(k => k.keyword === keyword)) {
          acc.push({ keyword, subject });
        }
      });
    }
    return acc;
  }, [] as Array<{ keyword: string; subject: Subject }>);

  return (
    <View className={cn('bg-background border-b border-border', className)}>
      {/* Title Bar */}
      <View className="flex-row items-center justify-between px-4 py-3">
        {/* Left: Back Button + Avatar + Name */}
        <View className="flex-row items-center gap-3 flex-1">
          {onBack && (
            <TouchableOpacity onPress={onBack} className="mr-1">
              <Text className="text-2xl text-foreground">←</Text>
            </TouchableOpacity>
          )}

          <Avatar size={40}>
            {avatarSource ? (
              <AvatarImage source={{ uri: avatarSource }} />
            ) : null}
            <AvatarFallback label={getInitials(conversationName)} />
          </Avatar>

          <View className="flex-1">
            <Text className="font-semibold text-base text-foreground" numberOfLines={1}>
              {conversationName}
            </Text>
            {(messageCount > 0 || participantCount) && (
              <Text className="text-xs text-muted-foreground">
                {messageCount > 0 && `${messageCount} messages`}
                {messageCount > 0 && participantCount && ' • '}
                {participantCount && `${participantCount} participants`}
              </Text>
            )}
          </View>
        </View>

        {/* Right: Action Buttons */}
        <View className="flex-row items-center gap-2">
          {/* AI Summary Button */}
          {hasAI && onToggleSummary && (
            <Button
              variant={showSummary ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onPress={onToggleSummary}
            >
              <Text className={cn(
                'text-base',
                showSummary ? 'text-primary-foreground' : 'text-foreground'
              )}>
                🧠
              </Text>
            </Button>
          )}

          {/* Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onPress={() => setMenuVisible(true)}
          >
            <Text className="text-base text-foreground">⋮</Text>
          </Button>
        </View>
      </View>

      {/* Keywords Bar */}
      {allKeywords.length > 0 && (
        <View className="px-4 pb-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row"
            contentContainerClassName="gap-2"
          >
            {allKeywords.map(({ keyword, subject }, idx) => (
              <Badge
                key={idx}
                label={keyword}
                variant="secondary"
                className="flex-shrink-0"
                onTouchEnd={() => onSubjectClick?.(subject)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50"
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity activeOpacity={1}>
              <View className="bg-background rounded-t-3xl px-4 py-6">
                <Text className="text-lg font-semibold text-foreground mb-4">
                  Chat Options
                </Text>

                {onAddUsers && (
                  <>
                    <TouchableOpacity
                      className="py-3"
                      onPress={() => {
                        setMenuVisible(false);
                        onAddUsers();
                      }}
                    >
                      <Text className="text-base text-foreground">
                        👥 Add Users
                      </Text>
                    </TouchableOpacity>
                    <Separator />
                  </>
                )}

                {onExportChat && (
                  <>
                    <TouchableOpacity
                      className="py-3"
                      onPress={() => {
                        setMenuVisible(false);
                        onExportChat();
                      }}
                    >
                      <Text className="text-base text-foreground">
                        💾 Export Chat
                      </Text>
                    </TouchableOpacity>
                    <Separator />
                  </>
                )}

                {onSettings && (
                  <>
                    <TouchableOpacity
                      className="py-3"
                      onPress={() => {
                        setMenuVisible(false);
                        onSettings();
                      }}
                    >
                      <Text className="text-base text-foreground">
                        ⚙️ Settings
                      </Text>
                    </TouchableOpacity>
                    <Separator />
                  </>
                )}

                <TouchableOpacity
                  className="py-3"
                  onPress={() => setMenuVisible(false)}
                >
                  <Text className="text-base text-muted-foreground text-center">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
