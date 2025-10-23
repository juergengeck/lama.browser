/**
 * LLMSettings - LLM Configuration Management
 *
 * Displays all configured LLM objects with system prompt editing and regeneration.
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Brain, ChevronDown, ChevronRight, RefreshCw, Save, Bot } from 'lucide-react'
import { useModel } from '@/model/ModelContext'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LLMConfig {
  id: string
  modelId: string
  modelName: string
  provider: string
  systemPrompt?: string
  active: boolean
  created: number
  modified: number
}

export function LLMSettings() {
  const model = useModel()
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLlm, setExpandedLlm] = useState<string | null>(null)
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)

  useEffect(() => {
    loadLLMConfigs()
  }, [model])

  const loadLLMConfigs = async () => {
    if (!model || !model.initialized) {
      console.log('[LLMSettings] Model not initialized yet')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      // Call getLLMConfigs via llmConfigHandler
      const configs = await model.llmConfigHandler.getAllConfigs()

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
      await model.llmConfigHandler.updateSystemPrompt({
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
      const result = await model.llmConfigHandler.regenerateSystemPrompt({ llmId })

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <CardTitle className="text-lg">LLM Configuration</CardTitle>
          </div>
          <CardDescription>Configure system prompts for AI models</CardDescription>
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
        <CardDescription>Configure system prompts for AI models</CardDescription>
      </CardHeader>
      <CardContent>
        {llmConfigs.length === 0 ? (
          <Alert>
            <Bot className="h-4 w-4" />
            <AlertDescription>
              No LLM configurations found. Add AI models from the Contacts tab to configure them here.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {llmConfigs.map((llm) => (
              <Card key={llm.id} className="border">
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

                  {/* Expanded content with system prompt editor */}
                  {expandedLlm === llm.id && (
                    <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
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

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Created: {new Date(llm.created).toLocaleString()}</p>
                        <p>Modified: {new Date(llm.modified).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
