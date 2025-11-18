/**
 * Chat Initialization Plan
 *
 * Automatically creates and manages chat channels between patients and physicians.
 * This ensures immediate communication capability after patient registration or
 * role assignment.
 *
 * Features:
 * - P2P topic creation between patient and physician
 * - Channel access configuration
 * - Welcome message automation
 * - Multiple physician support
 */
/**
 * ChatInitializationPlan - Manages automatic chat setup for medical platform
 */
export class ChatInitializationPlan {
    topicModel;
    channelManager;
    leuteModel;
    grantP2PChannelAccess;
    constructor(topicModel, channelManager, leuteModel, grantP2PChannelAccess) {
        this.topicModel = topicModel;
        this.channelManager = channelManager;
        this.leuteModel = leuteModel;
        this.grantP2PChannelAccess = grantP2PChannelAccess;
    }
    /**
     * Create a chat channel between patient and physician
     *
     * @param patientId - Patient's person ID
     * @param physicianId - Physician's person ID
     * @param options - Optional welcome message customization
     * @returns Result with topic ID or error
     */
    async createPatientPhysicianChat(patientId, physicianId, options = {}) {
        console.log('[ChatInitPlan] Creating chat between patient and physician');
        console.log('[ChatInitPlan]   Patient:', patientId.substring(0, 8));
        console.log('[ChatInitPlan]   Physician:', physicianId.substring(0, 8));
        try {
            // Generate P2P topic ID (lexicographically sorted)
            const topicId = patientId < physicianId
                ? `${patientId}<->${physicianId}`
                : `${physicianId}<->${patientId}`;
            console.log('[ChatInitPlan] Topic ID:', topicId);
            // Check if topic already exists
            try {
                const existingRoom = await this.topicModel.enterTopicRoom(topicId);
                console.log('[ChatInitPlan] Chat already exists, skipping creation');
                return {
                    success: true,
                    topicId
                };
            }
            catch (error) {
                // Topic doesn't exist, proceed to create it
                console.log('[ChatInitPlan] Creating new P2P topic...');
            }
            // Create the P2P topic using TopicModel
            // This creates:
            // - A shared channel (null owner)
            // - Proper access for both participants
            // - The Topic object
            const topic = await this.topicModel.createOneToOneTopic(patientId, physicianId);
            console.log('[ChatInitPlan] ✅ P2P topic created');
            // Ensure the channel exists in ChannelManager
            await this.channelManager.createChannel(topicId, null); // null owner for P2P
            console.log('[ChatInitPlan] ✅ Channel created');
            // Grant person-specific access (not group access)
            await this.grantP2PChannelAccess(topicId, patientId, physicianId, this.channelManager);
            console.log('[ChatInitPlan] ✅ Access rights configured');
            // Enter the topic room to send welcome message
            const topicRoom = await this.topicModel.enterTopicRoom(topicId);
            // Send welcome message from physician's perspective
            const welcomeMessage = this.buildWelcomeMessage(options);
            try {
                // Send message with null channelOwner for P2P (shared channel)
                await topicRoom.sendMessage(welcomeMessage, undefined, null);
                console.log('[ChatInitPlan] ✅ Welcome message sent');
            }
            catch (msgError) {
                console.warn('[ChatInitPlan] Could not send welcome message:', msgError.message);
                // Non-critical error - chat is still created
            }
            return {
                success: true,
                topicId
            };
        }
        catch (error) {
            console.error('[ChatInitPlan] Failed to create patient-physician chat:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Create chat channels for a patient with multiple physicians
     *
     * @param patientId - Patient's person ID
     * @param physicianIds - Array of physician person IDs
     * @param options - Optional welcome message customization
     * @returns Array of results for each chat creation
     */
    async createPatientChatsWithPhysicians(patientId, physicianIds, options = {}) {
        console.log('[ChatInitPlan] Creating chats for patient with', physicianIds.length, 'physicians');
        const results = [];
        for (const physicianId of physicianIds) {
            const result = await this.createPatientPhysicianChat(patientId, physicianId, options);
            results.push(result);
        }
        const successCount = results.filter(r => r.success).length;
        console.log(`[ChatInitPlan] Created ${successCount}/${physicianIds.length} chats successfully`);
        return results;
    }
    /**
     * Get the topic ID for a patient-physician pair without creating it
     *
     * @param patientId - Patient's person ID
     * @param physicianId - Physician's person ID
     * @returns Topic ID in P2P format
     */
    getPatientPhysicianTopicId(patientId, physicianId) {
        return patientId < physicianId
            ? `${patientId}<->${physicianId}`
            : `${physicianId}<->${patientId}`;
    }
    /**
     * Check if a chat exists between patient and physician
     *
     * @param patientId - Patient's person ID
     * @param physicianId - Physician's person ID
     * @returns True if chat exists, false otherwise
     */
    async chatExists(patientId, physicianId) {
        const topicId = this.getPatientPhysicianTopicId(patientId, physicianId);
        try {
            await this.topicModel.enterTopicRoom(topicId);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Build welcome message based on options
     *
     * @param options - Welcome message customization options
     * @returns Formatted welcome message
     */
    buildWelcomeMessage(options) {
        if (options.customMessage) {
            return options.customMessage;
        }
        const parts = ['Welcome to Flexibel!'];
        if (options.physicianName && options.clinicName) {
            parts.push(`This is your secure communication channel with ${options.physicianName} at ${options.clinicName}.`);
        }
        else if (options.physicianName) {
            parts.push(`This is your secure communication channel with ${options.physicianName}.`);
        }
        else if (options.clinicName) {
            parts.push(`This is your secure communication channel with your physician at ${options.clinicName}.`);
        }
        else {
            parts.push('This is your secure communication channel with your physician.');
        }
        parts.push('You can send messages, share medical data, and receive updates about your treatment plan.');
        parts.push('Your privacy and data security are our top priorities.');
        return parts.join('\n\n');
    }
    /**
     * Assign a default physician to a patient and create their chat
     *
     * This is typically called during patient registration when no specific
     * physician is assigned. It finds an available physician and sets up
     * the communication channel.
     *
     * @param patientId - Patient's person ID
     * @param defaultPhysicianId - Optional specific physician, otherwise uses first available
     * @returns Result with assigned physician ID and topic ID
     */
    async assignAndCreateChat(patientId, defaultPhysicianId) {
        console.log('[ChatInitPlan] Assigning physician and creating chat for patient');
        try {
            let physicianId = defaultPhysicianId;
            if (!physicianId) {
                // TODO: Implement physician selection logic
                // For now, this would need to be provided by the caller
                // In a production system, this could:
                // - Round-robin between available physicians
                // - Check physician workload
                // - Consider geographic location
                // - Apply specialty matching
                throw new Error('No default physician ID provided - physician selection not yet implemented');
            }
            const result = await this.createPatientPhysicianChat(patientId, physicianId);
            return {
                ...result,
                physicianId
            };
        }
        catch (error) {
            console.error('[ChatInitPlan] Failed to assign and create chat:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
//# sourceMappingURL=ChatInitializationPlan.js.map