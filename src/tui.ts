import readline from 'node:readline';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';

export interface InputBarOptions {
  provider: string;
  model: string;
  root: string;
}

const logo = [
  '      ███╗   ███╗',
  '   ███╔══██╗██╔══',
  ' ██╔╝     ███╔╝  ',
  '███       ███    ',
  ' ╚███╗  ███╔╝    ',
  '   ╚█████╔╝      '
];

export function renderSplash(version: string, provider: string, model: string, root: string): void {
  const width = termWidth();
  const textWidth = Math.max(24, width - 24);
  console.log();
  const title = `${chalk.bold.blue(`CCode AI ${version}`)} ${chalk.dim('agentic coding CLI')}`;
  const meta = chalk.dim(compactText(`${provider} · ${model}`, textWidth));
  const cwd = chalk.dim(compactText(root, textWidth));
  const lines = logo.map((l, i) => `${rainbow(l)}  ${i === 1 ? title : i === 2 ? meta : i === 3 ? cwd : ''}`);
  for (const l of lines) console.log(l);
  console.log(chalk.gray('─'.repeat(width)));
}

export function renderFrame(opts: { version: string; root: string; provider: string; model: string; sessionId: string; yes: boolean }): void {
  const width = termWidth();
  const inner = width - 4;
  console.log(chalk.cyan(`╭${'─'.repeat(width - 2)}╮`));
  console.log(chalk.cyan('│ ') + fitPlain(`CCode AI v${opts.version}  TUI`, inner) + chalk.cyan(' │'));
  console.log(chalk.cyan(`├${'─'.repeat(width - 2)}┤`));
  console.log(chalk.cyan('│ ') + fitPlain(`root: ${opts.root}`, inner) + chalk.cyan(' │'));
  console.log(chalk.cyan('│ ') + fitPlain(`provider: ${opts.provider}  model: ${opts.model}`, inner) + chalk.cyan(' │'));
  console.log(chalk.cyan('│ ') + fitPlain(`auto-approve: ${opts.yes ? 'on' : 'off'}  session: ${opts.sessionId}`, inner) + chalk.cyan(' │'));
  console.log(chalk.cyan(`╰${'─'.repeat(width - 2)}╯`));
}

export async function readInputBar(opts: InputBarOptions): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return input({ message: chalk.blue('you') });
  }

  readline.emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let text = '';
  let cursor = 0;
  let expanded = false;
  const width = termWidth();
  const hint = `esc cancel · ctrl+o expand · enter send · type / then enter for commands · ${opts.provider} · ${opts.model}`;

  console.log(chalk.gray('─'.repeat(width)));
  console.log(chalk.dim(compactText(hint, width)));

  const draw = () => {
    const max = Math.max(10, width - 4);
    const display = expanded ? text : compactAroundCursor(text, cursor, max);
    const displayCursor = Math.min(display.length, expanded ? cursor : Math.min(cursor, max - 1));
    const left = display.slice(0, displayCursor);
    const right = display.slice(displayCursor);
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(`${chalk.blue('>')} ${left}${chalk.inverse(' ')}${right}`);
  };

  const printExpandedHint = () => {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    console.log(chalk.gray(compactText(`↕ expanded input · cwd ${opts.root}`, width)));
  };

  draw();

  return await new Promise<string>((resolve) => {
    const done = (value: string) => {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(wasRaw ?? false);
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      if (value) console.log(`${chalk.green('✓')} ${chalk.bold('you')} ${value}`);
      resolve(value);
    };

    const onKey = (str: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') return done('/exit');
      if (key.name === 'escape') return done('');
      if (key.ctrl && key.name === 'o') {
        expanded = !expanded;
        if (expanded) printExpandedHint();
        draw();
        return;
      }
      if ((key.name === 'return') || (key.name === 'enter')) return done(text.trim());

      if (key.name === 'backspace') {
        if (cursor > 0) {
          text = text.slice(0, cursor - 1) + text.slice(cursor);
          cursor--;
        }
      } else if (key.name === 'delete') {
        text = text.slice(0, cursor) + text.slice(cursor + 1);
      } else if (key.name === 'left') {
        cursor = Math.max(0, cursor - 1);
      } else if (key.name === 'right') {
        cursor = Math.min(text.length, cursor + 1);
      } else if (key.name === 'home') {
        cursor = 0;
      } else if (key.name === 'end') {
        cursor = text.length;
      } else if (str && !key.ctrl && !key.meta) {
        text = text.slice(0, cursor) + str + text.slice(cursor);
        cursor += str.length;
      }
      draw();
    };

    process.stdin.on('keypress', onKey);
  });
}

