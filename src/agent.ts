import chalk from 'chalk';
import { createProvider } from './providers/index.js';
import { runTool, toolDefinitions } from './tools/registry.js';
import { createSpinner } from './tui.js';
import { AppConfig, ChatMessage, ToolContext } from './types.js';

export function systemPrompt(root: string): string {
  return `You are CCode, an original terminal coding assistant. You help edit, inspect, test, and explain code in the current project.

Rules:
- Project root: ${root}
- Use tools to inspect files before editing when needed.
- Keep changes focused and explain what changed.
- Prefer replace_in_file for small edits and write_file for new/full files.
- Run tests or build commands when useful.
- Never try to access paths outside the project root.
- Be concise in final answers.`;
}

export interface AgentOptions {
  root: string;
  yes: boolean;
  config: AppConfig;
  onText?: (text: string) => void;
}

export async function runAgentTask(messages: ChatMessage[], opts: AgentOptions): Promise<ChatMessage[]> {
  const provider = createProvider(opts.config);
  const ctx: ToolContext = { root: opts.root, yes: opts.yes };

  for (let round = 0; round < opts.config.maxToolRounds; round++) {
    const thinking = createSpinner(`Generating with ${provider.name}`);
    let response;
    try {
      response = await provider.complete(messages, toolDefinitions);
      thinking.stop(chalk.green(`✓ ${provider.name} responded`));
    } catch (err) {
      thinking.stop(chalk.red(`✗ ${provider.name} failed`));
      throw err;
    }

    if (response.text.trim()) {
      opts.onText?.(response.text);
      messages.push({ role: 'assistant', content: response.text });
    }

    if (response.toolCalls.length === 0) return messages;

    for (const call of response.toolCalls) {
      console.log(`${chalk.green('●')} ${chalk.bold(call.name)}${chalk.dim('(' + JSON.stringify(call.input) + ')')}`);
      const result = await runTool(ctx, call.name, call.input);
      console.log(result.ok ? chalk.green(`✓ ${call.name}`) : chalk.red(`✗ ${call.name}`));
      const marker = result.ok ? chalk.green('└') : chalk.red('└');
      console.log(marker, chalk.dim(result.output.slice(0, 2000)));
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
