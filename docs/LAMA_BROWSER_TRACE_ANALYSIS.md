# LAMA Browser AI Contact Flow Trace Analysis

## Executive Summary

**Root Causes Identified**:
1. **Missing AIContacts in Response**: `ContactsPlan.getContacts()` filters AI contacts properly in lama.cube, but lama.browser has a critical issue - it accesses `this.nodeOneCore.aiAssistantModel` which is NOT injected/available
2. **No `llmHandler` in Model class**: The AISettingsView tries to call `model.llmHandler.setDefaultModel()` but this handler doesn't exist in lama.browser Model
3. **Contact Filtering Logic Works But AI Contacts Not Populated**: Even if contacts appear, they won't show up because AI contacts are never created or returned

---

## Flow #1: Model Selection → Contact Creation

### Current Flow in lama.browser

```
User selects model (AISettingsView.handleSetDefault)
  ↓
Calls: model.llmHandler.setDefaultModel({ modelId })
  ↓
⚠️ ERROR: model.llmHandler does NOT exist
  ↓
No contacts created, no topics created
```

### What Exists in lama.browser/Model.ts

```typescript
// Line 238-241 in Model.ts
this.llmConfigPlan = new LLMConfigPlan(this, this.aiAssistantPlan, browserOllamaValidator, browserConfigManager);
(this.aiAssistantPlan as any).llmConfigPlan = this.llmConfigPlan;
```

**Missing**: No `llmHandler` public property on Model class

### What Should Happen (lama.cube pattern)

In Electron, the flow is:
```
llm.ts handler:
  → model.llmConfigPlan.setConfig({ defaultModelId })
  → LLMConfigPlan.setConfig() calls aiAssistantModel.setDefaultModel()
  → Triggers chat creation
```

### Where the Fix is Needed

