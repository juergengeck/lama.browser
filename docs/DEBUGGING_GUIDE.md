# Browser AI Contact Debugging Guide

## Quick Start: What's Broken & How to Find It

### The Three Main Issues

1. **No llmHandler on Model class** → AISettingsView.handleSetDefault() crashes
2. **No aiAssistantModel property** → ContactsPlan can't find AI contacts
3. **Wrong params to setConfig()** → Chat creation might fail on init

---

## Issue #1: Missing llmHandler

### Error You'll See
```
Uncaught TypeError: Cannot read properties of undefined (reading 'setDefaultModel')
   at AISettingsView.tsx:84
```

### Where It Breaks
**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/AISettingsView.tsx` (line 84)

```typescript
const result = await model.llmHandler.setDefaultModel({ modelId })
```

### Why It's Broken
Model.ts (line 238-241) creates `llmConfigPlan` and `aiAssistantPlan` but doesn't expose a `llmHandler`:

```typescript
this.llmConfigPlan = new LLMConfigPlan(this, this.aiAssistantPlan, ...);
// Missing:
// this.llmHandler = { setDefaultModel: ... }
```

### What Model.ts Should Have
```typescript
// Add to Model class (line 775-777, after llmManager/llmObjectManager)
public llmHandler = {
  setDefaultModel: async (modelId: string) => {
    const result = await this.llmConfigPlan.setConfig({
      modelType: 'local',
      modelName: modelId,
      setAsActive: true
    });
    if (!result.success) {
      throw new Error(result.error || 'Failed to set default model');
    }
  },
  
  getAvailableModels: async () => {
    return this.llmManager.getAvailableModels();
  }
};
```

### Debug Steps
1. Open browser console (F12)
2. Look for: `[AISettingsView] model.llmHandler is undefined`
3. Check Model.ts for `llmHandler` property - should be exported

---

## Issue #2: Missing aiAssistantModel Property

### Error You'll See
No explicit error - but AI contacts silently don't appear in contact list

### Where It's Silent
**File**: `/Users/gecko/src/lama/chat.core/plans/ContactsPlan.ts` (line 104)

```typescript
if (this.nodeOneCore.aiAssistantModel?.llmObjectManager) {
  // In browser: this.nodeOneCore.aiAssistantModel is undefined
  // So this entire block is skipped
  isAI = this.nodeOneCore.aiAssistantModel.llmObjectManager.isLLMPerson(personId);
}
```

### Why It's Broken
Model.ts (line 254) passes itself as nodeOneCore:

```typescript
this.contactsPlan = new ContactsPlan(this);
//                                   ↑ "this" = Model instance
```

But Model.ts has `aiAssistantPlan`, not `aiAssistantModel`:

```typescript
public aiAssistantPlan: AIAssistantPlan;  // ✅ This exists
public aiAssistantModel: any;             // ❌ This doesn't
```

### What Model.ts Should Have
```typescript
// Add alias to Model class (line 754, after aiAssistantPlan)
// For backward compatibility with ContactsPlan
get aiAssistantModel() {
  return this.aiAssistantPlan;
}
```

### Debug Steps
1. Open browser console
2. In Model.ts init(), add after aiAssistantPlan creation:
   ```typescript
   console.log('[Model] aiAssistantPlan:', this.aiAssistantPlan);
   console.log('[Model] aiAssistantModel alias:', this.aiAssistantModel);
   ```
3. Verify both log the same object
4. In ContactsPlan.getContacts(), add:
   ```typescript
   console.log('[ContactsPlan] nodeOneCore.aiAssistantModel:', this.nodeOneCore.aiAssistantModel);
   ```
5. Should NOT be undefined

---

## Issue #3: Wrong Parameters to setConfig()

### Where It Breaks
**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/model/Model.ts` (line 549-552)

```typescript
// ❌ Wrong - passing defaultModelId
await this.llmConfigPlan.setConfig({ defaultModelId: savedDefaultModel });

// ✅ Should be:
await this.llmConfigPlan.setConfig({
  modelType: 'local',
  modelName: savedDefaultModel,
  setAsActive: true
});
```

