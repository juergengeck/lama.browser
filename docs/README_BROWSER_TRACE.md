# LAMA Browser AI Contact Trace - Complete Analysis

Three detailed documents have been created to help debug why AI contacts don't appear after model selection on clean startup.

## Documents

### 1. LAMA_BROWSER_TRACE_ANALYSIS.md
**Complete flow trace with root cause analysis**

Shows:
- Where each flow breaks and why
- Side-by-side comparison of working (lama.cube) vs broken (lama.browser) flows
- Exact line numbers for all issues
- What each component is supposed to do vs what it actually does
- Missing properties and method signatures

**Use this when**: You need to understand the complete picture of how contact creation should work

---

### 2. LAMA_BROWSER_FLOW_DIAGRAMS.md
**Visual flow diagrams showing successful vs broken paths**

Shows:
- Success flow in lama.cube (Electron) - diagram showing all steps working
- Broken flow in lama.browser - where it stops
- Contact visibility flow - why AI contacts don't appear even if created
- Property access paths - what's available vs missing
- Complete data flow - from user selection to contact display

**Use this when**: You want a visual understanding or need to explain to others

---

### 3. DEBUGGING_GUIDE.md
**Step-by-step debugging and fix instructions**

Shows:
- The three main issues explained simply
- Exact errors you'll see and where
- Console log checklist (what to look for)
- Step-by-step fix instructions with code snippets
- How to test each fix

**Use this when**: You're actually implementing the fix or debugging in the browser

---

## Quick Summary of Issues

### Issue 1: Missing `llmHandler` on Model
- **Where**: AISettingsView.tsx line 84
- **Error**: `Cannot read property 'setDefaultModel' of undefined`
- **Fix**: Add `llmHandler` property to Model.ts with delegation to `llmConfigPlan`

### Issue 2: Missing `aiAssistantModel` Property
- **Where**: ContactsPlan.ts line 104 (silent failure)
- **Impact**: AI contacts never appear in contact list
- **Fix**: Add getter alias `get aiAssistantModel()` that returns `aiAssistantPlan`

### Issue 3: Wrong Parameters to setConfig()
- **Where**: Model.ts init() line 550
- **Problem**: Passing `{ defaultModelId }` but expecting `{ modelType, modelName, setAsActive }`
- **Fix**: Pass correct parameters when calling setConfig()

---

## How to Read These Documents

### If you just need the facts:
1. Start with DEBUGGING_GUIDE.md for the quick 3-issue summary
2. Jump to relevant section for your specific problem
3. Look at console log examples to identify which issue you have

### If you need to understand the architecture:
1. Read LAMA_BROWSER_TRACE_ANALYSIS.md "Flow #1" through "Flow #5"
2. Understand the difference between lama.cube (working) vs lama.browser (broken)
3. See section "Missing Initialization Links" for summary

### If you're implementing the fix:
1. Look at DEBUGGING_GUIDE.md "Testing the Fix" section
2. Follow the 4 steps with code snippets
3. Use console log checklist to verify each step
4. Check related documentation for additional context

### If you need to present findings:
1. Use LAMA_BROWSER_FLOW_DIAGRAMS.md diagrams
2. Show "Broken Flow (lama.browser)" diagram first
3. Compare to "Successful Flow (lama.cube)" diagram
4. Reference summary table from trace analysis

---

## Files to Modify

All changes are in ONE file:
- `/Users/gecko/src/lama/lama.browser/browser-ui/src/model/Model.ts`

Three specific changes needed:
1. Add `llmHandler` public property (after line 777)
2. Add `aiAssistantModel` getter alias (after line 754)
3. Fix `setConfig()` call parameters (around line 550)

See DEBUGGING_GUIDE.md "Testing the Fix" for exact code.

---

## Quick Navigation

### By Document

| Document | Purpose | Key Sections |
|----------|---------|--------------|
| TRACE_ANALYSIS | Root causes | Flow #1-5, Missing Links, Summary Table |
| FLOW_DIAGRAMS | Visual understanding | Diagrams 1-6, Success vs Broken |
| DEBUGGING_GUIDE | Implementation | Quick Start, Issues 1-3, Testing |

### By Issue

| Issue | TRACE | DIAGRAMS | DEBUG |
|-------|-------|----------|-------|
| Missing llmHandler | Flow #1 | Diagram 4,5 | Issue #1 |
| Missing aiAssistantModel | Flow #4 | Diagram 3,4 | Issue #2 |
| Wrong setConfig() params | Flow #2,3 | Diagram 1,2 | Issue #3 |

### By Scenario

| Scenario | Start With | Then |
|----------|-----------|------|
| "Something's broken, help!" | DEBUGGING_GUIDE | Look at Issue #1-3 |
| "Show me what's wrong" | FLOW_DIAGRAMS | Show "Broken Flow" diagram |
| "I need to explain this" | TRACE_ANALYSIS | Reference summary table + DIAGRAMS |
| "I'm fixing it now" | DEBUGGING_GUIDE | Go to "Testing the Fix" |

---

## Console Commands for Quick Testing

Once issues are fixed, verify with:

```javascript
// In browser console after login
const model = await window.getModel?.();

// Check Issue #1 fix
console.log('✓ llmHandler exists:', !!model?.llmHandler);
console.log('✓ Can call setDefaultModel:', typeof model?.llmHandler?.setDefaultModel);

// Check Issue #2 fix
console.log('✓ aiAssistantModel exists:', !!model?.aiAssistantModel);
console.log('✓ Same as aiAssistantPlan:', model?.aiAssistantModel === model?.aiAssistantPlan);

// Check Issue #3 fix (once model is selected)
console.log('✓ Default model set:', model?.aiAssistantPlan?.topicManager?.getDefaultModel());

// Check all three together
const issues = {
  llmHandler: !!model?.llmHandler,
  aiAssistantModel: !!model?.aiAssistantModel,
  defaultModel: !!model?.aiAssistantPlan?.topicManager?.getDefaultModel()
};
console.log('Issue Status:', issues);
```

---

## Document Generation Info

These documents were generated by analyzing:
- Model.ts (lama.browser main model class)
- AISettingsView.tsx (where model selection UI happens)
- LLMConfigPlan.ts (where config is saved)
- AIAssistantPlan.ts (where contacts are created)
- AITopicManager.ts (where chats are created)
- ContactsPlan.ts (where contacts are listed)
- AIContactManager.ts (where AI Person objects are created)

Total analysis: 2,500+ lines of code across 8 files
Issues identified: 3 critical, all in 1 file (Model.ts)

---

## References in Code

### Model.ts references
- Line 238-241: LLMConfigPlan construction
- Line 214-235: AIAssistantPlan construction
- Line 254: ContactsPlan construction (passes `this`)
- Line 549-552: init() call to setConfig with wrong params
- Line 783: sendMessageWithAI() that depends on llmHandler/aiAssistantModel working

### AISettingsView.tsx references
- Line 84: Calls `model.llmHandler.setDefaultModel()` - expects this property

### ContactsPlan.ts references
- Line 104-109: Accesses `nodeOneCore.aiAssistantModel` - doesn't exist in browser

### LLMConfigPlan.ts references
- Line 152: SetOllamaConfigRequest interface definition
- Line 256-261: Calls aiAssistantModel.setDefaultModel() after storage

