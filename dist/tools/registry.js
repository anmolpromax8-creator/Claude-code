import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import fg from 'fast-glob';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ignore = require('ignore');
import { confirm } from '@inquirer/prompts';
import { exists, resolveInside, truncate } from '../util/fs.js';
export const toolDefinitions = [
    {
        name: 'list_files',
        description: 'List project files, respecting .gitignore where possible.',
        danger: 'safe',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Glob pattern, default **/*' },
                limit: { type: 'number', description: 'Maximum number of files, default 200' }
            }
        }
    },
    {
        name: 'read_file',
        description: 'Read a UTF-8 text file inside the project root.',
        danger: 'safe',
        inputSchema: {
            type: 'object',
            required: ['path'],
            properties: { path: { type: 'string' } }
        }
    },
    {
        name: 'write_file',
        description: 'Create or overwrite a UTF-8 text file inside the project root.',
        danger: 'write',
        inputSchema: {
            type: 'object',
            required: ['path', 'content'],
            properties: { path: { type: 'string' }, content: { type: 'string' } }
        }
    },
    {
        name: 'replace_in_file',
        description: 'Replace exact text in a UTF-8 file. Use for surgical edits.',
        danger: 'write',
        inputSchema: {
            type: 'object',
            required: ['path', 'oldText', 'newText'],
            properties: { path: { type: 'string' }, oldText: { type: 'string' }, newText: { type: 'string' } }
        }
    },
    {
        name: 'grep',
        description: 'Search text files with a JavaScript regular expression.',
        danger: 'safe',
        inputSchema: {
            type: 'object',
            required: ['query'],
            properties: {
                query: { type: 'string' },
                pattern: { type: 'string', description: 'Glob pattern, default **/*' },
                limit: { type: 'number', description: 'Maximum matches, default 80' }
            }
        }
    },
    {
        name: 'run_shell',
        description: 'Run a shell command in the project root. Use for tests, git status, package scripts, etc.',
        danger: 'shell',
        inputSchema: {
            type: 'object',
            required: ['command'],
            properties: { command: { type: 'string' }, timeoutMs: { type: 'number' } }
        }
    }
];
async function approval(ctx, label, detail) {
    if (ctx.yes)
        return true;
    return confirm({ message: `${label}\n${detail}\nAllow?`, default: false });
}
async function ignored(root) {
    const ig = ignore();
    ig.add(['node_modules', '.git', 'dist', 'build', 'coverage', '.ccode/sessions']);
    const gi = path.join(root, '.gitignore');
    if (await exists(gi))
        ig.add(await fs.readFile(gi, 'utf8'));
    return ig;
}
export async function runTool(ctx, name, input) {
    try {
        switch (name) {
            case 'list_files': return await listFiles(ctx, input);
            case 'read_file': return await readFile(ctx, input);
            case 'write_file': return await writeFile(ctx, input);
            case 'replace_in_file': return await replaceInFile(ctx, input);
            case 'grep': return await grepTool(ctx, input);
            case 'run_shell': return await runShell(ctx, input);
            default: return { ok: false, output: `Unknown tool: ${name}` };
        }
    }
    catch (err) {
        return { ok: false, output: err?.stack || err?.message || String(err) };
    }
}
async function listFiles(ctx, input) {
    const pattern = String(input.pattern || '**/*');
    const limit = Number(input.limit || 200);
    const ig = await ignored(ctx.root);
    const files = (await fg(pattern, { cwd: ctx.root, dot: true, onlyFiles: true }))
        .filter(f => !ig.ignores(f))
        .slice(0, limit);
    return { ok: true, output: files.join('\n') || '[no files]' };
}
async function readFile(ctx, input) {
    const file = resolveInside(ctx.root, String(input.path));
    const content = await fs.readFile(file, 'utf8');
    return { ok: true, output: truncate(content) };
}
async function writeFile(ctx, input) {
    const rel = String(input.path);
    const file = resolveInside(ctx.root, rel);
    const content = String(input.content ?? '');
    const ok = await approval(ctx, `write_file ${rel}`, truncate(content, 1200));
    if (!ok)
        return { ok: false, output: 'User denied write_file' };
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, 'utf8');
    return { ok: true, output: `Wrote ${rel} (${content.length} bytes)` };
}
async function replaceInFile(ctx, input) {
    const rel = String(input.path);
    const file = resolveInside(ctx.root, rel);
    const oldText = String(input.oldText ?? '');
    const newText = String(input.newText ?? '');
    const current = await fs.readFile(file, 'utf8');
    if (!current.includes(oldText))
        return { ok: false, output: `oldText not found in ${rel}` };
    const ok = await approval(ctx, `replace_in_file ${rel}`, `Replace:\n${truncate(oldText, 600)}\n--- with ---\n${truncate(newText, 600)}`);
    if (!ok)
        return { ok: false, output: 'User denied replace_in_file' };
    await fs.writeFile(file, current.replace(oldText, newText), 'utf8');
    return { ok: true, output: `Updated ${rel}` };
}
async function grepTool(ctx, input) {
    const query = String(input.query || '');
    const pattern = String(input.pattern || '**/*');
    const limit = Number(input.limit || 80);
    const re = new RegExp(query, 'i');
    const ig = await ignored(ctx.root);
    const files = (await fg(pattern, { cwd: ctx.root, dot: true, onlyFiles: true }))
        .filter(f => !ig.ignores(f));
    const hits = [];
    for (const f of files) {
        if (hits.length >= limit)
            break;
        try {
            const content = await fs.readFile(path.join(ctx.root, f), 'utf8');
            const lines = content.split(/\r?\n/);
            lines.forEach((line, i) => {
                if (hits.length < limit && re.test(line))
                    hits.push(`${f}:${i + 1}: ${line}`);
            });
        }
        catch { }
    }
    return { ok: true, output: hits.join('\n') || '[no matches]' };
}
async function runShell(ctx, input) {
    const command = String(input.command || '');
    const timeoutMs = Number(input.timeoutMs || 120000);
    const ok = await approval(ctx, `run_shell`, command);
    if (!ok)
        return { ok: false, output: 'User denied run_shell' };
    return await new Promise((resolve) => {
        const child = spawn(command, { cwd: ctx.root, shell: true, env: process.env });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            resolve({ ok: false, output: truncate(`Timed out after ${timeoutMs}ms\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`) });
        }, timeoutMs);
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', code => {
            clearTimeout(timer);
            resolve({ ok: code === 0, output: truncate(`exit ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`) });
        });
    });
}
