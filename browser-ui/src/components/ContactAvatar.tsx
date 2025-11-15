/**
 * ContactAvatar - Avatar component with profile image support
 *
 * Displays contact avatar with:
 * - Profile image from BLOB storage (if available)
 * - AI bot icon for AI contacts
 * - Initials fallback for regular contacts
 * - LAMA logo fallback when no name/image
 */

import { Avatar, AvatarFallback, AvatarImage } from '@lama/ui'
import { Bot } from 'lucide-react'
import { useContactAvatar } from '@/hooks/useContactAvatar'
import type { SHA256IdHash, Person } from '@refinio/one.core/lib/recipes.js'

interface ContactAvatarProps {
  personId: SHA256IdHash<Person> | string
  name: string
  isAI?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ContactAvatar({ personId, name, isAI = false, className = '', size = 'md' }: ContactAvatarProps) {
  const { url: avatarUrl } = useContactAvatar(isAI ? null : personId)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'UN'
  }

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {avatarUrl && !isAI ? (
        <AvatarImage src={avatarUrl} alt={name} />
      ) : null}
      <AvatarFallback className={isAI ? 'bg-purple-100 dark:bg-purple-900' : 'bg-gradient-to-br from-blue-500 via-pink-500 to-blue-900 text-white'}>
        {isAI ? (
          <Bot className={`${iconSizes[size]} text-purple-600 dark:text-purple-400`} />
        ) : name ? (
          getInitials(name)
        ) : (
          <img
            src="/assets/icons/lama.svg"
            alt="LAMA"
            className={iconSizes[size]}
          />
        )}
      </AvatarFallback>
    </Avatar>
  )
}
