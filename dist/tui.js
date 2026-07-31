import readline from 'node:readline';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
const logo = [
    '      ███╗   ███╗',
    '   ███╔══██╗██╔══',
    ' ██╔╝     ███╔╝  ',
    '███       ███    ',
    ' ╚███╗  ███╔╝    ',
    '   ╚█████╔╝      '
];
export function renderSplash(version, provider, model, root) {
    const width = termWidth();
    const textWidth = Math.max(24, width - 24);
    console.log();
    const title = `${chalk.bold.blue(`CCode AI ${version}`)} ${chalk.dim('agentic coding CLI')}`;
    const meta = chalk.dim(compactText(`${provider} · ${model}`, textWidth));
    const cwd = chalk.dim(compactText(root, textWidth));
    const lines = logo.map((l, i) => `${rainbow(l)}  ${i === 1 ? title : i === 2 ? meta : i === 3 ? cwd : ''}`);
    for (const l of lines)
        console.log(l);
    console.log(chalk.gray('─'.repeat(width)));
}
export function renderFrame(opts) {
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
export async function readInputBar(opts) {
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
    const hint = `esc cancel · ctrl+o expand · enter send · / commands · ${opts.provider} · ${opts.model}`;
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
    return await new Promise((resolve) => {
        const done = (value) => {
            process.stdin.off('keypress', onKey);
            process.stdin.setRawMode(wasRaw ?? false);
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0);
            if (value)
                console.log(`${chalk.green('✓')} ${chalk.bold('you')} ${value}`);
            resolve(value);
        };
        const onKey = (str, key) => {
            if (key.ctrl && key.name === 'c')
                return done('/exit');
            if (key.name === 'escape')
                return done('');
            if (key.ctrl && key.name === 'o') {
                expanded = !expanded;
                if (expanded)
                    printExpandedHint();
                draw();
                return;
            }
            if ((key.name === 'return') || (key.name === 'enter'))
                return done(text.trim());
            if (!text && str === '/')
                return done('/');
            if (key.name === 'backspace') {
                if (cursor > 0) {
                    text = text.slice(0, cursor - 1) + text.slice(cursor);
                    cursor--;
                }
            }
            else if (key.name === 'delete') {
                text = text.slice(0, cursor) + text.slice(cursor + 1);
            }
            else if (key.name === 'left') {
                cursor = Math.max(0, cursor - 1);
            }
            else if (key.name === 'right') {
                cursor = Math.min(text.length, cursor + 1);
            }
            else if (key.name === 'home') {
                cursor = 0;
            }
            else if (key.name === 'end') {
                cursor = text.length;
            }
            else if (str && !key.ctrl && !key.meta) {
                text = text.slice(0, cursor) + str + text.slice(cursor);
                cursor += str.length;
            }
            draw();
        };
        process.stdin.on('keypress', onKey);
    });
}
export function createSpinner(label) {
    if (!process.stdout.isTTY) {
        process.stdout.write(`${label}...\n`);
        return { stop: (_text) => undefined };
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
        stop(text) {
            clearInterval(timer);
            process.stdout.write(`\r\x1b[2K${text ? compactText(text, termWidth()) : chalk.green('✓ ' + safeLabel)}\n`);
        }
    };
}
export async function streamText(text, prefix = '') {
    if (prefix)
        process.stdout.write(prefix);
    if (!process.stdout.isTTY || process.env.CCODE_NO_TYPEWRITER === '1') {
        process.stdout.write(text + '\n');
        return;
    }
    for (const ch of text) {
        process.stdout.write(ch);
        await new Promise(r => setTimeout(r, ch === '\n' ? 8 : 3));
    }
    process.stdout.write('\n');
}
export function compactText(text, width) {
    const plain = stripAnsi(text);
    if (plain.length <= width)
        return text;
    return plain.slice(0, Math.max(1, width - 1)) + '…';
}
function compactAroundCursor(text, cursor, width) {
    if (text.length <= width)
        return text;
    if (cursor < width - 1)
        return text.slice(0, width - 1) + '…';
    const start = Math.max(0, cursor - width + 2);
    return '…' + text.slice(start, start + width - 1);
}
function rainbow(s) {
    const colors = [chalk.blue, chalk.cyan, chalk.green, chalk.yellow, chalk.red, chalk.magenta];
    return [...s].map((ch, i) => ch === ' ' ? ch : colors[i % colors.length](ch)).join('');
}
function fitPlain(text, width) {
    const compacted = compactText(text, width);
    const plain = stripAnsi(compacted);
    return compacted + ' '.repeat(Math.max(0, width - plain.length));
}
function termWidth() {
    return Math.min(process.stdout.columns || 88, 100);
}
function stripAnsi(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}
