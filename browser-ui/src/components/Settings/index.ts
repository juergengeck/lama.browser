/**
 * Settings Components - Browser Platform
 *
 * Consolidates settings panel components.
 * Re-exports from @lama/ui where components are platform-agnostic.
 * Exports local implementations for browser-specific settings.
 */

// Platform-agnostic settings from @lama/ui
export { TopicPrioritySettings, AISettingsView } from '@lama/ui'
export { ModelOnboarding, OllamaCorsHelp } from '@lama/ui'

// Browser-specific settings panels (use local implementations)
export { LLMSettings } from './LLMSettings'
export { MCPSettings } from './MCPSettings'
export { ProposalSettings } from './ProposalSettings'
export { StorageQuota } from './StorageQuota'
export { DataCleanup } from './DataCleanup'
export { SubscriptionSettings } from './SubscriptionSettings'
export { KeywordSettingsPage } from './KeywordSettingsPage'
export { KeywordLineSettings } from './KeywordLineSettings'
