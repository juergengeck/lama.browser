/**
 * Node.js command executor for lama.code
 * Implements CommandExecutor using Node.js child_process.spawn
 */
import type { CommandExecutionOptions, CommandExecutionResult } from '@code/core/types/tool-types.js';
import type { CommandExecutor } from '@code/core/services/SandboxExecutor.js';
export declare class NodeCommandExecutor implements CommandExecutor {
    /**
     * Execute command using Node.js spawn (not shell)
     * This is secure - no shell injection possible
     */
    execute(command: string, args: string[], options: CommandExecutionOptions): Promise<CommandExecutionResult>;
}
//# sourceMappingURL=NodeCommandExecutor.d.ts.map