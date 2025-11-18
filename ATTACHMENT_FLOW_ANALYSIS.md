# IMAGE ATTACHMENT DISPLAY FLOW TRACE

## CRITICAL ISSUE FOUND

**Problem**: Image attachments are NOT being displayed in chat messages.

**Root Cause**: Attachments are being added to `enhancedMessage.attachments` (line 435 in MessageView.tsx), but the `attachmentDescriptors` Map is NEVER being populated with the attachment data when messages are RECEIVED from other sources (like message history or incoming P2P messages).

---

## DATA FLOW ANALYSIS

### 1. SENDING ATTACHMENTS (WORKING)
**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/MessageView.tsx`

**Lines 255-332: handleEnhancedSend()**
```typescript
// Step 1: File upload via EnhancedMessageInput
// Step 2: Store in ONE.core BLOB storage via AttachmentService (line 277)
const result = await attachmentService.storeAttachment(arrayBuffer, {...})

// Step 3: Create MessageAttachment reference with hash (line 287)
const messageAttachment: MessageAttachment = {
  hash: result.hash,
  type: 'blob',
  mimeType: attachment.file.type,
  name: attachment.file.name,
  size: attachment.file.size
}
messageAttachments.push(messageAttachment)

// Step 4: CACHE descriptor for immediate display (line 304)
setAttachmentDescriptors(prev => {
  const newMap = new Map(prev)
  newMap.set(hash, descriptor)  // ← Stores data for display
  return newMap
})

// Step 5: Send message with MessageAttachment references
await onSendMessage(messageContent, messageAttachments)
```

**Result**: Attachments from SENT messages show because descriptors are cached immediately.

---

### 2. RECEIVING ATTACHMENTS (BROKEN)
**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/MessageView.tsx`

**Lines 412-476: Message rendering**
```typescript
messages.map((message) => {
  const enhancedMessage: EnhancedMessageData = {
    id: message.id,
    content: message.content,
    senderId: message.sender,
    senderName: message.senderName,
    timestamp: message.timestamp,
    isOwn: isCurrentUser,
    subjects: subjects,
    trustLevel: 3,
    attachments: message.attachments,  // ← Attachment refs passed
    topicName: message.topicName,
    format: message.format
  }

  // Pass both enhancedMessage AND attachmentDescriptors
  <EnhancedMessageBubble
    message={enhancedMessage}
    onHashtagClick={handleHashtagClick}
    onAttachmentClick={handleAttachmentClick}
    onDownloadAttachment={handleDownloadAttachment}
    theme="dark"
    attachmentDescriptors={attachmentDescriptors}  // ← Empty Map!
  />
})
```

**Problem**: 
- `enhancedMessage.attachments` contains `MessageAttachment[]` objects (just hashes, not data)
- `attachmentDescriptors` Map is only populated when SENDING (line 304)
- **NO CODE** to load attachment descriptors for RECEIVED messages
- When messages arrive from history or P2P, descriptors are never fetched

---

## FLOW DIAGRAM

### Attachment Data Structure Flow:

```
1. SENDING:
   File → AttachmentService.storeAttachment() → MessageAttachment {hash}
           ↓
           Cache descriptor → setAttachmentDescriptors({hash → BlobDescriptor})
           ↓
           Send message with attachments array

2. RECEIVING (BROKEN):
   Message arrives with {attachments: [{hash, name, mimeType, size}]}
           ↓
           EnhancedMessageBubble rendered with attachments array
           ↓
           AttachmentView component tries to display image
           ↓
           Looks for descriptor in attachmentDescriptors Map
           ↓
           Map is EMPTY (never populated)
           ↓
           Line 146-147 in EnhancedMessageBubble.tsx:
              if (attachment.type === 'image' && attachmentDescriptors) {
                const descriptor = attachmentDescriptors.get(attachment.id);
                if (descriptor && descriptor.data) { ← descriptor is undefined
                  // Create blob and set imageUrl
                }
              }
           ↓
           No imageUrl set
           ↓
           Line 80: if (!imageUrl) return null
           ↓
           IMAGE NOT DISPLAYED
```

---

## AFFECTED CODE LOCATIONS

### Component Layer (UI Rendering):
**File**: `/Users/gecko/src/lama/lama.ui/src/components/chat/EnhancedMessageBubble.tsx`

