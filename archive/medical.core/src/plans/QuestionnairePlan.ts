/**
 * Questionnaire Plan (Pure Business Logic)
 *
 * Platform-agnostic plan for questionnaire operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 */

import type QuestionnaireModel from '@refinio/one.models/lib/models/QuestionnaireModel.js';
import type {
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponses
} from '@refinio/one.models/lib/models/QuestionnaireModel.js';
import type { ObjectData } from '@refinio/one.models/lib/models/ChannelManager.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

// ============================================================================
// Request/Response Types
// ============================================================================

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
  // Note: QuestionnaireModel.responses() takes no parameters
  // If we need filtering, we'll need to implement it here
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

// ============================================================================
// Questionnaire Plan
// ============================================================================

/**
 * QuestionnairePlan - Platform-agnostic questionnaire business logic
 *
 * Principles:
 * - Fail fast, no fallbacks
 * - Dependency injection for ONE.core models
 * - All operations async
 */
export class QuestionnairePlan {
  private questionnaireModel: QuestionnaireModel;

  constructor(questionnaireModel: QuestionnaireModel) {
    this.questionnaireModel = questionnaireModel;
  }

  /**
   * Register questionnaires in memory
   * Note: Questionnaires are NOT stored in ONE.core, only in-memory
   */
  async registerQuestionnaires(request: RegisterQuestionnairesRequest): Promise<RegisterQuestionnairesResponse> {
    try {
      if (!request.questionnaires || request.questionnaires.length === 0) {
        return { success: false, error: 'No questionnaires provided' };
      }

      await this.questionnaireModel.registerQuestionnaires(request.questionnaires);

      console.log(`[QuestionnairePlan] ✅ Registered ${request.questionnaires.length} questionnaires`);
      return { success: true };
    } catch (error) {
      console.error('[QuestionnairePlan] Error registering questionnaires:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Post completed questionnaire response
   * Stores in ONE.core and syncs via channels
   */
  async postResponse(request: PostResponseRequest): Promise<PostResponseResponse> {
    try {
      if (!request.response) {
        return { success: false, error: 'No response provided' };
      }

      if (!request.questionnaireName) {
        return { success: false, error: 'Questionnaire name required' };
      }

      // Post to QuestionnaireModel channel
      const responseHash = await this.questionnaireModel.postResponse(
        request.response,
        request.questionnaireName,
        request.questionnaireType,
        request.channelOwner
      );

      console.log(`[QuestionnairePlan] ✅ Posted questionnaire response: ${responseHash.substring(0, 8)}...`);

      return {
        success: true,
        responseHash: String(responseHash)
      };
    } catch (error) {
      console.error('[QuestionnairePlan] Error posting response:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all completed questionnaire responses
   * Note: QuestionnaireModel.responses() returns all responses without filtering
   */
  async getResponses(request: GetResponsesRequest): Promise<GetResponsesResponse> {
    try {
      const responses = await this.questionnaireModel.responses();

      return {
        success: true,
        responses
      };
    } catch (error) {
      console.error('[QuestionnairePlan] Error getting responses:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get incomplete questionnaire response (for multi-stage forms)
   */
  async getIncompleteResponse(request: GetIncompleteResponseRequest): Promise<GetIncompleteResponseResponse> {
    try {
      if (!request.questionnaireType) {
        return { success: false, error: 'Questionnaire type required' };
      }

      const response = await this.questionnaireModel.incompleteResponse(
        request.questionnaireType,
        request.since
      );

      return {
        success: true,
        response
      };
    } catch (error) {
      console.error('[QuestionnairePlan] Error getting incomplete response:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Post incomplete questionnaire response (auto-save during multi-stage forms)
   */
  async postIncompleteResponse(request: PostIncompleteResponseRequest): Promise<PostIncompleteResponseResponse> {
    try {
      if (!request.response) {
        return { success: false, error: 'No response provided' };
      }

      if (!request.questionnaireType) {
        return { success: false, error: 'Questionnaire type required' };
      }

      await this.questionnaireModel.postIncompleteResponse(
        request.response,
        request.questionnaireType,
        request.name
      );

      console.log(`[QuestionnairePlan] ✅ Saved incomplete response for: ${request.questionnaireType}`);

      return { success: true };
    } catch (error) {
      console.error('[QuestionnairePlan] Error posting incomplete response:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Mark incomplete response as complete (removes from incomplete channel)
   */
  async markIncompleteResponseAsComplete(request: MarkIncompleteResponseAsCompleteRequest): Promise<MarkIncompleteResponseAsCompleteResponse> {
    try {
      if (!request.questionnaireType) {
        return { success: false, error: 'Questionnaire type required' };
      }

      await this.questionnaireModel.markIncompleteResponseAsComplete(request.questionnaireType);

      console.log(`[QuestionnairePlan] ✅ Marked incomplete response as complete: ${request.questionnaireType}`);

      return { success: true };
    } catch (error) {
      console.error('[QuestionnairePlan] Error marking incomplete response as complete:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get questionnaire definition by name and language
   */
  async getQuestionnaireByName(request: GetQuestionnaireByNameRequest): Promise<GetQuestionnaireByNameResponse> {
    try {
      if (!request.name) {
        return { success: false, error: 'Questionnaire name required' };
      }

      const questionnaire = await this.questionnaireModel.questionnaireByName(
        request.name,
        request.language
      );

      return {
        success: true,
        questionnaire
      };
    } catch (error) {
      console.error('[QuestionnairePlan] Error getting questionnaire by name:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if questionnaire exists
   */
  async hasQuestionnaire(request: HasQuestionnaireRequest): Promise<HasQuestionnaireResponse> {
    try {
      if (!request.url) {
        return { success: false, error: 'Questionnaire URL required' };
      }

      const exists = await this.questionnaireModel.hasQuestionnaireWithUrl(request.url);

      return {
        success: true,
        exists
      };
    } catch (error) {
      console.error('[QuestionnairePlan] Error checking questionnaire existence:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}
