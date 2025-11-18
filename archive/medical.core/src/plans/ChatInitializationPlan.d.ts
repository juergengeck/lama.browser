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
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
interface TopicModel {
    createOneToOneTopic: (person1Id: SHA256IdHash<any>, person2Id: SHA256IdHash<any>) => Promise<any>;
    enterTopicRoom: (topicId: string) => Promise<any>;
}
interface ChannelManager {
    createChannel: (channelId: string, owner: SHA256IdHash<any> | null) => Promise<any>;
}
interface LeuteModel {
    me: () => Promise<any>;
}
interface ChatInitResult {
    success: boolean;
    topicId?: string;
    error?: string;
}
interface WelcomeMessageOptions {
    physicianName?: string;
    clinicName?: string;
    customMessage?: string;
}
/**
 * ChatInitializationPlan - Manages automatic chat setup for medical platform
 */
export declare class ChatInitializationPlan {
    private topicModel;
    private channelManager;
    private leuteModel;
    private grantP2PChannelAccess;
    constructor(topicModel: TopicModel, channelManager: ChannelManager, leuteModel: LeuteModel, grantP2PChannelAccess: (channelId: string, localPersonId: SHA256IdHash<any>, remotePersonId: SHA256IdHash<any>, channelManager: ChannelManager) => Promise<void>);
    /**
     * Create a chat channel between patient and physician
     *
     * @param patientId - Patient's person ID
     * @param physicianId - Physician's person ID
     * @param options - Optional welcome message customization
     * @returns Result with topic ID or error
     */
    createPatientPhysicianChat(patientId: SHA256IdHash<any>, physicianId: SHA256IdHash<any>, options?: WelcomeMessageOptions): Promise<ChatInitResult>;
    /**
     * Create chat channels for a patient with multiple physicians
     *
     * @param patientId - Patient's person ID
     * @param physicianIds - Array of physician person IDs
     * @param options - Optional welcome message customization
     * @returns Array of results for each chat creation
     */
    createPatientChatsWithPhysicians(patientId: SHA256IdHash<any>, physicianIds: SHA256IdHash<any>[], options?: WelcomeMessageOptions): Promise<ChatInitResult[]>;
    /**
     * Get the topic ID for a patient-physician pair without creating it
     *
     * @param patientId - Patient's person ID
     * @param physicianId - Physician's person ID
     * @returns Topic ID in P2P format
     */
    getPatientPhysicianTopicId(patientId: SHA256IdHash<any>, physicianId: SHA256IdHash<any>): string;
    /**
     * Check if a chat exists between patient and physician
     *
     * @param patientId - Patient's person ID
     * @param physicianId - Physician's person ID
     * @returns True if chat exists, false otherwise
     */
    chatExists(patientId: SHA256IdHash<any>, physicianId: SHA256IdHash<any>): Promise<boolean>;
    /**
     * Build welcome message based on options
     *
     * @param options - Welcome message customization options
     * @returns Formatted welcome message
     */
    private buildWelcomeMessage;
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
    assignAndCreateChat(patientId: SHA256IdHash<any>, defaultPhysicianId?: SHA256IdHash<any>): Promise<ChatInitResult & {
        physicianId?: SHA256IdHash<any>;
    }>;
}
export {};
//# sourceMappingURL=ChatInitializationPlan.d.ts.map