/**
 * AttachmentService - Browser implementation
 *
 * This is the STORAGE LAYER for browser platform.
 * Uses ONE.core BLOB/CLOB storage directly (IndexedDB).
 */

import type { IAttachmentService, MessageAttachment, AttachmentMetadata } from '@refinio/lama.ui/services/attachments/AttachmentService'
import { storeArrayBufferAsBlob, readBlobAsArrayBuffer, storeUTF8Clob } from '@refinio/one.core/lib/storage-blob.js'
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js'

/**
 * Browser implementation of AttachmentService using ONE.core directly
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
    let hash: string
    let type: 'blob' | 'clob'
    let size: number

    if (typeof data === 'string') {
      // Store as CLOB (UTF-8 text)
      const result = await storeUTF8Clob(data)
      hash = result.hash
      type = 'clob'
      size = new TextEncoder().encode(data).length
    } else {
      // Store as BLOB (binary)
      const arrayBuffer = data instanceof Uint8Array
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data
      const result = await storeArrayBufferAsBlob(arrayBuffer as ArrayBuffer)
      hash = result.hash
      type = 'blob'
      size = (arrayBuffer as ArrayBuffer).byteLength
    }

    const result = {
      hash,
      type,
      mimeType: metadata.mimeType,
      name: metadata.name,
      size: metadata.size ?? size
    }

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

    const data = await readBlobAsArrayBuffer(hash as SHA256Hash<any>)

    const result = {
      data,
      metadata: {
        name: options?.name || 'attachment',
        mimeType: options?.mimeType || 'application/octet-stream',
        size: data.byteLength
      }
    }

    console.log('[BrowserAttachmentService] Retrieved attachment:', {
      hash: hash.substring(0, 8),
      type: logType,
      size: result.data.byteLength,
    })

    return result
  }

  async getAttachmentMetadata(hash: string): Promise<AttachmentMetadata> {
    const data = await readBlobAsArrayBuffer(hash as SHA256Hash<any>)
    return {
      name: 'attachment',
      mimeType: 'application/octet-stream',
      size: data.byteLength
    }
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
    const results = await Promise.all(
      attachments.map(({ data, metadata }) => this.storeAttachment(data, metadata))
    )
    console.log('[BrowserAttachmentService] Stored multiple attachments:', results.length)
    return results
  }

  async processFile(file: File): Promise<MessageAttachment> {
    const arrayBuffer = await file.arrayBuffer()
    return this.storeAttachment(arrayBuffer, {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size
    })
  }

  async processFiles(files: File[]): Promise<MessageAttachment[]> {
    return Promise.all(files.map(file => this.processFile(file)))
  }

  async getDataUrl(hash: string): Promise<string> {
    const { data, metadata } = await this.getAttachment(hash)
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)))
    return `data:${metadata.mimeType};base64,${base64}`
  }
}

// Create and export singleton instance
const browserAttachmentService = new BrowserAttachmentService()

export { browserAttachmentService }
export const attachmentService = browserAttachmentService
