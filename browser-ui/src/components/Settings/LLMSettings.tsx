/**
 * LLMSettings - LLM Configuration Management - Platform-Agnostic
 *
 * Displays LLM configurations organized by type:
 * 1. Detected Local Models (Ollama/LM Studio)
 * 2. Server Configuration (Ollama/LM Studio)
 * 3. Cloud API Models (Anthropic/OpenAI/DeepSeek/Qwen)
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@lama/ui'
import { Button } from '@lama/ui'
import { Badge } from '@lama/ui'
import { Textarea } from '@lama/ui'
import { Input } from '@lama/ui'
import { Label } from '@lama/ui'
import { Brain, ChevronDown, ChevronRight, RefreshCw, Save, Bot, Key, Eye, EyeOff, Plus, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@lama/ui'
import { Separator } from '@lama/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@lama/ui'

interface LLMConfig {
  id: string
  modelId: string
  modelName: string
  provider: string
  systemPrompt?: string
  active: boolean
  created: number
  modified: number
  encryptedApiKey?: string
  modelType?: 'local' | 'remote'
  baseUrl?: string
}

export interface LLMSettingsProps {
  llmConfig: any  // Plan interface
  chat: any       // Plan interface
  aiAssistant: any // Plan interface
  navigate?: (path: string) => void
  initialized?: boolean
}

export function LLMSettings({ llmConfig, chat, aiAssistant, navigate, initialized = true }: LLMSettingsProps) {

  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLlm, setExpandedLlm] = useState<string | null>(null)
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({})
  const [editedApiKeys, setEditedApiKeys] = useState<Record<string, string>>({})
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [savingApiKey, setSavingApiKey] = useState<string | null>(null)

  // Server configuration state
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434')
  const [lmstudioBaseUrl, setLmstudioBaseUrl] = useState('http://localhost:1234')
  const [testingOllama, setTestingOllama] = useState(false)
  const [testingLMStudio, setTestingLMStudio] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [lmstudioStatus, setLMStudioStatus] = useState<{ success: boolean; message: string } | null>(null)

  // Discovered models from test connections
  const [ollamaModels, setOllamaModels] = useState<any[]>([])
  const [lmstudioModels, setLMStudioModels] = useState<any[]>([])
  const [registeringModel, setRegisteringModel] = useState<string | null>(null)
  const [creatingChat, setCreatingChat] = useState<string | null>(null)

  // Cloud provider management state
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [addProviderDialogOpen, setAddProviderDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [providerApiKey, setProviderApiKey] = useState('')
  const [addingProvider, setAddingProvider] = useState(false)

  // Cloud provider configurations
  const cloudProviders = [
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude models - Advanced reasoning and coding',
      icon: '🧠',
      models: [
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Recommended)' },
        { id: 'claude-opus-4-1', name: 'Claude Opus 4.1' },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      ],
      websiteUrl: 'https://console.anthropic.com',
      apiKeyLabel: 'Anthropic API Key',
      apiKeyPlaceholder: 'sk-ant-api...'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT models - Powerful language understanding',
      icon: '🧠',
      models: [
        { id: 'gpt-4.1', name: 'GPT-4.1 (Recommended)' },
        { id: 'gpt-5', name: 'GPT-5' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
        { id: 'o3-mini', name: 'o3-mini (Reasoning)' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      ],
      websiteUrl: 'https://platform.openai.com/api-keys',
      apiKeyLabel: 'OpenAI API Key',
      apiKeyPlaceholder: 'sk-...'
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'Advanced reasoning - Excellent for math and coding',
      icon: '🧠',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek V3.2 (Recommended)' },
        { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoning)' },
      ],
      websiteUrl: 'https://platform.deepseek.com/api-keys',
      apiKeyLabel: 'DeepSeek API Key',
      apiKeyPlaceholder: 'sk-...'
    },
    {
      id: 'qwen',
      name: 'Qwen',
      description: 'Multilingual models - Best for multiple languages',
      icon: '🧠',
      models: [
        { id: 'qwen-max', name: 'Qwen3 Max (Recommended)' },
        { id: 'qwen-plus', name: 'Qwen Plus' },
      ],
      websiteUrl: 'https://dashscope.aliyun.com',
      apiKeyLabel: 'Qwen API Key',
      apiKeyPlaceholder: 'sk-...'
    }
  ]

  useEffect(() => {
    loadLLMConfigs()
  }, [initialized])

  const loadLLMConfigs = async () => {
    if (!initialized) {
      console.log('[LLMSettings] Not initialized yet')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      // Platform-agnostic LLM config loading
      const configs = await llmConfig.getAllConfigs()

      if (configs && configs.length > 0) {
        setLlmConfigs(configs)
        console.log(`[LLMSettings] Loaded ${configs.length} LLM configurations`)
      } else {
        setLlmConfigs([])
        console.log('[LLMSettings] No LLM configurations found')
      }
    } catch (error) {
      console.error('[LLMSettings] Failed to load LLM configs:', error)
      setLlmConfigs([])
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (llmId: string) => {
    setExpandedLlm(expandedLlm === llmId ? null : llmId)
  }

  const handlePromptEdit = (llmId: string, newPrompt: string) => {
    setEditedPrompts(prev => ({
      ...prev,
      [llmId]: newPrompt
    }))
  }

  const handleSavePrompt = async (llmId: string) => {
    const newPrompt = editedPrompts[llmId]
    if (!newPrompt) return

    setSaving(llmId)
    try {
      await llmConfig.updateSystemPrompt({
        llmId,
        systemPrompt: newPrompt
      })

      // Reload configs to show updated prompt
      await loadLLMConfigs()

      // Clear edited state
      setEditedPrompts(prev => {
        const updated = { ...prev }
        delete updated[llmId]
        return updated
      })

      console.log('[LLMSettings] System prompt saved successfully')
    } catch (error) {
      console.error('[LLMSettings] Failed to save system prompt:', error)
      alert('Failed to save system prompt')
    } finally {
      setSaving(null)
    }
  }

  const handleRegeneratePrompt = async (llmId: string) => {
    setRegenerating(llmId)
    try {
      const result = await llmConfig.regenerateSystemPrompt({ llmId })

      if (result.success && result.systemPrompt) {
        // Update local edited state with regenerated prompt
        setEditedPrompts(prev => ({
          ...prev,
          [llmId]: result.systemPrompt!
        }))

        // Reload configs to show updated prompt
        await loadLLMConfigs()

        console.log('[LLMSettings] System prompt regenerated successfully')
      } else {
        alert('Failed to regenerate system prompt: ' + result.error)
      }
    } catch (error) {
      console.error('[LLMSettings] Failed to regenerate system prompt:', error)
      alert('Failed to regenerate system prompt')
    } finally {
      setRegenerating(null)
    }
  }

  const getCurrentPrompt = (llm: LLMConfig): string => {
    return editedPrompts[llm.id] ?? llm.systemPrompt ?? ''
  }

  const hasUnsavedChanges = (llm: LLMConfig): boolean => {
    return editedPrompts[llm.id] !== undefined && editedPrompts[llm.id] !== llm.systemPrompt
  }

  const handleApiKeyEdit = (llmId: string, newApiKey: string) => {
    setEditedApiKeys(prev => ({
      ...prev,
      [llmId]: newApiKey
    }))
  }

  const handleSaveApiKey = async (llmId: string) => {
    const apiKey = editedApiKeys[llmId]
    if (!apiKey || apiKey.trim() === '') {
      alert('API key cannot be empty')
      return
    }

    setSavingApiKey(llmId)
    try {
      await llmConfig.updateApiKey({
        llmId,
        apiKey
      })

      // Reload configs to show updated state
      await loadLLMConfigs()

      // Clear edited state
      setEditedApiKeys(prev => {
        const updated = { ...prev }
        delete updated[llmId]
        return updated
      })

      console.log('[LLMSettings] API key saved successfully')
    } catch (error) {
      console.error('[LLMSettings] Failed to save API key:', error)
      alert('Failed to save API key: ' + (error as Error).message)
    } finally {
      setSavingApiKey(null)
    }
  }

  const hasUnsavedApiKey = (llmId: string): boolean => {
    return editedApiKeys[llmId] !== undefined && editedApiKeys[llmId].trim() !== ''
  }

  const toggleApiKeyVisibility = (llmId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [llmId]: !prev[llmId]
    }))
  }

  const needsApiKey = (provider: string): boolean => {
    // These providers require API keys
    return ['openai', 'anthropic', 'claude', 'deepseek', 'qwen'].includes(provider?.toLowerCase())
  }

  const isLocalProvider = (provider: string): boolean => {
    return ['ollama', 'meta', 'lmstudio'].includes(provider?.toLowerCase())
  }

  const isCloudProvider = (provider: string): boolean => {
    return needsApiKey(provider)
  }

  const testOllamaConnection = async () => {
    setTestingOllama(true)
    setOllamaStatus(null)
    setOllamaModels([])

    try {
      const result = await llmConfig.testConnectionAndDiscoverModels({
        baseUrl: ollamaBaseUrl,
        serviceName: 'Ollama'
      })

      if (result.success) {
        setOllamaStatus({
          success: true,
          message: `Connected! Version: ${result.version || 'unknown'}${result.models ? `, ${result.models.length} models available` : ''}`
        })

        // Save discovered models
        if (result.models && result.models.length > 0) {
          setOllamaModels(result.models)
        }
      } else {
        setOllamaStatus({
          success: false,
          message: result.error || 'Connection failed'
        })
      }
    } catch (error) {
      setOllamaStatus({
        success: false,
        message: (error as Error).message || 'Connection test failed'
      })
    } finally {
      setTestingOllama(false)
    }
  }

  const testLMStudioConnection = async () => {
    setTestingLMStudio(true)
    setLMStudioStatus(null)
    setLMStudioModels([])

    try {
      // LM Studio uses OpenAI-compatible API
      const result = await llmConfig.testConnectionAndDiscoverModels({
        server: lmstudioBaseUrl,
        serviceName: 'LM Studio'
      })

      if (result.success) {
        setLMStudioStatus({
          success: true,
          message: `Connected!${result.models ? ` ${result.models.length} models available` : ''}`
        })

        // Save discovered models
        if (result.models && result.models.length > 0) {
          setLMStudioModels(result.models)
        }
      } else {
        setLMStudioStatus({
          success: false,
          message: result.error || 'Connection failed'
        })
      }
    } catch (error) {
      setLMStudioStatus({
        success: false,
        message: (error as Error).message || 'Connection test failed'
      })
    } finally {
      setTestingLMStudio(false)
    }
  }

  const registerModel = async (modelName: string, provider: 'ollama' | 'lmstudio', baseUrl: string) => {
    setRegisteringModel(modelName)
    try {
      const result = await llmConfig.setConfig({
        modelType: 'local',
        baseUrl,
        modelName,
        setAsActive: false,
        authType: 'none'
      })

      if (result.success) {
        console.log(`[LLMSettings] Successfully registered model: ${modelName}`)
        await loadLLMConfigs()
      } else {
        alert(`Failed to register model: ${result.error}`)
      }
    } catch (error) {
      console.error('[LLMSettings] Failed to register model:', error)
      alert(`Failed to register model: ${(error as Error).message}`)
    } finally {
      setRegisteringModel(null)
    }
  }

  const isModelRegistered = (modelName: string): boolean => {
    return llmConfigs.some(config => config.modelName === modelName || config.modelId === modelName)
  }

  const handleOpenProviderDialog = (providerId: string) => {
    const provider = cloudProviders.find(p => p.id === providerId)
    if (!provider) return

    setSelectedProvider(providerId)
    setSelectedModel(provider.models[0].id) // Pre-select first model
    setProviderApiKey('')
    setAddProviderDialogOpen(true)
  }

  const handleCloseProviderDialog = () => {
    setAddProviderDialogOpen(false)
    setSelectedProvider(null)
    setSelectedModel('')
    setProviderApiKey('')
  }

  const handleAddProvider = async () => {
    if (!selectedModel || !providerApiKey) {
      alert('Please select a model and enter an API key')
      return
    }

    setAddingProvider(true)
    try {
      const result = await llmConfig.setConfig({
        modelType: 'remote',
        modelName: selectedModel,
        apiKey: providerApiKey,
        setAsActive: false,
        authType: 'none'
      })

      if (result.success) {
        console.log(`[LLMSettings] Successfully added ${selectedModel}`)
        await loadLLMConfigs()
        handleCloseProviderDialog()
      } else {
        alert(`Failed to add provider: ${result.error}`)
      }
    } catch (error) {
      console.error('[LLMSettings] Failed to add provider:', error)
      alert(`Failed to add provider: ${(error as Error).message}`)
    } finally {
      setAddingProvider(false)
    }
  }

  const startChatWithModel = async (llmConfig: LLMConfig) => {
    if (!initialized) {
      alert('System not initialized. Please wait and try again.')
      return
    }

    setCreatingChat(llmConfig.id)
    try {
      // Get the AI contact for this model
      const aiContactsResponse = await aiAssistant.getAIContacts()
      if (!aiContactsResponse.success || !aiContactsResponse.contacts) {
        throw new Error('Failed to get AI contacts')
      }

      // Find the AI contact that matches this model
      const aiContact = aiContactsResponse.contacts.find(
        (contact: any) => contact.modelId === llmConfig.modelId || contact.modelName === llmConfig.modelName
      )

      if (!aiContact) {
        throw new Error(`No AI contact found for model: ${llmConfig.modelName}`)
      }

      // Create a conversation with this AI contact
      const response = await chat.createConversation({
        name: `Chat with ${llmConfig.modelName}`,
        participants: [aiContact.personId],
        type: 'direct'
      })

      if (response.success && response.data) {
        console.log('[LLMSettings] Created conversation:', response.data.id)
        // Navigate to the new chat
        if (navigate) {
          navigate(`/chat/${response.data.id}`)
        }
      } else {
        throw new Error(response.error || 'Failed to create conversation')
      }
    } catch (error) {
      console.error('[LLMSettings] Failed to start chat:', error)
      alert(`Failed to start chat: ${(error as Error).message}`)
    } finally {
      setCreatingChat(null)
    }
  }

  // Categorize LLM configs
  const localModels = llmConfigs.filter(llm => isLocalProvider(llm.provider))
  const cloudModels = llmConfigs.filter(llm => isCloudProvider(llm.provider))

  const renderLLMCard = (llm: LLMConfig) => (
    <Card className="border">
      <CardContent className="p-4">
        {/* Header with expand/collapse */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleExpand(llm.id)}
        >
          <div className="flex items-center space-x-3">
            <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{llm.modelName || llm.modelId}</span>
                <Badge variant="secondary" className="text-xs">
                  {llm.provider}
                </Badge>
                {llm.active && (
                  <Badge variant="default" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {llm.modelId}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges(llm) && (
              <Badge variant="outline" className="text-xs text-orange-500">
                Unsaved
              </Badge>
            )}
            {expandedLlm === llm.id ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded content with API key and system prompt editor */}
        {expandedLlm === llm.id && (
          <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            {/* API Key input for providers that need it */}
            {needsApiKey(llm.provider) && (
              <div className="p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Key className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <Label htmlFor={`apikey-${llm.id}`} className="text-sm font-medium">
                    API Key
                  </Label>
                  {llm.encryptedApiKey && !editedApiKeys[llm.id] && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      Configured
                    </Badge>
                  )}
                </div>
                <div className="relative mt-2">
                  <Input
                    id={`apikey-${llm.id}`}
                    type={showApiKeys[llm.id] ? "text" : "password"}
                    value={editedApiKeys[llm.id] || ''}
                    onChange={(e) => handleApiKeyEdit(llm.id, e.target.value)}
                    className="font-mono text-sm pr-10"
                    placeholder={llm.encryptedApiKey ? 'Enter new API key to update...' : 'Enter API key...'}
                  />
                  <button
                    type="button"
                    onClick={() => toggleApiKeyVisibility(llm.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showApiKeys[llm.id] ? "Hide API key" : "Show API key"}
                  >
                    {showApiKeys[llm.id] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  API key for {llm.provider}. This will be encrypted and stored securely.
                </p>
                {hasUnsavedApiKey(llm.id) && (
                  <Button
                    size="sm"
                    onClick={() => handleSaveApiKey(llm.id)}
                    disabled={savingApiKey === llm.id}
                    className="mt-2"
                  >
                    {savingApiKey === llm.id ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground mr-1" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        Save API Key
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            <div>
              <Label htmlFor={`prompt-${llm.id}`} className="text-sm font-medium">
                System Prompt
              </Label>
              <Textarea
                id={`prompt-${llm.id}`}
                value={getCurrentPrompt(llm)}
                onChange={(e) => handlePromptEdit(llm.id, e.target.value)}
                className="mt-2 font-mono text-sm min-h-[200px]"
                placeholder="Enter system prompt for this LLM..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                This prompt will be sent to the LLM at the start of each conversation to define its behavior.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegeneratePrompt(llm.id)}
                  disabled={regenerating === llm.id}
                >
                  {regenerating === llm.id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Regenerate Default
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSavePrompt(llm.id)}
                  disabled={!hasUnsavedChanges(llm) || saving === llm.id}
                >
                  {saving === llm.id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground mr-1" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => startChatWithModel(llm)}
                disabled={creatingChat === llm.id}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {creatingChat === llm.id ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Bot className="h-3 w-3 mr-1" />
                    Start Chat
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Created: {new Date(llm.created).toLocaleString()}</p>
              <p>Modified: {new Date(llm.modified).toLocaleString()}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <CardTitle className="text-lg">LLM Configuration</CardTitle>
          </div>
          <CardDescription>Configure AI models and server connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            <span className="text-sm text-muted-foreground">Loading LLM configurations...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <CardTitle className="text-lg">LLM Configuration</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={loadLLMConfigs}>
            <RefreshCw className="h-3 w-3 mr-2" />
            Refresh
          </Button>
        </div>
        <CardDescription>Configure AI models and server connections</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section 1: Detected Local Models */}
        {localModels.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold">Detected Local Models</h3>
              <Badge variant="outline" className="text-xs">{localModels.length}</Badge>
            </div>
            <div className="space-y-2">
              {localModels.map(llm => <React.Fragment key={llm.id}>{renderLLMCard(llm)}</React.Fragment>)}
            </div>
          </div>
        )}

        {localModels.length > 0 && <Separator />}

        {/* Section 2: Server Configuration */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Brain className="h-4 w-4 text-green-600 dark:text-green-400" />
            <h3 className="text-sm font-semibold">Local Server Configuration</h3>
          </div>

          {/* Ollama Configuration */}
          <Card className="border-2 border-dashed">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">OL</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Ollama Server</p>
                    <p className="text-xs text-muted-foreground">Open-source local LLM server</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ollama-url" className="text-xs">Server URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="ollama-url"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testOllamaConnection}
                    disabled={testingOllama}
                  >
                    {testingOllama ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
                        Testing...
                      </>
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>

                {ollamaStatus && (
                  <Alert variant={ollamaStatus.success ? 'default' : 'destructive'}>
                    <AlertDescription className="text-xs">
                      {ollamaStatus.message}
                    </AlertDescription>
                  </Alert>
                )}

                {ollamaModels.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Available Models ({ollamaModels.length})</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {ollamaModels.map((modelObj) => {
                        const modelName = modelObj.name || modelObj.model || modelObj
                        const isRegistered = isModelRegistered(modelName)
                        return (
                          <div key={modelName} className="flex items-center justify-between p-2 border rounded bg-muted/50">
                            <div className="flex-1">
                              <p className="text-xs font-medium">{modelName}</p>
                              {modelObj.size && (
                                <p className="text-xs text-muted-foreground">
                                  Size: {(modelObj.size / 1e9).toFixed(2)} GB
                                </p>
                              )}
                            </div>
                            {isRegistered ? (
                              <Badge variant="outline" className="text-xs">Registered</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => registerModel(modelName, 'ollama', ollamaBaseUrl)}
                                disabled={registeringModel === modelName}
                                className="text-xs"
                              >
                                {registeringModel === modelName ? 'Adding...' : 'Add'}
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline">ollama.ai</a>
                  {' '}• Configure OLLAMA_ORIGINS for browser access
                </p>
              </div>
            </CardContent>
          </Card>

          {/* LM Studio Configuration */}
          <Card className="border-2 border-dashed">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">LM</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">LM Studio</p>
                    <p className="text-xs text-muted-foreground">Desktop app for running local LLMs</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lmstudio-url" className="text-xs">Server URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="lmstudio-url"
                    value={lmstudioBaseUrl}
                    onChange={(e) => setLmstudioBaseUrl(e.target.value)}
                    placeholder="http://localhost:1234"
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testLMStudioConnection}
                    disabled={testingLMStudio}
                  >
                    {testingLMStudio ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
                        Testing...
                      </>
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>

                {lmstudioStatus && (
                  <Alert variant={lmstudioStatus.success ? 'default' : 'destructive'}>
                    <AlertDescription className="text-xs">
                      {lmstudioStatus.message}
                    </AlertDescription>
                  </Alert>
                )}

                {lmstudioModels.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Available Models ({lmstudioModels.length})</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {lmstudioModels.map((modelObj) => {
                        const modelName = modelObj.id || modelObj.name || modelObj.model || modelObj
                        const isRegistered = isModelRegistered(modelName)
                        return (
                          <div key={modelName} className="flex items-center justify-between p-2 border rounded bg-muted/50">
                            <div className="flex-1">
                              <p className="text-xs font-medium">{modelName}</p>
                              {modelObj.owned_by && (
                                <p className="text-xs text-muted-foreground">
                                  Owner: {modelObj.owned_by}
                                </p>
                              )}
                            </div>
                            {isRegistered ? (
                              <Badge variant="outline" className="text-xs">Registered</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => registerModel(modelName, 'lmstudio', lmstudioBaseUrl)}
                                disabled={registeringModel === modelName}
                                className="text-xs"
                              >
                                {registeringModel === modelName ? 'Adding...' : 'Add'}
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Download LM Studio from <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" className="underline">lmstudio.ai</a>
                  {' '}• Enable local server in settings
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Section 3: Cloud API Models */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold">Cloud API Models</h3>
              <Badge variant="outline" className="text-xs">{cloudModels.length}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddProvider(!showAddProvider)}
              className="text-xs"
            >
              {showAddProvider ? (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Hide Providers
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Provider
                </>
              )}
            </Button>
          </div>

          {/* Add Provider Section (Expandable) */}
          {showAddProvider && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Select a cloud provider to add AI models:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cloudProviders.map((provider) => (
                  <Card key={provider.id} className="border-2 border-dashed hover:border-solid hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="text-3xl">{provider.icon}</div>
                          <div>
                            <h4 className="text-sm font-semibold">{provider.name}</h4>
                            <p className="text-xs text-muted-foreground">{provider.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <a
                          href={provider.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Get API Key
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                        <Button
                          size="sm"
                          onClick={() => handleOpenProviderDialog(provider.id)}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Existing Cloud Models */}
          {cloudModels.length > 0 && (
            <div className="space-y-2">
              {cloudModels.map(llm => <React.Fragment key={llm.id}>{renderLLMCard(llm)}</React.Fragment>)}
            </div>
          )}

          {cloudModels.length === 0 && !showAddProvider && (
            <Alert>
              <Brain className="h-4 w-4" />
              <AlertDescription>
                No cloud API models configured. Click "Add Provider" above to configure cloud models.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>

      {/* Add Provider Dialog */}
      <Dialog open={addProviderDialogOpen} onOpenChange={setAddProviderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {selectedProvider && cloudProviders.find(p => p.id === selectedProvider)?.name} Model
            </DialogTitle>
            <DialogDescription>
              Configure your API key and select a model to add.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model-select">Model</Label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selectedProvider &&
                  cloudProviders
                    .find(p => p.id === selectedProvider)
                    ?.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
              </select>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="api-key">
                {selectedProvider && cloudProviders.find(p => p.id === selectedProvider)?.apiKeyLabel}
              </Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type="password"
                  value={providerApiKey}
                  onChange={(e) => setProviderApiKey(e.target.value)}
                  placeholder={selectedProvider && cloudProviders.find(p => p.id === selectedProvider)?.apiKeyPlaceholder}
                  className="font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your API key will be encrypted and stored securely. Get your API key from{' '}
                {selectedProvider && (
                  <a
                    href={cloudProviders.find(p => p.id === selectedProvider)?.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    {cloudProviders.find(p => p.id === selectedProvider)?.name}
                  </a>
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseProviderDialog} disabled={addingProvider}>
              Cancel
            </Button>
            <Button onClick={handleAddProvider} disabled={addingProvider || !selectedModel || !providerApiKey}>
              {addingProvider ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-2" />
                  Add Model
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
