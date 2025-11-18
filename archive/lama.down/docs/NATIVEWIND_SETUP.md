# NativeWind Setup

Complete guide to NativeWind (Tailwind CSS for React Native) integration in lama.app.

## What is NativeWind?

NativeWind v4 brings Tailwind CSS to React Native, enabling:
- ✅ Tailwind utility classes in React Native components
- ✅ Shared design system with lama.ui (web)
- ✅ Type-safe `className` prop
- ✅ Hot reload with Tailwind changes
- ✅ Compatible with React Native New Architecture

## Installation

Already installed in this project:

```bash
npm install nativewind tailwindcss@3 --legacy-peer-deps
npm install clsx tailwind-merge class-variance-authority
```

## Configuration Files

### 1. tailwind.config.js

```javascript
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    '../lama.ui/src/**/*.{js,jsx,ts,tsx}', // Include lama.ui
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // shadcn/ui color palette
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(222.2 84% 4.9%)',
        // ... (see tailwind.config.js for full palette)
      },
    },
  },
};
```

### 2. global.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3. babel.config.js

```javascript
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    // ... other plugins
    'nativewind/babel', // Must be last or near-last
  ],
};
```

### 4. app/_layout.tsx

```tsx
import '../global.css'; // Import at the top

export default function RootLayout() {
  // ...
}
```

### 5. nativewind-env.d.ts

```typescript
/// <reference types="nativewind/types" />
```

### 6. tsconfig.json

```json
{
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "nativewind-env.d.ts"  // Include types
  ]
}
```

## Usage

### Basic Styling

```tsx
import { View, Text, Pressable } from 'react-native';

function MyComponent() {
  return (
    <View className="flex-1 p-4 bg-background">
      <Text className="text-2xl font-bold text-foreground">
        Hello NativeWind!
      </Text>
      <Pressable className="mt-4 px-6 py-3 bg-primary rounded-lg">
        <Text className="text-primary-foreground font-medium">
          Press me
        </Text>
      </Pressable>
    </View>
  );
}
```

### Conditional Classes

```tsx
import { cn } from '@/lib/utils';

function ConditionalComponent({ isActive }) {
  return (
    <View
      className={cn(
        'p-4 rounded-lg',
        isActive ? 'bg-primary' : 'bg-secondary'
      )}
    >
      <Text className={cn(
        'font-medium',
        isActive ? 'text-primary-foreground' : 'text-secondary-foreground'
      )}>
        Status: {isActive ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}
```

### With Variants (cva)

```tsx
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        outline: 'border-2 border-primary bg-transparent',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

function Button({ variant, size, className, ...props }) {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

## Supported Features

### Layout & Flexbox ✅
```tsx
<View className="flex flex-row items-center justify-between gap-4" />
```

### Spacing ✅
```tsx
<View className="p-4 m-2 px-6 py-3 mt-8" />
```

### Typography ✅
```tsx
<Text className="text-xl font-bold text-center leading-tight" />
```

### Colors ✅
```tsx
<View className="bg-primary text-primary-foreground" />
<View className="bg-blue-500 text-white" />
```

### Borders & Radius ✅
```tsx
<View className="border-2 border-gray-300 rounded-lg" />
```

### Width & Height ✅
```tsx
<View className="w-full h-20 w-[200px]" />
```

### Shadows (Limited) ⚠️
```tsx
<View className="shadow-sm shadow-md shadow-lg" />
// Note: React Native shadows work differently than web
```

### Opacity ✅
```tsx
<View className="opacity-50 opacity-75 opacity-100" />
```

## Differences from Web Tailwind

### Not Supported ❌

1. **Pseudo-classes** - `hover:`, `focus:`, `active:` (use Pressable states)
2. **Media queries** - `sm:`, `md:`, `lg:` (use Dimensions API)
3. **Group modifiers** - `group-hover:` (not applicable)
4. **Some web-specific utilities** - `cursor-`, `select-`, etc.

### Alternatives

**Hover states:**
```tsx
<Pressable
  className={({ pressed }) => cn(
    'bg-primary',
    pressed && 'opacity-80'
  )}
/>
```

**Responsive design:**
```tsx
import { useWindowDimensions } from 'react-native';

function ResponsiveComponent() {
  const { width } = useWindowDimensions();
  const isLarge = width > 768;

  return (
    <View className={cn(
      'p-4',
      isLarge ? 'flex-row' : 'flex-col'
    )} />
  );
}
```

## Color System

The app uses the shadcn/ui semantic color system:

```tsx
// Backgrounds
bg-background       // Page background
bg-card             // Card background
bg-muted            // Muted background
bg-accent           // Accent background

// Foreground
text-foreground     // Main text
text-muted-foreground // Muted text
text-card-foreground  // Card text

// Primary brand
bg-primary text-primary-foreground

// Secondary
bg-secondary text-secondary-foreground

// Destructive (errors, delete)
bg-destructive text-destructive-foreground

// Borders
border-border
border-input
```

## Utilities

### cn() - Class Merger

```tsx
import { cn } from '@/lib/utils';

// Merge classes with precedence
const classes = cn(
  'base-class',
  condition && 'conditional-class',
  'override-class'
);

// Handles conflicts (last class wins)
cn('p-4', 'p-6')  // → 'p-6'
cn('text-sm', 'text-lg')  // → 'text-lg'
```

### cva() - Class Variance Authority

```tsx
import { cva } from 'class-variance-authority';

const styles = cva(
  'base-classes',
  {
    variants: {
      size: {
        sm: 'small-classes',
        lg: 'large-classes',
      },
      variant: {
        primary: 'primary-classes',
        secondary: 'secondary-classes',
      },
    },
    defaultVariants: {
      size: 'sm',
      variant: 'primary',
    },
  }
);

styles({ size: 'lg', variant: 'secondary' });
```

## Troubleshooting

### Classes not applying

1. **Clear Metro cache:**
   ```bash
   npm run start:clear
   ```

2. **Check content paths in tailwind.config.js:**
   ```javascript
   content: [
     './app/**/*.{js,jsx,ts,tsx}',
     './src/**/*.{js,jsx,ts,tsx}',
   ]
   ```

3. **Verify babel plugin order:**
   ```javascript
   plugins: [
     // ... other plugins
     'nativewind/babel', // Must be included
   ]
   ```

### TypeScript errors on className

Ensure `nativewind-env.d.ts` is included in `tsconfig.json`:

```json
{
  "include": [
    "nativewind-env.d.ts"
  ]
}
```

### Colors not working

Check that colors are defined in `tailwind.config.js` theme. Use HSL format for React Native compatibility:

```javascript
colors: {
  primary: 'hsl(222.2 47.4% 11.2%)',
  // Not RGB: 'rgb(31, 41, 55)'
}
```

## Testing

Test NativeWind integration:

```bash
npm start
# Navigate to /test-nativewind
```

The test screen shows all components styled with Tailwind CSS.

## Performance

NativeWind v4 optimizations:
- ✅ No runtime style generation
- ✅ Styles compiled at build time
- ✅ Tree-shaking for unused classes
- ✅ Minimal bundle size impact

## Resources

- [NativeWind Documentation](https://www.nativewind.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Design System](https://ui.shadcn.com/)
- [Class Variance Authority](https://cva.style/)

## Next Steps

1. ✅ NativeWind installed and configured
2. ✅ UI primitives created (Button, Card, Badge, etc.)
3. ⏳ Migrate chat components from lama.ui
4. ⏳ Migrate journal components
5. ⏳ Create platform-specific optimizations
