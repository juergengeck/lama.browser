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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@lama/ui'
import { Button } from '@lama/ui'
import { Input } from '@lama/ui'
import { Label } from '@lama/ui'
import { Textarea } from '@lama/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@lama/ui'
import { User, Camera, Upload, X, Sparkles, Shield, Check, ChevronRight } from 'lucide-react'
import { useModel } from '@/model/ModelContext'
import { storeArrayBufferAsBlob } from '@refinio/one.core/lib/storage-blob.js'
import { readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js'
import { clearAvatarCache } from '@/hooks/useContactAvatar'
import type { SHA256Hash, BLOB } from '@refinio/one.core/lib/recipes.js'
import { AvatarSelectionDialog } from './AvatarSelectionDialog'
import { ImageEditor } from './ImageEditor'
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
  contactId?: string
  currentName?: string
  currentStatus?: string
  currentAvatarUrl?: string
  required?: boolean
  onSave?: () => void
}

interface CertifiedVersion {
  versionHash: string
  timestamp: number
  certifiedBy?: string
  isCurrent: boolean
}

export function ProfileEditor({
  open,
  onOpenChange,
  contactId,
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
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [currentAvatarConfig, setCurrentAvatarConfig] = useState<AvatarConfig | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Certificate/version management
  const [certifiedVersions, setCertifiedVersions] = useState<CertifiedVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  // Edit mode and collapsible sections
  const [isEditing, setIsEditing] = useState(false)
  const [isOwnerProfile, setIsOwnerProfile] = useState(false)
  const [contactSectionOpen, setContactSectionOpen] = useState(false)
  const [addressSectionOpen, setAddressSectionOpen] = useState(false)
  const [professionalSectionOpen, setProfessionalSectionOpen] = useState(false)
  const [personalSectionOpen, setPersonalSectionOpen] = useState(false)

  // Address book fields
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [birthday, setBirthday] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')

  // Load existing profile data when dialog opens
  useEffect(() => {
    if (open && model.initialized) {
      loadProfileData()
      // Default to view mode when opening (unless required)
      setIsEditing(required)
    }
  }, [open, model.initialized, required, contactId])

  useEffect(() => {
    setName(currentName)
    setStatus(currentStatus)
    setAvatarPreviewUrl(currentAvatarUrl || null)
  }, [currentName, currentStatus, currentAvatarUrl])

  const loadProfileData = async () => {
    if (!model.initialized) return

    setLoading(true)
    try {
      // Determine if viewing owner's profile or another contact
      const ownerPersonId = await model.leuteModel.myMainIdentity()
      const personId = contactId || ownerPersonId
      const isOwner = personId === ownerPersonId
      setIsOwnerProfile(isOwner)

      const someone = await model.leuteModel.getSomeone(personId)
      if (!someone) {
        console.warn('[ProfileEditor] Could not find profile for:', personId)
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

      // Load Email from communicationEndpoints
      const emailEndpoint = profile.communicationEndpoints?.find((e: any) => e.$type$ === 'Email')
      if (emailEndpoint && 'email' in emailEndpoint) {
        setEmail(emailEndpoint.email)
      }

      // Load PhoneNumber
      const phoneEndpoint = profile.communicationEndpoints?.find((e: any) => e.$type$ === 'PhoneNumber')
      if (phoneEndpoint && 'number' in phoneEndpoint) {
        setPhone(phoneEndpoint.number)
      }

      // Load Address
      const addressEndpoint = profile.communicationEndpoints?.find((e: any) => e.$type$ === 'Address')
      if (addressEndpoint) {
        setStreet(addressEndpoint.street || '')
        setCity(addressEndpoint.city || '')
        setState(addressEndpoint.state || '')
        setPostalCode(addressEndpoint.postalCode || '')
        setCountry(addressEndpoint.country || '')
      }

      // Load Website
      const websiteEndpoint = profile.communicationEndpoints?.find((e: any) => e.$type$ === 'Website')
      if (websiteEndpoint && 'url' in websiteEndpoint) {
        setWebsite(websiteEndpoint.url)
      }

      // Load Birthday
      const birthdayDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'Birthday')
      if (birthdayDesc && 'date' in birthdayDesc) {
        setBirthday(birthdayDesc.date)
      }

      // Load JobTitle
      const jobTitleDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'JobTitle')
      if (jobTitleDesc && 'title' in jobTitleDesc) {
        setJobTitle(jobTitleDesc.title)
      }

      // Load Company
      const companyDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'Company')
      if (companyDesc && 'name' in companyDesc) {
        setCompany(companyDesc.name)
      }

      // Load Notes
      const notesDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'Notes')
      if (notesDesc && 'content' in notesDesc) {
        setNotes(notesDesc.content)
      }

      // Load AvatarPreference (custom lama config)
      let hasLamaAvatar = false
      try {
        const avatarPref = await loadDefaultAvatar(personId)
        if (avatarPref?.lamaConfig) {
          hasLamaAvatar = true
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
      if (!hasLamaAvatar) {
        const imageDesc = profile.personDescriptions?.find((d: any) => d.$type$ === 'ProfileImage')
        if (imageDesc && 'image' in imageDesc) {
          try {
            const blobHash = imageDesc.image as SHA256Hash<BLOB>
            setAvatarBlobHash(blobHash)

            console.log('[ProfileEditor] Loading ProfileImage BLOB:', blobHash.substring(0, 16))
            // Read BLOB and create preview URL
            const arrayBuffer = await readBlobAsArrayBuffer(blobHash)
            const blob = new Blob([arrayBuffer])
            const url = URL.createObjectURL(blob)
            setAvatarPreviewUrl(url)
            console.log('[ProfileEditor] ProfileImage loaded successfully')
          } catch (err) {
            console.error('[ProfileEditor] Failed to load profile image:', err)
          }
        } else {
          console.log('[ProfileEditor] No ProfileImage found in personDescriptions')
        }
      }
    } catch (err) {
      console.error('[ProfileEditor] Error loading profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarClick = () => {
    // If there's already an uploaded photo, open editor
    // Otherwise open selection dialog
    if (avatarPreviewUrl && !currentAvatarConfig) {
      setShowImageEditor(true)
    } else {
      setShowAvatarSelection(true)
    }
  }

  const handleImageEditorSave = (editedImageDataUrl: string) => {
    // Convert data URL to file
    const file = dataUrlToFile(editedImageDataUrl, 'avatar-edited.png')
    setAvatarFile(file)
    setAvatarPreviewUrl(editedImageDataUrl)
    setCurrentAvatarConfig(null) // Clear lama config since this is a photo

    // Enter edit mode
    if (!isEditing) {
      setIsEditing(true)
    }
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

    // Enter edit mode when avatar is changed
    if (!isEditing) {
      setIsEditing(true)
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

    // Enter edit mode when avatar is changed
    if (!isEditing) {
      setIsEditing(true)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setAvatarBlobHash(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Enter edit mode when avatar is removed
    if (!isEditing) {
      setIsEditing(true)
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
      // Get the person ID to update (contactId if editing another profile, otherwise owner)
      const ownerPersonId = await model.leuteModel.myMainIdentity()
      const personIdToUpdate = contactId || ownerPersonId

      // Update profile via LeuteModel
      const someone = await model.leuteModel.getSomeone(personIdToUpdate)
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

      // Update Birthday
      if (birthday.trim()) {
        const birthdayDesc = {
          $type$: 'Birthday' as const,
          date: birthday.trim()
        }
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'Birthday'
        )
        profile.personDescriptions.push(birthdayDesc)
      } else {
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'Birthday'
        )
      }

      // Update JobTitle
      if (jobTitle.trim()) {
        const jobTitleDesc = {
          $type$: 'JobTitle' as const,
          title: jobTitle.trim()
        }
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'JobTitle'
        )
        profile.personDescriptions.push(jobTitleDesc)
      } else {
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'JobTitle'
        )
      }

      // Update Company
      if (company.trim()) {
        const companyDesc = {
          $type$: 'Company' as const,
          name: company.trim()
        }
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'Company'
        )
        profile.personDescriptions.push(companyDesc)
      } else {
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'Company'
        )
      }

      // Update Notes
      if (notes.trim()) {
        const notesDesc = {
          $type$: 'Notes' as const,
          content: notes.trim()
        }
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'Notes'
        )
        profile.personDescriptions.push(notesDesc)
      } else {
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'Notes'
        )
      }

      // Update Email
      if (email.trim()) {
        const emailEndpoint = {
          $type$: 'Email' as const,
          email: email.trim()
        }
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'Email'
        ) || []
        profile.communicationEndpoints.push(emailEndpoint)
      } else {
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'Email'
        ) || []
      }

      // Update PhoneNumber
      if (phone.trim()) {
        const phoneEndpoint = {
          $type$: 'PhoneNumber' as const,
          number: phone.trim()
        }
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'PhoneNumber'
        ) || []
        profile.communicationEndpoints.push(phoneEndpoint)
      } else {
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'PhoneNumber'
        ) || []
      }

      // Update Address
      if (street.trim() || city.trim() || state.trim() || postalCode.trim() || country.trim()) {
        const addressEndpoint = {
          $type$: 'Address' as const,
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          country: country.trim() || undefined
        }
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'Address'
        ) || []
        profile.communicationEndpoints.push(addressEndpoint)
      } else {
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'Address'
        ) || []
      }

      // Update Website
      if (website.trim()) {
        const websiteEndpoint = {
          $type$: 'Website' as const,
          url: website.trim()
        }
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'Website'
        ) || []
        profile.communicationEndpoints.push(websiteEndpoint)
      } else {
        profile.communicationEndpoints = profile.communicationEndpoints?.filter(
          (ep: any) => ep.$type$ !== 'Website'
        ) || []
      }

      // Save profile
      await profile.saveAndLoad()

      console.log('[ProfileEditor] Profile saved successfully')

      // Save avatar preference if custom lama config exists
      if (currentAvatarConfig) {
        try {
          await saveAvatarPreference(
            personIdToUpdate,
            'LAMA',  // Avatar name (default)
            currentAvatarConfig
          )
          console.log('[ProfileEditor] Saved LAMA avatar')
        } catch (err) {
          console.error('[ProfileEditor] Failed to save avatar:', err)
        }
      }

      // Clear avatar cache so ContactsView will reload the new avatar
      clearAvatarCache(personIdToUpdate)

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

      <ImageEditor
        open={showImageEditor}
        onOpenChange={setShowImageEditor}
        imageUrl={avatarPreviewUrl || ''}
        onSave={handleImageEditorSave}
      />

      <Dialog open={open} onOpenChange={required ? undefined : onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-primary" />
            <DialogTitle>
              {required ? 'Set Your Profile' : isOwnerProfile ? (isEditing ? 'Edit Profile' : 'Your Profile') : 'Contact Profile'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {required
              ? 'Please set your profile before creating connections. This information will be shared with your contacts.'
              : isOwnerProfile
              ? (isEditing ? 'Edit your profile information. Click sections to expand.' : 'View your profile information. Click Edit to make changes.')
              : (isEditing ? 'Edit contact information. Click sections to expand.' : 'View contact information. Click Edit to make changes.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-start space-x-2">
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
                className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="h-8 w-8 text-white" />
                {avatarPreviewUrl && !currentAvatarConfig && (
                  <span className="text-xs text-white mt-1">Click to edit</span>
                )}
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

              {/* Certificate Version Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Shield className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Profile Versions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {certifiedVersions.length === 0 ? (
                    <DropdownMenuItem disabled>
                      <span className="text-xs text-muted-foreground">No certified versions yet</span>
                    </DropdownMenuItem>
                  ) : (
                    certifiedVersions.map((version) => (
                      <DropdownMenuItem
                        key={version.versionHash}
                        onClick={() => setSelectedVersion(version.versionHash)}
                        className={selectedVersion === version.versionHash ? 'bg-accent' : ''}
                      >
                        <div className="flex flex-col w-full">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {version.isCurrent && (
                                <Check className="h-3 w-3 inline mr-1 text-green-500" />
                              )}
                              {new Date(version.timestamp).toLocaleDateString()}
                            </span>
                            {version.certifiedBy && (
                              <Shield className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                          {version.certifiedBy && (
                            <span className="text-xs text-muted-foreground">
                              Certified by: {version.certifiedBy}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono">
                            {version.versionHash.substring(0, 12)}...
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
            {isEditing || required ? (
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={saving}
                autoFocus={required}
              />
            ) : (
              <p className="text-sm font-medium">{name || 'Not set'}</p>
            )}
          </div>

          {/* Status Field (Optional) */}
          {(isEditing || required || status) && (
            <div className="grid gap-2">
              <Label htmlFor="status">
                Status Message
                <span className="text-xs text-muted-foreground ml-2">(optional)</span>
              </Label>
              {isEditing || required ? (
                <>
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
                </>
              ) : (
                <p className="text-sm">{status}</p>
              )}
            </div>
          )}

          {/* Contact Information Section */}
          {(isEditing || email || phone || website) && (
            <div className="border-t pt-4">
              <button
                onClick={() => setContactSectionOpen(!contactSectionOpen)}
                className="flex items-center justify-between w-full group hover:opacity-80 transition-opacity"
              >
                <h3 className="font-semibold text-sm">Contact Information</h3>
                <ChevronRight className={`h-4 w-4 transition-transform ${contactSectionOpen ? 'rotate-90' : ''}`} />
              </button>
              {contactSectionOpen && (
                <div className="mt-3">
                <div className="grid gap-4">
                  {/* Email */}
                  {(isEditing || email) && (
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      {isEditing ? (
                        <Input
                          id="email"
                          type="email"
                          placeholder="your.email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={saving || loading}
                        />
                      ) : (
                        <p className="text-sm">{email}</p>
                      )}
                    </div>
                  )}

                  {/* Phone */}
                  {(isEditing || phone) && (
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      {isEditing ? (
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={saving || loading}
                        />
                      ) : (
                        <p className="text-sm">{phone}</p>
                      )}
                    </div>
                  )}

                  {/* Website */}
                  {(isEditing || website) && (
                    <div className="grid gap-2">
                      <Label htmlFor="website">Website</Label>
                      {isEditing ? (
                        <Input
                          id="website"
                          type="url"
                          placeholder="https://example.com"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          disabled={saving || loading}
                        />
                      ) : (
                        <a href={website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          {website}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          )}

          {/* Address Section */}
          {(isEditing || street || city || state || postalCode || country) && (
            <div className="border-t pt-4">
              <button
                onClick={() => setAddressSectionOpen(!addressSectionOpen)}
                className="flex items-center justify-between w-full group hover:opacity-80 transition-opacity"
              >
                <h3 className="font-semibold text-sm">Address</h3>
                <ChevronRight className={`h-4 w-4 transition-transform ${addressSectionOpen ? 'rotate-90' : ''}`} />
              </button>
              {addressSectionOpen && (
                <div className="mt-3">
                <div className="grid gap-4">
                  {/* Street */}
                  {(isEditing || street) && (
                    <div className="grid gap-2">
                      <Label htmlFor="street">Street</Label>
                      {isEditing ? (
                        <Input
                          id="street"
                          placeholder="123 Main Street"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          disabled={saving || loading}
                        />
                      ) : (
                        <p className="text-sm">{street}</p>
                      )}
                    </div>
                  )}

                  {/* City, State */}
                  {(isEditing || city || state) && (
                    <div className="grid grid-cols-2 gap-4">
                      {(isEditing || city) && (
                        <div className="grid gap-2">
                          <Label htmlFor="city">City</Label>
                          {isEditing ? (
                            <Input
                              id="city"
                              placeholder="San Francisco"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              disabled={saving || loading}
                            />
                          ) : (
                            <p className="text-sm">{city}</p>
                          )}
                        </div>
                      )}
                      {(isEditing || state) && (
                        <div className="grid gap-2">
                          <Label htmlFor="state">State</Label>
                          {isEditing ? (
                            <Input
                              id="state"
                              placeholder="CA"
                              value={state}
                              onChange={(e) => setState(e.target.value)}
                              disabled={saving || loading}
                            />
                          ) : (
                            <p className="text-sm">{state}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Postal Code, Country */}
                  {(isEditing || postalCode || country) && (
                    <div className="grid grid-cols-2 gap-4">
                      {(isEditing || postalCode) && (
                        <div className="grid gap-2">
                          <Label htmlFor="postalCode">Postal Code</Label>
                          {isEditing ? (
                            <Input
                              id="postalCode"
                              placeholder="94102"
                              value={postalCode}
                              onChange={(e) => setPostalCode(e.target.value)}
                              disabled={saving || loading}
                            />
                          ) : (
                            <p className="text-sm">{postalCode}</p>
                          )}
                        </div>
                      )}
                      {(isEditing || country) && (
                        <div className="grid gap-2">
                          <Label htmlFor="country">Country</Label>
                          {isEditing ? (
                            <Input
                              id="country"
                              placeholder="USA"
                              value={country}
                              onChange={(e) => setCountry(e.target.value)}
                              disabled={saving || loading}
                            />
                          ) : (
                            <p className="text-sm">{country}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          )}

          {/* Professional Information Section */}
          {(isEditing || jobTitle || company) && (
            <div className="border-t pt-4">
              <button
                onClick={() => setProfessionalSectionOpen(!professionalSectionOpen)}
                className="flex items-center justify-between w-full group hover:opacity-80 transition-opacity"
              >
                <h3 className="font-semibold text-sm">Professional Information</h3>
                <ChevronRight className={`h-4 w-4 transition-transform ${professionalSectionOpen ? 'rotate-90' : ''}`} />
              </button>
              {professionalSectionOpen && (
                <div className="mt-3">
                <div className="grid gap-4">
                  {/* Job Title */}
                  {(isEditing || jobTitle) && (
                    <div className="grid gap-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      {isEditing ? (
                        <Input
                          id="jobTitle"
                          placeholder="Software Engineer"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          disabled={saving || loading}
                        />
                      ) : (
                        <p className="text-sm">{jobTitle}</p>
                      )}
                    </div>
                  )}

                  {/* Company */}
                  {(isEditing || company) && (
                    <div className="grid gap-2">
                      <Label htmlFor="company">Company</Label>
                      {isEditing ? (
                        <Input
                          id="company"
                          placeholder="Acme Inc."
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          disabled={saving || loading}
                        />
                      ) : (
                        <p className="text-sm">{company}</p>
                      )}
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          )}

          {/* Personal Information Section */}
          {(isEditing || birthday || notes) && (
            <div className="border-t pt-4">
              <button
                onClick={() => setPersonalSectionOpen(!personalSectionOpen)}
                className="flex items-center justify-between w-full group hover:opacity-80 transition-opacity"
              >
                <h3 className="font-semibold text-sm">Personal Information</h3>
                <ChevronRight className={`h-4 w-4 transition-transform ${personalSectionOpen ? 'rotate-90' : ''}`} />
              </button>
              {personalSectionOpen && (
                <div className="mt-3">
                <div className="grid gap-4">
                  {/* Birthday */}
                  {(isEditing || birthday) && (
                    <div className="grid gap-2">
                      <Label htmlFor="birthday">Birthday</Label>
                      {isEditing ? (
                        <Input
                          id="birthday"
                          type="date"
                          value={birthday}
                          onChange={(e) => setBirthday(e.target.value)}
                          disabled={saving || loading}
                        />
                      ) : (
                        <p className="text-sm">{new Date(birthday).toLocaleDateString()}</p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {(isEditing || notes) && (
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      {isEditing ? (
                        <Textarea
                          id="notes"
                          placeholder="Add any additional notes..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          disabled={saving || loading}
                          rows={4}
                          className="resize-none"
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{notes}</p>
                      )}
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          {!required && (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Close
              </Button>
              {!isEditing && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  disabled={saving}
                >
                  Edit
                </Button>
              )}
            </>
          )}
          {isEditing && (
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
