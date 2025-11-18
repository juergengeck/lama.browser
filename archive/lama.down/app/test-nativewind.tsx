/**
 * Test screen to verify NativeWind is working
 * Access via /test-nativewind route
 */

import { View, Text, ScrollView } from 'react-native';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Input,
  Separator,
} from '@/components/ui';

export default function TestNativeWind() {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-6 gap-4">
        {/* Header */}
        <Text className="text-3xl font-bold text-foreground">
          NativeWind Test
        </Text>
        <Text className="text-base text-muted-foreground">
          Testing Tailwind CSS in React Native
        </Text>

        {/* Buttons */}
        <Text className="text-xl font-bold text-foreground mt-6">Buttons</Text>
        <View className="gap-3">
          <Button
            title="Default Button"
            variant="default"
            onPress={() => console.log('Default pressed')}
          />
          <Button
            title="Secondary Button"
            variant="secondary"
            onPress={() => console.log('Secondary pressed')}
          />
          <Button
            title="Outline Button"
            variant="outline"
            onPress={() => console.log('Outline pressed')}
          />
          <Button
            title="Ghost Button"
            variant="ghost"
            onPress={() => console.log('Ghost pressed')}
          />
        </View>

        {/* Badges */}
        <Text className="text-xl font-bold text-foreground mt-6">Badges</Text>
        <View className="flex-row gap-2 flex-wrap">
          <Badge label="Default" variant="default" />
          <Badge label="Secondary" variant="secondary" />
          <Badge label="Destructive" variant="destructive" />
          <Badge label="Outline" variant="outline" />
        </View>

        {/* Avatars */}
        <Text className="text-xl font-bold text-foreground mt-6">Avatars</Text>
        <View className="flex-row gap-4">
          <Avatar size={50}>
            <AvatarFallback label="JD" />
          </Avatar>
          <Avatar size={50}>
            <AvatarFallback label="AB" />
          </Avatar>
          <Avatar size={50}>
            <AvatarFallback label="CD" />
          </Avatar>
        </View>

        {/* Cards */}
        <Text className="text-xl font-bold text-foreground mt-6">Cards</Text>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>
              This is a card description using the Card component
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-foreground">
              Card content goes here. This demonstrates the full card component with header and content sections.
            </Text>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Another Card</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            <Badge label="Feature" variant="secondary" />
            <Text className="text-sm text-muted-foreground">
              Cards can contain any content including badges, buttons, and text.
            </Text>
          </CardContent>
        </Card>

        {/* Input */}
        <Text className="text-xl font-bold text-foreground mt-6">Input</Text>
        <Input placeholder="Enter your name..." />
        <Input placeholder="Enter your email..." className="mt-2" />

        {/* Separator */}
        <Text className="text-xl font-bold text-foreground mt-6">Separator</Text>
        <View className="gap-4">
          <Text className="text-sm text-muted-foreground">Content above separator</Text>
          <Separator />
          <Text className="text-sm text-muted-foreground">Content below separator</Text>
        </View>

        {/* Status message */}
        <View className="mt-6 p-4 bg-green-100 border-l-4 border-green-500 rounded">
          <Text className="text-green-900 font-semibold">✓ NativeWind is working!</Text>
          <Text className="text-green-700 text-sm mt-1">
            If you can see styled components, Tailwind CSS is successfully integrated.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
