/**
 * LAMA Browser App with Platform-Agnostic Routing
 * Uses lama.ui routing abstraction with BrowserHistoryAdapter
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { ContactsView, LoginDeploy, ModelOnboarding, PlansProvider, BridgeProvider, ProfileEditor, ChatLayout, AssemblyJournalView, MemoryView, DevicesView, MobileBottomNav, MOBILE_NAV_HEIGHT, StatusBar, NavigateHomeProvider } from '@lama/ui'
import { SettingsProvider, OneCoreSettingsStorage } from '@settings/core'
import type { AssemblyQueryOptions, AssemblyWithStory } from '@assembly/core'
import type { DevicePlatformAdapter } from '@lama/ui'
import type { NavTab } from '@lama/ui'
import { SettingsView } from '@/components/SettingsView'
import { PurchaseView } from '@/components/PurchaseView'
import { VerificationView } from '@/components/VerificationView'
import { ConnectionsView } from '@/components/ConnectionsView'
import type { LAMAPlansContext } from '@lama/ui'
import { InvitationAcceptance } from '@/components/InvitationAcceptance'
import { MODEL_OPTIONS } from '@/constants/model-options'
import { MessageSquare, BookOpen, Users, Settings, Loader2, Smartphone, Brain } from 'lucide-react'
import { sessionStorage } from '@/services/session-storage'
import { isValidInvitationUrl } from '@/utils/invitation-url-parser'
import type Model from '@/model/Model.js'
import { ModelProvider } from '@/model/ModelContext'
import { FaviconBadgeManager } from '@/components/FaviconBadgeManager'
import { lamaBridge } from '@/bridge/lama-bridge'
import { browserOllamaValidator } from '../../adapters/browser-llm-config'

// TTS Worker - use Vite's ?worker&url syntax for proper bundling
// This bundles the worker and all its dependencies (including @huggingface/transformers)
import ttsWorkerUrl from './workers/tts.worker.ts?worker&url'

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
 * Stub LocalModelsPlan for browser
 * Browser Whisper requires transformers.js in WebWorker - not yet implemented
 */
const browserLocalModelsPlan = {
  async whisperIsReady() {
    // Browser Whisper not yet implemented (requires WebWorker + transformers.js)
    return { success: true, data: false }
  },

  async whisperTranscribe(_params: { audio: number[]; language?: string }) {
    return {
      success: false,
      error: 'Browser Whisper transcription not yet implemented. Use Electron for voice input.'
    }
  },

  async getStatus(_modelId: string) {
    return { status: 'unloaded' as const }
  },

  async loadModel(_modelId: string) {
    return { success: false, error: 'Browser local models not yet implemented' }
  },

  async unloadModel(_modelId: string) {
    return { success: false, error: 'Browser local models not yet implemented' }
  }
}

/**
 * Convert Model instance to LAMAPlansContext interface
 */
function modelToPlans(model: Model): LAMAPlansContext {
  return {
    ownerId: model.ownerId,
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
    chat: model.chatPlan,
    contacts: model.contactsPlan,
    export: model.exportPlan,
    feedForward: model.feedForwardPlan,
    connection: model.connectionPlan,
    memory: model.memoryPlan,
    cube: model.cubePlan,
    localModels: browserLocalModelsPlan,
  }
}

import { browserSyncMonitor, initSyncMonitor } from '@/services/browser-sync-monitor'

/**
 * Create browser-specific DevicePlatformAdapter
 * Browser doesn't support UDP discovery (Node.js only)
 */
