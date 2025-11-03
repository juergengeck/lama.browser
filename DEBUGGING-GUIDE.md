# Chat Rendering Debugging Guide

## Overview

The chat rendering flow in lama.browser follows this path:

1. **Login** → Instance created → Model.init() → Handlers ready
2. **Topics Loading** → ChatHandler.getConversations() → Display in sidebar
3. **Messages Loading** → ChatHandler.getMessages() → Display in MessageView
4. **Real-time Updates** → ChannelManager.onUpdated → Refresh messages

## Quick Diagnostics

### Step 1: Expose Model for Debugging

The model is automatically exposed on `window.__model` in dev mode.

Check if it's available:
```javascript
console.log(window.__model)
```

If not available, add this to `main.tsx` after line 64:
```javascript
(window as any).__model = model;
```

### Step 2: Run Diagnostic Script

1. Open the file `/browser-ui/public/debug-chat-flow.js`
2. Copy the entire contents
3. Paste into browser console (F12)
4. Review the output for errors

The script will check:
- Model initialization
- Topics existence
- Messages retrieval (via TopicRoom and ChatHandler)
- Channel existence
- Participant data

### Step 3: Manual Checks

```javascript
// Check if model is initialized
__model.initialized  // Should be true after login

// Check owner ID
__model.ownerId  // Should be a hash string

// Check topics
await __model.topicModel.topics.all()

// Check messages for a topic
const topicId = 'your-topic-id-here'
const room = await __model.topicModel.enterTopicRoom(topicId)
const messages = await room.retrieveAllMessages()
console.log(messages)

// Check ChatHandler
const response = await __model.chatHandler.getMessages({ conversationId: topicId })
console.log(response)

// Check channels
const channels = await __model.channelManager.getMatchingChannelInfos(topicId, null)
console.log(channels)
```

## Common Issues

### Issue 1: "Model not initialized"

**Symptom**: `__model.initialized === false`

**Cause**: User hasn't logged in, or Model.init() failed

**Fix**:
1. Log in via the UI
2. Check console for errors during Model.init()
3. Verify `onLogin` event fired: Look for `[Model] ===== LOGIN EVENT: Initializing models =====`

---

### Issue 2: "No topics found"

**Symptom**: `await __model.topicModel.topics.all()` returns `[]`

**Cause**: No topics have been created

**Fix**:
1. Create a topic via the UI (New Chat button)
2. Check if topic creation succeeded:
   ```javascript
   await __model.chatHandler.createConversation({
     name: 'Test Chat',
     participants: [__model.ownerId],
     type: 'group'
   })
   ```

---

### Issue 3: "Topics show but no participants"

**Symptom**: Conversations appear in sidebar but participant count is 0

**Cause**: `topicGroupManager.getGroupForTopic()` returns null

**Debug**:
```javascript
const topicId = 'your-topic-id-here'
const groupIdHash = await __model.topicGroupManager.getGroupForTopic(topicId)
console.log('Group:', groupIdHash)

// If null, group wasn't created or IdAccess is missing
```

**Fix**:
- Topics should be created via `topicGroupManager.createGroupTopic()` (not manually)
- Check if Groups exist in IndexedDB (Application → Storage → IndexedDB → lama.browser.storage)

---

### Issue 4: "No messages show up"

**Symptom**: Messages exist but UI shows "No messages yet"

**Cause**: Multiple possible causes

**Debug**:
```javascript
const topicId = 'your-topic-id-here'

// Method 1: Direct query
const room = await __model.topicModel.enterTopicRoom(topicId)
const messages = await room.retrieveAllMessages()
console.log('Direct query:', messages.length, 'messages')

// Method 2: ChatHandler
const response = await __model.chatHandler.getMessages({ conversationId: topicId })
console.log('ChatHandler:', response.messages?.length, 'messages')

// If Method 1 has messages but Method 2 doesn't, ChatHandler mapping is broken
// If both are empty, messages aren't being stored
```

**Fix**:
1. **If messages aren't being stored**: Check sendMessage flow
   ```javascript
   // Send a test message
   await __model.chatHandler.sendMessage({
     conversationId: topicId,
     content: 'Test message'
   })
   ```

2. **If messages exist but aren't formatted**: Check ChatHandler.getMessages() mapping logic
   - Look for errors in console during message formatting
   - Check if `msg.data.text` or `msg.text` exists

---

### Issue 5: "Channel updates don't refresh UI"

**Symptom**: Messages sent but UI doesn't update until manual refresh

**Cause**: Channel listener not attached or not firing

**Debug**:
```javascript
// Check if channels exist for topic
const channels = await __model.channelManager.getMatchingChannelInfos(topicId, null)
console.log('Channels:', channels)

// Add a test listener
const unsubscribe = __model.channelManager.onUpdated((channelInfoIdHash, channelId, channelOwner, time, data) => {
  console.log('Channel update:', channelId, data)
})

// Send a message and check if listener fires
```

**Fix**:
1. Ensure `useMessages` hook is attaching the listener (line 168-191)
2. Check if `channelId === topicId` condition is matching
3. Verify `refreshMessages()` is called when listener fires

---

### Issue 6: "Sender names are 'Unknown'"

**Symptom**: Messages show but all senders are "Unknown"

**Cause**: `leuteModel.others()` hasn't loaded contacts

**Debug**:
```javascript
const me = await __model.leuteModel.me()
console.log('Me:', me)

const others = await __model.leuteModel.others()
console.log('Others:', others.length, 'contacts')
```

**Fix**:
- Wait for leuteModel to initialize fully
- Check if contacts exist: `await __model.contactsHandler.getContacts()`

---

## Full Trace Documentation

See `CHAT-RENDERING-TRACE.md` for a complete trace of the entire flow from login to message display.

---

## React DevTools

1. Install React DevTools extension
2. Open DevTools → Components tab
3. Find components:
   - `ChatLayout` - Check `topics` prop
   - `ChatView` - Check `messages` prop
   - `useTopics` hook - Check `topics`, `isLoading` state
   - `useMessages` hook - Check `messages`, `isLoading` state

---

## IndexedDB Inspection

1. Open DevTools → Application tab
2. Navigate to Storage → IndexedDB → `lama.browser.storage`
3. Check object stores:
   - `objects` - Contains all ONE objects (Topics, Messages, Groups, etc.)
   - `vheads` - Version heads for versioned objects
   - Look for objects with `$type$: 'Topic'`, `$type$: 'Message'`, etc.

---

## Console Log Patterns

Watch for these log patterns during normal operation:

### Login sequence:
```
[Model] ===== LOGIN EVENT: Initializing models (Instance created) =====
[Model] 🔍 PERSISTENCE DEBUG: Owner context now available
[Model] Initialized handlers: aiAssistantModel, chatHandler, ...
[Model] ✅ Model initialization complete
[App] ===== LOGIN EVENT: Auth state updated (Model.init() starting) =====
[useTopics] Model initialized - refreshing topics
```

### Topic loading:
```
[ChatHandler] Get conversations
[ChatHandler] Retrieved N topics: [...]
[ChatHandler] Returning N conversations: [...]
[useTopics] 🔍 ChatHandler response: { success: true, dataLength: N }
```

### Message loading:
```
[useMessages] Setting up channel listener for topic <topicId>
[ChatHandler] Send message: { conversationId, content }
[ChatHandler] 🤖 Triggering AI response for topic: <topicId>
```

---

## Next Steps

1. Run the diagnostic script
2. Check for errors in console
3. Verify IndexedDB contains expected data
4. Use React DevTools to inspect hook states
5. Report findings with specific error messages

