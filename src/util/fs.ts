import path from 'node:path';
import fs from 'node:fs/promises';

export function resolveInside(root: string, requested: string): string {
  const resolved = path.resolve(root, requested || '.');
  const normalizedRoot = path.resolve(root);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error(`Path escapes project root: ${requested}`);
  }
  return resolved;
}

export async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

export function truncate(text: string, max = 20000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n[truncated ${text.length - max} chars]`;
}
