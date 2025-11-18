/**
 * Registration Plan (Pure Business Logic)
 *
 * Platform-agnostic plan for multi-stage patient/staff registration.
 * Handles profile creation, medical data collection, and consent management.
 */
// ============================================================================
// Registration Plan
// ============================================================================
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
export class RegistrationPlan {
    leuteModel;
    questionnaireModel;
    storeVersionedObject;
    storeUnversionedObject;
    chatInitPlan; // Optional ChatInitializationPlan
    constructor(leuteModel, questionnaireModel, coreUtils, chatInitPlan // Optional: ChatInitializationPlan for auto-chat creation
    ) {
        this.leuteModel = leuteModel;
        this.questionnaireModel = questionnaireModel;
        this.storeVersionedObject = coreUtils.storeVersionedObject;
        this.storeUnversionedObject = coreUtils.storeUnversionedObject;
        this.chatInitPlan = chatInitPlan;
    }
    /**
     * Save stage data as incomplete questionnaire response
     * This allows resuming multi-stage forms
     */
    async saveStageData(request) {
        try {
            if (!request.stage) {
                return { success: false, error: 'Stage identifier required' };
            }
            // Use QuestionnaireModel's incomplete response feature
            // Type is the stage identifier (e.g., "registration-birthday")
            await this.questionnaireModel.postIncompleteResponse(request.data, `registration-${request.stage}`, 'Flexibel Registration');
            console.log(`[RegistrationPlan] ✅ Saved stage data: ${request.stage}`);
            return { success: true };
        }
        catch (error) {
            console.error('[RegistrationPlan] Error saving stage data:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Get stage data from incomplete questionnaire response
     */
    async getStageData(request) {
        try {
            if (!request.stage) {
                return { success: false, error: 'Stage identifier required' };
            }
            const response = await this.questionnaireModel.incompleteResponse(`registration-${request.stage}`);
            return {
                success: true,
                data: response ? response.data : null
            };
        }
        catch (error) {
            console.error('[RegistrationPlan] Error getting stage data:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Finalize registration - create profile, post medical questionnaire, and cleanup
     */
    async finalizeRegistration(request) {
        try {
            // Validate required fields
            if (!request.email) {
                return { success: false, error: 'Email is required' };
            }
            // Step 1: Setup profile with name and email
            const profileResult = await this.setupProfile({
                name: request.registrationData.name || 'Flexibel User',
                email: request.email,
                birthday: request.registrationData.birthday,
                gender: request.registrationData.gender
            });
            if (!profileResult.success || !profileResult.personId) {
                return { success: false, error: profileResult.error || 'Failed to create profile' };
            }
            console.log(`[RegistrationPlan] ✅ Profile created: ${profileResult.personId.substring(0, 8)}...`);
            // Step 2: Post medical questionnaire response (if patient)
            if (request.role === 'patient' && this.hasMedicalData(request.registrationData)) {
                await this.postMedicalQuestionnaire(request.registrationData, profileResult.personId);
            }
            // Step 3: Clean up incomplete responses
            await this.cleanupIncompleteResponses();
            // Step 4: Auto-create chat with physician if specified (patients only)
            let topicId;
            if (request.role === 'patient' && request.physicianId && this.chatInitPlan) {
                try {
                    console.log(`[RegistrationPlan] Creating chat with physician: ${request.physicianId.substring(0, 8)}`);
                    const chatResult = await this.chatInitPlan.createPatientPhysicianChat(profileResult.personId, request.physicianId, {
                        physicianName: request.physicianName,
                        clinicName: request.clinicName
                    });
                    if (chatResult.success) {
                        topicId = chatResult.topicId;
                        console.log(`[RegistrationPlan] ✅ Chat created: ${topicId}`);
                    }
                    else {
                        console.warn(`[RegistrationPlan] Failed to create chat: ${chatResult.error}`);
                        // Non-critical - registration still succeeds
                    }
                }
                catch (chatError) {
                    console.warn(`[RegistrationPlan] Error creating chat:`, chatError);
                    // Non-critical - registration still succeeds
                }
            }
            console.log(`[RegistrationPlan] ✅ Registration finalized for: ${request.email}`);
            return {
                success: true,
                personId: profileResult.personId,
                topicId
            };
        }
        catch (error) {
            console.error('[RegistrationPlan] Error finalizing registration:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Setup user profile with PersonName and Email
     */
    async setupProfile(request) {
        try {
            if (!request.name) {
                return { success: false, error: 'Name is required' };
            }
            if (!request.email) {
                return { success: false, error: 'Email is required' };
            }
            // Get current user's profile
            const me = await this.leuteModel.me();
            if (!me) {
                return { success: false, error: 'User not authenticated' };
            }
            const profile = await me.mainProfile();
            // Initialize personDescriptions and communicationEndpoints if not present
            profile.personDescriptions = profile.personDescriptions || [];
            profile.communicationEndpoints = profile.communicationEndpoints || [];
            // Add PersonName to personDescriptions
            profile.personDescriptions.push({
                $type$: 'PersonName',
                name: request.name
            });
            // Add Email to communicationEndpoints (not personDescriptions)
            profile.communicationEndpoints.push({
                $type$: 'Email',
                email: request.email
            });
            // NOTE: Birthday and Gender are stored in the medical questionnaire response,
            // not in the profile. They will be included in the QuestionnaireResponse items.
            // Save profile
            await profile.saveAndLoad();
            const personId = profile.personId;
            console.log(`[RegistrationPlan] ✅ Profile setup complete for: ${request.email}`);
            return {
                success: true,
                personId
            };
        }
        catch (error) {
            console.error('[RegistrationPlan] Error setting up profile:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Post consent documents (terms of use, privacy policy)
     */
    async postConsent(request) {
        try {
            if (!request.termsOfUseMarkdown) {
                return { success: false, error: 'Terms of Use markdown is required' };
            }
            if (!request.privacyPolicyMarkdown) {
                return { success: false, error: 'Privacy Policy markdown is required' };
            }
            // Store terms of use document
            const termsDocument = {
                $type$: 'Document',
                title: 'Terms of Use',
                content: request.termsOfUseMarkdown,
                contentType: 'text/markdown',
                created: new Date().toISOString()
            };
            const termsHash = await this.storeVersionedObject(termsDocument);
            // Store privacy policy document
            const privacyDocument = {
                $type$: 'Document',
                title: 'Privacy Policy',
                content: request.privacyPolicyMarkdown,
                contentType: 'text/markdown',
                created: new Date().toISOString()
            };
            const privacyHash = await this.storeVersionedObject(privacyDocument);
            console.log(`[RegistrationPlan] ✅ Consent documents posted`);
            return {
                success: true,
                termsDocumentHash: String(termsHash),
                privacyDocumentHash: String(privacyHash)
            };
        }
        catch (error) {
            console.error('[RegistrationPlan] Error posting consent documents:', error);
            return { success: false, error: error.message };
        }
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Check if registration data contains medical information
     */
    hasMedicalData(data) {
        return !!(data.diagnoses ||
            data.admissionScore !== undefined ||
            data.dismissalScore !== undefined ||
            data.mrsScore !== undefined ||
            data.barthelIndex !== undefined ||
            data.preExistingConditions ||
            data.premedication ||
            data.dischargeMedication);
    }
    /**
     * Post medical questionnaire response
     */
    async postMedicalQuestionnaire(data, channelOwner) {
        // Build QuestionnaireResponse from collected data
        const response = {
            $type$: 'QuestionnaireResponse_2_0_0',
            resourceType: 'QuestionnaireResponse',
            status: 'completed',
            authored: new Date().toISOString(),
            item: []
        };
        // Add each medical field as a response item
        if (data.birthday) {
            response.item.push({
                linkId: 'birthday',
                answer: [{ valueDate: data.birthday }]
            });
        }
        if (data.gender) {
            response.item.push({
                linkId: 'gender',
                answer: [{ valueCoding: { code: data.gender, display: data.gender } }]
            });
        }
        if (data.diagnoses && data.diagnoses.length > 0) {
            response.item.push({
                linkId: 'diagnoses',
                answer: data.diagnoses.map((d) => ({ valueCoding: { code: d, display: d } }))
            });
        }
        if (data.admissionScore !== undefined) {
            response.item.push({
                linkId: 'admission',
                answer: [{ valueInteger: data.admissionScore }]
            });
        }
        if (data.dismissalScore !== undefined) {
            response.item.push({
                linkId: 'dismissal',
                answer: [{ valueInteger: data.dismissalScore }]
            });
        }
        if (data.mrsScore !== undefined) {
            response.item.push({
                linkId: 'mrs',
                answer: [{ valueInteger: data.mrsScore }]
            });
        }
        if (data.barthelIndex !== undefined) {
            response.item.push({
                linkId: 'barthelIndex',
                answer: [{ valueInteger: data.barthelIndex }]
            });
        }
        if (data.preExistingConditions && data.preExistingConditions.length > 0) {
            response.item.push({
                linkId: 'preExistingConditions',
                answer: data.preExistingConditions.map((c) => ({ valueCoding: { code: c, display: c } }))
            });
        }
        if (data.premedication) {
            response.item.push({
                linkId: 'premedication',
                answer: [{ valueString: data.premedication }]
            });
        }
        if (data.dischargeMedication) {
            response.item.push({
                linkId: 'dischargeMedication',
                answer: [{ valueString: data.dischargeMedication }]
            });
        }
        // Post the response
        await this.questionnaireModel.postResponse(response, 'Flexibel Registration', 'patient-registration', channelOwner);
        console.log(`[RegistrationPlan] ✅ Medical questionnaire posted`);
    }
    /**
     * Clean up all incomplete registration responses
     */
    async cleanupIncompleteResponses() {
        const stages = [
            'birthday',
            'gender',
            'diagnose',
            'admission',
            'dismissal',
            'mrs',
            'barthelIndex',
            'preExistingConditions',
            'premedication',
            'dischargeMedication',
            'email',
            'password'
        ];
        for (const stage of stages) {
            try {
                await this.questionnaireModel.markIncompleteResponseAsComplete(`registration-${stage}`);
            }
            catch (error) {
                // Non-fatal - continue cleanup
                console.warn(`[RegistrationPlan] Failed to clean up stage ${stage}:`, error);
            }
        }
        console.log(`[RegistrationPlan] ✅ Cleaned up incomplete responses`);
    }
}
//# sourceMappingURL=RegistrationPlan.js.map