/**
 * LAMA Browser App with Platform-Agnostic Routing
 * Uses lama.ui routing abstraction with BrowserHistoryAdapter
 */

import { useState, useEffect } from 'react'
import { Button } from '@lama/ui'
import { ChatLayout } from '@/components/ChatLayout'
import { JournalView } from '@/components/JournalView'
import { ContactsView } from '@/components/ContactsView'
import { SettingsView } from '@/components/SettingsView'
import { DataDashboard } from '@/components/DataDashboard'
import { DevicesView } from '@/components/DevicesView'
import { PurchaseView } from '@/components/PurchaseView'
import { VerificationView } from '@/components/VerificationView'
import { ProfileView } from '@/components/ProfileView'
import { LoginDeploy, ModelOnboarding, PlansProvider } from '@lama/ui'
import type { LAMAPlans } from '@lama/ui'
import { InvitationAcceptance } from '@/components/InvitationAcceptance'
import { MODEL_OPTIONS } from '@/constants/model-options'
import { MessageSquare, BookOpen, Users, Settings, Loader2, Smartphone, BarChart3, CreditCard, User } from 'lucide-react'
import { MobileTabBar } from '@/components/MobileTabBar'
import { sessionStorage } from '@/services/session-storage'
import { isValidInvitationUrl } from '@/utils/invitation-url-parser'
import type Model from '@/model/Model.js'
import { ModelProvider } from '@/model/ModelContext'
import { FaviconBadgeManager } from '@/components/FaviconBadgeManager'

// Routing imports (re-exported from lama.core/ui/routing via lama.ui)
import {
  RouterProvider,
  BrowserHistoryAdapter,
  LAMA_ROUTES,
  useLocation,
  useNavigate,
  useParams,
  useQuery,
  useNavigationActions
} from '@lama/ui'

/**
 * Convert Model instance to LAMAPlans interface
 */
function modelToPlans(model: Model): LAMAPlans {
  return {
    ai: model.aiPlan,
    aiAssistant: model.aiAssistantPlan,
    topicAnalysis: model.topicAnalysisPlan,
    proposals: model.proposalsPlan,
    keywordDetail: model.keywordDetailPlan,
    wordCloudSettings: model.wordCloudSettingsPlan,
    llmConfig: model.llmConfigPlan,
    crypto: model.cryptoPlan,
    audit: model.auditPlan,
    journal: model.journalPlan,
    subjects: model.subjectsPlan,
    chat: model.chatPlan,
    contacts: model.contactsPlan,
    export: model.exportPlan,
    feedForward: model.feedForwardPlan,
    connection: model.connectionPlan,
  }
}

interface AppContentProps {
  model: Model
}

/**
 * Main app content that uses routing hooks
 * Must be inside RouterProvider
 */
