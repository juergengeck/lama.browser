/**
 * BrowserDocumentUploadPlan - Wires document upload plans to browser Model
 *
 * Integrates DocumentAIPlan and MessageAttachmentPlan with the browser Model,
 * providing document upload functionality for:
 * 1. FAB uploads - Creates new Document AI with dedicated chat
 * 2. Message ornament uploads - Adds document knowledge to existing chat
 */

import { DocumentAIPlan } from '@refinio/lama.core/plans/DocumentAIPlan.js';
import { MessageAttachmentPlan } from '@refinio/lama.core/plans/MessageAttachmentPlan.js';
import { DocumentExtractor } from '@refinio/lama.core/services/document-extraction/DocumentExtractor.js';
import type { ExtractionProgress } from '@refinio/lama.core/services/document-extraction/types.js';
import { storeArrayBufferAsBlob } from '@refinio/one.core/lib/storage-blob.js';

import type Model from '../model/Model';

/**
 * Browser-specific wrapper for document upload functionality
 *
 * Dependencies from Model:
 * - llmManager: For DocumentExtractor to analyze document content
 * - aiAssistantPlan: For creating AI identity (via ensureAIForModel)
 * - chatPlan: For creating conversations and sending messages
 * - chatMemoryPlan: For storing subjects/keywords in memory system
 */
export class BrowserDocumentUploadPlan {
    private documentAIPlan: DocumentAIPlan;
    private messageAttachmentPlan: MessageAttachmentPlan;
    private documentExtractor: DocumentExtractor;

    constructor(private model: Model) {
        // Create DocumentExtractor with LLM manager for content analysis
        this.documentExtractor = new DocumentExtractor(model.llmManager);

        // Create AI manager adapter that wraps AIAssistantPlan
        const aiManagerAdapter = {
            createAI: async (params: {
                displayName: string;
                personality: {
                    traits: string[];
                    systemPrompt: string;
                };
            }) => {
                try {
                    // Generate unique email for document AI
                    const aiId = this.generateAIId(params.displayName);
                    const email = `${aiId}@document.ai.local`;

                    // Use aiAssistantPlan.ensureAIForModel with document-specific personality
                    const defaultModelId = await model.aiAssistantPlan.getDefaultModel();
                    const personIdHash = await model.aiAssistantPlan.ensureAIForModel(
                        defaultModelId,
                        params.displayName,
                        email,
                        {
                            traits: params.personality.traits,
                            systemPromptAddition: params.personality.systemPrompt
                        }
                    );

                    return {
                        success: true,
                        personIdHash,
                        name: params.displayName
                    };
                } catch (error: any) {
                    console.error('[BrowserDocumentUploadPlan] Failed to create AI:', error);
                    return {
                        success: false,
                        error: error.message
                    };
                }
            }
        };

        // Create chat plan adapter that wraps ChatPlan
        const chatPlanAdapter = {
            createConversation: async (params: {
                name: string;
                participants: string[];
                type?: string;
            }) => {
                try {
                    const result = await model.chatPlan.createConversation({
                        name: params.name,
                        participants: params.participants,
                        type: params.type
                    });
                    return {
                        success: true,
                        topicId: result.topicId
                    };
                } catch (error: any) {
                    console.error('[BrowserDocumentUploadPlan] Failed to create conversation:', error);
                    return {
                        success: false,
                        error: error.message
                    };
                }
            },
            sendMessage: async (params: {
                topicId: string;
                text: string;
                senderPersonId: string;
                isAI?: boolean;
            }) => {
                try {
                    await model.chatPlan.sendMessage({
                        topicId: params.topicId,
                        content: params.text,
                        senderId: params.senderPersonId
                    });
                    return { success: true };
                } catch (error: any) {
                    console.error('[BrowserDocumentUploadPlan] Failed to send message:', error);
                    return { success: false, error: error.message };
                }
            }
        };

        // Create chat memory adapter
        const chatMemoryAdapter = {
            extractSubjects: async (params: {
                topicId: string;
                text: string;
                subjects: string[];
            }) => {
                try {
                    if (model.chatMemoryPlan?.extractSubjects) {
                        await model.chatMemoryPlan.extractSubjects(params);
                    }
                    return { success: true };
                } catch (error: any) {
                    console.warn('[BrowserDocumentUploadPlan] extractSubjects failed:', error);
                    // Non-critical - continue even if memory update fails
                    return { success: true };
                }
            },
            updateMemoryFromChat: async (params: {
                topicId: string;
                keywords: string[];
            }) => {
                try {
                    if (model.chatMemoryPlan?.updateMemoryFromChat) {
                        await model.chatMemoryPlan.updateMemoryFromChat(params);
                    }
                    return { success: true };
                } catch (error: any) {
                    console.warn('[BrowserDocumentUploadPlan] updateMemoryFromChat failed:', error);
                    // Non-critical - continue even if memory update fails
                    return { success: true };
                }
            }
        };

        // Initialize DocumentAIPlan with browser-specific dependencies
        this.documentAIPlan = new DocumentAIPlan({
            aiManager: aiManagerAdapter,
            chatPlan: chatPlanAdapter,
            documentExtractor: this.documentExtractor,
            chatMemoryPlan: chatMemoryAdapter,
            storeArrayBufferAsBlob: async (data: ArrayBuffer) => {
                const result = await storeArrayBufferAsBlob(data);
                return { hash: result.hash };
            }
        });

        // Initialize MessageAttachmentPlan with browser-specific dependencies
        this.messageAttachmentPlan = new MessageAttachmentPlan({
            documentExtractor: this.documentExtractor,
            chatMemoryPlan: chatMemoryAdapter,
            storeArrayBufferAsBlob: async (data: ArrayBuffer) => {
                const result = await storeArrayBufferAsBlob(data);
                return { hash: result.hash };
            }
        });

        console.log('[BrowserDocumentUploadPlan] Initialized');
    }

    /**
     * Create Document AI from file (FAB upload)
     *
     * Flow:
     * 1. Store original file as BLOB
     * 2. Extract text and analyze with LLM
     * 3. Create AI identity named after document
     * 4. Create chat topic with AI
     * 5. Post analysis message
     * 6. Store subjects in memory
     */
    async createDocumentAI(params: {
        file: File;
        text: string;
        onProgress?: (progress: ExtractionProgress) => void;
    }) {
        console.log('[BrowserDocumentUploadPlan] Creating Document AI:', params.file.name);

        const fileData = await params.file.arrayBuffer();

        return this.documentAIPlan.createDocumentAI({
            documentText: params.text,
            filename: params.file.name,
            fileData,
            onProgress: params.onProgress
        });
    }

    /**
     * Add document to existing chat (message ornament upload)
     *
     * Flow:
     * 1. Store original file as BLOB
     * 2. Extract text and analyze with LLM
     * 3. Add subjects/keywords to chat's memory
     */
    async addDocumentToChat(params: {
        topicId: string;
        file: File;
        text: string;
        onProgress?: (progress: ExtractionProgress) => void;
    }) {
        console.log('[BrowserDocumentUploadPlan] Adding document to chat:', params.topicId, params.file.name);

        const fileData = await params.file.arrayBuffer();

        return this.messageAttachmentPlan.addDocumentToChat({
            topicId: params.topicId,
            documentText: params.text,
            filename: params.file.name,
            fileData,
            onProgress: params.onProgress
        });
    }

    /**
     * Generate unique AI ID from document title
     */
    private generateAIId(displayName: string): string {
        const baseId = displayName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 20);

        const timestamp = Date.now().toString(36).substring(-6);
        return `doc-${baseId}-${timestamp}`;
    }
}