export function createThinkingBlock(model: string) {
  if (!process.stdout.isTTY) {
    return { stop: () => undefined };
  }
  const width = termWidth();
  const inner = width - 4;
  const frames = ['◐', '◓', '◑', '◒'];
  let i = 0;
  let lines = 3;
  const draw = () => {
    process.stdout.write(chalk.gray(`╭${'─'.repeat(width - 2)}╮\n`));
    process.stdout.write(chalk.gray('│ ') + fitPlain(`${frames[i]} thinking · ${model}`, inner) + chalk.gray(' │\n'));
    process.stdout.write(chalk.gray(`╰${'─'.repeat(width - 2)}╯`));
  };
  draw();
  const timer = setInterval(() => {
    i = (i + 1) % frames.length;
    clearLines(lines);
    draw();
  }, 120);
  return {
    stop() {
      clearInterval(timer);
      clearLines(lines);
    }
  };
}

export function createSpinner(label: string) {
  if (!process.stdout.isTTY) {
    process.stdout.write(`${label}...\n`);
    return { stop: (_text?: string) => undefined };
  }
  const safeLabel = compactText(label, Math.max(20, termWidth() - 4));
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write(`${chalk.cyan(frames[i])} ${safeLabel}`);
  const timer = setInterval(() => {
    i = (i + 1) % frames.length;
    process.stdout.write(`\r${chalk.cyan(frames[i])} ${safeLabel}`);
  }, 80);
  return {
    stop(text?: string) {
      clearInterval(timer);
      process.stdout.write(`\r\x1b[2K${text ? compactText(text, termWidth()) + '\n' : ''}`);
    }
  };
}

export async function streamText(text: string, prefix = ''): Promise<void> {
  const formatted = formatMarkdownTables(text, termWidth());
  if (prefix) process.stdout.write(prefix);
  if (!process.stdout.isTTY || process.env.CCODE_NO_TYPEWRITER === '1') {
    process.stdout.write(formatted + '\n');
    return;
  }
  for (const ch of formatted) {
    process.stdout.write(ch);
    await new Promise(r => setTimeout(r, ch === '\n' ? 5 : 2));
  }
  process.stdout.write('\n');
}

export function formatToolOutput(text: string): string {
  const width = termWidth();
  return text.split(/\r?\n/).map(line => compactText(line, width)).join('\n');
}

export function compactText(text: string, width: number): string {
  const plain = stripAnsi(text);
  if (plain.length <= width) return text;
  return plain.slice(0, Math.max(1, width - 1)) + '…';
}

function formatMarkdownTables(text: string, width: number): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length;) {
    if (isTableStart(lines, i)) {
      const table: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].includes('|')) table.push(lines[i++]);
      out.push(renderMarkdownTable(table, width));
    } else {
      out.push(lines[i++]);
    }
  }
  return out.join('\n');
}

function isTableStart(lines: string[], i: number): boolean {
  return i + 1 < lines.length && lines[i].trim().startsWith('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1]);
}

function renderMarkdownTable(lines: string[], width: number): string {
  const rows = lines.filter((_, i) => i !== 1).map(parseTableRow);
  if (!rows.length) return lines.join('\n');
  const cols = Math.max(...rows.map(r => r.length));
  const maxInner = Math.max(20, width - (cols * 3 + 1));
  const base = Math.max(8, Math.floor(maxInner / cols));
  const colWidths = Array.from({ length: cols }, (_, c) => {
    const maxLen = Math.max(...rows.map(r => (r[c] || '').length), 6);
    return Math.min(24, Math.max(6, Math.min(maxLen, base)));
  });
  const border = '┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
  const sep = '├' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';
  const end = '└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
  const renderRow = (r: string[]) => '│' + colWidths.map((w, c) => ' ' + fitPlain(r[c] || '', w) + ' ').join('│') + '│';
  const rendered = [border, renderRow(rows[0]), sep, ...rows.slice(1).map(renderRow), end];
  return rendered.map(l => compactText(l, width)).join('\n');
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim().replace(/`/g, ''));
}

function compactAroundCursor(text: string, cursor: number, width: number): string {
  if (text.length <= width) return text;
  if (cursor < width - 1) return text.slice(0, width - 1) + '…';
  const start = Math.max(0, cursor - width + 2);
  return '…' + text.slice(start, start + width - 1);
}

function rainbow(s: string): string {
  const colors = [chalk.blue, chalk.cyan, chalk.green, chalk.yellow, chalk.red, chalk.magenta];
  return [...s].map((ch, i) => ch === ' ' ? ch : colors[i % colors.length](ch)).join('');
}

function fitPlain(text: string, width: number): string {
  const compacted = compactText(text, width);
  const plain = stripAnsi(compacted);
  return compacted + ' '.repeat(Math.max(0, width - plain.length));
}

function termWidth(): number {
  return Math.min(process.stdout.columns || 88, 100);
}

function clearLines(count: number): void {
  for (let n = 0; n < count; n++) {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    if (n < count - 1) readline.moveCursor(process.stdout, 0, -1);
  }
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}
