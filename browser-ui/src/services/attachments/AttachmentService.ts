/**
 * AttachmentService - Browser implementation using shared chat.core service
 *
 * This is the STORAGE LAYER for browser platform.
 * Uses ONE.core BLOB/CLOB storage directly (IndexedDB) via chat.core's AttachmentService.
 */

import type { IAttachmentService, MessageAttachment, AttachmentMetadata } from '@lama/ui/services/attachments/AttachmentService'
import { AttachmentService as CoreAttachmentService } from '@chat/core/services/AttachmentService.js'
import { storeArrayBufferAsBlob, readBlobAsArrayBuffer, storeUTF8Clob } from '@refinio/one.core/lib/storage-blob.js'
import { createFileReadStream } from '@refinio/one.core/lib/system/storage-streams.js'
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js'

// Create core service with injected ONE.core dependencies
const coreService = new CoreAttachmentService({
  storeArrayBufferAsBlob,
  readBlobAsArrayBuffer,
  storeUTF8Clob,
  createFileReadStream,
})

/**
 * Browser implementation wrapping chat.core's AttachmentService
 */
class BrowserAttachmentService implements IAttachmentService {
  async storeAttachment(
    data: ArrayBuffer | Uint8Array | string,
    metadata: {
      name: string
      mimeType: string
      size?: number
    }
  ): Promise<MessageAttachment> {
    const result = await coreService.storeAttachment(data, metadata)
    console.log(`[BrowserAttachmentService] Stored ${result.type.toUpperCase()}:`, {
      hash: result.hash.substring(0, 8),
      size: result.size,
      name: metadata.name,
    })
    return result
  }

  async getAttachment(
    hash: string,
    options?: { type?: 'blob' | 'clob' | 'document'; name?: string; mimeType?: string }
  ): Promise<{
    data: ArrayBuffer
    metadata: AttachmentMetadata
  }> {
    const logType = options?.type || 'blob'
    console.log(`[BrowserAttachmentService] Reading ${logType.toUpperCase()}:`, {
      hash: hash.substring(0, 8),
      type: logType,
    })

    const result = await coreService.getAttachment(hash, options)

    console.log('[BrowserAttachmentService] Retrieved attachment:', {
      hash: hash.substring(0, 8),
      type: logType,
      size: result.data.byteLength,
    })

    return result
  }

  async getAttachmentMetadata(hash: string): Promise<AttachmentMetadata> {
    return coreService.getAttachmentMetadata(hash)
  }

  async storeMultiple(
    attachments: Array<{
      data: ArrayBuffer | Uint8Array | string
      metadata: {
        name: string
        mimeType: string
        size?: number
      }
    }>
  ): Promise<MessageAttachment[]> {
    const results = await coreService.storeMultiple(attachments)
    console.log('[BrowserAttachmentService] Stored multiple attachments:', results.length)
    return results
  }

  async processFile(file: File): Promise<MessageAttachment> {
    return coreService.processFile(file)
  }

  async processFiles(files: File[]): Promise<MessageAttachment[]> {
    return coreService.processFiles(files)
  }

  async getDataUrl(hash: string): Promise<string> {
    return coreService.getDataUrl(hash)
  }
}

// Create and export singleton instance
const browserAttachmentService = new BrowserAttachmentService()

export { browserAttachmentService }
export const attachmentService = browserAttachmentService