**Lines 143-159: AttachmentView effect hook**
```typescript
React.useEffect(() => {
  if (attachment.type === 'image' && attachmentDescriptors) {
    const descriptor = attachmentDescriptors.get(attachment.id);
    if (descriptor && descriptor.data) {  // ← descriptor is undefined
      const blob = new Blob([descriptor.data], { type: descriptor.type });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    }
  }
}, [attachment, attachmentDescriptors]);
```

**Issue**: Expects `attachmentDescriptors` to be populated, but it's empty for received messages.

**Line 80: Returns nothing if no imageUrl**
```typescript
if (!imageUrl) return null  // ← Silent failure
```

---

### Storage Layer (Attachment Service):
**File**: `/Users/gecko/src/lama/lama.ui/src/services/attachments/AttachmentService.ts`

**Lines 67-98: getAttachment()**
```typescript
async getAttachment(hash: string): Promise<{
  data: ArrayBuffer
  metadata: {...}
}> {
  try {
    const data = await readBlobAsArrayBuffer(hash as any)
    return {
      data,
      metadata: {
        name: 'attachment',      // ← WRONG! Should use stored name
        mimeType: 'application/octet-stream',  // ← WRONG! Should use stored type
        size: data.byteLength
      }
    }
  } catch (error) {
    console.error('[AttachmentService] Failed to get attachment:', error)
    throw error
  }
}
```

**Issues**:
1. ONE.core BLOBs don't store metadata (line 84 comment)
2. Service returns wrong mimeType/name for all attachments
3. No way to preserve original file metadata

---

### Message Container Layer:
**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/MessageView.tsx`

**Lines 90: attachmentDescriptors state**
```typescript
const [attachmentDescriptors, setAttachmentDescriptors] = 
  useState<Map<string, BlobDescriptor>>(new Map())
```

**Issue**: 
- Only updated in handleEnhancedSend (line 304)
- Never updated when messages are loaded from history
- **No effect hook** to load descriptors for received messages

---

## MISSING PIECES

### 1. Missing: Load descriptors when messages arrive
```typescript
// MISSING: Effect hook to load attachment descriptors
useEffect(() => {
  // For each message with attachments:
  // 1. Get attachment hashes from message.attachments
  // 2. Call attachmentService.getAttachment(hash)
  // 3. Store result in attachmentDescriptors Map
  // 4. Handle errors gracefully
}, [messages])  // Re-run when messages change
```

### 2. Missing: Metadata storage with BLOBs
- ONE.core BLOBs only store binary data
- File metadata (name, mimeType) must be stored separately
- Message should include full metadata, not just hash

### 3. Missing: Error boundaries
- ImageAttachmentView silently returns null on error (line 80)
- No user feedback if attachment fails to load
- No retry mechanism

### 4. Missing: Loading states
- No skeleton/placeholder while descriptor is loading
- Users don't know if image is loading or not available

---

## MESSAGE ATTACHMENT STRUCTURE

**What's stored in Message.attachments:**
```typescript
// From MessageAttachment type (types/attachments.ts)
{
  id?: string              // Usually same as hash
  hash: string             // SHA256 hash of BLOB data
  type: 'blob'            // Storage type
  mimeType?: string       // Image/jpeg, etc
  name?: string           // Original filename
  size?: number           // File size in bytes
  thumbnailHash?: string  // Optional
}
```

**What AttachmentView expects in attachmentDescriptors Map:**
```typescript
// From BlobDescriptor type
{
  data: ArrayBuffer       // Raw binary data (MISSING!)
  type: string           // MIME type
  name: string           // Filename
  size: number           // Bytes
  lastModified: number   // Timestamp
}
```

**The Gap**: 
- Message has `hash` but no `data`
- AttachmentView needs `data` to create blob URL
- No code loads `data` from BLOB storage using `hash`

---

## CRITICAL CODE PATHS

### 1. Sending Path (line 270-312):
```
File upload → AttachmentService.storeAttachment()
           → Get back: {hash, status}
           → Create MessageAttachment {hash, type:'blob', mimeType, name, size}
           → Immediately cache: descriptor = {data, type, name, size, lastModified}
           → setAttachmentDescriptors(new Map([...prev, [hash, descriptor]]))
           → Send message with attachment array
           ✓ WORKS: Image appears because descriptor was cached immediately
