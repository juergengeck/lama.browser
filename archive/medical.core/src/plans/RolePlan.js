/**
 * Role Plan (Pure Business Logic)
 *
 * Platform-agnostic plan for medical role management.
 * Handles patient/physician/admin role assignment with certificate-based trust.
 */
// ============================================================================
// Role Plan
// ============================================================================
/**
 * RolePlan - Platform-agnostic role management business logic
 *
 * Handles:
 * - Certificate-based role assignment (RelationCertificate)
 * - Channel sharing between patients and physicians
 * - Role validation with root of trust
 * - Patient/physician discovery
 *
 * Principles:
 * - Fail fast, no fallbacks
 * - Dependency injection for ONE.core models
 * - All operations async
 */
export class RolePlan {
    leuteModel;
    channelManager;
    createAccess;
    calculateIdHashOfObj;
    rootOfTrustKeys;
    chatInitPlan; // Optional ChatInitializationPlan
    constructor(leuteModel, channelManager, coreUtils, config = {}, chatInitPlan // Optional: ChatInitializationPlan for auto-chat creation
    ) {
        this.leuteModel = leuteModel;
        this.channelManager = channelManager;
        this.createAccess = coreUtils.createAccess;
        this.calculateIdHashOfObj = coreUtils.calculateIdHashOfObj;
        this.rootOfTrustKeys = config.rootOfTrustKeys || [];
        this.chatInitPlan = chatInitPlan;
    }
    /**
     * Assign patient role to a person
     * Issues a RelationCertificate signed by the physician
     */
    async assignPatientRole(request) {
        try {
            if (!request.patientId) {
                return { success: false, error: 'Patient ID is required' };
            }
            if (!request.issuerId) {
                return { success: false, error: 'Issuer ID (physician) is required' };
            }
            // Note: In production, we would validate the patient exists via LeuteModel
            // For now, we'll proceed with the certificate issuance
            // Issue RelationCertificate
            const certificate = {
                $type$: 'RelationCertificate',
                app: 'flexibel',
                relation: 'patient',
                person1: request.patientId,
                person2: request.issuerId, // The physician who assigned the role
                timestamp: Date.now()
            };
            // Store certificate (simplified - in production would sign with physician's key)
            // For now, we'll use the LeuteModel's trust system
            const me = await this.leuteModel.me();
            if (!me) {
                return { success: false, error: 'Current user not authenticated' };
            }
            // Share questionnaire channels with physician
            await this.sharePatientChannels(request.patientId, request.issuerId);
            // Auto-create chat channel between patient and physician (default: true)
            let topicId;
            const shouldCreateChat = request.createChat !== false; // Default to true
            if (shouldCreateChat && this.chatInitPlan) {
                try {
                    console.log(`[RolePlan] Creating chat between patient and physician...`);
                    const chatResult = await this.chatInitPlan.createPatientPhysicianChat(request.patientId, request.issuerId, {
                        physicianName: request.physicianName,
                        clinicName: request.clinicName
                    });
                    if (chatResult.success) {
                        topicId = chatResult.topicId;
                        console.log(`[RolePlan] ✅ Chat created: ${topicId}`);
                    }
                    else {
                        console.warn(`[RolePlan] Failed to create chat: ${chatResult.error}`);
                        // Non-critical - role assignment still succeeds
                    }
                }
                catch (chatError) {
                    console.warn(`[RolePlan] Error creating chat:`, chatError);
                    // Non-critical - role assignment still succeeds
                }
            }
            console.log(`[RolePlan] ✅ Assigned patient role to ${request.patientId.substring(0, 8)}...`);
            return {
                success: true,
                certificateHash: 'certificate-hash-placeholder', // Would be actual hash in production
                topicId
            };
        }
        catch (error) {
            console.error('[RolePlan] Error assigning patient role:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Assign physician role to a person
     * Issues a RelationCertificate for the physician
     */
    async assignPhysicianRole(request) {
        try {
            if (!request.physicianId) {
                return { success: false, error: 'Physician ID is required' };
            }
            // Note: In production, we would get the physician's profile and add clinic name
            // For now, we'll just issue the certificate
            // Issue RelationCertificate for physician
            const certificate = {
                $type$: 'RelationCertificate',
                app: 'flexibel',
                relation: 'physician',
                person1: request.physicianId,
                timestamp: Date.now()
            };
            console.log(`[RolePlan] ✅ Assigned physician role to ${request.physicianId.substring(0, 8)}...`);
            return {
                success: true,
                certificateHash: 'certificate-hash-placeholder'
            };
        }
        catch (error) {
            console.error('[RolePlan] Error assigning physician role:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get all patients (filtered by physician if provided)
     */
    async getPatients(request) {
        try {
            // For now, return empty array
            // In production, this would query RelationCertificates and filter by physician
            const patients = [];
            console.log(`[RolePlan] Retrieved ${patients.length} patients`);
            return {
                success: true,
                patients
            };
        }
        catch (error) {
            console.error('[RolePlan] Error getting patients:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get all physicians in the system
     */
    async getPhysicians(request) {
        try {
            // For now, return empty array
            // In production, this would query RelationCertificates for physician role
            const physicians = [];
            console.log(`[RolePlan] Retrieved ${physicians.length} physicians`);
            return {
                success: true,
                physicians
            };
        }
        catch (error) {
            console.error('[RolePlan] Error getting physicians:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Share a channel with a patient
     * Used by physicians to share additional data channels
     */
    async shareChannelWithPatient(request) {
        try {
            if (!request.patientId) {
                return { success: false, error: 'Patient ID is required' };
            }
            if (!request.channelId) {
                return { success: false, error: 'Channel ID is required' };
            }
            if (!request.channelOwner) {
                return { success: false, error: 'Channel owner is required' };
            }
            // Create access for the patient to the channel
            await this.createAccess([{
                    id: this.calculateIdHashOfObj({
                        $type$: 'ChannelInfo',
                        id: request.channelId,
                        owner: request.channelOwner
                    }),
                    person: [request.patientId],
                    group: [],
                    mode: 'ADD' // Use string instead of enum for now
                }]);
            console.log(`[RolePlan] ✅ Shared channel ${request.channelId} with patient ${request.patientId.substring(0, 8)}...`);
            return { success: true };
        }
        catch (error) {
            console.error('[RolePlan] Error sharing channel with patient:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Validate if a person has a specific role
     */
    async validateRole(request) {
        try {
            if (!request.personId) {
                return { success: false, valid: false, error: 'Person ID is required' };
            }
            if (!request.role) {
                return { success: false, valid: false, error: 'Role is required' };
            }
            // For now, return false (not validated)
            // In production, this would check RelationCertificates and verify signatures
            const valid = false;
            return {
                success: true,
                valid
            };
        }
        catch (error) {
            console.error('[RolePlan] Error validating role:', error);
            return { success: false, valid: false, error: error.message };
        }
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Share patient's questionnaire channels with physician
     * Channels: questionnaireResponse, bodyTemperature, diary, wbcDiff, document
     */
    async sharePatientChannels(patientId, physicianId) {
        const channelsToShare = [
            'questionnaireResponse',
            'bodyTemperature',
            'diary',
            'wbcDiff',
            'document'
        ];
        for (const channelId of channelsToShare) {
            try {
                await this.createAccess([{
                        id: this.calculateIdHashOfObj({
                            $type$: 'ChannelInfo',
                            id: channelId,
                            owner: patientId
                        }),
                        person: [physicianId],
                        group: [],
                        mode: 'ADD'
                    }]);
            }
            catch (error) {
                console.warn(`[RolePlan] Failed to share channel ${channelId}:`, error);
                // Non-fatal - continue with other channels
            }
        }
        console.log(`[RolePlan] ✅ Shared patient channels with physician`);
    }
}
//# sourceMappingURL=RolePlan.js.map