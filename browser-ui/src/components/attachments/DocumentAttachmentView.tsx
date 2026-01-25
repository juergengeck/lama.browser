/**
 * DocumentAttachmentView - Component for rendering document attachments
 */

import React, { useState } from 'react'
import { FileText, Download, File, FileCode, FileSpreadsheet, ChevronDown } from 'lucide-react'
import type { AttachmentViewProps } from '@/types/attachments'
import { formatFileSize } from '@/types/attachments'
import { useAttachmentDescriptor } from './AttachmentViewFactory'
import { Button } from '@refinio/lama.ui'

export const DocumentAttachmentView: React.FC<AttachmentViewProps> = ({
  attachment,
  descriptor: providedDescriptor,
  onClick,
  onDownload,
  mode = 'inline',
  showMetadata = true,
  className = ''
}) => {
  const { descriptor, loading, error } = useAttachmentDescriptor(attachment, providedDescriptor)
  const [isExpanded, setIsExpanded] = useState(false)
  const [contentPreview, setContentPreview] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  
  const handleDownload = () => {
    if (onDownload) {
      onDownload(attachment)
    } else if (descriptor) {
      const blob = new Blob([descriptor.data], { type: descriptor.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.name || descriptor.name || 'document'
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  
  // Select icon based on file type
  const getIcon = () => {
    const mimeType = attachment.mimeType || descriptor?.type || ''
    const name = attachment.name || descriptor?.name || ''
    
    if (mimeType.includes('pdf')) return FileText
    if (mimeType.includes('spreadsheet') || name.match(/\.(xls|xlsx|csv)$/i)) return FileSpreadsheet
    if (mimeType.includes('code') || name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|h|hpp|cs|go|rs|rb|php|swift|kt|scala|r|m|mm|sh|bash|zsh|fish|ps1|bat|cmd)$/i)) return FileCode
    if (mimeType.includes('text')) return FileText
    return File
  }
  
  const Icon = getIcon()

  // Load content preview when expanded
  React.useEffect(() => {
    if (isExpanded && descriptor && !contentPreview && !isLoadingPreview) {
      loadContentPreview()
    }
  }, [isExpanded, descriptor])

  const loadContentPreview = async () => {
    if (!descriptor) return

    const mimeType = attachment.mimeType || descriptor.type || ''
    const isTextBased = mimeType.includes('text') ||
                        mimeType.includes('json') ||
                        mimeType.includes('xml') ||
                        mimeType.includes('javascript') ||
                        mimeType.includes('typescript') ||
                        mimeType.includes('html') ||
                        mimeType.includes('css') ||
                        mimeType.includes('markdown')

    if (!isTextBased) {
      setContentPreview('[Binary file - preview not available]')
      return
    }

    setIsLoadingPreview(true)
    try {
      const text = new TextDecoder().decode(descriptor.data)
      // Limit preview to first 1000 characters
      const preview = text.length > 1000 ? text.substring(0, 1000) + '...' : text
      setContentPreview(preview)
    } catch (err) {
      setContentPreview('[Unable to preview content]')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded border animate-pulse ${className}`}>
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className={`text-sm text-red-500 p-2 ${className}`}>
        Failed to load document
      </div>
    )
  }
  
  if (mode === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 p-2 rounded border ${className}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm truncate">{attachment.name || 'Document'}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    )
  }
  
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${className}`}
      >
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {attachment.name || descriptor?.name || 'Document'}
          </div>
          {showMetadata && (
            <div className="text-xs text-muted-foreground">
              {formatFileSize(attachment.size || descriptor?.size || 0)}
            </div>
          )}
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            handleDownload()
          }}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          title={isExpanded ? 'Show less' : 'Show more'}
          className="transition-transform"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {isExpanded && (
        <div className="p-3 rounded-lg border bg-card/50 text-sm space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span>{attachment.mimeType || descriptor?.type || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Size:</span>
            <span>{formatFileSize(attachment.size || descriptor?.size || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span className="truncate ml-2">{attachment.name || descriptor?.name || 'Document'}</span>
          </div>

          {/* Content Preview */}
          <div className="pt-2 border-t">
            <div className="text-muted-foreground mb-2">Content:</div>
            {isLoadingPreview ? (
              <div className="p-3 bg-muted/30 rounded animate-pulse">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            ) : contentPreview ? (
              <div className="p-3 bg-muted/30 rounded font-mono text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {contentPreview}
              </div>
            ) : (
              <div className="p-3 bg-muted/30 rounded text-muted-foreground text-xs italic">
                Click to load preview...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}