### Why It's Broken
LLMConfigPlan.setConfig() expects:

```typescript
// From LLMConfigPlan.ts line 152
interface SetOllamaConfigRequest {
  modelType: 'local' | 'remote';
  baseUrl?: string;
  authType?: 'none' | 'bearer';
  authToken?: string;
  modelName: string;  // ← NOT defaultModelId!
  setAsActive: boolean;
}
```

### Debug Steps
1. Look for: `[LLMConfigPlan] Saving config:` in console
2. Check if it shows:
   - ✅ `modelType: 'local'`
   - ✅ `modelName: 'gpt-oss:20b'`
   - ✅ `setAsActive: true`
3. If you see:
   - ❌ `defaultModelId: 'gpt-oss:20b'`
   - Then this is the issue

---

## Console Log Checklist

### On Clean Startup After Login

#### ✅ Should See (model selection not yet made):
```
[Model] ===== LOGIN EVENT: Initializing models ===
[Model] Initializing AIAssistantPlan...
[AIAssistantPlan] Initializing...
[AIAssistantPlan] Found N available models
[AIAssistantPlan] Loaded 0 existing AI contacts (no saved models yet)
[AIAssistantPlan] No default model set - user will be prompted
[AITopicManager] Scanning existing conversations...
[AITopicManager] SCAN COMPLETE - registered 0 topics
[AIAssistantPlan] ✅ Initialization complete
```

#### ❌ Should NOT See:
```
[AISettingsView] model.llmHandler is undefined
[ContactsPlan] this.nodeOneCore.aiAssistantModel is undefined
[AITopicManager] Failed to ensure Hi chat
[LLMConfigPlan] ONE.core not initialized
```

### When User Selects Model (gpt-oss:20b)

#### ✅ Should See:
```
[AISettingsView] Loaded models: [...]
[AISettingsView] handleSetDefault called with: gpt-oss:20b
[LLMConfigPlan] Saving config: { modelType: 'local', modelName: 'gpt-oss:20b', setAsActive: true }
[LLMConfigPlan] Stored LLM config with hash: abc123...
[LLMConfigPlan] Posted LLM config to lama channel
[LLMConfigPlan] Setting gpt-oss:20b as default model
[AIAssistantPlan] Setting default model: gpt-oss:20b
[AIAssistantPlan] Creating default AI chats...
[AITopicManager] Ensuring Hi chat...
[AIContactManager] Creating AI contact for: gpt-oss:20b
[AIContactManager] Stored AI Person with email: gpt-oss:20b@ai.local
[AIContactManager] ✅ AI contact created/found
[AITopicManager] Creating topic: hi
[AITopicManager] ✅ Hi chat created
[AITopicManager] Ensuring LAMA chat...
[AIContactManager] Creating AI contact for: gpt-oss:20b-private
[AITopicManager] Creating topic: lama
[AITopicManager] ✅ LAMA chat created
[AIAssistantPlan] ✅ Default chats created
[AIAssistantPlan] ✅ Default model set: gpt-oss:20b
```

#### ❌ Should NOT See:
```
TypeError: model.llmHandler.setDefaultModel is not a function
[AIAssistantPlan] No default model set
[AITopicManager] Failed to ensure Hi chat
[AIAssistantPlan] ❌ Failed to create default chats
```

### When Viewing Contacts

#### ✅ Should See:
```
[ContactsPlan] Retrieving contacts...
[ContactsPlan] Found 2 human contacts
[ContactsPlan] Checking AI contacts...
[ContactsPlan] nodeOneCore.aiAssistantModel: [AIAssistantPlan object]
[ContactsPlan] Contact: Hi (isAI: true, modelId: gpt-oss:20b)
[ContactsPlan] Contact: LAMA (isAI: true, modelId: gpt-oss:20b-private)
[ContactsPlan] Returning 4 contacts total
```

#### ❌ Should NOT See:
```
[ContactsPlan] nodeOneCore.aiAssistantModel: undefined
[ContactsPlan] Contact list has 0 AI contacts (should have 2)
```

