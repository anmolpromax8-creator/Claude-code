import path from 'node:path';
import fs from 'node:fs/promises';
export function newSessionId() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}
export async function saveSession(root, id, messages) {
    const dir = path.join(root, '.ccode', 'sessions');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${id}.json`);
    let createdAt = new Date().toISOString();
    try {
        const old = JSON.parse(await fs.readFile(file, 'utf8'));
        createdAt = old.createdAt;
    }
    catch { }
    const data = { id, createdAt, updatedAt: new Date().toISOString(), messages };
    await fs.writeFile(file, JSON.stringify(data, null, 2));
    return file;
}
export async function loadSession(root, id) {
    const file = path.join(root, '.ccode', 'sessions', `${id}.json`);
    return JSON.parse(await fs.readFile(file, 'utf8'));
}
