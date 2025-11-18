/**
 * Node.js file system adapter for lama.code
 * Implements FileSystemAdapter using Node.js fs/promises
 */
import type { FileSystemAdapter, FileEntry, FileStats, FileEncoding } from '@code/core/types/file-types.js';
export declare class NodeFileSystemAdapter implements FileSystemAdapter {
    private workspaceRoot;
    readFile(filePath: string, encoding?: FileEncoding): Promise<string | Buffer>;
    readDir(dirPath: string): Promise<FileEntry[]>;
    stat(filePath: string): Promise<FileStats>;
    exists(filePath: string): Promise<boolean>;
    writeFile(filePath: string, content: string | Buffer): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    mkdir(dirPath: string, recursive?: boolean): Promise<void>;
    rmdir(dirPath: string, recursive?: boolean): Promise<void>;
    getWorkspaceRoot(): Promise<string | null>;
    setWorkspaceRoot(rootPath: string): Promise<void>;
}
//# sourceMappingURL=NodeFileSystemAdapter.d.ts.map