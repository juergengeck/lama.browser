/**
 * Node.js file system adapter for lama.code
 * Implements FileSystemAdapter using Node.js fs/promises
 */
import * as fs from 'fs/promises';
import * as path from 'path';
export class NodeFileSystemAdapter {
    workspaceRoot = null;
    // Read operations
    async readFile(filePath, encoding = 'utf-8') {
        if (encoding === 'binary' || encoding === 'base64') {
            const buffer = await fs.readFile(filePath);
            if (encoding === 'base64') {
                return buffer.toString('base64');
            }
            return buffer;
        }
        return await fs.readFile(filePath, 'utf-8');
    }
    async readDir(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return Promise.all(entries.map(async (entry) => {
            const fullPath = path.join(dirPath, entry.name);
            let size = 0;
            let mtime = 0;
            try {
                const stats = await fs.stat(fullPath);
                size = stats.size;
                mtime = stats.mtimeMs;
            }
            catch (err) {
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
        }));
    }
    async stat(filePath) {
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
    async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    // Write operations
    async writeFile(filePath, content) {
        await fs.writeFile(filePath, content);
    }
    async deleteFile(filePath) {
        await fs.unlink(filePath);
    }
    async rename(oldPath, newPath) {
        await fs.rename(oldPath, newPath);
    }
    // Directory operations
    async mkdir(dirPath, recursive = false) {
        await fs.mkdir(dirPath, { recursive });
    }
    async rmdir(dirPath, recursive = false) {
        await fs.rm(dirPath, { recursive, force: recursive });
    }
    // Workspace operations
    async getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    async setWorkspaceRoot(rootPath) {
        // Validate path exists and is a directory
        const stats = await this.stat(rootPath);
        if (!stats.isDirectory) {
            throw new Error(`Path is not a directory: ${rootPath}`);
        }
        this.workspaceRoot = path.resolve(rootPath);
    }
}
//# sourceMappingURL=NodeFileSystemAdapter.js.map