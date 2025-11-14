/**
 * MobileTabBar - Bottom navigation for mobile devices
 * Shows only on screens < 768px width
 */
import { MessageSquare, BookOpen, Users, Settings, Smartphone, CreditCard } from 'lucide-react'
import { Button } from '@lama/ui'

interface Tab {
  id: string
  label: string | null
  icon: React.ComponentType<{ className?: string }>
}

interface MobileTabBarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function MobileTabBar({ tabs, activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 h-14 min-w-[64px] flex-1 max-w-[100px] ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
              {tab.label && (
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : ''}`}>
                  {tab.label}
                </span>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
