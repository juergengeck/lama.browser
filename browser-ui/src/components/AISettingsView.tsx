/**
 * AISettingsView - Browser Platform Wrapper
 *
 * Re-exports lama.ui's AISettingsView.
 * All UI logic lives in @lama/ui - this is just the platform re-export.
 */

import { AISettingsView as BaseAISettingsView, type AISettingsViewProps } from '@lama/ui'

// Re-export with same name for drop-in compatibility
export const AISettingsView = BaseAISettingsView

export type { AISettingsViewProps }
