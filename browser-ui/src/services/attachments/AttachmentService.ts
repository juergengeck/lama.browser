/**
 * AttachmentService - Browser-native attachment handling using ONE.core BLOB storage
 *
 * This is a PURE BROWSER implementation that uses ONE.core directly.
 * NO Electron IPC - storage happens in IndexedDB via ONE.core.
 */

import type { MessageAttachment } from '@/types/attachments'
import { storeArrayBufferAsBlob, readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js'
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js'

class AttachmentService {
  /**
   * Store an attachment using ONE.core BLOB storage
   */
  async storeAttachment(
    data: ArrayBuffer | Uint8Array | string,
    metadata: {
      name: string
      mimeType: string
      size?: number
    }
  ): Promise<MessageAttachment> {
    try {
      // Convert to ArrayBuffer if needed
      let buffer: ArrayBuffer
      if (typeof data === 'string') {
        // Assume base64 string
        const binaryString = atob(data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        buffer = bytes.buffer
      } else if (data instanceof Uint8Array) {
        buffer = data.buffer
      } else {
        buffer = data
      }

      // Store as BLOB using ONE.core
      const result = await storeArrayBufferAsBlob(buffer)

      console.log('[AttachmentService] Stored BLOB:', {
        hash: result.hash.substring(0, 8),
        status: result.status,
        size: metadata.size,
        name: metadata.name
      })

      // Return MessageAttachment with hash
      return {
        hash: result.hash as string,
        type: 'blob',
        mimeType: metadata.mimeType,
        name: metadata.name,
        size: metadata.size || buffer.byteLength
      }
    } catch (error) {
      console.error('[AttachmentService] Failed to store attachment:', error)
      throw new Error(`Failed to store attachment: ${error}`)
    }
  }
  
  /**
   * Get an attachment by hash using ONE.core BLOB storage
   */
  async getAttachment(hash: string): Promise<{
    data: ArrayBuffer
    metadata: {
      name: string
      mimeType: string
      size: number
    }
  }> {
    try {
      // Read BLOB from ONE.core storage
      const data = await readBlobAsArrayBuffer(hash as SHA256Hash<'BLOB'>)

      console.log('[AttachmentService] Retrieved BLOB:', {
        hash: hash.substring(0, 8),
        size: data.byteLength
      })

      // TODO: Metadata is not stored with BLOBs in ONE.core
      // We should store metadata separately if needed
      return {
        data,
        metadata: {
          name: 'attachment',
          mimeType: 'application/octet-stream',
          size: data.byteLength
        }
      }
    } catch (error) {
      console.error('[AttachmentService] Failed to get attachment:', error)
      throw new Error(`Failed to get attachment: ${error}`)
    }
  }
  
  /**
   * Get attachment metadata only
   *
   * NOTE: ONE.core BLOBs don't store metadata, so we need to fetch the full blob
   * and return basic metadata.
   */
  async getAttachmentMetadata(hash: string): Promise<{
    name: string
    mimeType: string
    size: number
  }> {
    try {
      const data = await readBlobAsArrayBuffer(hash as SHA256Hash<'BLOB'>)

      return {
        name: 'attachment',
        mimeType: 'application/octet-stream',
        size: data.byteLength
      }
    } catch (error) {
      console.error('[AttachmentService] Failed to get metadata:', error)
      throw new Error(`Failed to get metadata: ${error}`)
    }
  }
  
  /**
   * Store multiple attachments using ONE.core BLOB storage
   */
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
    // Store each attachment individually
    const results = await Promise.all(
      attachments.map(att => this.storeAttachment(att.data, att.metadata))
    )

    console.log('[AttachmentService] Stored multiple BLOBs:', results.length)

    return results
  }
  
  /**
   * Process file for attachment
   */
  async processFile(file: File): Promise<MessageAttachment> {
    const buffer = await file.arrayBuffer()
    
    return this.storeAttachment(buffer, {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size
    })
  }
  
  /**
   * Process multiple files
   */
  async processFiles(files: File[]): Promise<MessageAttachment[]> {
    const attachments = await Promise.all(
      files.map(async file => ({
        data: await file.arrayBuffer(),
        metadata: {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size
        }
      }))
    )
    
    return this.storeMultiple(attachments)
  }
  
  /**
   * Create data URL for attachment
   */
  async getDataUrl(hash: string): Promise<string> {
    const { data, metadata } = await this.getAttachment(hash)
    const bytes = new Uint8Array(data)

    // Convert to base64 in chunks to avoid stack overflow
    let binary = ''
    const chunkSize = 32768
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const base64 = btoa(binary)

    return `data:${metadata.mimeType};base64,${base64}`
  }
}

// Export singleton instance
export const attachmentService = new AttachmentService()