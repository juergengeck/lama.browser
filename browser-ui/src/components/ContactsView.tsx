/**
 * ContactsView - Browser Platform Wrapper
 *
 * Re-exports lama.ui's ContactsView with browser-specific model binding.
 * All UI logic lives in @refinio/lama.ui - this is just the platform adapter.
 */

import { ContactsView as BaseContactsView, type ContactsViewProps as BaseContactsViewProps } from '@refinio/lama.ui'
import { useModel } from '@/model/ModelContext'

interface ContactsViewProps extends Omit<BaseContactsViewProps, 'isInitialized' | 'platformModel'> {}

export function ContactsView(props: ContactsViewProps) {
  const model = useModel()

  return (
    <BaseContactsView
      {...props}
      isInitialized={model.initialized}
      platformModel={model}
      showWebRTCInvite={true}
      showCommServerInvite={true}
    />
  )
}

export type { ContactsViewProps }
