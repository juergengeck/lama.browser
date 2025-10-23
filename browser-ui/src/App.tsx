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
import { MessageSquare, BookOpen, Users, Settings, Loader2, Smartphone, BarChart3 } from 'lucide-react'
import { sessionStorage } from '@/services/session-storage'
import type Model from '@/model/Model.js'
import { ModelProvider } from '@/model/ModelContext'

interface AppProps {
  model: Model
}

function App({ model }: AppProps) {
  // Restore session state on mount
  const restoredState = sessionStorage.restoreState()
  const [activeTab, setActiveTab] = useState(restoredState?.activeTab || 'chats')
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(
    restoredState?.selectedConversationId
  )
  const [hasTopics, setHasTopics] = useState<boolean | null>(null)
  const [hasDefaultModel, setHasDefaultModel] = useState<boolean | null>(null)

  // Authentication state (following one.leute pattern - event-based)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Setup authentication event listeners (following one.leute pattern)
  useEffect(() => {
    const handleLogin = () => {
      console.log('[App] Login event received');
      setIsAuthenticated(true);
    };

    const handleLogout = () => {
      console.log('[App] Logout event received');
      setIsAuthenticated(false);
    };

    model.one.onLogin(handleLogin);
    model.one.onLogout(handleLogout);
  }, [model]);

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
      // TODO: Implement ai:getDefaultModel worker handler
      // For now, assume no default model to show onboarding
      setHasDefaultModel(false)
    }
  }, [isAuthenticated])

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
      console.log('[App] Logging in/registering as:', instanceName);

      // Use loginOrRegister() - handles both new and existing users without accessing storage first
      await model.one.loginOrRegister({
        email: `${instanceName}@lama.local`,
        instanceName: instanceName,
        secret: password
      });

      // isAuthenticated will be set by onLogin event
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
  // Show onboarding only if no default model has been configured
  const shouldShowOnboarding = hasDefaultModel === false
  console.log('[App] hasDefaultModel state:', hasDefaultModel)
  console.log('[App] shouldShowOnboarding:', shouldShowOnboarding)

  if (shouldShowOnboarding) {
    console.log('[App] Showing ModelOnboarding component')
    return <ModelOnboarding onComplete={async () => {
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