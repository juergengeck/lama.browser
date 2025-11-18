/**
 * Role Plan (Pure Business Logic)
 *
 * Platform-agnostic plan for medical role management.
 * Handles patient/physician/admin role assignment with certificate-based trust.
 */
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { HexString } from '@refinio/one.core/lib/util/arraybuffer-to-and-from-hex-string.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
export interface AssignPatientRoleRequest {
    patientId: SHA256IdHash<Person>;
    issuerId: SHA256IdHash<Person>;
    createChat?: boolean;
    physicianName?: string;
    clinicName?: string;
}
export interface AssignPatientRoleResponse {
    success: boolean;
    certificateHash?: string;
    topicId?: string;
    error?: string;
}
export interface AssignPhysicianRoleRequest {
    physicianId: SHA256IdHash<Person>;
    clinicName?: string;
}
export interface AssignPhysicianRoleResponse {
    success: boolean;
    certificateHash?: string;
    error?: string;
}
export interface GetPatientsRequest {
    physicianId?: SHA256IdHash<Person>;
}
export interface GetPatientsResponse {
    success: boolean;
    patients?: Array<{
        personId: string;
        name: string;
        email?: string;
        certificateHash: string;
    }>;
    error?: string;
}
export interface GetPhysiciansRequest {
}
export interface GetPhysiciansResponse {
    success: boolean;
    physicians?: Array<{
        personId: string;
        name: string;
        email?: string;
        certificateHash: string;
    }>;
    error?: string;
}
export interface ShareChannelWithPatientRequest {
    patientId: SHA256IdHash<Person>;
    channelId: string;
    channelOwner: SHA256IdHash<Person>;
}
export interface ShareChannelWithPatientResponse {
    success: boolean;
    error?: string;
}
export interface ValidateRoleRequest {
    personId: SHA256IdHash<Person>;
    role: 'patient' | 'physician' | 'admin';
}
export interface ValidateRoleResponse {
    success: boolean;
    valid: boolean;
    certificateHash?: string;
    error?: string;
}
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
export declare class RolePlan {
    private leuteModel;
    private channelManager;
    private createAccess;
    private calculateIdHashOfObj;
    private rootOfTrustKeys;
    private chatInitPlan?;
    constructor(leuteModel: LeuteModel, channelManager: ChannelManager, coreUtils: {
        createAccess: any;
        calculateIdHashOfObj: any;
    }, config?: {
        rootOfTrustKeys?: HexString[];
    }, chatInitPlan?: any);
    /**
     * Assign patient role to a person
     * Issues a RelationCertificate signed by the physician
     */
    assignPatientRole(request: AssignPatientRoleRequest): Promise<AssignPatientRoleResponse>;
    /**
     * Assign physician role to a person
     * Issues a RelationCertificate for the physician
     */
    assignPhysicianRole(request: AssignPhysicianRoleRequest): Promise<AssignPhysicianRoleResponse>;
    /**
     * Get all patients (filtered by physician if provided)
     */
    getPatients(request: GetPatientsRequest): Promise<GetPatientsResponse>;
    /**
     * Get all physicians in the system
     */
    getPhysicians(request: GetPhysiciansRequest): Promise<GetPhysiciansResponse>;
    /**
     * Share a channel with a patient
     * Used by physicians to share additional data channels
     */
    shareChannelWithPatient(request: ShareChannelWithPatientRequest): Promise<ShareChannelWithPatientResponse>;
    /**
     * Validate if a person has a specific role
     */
    validateRole(request: ValidateRoleRequest): Promise<ValidateRoleResponse>;
    /**
     * Share patient's questionnaire channels with physician
     * Channels: questionnaireResponse, bodyTemperature, diary, wbcDiff, document
     */
    private sharePatientChannels;
}
//# sourceMappingURL=RolePlan.d.ts.map