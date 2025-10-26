import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
// import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatLayout } from '@/components/ChatLayout'
import { JournalView } from '@/components/JournalView'
import { ContactsView } from '@/components/ContactsView'
import { SettingsView } from '@/components/SettingsView'
import { DataDashboard } from '@/components/DataDashboard'
import { DevicesView } from '@/components/DevicesView'
import { LoginDeploy } from '@/components/LoginDeploy'
import { ModelOnboarding } from '@/components/ModelOnboarding'
import { InvitationAcceptance } from '@/components/InvitationAcceptance'
import { MessageSquare, BookOpen, Users, Settings, Loader2, Smartphone, BarChart3 } from 'lucide-react'
import { sessionStorage } from '@/services/session-storage'
import { isValidInvitationUrl } from '@/utils/invitation-url-parser'
import type Model from '@/model/Model.js'
import { ModelProvider } from '@/model/ModelContext'

interface AppProps {
  model: Model
}

function App({ model }: AppProps) {
  console.log('[App] ========== APP COMPONENT RENDER ==========')
  console.log('[App] Component is rendering/re-rendering')

  // Restore session state on mount
  const restoredState = sessionStorage.restoreState()
  const [activeTab, setActiveTab] = useState(restoredState?.activeTab || 'chats')
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(
    restoredState?.selectedConversationId
  )
  const [hasTopics, setHasTopics] = useState<boolean | null>(null)
  const [hasDefaultModel, setHasDefaultModel] = useState<boolean | null>(null)

  // Invitation handling (check URL on mount)
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)
  const [pendingInvitation, setPendingInvitation] = useState<string | null>(null)
  const [isAcceptingInvitation, setIsAcceptingInvitation] = useState(false)

  // Authentication state (following one.leute pattern - event-based)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true) // Start as loading while checking session

  // Add mount/unmount tracking
  useEffect(() => {
    console.log('[App] ========== APP COMPONENT MOUNTED ==========')
    return () => {
      console.log('[App] ========== APP COMPONENT UNMOUNTING ==========')
      console.log('[App] ⚠️ THIS INDICATES A RESTART/REMOUNT')
    }
  }, [])

  // Check for invitation URL on mount (following one.leute pattern)
  useEffect(() => {
    const currentUrl = window.location.href
    console.log('[App] ========== INVITATION URL CHECK (MOUNT) ==========')
    console.log('[App] Current URL:', currentUrl)
    console.log('[App] isAuthenticated:', isAuthenticated)
    console.log('[App] pendingInvitation:', pendingInvitation)

    if (isValidInvitationUrl(currentUrl)) {
      console.log('[App] ✅ Valid invitation URL detected')
      setInvitationUrl(currentUrl)
      setPendingInvitation(currentUrl)

      // Clear invitation from URL immediately to prevent re-processing
      console.log('[App] Clearing URL (using replaceState - NOT a page reload)')
      window.history.replaceState({}, document.title, window.location.pathname)
    } else {
      console.log('[App] No invitation detected in URL')
    }
    console.log('[App] ============================================')
  }, [])

  // Restore session on mount (following one.leute pattern)
  useEffect(() => {
    async function restoreSession() {
      try {
        console.log('[App] Checking for existing registration...')

        if (await model.one.isRegistered()) {
          console.log('[App] User is registered, attempting auto-login...')
          await model.one.login()
          console.log('[App] ✅ Auto-login successful')
          // isAuthenticated will be set by onLogin event
        } else {
          console.log('[App] No existing registration found')
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[App] Auto-login failed:', error)
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [model])

  // Setup authentication event listeners (following one.leute pattern)
  useEffect(() => {
    const handleLogin = () => {
      console.log('[App] ===== LOGIN EVENT: Auth state updated =====');
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    const handleLogout = () => {
      console.log('[App] Logout event received');
      setIsAuthenticated(false);
      setPendingInvitation(null);
      setIsAcceptingInvitation(false);
    };

    model.one.onLogin(handleLogin);
    model.one.onLogout(handleLogout);
  }, [model]);

  // Setup onOneModelsReady listener for pending invitation processing
  // This fires AFTER model.init() completes and model.initialized = true
  useEffect(() => {
    const handleModelsReady = () => {
      console.log('[App] ===== MODELS READY: model.initialized =', model.initialized, '=====');
      // If there's a pending invitation after login, process it now that models are ready
      if (pendingInvitation) {
        console.log('[App] Processing pending invitation after models ready');
        setIsAcceptingInvitation(true);
      }
    };

    const disconnect = model.onOneModelsReady(handleModelsReady);
    return disconnect;
  }, [model, pendingInvitation]);

  // Check if any topics exist (for onboarding detection)
  useEffect(() => {
    if (isAuthenticated) {
      model.chatHandler.getConversations({ limit: 1 })
        .then((response) => {
          setHasTopics(response.success && response.data && response.data.length > 0)
        })
        .catch(() => setHasTopics(false))
    }
  }, [isAuthenticated, model])

  // Check if a default model has been configured
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[App] Checking for default model...')
      model.llmConfigHandler.getConfig({})
        .then(response => {
          console.log('[App] Retrieved LLM config:', response)
          setHasDefaultModel(response.success && response.config !== null)
        })
        .catch(err => {
          console.error('[App] Failed to get LLM config:', err)
          setHasDefaultModel(false)
        })
    }
  }, [isAuthenticated, model])

  // Persist active tab changes
  useEffect(() => {
    sessionStorage.setActiveTab(activeTab)
  }, [activeTab])

  // Persist conversation selection changes
  useEffect(() => {
    sessionStorage.setSelectedConversationId(selectedConversationId)
  }, [selectedConversationId])
  
  // Login/Register function
  const login = async (instanceName: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('[App] ===== LOGIN START: Requesting login/register for:', instanceName, '=====');

      // Use loginOrRegister() - handles both new and existing users without accessing storage first
      await model.one.loginOrRegister({
        email: `${instanceName}@lama.local`,
        instanceName: instanceName,
        secret: password
      });

      // isAuthenticated will be set by onLogin event (after Model.init() completes)
    } catch (error) {
      console.error('[App] Login/register failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function (following one.leute pattern)
  const logout = async () => {
    setIsLoading(true);
    try {
      console.log('[App] Logging out');
      await model.one.logout();
      // isAuthenticated will be set by onLogout event
    } catch (error) {
      console.error('[App] Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Show invitation acceptance AFTER login if there's a pending invitation
  // Don't wait for isAcceptingInvitation flag - it's async and causes timing issues
  console.log('[App] ========== INVITATION ACCEPTANCE CHECK ==========')
  console.log('[App] isAuthenticated:', isAuthenticated)
  console.log('[App] model.initialized:', model.initialized)
  console.log('[App] pendingInvitation:', pendingInvitation)
  console.log('[App] Should show invitation?', isAuthenticated && model.initialized && pendingInvitation)

  if (isAuthenticated && model.initialized && pendingInvitation) {
    console.log('[App] ✅ Showing InvitationAcceptance component')
    return (
      <InvitationAcceptance
        model={model}
        invitationUrl={pendingInvitation}
        onComplete={(success) => {
          console.log('[App] 🔍 Invitation acceptance complete:', success)
          console.log('[App] 🔍 Clearing pendingInvitation')
          setIsAcceptingInvitation(false)
          setPendingInvitation(null)

          // Refresh to load new contacts/conversations after pairing
          if (success) {
            console.log('[App] 🔄 Waiting 3 seconds for data to persist before reload...')
            setTimeout(() => {
              console.log('[App] 🔄 Reloading page to load new contacts...')
              window.location.reload()
            }, 3000)
          }
          // Continue to main app (will show onboarding if no model selected)
        }}
      />
    )
  }

  // Show loading screen while logging in
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

  // Show login/deploy screen if not authenticated
  if (!isAuthenticated) {
    return <LoginDeploy onLogin={login} />
  }

  // Check if we need to show model onboarding
  // Show onboarding only if no default model has been configured AND no pending invitation
  // (Invitation acceptance takes priority over onboarding)
  const shouldShowOnboarding = hasDefaultModel === false && !pendingInvitation
  console.log('[App] hasDefaultModel state:', hasDefaultModel)
  console.log('[App] pendingInvitation for onboarding check:', pendingInvitation)
  console.log('[App] shouldShowOnboarding:', shouldShowOnboarding)

  if (shouldShowOnboarding) {
    console.log('[App] Showing ModelOnboarding component')
    return <ModelOnboarding model={model} onComplete={async () => {
      // Model has been selected and saved to settings
      console.log('[App] ModelOnboarding completed, setting hasDefaultModel to true')
      setHasDefaultModel(true)
    }} />
  }

  // Show loading while checking for default model
  if (hasDefaultModel === null) {
    console.log('[App] Still checking for default model, showing loading...')
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loading LAMA</h2>
          <p className="text-muted-foreground">Checking for existing conversations...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'settings', label: null, icon: Settings },  // No label for settings, just icon
  ]

  const handleNavigate = (tab: string, conversationId?: string, section?: string) => {
    setActiveTab(tab)
    if (conversationId) {
      setSelectedConversationId(conversationId)
    }
    
    // Store navigation context for settings
    if (tab === 'settings' && section) {
      // We'll pass this to SettingsView
      sessionStorage.setItem('settings-scroll-to', section)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'chats':
        return <ChatLayout selectedConversationId={selectedConversationId} />
      case 'journal':
        return <JournalView />
      case 'contacts':
        return <ContactsView onNavigateToChat={async (topicId, contactName) => {
          // Add or update the conversation in browser localStorage (not IPC secure storage)
          const savedConversations = localStorage.getItem('lama-conversations')
          let conversations = []

          try {
            if (savedConversations) {
              conversations = JSON.parse(savedConversations)
            }
          } catch (e) {
            console.error('Failed to parse saved conversations:', e)
          }

          // Check if conversation already exists
          const existingConv = conversations.find((c: any) => c.id === topicId)

          if (!existingConv) {
            // Create new conversation entry
            const newConversation = {
              id: topicId,
              name: `Chat with ${contactName}`,
              type: 'direct',
              lastMessage: null,
              lastMessageTime: new Date().toISOString(),
              modelName: null // No AI model for person-to-person chat
            }

            // Add to beginning of list
            conversations.unshift(newConversation)
            localStorage.setItem('lama-conversations', JSON.stringify(conversations))
            console.log('[App] Created new conversation for contact:', contactName)
          }

          // Navigate to chat
          setSelectedConversationId(topicId)
          setActiveTab('chats')
        }} />
      case 'devices':
        return <DevicesView />
      case 'settings':
        return <SettingsView onLogout={logout} onNavigate={handleNavigate} />
      default:
        return <ChatLayout />
    }
  }

  return (
    <ModelProvider model={model}>
      <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo and App Name */}
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              LAMA
            </h1>
            <div className="h-6 w-px bg-border" />
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between flex-1">
            {/* Left side - main navigation */}
            <div className="flex items-center space-x-2">
              {tabs.filter(tab => tab.id !== 'settings').map((tab) => {
                const Icon = tab.icon
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label && <span>{tab.label}</span>}
                  </Button>
                )
              })}
            </div>
            
            {/* Right side - settings */}
            <div className="flex items-center space-x-2">
              {tabs.filter(tab => tab.id === 'settings').map((tab) => {
                const Icon = tab.icon
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {/* Status Bar */}
      <div className="border-t bg-card px-6 py-2">
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
          </div>
        </div>
      </div>
    </div>
    </ModelProvider>
  )
}

export default App