/**
 * Registration Plan (Pure Business Logic)
 *
 * Platform-agnostic plan for multi-stage patient/staff registration.
 * Handles profile creation, medical data collection, and consent management.
 */
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import type QuestionnaireModel from '@refinio/one.models/lib/models/QuestionnaireModel.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
export interface SaveStageDataRequest {
    stage: string;
    data: any;
}
export interface SaveStageDataResponse {
    success: boolean;
    error?: string;
}
export interface GetStageDataRequest {
    stage: string;
}
export interface GetStageDataResponse {
    success: boolean;
    data?: any;
    error?: string;
}
export interface FinalizeRegistrationRequest {
    email: string;
    password: string;
    registrationData: {
        name?: string;
        birthday?: string;
        gender?: string;
        diagnoses?: string[];
        admissionScore?: number;
        dismissalScore?: number;
        mrsScore?: number;
        barthelIndex?: number;
        preExistingConditions?: string[];
        premedication?: string;
        dischargeMedication?: string;
    };
    role?: 'patient' | 'staff';
    physicianId?: SHA256IdHash<Person>;
    physicianName?: string;
    clinicName?: string;
}
export interface FinalizeRegistrationResponse {
    success: boolean;
    personId?: SHA256IdHash<Person>;
    topicId?: string;
    error?: string;
}
export interface PostConsentRequest {
    termsOfUseMarkdown: string;
    privacyPolicyMarkdown: string;
}
export interface PostConsentResponse {
    success: boolean;
    termsDocumentHash?: string;
    privacyDocumentHash?: string;
    error?: string;
}
export interface SetupProfileRequest {
    name: string;
    email: string;
    birthday?: string;
    gender?: string;
}
export interface SetupProfileResponse {
    success: boolean;
    personId?: SHA256IdHash<Person>;
    error?: string;
}
/**
 * RegistrationPlan - Platform-agnostic registration business logic
 *
 * Handles:
 * - Multi-stage form state management (via QuestionnaireModel incomplete responses)
 * - Profile creation with PersonName, Email, etc.
 * - Medical questionnaire submission
 * - Consent document storage
 *
 * Principles:
 * - Fail fast, no fallbacks
 * - Dependency injection for ONE.core models
 * - All operations async
 */
export declare class RegistrationPlan {
    private leuteModel;
    private questionnaireModel;
    private storeVersionedObject;
    private storeUnversionedObject;
    private chatInitPlan?;
    constructor(leuteModel: LeuteModel, questionnaireModel: QuestionnaireModel, coreUtils: {
        storeVersionedObject: any;
        storeUnversionedObject: any;
    }, chatInitPlan?: any);
    /**
     * Save stage data as incomplete questionnaire response
     * This allows resuming multi-stage forms
     */
    saveStageData(request: SaveStageDataRequest): Promise<SaveStageDataResponse>;
    /**
     * Get stage data from incomplete questionnaire response
     */
    getStageData(request: GetStageDataRequest): Promise<GetStageDataResponse>;
    /**
     * Finalize registration - create profile, post medical questionnaire, and cleanup
     */
    finalizeRegistration(request: FinalizeRegistrationRequest): Promise<FinalizeRegistrationResponse>;
    /**
     * Setup user profile with PersonName and Email
     */
    setupProfile(request: SetupProfileRequest): Promise<SetupProfileResponse>;
    /**
     * Post consent documents (terms of use, privacy policy)
     */
    postConsent(request: PostConsentRequest): Promise<PostConsentResponse>;
    /**
     * Check if registration data contains medical information
     */
    private hasMedicalData;
    /**
     * Post medical questionnaire response
     */
    private postMedicalQuestionnaire;
    /**
     * Clean up all incomplete registration responses
     */
    private cleanupIncompleteResponses;
}
//# sourceMappingURL=RegistrationPlan.d.ts.map