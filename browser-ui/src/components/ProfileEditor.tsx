/**
 * ProfileEditor - Rich profile editing with avatar support
 *
 * Features:
 * - Avatar image upload with overlay
 * - Default lama.svg avatar
 * - Display name editing
 * - Status message (optional)
 * - Platform-agnostic using ContactsPlan
 */

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@lama/ui'
import { Button } from '@lama/ui'
import { Input } from '@lama/ui'
import { Label } from '@lama/ui'
import { Textarea } from '@lama/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@lama/ui'
import { User, Camera, Upload, X, Sparkles } from 'lucide-react'
import { useModel } from '@/model/ModelContext'
import { storeArrayBufferAsBlob } from '@refinio/one.core/lib/storage-blob.js'
import { readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js'
import { clearAvatarCache } from '@/hooks/useContactAvatar'
import type { SHA256Hash, BLOB } from '@refinio/one.core/lib/recipes.js'
import { AvatarSelectionDialog } from './AvatarSelectionDialog'
import {
  saveAvatarPreference,
  loadDefaultAvatar,
  renderLamaAvatar,
  dataUrlToFile
} from '@/utils/avatar-helpers'
import type { AvatarConfig } from './LamaAvatarComposer'

interface ProfileEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName?: string
  currentStatus?: string
  currentAvatarUrl?: string
  required?: boolean
  onSave?: () => void
}

