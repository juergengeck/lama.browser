/**
 * Node.js file system adapter for lama.code
 * Implements FileSystemAdapter using Node.js fs/promises
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
    FileSystemAdapter,
    FileEntry,
    FileStats,
    FileEncoding
} from '@code/core/types/file-types.js';

export class NodeFileSystemAdapter implements FileSystemAdapter {
    private workspaceRoot: string | null = null;

    // Read operations

    async readFile(filePath: string, encoding: FileEncoding = 'utf-8'): Promise<string | Buffer> {
        if (encoding === 'binary' || encoding === 'base64') {
            const buffer = await fs.readFile(filePath);
            if (encoding === 'base64') {
                return buffer.toString('base64');
            }
            return buffer;
        }

        return await fs.readFile(filePath, 'utf-8');
    }

    async readDir(dirPath: string): Promise<FileEntry[]> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        return Promise.all(
            entries.map(async (entry) => {
                const fullPath = path.join(dirPath, entry.name);
                let size = 0;
                let mtime = 0;

                try {
                    const stats = await fs.stat(fullPath);
                    size = stats.size;
                    mtime = stats.mtimeMs;
                } catch (err) {
                    // Ignore stat errors (broken symlinks, etc.)
                }

                return {
                    name: entry.name,
                    path: fullPath,
                    isDirectory: entry.isDirectory(),
                    isFile: entry.isFile(),
                    isSymbolicLink: entry.isSymbolicLink(),
                    size,
                    mtime
                };
            })
        );
    }

    async stat(filePath: string): Promise<FileStats> {
        const stats = await fs.stat(filePath);

        return {
            size: stats.size,
            mtime: stats.mtimeMs,
            ctime: stats.ctimeMs,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            isSymbolicLink: stats.isSymbolicLink()
        };
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Write operations

    async writeFile(filePath: string, content: string | Buffer): Promise<void> {
        await fs.writeFile(filePath, content);
    }

    async deleteFile(filePath: string): Promise<void> {
        await fs.unlink(filePath);
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        await fs.rename(oldPath, newPath);
    }

    // Directory operations

    async mkdir(dirPath: string, recursive: boolean = false): Promise<void> {
        await fs.mkdir(dirPath, { recursive });
    }

    async rmdir(dirPath: string, recursive: boolean = false): Promise<void> {
        await fs.rm(dirPath, { recursive, force: recursive });
    }

    // Workspace operations

    async getWorkspaceRoot(): Promise<string | null> {
        return this.workspaceRoot;
    }

    async setWorkspaceRoot(rootPath: string): Promise<void> {
        // Validate path exists and is a directory
        const stats = await this.stat(rootPath);
        if (!stats.isDirectory) {
            throw new Error(`Path is not a directory: ${rootPath}`);
        }

        this.workspaceRoot = path.resolve(rootPath);
    }
}
