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
    const width = Math.min(process.stdout.columns || 88, 100);
    console.log();
    const title = `${chalk.bold.blue(`CCode AI ${version}`)} ${chalk.dim('agentic coding CLI')}`;
    const meta = `${provider} · ${model}`;
    const lines = logo.map((l, i) => `${rainbow(l)}  ${i === 1 ? title : i === 2 ? chalk.dim(meta) : i === 3 ? chalk.dim(root) : ''}`);
    for (const l of lines)
        console.log(l);
    console.log(chalk.gray('─'.repeat(width)));
}
export function renderFrame(opts) {
    const width = Math.min(process.stdout.columns || 88, 100);
    const inner = width - 4;
    console.log(chalk.cyan(`╭${'─'.repeat(width - 2)}╮`));
    console.log(chalk.cyan('│ ') + fit(`CCode AI v${opts.version}  ${chalk.dim('TUI')}`, inner) + chalk.cyan(' │'));
    console.log(chalk.cyan(`├${'─'.repeat(width - 2)}┤`));
    console.log(chalk.cyan('│ ') + fit(`root: ${opts.root}`, inner) + chalk.cyan(' │'));
    console.log(chalk.cyan('│ ') + fit(`provider: ${opts.provider}  model: ${opts.model}  auto-approve: ${opts.yes ? 'on' : 'off'}`, inner) + chalk.cyan(' │'));
    console.log(chalk.cyan('│ ') + fit(`session: ${opts.sessionId}`, inner) + chalk.cyan(' │'));
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
    let rendered = 0;
    const clear = () => {
        for (let i = 0; i < rendered; i++) {
            process.stdout.write('\x1b[2K\r');
            if (i < rendered - 1)
                process.stdout.write('\x1b[1A');
        }
        rendered = 0;
    };
    const render = () => {
        clear();
        const width = Math.min(process.stdout.columns || 88, 110);
        const prompt = chalk.blue('> ');
        const mode = expanded ? chalk.yellow('EXPANDED') : chalk.dim('compact');
        const hint = `${chalk.dim('esc cancel · ctrl+o expand/collapse · enter send')}   ${chalk.dim(opts.provider + ' · ' + opts.model)}`;
        const top = expanded ? chalk.gray(`╭${'─'.repeat(width - 2)}╮`) : chalk.gray('─'.repeat(width));
        const bottom = expanded ? chalk.gray(`╰${'─'.repeat(width - 2)}╯`) : chalk.gray('─'.repeat(width));
        const display = text.slice(0, cursor) + chalk.inverse(' ') + text.slice(cursor);
        const rootLine = expanded ? chalk.dim(`cwd ${opts.root}`) : '';
        const bodyLines = expanded
            ? [top, chalk.gray('│ ') + prompt + display + pad('', Math.max(0, width - stripAnsi(text).length - 7)) + chalk.gray('│'), rootLine ? chalk.gray('│ ') + fitPlain(rootLine, width - 4) + chalk.gray(' │') : '', bottom, hint].filter(Boolean)
            : [top, prompt + display, bottom, hint];
        process.stdout.write(bodyLines.join('\n'));
        rendered = bodyLines.length;
    };
    render();
    return await new Promise((resolve) => {
        const done = (value) => {
            process.stdin.off('keypress', onKey);
            process.stdin.setRawMode(wasRaw ?? false);
            clear();
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
                render();
                return;
            }
            if (key.name === 'return' || key.name === 'enter')
                return done(text.trim());
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
            render();
        };
        process.stdin.on('keypress', onKey);
    });
}
export function createSpinner(label) {
    if (!process.stdout.isTTY) {
        process.stdout.write(`${label}...\n`);
        return { stop: (_text) => undefined };
    }
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    process.stdout.write(`${chalk.cyan(frames[i])} ${label}`);
    const timer = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.write(`\r${chalk.cyan(frames[i])} ${label}`);
    }, 80);
    return {
        stop(text) {
            clearInterval(timer);
            process.stdout.write(`\r\x1b[2K${text ? text : chalk.green('✓ ' + label)}\n`);
        }
    };
}
function rainbow(s) {
    const colors = [chalk.blue, chalk.cyan, chalk.green, chalk.yellow, chalk.red, chalk.magenta];
    return [...s].map((ch, i) => ch === ' ' ? ch : colors[i % colors.length](ch)).join('');
}
function fit(text, width) {
    const plain = stripAnsi(text);
    if (plain.length >= width)
        return text;
    return text + ' '.repeat(width - plain.length);
}
function fitPlain(text, width) {
    const plain = stripAnsi(text);
    if (plain.length > width)
        return text.slice(0, width - 1) + '…';
    return text + ' '.repeat(width - plain.length);
}
function pad(text, width) {
    return text + ' '.repeat(Math.max(0, width));
}
function stripAnsi(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}
