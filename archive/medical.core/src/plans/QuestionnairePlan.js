/**
 * Questionnaire Plan (Pure Business Logic)
 *
 * Platform-agnostic plan for questionnaire operations.
 * Can be used from both Electron IPC and Web Worker contexts.
 */
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
    questionnaireModel;
    constructor(questionnaireModel) {
        this.questionnaireModel = questionnaireModel;
    }
    /**
     * Register questionnaires in memory
     * Note: Questionnaires are NOT stored in ONE.core, only in-memory
     */
    async registerQuestionnaires(request) {
        try {
            if (!request.questionnaires || request.questionnaires.length === 0) {
                return { success: false, error: 'No questionnaires provided' };
            }
            await this.questionnaireModel.registerQuestionnaires(request.questionnaires);
            console.log(`[QuestionnairePlan] ✅ Registered ${request.questionnaires.length} questionnaires`);
            return { success: true };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error registering questionnaires:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Post completed questionnaire response
     * Stores in ONE.core and syncs via channels
     */
    async postResponse(request) {
        try {
            if (!request.response) {
                return { success: false, error: 'No response provided' };
            }
            if (!request.questionnaireName) {
                return { success: false, error: 'Questionnaire name required' };
            }
            // Post to QuestionnaireModel channel
            const responseHash = await this.questionnaireModel.postResponse(request.response, request.questionnaireName, request.questionnaireType, request.channelOwner);
            console.log(`[QuestionnairePlan] ✅ Posted questionnaire response: ${responseHash.substring(0, 8)}...`);
            return {
                success: true,
                responseHash: String(responseHash)
            };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error posting response:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get all completed questionnaire responses
     * Note: QuestionnaireModel.responses() returns all responses without filtering
     */
    async getResponses(request) {
        try {
            const responses = await this.questionnaireModel.responses();
            return {
                success: true,
                responses
            };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error getting responses:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get incomplete questionnaire response (for multi-stage forms)
     */
    async getIncompleteResponse(request) {
        try {
            if (!request.questionnaireType) {
                return { success: false, error: 'Questionnaire type required' };
            }
            const response = await this.questionnaireModel.incompleteResponse(request.questionnaireType, request.since);
            return {
                success: true,
                response
            };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error getting incomplete response:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Post incomplete questionnaire response (auto-save during multi-stage forms)
     */
    async postIncompleteResponse(request) {
        try {
            if (!request.response) {
                return { success: false, error: 'No response provided' };
            }
            if (!request.questionnaireType) {
                return { success: false, error: 'Questionnaire type required' };
            }
            await this.questionnaireModel.postIncompleteResponse(request.response, request.questionnaireType, request.name);
            console.log(`[QuestionnairePlan] ✅ Saved incomplete response for: ${request.questionnaireType}`);
            return { success: true };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error posting incomplete response:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Mark incomplete response as complete (removes from incomplete channel)
     */
    async markIncompleteResponseAsComplete(request) {
        try {
            if (!request.questionnaireType) {
                return { success: false, error: 'Questionnaire type required' };
            }
            await this.questionnaireModel.markIncompleteResponseAsComplete(request.questionnaireType);
            console.log(`[QuestionnairePlan] ✅ Marked incomplete response as complete: ${request.questionnaireType}`);
            return { success: true };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error marking incomplete response as complete:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get questionnaire definition by name and language
     */
    async getQuestionnaireByName(request) {
        try {
            if (!request.name) {
                return { success: false, error: 'Questionnaire name required' };
            }
            const questionnaire = await this.questionnaireModel.questionnaireByName(request.name, request.language);
            return {
                success: true,
                questionnaire
            };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error getting questionnaire by name:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Check if questionnaire exists
     */
    async hasQuestionnaire(request) {
        try {
            if (!request.url) {
                return { success: false, error: 'Questionnaire URL required' };
            }
            const exists = await this.questionnaireModel.hasQuestionnaireWithUrl(request.url);
            return {
                success: true,
                exists
            };
        }
        catch (error) {
            console.error('[QuestionnairePlan] Error checking questionnaire existence:', error);
            return { success: false, error: error.message };
        }
    }
}
//# sourceMappingURL=QuestionnairePlan.js.map