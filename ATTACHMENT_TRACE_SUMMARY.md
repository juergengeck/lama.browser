# CHAT ATTACHMENT FLOW - COMPLETE TRACE

## EXECUTIVE SUMMARY

Image attachments in chat are **not being displayed** because the system doesn't load attachment data when receiving messages from other sources (history, P2P sync, etc.). Attachments work when SENDING because descriptors are cached immediately, but when RECEIVING, the `attachmentDescriptors` Map is never populated with the actual image data.

---

## KEY COMPONENT FILES

### 1. MESSAGE ENTRY POINT
**Path**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/MessageView.tsx`

| Line Range | Function | Purpose |
|-----------|----------|---------|
| 44-76 | Props definition | Message data structure with `Message.attachments` |
| 89-90 | State setup | `attachmentDescriptors` Map initialized (empty) |
| 136-164 | useEffect | Load contact names from Plans |
| 255-332 | `handleEnhancedSend()` | Process uploaded files and cache descriptors |
| 304-308 | Cache logic | **ONLY place** where `attachmentDescriptors` is populated |
| 412-476 | Message rendering | Create `EnhancedMessageData` and render bubbles |
| 435 | Attachment passing | `attachments: message.attachments` passed to bubble |
| 464 | Descriptor passing | `attachmentDescriptors={attachmentDescriptors}` passed (EMPTY!) |

**Critical Gap**: Lines 412-476 pass attachment array to `EnhancedMessageBubble`, but `attachmentDescriptors` Map (line 90) is only updated when sending (line 304), never when receiving.

---

### 2. MESSAGE DISPLAY COMPONENT
**Path**: `/Users/gecko/src/lama/lama.ui/src/components/chat/EnhancedMessageBubble.tsx`

| Line Range | Component | Purpose |
|-----------|-----------|---------|
| 46-55 | `EnhancedMessageData` interface | Message structure including `attachments?` array |
| 65-72 | `EnhancedMessageBubbleProps` | Props including `attachmentDescriptors?: Map` |
| 132-339 | `AttachmentView` component | Renders individual attachments (images, videos, etc) |
| 143-159 | useEffect in AttachmentView | **Attempts to load image from descriptor** |
| 146-147 | Descriptor lookup | `attachmentDescriptors.get(attachment.id)` returns undefined |
| 148-152 | Image creation | Only runs if `descriptor?.data` exists |
| 188-250 | AttachmentView render | HTML bubble display |
| 553-567 | Message content | Renders attachments array if present |

**Critical Issue**: Lines 143-159 wait for descriptor in Map, but Map is never populated for received messages.

---

### 3. IMAGE ATTACHMENT RENDERER
**Path**: `/Users/gecko/src/lama/lama.ui/src/components/attachments/ImageAttachmentView.tsx`

| Line Range | Part | Purpose |
|-----------|------|---------|
| 12-22 | Props | Receives `attachment` (just hash/metadata) and `descriptor?` (data) |
| 23 | Hook call | `useAttachmentDescriptor()` - loads descriptor if not provided |
| 27-39 | useEffect | Create blob URL from descriptor data (lines 31-32) |
| 64-70 | Loading state | Show spinner while descriptor loads |
| 72-78 | Error state | Show error message if descriptor fails |
| 80 | **Silent failure** | `if (!imageUrl) return null` - no display feedback |
| 82-102 | Compact mode | Shows thumbnail + filename |
| 104-121 | Thumbnail mode | Shows small preview |
| 123-218 | Inline mode (default) | Shows full image with overlay controls |

**Critical Issue**: 
1. Line 80: Silent `return null` when image doesn't load
2. Lines 31-32: Need descriptor.data to create blob URL, but:
   - Descriptor is provided from parent's `attachmentDescriptors` Map
   - That Map is never populated for received messages

---

### 4. ATTACHMENT STORAGE SERVICE
**Path**: `/Users/gecko/src/lama/lama.ui/src/services/attachments/AttachmentService.ts`

| Line Range | Method | Purpose |
|-----------|--------|---------|
| 15-62 | `storeAttachment()` | Store file in ONE.core BLOB storage, return hash |
| 41-48 | Storage call | `storeArrayBufferAsBlob(buffer)` → returns `{hash, status}` |
| 67-98 | `getAttachment()` | Retrieve attachment data by hash |
| 77-82 | ONE.core call | `readBlobAsArrayBuffer(hash)` → returns binary data |
| 84-92 | Metadata return | **PROBLEM**: Returns generic metadata, loses original file info |
| 151-159 | `processFile()` | Helper to convert File to attachment |
| 182-196 | `getDataUrl()` | Convert attachment to data URL (used by some components) |

**Critical Issue**: 
1. Line 84 comment: ONE.core BLOBs don't store metadata
2. Lines 86-92: Returns hardcoded metadata instead of original file info
3. `getAttachment()` is never called by MessageView to populate descriptors

---

### 5. ATTACHMENT TYPES & INTERFACES
**Path**: `/Users/gecko/src/lama/lama.ui/src/types/attachments.ts`

| Line Range | Type | Purpose |
|-----------|------|---------|
| 10-21 | `BlobDescriptor` | Actual file data + metadata (used for display) |
| 27-42 | `MessageAttachment` | Reference stored in messages (just hash + metadata) |
| 68-88 | `AttachmentViewProps` | Props for attachment rendering components |
| 173-180 | `getAttachmentType()` | Detect attachment type from MIME type |
| 185-193 | `isPreviewSupported()` | Check if type can be displayed |

**Key Difference**:
- `MessageAttachment`: `{hash, type, mimeType?, name?, size?}` - stored in message
- `BlobDescriptor`: `{data, type, name, size, lastModified}` - needed for display

---

### 6. ATTACHMENT FACTORY & VIEW CREATION
**Path**: `/Users/gecko/src/lama/lama.ui/src/components/attachments/AttachmentViewFactory.tsx`

| Line Range | Function | Purpose |
|-----------|----------|---------|
| 19-56 | `createAttachmentView()` | Select correct component based on MIME type |
| 35-55 | Switch statement | Route to ImageAttachmentView, VideoAttachmentView, etc |
| 123-178 | `useAttachmentDescriptor()` | **Hook to load descriptor if not provided** |
| 145-175 | Descriptor loading logic | Async load from `attachmentService.getAttachment()` |
| 152-155 | Service call | Calls `attachmentService.getAttachment(attachment.hash)` |
| 183-195 | `createAttachmentViews()` | Render multiple attachments for a message |

**Note**: `useAttachmentDescriptor()` hook CAN load descriptors, but it only runs when:
1. Component is mounted, AND
2. No descriptor was provided in props

For received messages, the parent `MessageView` should pre-load descriptors before rendering.

---

## DATA FLOW DIAGRAM

```
SENDING FLOW (WORKS):
═══════════════════════════════════════════════════════════════════════════════
User selects file
    ↓