```

### 2. Receiving Path (BROKEN):
```
Message arrives with: {attachments: [{hash, mimeType, name, size}]}
                   → Rendered in MessageView (line 412-476)
                   → Pass to EnhancedMessageBubble with empty attachmentDescriptors Map
                   → AttachmentView tries: attachmentDescriptors.get(attachment.id)
                   → Returns undefined (Map never populated)
                   → imageUrl never set
                   → Component returns null (line 80)
                   ✗ BROKEN: Image never appears
```

---

## REQUIRED FIXES

### Fix 1: Load descriptors for received messages
**File**: `/Users/gecko/src/lama/lama.browser/browser-ui/src/components/MessageView.tsx`

Add effect hook after line 90:
```typescript
// Load attachment descriptors for received messages
useEffect(() => {
  const loadDescriptors = async () => {
    const descriptorsToLoad: string[] = []
    
    // Collect all attachment hashes from messages
    messages.forEach(msg => {
      if (msg.attachments?.length > 0) {
        msg.attachments.forEach(att => {
          if (att.hash && !attachmentDescriptors.has(att.hash)) {
            descriptorsToLoad.push(att.hash)
          }
        })
      }
    })
    
    // Load missing descriptors
    for (const hash of descriptorsToLoad) {
      try {
        const { data, metadata } = await attachmentService.getAttachment(hash)
        
        // Find the attachment to get correct metadata
        const attachment = messages
          .flatMap(m => m.attachments || [])
          .find(a => a.hash === hash)
        
        const descriptor: BlobDescriptor = {
          data,
          type: attachment?.mimeType || metadata.mimeType,
          name: attachment?.name || metadata.name,
          size: attachment?.size || metadata.size,
          lastModified: Date.now()
        }
        
        setAttachmentDescriptors(prev => {
          const newMap = new Map(prev)
          newMap.set(hash, descriptor)
          return newMap
        })
      } catch (err) {
        console.error(`Failed to load attachment ${hash}:`, err)
      }
    }
  }
  
  if (messages.length > 0) {
    loadDescriptors()
  }
}, [messages])  // Re-load when messages change
```

### Fix 2: Store metadata with messages
**File**: Message creation/storage (wherever messages are created)

Ensure MessageAttachment includes complete metadata:
```typescript
const messageAttachment: MessageAttachment = {
  hash: result.hash,           // BLOB hash
  type: 'blob',
  mimeType: file.type,         // PRESERVE original type
  name: file.name,             // PRESERVE original name
  size: file.size              // PRESERVE original size
  // id defaults to hash
}
```

### Fix 3: Add error handling to ImageAttachmentView
**File**: `/Users/gecko/src/lama/lama.ui/src/components/attachments/ImageAttachmentView.tsx`

Instead of silent `return null` on error:
```typescript
if (error || !imageUrl) {
  return (
    <div className={`text-sm text-red-500 p-2 ${className}`}>
      Failed to load image: {attachment.name || 'Image'}
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  )
}
```

### Fix 4: Add loading state
**File**: `/Users/gecko/src/lama/lama.ui/src/components/attachments/ImageAttachmentView.tsx`

Show spinner while loading:
```typescript
if (loading) {
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">Loading {attachment.name}...</span>
    </div>
  )
}
```

---

## VERIFICATION POINTS

To verify the fix works:

1. **Send image**: Image appears immediately ✓ (already works)
2. **Receive image**: Load messages, check if image appears
3. **Message history**: Load old conversation, check if attachments appear
4. **P2P sync**: Send image in P2P chat, verify it appears on other device
5. **Console logs**: Check for errors in `AttachmentService` or `ImageAttachmentView`

---

## SUMMARY

| Aspect | Status | Location | Issue |
|--------|--------|----------|-------|
| Upload | ✓ WORKS | MessageView.tsx:270-312 | Descriptors cached immediately |
| Storage | ✓ WORKS | AttachmentService | BLOB stored correctly |
| Message ref | ✓ WORKS | MessageAttachment type | Hashes stored in message |
| Display prep | ✓ WORKS | EnhancedMessageBubble | Props passed correctly |
| Descriptor load | ✗ BROKEN | MessageView.tsx | No code to load for received messages |
| Image render | ✗ BROKEN | ImageAttachmentView | Waits for descriptor that never comes |
| Error handling | ✗ MISSING | ImageAttachmentView | Silent null return |
| Metadata storage | ✗ PARTIAL | AttachmentService | BLOBs don't store metadata |

---
