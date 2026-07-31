import chalk from 'chalk';
import { createProvider } from './providers/index.js';
import { runTool, toolDefinitions } from './tools/registry.js';
import { createThinkingBlock, formatToolOutput } from './tui.js';
export function systemPrompt(root) {
    return `You are CCode, an original terminal coding assistant. You help edit, inspect, test, and explain code in the current project.

Rules:
- Project root: ${root}
- Use tools to inspect files before editing when needed.
- Keep changes focused and explain what changed.
- Prefer replace_in_file for small edits and write_file for new/full files.
- Run tests or build commands when useful.
- Never try to access paths outside the project root.
- If the user's request is ambiguous or too broad, ask a concise clarifying question and offer likely choices before making changes.
- Use markdown tables when comparing structured data, but keep tables compact for narrow terminals.
- Be concise in final answers.`;
}
function currentModel(config) {
    if (config.provider === 'anthropic')
        return config.anthropicModel;
    if (config.provider === 'nvidia')
        return config.nvidiaModel;
    return config.openaiModel;
}
export async function runAgentTask(messages, opts) {
    const provider = createProvider(opts.config);
    const ctx = { root: opts.root, yes: opts.yes };
    for (let round = 0; round < opts.config.maxToolRounds; round++) {
        const thinking = createThinkingBlock(currentModel(opts.config));
        let response;
        try {
            response = await provider.complete(messages, toolDefinitions);
            thinking.stop();
        }
        catch (err) {
            thinking.stop();
            throw err;
        }
        if (response.text.trim()) {
            await opts.onText?.(response.text);
            messages.push({ role: 'assistant', content: response.text });
        }
        if (response.toolCalls.length === 0)
            return messages;
        for (const call of response.toolCalls) {
            console.log(`${chalk.green('●')} ${chalk.bold(call.name)}${chalk.dim('(' + JSON.stringify(call.input) + ')')}`);
            const result = await runTool(ctx, call.name, call.input);
            console.log(result.ok ? chalk.green(`✓ ${call.name}`) : chalk.red(`✗ ${call.name}`));
            const marker = result.ok ? chalk.green('└') : chalk.red('└');
            console.log(marker, chalk.dim(formatToolOutput(result.output.slice(0, 4000))));
            messages.push({
                role: 'tool',
                name: call.name,
                toolCallId: call.id,
                content: `${result.ok ? 'OK' : 'ERROR'}\n${result.output}`
            });
        }
    }
    messages.push({ role: 'assistant', content: `Stopped after maxToolRounds=${opts.config.maxToolRounds}.` });
    return messages;
}
