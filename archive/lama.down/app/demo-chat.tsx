/**
 * Demo Chat Screen
 * Showcases the new modern chat components
 */

import React, { useState } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { ChatHeader, Subject } from '@/components/chat/ChatHeaderNew';
import { MessageBubble } from '@/components/chat/MessageBubbleNew';
import { MessageInput } from '@/components/chat/MessageInputNew';
import { useRouter } from 'expo-router';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  senderName?: string;
  avatarSource?: string;
  timestamp: Date;
  isAI?: boolean;
  keywords?: string[];
}

const DEMO_SUBJECTS: Subject[] = [
  {
    id: '1',
    name: 'React Native',
    description: 'Discussing React Native development',
    keywords: ['React', 'Native', 'Mobile', 'Development'],
    messageCount: 15,
    timestamp: Date.now(),
  },
  {
    id: '2',
    name: 'Tailwind CSS',
    description: 'Styling with Tailwind',
    keywords: ['Tailwind', 'CSS', 'Styling', 'NativeWind'],
    messageCount: 8,
    timestamp: Date.now() - 1000,
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Hey! How are the new UI components looking?',
    isUser: false,
    senderName: 'Alice',
    timestamp: new Date(Date.now() - 10000),
    keywords: ['UI', 'Components'],
  },
  {
    id: '2',
    text: "They look amazing! The Tailwind integration is working perfectly.",
    isUser: true,
    timestamp: new Date(Date.now() - 8000),
  },
  {
    id: '3',
    text: "That's great to hear! What about the chat components?",
    isUser: false,
    senderName: 'Alice',
    timestamp: new Date(Date.now() - 6000),
  },
  {
    id: '4',
    text: 'The ChatHeader, MessageBubble, and MessageInput all work great. They use our new shadcn/ui-inspired components.',
    isUser: true,
    timestamp: new Date(Date.now() - 4000),
    keywords: ['ChatHeader', 'MessageBubble', 'MessageInput'],
  },
  {
    id: '5',
    text: 'Excellent! The new design system should make development much faster. Would you like me to help test the AI features?',
    isUser: false,
    senderName: 'AI Assistant',
    timestamp: new Date(Date.now() - 2000),
    isAI: true,
    keywords: ['AI', 'Testing'],
  },
];

export default function DemoChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const handleSend = async (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate AI response
    setIsProcessing(true);
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `I received your message: "${text}". This is a demo response!`,
        isUser: false,
        senderName: 'AI Assistant',
        timestamp: new Date(),
        isAI: true,
        keywords: ['Demo', 'Response'],
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsProcessing(false);
    }, 1500);
  };

  const handleSubjectClick = (subject: Subject) => {
    console.log('Subject clicked:', subject.name);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <ChatHeader
        conversationName="Demo Chat"
        subjects={DEMO_SUBJECTS}
        messageCount={messages.length}
        participantCount={2}
        hasAI={true}
        showSummary={showSummary}
        onBack={() => router.back()}
        onSubjectClick={handleSubjectClick}
        onToggleSummary={() => setShowSummary(!showSummary)}
        onExportChat={() => console.log('Export chat')}
        onSettings={() => console.log('Settings')}
      />

      {/* Messages List */}
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            text={item.text}
            isUser={item.isUser}
            senderName={item.senderName}
            avatarSource={item.avatarSource}
            timestamp={item.timestamp}
            isAI={item.isAI}
            keywords={item.keywords}
          />
        )}
        contentContainerClassName="py-4"
        className="flex-1"
      />

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        isProcessing={isProcessing}
        placeholder="Type a message..."
        onAttachment={() => console.log('Attachment pressed')}
      />
    </KeyboardAvoidingView>
  );
}
