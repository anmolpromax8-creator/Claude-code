#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadConfig, saveConfig, setConfigValue } from './config.js';
import { runAgentTask, systemPrompt } from './agent.js';
import { loadSession, newSessionId, saveSession } from './util/session.js';
const program = new Command();
program
    .name('ccode')
    .description('Original agentic coding assistant CLI. Not affiliated with Anthropic Claude Code.')
    .version('0.1.0');
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
program.command('run <task...>')
    .description('Run a one-shot coding task')
    .option('-y, --yes', 'approve file writes and shell commands automatically', false)
    .option('--provider <provider>', 'anthropic or openai')
    .option('--model <model>', 'override selected provider model')
    .option('--cwd <path>', 'project root', process.cwd())
    .action(async (parts, options) => {
    const root = path.resolve(options.cwd);
    const config = await withOverrides(options.provider, options.model);
    const messages = [
        { role: 'system', content: systemPrompt(root) },
        { role: 'user', content: parts.join(' ') }
    ];
    const finalMessages = await runAgentTask(messages, { root, yes: options.yes, config, onText: t => console.log(chalk.white(`\n${t}\n`)) });
    const id = newSessionId();
    const file = await saveSession(root, id, finalMessages);
    console.log(chalk.dim(`\nSession saved: ${file}`));
});
program.command('chat')
    .description('Start an interactive coding session')
    .option('-y, --yes', 'approve file writes and shell commands automatically', false)
    .option('--provider <provider>', 'anthropic or openai')
    .option('--model <model>', 'override selected provider model')
    .option('--cwd <path>', 'project root', process.cwd())
    .option('--resume <id>', 'resume session id from .ccode/sessions')
    .action(async (options) => {
    const root = path.resolve(options.cwd);
    const config = await withOverrides(options.provider, options.model);
    let sessionId = options.resume || newSessionId();
    let messages;
    if (options.resume) {
        const session = await loadSession(root, sessionId);
        messages = session.messages;
        console.log(chalk.green(`Resumed ${sessionId}`));
    }
    else {
        messages = [{ role: 'system', content: systemPrompt(root) }];
    }
    console.log(chalk.bold('CCode interactive session'));
    console.log(chalk.dim('Commands: /exit, /clear, /save, /provider, /help'));
    while (true) {
        const text = await input({ message: chalk.blue('you') });
        const trimmed = text.trim();
        if (!trimmed)
            continue;
        if (trimmed === '/exit' || trimmed === '/quit')
            break;
        if (trimmed === '/help') {
            console.log('/exit quit | /clear reset | /save save session | /provider switch provider');
            continue;
        }
        if (trimmed === '/clear') {
            messages = [{ role: 'system', content: systemPrompt(root) }];
            console.log(chalk.green('Cleared conversation'));
            continue;
        }
        if (trimmed === '/save') {
            const file = await saveSession(root, sessionId, messages);
            console.log(chalk.green(`Saved ${file}`));
            continue;
        }
        if (trimmed === '/provider') {
            config.provider = await select({ message: 'Provider', choices: [
                    { name: 'Anthropic', value: 'anthropic' },
                    { name: 'OpenAI-compatible', value: 'openai' }
                ] });
            await saveConfig(config);
            console.log(chalk.green(`Provider: ${config.provider}`));
            continue;
        }
        messages.push({ role: 'user', content: trimmed });
        messages = await runAgentTask(messages, { root, yes: options.yes, config, onText: t => console.log(chalk.white(`\nassistant: ${t}\n`)) });
        await saveSession(root, sessionId, messages);
    }
    const file = await saveSession(root, sessionId, messages);
    console.log(chalk.dim(`Session saved: ${file}`));
});
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
