/**
 * SettingsView - Wrapper for lama.ui SettingsPage
 *
 * All settings UI is now consolidated in lama.ui.
 * This component provides platform-specific props.
 */
import { SettingsPage } from '@refinio/lama.ui'

interface SettingsViewProps {
  onLogout?: () => void
  onNavigate?: (tab: string, topicId?: string, section?: string) => void
  /** App menu items for navigation */
  appMenuItems?: Array<{
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }>
  /** Add space for macOS traffic lights */
  trafficLightSpace?: boolean
}

export function SettingsView({ onLogout, onNavigate, appMenuItems, trafficLightSpace }: SettingsViewProps) {
  return <SettingsPage onLogout={onLogout} onNavigate={onNavigate} trafficLightSpace={trafficLightSpace} menuItems={appMenuItems} />
}

export default SettingsView
