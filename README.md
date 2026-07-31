# CCode AI

An **original** agentic coding assistant CLI for local projects with a terminal TUI, slash commands, sessions, and safe coding-agent tools.

Repository: <https://github.com/anmolpromax8-creator/Claude-code>

> Not affiliated with Anthropic and not the official Claude Code product.

## Install

```bash
npm i -g ccode-ai
```

Then run:

```bash
ccode
# or
ccode-ai
```

## Features

- Real interactive terminal UI for coding sessions
- Slash command palette: type `/`
- Slash commands:
  - `/help` show commands
  - `/status` show provider/model/session/root
  - `/provider` switch Anthropic/OpenAI-compatible provider
  - `/model` change model
  - `/tools` list available agent tools
  - `/sessions` list saved sessions
  - `/resume` resume a saved session
  - `/save` save current session
  - `/clear` clear conversation context
  - `/yes` toggle auto-approval
  - `/cwd` change project root
  - `/compact` trim conversation context
  - `/exit` quit
- One-shot task mode with `ccode run "task"`
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

Start the TUI:

```bash
ccode
```

Or explicitly:

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

Check setup:

```bash
ccode doctor
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
