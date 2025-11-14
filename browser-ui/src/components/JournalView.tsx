/**
 * JournalView - Browser Platform Wrapper
 *
 * This is a thin wrapper that connects the shared JournalView from lama.ui
 * to the browser platform's navigation system and provides the journal plan.
 */

import { JournalView as SharedJournalView } from '@lama/ui'
import { useNavigate, usePlans } from '@lama/ui'

export function JournalView() {
  const navigate = useNavigate()
  const { journal } = usePlans()

  return (
    <SharedJournalView
      journal={journal}
      onSelectEntry={(entry) => {
        // Navigate based on entry type
        if (entry.type === 'conversation' && entry.id) {
          navigate(`/chat/${entry.id}`)
        }
      }}
      onViewChainOfTrust={(entry) => {
        console.log('[JournalView] View Chain of Trust for:', entry)
        // TODO: Implement Chain of Trust view navigation
      }}
      onViewAssembly={(entry) => {
        console.log('[JournalView] View Assembly for:', entry)
        // TODO: Implement Assembly view navigation
      }}
    />
  )
}