EnhancedMessageInput.handleFileSelection() [EnhancedMessageInput.tsx:248-297]
    ├─ File → File object stored in state (line 290)
    └─ Show thumbnail preview (line 485-524)

User clicks Send
    ↓
EnhancedMessageInput.handleSend() [EnhancedMessageInput.tsx:353-398]
    ├─ Call onSendMessage(text, attachments) [line 369]
    └─ Pass EnhancedAttachment objects with File objects

MessageView.handleEnhancedSend() [MessageView.tsx:255-332]
    ├─ Get File from attachment.file [line 274]
    ├─ Convert File → ArrayBuffer [line 274]
    ├─ Call attachmentService.storeAttachment(buffer, metadata) [line 277]
    │  └─ ONE.core stores BLOB, returns {hash, status}
    ├─ Create MessageAttachment {hash, type:'blob', mimeType, name, size} [line 287-293]
    ├─ ✓ CACHE descriptor immediately [line 304-308]
    │  └─ setAttachmentDescriptors(new Map([...prev, [hash, descriptor]]))
    ├─ Call onSendMessage(text, messageAttachments) [line 316]
    └─ UI handles descriptors map to display immediately

MessageView message rendering [line 412-476]
    ├─ Create EnhancedMessageData with attachments [line 426-438]
    └─ Pass both message AND attachmentDescriptors to EnhancedMessageBubble [line 458-465]

EnhancedMessageBubble renders
    ├─ AttachmentView receives descriptor in props [line 163-159 useEffect]
    ├─ descriptor.data exists (was cached at send time)
    ├─ Create blob URL: URL.createObjectURL(new Blob([descriptor.data]))
    ├─ Set imageUrl state
    └─ Image displays

RESULT: ✓ IMAGE APPEARS (because descriptor was cached immediately)


RECEIVING FLOW (BROKEN):
═══════════════════════════════════════════════════════════════════════════════
Message arrives with attachments from:
  - Message history load
  - P2P sync from another device
  - Friend sends image

Message object:
{
  id: "msg-123",
  content: "Check this out",
  attachments: [
    {
      hash: "abc123def456...",  // SHA256 of BLOB data
      type: "blob",
      mimeType: "image/jpeg",
      name: "photo.jpg",
      size: 1024000
    }
  ]
}

MessageView receives message in props [line 44-59]
    └─ messages: Message[]

MessageView rendering [line 412-476]
    ├─ For each message:
    ├─ Create EnhancedMessageData
    ├─ attachments: message.attachments [line 435]
    │  └─ Just references: {hash, mimeType, name, size}
    └─ Pass to EnhancedMessageBubble [line 458-465]
       └─ attachmentDescriptors={attachmentDescriptors} [line 464]
          └─ Still empty Map! ✗ NEVER POPULATED FOR RECEIVED MESSAGES

