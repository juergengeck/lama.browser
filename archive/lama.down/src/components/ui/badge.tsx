/**
 * Badge component for React Native
 * Based on shadcn/ui Badge with React Native compatibility
 */

import * as React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex flex-row items-center rounded-full border px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary',
        secondary: 'border-transparent bg-secondary',
        destructive: 'border-transparent bg-destructive',
        outline: 'border-foreground bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const badgeTextVariants = cva(
  'text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        secondary: 'text-secondary-foreground',
        destructive: 'text-destructive-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends ViewProps,
    VariantProps<typeof badgeVariants> {
  label?: string;
  children?: React.ReactNode;
  textClassName?: string;
}

function Badge({ className, textClassName, variant, label, children, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      {label && (
        <Text className={cn(badgeTextVariants({ variant }), textClassName)}>
          {label}
        </Text>
      )}
      {children}
    </View>
  );
}

export { Badge, badgeVariants };