**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/AISettingsView.tsx` (line 84)

```typescript
const result = await model.llmHandler.setDefaultModel({ modelId })
// ↑ This property doesn't exist
```

**AISettingsView expects**: `model.llmHandler` with method `setDefaultModel()`

But **Model.ts provides**: 
- `model.llmConfigPlan` (LLMConfigPlan instance)
- `model.aiAssistantPlan` (AIAssistantPlan instance)

**The Bridge Already Has It Right** (lama-bridge.ts, line 153-164):
```typescript
async setDefaultModel(modelId: string): Promise<void> {
  const model = getModel()
  const result = await model.llmConfigPlan.setConfig({
    modelType: 'local',
    modelName: modelId,
    setAsActive: true
  })
  // ...
}
```

---

## Flow #2: LLMConfigPlan.setConfig() → AIAssistantPlan.setDefaultModel()

### Current Code in lama.core/LLMConfigPlan.ts (line 256-261)

```typescript
if (request.setAsActive && this.aiAssistantModel) {
  console.log(`[LLMConfigPlan] Setting ${request.modelName} as default model`);
  await this.aiAssistantModel.setDefaultModel(request.modelName);
  console.log(`[LLMConfigPlan] Successfully set ${request.modelName} as default model`);
  // TODO: Implement deactivation of other configs
}
```

**Issue**: Variable is named `this.aiAssistantModel` but constructor receives `aiAssistantPlan`:

```typescript
// Line 108-118 in LLMConfigPlan constructor
constructor(
  nodeOneCore: any,
  aiAssistantModel: any,  // ← Parameter name says "Model" but is actually AIAssistantPlan
  ...
) {
  this.nodeOneCore = nodeOneCore;
  this.aiAssistantModel = aiAssistantModel;  // ← Stored with misleading name
```

**The actual object is**: `AIAssistantPlan` (has `setDefaultModel()` method)

### What LLMConfigPlan.setConfig() Does

```typescript
// lama.core/LLMConfigPlan.ts line 256-261
if (request.setAsActive && this.aiAssistantModel) {
  await this.aiAssistantModel.setDefaultModel(request.modelName);
  // ↓
  // Calls AIAssistantPlan.setDefaultModel() which:
  // 1. Sets topicManager.defaultModelId
  // 2. Persists to settingsPersistence (Electron) or llmConfigPlan (browser)
  // 3. Calls createDefaultChats()
}
```

### Browser Initialization at Line 549-552

```typescript
const savedDefaultModel = this.aiAssistantPlan.topicManager.getDefaultModel();
if (savedDefaultModel) {
  // Validate that saved model still exists
  const availableModels = this.llmManager.getAvailableModels();
  const modelExists = availableModels.some((m: any) => m.id === savedDefaultModel);
  
  if (modelExists) {
    // Call setDefaultModel to trigger chat creation
    await this.llmConfigPlan.setConfig({ defaultModelId: savedDefaultModel });
```

**This calls setConfig with `defaultModelId` but setConfig expects `defaultModelId` parameter - NOT passed correctly!**

---

## Flow #3: Chat Topic Creation

### AIAssistantPlan.setDefaultModel() (lama.core line 424-452)

```typescript
async setDefaultModel(modelId: string): Promise<void> {
  console.log(`[AIAssistantPlan] Setting default model: ${modelId}`);
  
  // Verify model exists
  const models = this.deps.llmManager?.getAvailableModels() || [];
  const model = models.find((m: any) => m.id === modelId);
  
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  
  this.topicManager.setDefaultModel(modelId);
  
  // Persist the model
  if (this.deps.settingsPersistence) {
    await this.deps.settingsPersistence.setDefaultModelId(modelId);
  }
  
  // Create default chats (Hi and LAMA)
  try {
    await this.createDefaultChats();
  } catch (err) {
    console.error('[AIAssistantPlan] ❌ Failed to create default chats:', err);
  }
}
```

### createDefaultChats() Calls ensureDefaultChats()

```typescript
// AITopicManager.ensureDefaultChats() line 161-180
async ensureDefaultChats(
  aiContactManager: any,
  onTopicCreated?: (topicId: string, modelId: string) => Promise<void>
): Promise<void> {
  // Ensures AI contacts exist:
  const aiPersonId = await aiContactManager.ensureAIContactForModel(this.defaultModelId, displayName);
  
  // Creates Hi chat (static welcome)
  await this.ensureHiChat(this.defaultModelId, aiPersonId, onTopicCreated);
  
  // Creates LAMA chat (dynamic welcome via LLM)
  const privateModelId = this.defaultModelId + '-private';
  this.llmManager.registerPrivateVariant(this.defaultModelId);
  const privateAiPersonId = await aiContactManager.ensureAIContactForModel(privateModelId, privateDisplayName);
  await this.ensureLamaChat(privateModelId, privateAiPersonId, onTopicCreated);
}
```

---

## Flow #4: Contact Visibility (Why AI Contacts Don't Show)

### ContactsPlan.getContacts() (chat.core line 66-195)

```typescript
async getContacts(): Promise<GetContactsResponse> {
  const someoneObjects = await this.nodeOneCore.leuteModel.others();
  
  for (const someone of someoneObjects) {
    const personId = await someone.mainIdentity();
    
    // Check if this is an AI contact
    let isAI = false;
    let modelId: string | undefined;
    if (this.nodeOneCore.aiAssistantModel?.llmObjectManager) {  // ← LINE 104
      isAI = this.nodeOneCore.aiAssistantModel.llmObjectManager.isLLMPerson(personId);
      
      if (isAI && this.nodeOneCore.aiAssistantModel) {  // ← LINE 108
        modelId = this.nodeOneCore.aiAssistantModel.getModelIdForPersonId(personId);
      }
    }
    
    // Creates contact object with isAI flag
    allContacts.push({
      id: displayName,
      personId,
      name: displayName,
      isAI,  // ← AI contacts are marked
      modelId,
      canMessage: true,
      isConnected: true
    });
  }
  
  return { success: true, contacts: allContacts };
}
```

### Critical Issue on Line 104-109

**In lama.cube (Electron)**: 
- `this.nodeOneCore` = NodeOneCore (has aiAssistantModel with llmObjectManager)
- Works fine

**In lama.browser**:
- `this.nodeOneCore` = Model class (lama.browser/Model.ts)
- Model HAS `aiAssistantPlan` but doesn't expose `aiAssistantModel`
- Line 104 check: `this.nodeOneCore.aiAssistantModel?.llmObjectManager` → undefined
- **AI contact check is skipped entirely!**

### Where Contacts Come From

**lama.browser/Model.ts line 254**:
```typescript
this.contactsPlan = new ContactsPlan(this);
```

ContactsPlan accesses: `this.nodeOneCore.aiAssistantModel`
But Model.ts doesn't have this property - it has `this.aiAssistantPlan`

---

## Flow #5: AI Contact Creation

### AIContactManager.ensureAIContactForModel() (lama.core/models/ai)

```typescript
async ensureAIContactForModel(modelId: string, displayName: string): Promise<SHA256IdHash<Person>> {
  // 1. Check if AI Person already exists
  const existingPersonId = this.getPersonIdForModel(modelId);
  if (existingPersonId) {
    return existingPersonId;
  }
  
  // 2. Create new AI Person object
  const aiPerson: Person = {
    $type$: 'Person',
    email: `${modelId.replace(/:/g, '_')}@ai.local`,
    name: displayName,
    publicKeys: [] // No actual keys for AI
  };
  
  // 3. Store and register
  const result = await storeVersionedObject(aiPerson);
  this._personIdByModelId.set(modelId, result.idHash);
  this._modelIdByPersonId.set(result.idHash, modelId);
  
  return result.idHash;
}
```

**This requires**:
- leuteModel initialized
- storeVersionedObject available
- Channels created for message syncing

---

## Missing Initialization Links

### In lama.browser Model.ts, Missing Properties

**Line 254 (ContactsPlan construction)**:
```typescript
this.contactsPlan = new ContactsPlan(this);
```

ContactsPlan expects `nodeOneCore` to have:
- `leuteModel` ✅ (available)
- `aiAssistantModel` ❌ (NOT available - has aiAssistantPlan instead)

### In Model.ts, Missing Handler

AISettingsView expects:
```typescript
model.llmHandler.setDefaultModel({ modelId })
model.llmHandler.getAvailableModels()
```

But Model.ts provides:
- `llmConfigPlan` ✅
- `aiAssistantPlan` ✅
- `llmHandler` ❌ (doesn't exist)

---

## Initialization Order Issue

### In Model.ts init() at line 549-568

```typescript
// Check if user has saved default model
const savedDefaultModel = this.aiAssistantPlan.topicManager.getDefaultModel();
if (savedDefaultModel) {
  const availableModels = this.llmManager.getAvailableModels();
  const modelExists = availableModels.some((m: any) => m.id === savedDefaultModel);
  
  if (modelExists) {
    // Call setDefaultModel to trigger chat creation
    await this.llmConfigPlan.setConfig({ defaultModelId: savedDefaultModel });  // ← WRONG PARAMETER NAME
    // ...
  }
}
```

**Issue**: Passing `{ defaultModelId }` but setConfig signature expects:

```typescript
// LLMConfigPlan.setConfig() line 152
async setConfig(request: SetOllamaConfigRequest): Promise<SetOllamaConfigResponse>

interface SetOllamaConfigRequest {
  modelType: 'local' | 'remote';
  baseUrl?: string;
  authType?: 'none' | 'bearer';
  authToken?: string;
  modelName: string;  // ← This is the model ID, not defaultModelId
  setAsActive: boolean;
}
```

Should be:
```typescript
await this.llmConfigPlan.setConfig({ 
  modelType: 'local',
  modelName: savedDefaultModel,
  setAsActive: true 
});
```

---

## Console Logs to Look For During Debugging

When model selection happens, watch for:

```
✅ SUCCESS INDICATORS:
[AISettingsView] Loaded models: [...]
[LLMConfigPlan] Saving config: { modelType: 'local', modelName: 'gpt-oss:20b', setAsActive: true }
[LLMConfigPlan] Stored LLM config with hash: ...
[LLMConfigPlan] Posted LLM config to lama channel
[LLMConfigPlan] Setting gpt-oss:20b as default model
[AIAssistantPlan] Setting default model: gpt-oss:20b
[AIAssistantPlan] Setting default chats...
[AITopicManager] Ensuring Hi chat...
[AITopicManager] ✅ Hi chat created, posting static welcome message
[AITopicManager] Ensuring LAMA chat...
[AITopicManager] ✅ LAMA chat created, triggering LLM welcome message generation

❌ FAILURE INDICATORS (look for in browser console):
[AISettingsView] model.llmHandler.setDefaultModel is not a function
[ContactsPlan] this.nodeOneCore.aiAssistantModel is undefined
[AITopicManager] No default model set - cannot create default chats
[ChatPlan] Topic 'hi' not found in storage
```

---

## Summary of Missing/Broken Links

| Component | Expected | Actual | Impact |
|-----------|----------|--------|--------|
| Model.llmHandler | Public property | Missing | UI can't call setDefaultModel |
| Model.aiAssistantModel | Public alias | Missing | ContactsPlan can't find AI contacts |
| LLMConfigPlan param | modelName | Documentation uses defaultModelId | Chat creation might fail |
| Model.init() param | modelType, modelName, setAsActive | Only defaultModelId passed | setConfig() ignores it |
| ContactsPlan access | this.nodeOneCore.aiAssistantModel | Only has aiAssistantPlan | AI contacts filtered out |

---

## Files That Need Changes

1. **lama.browser/browser-ui/src/model/Model.ts**
   - Add `llmHandler` property that delegates to llmConfigPlan/aiAssistantPlan
   - Add `aiAssistantModel` alias for ContactsPlan compatibility
   - Fix init() to pass correct params to setConfig()

2. **lama.browser/browser-ui/src/components/AISettingsView.tsx**
   - Already correctly uses `model.llmHandler.setDefaultModel()`
   - No changes needed if Model.ts is fixed

3. **lama.core/plans/LLMConfigPlan.ts** (Optional clarity fix)
   - Rename parameter from `aiAssistantModel` to `aiAssistantPlan`
   - Update variable names for clarity

4. **chat.core/plans/ContactsPlan.ts** (Consider compatibility)
   - Could add fallback check for both `aiAssistantModel` and `aiAssistantPlan`

