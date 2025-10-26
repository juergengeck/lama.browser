/**
 * Browser stub for Claude service
 * Claude API cannot be called from browser due to CORS restrictions.
 * When browser and electron are connected, users can chat with Claude through electron.
 */

export async function chatWithClaude(): Promise<never> {
    throw new Error('Claude API is not available in browser builds. Use Ollama or connect to an Electron instance.');
}

export async function checkClaudeAvailability(): Promise<boolean> {
    return false;
}

export default {
    chatWithClaude,
    checkClaudeAvailability
};
