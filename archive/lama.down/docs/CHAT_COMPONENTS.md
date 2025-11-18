# Chat Components

Modern chat UI components using Tailwind CSS and NativeWind.

## Overview

The chat components provide a complete messaging interface with:
- **ChatHeader** - Header with conversation info, subjects, and actions
- **MessageBubble** - Individual message display with avatars and status
- **MessageInput** - Input field with send button and attachment support

All components are styled with Tailwind CSS and fully compatible with React Native.

## ChatHeader

Header component displaying conversation name, subjects/keywords, and action buttons.

### Basic Usage

```tsx
import { ChatHeader } from '@/components/chat/ChatHeaderNew';

<ChatHeader
  conversationName="Team Chat"
  messageCount={42}
  participantCount={5}
  onBack={() => navigation.goBack()}
  onSettings={() => navigation.navigate('Settings')}
/>
```

### With Subjects

```tsx
const subjects = [
  {
    id: '1',
    name: 'Project Alpha',
    description: 'Discussing project milestones',
    keywords: ['Alpha', 'Milestones', 'Q4'],
    messageCount: 25,
    timestamp: Date.now(),
  },
];

<ChatHeader
  conversationName="Project Discussion"
  subjects={subjects}
  onSubjectClick={(subject) => console.log('Clicked:', subject.name)}
/>
```

### With AI Features

```tsx
<ChatHeader
  conversationName="AI Assistant"
  hasAI={true}
  showSummary={showSummary}
  onToggleSummary={() => setShowSummary(!showSummary)}
/>
```

### Full Example

```tsx
<ChatHeader
  conversationName="Development Team"
  subjects={subjects}
  messageCount={150}
  participantCount={8}
  avatarSource="https://..."
  hasAI={true}
  showSummary={false}
  onBack={() => router.back()}
  onSubjectClick={handleSubjectClick}
  onToggleSummary={() => setShowSummary(!showSummary)}
  onAddUsers={() => showAddUsersModal()}
  onExportChat={() => exportConversation()}
  onSettings={() => router.push('/settings')}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `conversationName` | `string` | Required | Name/title of the conversation |
| `subjects` | `Subject[]` | `[]` | Array of conversation subjects with keywords |
| `messageCount` | `number` | `0` | Total number of messages |
| `participantCount` | `number` | - | Number of participants |
| `avatarSource` | `string` | - | URL for conversation avatar |
| `hasAI` | `boolean` | `false` | Whether conversation has AI participant |
| `onBack` | `() => void` | - | Called when back button is pressed |
| `onSubjectClick` | `(subject) => void` | - | Called when keyword badge is clicked |
| `onToggleSummary` | `() => void` | - | Called when AI summary button is pressed |
| `showSummary` | `boolean` | `false` | Whether AI summary is active |
| `onAddUsers` | `() => void` | - | Called when Add Users is selected |
| `onExportChat` | `() => void` | - | Called when Export is selected |
| `onSettings` | `() => void` | - | Called when Settings is selected |
| `className` | `string` | - | Additional Tailwind classes |

### Subject Interface

```typescript
interface Subject {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  messageCount: number;
  timestamp: number;
}
```

## MessageBubble

Individual message display with sender info, avatar, and styling.

### Basic Usage

```tsx
import { MessageBubble } from '@/components/chat/MessageBubbleNew';

<MessageBubble
  text="Hello, world!"
  isUser={true}
  timestamp={new Date()}
/>
```

### Non-User Message

```tsx
<MessageBubble
  text="Hi there! How can I help?"
  isUser={false}
  senderName="Alice"
  avatarSource="https://..."
  timestamp={new Date()}
/>
```

### AI Message

```tsx
<MessageBubble
  text="Here's a summary of the conversation..."
  isUser={false}
  senderName="AI Assistant"
  isAI={true}
  keywords={['Summary', 'AI', 'Analysis']}
  timestamp={new Date()}
/>
```

### With Keywords

```tsx
<MessageBubble
  text="Let's discuss the React Native architecture"
  isUser={false}
  senderName="Bob"
  keywords={['React', 'Native', 'Architecture']}
  timestamp={new Date()}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | Required | Message content |
