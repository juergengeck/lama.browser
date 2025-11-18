# Quick Start Guide

Get up and running with lama.app in minutes.

## Prerequisites

- Node.js 18+ installed
- Xcode (for iOS development)
- Android Studio (for Android development - optional)

## Installation

```bash
# Install dependencies
npm install

# Generate native projects (already done)
npx expo prebuild
```

## Running the App

### Development Mode (Recommended)

```bash
# Start Metro bundler
npm start

# Then:
# - Press 'i' for iOS Simulator
# - Press 'a' for Android Emulator
# - Press 'w' for Web Browser
# - Scan QR code with Expo Go app
```

### Native Mode (Full Features)

#### iOS
```bash
npm run ios
```

#### Android
```bash
npm run android
```

## Project Structure

```
lama.app/
├── app/              # Expo Router screens
│   ├── (tabs)/       # Tab navigation
│   ├── test-nativewind.tsx  # UI components demo
│   └── demo-chat.tsx        # Chat demo
├── src/
│   ├── components/   # UI components
│   │   ├── ui/       # Primitives (Button, Card, etc.)
│   │   └── chat/     # Chat components
│   ├── hooks/        # Custom hooks
│   ├── lib/          # Utilities
│   └── transport/    # Plan adapters
└── docs/            # Documentation
```

## Key Features

### ✅ NativeWind (Tailwind CSS)
```tsx
<View className="flex-1 p-4 bg-background">
  <Text className="text-2xl font-bold text-foreground">
    Hello!
  </Text>
</View>
```

### ✅ UI Components
```tsx
import { Button, Card, Badge } from '@/components/ui';

<Card>
  <Button title="Click me" variant="default" />
  <Badge label="New" variant="secondary" />
</Card>
```

### ✅ Chat Components
```tsx
import { ChatHeader, MessageBubble, MessageInput } from '@/components/chat';

<ChatHeader conversationName="Team Chat" />
<MessageBubble text="Hello!" isUser={true} timestamp={new Date()} />
<MessageInput onSend={handleSend} />
```

### ✅ Plan-Based Architecture
```tsx
import { useLamaClient } from '@hooks/useLamaClient';

const client = useLamaClient();
await client.chat.sendMessage({ topicId, content });
```

## Demo Screens

### UI Components Demo
```
Navigate to: /test-nativewind
```
Shows all UI primitives with variants and examples.

### Chat Demo
```
Navigate to: /demo-chat
```
Full-featured chat screen with modern components.

## Development Commands

```bash
# Start dev server
npm start

# Start with cleared cache
npm run start:clear

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web
npm run web

# Generate native projects
npm run prebuild

# Clean and regenerate
npm run prebuild:clean
```

## Common Tasks

### Add a New Screen

Create file in `app/` folder:
```tsx
// app/my-screen.tsx
export default function MyScreen() {
  return (
    <View className="flex-1 p-4 bg-background">
      <Text className="text-xl">My Screen</Text>
    </View>
  );
}
```

Navigate: `router.push('/my-screen')`

### Add a UI Component

```tsx
// src/components/ui/my-component.tsx
import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

export function MyComponent({ className, ...props }) {
  return (
    <View className={cn('p-4 bg-card rounded-lg', className)} {...props}>
      <Text className="text-foreground">My Component</Text>
    </View>
  );
}
```

### Use Tailwind Classes

All components support `className` prop:
```tsx
<View className="flex-1 bg-background p-4 gap-2">
  <Text className="text-2xl font-bold text-foreground">Title</Text>
  <Text className="text-base text-muted-foreground">Subtitle</Text>
</View>
```

### Call Plan Operations

```tsx
import { useLamaClient } from '@hooks/useLamaClient';

function MyComponent() {
  const client = useLamaClient();

  const handleSend = async () => {
    await client.chat.sendMessage({
      topicId: 'my-topic',
      content: 'Hello from plans!',
    });
  };

  return <Button title="Send" onPress={handleSend} />;
}
```

## Styling

### Color System
```tsx
// Backgrounds
bg-background       // Main background
bg-card            // Card background
bg-primary         // Primary brand
bg-secondary       // Secondary
bg-accent          // Accent
bg-muted           // Muted

// Text
text-foreground           // Main text
text-muted-foreground     // Muted text
text-primary-foreground   // On primary
```

### Common Patterns
```tsx
// Flex layouts
className="flex-1 flex-row items-center justify-between"

// Spacing
className="p-4 m-2 gap-4"

// Borders
className="border border-border rounded-lg"

// Shadows
className="shadow-sm shadow-md shadow-lg"
```

## Troubleshooting

### Metro bundler errors
```bash
npm run start:clear
```

### Native build errors
```bash
# iOS
cd ios && pod install && cd ..
npm run ios

# Android
cd android && ./gradlew clean && cd ..
npm run android
```

### TypeScript errors
```bash
# Reload TypeScript server in your IDE
# Or restart the dev server
```

## Documentation

- [UI Components](./UI_COMPONENTS.md) - All UI primitives
- [Chat Components](./CHAT_COMPONENTS.md) - Chat UI reference
- [NativeWind Setup](./NATIVEWIND_SETUP.md) - Tailwind guide
- [Native Development](./NATIVE_DEVELOPMENT.md) - iOS/Android guide
- [CLAUDE.md](../CLAUDE.md) - Project overview

## Support

- Check documentation in `docs/` folder
- Review example screens: `/test-nativewind`, `/demo-chat`
- Read inline comments in components

## Next Steps

1. ✅ Run `npm start` and test the app
2. ⏳ Explore `/test-nativewind` for UI components
3. ⏳ Check `/demo-chat` for chat implementation
4. ⏳ Build your features using the component library
5. ⏳ Read the full documentation for advanced features

Happy coding! 🚀