EnhancedMessageBubble.AttachmentView [line 132-339]
    ├─ Receives attachment {hash, mimeType, name, size}
    ├─ Receives attachmentDescriptors Map (empty)
    ├─ useEffect line 146-147:
    │  ├─ descriptor = attachmentDescriptors.get(attachment.id)
    │  ├─ descriptor === undefined (not in Map)
    │  └─ if (descriptor?.data) check fails
    ├─ imageUrl never set
    └─ Line 80: if (!imageUrl) return null
       └─ Silently returns nothing

RESULT: ✗ IMAGE NOT DISPLAYED (no error, no loading state, just nothing)
═══════════════════════════════════════════════════════════════════════════════
```

---

## THE MISSING CODE

**Location**: MessageView.tsx after line 90

**What's missing**: Effect hook to load attachment descriptors when messages arrive

```typescript
// MISSING from MessageView.tsx - add after line 90:
useEffect(() => {
  const loadAttachmentDescriptors = async () => {
    const descriptorsToLoad: string[] = [];
    
    // Collect all attachment hashes that aren't cached
    messages.forEach(msg => {
      if (msg.attachments?.length > 0) {
        msg.attachments.forEach(att => {
          if (att.hash && !attachmentDescriptors.has(att.hash)) {
            descriptorsToLoad.push(att.hash);
          }
        });
      }
    });
    
    // Load missing descriptors
    for (const hash of descriptorsToLoad) {
      try {
        // Find original attachment metadata
        const attachment = messages
          .flatMap(m => m.attachments || [])
          .find(a => a.hash === hash);
        
        // Load BLOB data from storage
        const { data, metadata } = await attachmentService.getAttachment(hash);
        
        // Create descriptor with original metadata
        const descriptor: BlobDescriptor = {
          data,
          type: attachment?.mimeType || metadata.mimeType,
          name: attachment?.name || metadata.name,
          size: attachment?.size || metadata.size,
          lastModified: Date.now()
        };
        
        // Cache for display
        setAttachmentDescriptors(prev => {
          const newMap = new Map(prev);
          newMap.set(hash, descriptor);
          return newMap;
        });
      } catch (err) {
        console.error(`[MessageView] Failed to load attachment ${hash}:`, err);
      }
    }
  };
  
  if (messages.length > 0) {
    loadAttachmentDescriptors();
  }
}, [messages]); // Re-run when messages change
```

---

## VERIFICATION CHECKLIST

- [ ] User sends image with message
  - [ ] Image shows immediately (✓ already works)
  - [ ] Check browser console for errors
  
- [ ] Load message history with images
  - [ ] Images from other messages appear
  - [ ] Check if new effect hook runs
  - [ ] Check attachmentDescriptors Map populates
  
- [ ] Receive P2P message with image
  - [ ] Image appears after sync
  - [ ] Check console for attachment loading logs
  
- [ ] Image error scenarios
  - [ ] Non-existent hash: Shows error instead of null
  - [ ] Corrupted data: Shows error message
  - [ ] Missing metadata: Falls back to generic names
  
- [ ] Performance
  - [ ] Multiple messages load efficiently
  - [ ] Large images don't freeze UI
  - [ ] Scrolling doesn't block on image loading

---

## FILES TO MODIFY

1. **PRIMARY FIX** (Required):
   - `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/MessageView.tsx`
   - Add effect hook to load descriptors for received messages

2. **SECONDARY FIXES** (Recommended):
   - `/Users/gecko/src/lama/lama.ui/src/components/attachments/ImageAttachmentView.tsx`
   - Replace silent `return null` with error message
   - Add loading state while descriptor loads

3. **OPTIONAL IMPROVEMENTS**:
   - Optimize descriptor loading (batch requests, caching)
   - Add retry mechanism for failed loads
   - Implement image compression/lazy loading

---

## SUMMARY TABLE

| Component | Line | Issue | Impact |
|-----------|------|-------|--------|
| MessageView | 90 | attachmentDescriptors initialized empty | No data to display |
| MessageView | 304-308 | Only populated during send | Received messages get no descriptors |
| MessageView | 412-476 | Passes empty Map to bubble | ImageAttachmentView gets undefined |
| EnhancedMessageBubble | 146-147 | Looks up descriptor in empty Map | Returns undefined |
| ImageAttachmentView | 80 | Silent null return on missing data | User sees nothing, no feedback |
| ImageAttachmentView | 27-39 | useEffect waits for descriptor | Never triggers without descriptor |
| AttachmentService | 67-98 | Returns generic metadata | Loses original file info |

---
