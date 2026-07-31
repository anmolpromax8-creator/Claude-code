#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import { confirm, input, select } from '@inquirer/prompts';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadConfig, saveConfig, setConfigValue } from './config.js';
import { runAgentTask, systemPrompt } from './agent.js';
import { loadSession, newSessionId, saveSession } from './util/session.js';
import { toolDefinitions } from './tools/registry.js';
const VERSION = '0.1.1';
const program = new Command();
program
    .name('ccode')
    .description('Original agentic coding assistant CLI. Not affiliated with Anthropic Claude Code.')
    .version(VERSION);
program.command('init')
    .description('Create local .ccode directory and sample env file')
    .action(async () => {
    await fs.mkdir('.ccode/sessions', { recursive: true });
    try {
        await fs.writeFile('.env.example', [
            'ANTHROPIC_API_KEY=',
            'ANTHROPIC_MODEL=claude-3-5-sonnet-latest',
            'OPENAI_API_KEY=',
            'OPENAI_BASE_URL=https://api.openai.com/v1',
            'OPENAI_MODEL=gpt-4o-mini',
            ''
        ].join('\n'), { flag: 'wx' });
    }
    catch { }
    console.log(chalk.green('Initialized .ccode/ and .env.example'));
});
const configCmd = program.command('config').description('Manage configuration');
configCmd.command('show').action(async () => console.log(JSON.stringify(await loadConfig(), null, 2)));
configCmd.command('set <key> <value>').action(async (key, value) => {
    const allowed = ['provider', 'anthropicModel', 'openaiModel', 'openaiBaseUrl', 'maxToolRounds'];
    if (!allowed.includes(key))
        throw new Error(`Unknown config key. Use one of: ${allowed.join(', ')}`);
    const config = await setConfigValue(key, value);
    console.log(JSON.stringify(config, null, 2));
});
program.command('doctor')
    .description('Check CLI, API key, and project status')
    .option('--cwd <path>', 'project root', process.cwd())
    .action(async (options) => {
    const root = path.resolve(options.cwd);
    const config = await loadConfig();
    renderHeader({ root, config, sessionId: 'doctor', yes: false });
    console.log(chalk.bold('Doctor check'));
    console.log(`${okMark(true)} Node.js ${process.version}`);
    console.log(`${okMark(Boolean(process.env.ANTHROPIC_API_KEY))} ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? 'set' : 'not set'}`);
    console.log(`${okMark(Boolean(process.env.OPENAI_API_KEY))} OPENAI_API_KEY ${process.env.OPENAI_API_KEY ? 'set' : 'not set'}`);
    console.log(`${okMark(await exists(path.join(root, 'package.json')))} package.json ${await exists(path.join(root, 'package.json')) ? 'found' : 'not found'}`);
    console.log(chalk.dim(`Provider: ${config.provider}`));
});
program.command('run <task...>')
    .description('Run a one-shot coding task')
    .option('-y, --yes', 'approve file writes and shell commands automatically', false)
    .option('--provider <provider>', 'anthropic or openai')
    .option('--model <model>', 'override selected provider model')
    .option('--cwd <path>', 'project root', process.cwd())
    .action(async (parts, options) => {
    const root = path.resolve(options.cwd);
    const config = await withOverrides(options.provider, options.model);
    renderHeader({ root, config, sessionId: 'one-shot', yes: options.yes });
    const messages = [
        { role: 'system', content: systemPrompt(root) },
        { role: 'user', content: parts.join(' ') }
    ];
    const finalMessages = await runAgentTask(messages, { root, yes: options.yes, config, onText: t => console.log(chalk.white(`\n${t}\n`)) });
    const id = newSessionId();
    const file = await saveSession(root, id, finalMessages);
    console.log(chalk.dim(`\nSession saved: ${file}`));
});
program.command('chat', { isDefault: true })
    .description('Start an interactive TUI coding session')
    .option('-y, --yes', 'approve file writes and shell commands automatically', false)
    .option('--provider <provider>', 'anthropic or openai')
    .option('--model <model>', 'override selected provider model')
    .option('--cwd <path>', 'project root', process.cwd())
    .option('--resume <id>', 'resume session id from .ccode/sessions')
    .option('--no-clear', 'do not clear the terminal when opening chat')
    .action(async (options) => {
    let root = path.resolve(options.cwd);
    const config = await withOverrides(options.provider, options.model);
    let yes = Boolean(options.yes);
    let sessionId = options.resume || newSessionId();
    let messages;
    if (options.resume) {
        const session = await loadSession(root, sessionId);
        messages = session.messages;
    }
    else {
        messages = [{ role: 'system', content: systemPrompt(root) }];
    }
    if (options.clear !== false)
        console.clear();
    renderHeader({ root, config, sessionId, yes });
    console.log(chalk.dim('Type a task, or type / for the command palette. Use /help for slash commands.'));
    while (true) {
        const text = await input({ message: chalk.blue('you') });
        const trimmed = text.trim();
        if (!trimmed)
            continue;
        if (trimmed.startsWith('/')) {
            const action = await handleSlash(trimmed, { root, config, sessionId, messages, yes });
            root = action.root;
            sessionId = action.sessionId;
            messages = action.messages;
            yes = action.yes;
            if (action.exit)
                break;
            continue;
        }
        messages.push({ role: 'user', content: trimmed });
        messages = await runAgentTask(messages, {
            root,
            yes,
            config,
            onText: t => console.log(chalk.white(`\n${chalk.bold('assistant')}\n${t}\n`))
        });
        await saveSession(root, sessionId, messages);
        renderStatusLine({ root, config, sessionId, yes, messages });
    }
    const file = await saveSession(root, sessionId, messages);
    console.log(chalk.dim(`Session saved: ${file}`));
});
async function handleSlash(command, state) {
    let { root, config, sessionId, messages, yes } = state;
    const [cmd, ...args] = command.split(/\s+/);
    const chosen = cmd === '/'
        ? await commandPalette()
        : cmd;
    switch (chosen) {
        case '/exit':
        case '/quit':
            return { root, config, sessionId, messages, yes, exit: true };
        case '/help':
            printHelp();
            break;
        case '/clear':
            if (await confirm({ message: 'Clear this conversation?', default: false })) {
                messages = [{ role: 'system', content: systemPrompt(root) }];
                console.clear();
                renderHeader({ root, config, sessionId, yes });
                console.log(chalk.green('Conversation cleared.'));
            }
            break;
        case '/save': {
            const file = await saveSession(root, sessionId, messages);
            console.log(chalk.green(`Saved ${file}`));
            break;
        }
        case '/status':
            renderHeader({ root, config, sessionId, yes });
            renderStatusLine({ root, config, sessionId, yes, messages });
            break;
        case '/provider':
            config.provider = await select({ message: 'Provider', choices: [
                    { name: 'Anthropic', value: 'anthropic' },
                    { name: 'OpenAI-compatible', value: 'openai' }
                ] });
            await saveConfig(config);
            console.log(chalk.green(`Provider: ${config.provider}`));
            break;
        case '/model': {
            const current = config.provider === 'anthropic' ? config.anthropicModel : config.openaiModel;
            const model = await input({ message: `Model for ${config.provider}`, default: current });
            if (config.provider === 'anthropic')
                config.anthropicModel = model;
            else
                config.openaiModel = model;
            await saveConfig(config);
            console.log(chalk.green(`Model: ${model}`));
            break;
        }
        case '/yes':
            yes = !yes;
            console.log(yes ? chalk.yellow('Auto-approval enabled for writes/shell.') : chalk.green('Auto-approval disabled.'));
            break;
        case '/cwd': {
            const next = args.join(' ') || await input({ message: 'Project root', default: root });
            root = path.resolve(next);
            messages = [{ role: 'system', content: systemPrompt(root) }, ...messages.filter(m => m.role !== 'system')];
            renderHeader({ root, config, sessionId, yes });
            break;
        }
        case '/tools':
            console.log(chalk.bold('\nAvailable tools'));
            for (const t of toolDefinitions) {
                const color = t.danger === 'safe' ? chalk.green : t.danger === 'write' ? chalk.yellow : chalk.red;
                console.log(`${color(t.name.padEnd(16))} ${chalk.dim(t.danger.padEnd(5))} ${t.description}`);
            }
            console.log();
            break;
        case '/sessions': {
            const sessions = await listSessions(root);
            if (!sessions.length)
                console.log(chalk.dim('No saved sessions yet.'));
            else
                sessions.forEach(s => console.log(`${chalk.cyan(s.id)} ${chalk.dim(s.updatedAt)} ${s.count} messages`));
            break;
        }
        case '/resume': {
            const sessions = await listSessions(root);
            if (!sessions.length) {
                console.log(chalk.dim('No sessions to resume.'));
                break;
            }
            const picked = await select({
                message: 'Resume session',
                choices: sessions.map(s => ({ name: `${s.id} (${s.count} messages, ${s.updatedAt})`, value: s.id }))
            });
            const session = await loadSession(root, picked);
            sessionId = picked;
            messages = session.messages;
            renderHeader({ root, config, sessionId, yes });
            console.log(chalk.green(`Resumed ${sessionId}`));
            break;
        }
        case '/compact': {
            const keepRaw = args[0] || await input({ message: 'Keep last N messages', default: '12' });
            const keep = Math.max(2, Number(keepRaw) || 12);
            const system = messages.find(m => m.role === 'system') || { role: 'system', content: systemPrompt(root) };
            const rest = messages.filter(m => m.role !== 'system');
            messages = [system, ...rest.slice(-keep)];
            console.log(chalk.green(`Compacted context to ${messages.length} messages.`));
            break;
        }
        default:
            console.log(chalk.red(`Unknown slash command: ${cmd}`));
            printHelp();
    }
    return { root, config, sessionId, messages, yes };
}
async function commandPalette() {
    return select({
        message: 'Command palette',
        choices: [
            { name: '/help      Show slash commands', value: '/help' },
            { name: '/status    Show current session status', value: '/status' },
            { name: '/provider  Switch AI provider', value: '/provider' },
            { name: '/model     Change current provider model', value: '/model' },
            { name: '/tools     List available agent tools', value: '/tools' },
            { name: '/sessions  List saved sessions', value: '/sessions' },
            { name: '/resume    Resume a saved session', value: '/resume' },
            { name: '/save      Save this session', value: '/save' },
            { name: '/clear     Clear conversation', value: '/clear' },
            { name: '/yes       Toggle auto-approval', value: '/yes' },
            { name: '/cwd       Change project root', value: '/cwd' },
            { name: '/compact   Keep only recent messages', value: '/compact' },
            { name: '/exit      Quit', value: '/exit' }
        ]
    });
}
function printHelp() {
    console.log(chalk.bold('\nSlash commands'));
    const rows = [
        ['/help', 'show this help'],
        ['/', 'open command palette'],
        ['/status', 'show provider/model/root/session info'],
        ['/provider', 'switch between Anthropic and OpenAI-compatible APIs'],
        ['/model', 'change the current provider model'],
        ['/tools', 'list file, search, edit, and shell tools'],
        ['/sessions', 'list saved sessions'],
        ['/resume', 'resume a saved session'],
        ['/save', 'save current session'],
        ['/clear', 'clear conversation context'],
        ['/yes', 'toggle auto-approval for writes and shell commands'],
        ['/cwd [path]', 'change project root'],
        ['/compact [n]', 'keep only the last n messages'],
        ['/exit', 'quit']
    ];
    for (const [c, d] of rows)
        console.log(`${chalk.cyan(c.padEnd(14))} ${d}`);
    console.log();
}
function renderHeader({ root, config, sessionId, yes }) {
    const model = config.provider === 'anthropic' ? config.anthropicModel : config.openaiModel;
    const width = Math.min(process.stdout.columns || 88, 100);
    const line = '─'.repeat(Math.max(20, width - 2));
    console.log(chalk.cyan(`┌${line}┐`));
    console.log(chalk.cyan('│') + pad(` CCode AI v${VERSION}  ${chalk.dim('agentic coding TUI')}`, width - 2) + chalk.cyan('│'));
    console.log(chalk.cyan('├' + line + '┤'));
    console.log(chalk.cyan('│') + pad(` root: ${root}`, width - 2) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + pad(` provider: ${config.provider}  model: ${model}  auto-approve: ${yes ? 'on' : 'off'}`, width - 2) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + pad(` session: ${sessionId}`, width - 2) + chalk.cyan('│'));
    console.log(chalk.cyan(`└${line}┘`));
}
function renderStatusLine(state) {
    const model = state.config.provider === 'anthropic' ? state.config.anthropicModel : state.config.openaiModel;
    console.log(chalk.dim(`\n[${state.config.provider}:${model}] ${state.messages.length} messages · ${state.root} · session ${state.sessionId} · / for commands\n`));
}
function pad(text, width) {
    const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
    const extra = Math.max(0, width - plain.length);
    return text + ' '.repeat(extra);
}
function okMark(ok) {
    return ok ? chalk.green('✓') : chalk.yellow('!');
}
async function exists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
async function listSessions(root) {
    const dir = path.join(root, '.ccode', 'sessions');
    try {
        const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'));
        const sessions = [];
        for (const f of files) {
            try {
                const raw = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
                sessions.push({ id: f.replace(/\.json$/, ''), updatedAt: raw.updatedAt || raw.createdAt || 'unknown', count: raw.messages?.length || 0 });
            }
            catch { }
        }
        return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    catch {
        return [];
    }
}
async function withOverrides(provider, model) {
    const config = await loadConfig();
    if (provider) {
        if (provider !== 'anthropic' && provider !== 'openai')
            throw new Error('--provider must be anthropic or openai');
        config.provider = provider;
    }
    if (model) {
        if (config.provider === 'anthropic')
            config.anthropicModel = model;
        else
            config.openaiModel = model;
    }
    return config;
}
program.parseAsync(process.argv).catch(err => {
    console.error(chalk.red(err?.stack || err?.message || String(err)));
    process.exit(1);
});