function createBrowserDeviceAdapter(model: Model): DevicePlatformAdapter {
  return {
    async getInstanceInfo() {
      return {
        success: true,
        instance: {
          id: 'browser-instance',
          name: 'Browser Instance',
          initialized: model.initialized,
          hasPairing: false,
          capabilities: {
            network: false,
            storage: true,
            llm: true
          },
          // Include sync stats for traffic light visualization
          syncStats: browserSyncMonitor.getStats()
        }
      }
    },
    async getContacts() {
      try {
        const result = await model.contactsPlan.getContacts()
        return {
          success: result.success,
          contacts: result.contacts || []
        }
      } catch (error) {
        return { success: false, contacts: [] }
      }
    },
    async getTrustLevels() {
      try {
        const result = await model.trustPlan.getTrustLevels()
        return {
          success: result.success,
          trustLevels: result.trustLevels || {}
        }
      } catch (error) {
        return { success: false, trustLevels: {} }
      }
    },
    async setTrustLevel(instanceId: string, trustLevel: string) {
      try {
        const result = await model.trustPlan.setTrustLevel({ instanceId, trustLevel })
        return { success: result.success, error: result.error }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },
    async createInvitation(mode?: 'IoM' | 'IoP') {
      try {
        // ConnectionPlan uses createPairingInvitation() with mode
        const result = await model.connectionPlan.createPairingInvitation({ mode: mode || 'IoP' })
        return {
          success: result.success,
          invitation: result.invitation,
          error: result.error
        }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },
    async acceptInvitation(invitationUrl: string) {
      try {
        // ConnectionPlan uses acceptPairingInvitation()
        const result = await model.connectionPlan.acceptPairingInvitation({ invitationUrl })
        return {
          success: result.success,
          message: result.message,
          error: result.error
        }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    },
    // Browser doesn't support UDP discovery
    async getDiscoveredDevices() {
      return { success: true, devices: [] }
    },
    async scanForDevices(_timeout: number) {
      return { success: true, devices: [] }
    }
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
  // Initialize auth state from model (main.tsx may have already logged in)
  const [isAuthenticated, setIsAuthenticated] = useState(() => model.initialized)
  const [modelInitialized, setModelInitialized] = useState(() => model.initialized)
  const [isLoading, setIsLoading] = useState(() => !model.initialized)
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden)

  // Proposal sensitivity slider state (default 0.1 = 10% minimum match)
  const [proposalSensitivity, setProposalSensitivity] = useState<number>(0.1)

  // Response length slider state (default 0.2 = 20%)
  const [responseLengthPercent, setResponseLengthPercent] = useState<number>(0.2)

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  // Toolbar controls from active view
  const [toolbarControls, setToolbarControls] = useState<React.ReactNode>(null)

  // Background model download state (preemptively download Granite)
  // Use refs for values that polling closures need to read (avoids stale closure problem)
  const bgDownloadProgressRef = useRef<number>(0)
  const bgDownloadCompleteRef = useRef(false)
  const bgDownloadStarted = useRef(false)

  // Settings storage - created once model is initialized
  // Uses OneCoreSettingsStorage directly with browser ONE.core functions
  const settingsStorage = useMemo(() => {
    if (!modelInitialized || !model.initialized) return null

    const userEmail = model.one.currentlyLoggedInEmail || 'anonymous@lama.one'
    return new OneCoreSettingsStorage({ userEmail })
  }, [model, modelInitialized])

  // Derive active tab from current route
  const activeTab = location.pathname.startsWith('/chat/')
    ? 'chats'
    : location.pathname.substring(1) || 'chats'

  // Derive selected conversation from route params
  const selectedConversationId = params.conversationId

  // Check for invitation in URL - reacts to location changes without page reload
  // Debug: log every location change to verify hashchange detection
  useEffect(() => {
    const currentUrl = window.location.href
    console.log('[App] 🔍 Location changed - checking for invite')
    console.log('[App] 🔍 location.pathname:', location.pathname)
    console.log('[App] 🔍 location.hash:', location.hash)
    console.log('[App] 🔍 window.location.href:', currentUrl)

    if (isValidInvitationUrl(currentUrl)) {
      console.log('[App] ✅ Valid invitation detected in URL')
      setPendingInvitation(currentUrl)
      sessionStorage.setPendingInvitation(currentUrl)

      // Clear URL hash but preserve path+query to enable hash-only changes without reload
      // This follows the one.leute pattern: subsequent invites only change the hash
      console.log('[App] 🔍 Clearing hash, keeping:', window.location.pathname + window.location.search)
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
    } else {
      console.log('[App] 🔍 Not a valid invitation URL')
    }
  }, [location])

  // Check authentication state (skip if already initialized from main.tsx)
  useEffect(() => {
    // If model is already initialized, we're already authenticated
    if (model.initialized) {
      console.log('[App] Model already initialized, skipping auth check')
      setIsAuthenticated(true)
      setModelInitialized(true)
      setIsLoading(false)
      return
    }

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

      // Initialize sync monitor to track CHUM activity
      initSyncMonitor(model)

      // Set up channel update forwarding for real-time message updates
      lamaBridge.setupChannelUpdateForwarding()

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

  // Check for default model (must match lama.cube: checks AIAssistantPlan, not LLMConfigPlan)
  useEffect(() => {
    if (isAuthenticated && modelInitialized) {
      console.log('[App] Checking for default model...')
      model.aiAssistantPlan.getDefaultModel()
        .then((result: any) => {
          console.log('[App] Default model response:', result)
          const hasModel = !!result
          console.log('[App] Setting hasDefaultModel to:', hasModel)
          setHasDefaultModel(hasModel)
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

  // Detect mobile viewport changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Clear toolbar controls when route changes
  useEffect(() => {
    setToolbarControls(null)
  }, [location.pathname])

  // Preemptively download Granite model in background when onboarding shows
  useEffect(() => {
    const shouldDownload = isAuthenticated && modelInitialized && hasDefaultModel === false && !pendingInvitation
    if (shouldDownload && !bgDownloadStarted.current && model.llmPlatform?.loadLocalModel) {
      bgDownloadStarted.current = true
      model.llmPlatform.loadLocalModel('granite-4.0-350m', (percent: number) => {
        bgDownloadProgressRef.current = percent
      }).then(() => {
        bgDownloadCompleteRef.current = true
        bgDownloadProgressRef.current = 100
      }).catch(() => {
        bgDownloadStarted.current = false
      })
    }
  }, [isAuthenticated, modelInitialized, hasDefaultModel, pendingInvitation, model.llmPlatform])

  // Update proposal config when sensitivity changes
  useEffect(() => {
    if (!isAuthenticated || !modelInitialized) return

    const updateConfig = async () => {
      try {
        // Direct threshold: slider % = minimum similarity threshold
        // 10% = show proposals with ≥10% match (more proposals)
        // 90% = show proposals with ≥90% match (fewer, very similar proposals)
        const minJaccard = proposalSensitivity
        await model.proposalsPlan.updateConfig({ config: { minJaccard } })

        // Trigger immediate recalculation by invalidating cache
        if (model.proposalsPlan.invalidateCache) {
          model.proposalsPlan.invalidateCache()
        }
      } catch (error) {
        console.error('[App] Failed to update proposal config:', error)
      }
    }

    updateConfig()
  }, [proposalSensitivity, isAuthenticated, modelInitialized, model])

  // Update AI response length when slider changes
  useEffect(() => {
    if (!isAuthenticated || !modelInitialized) return

    const updateResponseLength = async () => {
      const maxTokens = Math.round(4096 * responseLengthPercent)
      await model.aiAssistantPlan.setResponseLength(maxTokens)
      console.log(`[App] Response length updated: ${(responseLengthPercent * 100).toFixed(0)}% = ${maxTokens} tokens`)
    }

    updateResponseLength().catch(error => {
      console.error('[App] Failed to update response length:', error)
      throw error
    })
  }, [responseLengthPercent, isAuthenticated, modelInitialized, model])

  // Login function
  const login = async (instanceName: string, password: string) => {
    console.log('[App] 📥 login() called with instanceName:', instanceName)
    const email = `${instanceName}@lama.local`
    console.log('[App] 📤 Calling model.one.loginOrRegister with:', { email, instanceName })
    setIsLoading(true)
    try {
      await model.one.loginOrRegister(
        email,
        password,
        instanceName
      )
      console.log('[App] ✅ loginOrRegister completed')
      // Store credentials for auto-login on page reload (one.leute pattern)
      sessionStorage.setCredentials({ email, instanceName, secret: password })
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
      // Clear stored credentials on logout
      sessionStorage.clearCredentials()
      console.log('[App] Logged out')
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

  // Login screen - with invitation context if pending
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <LoginDeploy
          onLogin={login}
          logo={
            <>
              <img src="/assets/icons/lama_f_w.svg" alt="LAMA" className="h-12 hidden dark:block" />
              <img src="/assets/icons/lama_f_b.svg" alt="LAMA" className="h-12 block dark:hidden" />
            </>
          }
          testOllamaConnection={async (baseUrl: string) => {
            try {
              const result = await browserOllamaValidator.testOllamaConnection(baseUrl)
              return { success: result.success }
            } catch (error) {
              return { success: false }
            }
          }}
        />
      </div>
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
        downloads={{
          checkModelExists: async (modelId: string) => {
            // Check if background download completed for this model
            if (modelId === 'granite-4.0-350m' && bgDownloadCompleteRef.current) {
              return true
            }
            return false
          },
          downloadModel: async ({ modelId, onProgress }) => {
            // If it's the pre-downloaded model and already complete, return immediately
            if (modelId === 'granite-4.0-350m' && bgDownloadCompleteRef.current) {
              onProgress?.({ modelId, percentage: 100, downloaded: 0, total: 0 })
              return
            }

            // If it's the pre-downloading model, hook into existing progress
            if (modelId === 'granite-4.0-350m' && bgDownloadStarted.current) {
              // Poll refs until complete (refs avoid stale closure problem)
              return new Promise<void>((resolve) => {
                const checkProgress = () => {
                  if (bgDownloadCompleteRef.current) {
                    onProgress?.({ modelId, percentage: 100, downloaded: 0, total: 0 })
                    resolve()
                  } else {
                    onProgress?.({ modelId, percentage: bgDownloadProgressRef.current, downloaded: 0, total: 0 })
                    setTimeout(checkProgress, 100)
                  }
                }
                checkProgress()
              })
            }

            // For other models, download normally
            if (model.llmPlatform?.loadLocalModel) {
              await model.llmPlatform.loadLocalModel(modelId, (percent: number) => {
                onProgress?.({ modelId, percentage: percent, downloaded: 0, total: 0 })
              })
            }
          },
          cancelDownload: async (_modelId: string) => {
            // Not supported for browser models
          }
        }}
        onComplete={async (modelId) => {
          console.log('[App] ModelOnboarding completed with modelId:', modelId)

          // Skip AI Person creation if no model was selected (skip case)
          if (!modelId) {
            console.log('[App] No model selected, skipping AI Person creation')
            setHasDefaultModel(true)
            return
          }

          // Create AI identity and default chats BEFORE showing main UI
          // This ensures topics are fetched AFTER AI is created
          try {
            const response = await lamaBridge.generateBirthName(modelId)
            if (response.success && response.name && response.email) {
              console.log('[App] AI identity generated:', response.name, response.email)
              // Set the default model WITH the generated name and email
              // This creates the AI Person in ONE.core with proper aiId
              await lamaBridge.setDefaultModel(modelId, response.name, response.email)
              console.log('[App] AI Person created with name:', response.name, 'for model:', modelId)
            } else {
              console.error('[App] Failed to generate AI identity:', response.error)
              // Still proceed but without AI Person - user can retry later
            }
          } catch (error) {
            console.error('[App] Error generating AI identity:', error)
            // Still proceed but without AI Person - user can retry later
          }

          // Now show main UI - topics will be fetched with correct AI info
          setHasDefaultModel(true)
        }}
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

  // Navigation tabs - compatible with NavTab type for MobileBottomNav
  const navTabs: NavTab[] = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'settings', label: null, icon: Settings },
  ]

  // Map tab IDs to routes
  const tabPaths: Record<string, string> = {
    chats: '/chats',
    journal: '/journal',
    contacts: '/contacts',
    memory: '/memory',
    devices: '/devices',
    settings: '/settings',
  }

  const handleNavigate = (tab: string, conversationId?: string, section?: string) => {
    if (conversationId) {
      navigate(`/chat/${conversationId}`)
    } else if (section) {
      navigate(`/settings/${section}`)
    } else if (tabPaths[tab]) {
      navigate(tabPaths[tab])
    }
  }

  // Build menu items for navigation between views (like lama.cube)
  const appMenuItems = navTabs.map((tab) => ({
    label: tab.label || 'Settings',
    onClick: () => navigate(tabPaths[tab.id]),
    icon: <tab.icon className="h-4 w-4" />,
    active: tab.id === activeTab
  }))

  // Browser has no traffic lights (no Electron window controls)
  const trafficLightSpace = false

  const renderContent = () => {
    // Route-based rendering with appMenuItems and trafficLightSpace passed to views
    // Browser has no traffic lights (no Electron window controls)
    // Only pass these props to components that support them (ChatLayout, JournalView, MemoryView, DevicesView)
    const headerProps = {
      appMenuItems,
      trafficLightSpace: false
    }

    if (location.pathname.startsWith('/chat/')) {
      return <ChatLayout selectedConversationId={selectedConversationId} {...headerProps} ttsWorkerUrl={ttsWorkerUrl} />
    }

    switch (location.pathname) {
      case '/chats':
        return <ChatLayout selectedConversationId={selectedConversationId} {...headerProps} ttsWorkerUrl={ttsWorkerUrl} />
      case '/journal':
        return <AssemblyJournalView
          queryAssemblies={async (options: AssemblyQueryOptions): Promise<AssemblyWithStory[]> => {
            return await model.journalPlan.queryAssemblies(options)
          }}
          onSetToolbarControls={setToolbarControls}
          {...headerProps}
        />
      case '/contacts':
        return <ContactsView
          onNavigateToChat={(topicId, contactName) => {
            navigate(`/chat/${topicId}`)
          }}
          {...headerProps}
        />
      case '/profile':
        return <ProfileEditor open={true} onOpenChange={() => {}} fullPage={true} onClose={() => navigate('/chats')} />
      case '/memory':
        return <MemoryView {...headerProps} />
      case '/devices':
        return <DevicesView
          adapter={createBrowserDeviceAdapter(model)}
          {...headerProps}
        />
      case '/connections':
        return <ConnectionsView />
      case '/purchase':
        return <PurchaseView onPurchaseComplete={() => navigate('/chats')} />
      case '/settings':
        return <SettingsView onLogout={logout} onNavigate={handleNavigate} {...headerProps} />
      default:
        if (location.pathname.startsWith('/settings/')) {
          return <SettingsView onLogout={logout} onNavigate={handleNavigate} {...headerProps} />
        }
        if (location.pathname.startsWith('/contact/')) {
          // View another user's profile
          return <ProfileEditor open={true} onOpenChange={() => {}} fullPage={true} contactId={params.personId} onClose={() => navigate('/contacts')} />
        }
        return <ChatLayout {...headerProps} ttsWorkerUrl={ttsWorkerUrl} />
    }
  }

  // Wrap children with SettingsProvider only when storage is ready
  const withSettingsProvider = (children: React.ReactNode) => {
    if (settingsStorage) {
      return <SettingsProvider storage={settingsStorage}>{children}</SettingsProvider>
    }
    return <>{children}</>
  }

  return (
    <ModelProvider model={model}>
      <PlansProvider plans={modelToPlans(model)}>
        <BridgeProvider bridge={lamaBridge}>
          {withSettingsProvider(<>
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
              // Don't navigate away - stay on invite path so subsequent invites
              // only change hash (no page reload). one.leute pattern.
            }}
          />
        ) : (
          <NavigateHomeProvider onNavigateHome={() => navigate('/chats')}>
          <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Main Content Area - views render their own AppHeader */}
            {/* On mobile, add padding-bottom to account for fixed MobileBottomNav plus safe area */}
            <div
              className="flex-1 min-h-0 min-w-0 overflow-hidden"
              style={isMobile ? { paddingBottom: `calc(${MOBILE_NAV_HEIGHT} + env(safe-area-inset-bottom, 0px))` } : undefined}
            >
              {renderContent()}
            </div>

            {/* Status Bar - desktop only, uses StatusBar component from lama.ui */}
            {/* Sliders only shown in chat view (matches lama.cube behavior) */}
            <div className="shrink-0 hidden md:block">
              <StatusBar
                version="LAMA Browser v1.0.0"
                responseLength={activeTab === 'chats' ? {
                  value: responseLengthPercent,
                  onChange: setResponseLengthPercent
                } : undefined}
                proposals={activeTab === 'chats' ? {
                  value: proposalSensitivity,
                  onChange: setProposalSensitivity
                } : undefined}
                hideOnMobile={true}
              />
            </div>

            {/* Mobile bottom navigation */}
            <MobileBottomNav
              tabs={navTabs}
              activeTab={activeTab}
              onTabChange={(tabId) => {
                if (tabPaths[tabId]) navigate(tabPaths[tabId])
              }}
            />
          </div>
          </NavigateHomeProvider>
        )}
          </>)}
        </BridgeProvider>
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
