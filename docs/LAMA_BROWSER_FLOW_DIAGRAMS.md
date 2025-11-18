# LAMA Browser AI Contact Flow - Detailed Diagrams

## 1. SUCCESSFUL FLOW (lama.cube/Electron)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SELECTS MODEL                            │
│                (AISettingsView.handleSetDefault)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              model.llmHandler.setDefaultModel()                  │
│         (IPC handler → llm.ts in lama.cube/main)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│   llmConfigPlan.setConfig({                                      │
│     modelType: 'local',                                          │
│     modelName: 'gpt-oss:20b',                                    │
│     setAsActive: true                                            │
│   })                                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│   LLM config stored in ONE.core                                  │
│   (storeVersionedObject, posted to 'lama' channel)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│   aiAssistantModel.setDefaultModel('gpt-oss:20b')                │
│   (LLMConfigPlan line 258)                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│   AIAssistantPlan.setDefaultModel()                              │
│   - topicManager.setDefaultModel('gpt-oss:20b')                 │
│   - settingsPersistence.setDefaultModelId('gpt-oss:20b')        │
│   - createDefaultChats()                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ↓             ↓
        ┌──────────────────┐  ┌──────────────────┐
        │  ensureHiChat    │  │ ensureLamaChat   │
        │  (static welcome)│  │ (LLM welcome)    │
        └────────┬─────────┘  └────────┬─────────┘
                 │                     │
                 ↓                     ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ ensureAIContact  │  │ ensureAIContact  │
        │  for 'gpt-oss:20b'  for 'gpt-oss:20b-  │
        │                 │  │ private'         │
        └────────┬─────────┘  └────────┬─────────┘
                 │                     │
                 ↓                     ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Create AI Person │  │ Create AI Person │
        │ Store in ONE.core│  │ Store in ONE.core│
        │ Register in cache│  │ Register in cache│
        └────────┬─────────┘  └────────┬─────────┘
                 │                     │
                 ↓                     ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Create Topic 'hi'│  │ Create Topic     │
        │ with participants  │ 'lama' with      │
        │ Post static msg  │  │ participants     │
        └──────────────────┘  └────────┬─────────┘
                                       │
                                       ↓
                              ┌──────────────────┐
                              │ onTopicCreated   │
                              │ callback fires   │
                              │ Generate LLM msg │
                              │ Post to topic    │
                              └──────────────────┘
