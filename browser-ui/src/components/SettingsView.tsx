/**
 * SettingsView - Wrapper for lama.ui SettingsPage
 *
 * All settings UI is now consolidated in lama.ui.
 * This component provides platform-specific props including
 * identity recovery bundle generation.
 */
import { useCallback } from 'react'
import { SettingsPage, type RecoveryBundle } from '@refinio/lama.ui'
import { getDefaultSecretKeysAsBase64 } from '@refinio/one.core/lib/keychain/keychain.js'
import { getInstanceOwnerIdHash } from '@refinio/one.core/lib/instance.js'
import { useModel } from '@/model/index.js'

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

const WEB_URL = import.meta.env.VITE_WEB_URL || 'https://lama.one'
const APP_NAME = document.title || 'LAMA'

const appBranding = {
  appName: APP_NAME,
  logoUrl: '/assets/icons/lama_f_b.svg',
  webUrl: WEB_URL,
}

export function SettingsView({ onLogout, onNavigate, appMenuItems, trafficLightSpace }: SettingsViewProps) {
  const model = useModel()

  const handleGetRecoveryBundle = useCallback(async (): Promise<RecoveryBundle> => {
    const ownerId = getInstanceOwnerIdHash()
    if (!ownerId) throw new Error('No identity found. Please log in first.')

    const keys = await getDefaultSecretKeysAsBase64(ownerId)

    // Get display name from LeuteModel profile
    let displayName = 'Unknown'
    try {
      const profile = await model.leuteModel.getMyMainProfile()
      if (profile) {
        const personNames = profile.descriptionsOfType('PersonName')
        if (personNames.length > 0) {
          displayName = (personNames[0] as any).name || 'Unknown'
        }
      }
    } catch {
      // Fall back to 'Unknown' if profile unavailable
    }

    // Get instance name from Model
    const instanceName = model.instanceName || 'Unknown'

    return {
      displayName,
      ownerId: ownerId as string,
      instanceName,
      secretEncryptionKey: keys.secretEncryptionKey,
      secretSigningKey: keys.secretSignKey,
    }
  }, [model])

  return (
    <SettingsPage
      onLogout={onLogout}
      onNavigate={onNavigate}
      trafficLightSpace={trafficLightSpace}
      menuItems={appMenuItems}
      onGetRecoveryBundle={handleGetRecoveryBundle}
      appBranding={appBranding}
    />
  )
}

export default SettingsView
