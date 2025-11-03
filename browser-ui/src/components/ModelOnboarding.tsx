import { useState, useEffect, useCallback } from 'react'
import { Button } from '@lama/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lama/ui'
import { Progress } from '@lama/ui'
import { Checkbox } from '@lama/ui'
import { Input } from '@lama/ui'
import { Label } from '@lama/ui'
import { Download, Cpu, Zap, Check, Loader2, Server, AlertTriangle, Key, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react'
import type Model from '@/model/Model.js'
import { getLocalOllamaModels, parseOllamaModel, type OllamaModelInfo } from '@lama/core/services/ollama'
import { DownloadManager, checkModelExists, formatBytes, formatTime, type DownloadProgress } from '@/services/huggingface'

interface ModelOption {
  id: string
  name: string
  size: string
  description: string
  requiresDownload: boolean
  apiKey?: boolean
  provider?: string
}

const MODEL_OPTIONS: ModelOption[] = [
  // Anthropic Models (2025)
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    size: 'Cloud',
    description: 'Best coding model. Strongest for complex agents and computer use.',
    requiresDownload: false,
    apiKey: true,
    provider: 'anthropic'
  },
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    size: 'Cloud',
    description: 'Highest capability. Best for agentic tasks and advanced reasoning.',
    requiresDownload: false,
    apiKey: true,
    provider: 'anthropic'
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    size: 'Cloud',
    description: 'Fast and affordable. Similar coding to Sonnet 4 at 1/3 cost.',
    requiresDownload: false,
    apiKey: true,
    provider: 'anthropic'
  },

  // OpenAI Models (2025)
  {
    id: 'gpt-5',
    name: 'GPT-5',
    size: 'Cloud',
    description: 'OpenAI\'s most powerful reasoning model. Best for complex tasks.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    size: 'Cloud',
    description: 'Latest GPT-4 series. Excellent coding and 1M token context.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    size: 'Cloud',
    description: 'Latest reasoning model. Enhanced reasoning at lower cost.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    size: 'Cloud',
    description: 'Fast and affordable. Outperforms GPT-4o mini.',
    requiresDownload: false,
    apiKey: true,
    provider: 'openai'
  },

  // DeepSeek Models (2025)
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3.2',
    size: 'Cloud',
    description: 'Latest DeepSeek model. 50% cheaper with sparse attention.',
    requiresDownload: false,
    apiKey: true,
    provider: 'deepseek'
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    size: 'Cloud',
    description: 'Advanced reasoning. Excellent for math and complex problems.',
    requiresDownload: false,
    apiKey: true,
    provider: 'deepseek'
  },

  // Qwen Models (2025)
  {
    id: 'qwen-max',
    name: 'Qwen3 Max',
    size: 'Cloud',
    description: 'Latest Qwen flagship. Most capable multilingual model.',
    requiresDownload: false,
    apiKey: true,
    provider: 'qwen'
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    size: 'Cloud',
    description: 'Fast and affordable. Good for general tasks.',
    requiresDownload: false,
    apiKey: true,
    provider: 'qwen'
  },

  // Local Models
  {
    id: 'qwen2.5-coder-32b',
    name: 'Qwen2.5 Coder (32B)',
    size: '~20 GB',
    description: 'Top-tier local code generation. Specialized for programming.',
    requiresDownload: true
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 (70B)',
    size: '~43 GB',
    description: 'Meta\'s latest local model. Powerful general reasoning.',
    requiresDownload: true
  }
]

interface ModelOnboardingProps {
  model: Model;
  onComplete: () => void;
}

