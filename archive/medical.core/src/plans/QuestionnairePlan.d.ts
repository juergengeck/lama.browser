/**
 * Questionnaire Plan (Pure Business Logic)
 *
 * Platform-agnostic plan for questionnaire operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 */
import type QuestionnaireModel from '@refinio/one.models/lib/models/QuestionnaireModel.js';
import type { Questionnaire, QuestionnaireResponse, QuestionnaireResponses } from '@refinio/one.models/lib/models/QuestionnaireModel.js';
import type { ObjectData } from '@refinio/one.models/lib/models/ChannelManager.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
export interface RegisterQuestionnairesRequest {
    questionnaires: Questionnaire[];
}
export interface RegisterQuestionnairesResponse {
    success: boolean;
    error?: string;
}
export interface PostResponseRequest {
    response: QuestionnaireResponse;
    questionnaireName: string;
    questionnaireType?: string;
    channelOwner?: SHA256IdHash<Person>;
}
export interface PostResponseResponse {
    success: boolean;
    responseHash?: string;
    error?: string;
}
export interface GetResponsesRequest {
}
export interface GetResponsesResponse {
    success: boolean;
    responses?: ObjectData<QuestionnaireResponses>[];
    error?: string;
}
export interface GetIncompleteResponseRequest {
    questionnaireType: string;
    since?: Date;
}
export interface GetIncompleteResponseResponse {
    success: boolean;
    response?: ObjectData<QuestionnaireResponses> | null;
    error?: string;
}
export interface PostIncompleteResponseRequest {
    response: QuestionnaireResponse;
    questionnaireType: string;
    name?: string;
}
export interface PostIncompleteResponseResponse {
    success: boolean;
    error?: string;
}
export interface MarkIncompleteResponseAsCompleteRequest {
    questionnaireType: string;
}
export interface MarkIncompleteResponseAsCompleteResponse {
    success: boolean;
    error?: string;
}
export interface GetQuestionnaireByNameRequest {
    name: string;
    language?: string;
}
export interface GetQuestionnaireByNameResponse {
    success: boolean;
    questionnaire?: Questionnaire;
    error?: string;
}
export interface HasQuestionnaireRequest {
    url: string;
}
export interface HasQuestionnaireResponse {
    success: boolean;
    exists?: boolean;
    error?: string;
}
/**
 * QuestionnairePlan - Platform-agnostic questionnaire business logic
 *
 * Principles:
 * - Fail fast, no fallbacks
 * - Dependency injection for ONE.core models
 * - All operations async
 */
export declare class QuestionnairePlan {
    private questionnaireModel;
    constructor(questionnaireModel: QuestionnaireModel);
    /**
     * Register questionnaires in memory
     * Note: Questionnaires are NOT stored in ONE.core, only in-memory
     */
    registerQuestionnaires(request: RegisterQuestionnairesRequest): Promise<RegisterQuestionnairesResponse>;
    /**
     * Post completed questionnaire response
     * Stores in ONE.core and syncs via channels
     */
    postResponse(request: PostResponseRequest): Promise<PostResponseResponse>;
    /**
     * Get all completed questionnaire responses
     * Note: QuestionnaireModel.responses() returns all responses without filtering
     */
    getResponses(request: GetResponsesRequest): Promise<GetResponsesResponse>;
    /**
     * Get incomplete questionnaire response (for multi-stage forms)
     */
    getIncompleteResponse(request: GetIncompleteResponseRequest): Promise<GetIncompleteResponseResponse>;
    /**
     * Post incomplete questionnaire response (auto-save during multi-stage forms)
     */
    postIncompleteResponse(request: PostIncompleteResponseRequest): Promise<PostIncompleteResponseResponse>;
    /**
     * Mark incomplete response as complete (removes from incomplete channel)
     */
    markIncompleteResponseAsComplete(request: MarkIncompleteResponseAsCompleteRequest): Promise<MarkIncompleteResponseAsCompleteResponse>;
    /**
     * Get questionnaire definition by name and language
     */
    getQuestionnaireByName(request: GetQuestionnaireByNameRequest): Promise<GetQuestionnaireByNameResponse>;
    /**
     * Check if questionnaire exists
     */
    hasQuestionnaire(request: HasQuestionnaireRequest): Promise<HasQuestionnaireResponse>;
}
//# sourceMappingURL=QuestionnairePlan.d.ts.map