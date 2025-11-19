/**
 * ProfileView - Full profile screen with display and editing
 *
 * Features:
 * - View own profile or other users' profiles
 * - Avatar display (custom lama or uploaded image)
 * - Display name and status
 * - Edit button (only for own profile)
 * - Platform-agnostic using ONE.core
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@lama/ui'
import { Button } from '@lama/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@lama/ui'
import { Badge } from '@lama/ui'
import { Separator } from '@lama/ui'
import { User, Edit, Mail, Calendar, MapPin, Loader2 } from 'lucide-react'
import { useModel } from '@/model/ModelContext'
import { ProfileEditor } from './ProfileEditor'
import { readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js'
import type { SHA256Hash, BLOB } from '@refinio/one.core/lib/recipes.js'
import { useAvatarPreference } from '@/hooks/useAvatarPreference'

interface ProfileData {
  personId: string
  name: string
  status: string
  avatarUrl: string | null
  createdAt?: number
  isOwner: boolean
}

interface ProfileViewProps {
  personId?: string // If not provided, shows own profile
  onClose?: () => void
}

export function ProfileView({ personId, onClose }: ProfileViewProps) {
  const model = useModel()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load custom avatar preference
  const { avatarUrl: customAvatarUrl, loading: avatarLoading } = useAvatarPreference(
    profile?.personId || null
  )

  useEffect(() => {
    if (model.initialized) {
      loadProfile()
    }
  }, [model.initialized, personId])

  const loadProfile = async () => {
    if (!model.initialized) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Determine which profile to load
      const ownerPersonId = await model.leuteModel.myMainIdentity()
      const targetPersonId = personId || ownerPersonId
      const isOwner = targetPersonId === ownerPersonId

      // Get person and profile
      const someone = await model.leuteModel.getSomeone(targetPersonId)
      if (!someone) {
        throw new Error('Profile not found')
      }

      const profileObj = await someone.mainProfile()
      if (!profileObj) {
        throw new Error('Profile not found')
      }

      // Extract profile data
      let name = 'Unknown'
      let status = ''
      let avatarUrl: string | null = null

      if (profileObj.personDescriptions) {
        // Load PersonName
        const nameDesc = profileObj.personDescriptions.find((d: any) => d.$type$ === 'PersonName')
        if (nameDesc && 'name' in nameDesc) {
          name = nameDesc.name
        }

        // Load PersonStatus
        const statusDesc = profileObj.personDescriptions.find((d: any) => d.$type$ === 'PersonStatus')
        if (statusDesc && 'value' in statusDesc) {
          status = statusDesc.value
        }

        // Load ProfileImage
        const imageDesc = profileObj.personDescriptions.find((d: any) => d.$type$ === 'ProfileImage')
        if (imageDesc && 'image' in imageDesc) {
          try {
            const blobHash = imageDesc.image as SHA256Hash<BLOB>
            const arrayBuffer = await readBlobAsArrayBuffer(blobHash)
            const blob = new Blob([arrayBuffer])
            avatarUrl = URL.createObjectURL(blob)
          } catch (err) {
            console.error('[ProfileView] Failed to load profile image:', err)
          }
        }
      }

      setProfile({
        personId: targetPersonId,
        name,
        status,
        avatarUrl,
        isOwner,
      })
    } catch (err: any) {
      console.error('[ProfileView] Error loading profile:', err)
      setError(err.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = () => {
    setShowEditor(true)
  }

  const handleEditorClose = () => {
    setShowEditor(false)
    loadProfile() // Reload profile after editing (will also reload custom avatar)
  }

  // Get the avatar URL to display (custom or uploaded photo)
  const displayAvatarUrl = customAvatarUrl || profile?.avatarUrl

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'UN'
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Profile Not Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {error || 'Unable to load profile data'}
              </p>
              {onClose && (
                <Button onClick={onClose} variant="outline">
                  Go Back
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <ProfileEditor
        open={showEditor}
        onOpenChange={setShowEditor}
        currentName={profile.name}
        currentStatus={profile.status}
        currentAvatarUrl={profile.avatarUrl || undefined}
        onSave={handleEditorClose}
      />

      <div className="flex flex-col h-full overflow-y-auto p-6 bg-background">
        <div className="max-w-2xl mx-auto w-full space-y-6">
          {/* Header with Avatar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-border">
                    {displayAvatarUrl ? (
                      <AvatarImage src={displayAvatarUrl} alt={profile.name} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 via-pink-500 to-blue-900 text-white text-4xl">
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  {profile.isOwner && (
                    <Badge
                      variant="default"
                      className="absolute bottom-0 right-0 text-xs px-2 py-1"
                    >
                      You
                    </Badge>
                  )}
                </div>

                {/* Name */}
                <div>
                  <h1 className="text-3xl font-bold">{profile.name}</h1>
                  {profile.status && (
                    <p className="text-muted-foreground mt-2 max-w-md">
                      {profile.status}
                    </p>
                  )}
                </div>

                {/* Edit Button (only for own profile) */}
                {profile.isOwner && (
                  <Button
                    onClick={handleEditClick}
                    className="flex items-center space-x-2"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Profile</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profile Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Person ID</p>
                    <p className="text-sm text-muted-foreground font-mono break-all">
                      {profile.personId.substring(0, 32)}...
                    </p>
                  </div>
                </div>

                <Separator />

                {profile.createdAt && (
                  <>
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Member Since</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(profile.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {profile.isOwner && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      This is your profile. Your contacts can see your name, avatar, and status.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {onClose && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
