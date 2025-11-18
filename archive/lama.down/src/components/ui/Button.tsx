/**
 * Button component for React Native
 * Based on shadcn/ui Button with React Native compatibility
 */

import * as React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'border-2 border-input bg-background',
        secondary: 'bg-secondary',
        ghost: 'bg-transparent',
        link: 'bg-transparent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  'text-sm font-medium text-center',
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-destructive-foreground',
        outline: 'text-foreground',
        secondary: 'text-secondary-foreground',
        ghost: 'text-foreground',
        link: 'text-primary underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  title?: string;
  children?: React.ReactNode;
  textClassName?: string;
}

const Button = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(({ className, textClassName, variant, size, title, children, disabled, ...props }, ref) => {
  return (
    <Pressable
      ref={ref}
      className={cn(
        buttonVariants({ variant, size }),
        disabled && 'opacity-50',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {title && (
        <Text
          className={cn(
            buttonTextVariants({ variant }),
            textClassName
          )}
        >
          {title}
        </Text>
      )}
      {children}
    </Pressable>
  );
});

Button.displayName = 'Button';

export { Button, buttonVariants };