```

## 2. BROKEN FLOW (lama.browser - CURRENT)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SELECTS MODEL                            │
│                (AISettingsView.handleSetDefault)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              model.llmHandler.setDefaultModel()                  │
│                   ❌ PROPERTY DOESN'T EXIST                      │
│                 (Model.ts has no llmHandler)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│   JavaScript Error Caught                                        │
│   TypeError: model.llmHandler is undefined                       │
│   Execution Stops                                                │
│   ❌ No default model set                                        │
│   ❌ No chats created                                            │
│   ❌ No AI contacts created                                      │
│   ❌ No welcome messages                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 3. CONTACT VISIBILITY FLOW (What Prevents AI Contacts from Showing)

```
┌─────────────────────────────────────────────────────────────────┐
│    ContactsPlan.getContacts() called from UI                     │
│    (React components want to show contact list)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│    Get human contacts from leuteModel.others()                   │
│    Result: empty (no human contacts in clean startup)            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│    Loop through someoneObjects                                   │
│    For each: Check if this.nodeOneCore.aiAssistantModel exists   │
│                                                                  │
│    In lama.cube: this.nodeOneCore = NodeOneCore                 │
│    ✅ Has aiAssistantModel with llmObjectManager                │
│    ✅ Can check isLLMPerson(personId)                           │
│    ✅ Can get modelId from getModelIdForPersonId()              │
│                                                                  │
│    In lama.browser: this.nodeOneCore = Model class              │
│    ❌ No aiAssistantModel property                              │
│    ❌ Check at line 104: this.nodeOneCore.aiAssistantModel →    │
│       undefined (optional chaining fails)                        │
│    ❌ AI contact detection skipped                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│    Return contacts array                                         │
│    ❌ AI contacts never added (they don't exist anyway)          │
│    ✅ But even IF they existed, they wouldn't show              │
└──────────────────────────────────────────────────────────────────┘
```

## 4. COMPARISON: Property Access Paths

### lama.cube (WORKS):
```
IPC Handler (main/ipc/handlers/llm.ts)
    │
    └─→ model.llmConfigPlan.setConfig()
        └─→ model.aiAssistantModel.setDefaultModel()
            └─→ model.aiAssistantModel.topicManager.ensureDefaultChats()

ContactsPlan (main/core/plans/contact.ts)
    │
    └─→ nodeOneCore.aiAssistantModel
        └─→ nodeOneCore.aiAssistantModel.llmObjectManager.isLLMPerson()
        └─→ nodeOneCore.aiAssistantModel.getModelIdForPersonId()

nodeOneCore = NodeOneCore instance with full properties
  ✅ Has aiAssistantModel (contains contact manager, llmObjectManager, etc)
```

### lama.browser (BROKEN):
```
AISettingsView.handleSetDefault()
    │
    └─→ model.llmHandler  ❌ DOESN'T EXIST
        └─→ [Would call setDefaultModel()]

ContactsPlan(this) in Model.ts:254
    │
    └─→ this.nodeOneCore.aiAssistantModel  ❌ DOESN'T EXIST
        └─→ [Would call llmObjectManager.isLLMPerson()]

this (Model class) has:
  ✅ aiAssistantPlan (different object - has setDefaultModel method)
  ❌ No aiAssistantModel property
  ❌ No llmHandler property
```

## 5. DATA FLOW: Model Selection → AI Contact Creation → Contact Display

```
IDEAL FLOW:
═══════════════════════════════════════════════════════════════════

User Input
   │
   ↓
[1] Set Default Model
   │
   ├─→ LLM Config stored in ONE.core
   │
   ↓
[2] Trigger Contact Creation
   │
   ├─→ AIContactManager.ensureAIContactForModel()
   │   ├─→ Create Person object (email: "gpt-oss:20b@ai.local")
   │   ├─→ Store in ONE.core
   │   ├─→ Register in _personIdByModelId map
   │   └─→ Register in _modelIdByPersonId map
   │
   ├─→ Return AI Person ID
   │
   ↓
[3] Create Chat Topics
   │
   ├─→ topicGroupManager.createGroupTopic('Hi', 'hi', [userPersonId, aiPersonId])
   │   ├─→ Create Group object with both participants
   │   ├─→ Store in ONE.core
   │   └─→ Create channels for both participants
   │
   ├─→ topicGroupManager.createGroupTopic('LAMA', 'lama', [userPersonId, privateAiPersonId])
   │   ├─→ Create Group with private AI variant
   │   ├─→ Create channels for both participants
   │   └─→ Trigger welcome message generation
   │
   ↓
[4] Display in Contacts
   │
   ├─→ ContactsPlan.getContacts()
   │   ├─→ Get all Someone objects from leuteModel.others()
   │   ├─→ For each, create Contact with isAI=true, modelId set
   │   └─→ Return to UI
   │
   ├─→ React components render contact list
   │   ├─→ Show "Hi" contact (AI model)
   │   ├─→ Show "LAMA" contact (AI model private)
   │   └─→ Show any human contacts
   │
   ↓
[5] Chat with AI
   │
   ├─→ User sends message to "Hi" topic
   │   ├─→ ChatPlan.sendMessage() stores message
   │   ├─→ topicHasLLMParticipant() checks if AI in group
   │   ├─→ AIAssistantPlan.processMessage() generates response
   │   └─→ Response posted to topic
   │
   └─→ User sees conversation


BROKEN FLOW (lama.browser):
═══════════════════════════════════════════════════════════════════

User Input
   │
   ↓
[1] Set Default Model
   │
   ├─→ model.llmHandler.setDefaultModel()  ❌ METHOD DOESN'T EXIST
   │
   └─→ ERROR: Cannot read property 'setDefaultModel' of undefined
       Execution Stops
   
   ❌ [2-5] Never executed
```

## 6. Missing Component Diagram

```
lama.browser/Model.ts Public Interface
════════════════════════════════════════

EXPORTED:
  ✅ one: MultiUser
  ✅ leuteModel: LeuteModel
  ✅ channelManager: ChannelManager
  ✅ topicModel: TopicModel
  ✅ connections: ConnectionsModel
  ✅ aiPlan: AIPlan
  ✅ aiAssistantPlan: AIAssistantPlan          ← Has setDefaultModel()
  ✅ topicAnalysisPlan: TopicAnalysisPlan
  ✅ proposalsPlan: ProposalsPlan
  ✅ keywordDetailPlan: KeywordDetailPlan
  ✅ wordCloudSettingsPlan: WordCloudSettingsPlan
  ✅ llmConfigPlan: LLMConfigPlan              ← Has setConfig()
  ✅ cryptoPlan: CryptoPlan
  ✅ auditPlan: AuditPlan
  ✅ chatPlan: ChatPlan
  ✅ contactsPlan: ContactsPlan
  ✅ exportPlan: ExportPlan
  ✅ feedForwardPlan: FeedForwardPlan
  ✅ connectionPlan: ConnectionPlan
  ✅ topicGroupManager: TopicGroupManager
  ✅ llmManager: LLMManager
  ✅ llmObjectManager: LLMObjectManager
  ✅ ownerId: string | null
  ✅ initialized: boolean
  
MISSING:
  ❌ llmHandler: { setDefaultModel(), getAvailableModels(), ... }
  ❌ aiAssistantModel: { alias for aiAssistantPlan }

WHAT CONTACTS PLAN NEEDS:
  ❌ this.nodeOneCore.aiAssistantModel
  ❌ this.nodeOneCore.aiAssistantModel.llmObjectManager
  ❌ this.nodeOneCore.aiAssistantModel.getModelIdForPersonId()
```