| `isUser` | `boolean` | Required | Whether message is from current user |
| `senderName` | `string` | - | Name of sender (for non-user messages) |
| `avatarSource` | `string` | - | URL for sender avatar |
| `timestamp` | `Date` | Required | Message timestamp |
| `status` | `MessageStatus` | `'sent'` | Message delivery status |
| `isAI` | `boolean` | `false` | Whether message is from AI |
| `keywords` | `string[]` | `[]` | Message keywords/tags |
| `className` | `string` | - | Additional Tailwind classes |

### MessageStatus

```typescript
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'error';
```

## MessageInput

Input field for composing and sending messages.

### Basic Usage

```tsx
import { MessageInput } from '@/components/chat/MessageInputNew';

<MessageInput
  onSend={(message) => sendMessage(message)}
  placeholder="Type a message..."
/>
```

### With Processing State

```tsx
const [isProcessing, setIsProcessing] = useState(false);

<MessageInput
  onSend={async (message) => {
    setIsProcessing(true);
    await sendToAI(message);
    setIsProcessing(false);
  }}
  isProcessing={isProcessing}
/>
```

### With Attachments

```tsx
<MessageInput
  onSend={sendMessage}
  onAttachment={() => pickFile()}
  placeholder="Message..."
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSend` | `(message: string) => void` | Required | Called when message is sent |
| `isProcessing` | `boolean` | `false` | Whether AI/server is processing |
| `placeholder` | `string` | `'Type a message...'` | Input placeholder text |
| `onAttachment` | `() => void` | - | Called when attachment button is pressed |
| `className` | `string` | - | Additional Tailwind classes |

## Complete Chat Screen Example

```tsx
import React, { useState } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { ChatHeader, MessageBubble, MessageInput } from '@/components/chat';
import { useRouter } from 'expo-router';

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async (text) => {
    const newMessage = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);

    // Send to server/AI
    setIsProcessing(true);
    const response = await sendToServer(text);
    setIsProcessing(false);

    setMessages(prev => [...prev, response]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ChatHeader
        conversationName="Chat"
        messageCount={messages.length}
        onBack={() => router.back()}
      />

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            text={item.text}
            isUser={item.isUser}
            senderName={item.senderName}
            timestamp={item.timestamp}
            isAI={item.isAI}
          />
        )}
        className="flex-1"
      />

      <MessageInput
        onSend={handleSend}
        isProcessing={isProcessing}
      />
    </KeyboardAvoidingView>
  );
}
```

## Customization

### Custom Colors

Use Tailwind classes to customize appearance:

```tsx
<MessageBubble
  text="Custom styled message"
  isUser={true}
  timestamp={new Date()}
  className="bg-blue-500"  // Custom background
/>
```

### Custom Message Rendering

Extend MessageBubble for custom content:

```tsx
<MessageBubble
  text={message.text}
  isUser={false}
  timestamp={message.timestamp}
>
  {/* Add custom content like images, files, etc. */}
  <Image source={{ uri: message.imageUrl }} />
</MessageBubble>
```

## Styling

All components use Tailwind CSS classes:

- `bg-primary` - Primary brand color
- `bg-secondary` - Secondary background
- `bg-accent` - Accent color (for AI messages)
- `text-foreground` - Primary text color
- `text-muted-foreground` - Secondary text color
- `border-border` - Border color

## Testing

View the demo chat screen:

```bash
npm start
# Navigate to /demo-chat
```

## Migration from Legacy Components

### From Old ChatHeader

```tsx
// Old
import { ChatHeader } from '@/components/chat/ChatHeader';
<ChatHeader
  topicName="Chat"
  status="connected"
  onBack={handleBack}
/>

// New
import { ChatHeader } from '@/components/chat/ChatHeaderNew';
<ChatHeader
  conversationName="Chat"
  onBack={handleBack}
/>
```

### From Old MessageBubble

```tsx
// Old
import { MessageBubble } from '@/components/chat/MessageBubble';
<MessageBubble
  text={message.text}
  isUser={message.isUser}
  timestamp={message.timestamp}
/>

// New (same API, improved styling)
import { MessageBubble } from '@/components/chat/MessageBubbleNew';
<MessageBubble
  text={message.text}
  isUser={message.isUser}
  timestamp={message.timestamp}
/>
```

## Related Documentation

- [UI Components](./UI_COMPONENTS.md)
- [NativeWind Setup](./NATIVEWIND_SETUP.md)
- [lama.ui Chat Components](../../lama.ui/src/components/chat/README.md)
