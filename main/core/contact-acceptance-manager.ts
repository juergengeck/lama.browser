/**
 * Contact Acceptance Manager
 * 
 * Manages the two-phase contact acceptance flow:
 * 1. Receive and store pending contact information
 * 2. User reviews and accepts/rejects
 * 3. Generate dedicated VC for accepted contacts
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

interface ContactAcceptanceOptions {
  nickname?: string
  groups?: string[]
  tags?: string[]
  notes?: string
  canMessage?: boolean
  canCall?: boolean
  canShareFiles?: boolean
  canSeePresence?: boolean
  customPermissions?: Record<string, any>
}

class ContactAcceptanceManager extends EventEmitter {
  public nodeOneCore: any;

  privateSignKey: any;
  Person: any;
  ProfileModel: any;
  OneInstanceEndpoint: any;
  verify: any;
  pendingContacts: Map<string, any>
  acceptedContacts: Map<string, any>
  contactVCs: Map<string, any>

  constructor(nodeOneCore: any) {
    super()
    this.nodeOneCore = nodeOneCore
    this.pendingContacts = new Map() // peerId -> pending contact info
    this.acceptedContacts = new Map() // personId -> accepted contact with VC
    this.contactVCs = new Map() // personId -> dedicated VC for that contact
  }

  /**
   * Add a contact to pending review (from VC exchange)
   */
  async addPendingContact(credential: any, peerId: any, connectionInfo: any): Promise<any> {
    const pendingId = crypto.randomBytes(16).toString('hex')
    
    const pendingContact = {
      id: pendingId,
      peerId: peerId,
      credential: credential,
      connectionInfo: connectionInfo,
      receivedAt: Date.now(),
      status: 'pending',
      
      // Extracted info for UI display
      displayInfo: {
        name: credential.instanceName || 'Unknown',
        personId: credential.subject,
        instanceId: credential.instanceId,
        capabilities: credential.capabilities || [],
        publicKey: credential.publicKey,
        issuer: credential.issuer,
        expiresAt: credential.expiresAt
      }
    }
    
    this.pendingContacts.set(pendingId, pendingContact)
    
    console.log('[ContactAcceptanceManager] Added pending contact:', pendingId)
    
    // Emit event for UI
    this.emit('pending-contact', {
      id: pendingId,
      displayInfo: pendingContact.displayInfo,
      receivedAt: pendingContact.receivedAt
    })
    
    return pendingId
  }

  /**
   * Get all pending contacts for UI display
   */
  getPendingContacts(): any {
    const pending = []
    
    for (const [id, contact] of this.pendingContacts) {
      if (contact.status === 'pending') {
        pending.push({
          id: id,
          displayInfo: contact.displayInfo,
          receivedAt: contact.receivedAt
        })
      }
    }
    
    return pending
  }

  /**
   * Get specific pending contact details
   */
  getPendingContact(pendingId: any): any {
    const contact = this.pendingContacts.get(pendingId)
    if (!contact) return null
    
    return {
      id: pendingId,
      displayInfo: contact.displayInfo,
      receivedAt: contact.receivedAt,
      credential: contact.credential // Full credential for detailed view
    }
  }

  /**
   * Accept a pending contact and create dedicated VC
   */
  async acceptContact(pendingId: string, options: ContactAcceptanceOptions = {}): Promise<any> {
    const pendingContact = this.pendingContacts.get(pendingId)
    
    if (!pendingContact) {
      throw new Error('Pending contact not found')
    }
    
    if (pendingContact.status !== 'pending') {
      throw new Error('Contact already processed')
    }
    
    console.log('[ContactAcceptanceManager] Accepting contact:', pendingId)
    
    try {
      // Update status
      pendingContact.status = 'accepting'
      
      // Create dedicated VC for this contact relationship
      const dedicatedVC = await this.createDedicatedVC(pendingContact, options)
      
      // Create the actual ONE.core contact
      const contact = await this.createOneContact(pendingContact, dedicatedVC)
      
      // Store accepted contact
      const personId = pendingContact.credential.subject
      this.acceptedContacts.set(personId, {
        ...contact,
        acceptedAt: Date.now(),
        dedicatedVC: dedicatedVC
      })
      
      // Store the dedicated VC
      this.contactVCs.set(personId, dedicatedVC)
      
      // Update status
      pendingContact.status = 'accepted'
      
      console.log('[ContactAcceptanceManager] ✅ Contact accepted:', personId)
      
      // Emit events
      this.emit('contact-accepted', {
        pendingId: pendingId,
        personId: personId,
        contact: contact,
        dedicatedVC: dedicatedVC
      })
      
      // Send the dedicated VC to the peer
      await this.sendDedicatedVC(pendingContact.peerId, dedicatedVC)
      
      return {
        success: true,
        personId: personId,
        contact: contact
      }
      
    } catch (error) {
      pendingContact.status = 'error'
      console.error('[ContactAcceptanceManager] Failed to accept contact:', error)
      
      this.emit('contact-acceptance-failed', {
        pendingId: pendingId,
        error: (error as Error).message
      })
      
      throw error
    }
  }

  /**
   * Reject a pending contact
   */
  async rejectContact(pendingId: string, reason: string = 'User rejected'): Promise<any> {
    const pendingContact = this.pendingContacts.get(pendingId)
    
    if (!pendingContact) {
      throw new Error('Pending contact not found')
    }
    
    if (pendingContact.status !== 'pending') {
      throw new Error('Contact already processed')
    }
    
    console.log('[ContactAcceptanceManager] Rejecting contact:', pendingId)
    
    // Update status
    pendingContact.status = 'rejected'
    pendingContact.rejectedAt = Date.now()
    pendingContact.rejectionReason = reason
    
    // Emit event
    this.emit('contact-rejected', {
      pendingId: pendingId,
      reason: reason
    })
    
    // Optionally notify the peer of rejection
    if (pendingContact.peerId) {
      await this.sendRejectionNotice(pendingContact.peerId, reason)
    }
    
    // Remove from pending after a delay
    setTimeout(() => {
      this.pendingContacts.delete(pendingId)
    }, 60000) // Keep for 1 minute for UI feedback
    
    return {
      success: true,
      pendingId: pendingId
    }
  }

  /**
   * Create a dedicated VC for an accepted contact
   */
  async createDedicatedVC(pendingContact: any, options: ContactAcceptanceOptions = {}): Promise<any> {
    const { getInstanceIdHash, getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js')
    const { getDefaultKeys } = await import('@refinio/one.core/lib/keychain/keychain.js')
    
    const instanceId = getInstanceIdHash()
    const myPersonId = getInstanceOwnerIdHash()
    const keys = await getDefaultKeys(myPersonId as any)
    
    // Create relationship-specific VC
    const dedicatedVC = {
      $type$: 'ContactVerifiableCredential',
      
      // Standard VC fields
      issuer: myPersonId,
      subject: pendingContact.credential.subject, // The contact's person ID
      
      // Relationship info
      relationship: {
        type: 'contact',
        establishedAt: Date.now(),
        acceptedBy: myPersonId,
        acceptedAt: Date.now(),
        
        // Optional relationship metadata
        nickname: options.nickname,
        groups: options.groups || [],
        tags: options.tags || [],
        notes: options.notes
      },
      
      // Instance info
      issuingInstance: instanceId,
      issuingInstanceName: this.nodeOneCore.instanceName,
      
      // Contact's info (from their VC)
      contactInfo: {
        personId: pendingContact.credential.subject,
        instanceId: pendingContact.credential.instanceId,
        instanceName: pendingContact.credential.instanceName,
        publicKey: pendingContact.credential.publicKey
      },
      
      // Permissions granted to this contact
      permissions: {
        canMessage: options.canMessage !== false, // Default true
        canCall: options.canCall || false,
        canShareFiles: options.canShareFiles || false,
        canSeePresence: options.canSeePresence !== false, // Default true
        customPermissions: options.customPermissions || {}
      },
      
      // Validity
      issuedAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
      revocable: true,
      
      // Unique ID for this VC
      vcId: crypto.randomBytes(16).toString('hex')
    }
    
    // Sign the dedicated VC
    const { sign } = await import('@refinio/one.core/lib/crypto/sign.js')
    const signature = await sign(new TextEncoder().encode(JSON.stringify(dedicatedVC)), (keys as any).privateSignKey)
    
    return {
      ...dedicatedVC,
      signature: signature
    }
  }

  /**
   * Create ONE.core contact objects
   */
  async createOneContact(pendingContact: any, dedicatedVC: any): Promise<any> {
    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')

    // Create Person object
    const person = {
      $type$: 'Person' as const,
      name: pendingContact.displayInfo.name,
      email: `${pendingContact.credential.subject?.substring(0, 8)}@quic-vc.local`
    }

    const personHash = await storeVersionedObject(person as any)
    
    // Create Profile for the contact
    const profile = {
      $type$: 'Profile' as const,
      personDescriptions: [
        {
          $type$: 'PersonName' as const,
          name: pendingContact.displayInfo.name
        }
      ]
    }

    const profileHash = await storeVersionedObject(profile as any)

    // Create OneInstanceEndpoint for connection
    const endpoint = {
      $type$: 'OneInstanceEndpoint' as const,
      personId: pendingContact.credential.subject,
      instanceId: pendingContact.credential.instanceId,
      personKeys: { publicSignKey: pendingContact.credential.publicKey },
      instanceKeys: { publicSignKey: pendingContact.credential.publicKey }
    }

    const endpointHash = await storeVersionedObject(endpoint as any)

    // Add to contacts via LeuteModel
    if (this.nodeOneCore.leuteModel) {
      const { default: SomeoneModel } = await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')

      // Create Someone with both Person and Profile
      // SomeoneModel.constructWithNewSomeone expects (personHash, leuteModel)
      const someone = await SomeoneModel.constructWithNewSomeone(
        (personHash as any)?.idHash || personHash,
        this.nodeOneCore?.leuteModel
      )
      
      // Add to contacts
      await this.nodeOneCore.leuteModel.addSomeoneElse(someone.idHash)
      
      console.log('[ContactAcceptanceManager] Contact added to LeuteModel')
      
      return {
        personHash: personHash,
        someoneHash: someone.idHash,
        profileHash: profileHash,
        person: person,
        profile: profile,
        someone: someone
      }
    }
    
    return {
      personHash: personHash,
      profileHash: profileHash,
      person: person,
      profile: profile
    }
  }

  /**
   * Send dedicated VC to the contact
   */
  async sendDedicatedVC(peerId: any, dedicatedVC: any): Promise<any> {
    // This would be sent through the QUIC transport
    if (this.nodeOneCore.quicTransport) {
      const message = {
        type: 'dedicated_vc',
        vc: dedicatedVC,
        timestamp: Date.now()
      }
      
      await this.nodeOneCore.quicTransport.sendToPeer(peerId, message, 'dedicated_vc')
      
      console.log('[ContactAcceptanceManager] Dedicated VC sent to peer:', peerId)
    }
  }

  /**
   * Send rejection notice to peer
   */
  async sendRejectionNotice(peerId: any, reason: any): Promise<any> {
    if (this.nodeOneCore.quicTransport) {
      const message = {
        type: 'contact_rejected',
        reason: reason,
        timestamp: Date.now()
      }
      
      await this.nodeOneCore.quicTransport.sendToPeer(peerId, message, 'contact_rejected')
      
      console.log('[ContactAcceptanceManager] Rejection notice sent to peer:', peerId)
    }
  }

  /**
   * Handle received dedicated VC from a contact
   */
  async handleReceivedDedicatedVC(dedicatedVC: any, peerId: any): Promise<any> {
    console.log('[ContactAcceptanceManager] Received dedicated VC from:', peerId)
    
    try {
      // Verify the VC
      const { signatureVerify: verify } = await import('@refinio/one.core/lib/crypto/sign.js')
      
      const vcCopy = { ...dedicatedVC }
      delete vcCopy.signature
      
      // Convert JSON string to Uint8Array for signature verification
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(JSON.stringify(vcCopy))

      const isValid = await verify(
        dataBuffer,
        dedicatedVC.signature,
        dedicatedVC.contactInfo.publicKey
      )
      
      if (!isValid) {
        console.error('[ContactAcceptanceManager] Invalid dedicated VC signature')
        return
      }
      
      // Store the received dedicated VC
      const personId = dedicatedVC.issuer
      this.contactVCs.set(personId, dedicatedVC)
      
      // Update the accepted contact if it exists
      const acceptedContact = this.acceptedContacts.get(personId)
      if (acceptedContact) {
        acceptedContact.receivedDedicatedVC = dedicatedVC
        acceptedContact.mutuallyAccepted = true
      }
      
      console.log('[ContactAcceptanceManager] ✅ Dedicated VC stored for:', personId)
      
      // Emit event
      this.emit('dedicated-vc-received', {
        personId: personId,
        dedicatedVC: dedicatedVC,
        peerId: peerId
      })
      
    } catch (error) {
      console.error('[ContactAcceptanceManager] Failed to handle dedicated VC:', error)
    }
  }

  /**
   * Get contact's dedicated VC
   */
  getContactVC(personId: any): any {
    return this.contactVCs.get(personId)
  }

  /**
   * Check if a contact is mutually accepted
   */
  isMutuallyAccepted(personId: any): any {
    const contact = this.acceptedContacts.get(personId)
    return contact?.mutuallyAccepted || false
  }

  /**
   * Revoke a contact's VC
   */
  async revokeContactVC(personId: any): Promise<any> {
    const vc = this.contactVCs.get(personId)
    if (!vc) {
      throw new Error('No VC found for contact')
    }
    
    // Mark as revoked
    vc.revoked = true
    vc.revokedAt = Date.now()
    
    // Remove from accepted contacts
    this.acceptedContacts.delete(personId)
    
    // Emit event
    this.emit('contact-vc-revoked', {
      personId: personId,
      revokedAt: vc.revokedAt
    })
    
    console.log('[ContactAcceptanceManager] Contact VC revoked:', personId)
    
    return true
  }
}

export default ContactAcceptanceManager;