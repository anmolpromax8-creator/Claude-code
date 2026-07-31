import path from 'node:path';
import fs from 'node:fs/promises';
import { ChatMessage } from '../types.js';

export interface SessionFile {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export function newSessionId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function saveSession(root: string, id: string, messages: ChatMessage[]): Promise<string> {
  const dir = path.join(root, '.ccode', 'sessions');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  let createdAt = new Date().toISOString();
  try {
    const old = JSON.parse(await fs.readFile(file, 'utf8')) as SessionFile;
    createdAt = old.createdAt;
  } catch {}
  const data: SessionFile = { id, createdAt, updatedAt: new Date().toISOString(), messages };
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  return file;
}

export async function loadSession(root: string, id: string): Promise<SessionFile> {
  const file = path.join(root, '.ccode', 'sessions', `${id}.json`);
  return JSON.parse(await fs.readFile(file, 'utf8')) as SessionFile;
}