### When Sending Message to AI Topic

#### ✅ Should See:
```
[ChatPlan] Sending message to topic: hi
[ChatPlan] Message stored successfully
[Model] topicHasLLMParticipant check: hi → true
[AIAssistantPlan] Processing message for topic: hi
[LLMManager] Calling model: gpt-oss:20b
[LLMManager] Got response: "Hello! I'm the Hi contact..."
[ChatPlan] AI response posted successfully
```

#### ❌ Should NOT See:
```
[Model] topicHasLLMParticipant check: hi → false
[AIAssistantPlan] Topic hi not registered as AI topic
[ChatPlan] No LLM participant found - skipping AI response
```

---

## Testing the Fix

### Step 1: Add llmHandler to Model.ts

**Location**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/model/Model.ts` (line ~775)

```typescript
// After llmObjectManager, add:

/**
 * Legacy llmHandler interface for UI compatibility
 */
public llmHandler = {
  setDefaultModel: async (args: { modelId: string }) => {
    const result = await this.llmConfigPlan.setConfig({
      modelType: 'local',
      modelName: args.modelId,
      setAsActive: true
    });
    if (!result.success) {
      throw new Error(result.error || 'Failed to set default model');
    }
    return { success: true };
  },

  getAvailableModels: async () => {
    return {
      success: true,
      data: this.llmManager.getAvailableModels()
    };
  },

  getBestModelForTask: async (args: { task: string }) => {
    const models = this.llmManager.getAvailableModels();
    // Simple heuristic - just return first for now
    return {
      success: true,
      data: models[0] || null
    };
  }
};
```

### Step 2: Add aiAssistantModel alias to Model.ts

**Location**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/model/Model.ts` (line ~754)

```typescript
// After aiAssistantPlan property, add:

/**
 * Alias for backward compatibility with ContactsPlan
 * (ContactsPlan expects nodeOneCore.aiAssistantModel)
 */
get aiAssistantModel() {
  return this.aiAssistantPlan;
}
```

### Step 3: Fix init() setConfig call

**Location**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/model/Model.ts` (line ~550)

```typescript
// Before:
await this.llmConfigPlan.setConfig({ defaultModelId: savedDefaultModel });

// After:
await this.llmConfigPlan.setConfig({
  modelType: 'local',
  modelName: savedDefaultModel,
  setAsActive: true
});
```

### Step 4: Test

1. Clear browser cache
2. Delete IndexedDB databases (LAMA storage)
3. Login with fresh account
4. Go to AI Settings
5. Select a model
6. Watch console for above log messages
7. Check if contacts appear
8. Try sending message - should get AI response

---

## Advanced Debugging

### Add Explicit Logging to Model.ts

```typescript
// In Model.ts init() after constructor set up (line ~268):

// Diagnostic: Check what ContactsPlan will see
console.log('[Model] PUBLIC INTERFACE AUDIT:');
console.log('[Model] - has aiAssistantModel:', !!(this as any).aiAssistantModel);
console.log('[Model] - has aiAssistantPlan:', !!(this as any).aiAssistantPlan);
console.log('[Model] - has llmHandler:', !!(this as any).llmHandler);
console.log('[Model] - has llmConfigPlan:', !!(this as any).llmConfigPlan);
console.log('[Model] - aiAssistantModel === aiAssistantPlan:', 
  (this as any).aiAssistantModel === (this as any).aiAssistantPlan);
```

### Manually Test llmHandler

In browser console:
```javascript
const model = await window.getModel?.();
console.log('llmHandler:', model?.llmHandler);
console.log('aiAssistantModel:', model?.aiAssistantModel);

// Try to call setDefaultModel
await model?.llmHandler?.setDefaultModel?.({ modelId: 'test' });
```

---

## Related Documentation

- See `LAMA_BROWSER_TRACE_ANALYSIS.md` for complete flow trace
- See `LAMA_BROWSER_FLOW_DIAGRAMS.md` for visual diagrams
- See lama.browser/CLAUDE.md for platform architecture
- See lama.core/plans/LLMConfigPlan.ts for setConfig() signature