function AppContent({ model }: AppContentProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const query = useQuery()
  const { goBack } = useNavigationActions()

  const [hasTopics, setHasTopics] = useState<boolean | null>(null)
  const [hasDefaultModel, setHasDefaultModel] = useState<boolean | null>(null)
  const [pendingInvitation, setPendingInvitation] = useState<string | null>(
    sessionStorage.getPendingInvitation()
  )
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [modelInitialized, setModelInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden)

  // Proposal sensitivity slider state (default 0.9 = 90%)
  const [proposalSensitivity, setProposalSensitivity] = useState<number>(0.9)

  // Derive active tab from current route
  const activeTab = location.pathname.startsWith('/chat/')
    ? 'chats'
    : location.pathname.substring(1) || 'chats'

  // Derive selected conversation from route params
  const selectedConversationId = params.conversationId

  // Check for invitation in URL on mount
  useEffect(() => {
    const currentUrl = window.location.href
    console.log('[App] Checking for invitation URL:', currentUrl)

    if (isValidInvitationUrl(currentUrl)) {
      console.log('[App] ✅ Valid invitation detected')
      setPendingInvitation(currentUrl)
      sessionStorage.setPendingInvitation(currentUrl)

      // Clear URL hash to prevent re-processing
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Check authentication state
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const isRegistered = await model.one.isRegistered()
        console.log('[App] Auth check - isRegistered:', isRegistered)

        if (isRegistered) {
          setIsAuthenticated(true)
        }
      } catch (e) {
        console.error('[App] Auth check failed:', e)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthState()
  }, [model])

  // Setup auth event listeners
  useEffect(() => {
    const handleLogin = () => {
      console.log('[App] Login event received')
      setIsAuthenticated(true)
    }

    const handleLogout = () => {
      console.log('[App] Logout event received')
      setIsAuthenticated(false)
      setModelInitialized(false)
      setPendingInvitation(null)
      sessionStorage.setPendingInvitation(null)
      navigate('/login', { replace: true })
    }

    model.one.onLogin(handleLogin)
    model.one.onLogout(handleLogout)
  }, [model, navigate])

  // Setup models ready listener
  useEffect(() => {
    const handleModelsReady = () => {
      console.log('[App] Models ready')
      setModelInitialized(true)
      setIsLoading(false)

      if (pendingInvitation) {
        console.log('[App] Processing pending invitation')
      }
    }

    const disconnect = model.onOneModelsReady(handleModelsReady)
    return disconnect
  }, [model, pendingInvitation])

  // Check for topics (onboarding detection)
  useEffect(() => {
    if (isAuthenticated && modelInitialized) {
      model.chatPlan.getConversations({ limit: 1 })
        .then((response) => {
          setHasTopics(response.success && response.data && response.data.length > 0)
        })
        .catch(() => setHasTopics(false))
    }
  }, [isAuthenticated, modelInitialized, model])

  // Check for default model
  useEffect(() => {
    if (isAuthenticated && modelInitialized) {
      model.llmConfigPlan.getConfig({})
        .then(response => {
          setHasDefaultModel(response.success && response.config !== null)
        })
        .catch(() => setHasDefaultModel(false))
    }
  }, [isAuthenticated, modelInitialized, model])

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Update proposal config when sensitivity changes
  useEffect(() => {
    if (!isAuthenticated || !modelInitialized) return

    const updateConfig = async () => {
      try {
        // Direct threshold: slider % = minimum similarity threshold
        // 90% = only show proposals with ≥90% Jaccard similarity
        const minJaccard = proposalSensitivity
        await model.proposalsPlan.updateConfig({ config: { minJaccard } })
      } catch (error) {
        console.error('[App] Failed to update proposal config:', error)
      }
    }

    updateConfig()
  }, [proposalSensitivity, isAuthenticated, modelInitialized, model])

  // Login function
  const login = async (instanceName: string, password: string) => {
    setIsLoading(true)
    try {
      await model.one.loginOrRegister(
        `${instanceName}@lama.local`,
        password,
        instanceName
      )
    } catch (error) {
      console.error('[App] Login failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Logout function
  const logout = async () => {
    setIsLoading(true)
    try {
      await model.one.logout()
    } catch (error) {
      console.error('[App] Logout failed:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Check for verification route
  if (params.shortCode) {
    return <VerificationView shortCode={params.shortCode} />
  }

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Initializing LAMA</h2>
          <p className="text-muted-foreground">Setting up ONE.core...</p>
        </div>
      </div>
    )
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <LoginDeploy
        onLogin={login}
        logo={
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            LAMA
          </h1>
        }
        testOllamaConnection={async (baseUrl: string) => {
          try {
            const result = await model.llmConfigPlan.testConnection({ server: baseUrl })
            return { success: result.success }
          } catch (error) {
            return { success: false }
          }
        }}
      />
    )
  }

  // Model onboarding (only show after Model.init() completes and recipes are registered)
  const shouldShowOnboarding = isAuthenticated && modelInitialized && hasDefaultModel === false && !pendingInvitation
  if (shouldShowOnboarding) {
    return (
      <ModelOnboarding
        llmConfig={model.llmConfigPlan}
        aiPlan={model.aiPlan}
        modelOptions={MODEL_OPTIONS}
        allowSkip={true}
        onComplete={() => setHasDefaultModel(true)}
      />
    )
  }

  // Still checking for default model
  if (hasDefaultModel === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loading LAMA</h2>
          <p className="text-muted-foreground">Checking configuration...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'chats', label: 'Chats', icon: MessageSquare, path: '/chats' },
    { id: 'journal', label: 'Journal', icon: BookOpen, path: '/journal' },
    { id: 'contacts', label: 'Contacts', icon: Users, path: '/contacts' },
    { id: 'devices', label: 'Devices', icon: Smartphone, path: '/devices' },
    { id: 'purchase', label: 'Subscribe', icon: CreditCard, path: '/purchase' },
    { id: 'settings', label: null, icon: Settings, path: '/settings' },
  ]

  const handleNavigate = (tab: string, conversationId?: string, section?: string) => {
    if (conversationId) {
      navigate(`/chat/${conversationId}`)
    } else if (section) {
      navigate(`/settings/${section}`)
    } else {
      const tabDef = tabs.find(t => t.id === tab)
      if (tabDef) {
        navigate(tabDef.path)
      }
    }
  }

  const renderContent = () => {
    // Route-based rendering
    if (location.pathname.startsWith('/chat/')) {
      return <ChatLayout selectedConversationId={selectedConversationId} />
    }

    switch (location.pathname) {
      case '/chats':
        return <ChatLayout selectedConversationId={selectedConversationId} />
      case '/journal':
        return <JournalView />
      case '/contacts':
        return <ContactsView onNavigateToChat={(topicId, contactName) => {
          navigate(`/chat/${topicId}`)
        }} />
      case '/profile':
        return <ProfileView onClose={() => navigate('/chats')} />
      case '/devices':
        return <DevicesView />
      case '/purchase':
        return <PurchaseView onPurchaseComplete={() => navigate('/chats')} />
      case '/settings':
        return <SettingsView onLogout={logout} onNavigate={handleNavigate} />
      default:
        if (location.pathname.startsWith('/settings/')) {
          return <SettingsView onLogout={logout} onNavigate={handleNavigate} />
        }
        if (location.pathname.startsWith('/contact/')) {
          // View another user's profile
          return <ProfileView personId={params.personId} onClose={() => navigate('/contacts')} />
        }
        return <ChatLayout />
    }
  }

  return (
    <ModelProvider model={model}>
      <PlansProvider plans={modelToPlans(model)}>
        <FaviconBadgeManager
          isTabVisible={isTabVisible}
          selectedConversationId={selectedConversationId}
          isAuthenticated={isAuthenticated}
          modelInitialized={modelInitialized}
        />

        {/* Invitation acceptance */}
        {isAuthenticated && model.initialized && pendingInvitation ? (
          <InvitationAcceptance
            invitationUrl={pendingInvitation}
            onComplete={(success) => {
              console.log('[App] Invitation complete:', success)
              setPendingInvitation(null)
              sessionStorage.setPendingInvitation(null)
              navigate('/chats', { replace: true })
            }}
          />
        ) : (
          <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Desktop navigation */}
            <div className="hidden md:block border-b bg-card">
              <div className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    LAMA
                  </h1>
                  <div className="h-6 w-px bg-border" />
                </div>

                <div className="flex items-center justify-between flex-1">
                  <div className="flex items-center space-x-2">
                    {tabs.filter(tab => tab.id !== 'settings').map((tab) => {
                      const Icon = tab.icon
                      return (
                        <Button
                          key={tab.id}
                          variant={activeTab === tab.id ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate(tab.path)}
                          className="flex items-center space-x-2"
                        >
                          <Icon className="h-4 w-4" />
                          {tab.label && <span>{tab.label}</span>}
                        </Button>
                      )
                    })}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant={location.pathname === '/profile' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => navigate('/profile')}
                      className="flex items-center space-x-2"
                      title="Profile"
                    >
                      <User className="h-4 w-4" />
                    </Button>
                    {tabs.filter(tab => tab.id === 'settings').map((tab) => {
                      const Icon = tab.icon
                      return (
                        <Button
                          key={tab.id}
                          variant={activeTab === tab.id ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => navigate(tab.path)}
                          className="flex items-center space-x-2"
                        >
                          <Icon className="h-4 w-4" />
                          {tab.label && <span>{tab.label}</span>}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile header */}
            <div className="md:hidden border-b bg-card px-3 py-1.5 flex items-center h-12">
              <h1 className="text-base font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                LAMA
              </h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden" style={{ paddingBottom: window.innerWidth < 768 ? 'calc(env(safe-area-inset-bottom) + 64px)' : '0' }}>
              {renderContent()}
            </div>

            {/* Mobile tab bar */}
            <MobileTabBar
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(tab) => {
                const tabDef = tabs.find(t => t.id === tab)
                if (tabDef) navigate(tabDef.path)
              }}
            />

            {/* Status bar */}
            <div className="hidden md:block border-t bg-card px-6 py-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <span>LAMA Browser v1.0.0</span>
                  <span>·</span>
                  <span>Storage: IndexedDB (ONE.core)</span>
                  <span>·</span>
                  <span>Platform: Browser Direct</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span>Identity: {isAuthenticated ? 'Active' : 'None'}</span>
                  {isAuthenticated && (
                    <>
                      <span>·</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">Proposals:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={proposalSensitivity}
                          onChange={(e) => setProposalSensitivity(parseFloat(e.target.value))}
                          className="w-24 h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                          title="Minimum similarity threshold: 90% = only show ≥90% matches"
                        />
                        <span className="font-mono min-w-[3ch]">{(proposalSensitivity * 100).toFixed(0)}%</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </PlansProvider>
    </ModelProvider>
  )
}

interface AppProps {
  model: Model
}

/**
 * App root with RouterProvider
 */
export default function App({ model }: AppProps) {
  // Create router adapter (only once)
  const [adapter] = useState(() => new BrowserHistoryAdapter(LAMA_ROUTES))

  return (
    <RouterProvider adapter={adapter}>
      <AppContent model={model} />
    </RouterProvider>
  )
}
