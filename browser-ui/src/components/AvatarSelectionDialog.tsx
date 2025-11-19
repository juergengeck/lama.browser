/**
 * AvatarSelectionDialog - Choose between custom lama avatar or image upload
 *
 * Features:
 * - Tab interface for "Custom" vs "Upload"
 * - Custom tab: LamaAvatarComposer with layered SVG parts
 * - Upload tab: File picker for photos
 * - Export custom avatar as PNG data URL
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@lama/ui'
import { Button } from '@lama/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@lama/ui'
import { Label } from '@lama/ui'
import { Upload, Sparkles } from 'lucide-react'
import {
  LamaAvatarComposer,
  generateDefaultAvatarConfig,
  type AvatarConfig,
} from './LamaAvatarComposer'

interface AvatarSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: 'custom' | 'upload', data: string | File, config?: AvatarConfig) => void
  currentAvatarUrl?: string
  initialConfig?: AvatarConfig
}

export function AvatarSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  currentAvatarUrl,
  initialConfig,
}: AvatarSelectionDialogProps) {
  const [activeTab, setActiveTab] = useState<'custom' | 'upload'>('custom')
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(
    initialConfig || generateDefaultAvatarConfig()
  )
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(currentAvatarUrl || null)
  const [customAvatarDataUrl, setCustomAvatarDataUrl] = useState<string | null>(null)

  const handleCustomExport = (dataUrl: string) => {
    setCustomAvatarDataUrl(dataUrl)
    // Immediately apply the avatar when exported
    onSelect('custom', dataUrl, avatarConfig)
    onOpenChange(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    setUploadFile(file)
    const previewUrl = URL.createObjectURL(file)
    setUploadPreviewUrl(previewUrl)
  }

  const handleConfirm = () => {
    if (activeTab === 'custom') {
      if (!customAvatarDataUrl) {
        alert('Please generate your custom avatar first')
        return
      }
      onSelect('custom', customAvatarDataUrl, avatarConfig)
    } else {
      if (!uploadFile) {
        alert('Please select an image to upload')
        return
      }
      onSelect('upload', uploadFile)
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Choose Your Avatar</DialogTitle>
          <DialogDescription>
            Create a custom lama avatar or upload your own image
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'custom' | 'upload')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="custom" className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4" />
              <span>Custom Lama</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Upload Image</span>
            </TabsTrigger>
          </TabsList>

          {/* Custom Lama Tab */}
          <TabsContent value="custom" className="mt-4">
            <div className="flex flex-col items-center">
              <LamaAvatarComposer
                config={avatarConfig}
                onChange={setAvatarConfig}
                onExport={handleCustomExport}
                size={200}
                showControls={true}
              />
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Toggle parts to customize your lama avatar
              </p>
            </div>
          </TabsContent>

          {/* Upload Image Tab */}
          <TabsContent value="upload" className="mt-4">
            <div className="flex flex-col items-center space-y-4">
              {/* Preview */}
              {uploadPreviewUrl && (
                <div className="border border-border rounded-lg p-4">
                  <img
                    src={uploadPreviewUrl}
                    alt="Preview"
                    className="w-48 h-48 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* File Input */}
              <div className="w-full">
                <Label htmlFor="avatar-upload" className="block mb-2">
                  Select Image
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: JPG, PNG, GIF (max 5MB)
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Set Avatar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
