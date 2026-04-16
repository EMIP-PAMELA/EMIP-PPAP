/**
 * Local SharePoint Adapter — Phase T21
 *
 * Simulates SharePoint behaviour using the local filesystem.
 * Active when SHAREPOINT_MODE=LOCAL.
 *
 * Root: <project root>/mock-sharepoint/
 *
 * Intended for:
 *   - Local development without Graph API credentials
 *   - Integration testing and CI
 *   - Prototyping before live SharePoint access is available
 *
 * Governance:
 *   - All paths are sandboxed under the configured root — no path traversal.
 *   - No network calls. Purely local I/O.
 *   - Returns empty array (not an error) when a folder does not exist.
 *   - Creates missing parent directories on upload.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { SharePointAdapter } from './sharepointAdapter';

/**
 * Resolves the absolute project root at runtime by walking up from __dirname
 * until a directory containing package.json is found.
 * Fallback: process.cwd().
 */
function findProjectRoot(): string {
  try {
    let dir = __dirname;
    for (let i = 0; i < 10; i++) {
      const candidate = path.join(dir, 'package.json');
      try {
        require('node:fs').accessSync(candidate);
        return dir;
      } catch {
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
  } catch {
    // fallthrough
  }
  return process.cwd();
}

export const MOCK_ROOT = path.join(findProjectRoot(), 'mock-sharepoint');

/**
 * Resolves a relative SharePoint path to an absolute local filesystem path,
 * ensuring the result stays within the mock root (no traversal).
 */
function resolvePath(relativePath: string): string {
  const resolved = path.resolve(MOCK_ROOT, ...relativePath.split('/'));
  if (!resolved.startsWith(MOCK_ROOT)) {
    throw new Error(`[LocalSharePointAdapter] Path traversal blocked: "${relativePath}"`);
  }
  return resolved;
}

export class LocalSharePointAdapter implements SharePointAdapter {
  async getFile(filePath: string): Promise<Buffer> {
    const absolute = resolvePath(filePath);
    return fs.readFile(absolute);
  }

  async listFiles(folder: string): Promise<string[]> {
    const absolute = resolvePath(folder);
    try {
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      return entries
        .filter(e => e.isFile())
        .map(e => e.name);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async uploadFile(filePath: string, content: Buffer): Promise<void> {
    const absolute = resolvePath(filePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content);
  }
}
