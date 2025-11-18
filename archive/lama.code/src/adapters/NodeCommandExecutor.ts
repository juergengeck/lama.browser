/**
 * Node.js command executor for lama.code
 * Implements CommandExecutor using Node.js child_process.spawn
 */

import { spawn } from 'child_process';
import type {
    CommandExecutionOptions,
    CommandExecutionResult
} from '@code/core/types/tool-types.js';
import type { CommandExecutor } from '@code/core/services/SandboxExecutor.js';

export class NodeCommandExecutor implements CommandExecutor {
    /**
     * Execute command using Node.js spawn (not shell)
     * This is secure - no shell injection possible
     */
    async execute(
        command: string,
        args: string[],
        options: CommandExecutionOptions
    ): Promise<CommandExecutionResult> {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 60000; // Default 60s
            let timedOut = false;
            let timeoutHandle: NodeJS.Timeout | null = null;

            // Spawn process (no shell = secure)
            const proc = spawn(command, args, {
                cwd: options.cwd,
                env: options.env ? { ...process.env, ...options.env } : process.env,
                shell: false, // NEVER use shell for security
                windowsHide: true
            });

            let stdout = '';
            let stderr = '';
            let exitCode: number | null = null;
            let signal: string | undefined = undefined;

            // Capture stdout
            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            // Capture stderr
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Handle exit
            proc.on('close', (code, sig) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                exitCode = code ?? 1;
                signal = sig ? sig.toString() : undefined;

                resolve({
                    exitCode,
                    stdout,
                    stderr,
                    signal: signal || undefined,
                    timedOut,
                    duration: Date.now() - startTime
                });
            });

            // Handle errors
            proc.on('error', (err) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                reject(new Error(`Failed to execute ${command}: ${err.message}`));
            });

            // Set timeout
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');

                // Force kill after 5s if still running
                setTimeout(() => {
                    if (!proc.killed) {
                        proc.kill('SIGKILL');
                    }
                }, 5000);
            }, timeout);
        });
    }
}