export function ModelOnboarding({ model, onComplete }: ModelOnboardingProps) {
  const handleComplete = useCallback(() => {
    // Use setTimeout to ensure this happens after the current render cycle
    setTimeout(() => {
      onComplete()
    }, 0)
  }, [onComplete])

  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [selectedModel, setSelectedModel] = useState<string | null>(null) // Keep for backward compatibility
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState<DownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [selectedApiModel, setSelectedApiModel] = useState<ModelOption | null>(null)
  const [ollamaAvailable, setOllamaAvailable] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([])
  const [showOllamaConsent, setShowOllamaConsent] = useState(false)
  const [loadingOllama, setLoadingOllama] = useState(true)
  const [modelLoadProgress, setModelLoadProgress] = useState<Map<string, number>>(new Map())
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set())
  const [ollamaServerUrl, setOllamaServerUrl] = useState('http://localhost:11434')
  const [showOllamaConfig, setShowOllamaConfig] = useState(false)

  // Check Ollama availability on mount
  useEffect(() => {
    checkOllamaAvailability()
  }, [])
  
  const checkOllamaAvailability = async () => {
    setLoadingOllama(true)
    try {
      // Getting models already checks if Ollama is available (same endpoint)
      const models = await getLocalOllamaModels()
      console.log('[ModelOnboarding] Raw Ollama models:', models)

      if (models.length > 0) {
        const parsedModels = models.map(parseOllamaModel)
        console.log('[ModelOnboarding] Parsed models:', parsedModels)
        setOllamaModels(parsedModels)
        setOllamaAvailable(true)
        console.log(`[ModelOnboarding] Found ${parsedModels.length} Ollama models:`, parsedModels.map(m => m.name))
      } else {
        console.log('[ModelOnboarding] Ollama is running but no models found')
        setOllamaAvailable(false)
      }
    } catch (error) {
      console.log('[ModelOnboarding] Ollama not available:', error)
      setOllamaAvailable(false)
    } finally {
      setLoadingOllama(false)
    }
  }

  const toggleModelSelection = (modelId: string) => {
    const newSelection = new Set(selectedModels)
    if (newSelection.has(modelId)) {
      newSelection.delete(modelId)
    } else {
      newSelection.add(modelId)
    }
    setSelectedModels(newSelection)
  }

  const handleLoadSelectedModels = async () => {
    console.log('[ModelOnboarding] 🚀 handleLoadSelectedModels called, selected models:', selectedModels.size)
    if (selectedModels.size === 0) return

    const modelIds = Array.from(selectedModels)
    console.log('[ModelOnboarding] 🚀 Model IDs to load:', modelIds)

    // Load all selected Ollama models
    for (let i = 0; i < modelIds.length; i++) {
      const modelId = modelIds[i]
      console.log(`[ModelOnboarding] 🚀 Processing model ${i+1}/${modelIds.length}: ${modelId}`)
      const ollamaModel = ollamaModels.find(m => m.id === modelId)
      if (ollamaModel) {
        // Only complete on the last model
        const isLastModel = i === modelIds.length - 1
        console.log(`[ModelOnboarding] 🚀 Calling handleModelReady for ${modelId}, isLast: ${isLastModel}`)
        console.log(`[ModelOnboarding] 🚀 Ollama model details:`, ollamaModel)
        await handleModelReady(modelId, ollamaModel, isLastModel)
      } else {
        console.log(`[ModelOnboarding] ❌ No Ollama model found for ID: ${modelId}`)
      }
    }
  }

  const handleModelSelect = async (modelId: string) => {
    console.log('[ModelOnboarding] ⭐ handleModelSelect called with:', modelId)

    // Check if it's an Ollama model
    if (modelId.startsWith('ollama:')) {
      console.log('[ModelOnboarding] Ollama model detected:', modelId)
      setSelectedModel(modelId)
      setShowOllamaConsent(true)
      return
    }

    const model = MODEL_OPTIONS.find(m => m.id === modelId)
    if (!model) {
      console.log('[ModelOnboarding] ❌ Model not found in OPTIONS:', modelId)
      return
    }

    console.log('[ModelOnboarding] Found model:', model.name, 'requiresDownload:', model.requiresDownload, 'apiKey:', model.apiKey)
    setSelectedModel(modelId)

    // Check if model requires API key
    if (model.apiKey) {
      console.log('[ModelOnboarding] Model requires API key, showing input...')
      setSelectedApiModel(model)
      setShowApiKeyInput(true)
      return
    }

    if (model.requiresDownload) {
      console.log('[ModelOnboarding] Model requires download, checking if it exists locally...')
      // Check if model weights already exist locally
      const exists = await checkModelExists(modelId)
      console.log('[ModelOnboarding] Model exists locally?', exists)

      if (exists) {
        console.log(`[ModelOnboarding] ${model.name} already downloaded, loading...`)
        handleModelReady(modelId)
        return
      }

      // Start real download from HuggingFace
      console.log('[ModelOnboarding] Starting download from HuggingFace...')
      setIsDownloading(true)
      setDownloadError(null)
      setDownloadStatus(null)
      
      try {
        await DownloadManager.startDownload(modelId, (progress: DownloadProgress) => {
          setDownloadProgress(progress.percentage)
          setDownloadStatus(progress)
          
          // Log detailed progress
          const speedMBps = (progress.speed / 1024 / 1024).toFixed(1)
          const eta = formatTime(progress.eta)
          console.log(`[ModelOnboarding] ${model.name}: ${progress.percentage.toFixed(1)}% - ${speedMBps} MB/s - ETA: ${eta}`)
        })
        
        console.log(`[ModelOnboarding] Successfully downloaded ${model.name}`)
        handleDownloadComplete(modelId)
      } catch (error) {
        console.error(`[ModelOnboarding] Download failed for ${model.name}:`, error)
        setDownloadError(error instanceof Error ? error.message : 'Download failed')
        setIsDownloading(false)
        setDownloadProgress(0)
        setDownloadStatus(null)
      }
    } else if (model.apiKey) {
      // For API models, we'd show an API key input
      // For now, just complete
      handleModelReady(modelId)
    }
  }
  
  // Remove the local checkModelExists - we're using the one from huggingface service

  const handleDownloadComplete = async (modelId: string) => {
    setIsDownloading(false)
    await handleModelReady(modelId)
  }

  const handleOllamaConsent = async (accepted: boolean) => {
    setShowOllamaConsent(false)

    if (!accepted || !selectedModel) {
      setSelectedModel(null)
      return
    }

    // Load the Ollama model
    const ollamaModel = ollamaModels.find(m => m.id === selectedModel)
    if (ollamaModel) {
      await handleModelReady(selectedModel, ollamaModel)
    }
  }

  const handleApiKeyConfirm = async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key')
      return
    }

    if (!selectedApiModel) {
      return
    }

    setShowApiKeyInput(false)

    // Save the API key and set the model as active
    await handleModelReady(selectedApiModel.id, undefined, true, apiKey.trim())
  }

  const handleApiKeyCancel = () => {
    setShowApiKeyInput(false)
    setSelectedApiModel(null)
    setSelectedModel(null)
    setApiKey('')
  }

  const handleModelReady = async (modelId: string, ollamaModel?: OllamaModelInfo, shouldComplete: boolean = true, apiKeyValue?: string) => {
    // Model configuration handled by Node.js via IPC
    console.log('[ModelOnboarding] 🎯 handleModelReady called')
    console.log('[ModelOnboarding] 🎯 Model ID:', modelId)
    console.log('[ModelOnboarding] 🎯 Ollama model:', ollamaModel?.displayName || 'none')
    console.log('[ModelOnboarding] 🎯 Should complete:', shouldComplete)
    console.log('[ModelOnboarding] 🎯 Has API key:', !!apiKeyValue)

    // Track loading progress
    setLoadingModels(prev => new Set(prev).add(modelId))
    setModelLoadProgress(prev => new Map(prev).set(modelId, 0))

    // Simulate progress for UI
    setModelLoadProgress(prev => new Map(prev).set(modelId, 50))

    let modelSetSuccessfully = false
    try {
      // Save the selected model as default
      console.log(`[ModelOnboarding] 🎯 Setting ${modelId} as default model`)
      const response = await model.llmConfigHandler.setConfig({
        modelType: apiKeyValue ? 'remote' : 'local',
        modelName: modelId,
        setAsActive: true
      })

      if (response.success) {
        console.log(`[ModelOnboarding] ✅ Successfully set ${modelId} as default model`)

        // If API key was provided, save it now
        if (apiKeyValue && response.configHash) {
          console.log(`[ModelOnboarding] 💾 Saving API key for ${modelId}`)
          const apiKeyResponse = await model.llmConfigHandler.updateApiKey({
            llmId: response.configHash,
            apiKey: apiKeyValue
          })

          if (apiKeyResponse.success) {
            console.log(`[ModelOnboarding] ✅ API key saved successfully`)
          } else {
            console.error('[ModelOnboarding] ❌ Failed to save API key:', apiKeyResponse.error)
          }
        }

        console.log(`[ModelOnboarding] ✅ AI contact created, chats will be created when accessed`)
        modelSetSuccessfully = true
      } else {
        console.error('[ModelOnboarding] ❌ Failed to set default model:', response.error)
      }
    } catch (error) {
      console.error('[ModelOnboarding] ❌ Error setting default model:', error)
    }

    // Complete loading
    setModelLoadProgress(prev => new Map(prev).set(modelId, 100))

    // Wait for loading animation to complete before calling handleComplete
    setTimeout(() => {
      setLoadingModels(prev => {
        const next = new Set(prev)
        next.delete(modelId)

        // If this was the last loading model and we should complete, do so after animation
        // Only complete if the model was set successfully
        if (next.size === 0 && shouldComplete && modelSetSuccessfully) {
          // Complete after a short delay for animation
          setTimeout(() => {
            handleComplete()
          }, 500) // Short delay for animation to complete
        }

        return next
      })
      setModelLoadProgress(prev => {
        const next = new Map(prev)
        next.delete(modelId)
        return next
      })
    }, 1500) // Increased from 1000ms to give more time for the loading animation
  }

  const skipSetup = () => {
    // Allow user to skip model selection and proceed without LLM
    handleComplete()
  }

  return (
    <div className="min-h-screen bg-background p-8 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Welcome to LAMA</h1>
          <p className="text-xl text-muted-foreground">
            Let's set up your AI assistant. Choose a model to get started.
          </p>
        </div>

        {showApiKeyInput ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-blue-500" />
                <span>Enter API Key for {selectedApiModel?.name}</span>
              </CardTitle>
              <CardDescription>
                This cloud API model requires authentication and shares data with {selectedApiModel?.provider}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Privacy & Data Sharing:</p>
                <ul className="text-sm text-amber-900 dark:text-amber-100 space-y-1 ml-4 list-disc">
                  <li>Your conversations will be sent to {selectedApiModel?.provider}'s servers</li>
                  <li>Data is processed according to {selectedApiModel?.provider}'s privacy policy</li>
                  <li>Your messages are not stored locally - they're sent to the cloud</li>
                  <li>You'll be charged by {selectedApiModel?.provider} based on API usage</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
                <p className="text-sm font-semibold">API Key Setup:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  {selectedApiModel?.provider === 'anthropic' && (
                    <li>Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.anthropic.com</a></li>
                  )}
                  {selectedApiModel?.provider === 'openai' && (
                    <li>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com</a></li>
                  )}
                  {selectedApiModel?.provider === 'deepseek' && (
                    <li>Get your API key from <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.deepseek.com</a></li>
                  )}
                  {selectedApiModel?.provider === 'qwen' && (
                    <li>Get your API key from <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Alibaba Cloud Model Studio</a></li>
                  )}
                  <li>Your API key will be encrypted and stored securely on your device</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter your ${selectedApiModel?.provider} API key...`}
                  className="font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApiKeyConfirm()
                    }
                  }}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleApiKeyCancel}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApiKeyConfirm}
                  disabled={!apiKey.trim()}
                >
                  Continue with {selectedApiModel?.name}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : showOllamaConsent ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="h-5 w-5 text-green-500" />
                <span>Use Ollama Model?</span>
              </CardTitle>
              <CardDescription>
                You're about to use a locally running Ollama model
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">Privacy Benefits:</p>
                <ul className="text-sm text-green-900 dark:text-green-100 space-y-1 ml-4 list-disc">
                  <li>The model runs entirely on your local machine via Ollama</li>
                  <li>Your conversations never leave your device</li>
                  <li>No data is sent to external servers</li>
                  <li>Complete privacy and data sovereignty</li>
                </ul>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-semibold">System Requirements:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Performance depends on your hardware capabilities</li>
                  <li>Model responses are generated locally</li>
                  <li>Requires Ollama to be running</li>
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleOllamaConsent(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleOllamaConsent(true)}
                >
                  Accept and Use Model
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !isDownloading ? (
          <>
            {/* Ollama Server Configuration */}
            <div className="mb-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-blue-500" />
                      <CardTitle className="text-lg">Ollama Server Configuration</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowOllamaConfig(!showOllamaConfig)}
                    >
                      {showOllamaConfig ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                  <CardDescription>
                    Configure your Ollama server address (local or remote)
                  </CardDescription>
                </CardHeader>
                {showOllamaConfig && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ollama-url">Ollama Server URL</Label>
                      <Input
                        id="ollama-url"
                        type="text"
                        value={ollamaServerUrl}
                        onChange={(e) => setOllamaServerUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Default: http://localhost:11434 for local Ollama installation
                      </p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg space-y-2">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Required Configuration:</p>
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        Your Ollama server must be configured with CORS to allow requests from this app.
                      </p>
                      <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded font-mono text-xs">
                        <p className="text-blue-900 dark:text-blue-100">OLLAMA_ORIGINS="https://lama.one"</p>
                      </div>
                      <p className="text-xs text-blue-900 dark:text-blue-100">
                        Add this environment variable to your Ollama configuration and restart the server.
                      </p>
                    </div>

                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                      <p className="text-sm text-green-900 dark:text-green-100">
                        <strong>Privacy Notice:</strong> Whether local or remote, your Ollama server processes
                        all data. If using a remote server, ensure you trust the server operator.
                      </p>
                    </div>

                    <Button
                      onClick={checkOllamaAvailability}
                      disabled={loadingOllama}
                      size="sm"
                    >
                      {loadingOllama ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Ollama Models Section */}
            {ollamaAvailable && ollamaModels.length > 0 && (
              <div className="mb-8">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-green-500" />
                    <h2 className="text-xl font-semibold">Available Ollama Models (Local)</h2>
                    <span className="text-sm text-muted-foreground">
                      ({ollamaModels.length} models detected)
                    </span>
                  </div>
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-900 dark:text-green-100">
                      <strong>Privacy Notice:</strong> Ollama models run locally on your machine.
                      Your conversations stay private and never leave your device.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {ollamaModels.map((model) => (
                    <Card 
                      key={model.id}
                      className={`transition-all hover:shadow-lg ${
                        selectedModels.has(model.id) ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedModels.has(model.id)}
                              onCheckedChange={() => toggleModelSelection(model.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-base">{model.displayName}</span>
                          </div>
                          <Check className="h-5 w-5 text-green-500" />
                        </CardTitle>
                        <CardDescription>
                          {model.size} • {model.parameterSize} • Local
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {model.description}
                        </p>
                        
                        {/* Loading progress */}
                        {loadingModels.has(model.id) && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span>Loading model...</span>
                              <span>{modelLoadProgress.get(model.id) || 0}%</span>
                            </div>
                            <Progress value={modelLoadProgress.get(model.id) || 0} className="h-2" />
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {model.capabilities.includes('code') && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Code
                            </span>
                          )}
                          {loadingModels.has(model.id) ? (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              Ready
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Cloud API Models Section */}
            <div className="mb-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Cloud API Models</h2>
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    <strong>Privacy Notice:</strong> These models send your conversations to external providers
                    (Anthropic, OpenAI, DeepSeek, Qwen). Your data will be processed on their servers according
                    to their privacy policies.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {MODEL_OPTIONS.filter(m => m.apiKey).map((model) => (
                  <Card
                    key={model.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedModel === model.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="text-base">{model.name}</span>
                        <Zap className="h-5 w-5 text-blue-500" />
                      </CardTitle>
                      <CardDescription>
                        {model.size} • Cloud API
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {model.description}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Requires API key • Data shared with {model.provider}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Local Download Models Section */}
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Local Models (Privacy Focused)</h2>
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    <strong>Privacy Notice:</strong> These models run entirely on your computer.
                    Your conversations never leave your device and are completely private.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {MODEL_OPTIONS.filter(m => m.requiresDownload).map((model) => (
                  <Card
                    key={model.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedModel === model.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="text-base">{model.name}</span>
                        <Download className="h-5 w-5 text-green-600" />
                      </CardTitle>
                      <CardDescription>
                        {model.size} • Local Download
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {model.description}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        Runs locally • Complete privacy
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        ) : (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Downloading Model</span>
              </CardTitle>
              <CardDescription>
                {downloadError ? 'Download failed - please try again' : 'Downloading from HuggingFace...'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {downloadError ? (
                <div className="text-red-500 text-sm p-4 bg-red-50 rounded-lg">
                  <strong>Error:</strong> {downloadError}
                </div>
              ) : (
                <>
                  <Progress value={downloadProgress} className="w-full" />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>{downloadProgress.toFixed(1)}% complete</span>
                      {downloadStatus && (
                        <span>{formatBytes(downloadStatus.downloaded)} / {formatBytes(downloadStatus.total)}</span>
                      )}
                    </div>
                    {downloadStatus && (
                      <div className="flex justify-between">
                        <span>Speed: {formatBytes(downloadStatus.speed)}/s</span>
                        <span>ETA: {formatTime(downloadStatus.eta)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
              {downloadError && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDownloading(false)
                      setDownloadError(null)
                      setDownloadProgress(0)
                      setSelectedModel(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => selectedModel && handleModelSelect(selectedModel)}
                  >
                    Retry Download
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-4 mt-8">
          {selectedModels.size > 0 && (
            <Button
              onClick={handleLoadSelectedModels}
              disabled={isDownloading || loadingModels.size > 0}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loadingModels.size > 0 ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading {loadingModels.size} Model{loadingModels.size > 1 ? 's' : ''}...
                </>
              ) : (
                `Load ${selectedModels.size} Selected Model${selectedModels.size > 1 ? 's' : ''}`
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={skipSetup}
            disabled={isDownloading}
          >
            Skip for now (add models later)
          </Button>
        </div>
      </div>
    </div>
  )
}