export function ProfileEditor({
  open,
  onOpenChange,
  currentName = '',
  currentStatus = '',
  currentAvatarUrl,
  required = false,
  onSave
}: ProfileEditorProps) {
  const model = useModel()
  const [name, setName] = useState(currentName)
  const [status, setStatus] = useState(currentStatus)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(currentAvatarUrl || null)
  const [avatarBlobHash, setAvatarBlobHash] = useState<SHA256Hash<BLOB> | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  const [currentAvatarConfig, setCurrentAvatarConfig] = useState<AvatarConfig | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing profile data when dialog opens
  useEffect(() => {
    if (open && model.initialized) {
      loadProfileData()
    }
  }, [open, model.initialized])

  useEffect(() => {
    setName(currentName)
    setStatus(currentStatus)
    setAvatarPreviewUrl(currentAvatarUrl || null)
  }, [currentName, currentStatus, currentAvatarUrl])

  const loadProfileData = async () => {
    if (!model.initialized) return

    setLoading(true)
    try {
      const ownerPersonId = await model.leuteModel.myMainIdentity()
      const someone = await model.leuteModel.getSomeone(ownerPersonId)
      if (!someone) {
        console.warn('[ProfileEditor] Could not find owner profile')
        return
      }

      const profile = await someone.mainProfile()
      if (!profile || !profile.personDescriptions) {
        console.warn('[ProfileEditor] No profile descriptions found')
        return
      }

      // Load PersonName
      const nameDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'PersonName')
      if (nameDesc && 'name' in nameDesc) {
        setName(nameDesc.name)
      }

      // Load PersonStatus
      const statusDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'PersonStatus')
      if (statusDesc && 'value' in statusDesc) {
        setStatus(statusDesc.value)
      }

      // Load AvatarPreference (custom lama config)
      try {
        const avatarPref = await loadDefaultAvatar(ownerPersonId)
        if (avatarPref?.lamaConfig) {
          setCurrentAvatarConfig(avatarPref.lamaConfig)
          // Render lama avatar as preview
          const dataUrl = await renderLamaAvatar(avatarPref.lamaConfig, 200)
          setAvatarPreviewUrl(dataUrl)
          console.log('[ProfileEditor] Loaded avatar:', avatarPref.name, 'generation:', avatarPref.generation)
        }
      } catch (err) {
        console.warn('[ProfileEditor] No avatar found:', err)
      }

      // Load ProfileImage (uploaded photo - fallback if no lama config)
      if (!currentAvatarConfig) {
        const imageDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'ProfileImage')
        if (imageDesc && 'image' in imageDesc) {
          try {
            const blobHash = imageDesc.image as SHA256Hash<BLOB>
            setAvatarBlobHash(blobHash)

            // Read BLOB and create preview URL
            const arrayBuffer = await readBlobAsArrayBuffer(blobHash)
            const blob = new Blob([arrayBuffer])
            const url = URL.createObjectURL(blob)
            setAvatarPreviewUrl(url)
          } catch (err) {
            console.error('[ProfileEditor] Failed to load profile image:', err)
          }
        }
      }
    } catch (err) {
      console.error('[ProfileEditor] Error loading profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarClick = () => {
    setShowAvatarSelection(true)
  }

  const handleAvatarSelection = async (type: 'custom' | 'upload', data: string | File, config?: AvatarConfig) => {
    if (type === 'custom') {
      // Custom lama avatar (data URL + config)
      if (!config) {
        setError('Invalid avatar configuration')
        return
      }

      setCurrentAvatarConfig(config)
      setAvatarPreviewUrl(data as string)

      // Convert data URL to file for storage
      const file = dataUrlToFile(data as string, 'avatar.png')
      setAvatarFile(file)
      setError(null)

      console.log('[ProfileEditor] Custom lama avatar selected')
    } else {
      // Uploaded file
      const file = data as File

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be smaller than 5MB')
        return
      }

      setCurrentAvatarConfig(null) // Clear lama config when uploading photo
      setAvatarFile(file)
      const previewUrl = URL.createObjectURL(file)
      setAvatarPreviewUrl(previewUrl)
      setError(null)

      console.log('[ProfileEditor] Photo uploaded')
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB')
      return
    }

    setAvatarFile(file)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreviewUrl(previewUrl)
    setError(null)
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setAvatarBlobHash(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name cannot be empty')
      return
    }

    if (!model.initialized) {
      setError('Model not initialized. Please wait.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Get owner person ID
      const ownerPersonId = await model.leuteModel.myMainIdentity()

      // Update name via LeuteModel
      // Note: We access ProfileService through LeuteModel's profile management
      const someone = await model.leuteModel.getSomeone(ownerPersonId)
      if (!someone) {
        throw new Error('Could not find owner profile')
      }

      const profile = await someone.mainProfile()
      if (!profile) {
        throw new Error('Could not find owner profile')
      }

      // Update PersonName
      const personName = {
        $type$: 'PersonName' as const,
        name: name.trim()
      }

      // Remove existing PersonName and add new one
      if (profile.personDescriptions) {
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'PersonName'
        )
      } else {
        profile.personDescriptions = []
      }
      profile.personDescriptions.push(personName)

      // Update ProfileImage
      if (avatarFile) {
        // New avatar file uploaded - store as BLOB
        const arrayBuffer = await avatarFile.arrayBuffer()
        const blobResult = await storeArrayBufferAsBlob(arrayBuffer)
        const profileImage = {
          $type$: 'ProfileImage' as const,
          image: blobResult.hash
        }
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'ProfileImage'
        )
        profile.personDescriptions.push(profileImage)
        console.log('[ProfileEditor] Stored new avatar BLOB:', blobResult.hash.substring(0, 16))
      } else if (avatarBlobHash && avatarPreviewUrl) {
        // Existing avatar - keep it
        const profileImage = {
          $type$: 'ProfileImage' as const,
          image: avatarBlobHash
        }
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'ProfileImage'
        )
        profile.personDescriptions.push(profileImage)
      } else {
        // No avatar - remove any existing ProfileImage
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'ProfileImage'
        )
      }

      // Update PersonStatus
      if (status.trim()) {
        const personStatus = {
          $type$: 'PersonStatus' as const,
          value: status.trim(),
          timestamp: Date.now(),
          location: ''
        }
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'PersonStatus'
        )
        profile.personDescriptions.push(personStatus)
        console.log('[ProfileEditor] Updated status:', status.trim())
      } else {
        // No status - remove any existing PersonStatus
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'PersonStatus'
        )
      }

      // Save profile
      await profile.saveAndLoad()

      console.log('[ProfileEditor] Profile saved successfully')

      // Save avatar preference if custom lama config exists
      if (currentAvatarConfig) {
        try {
          await saveAvatarPreference(
            ownerPersonId,
            'LAMA',  // Avatar name (default)
            currentAvatarConfig
          )
          console.log('[ProfileEditor] Saved LAMA avatar')
        } catch (err) {
          console.error('[ProfileEditor] Failed to save avatar:', err)
        }
      }

      // Clear avatar cache so ContactsView will reload the new avatar
      clearAvatarCache(ownerPersonId)

      onOpenChange(false)
      if (onSave) {
        onSave()
      }

      // Dispatch event to refresh contacts view
      window.dispatchEvent(new CustomEvent('contacts:updated'))
    } catch (err: any) {
      console.error('[ProfileEditor] Error saving profile:', err)
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (!required) {
      setError(null)
      setName(currentName)
      setStatus(currentStatus)
      setAvatarPreviewUrl(currentAvatarUrl || null)
      setAvatarFile(null)
      onOpenChange(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target === e.currentTarget) {
      e.preventDefault()
      handleSave()
    }
  }

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'UN'
  }

  return (
    <>
      <AvatarSelectionDialog
        open={showAvatarSelection}
        onOpenChange={setShowAvatarSelection}
        onSelect={handleAvatarSelection}
        currentAvatarUrl={avatarPreviewUrl || undefined}
        initialConfig={currentAvatarConfig || undefined}
      />

      <Dialog open={open} onOpenChange={required ? undefined : onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-primary" />
            <DialogTitle>
              {currentName ? 'Edit Profile' : 'Set Your Profile'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {required
              ? 'Please set your profile before creating connections. This information will be shared with your contacts.'
              : 'Update your profile information. This will be shared with your contacts.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 cursor-pointer transition-opacity group-hover:opacity-80">
                {avatarPreviewUrl ? (
                  <AvatarImage src={avatarPreviewUrl} alt={name || 'Profile'} />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 via-pink-500 to-blue-900 text-white text-2xl">
                    {name ? getInitials(name) : (
                      <img
                        src="/assets/icons/lama.svg"
                        alt="LAMA"
                        className="h-16 w-16 opacity-90"
                      />
                    )}
                  </AvatarFallback>
                )}
              </Avatar>

              {/* Avatar Overlay - Shows on hover */}
              <div
                onClick={handleAvatarClick}
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-8 w-8 text-white" />
              </div>

              {/* Remove Avatar Button */}
              {avatarPreviewUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg hover:bg-destructive/90 transition-colors"
                  aria-label="Remove avatar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* File Input (Hidden) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              disabled={saving}
            />

            {/* Avatar Buttons */}
            <div className="flex items-center space-x-2 w-full">
              <Button
                variant="default"
                size="sm"
                onClick={handleAvatarClick}
                disabled={saving}
                className="flex-1 flex items-center justify-center space-x-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>Custom Avatar</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="flex-1 flex items-center justify-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Photo</span>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Create a custom lama or upload your own image (max 5MB)
            </p>
          </div>

          {/* Name Field */}
          <div className="grid gap-2">
            <Label htmlFor="name">Display Name *</Label>
            <Input
              id="name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Status Field (Optional) */}
          <div className="grid gap-2">
            <Label htmlFor="status">
              Status Message
              <span className="text-xs text-muted-foreground ml-2">(optional)</span>
            </Label>
            <Textarea
              id="status"
              placeholder="What's on your mind?"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={saving || loading}
              rows={3}
              className="resize-none"
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground">
              {status.length}/280 characters
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          {!required && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
