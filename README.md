# CCode AI

An **original** agentic coding assistant CLI for local projects. It is inspired by modern code-agent CLIs, but it does **not** copy Anthropic Claude Code source code, proprietary UX, or branding.

Repository: <https://github.com/anmolpromax8-creator/Claude-code>

## Install

### Works immediately from GitHub

```bash
npm i -g https://github.com/anmolpromax8-creator/Claude-code/tarball/main
```

Then run:

```bash
ccode --help
# or
ccode-ai --help
```

### NPM registry install

The package is prepared for npm under the name `ccode-ai`. After it is published to npm, users can install it with one short command:

```bash
npm i -g ccode-ai
```

Publishing requires your npm account login/token:

```bash
npm login
npm publish --access public
```

## Features

- Interactive chat and one-shot task mode
- Anthropic API and OpenAI-compatible API support
- Tool-calling agent loop
- Safe project-root file tools:
  - list files
  - read files
  - write files
  - patch/replace text
  - grep/search
  - run shell commands
- Approval prompts for writes/shell by default
- `--yes` automation mode
- Session saving under `.ccode/sessions`
- Config stored in `~/.ccode/config.json`

## API keys

Set one or both:

```bash
export ANTHROPIC_API_KEY="..."
export OPENAI_API_KEY="..."
```

For OpenAI-compatible providers:

```bash
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4o-mini"
```

For Anthropic:

```bash
export ANTHROPIC_MODEL="claude-3-5-sonnet-latest"
```

## Usage

Interactive:

```bash
ccode chat
```

One-shot:

```bash
ccode run "Add a README and package.json" --yes
```

Configure defaults:

```bash
ccode config set provider anthropic
ccode config set anthropicModel claude-3-5-sonnet-latest
ccode config show
```

Use OpenAI-compatible mode:

```bash
ccode config set provider openai
ccode config set openaiModel gpt-4o-mini
ccode run "Explain this project"
```

## Local development

```bash
git clone https://github.com/anmolpromax8-creator/Claude-code.git
cd Claude-code
npm install
npm run build
npm link
ccode --help
```

## Safety

The CLI confines file tools to the current project root. It asks before file writes and shell commands unless `--yes` is used.

## Disclaimer

This project is not affiliated with Anthropic and is not the official Claude Code product.
