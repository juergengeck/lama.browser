# UI Components

React Native compatible UI components based on shadcn/ui, styled with Tailwind CSS via NativeWind.

## Overview

This library provides platform-agnostic UI primitives that work in React Native using NativeWind (Tailwind CSS for React Native). All components are compatible with the lama.ui design system used in lama.browser and lama.cube.

## Available Components

### Button

Versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui';

// Basic usage
<Button title="Click me" onPress={() => {}} />

// With variants
<Button title="Primary" variant="default" />
<Button title="Secondary" variant="secondary" />
<Button title="Outline" variant="outline" />
<Button title="Ghost" variant="ghost" />
<Button title="Destructive" variant="destructive" />

// With sizes
<Button title="Small" size="sm" />
<Button title="Default" size="default" />
<Button title="Large" size="lg" />

// With custom content (instead of title)
<Button onPress={() => {}}>
  <Text className="text-primary-foreground">Custom Content</Text>
</Button>
```

**Props:**
- `title?: string` - Button text
- `variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'`
- `size?: 'default' | 'sm' | 'lg' | 'icon'`
- `children?: React.ReactNode` - Custom content (overrides title)
- `className?: string` - Additional Tailwind classes
- `textClassName?: string` - Classes for the text element
- All standard `PressableProps`

### Card

Container component with optional header, content, and footer sections.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    <Text>Card content goes here</Text>
  </CardContent>
  <CardFooter>
    <Button title="Action" />
  </CardFooter>
</Card>
```

**Components:**
- `Card` - Main container with border and shadow
- `CardHeader` - Header section with padding
- `CardTitle` - Large semibold title text
- `CardDescription` - Muted description text
- `CardContent` - Main content area
- `CardFooter` - Footer with flex row layout

### Badge

Small label component for tags, status indicators, etc.

```tsx
import { Badge } from '@/components/ui';

<Badge label="New" variant="default" />
<Badge label="Beta" variant="secondary" />
<Badge label="Error" variant="destructive" />
<Badge label="Info" variant="outline" />

// With custom content
<Badge variant="default">
  <Text className="text-xs text-primary-foreground">Custom</Text>
</Badge>
```

**Props:**
- `label?: string` - Badge text
- `variant?: 'default' | 'secondary' | 'destructive' | 'outline'`
- `children?: React.ReactNode` - Custom content
- `className?: string` - Additional Tailwind classes
- `textClassName?: string` - Classes for the text element

### Avatar

Profile picture component with image and fallback support.

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui';

// With image
<Avatar size={50}>
  <AvatarImage source={{ uri: 'https://...' }} />
  <AvatarFallback label="JD" />
</Avatar>

// Fallback only
<Avatar size={40}>
  <AvatarFallback label="AB" />
</Avatar>
```

**Components:**
- `Avatar` - Container with circular shape
  - `size?: number` - Avatar diameter (default: 40)
- `AvatarImage` - Image element
  - All standard `ImageProps`
- `AvatarFallback` - Fallback content when image fails
  - `label?: string` - Initials or text
  - `children?: React.ReactNode` - Custom fallback

### Input

Text input field styled to match the design system.

```tsx
import { Input } from '@/components/ui';

<Input
  placeholder="Enter your name..."
  value={value}
  onChangeText={setValue}
/>

<Input
  placeholder="Email"
  keyboardType="email-address"
  autoCapitalize="none"
/>
```

**Props:**
- `className?: string` - Additional Tailwind classes
- All standard `TextInputProps`

### Separator

Horizontal or vertical divider line.

```tsx
import { Separator } from '@/components/ui';

// Horizontal (default)
<Separator />

// Vertical
<Separator orientation="vertical" />

// Custom styling
<Separator className="my-4" />
```

**Props:**
- `orientation?: 'horizontal' | 'vertical'` - Separator direction
- `className?: string` - Additional Tailwind classes

## Styling

All components use Tailwind CSS classes via NativeWind. You can customize components using:

1. **className prop** - Add or override Tailwind classes
2. **Tailwind config** - Modify theme colors in `tailwind.config.js`
3. **Component variants** - Use built-in variants (button, badge)

### Color Palette

The components use semantic color tokens from the shadcn/ui palette:

- `background` / `foreground` - Base colors
- `primary` / `primary-foreground` - Primary brand color
- `secondary` / `secondary-foreground` - Secondary actions
- `muted` / `muted-foreground` - Subtle backgrounds
- `accent` / `accent-foreground` - Highlighted elements
- `destructive` / `destructive-foreground` - Errors, delete actions
- `border` - Border colors
- `input` - Input borders
- `card` / `card-foreground` - Card backgrounds

### Example Customization

```tsx
// Custom button with additional classes
<Button
  title="Custom"
  variant="default"
  className="rounded-full px-8"
  textClassName="text-lg"
/>

// Custom card styling
<Card className="border-2 border-primary shadow-lg">
  <CardHeader className="bg-primary/10">
    <CardTitle className="text-primary">Highlighted Card</CardTitle>
  </CardHeader>
</Card>
```

## Utilities

### cn() - Class Name Utility

Merge Tailwind classes with proper precedence:

```tsx
import { cn } from '@/lib/utils';

const className = cn(
  'base-class',
  condition && 'conditional-class',
  'override-class'
);
```

This utility uses `clsx` and `tailwind-merge` to intelligently merge class names, handling conflicts and conditional classes.

## Testing

View all components in action:

```bash
npm start
# Navigate to /test-nativewind
```

The test screen showcases all UI components with various configurations.

## Migration from lama.ui

When migrating components from lama.ui (web) to lama.app (React Native):

1. **Replace HTML elements**:
   - `<div>` → `<View>`
   - `<p>`, `<h1>`, `<span>` → `<Text>`
   - `<button>` → `<Pressable>`
   - `<input>` → `<TextInput>`

2. **Remove Radix UI dependencies**:
   - Replace with React Native equivalents
   - Use built-in state management

3. **Keep Tailwind classes**:
   - NativeWind handles most Tailwind utilities
   - Some web-specific classes may need adjustment

4. **Update imports**:
   ```tsx
   // Web (lama.ui)
   import { Button } from '@lama/ui'

   // React Native (lama.app)
   import { Button } from '@/components/ui'
   ```

## Future Components

Planned additions from lama.ui:

- [ ] Dialog / Modal
- [ ] Dropdown Menu
- [ ] Tabs
- [ ] Progress
- [ ] Checkbox
- [ ] Alert / AlertDialog
- [ ] Scroll Area
- [ ] Chat components (MessageBubble, ChatHeader)
- [ ] Journal components
- [ ] Device components

## Related Documentation

- [NativeWind Setup](./NATIVEWIND_SETUP.md)
- [Tailwind Configuration](../tailwind.config.js)
- [lama.ui Documentation](../../lama.ui/README.md)
