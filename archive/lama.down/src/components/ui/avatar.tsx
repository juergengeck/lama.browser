/**
 * Avatar component for React Native
 * Based on shadcn/ui Avatar with React Native compatibility
 */

import * as React from 'react';
import { View, Image, Text, type ViewProps, type ImageProps } from 'react-native';
import { cn } from '@/lib/utils';

interface AvatarProps extends ViewProps {
  size?: number;
}

const Avatar = React.forwardRef<React.ElementRef<typeof View>, AvatarProps>(
  ({ className, size = 40, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full bg-muted',
        className
      )}
      style={{ width: size, height: size }}
      {...props}
    />
  )
);
Avatar.displayName = 'Avatar';

interface AvatarImageProps extends ImageProps {
  alt?: string;
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof Image>,
  AvatarImageProps
>(({ className, ...props }, ref) => (
  <Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = 'AvatarImage';

interface AvatarFallbackProps extends ViewProps {
  label?: string;
  textClassName?: string;
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof View>,
  AvatarFallbackProps
>(({ className, textClassName, label, children, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      className
    )}
    {...props}
  >
    {label && (
      <Text className={cn('text-sm font-medium text-muted-foreground', textClassName)}>
        {label}
      </Text>
    )}
    {children}
  </View>
));
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };
