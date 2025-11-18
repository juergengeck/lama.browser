/**
 * Input component for React Native
 * Based on shadcn/ui Input with React Native compatibility
 */

import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

export interface InputProps extends TextInputProps {}

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, placeholderTextColor, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          className
        )}
        placeholderTextColor={placeholderTextColor || '#9ca3af'}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
