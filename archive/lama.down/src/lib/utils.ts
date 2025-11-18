/**
 * Utility functions for component styling
 * Compatible with both web (lama.ui) and React Native
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence
 * Used throughout UI components for className composition
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
