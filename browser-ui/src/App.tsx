/**
 * LAMA Browser App with Platform-Agnostic Routing
 * Uses lama.ui routing abstraction with BrowserHistoryAdapter
 */

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { ContactsView, LoginDeploy, ModelOnboarding, PlansProvider, BridgeProvider, ProfileEditor, ChatLayout, JournalView, MemoryView, MobileBottomNav, MOBILE_NAV_HEIGHT, StatusBar, NavigateHomeProvider, AICreationLoader, useTheme, RecoverRoute } from '@refinio/lama.ui'
import { SettingsProvider, InstanceSettingsStorage, DEFAULT_NETWORK_SETTINGS, DEFAULT_PRIVACY_SETTINGS, type NetworkSettings, type PrivacySettings } from '@refinio/settings.core'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Instance } from '@refinio/one.core/lib/recipes.js'
import type { AssemblyQueryOptions, AssemblyWithStory } from '@refinio/assembly.core'
import type { NavTab } from '@refinio/lama.ui'
import { SettingsView } from '@/components/SettingsView'
import { PurchaseView } from '@/components/PurchaseView'
import { VerificationView } from '@/components/VerificationView'
import { ConnectionsView } from '@/components/ConnectionsView'
import type { LAMAPlansContext } from '@refinio/lama.ui'
import { InvitationAcceptance } from '@/components/InvitationAcceptance'
import { MODEL_OPTIONS } from '@/constants/model-options'
import { MessageSquare, BookOpen, Users, Settings, Loader2, Brain } from 'lucide-react'
import { sessionStorage } from '@/services/session-storage'
import { clearStorage } from '@/services/storage'
import { isValidInvitationUrl } from '@/utils/invitation-url-parser'
import type Model from '@/model/Model.js'
import { ModelProvider } from '@/model/ModelContext'
import { FaviconBadgeManager } from '@/components/FaviconBadgeManager'
import { lamaBridge } from '@/bridge/lama-bridge'
import { browserOllamaValidator } from '../../adapters/browser-llm-config'
import { checkGPUCapability } from '@/utils/gpu-detection'
import { useEmbeddingStatus } from '@/hooks/useEmbeddingStatus'

// TTS Worker - use Vite's ?worker&url syntax for proper bundling
// This bundles the worker and all its dependencies (including @huggingface/transformers)
import ttsWorkerUrl from './workers/tts.worker.ts?worker&url'
import { preloadTTSModel } from '@refinio/lama.ui'

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
} from '@refinio/lama.ui'

/**
 * Create LocalModelsPlan for browser using the Model's LLM platform
 * Text-generation uses WebWorker + transformers.js via BrowserLLMPlatform
 * Browser Whisper requires separate implementation (not yet done)
 */
function createBrowserLocalModelsPlan(model: Model) {
  return {
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

    async loadModel(modelId: string) {
      if (!model.llmPlatform?.loadLocalModel) {
        return { success: false, error: 'LLM platform not initialized' }
      }
      try {
        await model.llmPlatform.loadLocalModel(modelId)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to load model' }
      }
    },

    async unloadModel(modelId: string) {
      if (!model.llmPlatform?.unloadLocalModel) {
        return { success: false, error: 'LLM platform not initialized' }
      }
      try {
        await model.llmPlatform.unloadLocalModel(modelId)
        return { success: true }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to unload model' }
      }
    }
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
    localModels: createBrowserLocalModelsPlan(model),
    ingestion: model.ingestionPlan || undefined,
    glueIdentity: model.glueIdentityPlan || undefined,
    onecore: {
      async clearStorage() {
        try {
          await clearStorage()
          window.location.reload()
          return { success: true }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to clear storage' }
        }
      }
    },
  }
}

import { initSyncMonitor } from '@/services/browser-sync-monitor'

/**
 * Applies the theme class to <html> based on settings.
 * Must be rendered inside SettingsProvider.
 */
function ThemeApplicator({ children }: { children: ReactNode }) {
  useTheme()
  return <>{children}</>
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
  const [isCreatingAI, setIsCreatingAI] = useState(false)
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

  // Embedding model loading status (for status bar)
  const embeddingStatus = useEmbeddingStatus()

  // Background model download state (preemptively download Granite)
  // Use refs for values that polling closures need to read (avoids stale closure problem)
  const bgDownloadProgressRef = useRef<number>(0)
  const bgDownloadCompleteRef = useRef(false)
  const bgDownloadStarted = useRef(false)

  // Settings storage - created once model is initialized
  // Uses InstanceSettingsStorage for IoM-compatible versioned objects
  const settingsStorage = useMemo(() => {
    if (!modelInitialized || !model.initialized || !model.instanceId) return null

    return new InstanceSettingsStorage({
      instanceIdHash: model.instanceId as SHA256IdHash<Instance>
    })
  }, [model, modelInitialized, model.instanceId])

  // Memoize plans context to prevent unnecessary re-renders of all PlansProvider consumers
  // CRITICAL: This must be before all early returns to satisfy React's rules of hooks
  const plansContext = useMemo(() => {
    const basePlans = modelToPlans(model)

    // Create settings adapter that wraps InstanceSettingsStorage
    // Maps UI expected interface to settings.core module-based API
    const settingsAdapter = settingsStorage ? {
      async getProfile() {
        // Profile comes from ONE.core, not settings storage
        return { displayName: model.instanceName || '', publicKey: '' }
      },
      async updateProfile(params: { displayName: string }) {
        // Update ONE.core profile via ContactsPlan
        try {
          if (model.ownerId && model.contactsPlan) {
            await model.contactsPlan.updateProfile({
              personId: model.ownerId,
              name: params.displayName
            })
          }
          // Also update mDNS discovery advertisement
          model.updateDiscoveryDisplayName(params.displayName)
          return { success: true }
        } catch (error) {
          console.error('[Settings] updateProfile failed:', error)
          return { success: false, error: error instanceof Error ? error.message : 'Failed to update profile' }
        }
      },
      async getNetworkSettings() {
        try {
          const settings = await settingsStorage.getSection('network')
          return settings || DEFAULT_NETWORK_SETTINGS
        } catch {
          return DEFAULT_NETWORK_SETTINGS
        }
      },
      async updateNetworkSettings(config: Partial<NetworkSettings>) {
        try {
          await settingsStorage.updateSection('network', config)
          return { success: true }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to update' }
        }
      },
      async getPrivacySettings() {
        try {
          const settings = await settingsStorage.getSection('privacy')
          return settings || DEFAULT_PRIVACY_SETTINGS
        } catch {
          return DEFAULT_PRIVACY_SETTINGS
        }
      },
      async updatePrivacySettings(config: Partial<PrivacySettings>) {
        try {
          await settingsStorage.updateSection('privacy', config)
          return { success: true }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to update' }
        }
      },
      async getStorageStats() {
        // Browser storage stats via navigator.storage API
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate()
          return {
            success: true,
            data: {
              used: estimate.usage || 0,
              total: estimate.quota || 0,
              breakdown: { messages: 0, files: 0, cache: 0 }
            }
          }
        }
        return { success: true, data: { used: 0, total: 0, breakdown: { messages: 0, files: 0, cache: 0 } } }
      },
      async runCleanup(_options: any) {
        // Browser cleanup would involve IndexedDB operations
        console.warn('[Settings] runCleanup not yet implemented for browser')
        return { success: true }
      }
    } : undefined

    return {
      ...basePlans,
      settings: settingsAdapter
    }
  }, [model, model.ownerId, settingsStorage])

  // Derive active tab from current route
  const activeTab = location.pathname.startsWith('/chat/')
    ? 'chats'
    : location.pathname.substring(1) || 'chats'

  // Derive selected conversation from route params
  const selectedConversationId = params.topicId

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

      // Set up new topic forwarding for CHUM sync (topics received from peers)
      lamaBridge.setupNewTopicForwarding()

      // Set up composing state forwarding for typing indicators
      lamaBridge.setupComposingForwarding()

      if (pendingInvitation) {
        console.log('[App] Processing pending invitation')
      }
    }

    // If model is already initialized (e.g., auto-login completed before App mounted),
    // call handleModelsReady immediately
    if (model.initialized) {
      console.log('[App] Model already initialized, calling handleModelsReady immediately')
      handleModelsReady()
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

  // Recovery route — accessible regardless of auth state
  if (location.pathname === '/recover') {
    return (
      <RecoverRoute
        hash={window.location.hash}
        onRecover={async (bundle) => {
          // Shut down existing identity if active
          if (model.initialized) {
            await model.shutdown()
          }
          // MultiUser.register() accepts base64 strings directly for keys
          const email = `${bundle.instanceName}@lama.local`
          await model.one.register(
            email,
            'recovery',
            bundle.instanceName,
            bundle.secretEncryptionKey,
            bundle.secretSigningKey
          )
        }}
        onComplete={() => {
          window.location.href = '/'  // Full reload to reinitialize
        }}
        onCancel={() => navigate('/chats')}
        hasExistingIdentity={isAuthenticated}
        appName={document.title || 'LAMA'}
      />
    )
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

  // Show loading while creating AI identity (LLM inference for name generation)
  if (isCreatingAI) {
    return <AICreationLoader />
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
        checkGPUCapability={checkGPUCapability}
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
        onComplete={async (model) => {
          console.log('[App] ModelOnboarding completed with model:', model)

          // Skip AI Person creation if no model was selected (skip case)
          if (!model.id) {
            console.log('[App] No model selected, skipping AI Person creation')
            setHasDefaultModel(true)
            return
          }

          // Create AI identity and default chats BEFORE showing main UI
          // This ensures topics are fetched AFTER AI is created
          setIsCreatingAI(true)
          try {
            const response = await lamaBridge.generateAIName(model.id, model.provider)
            if (response.success && response.name && response.email) {
              console.log('[App] AI identity generated:', response.name, response.email)
              // Set the default model WITH the generated name and email
              // This creates the AI Person in ONE.core with proper aiId
              await lamaBridge.setDefaultModel(model.id, response.name, response.email)
              console.log('[App] AI Person created with name:', response.name, 'for model:', model.id)
            } else {
              console.error('[App] Failed to generate AI identity:', response.error)
              // Still proceed but without AI Person - user can retry later
            }
          } catch (error) {
            console.error('[App] Error generating AI identity:', error)
            // Still proceed but without AI Person - user can retry later
          } finally {
            // IMPORTANT: Set hasDefaultModel BEFORE clearing isCreatingAI
            // to prevent brief flash of "Loading LAMA" screen
            setHasDefaultModel(true)
            setIsCreatingAI(false)
          }
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
    { id: 'settings', label: null, icon: Settings },
  ]

  // Map tab IDs to routes
  const tabPaths: Record<string, string> = {
    chats: '/chats',
    journal: '/journal',
    contacts: '/contacts',
    memory: '/memory',
    settings: '/settings',
  }

  const handleNavigate = (tab: string, topicId?: string, section?: string) => {
    if (topicId) {
      navigate(`/chat/${topicId}`)
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

  // Handle sharing message to glue.one
  const handleShareGlue = async (message: any) => {
    try {
      const result = await lamaBridge.shareToGlue(message, {
        includeSourceTopic: true
      })
      if (!result.success) {
        console.error('[App] Failed to share to glue.one:', result.error)
      } else {
        console.log('[App] Message shared to glue.one:', result.glueTopicId)
      }
    } catch (error) {
      console.error('[App] Error sharing to glue.one:', error)
    }
  }

  const renderContent = () => {
    // Route-based rendering with appMenuItems and trafficLightSpace passed to views
    // Browser has no traffic lights (no Electron window controls)
    // Only pass these props to components that support them (ChatLayout, JournalView, MemoryView)
    const headerProps = {
      appMenuItems,
      trafficLightSpace: false
    }

    // glue.one logo for chat header
    const glueOneLogo = <img src="/assets/icons/glueone.svg" alt="glue.one" className="h-6" />

    if (location.pathname.startsWith('/chat/')) {
      return <ChatLayout selectedConversationId={selectedConversationId} {...headerProps} ttsWorkerUrl={ttsWorkerUrl} logo={glueOneLogo} onShareGlue={handleShareGlue} />
    }

    switch (location.pathname) {
      case '/chats':
        return <ChatLayout selectedConversationId={selectedConversationId} {...headerProps} ttsWorkerUrl={ttsWorkerUrl} logo={glueOneLogo} onShareGlue={handleShareGlue} />
      case '/journal':
        return <JournalView
          onSetToolbarControls={setToolbarControls}
          {...headerProps}
          onNavigateToEntity={(entityId, entityType) => {
            if (entityType === 'contact') {
              navigate(`/contact/${entityId}`)
            } else if (entityType === 'chat') {
              navigate(`/chat/${entityId}`)
            }
          }}
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
      case '/connections':
        return <ConnectionsView />
      case '/purchase':
        return <PurchaseView onPurchaseComplete={() => navigate('/chats')} />
      case '/settings':
        return <SettingsView onLogout={logout} onNavigate={handleNavigate} {...headerProps} ttsWorkerUrl={ttsWorkerUrl} />
      default:
        if (location.pathname.startsWith('/settings/')) {
          return <SettingsView onLogout={logout} onNavigate={handleNavigate} {...headerProps} ttsWorkerUrl={ttsWorkerUrl} />
        }
        if (location.pathname.startsWith('/contact/')) {
          // View another user's profile
          return <ProfileEditor open={true} onOpenChange={() => {}} fullPage={true} contactId={params.personId} onClose={() => navigate('/contacts')} />
        }
        return <ChatLayout {...headerProps} ttsWorkerUrl={ttsWorkerUrl} logo={glueOneLogo} onShareGlue={handleShareGlue} />
    }
  }

  // Wrap children with SettingsProvider only when storage is ready
  const withSettingsProvider = (children: React.ReactNode) => {
    if (settingsStorage) {
      return <SettingsProvider storage={settingsStorage}><ThemeApplicator>{children}</ThemeApplicator></SettingsProvider>
    }
    return <>{children}</>
  }

  return (
    <ModelProvider model={model}>
      <PlansProvider plans={plansContext}>
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
                embeddingStatus={embeddingStatus.loading || embeddingStatus.error ? embeddingStatus : undefined}
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

  // Preload TTS model at app startup for faster first speech
  // Uses singleton pattern so subsequent calls from useTTS are instant
  useEffect(() => {
    console.log('[App] Preloading TTS model at startup...')
    preloadTTSModel(ttsWorkerUrl).catch(err => {
      console.warn('[App] TTS preload failed (non-critical):', err.message)
    })
  }, [])

  return (
    <RouterProvider adapter={adapter}>
      <AppContent model={model} />
    </RouterProvider>
  )
}
