# CCode AI

An **original** agentic coding assistant CLI for local projects with an improved terminal TUI, slash commands, sessions, animated thinking states, and safe coding-agent tools.

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

## What's new

- Improved terminal UI with splash/header, status frame, compact non-wrapping lines, and input bar
- `Ctrl+O` expands/collapses the input bar
- Animated generating indicator while the model responds
- Assistant output appears character-by-character in the terminal
- Stable non-animated thinking block disappears before the final response, instead of flickering or leaving “generating” text behind
- Markdown tables are rendered as compact terminal tables
- NVIDIA NIM provider support using the official base URL only:
  - `https://integrate.api.nvidia.com/v1`
- `/model` auto-fetches the available NVIDIA NIM model list from the official `/models` endpoint and lets you pick one
- If the selected provider API key is missing, the CLI asks for it securely

- API keys are saved locally in `~/.ccode/keys.json` with `0600` permissions after you enter them once
- `/logout` forgets the saved API key for the current provider
- More stable compact TUI rendering for narrow/mobile terminals

## Features

- Interactive TUI chat and one-shot task mode
- Slash command palette: type `/` and live suggestions appear
- Live slash-command suggestions appear while typing; `/ex` then Enter runs `/exit`, `/mo` then Enter runs `/model`
- Slash commands:
  - `/help` show commands
  - `/status` show provider/model/session/root
  - `/provider` switch Anthropic/OpenAI-compatible/NVIDIA NIM provider
  - `/apikey` enter and save API key for current provider
  - `/logout` forget saved API key for current provider
  - `/model` change model; on NVIDIA this fetches the live model list automatically
  - `/tools` list available agent tools
  - `/sessions` list saved sessions
  - `/resume` resume a saved session
  - `/save` save current session
  - `/clear` clear conversation context
  - `/yes` toggle auto-approval
  - `/cwd` change project root
  - `/compact` trim conversation context
  - `/exit` quit
- Anthropic API, OpenAI-compatible APIs, and NVIDIA NIM support
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

Set any provider key ahead of time, or let the CLI ask when needed. When entered in the CLI, keys are saved locally in `~/.ccode/keys.json` with file mode `0600`. Use `/logout` to forget the current provider key.

```bash
export ANTHROPIC_API_KEY="..."
export OPENAI_API_KEY="..."
export NVIDIA_API_KEY="..."
```

For OpenAI-compatible providers:

```bash
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4o-mini"
```

For NVIDIA NIM:

```bash
export NVIDIA_API_KEY="..."
export NVIDIA_MODEL="nvidia/llama-3.1-nemotron-ultra-253b-v1"
```

NVIDIA NIM always uses:

```text
https://integrate.api.nvidia.com/v1
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

Use NVIDIA NIM:

```bash
ccode config set provider nvidia
ccode config set nvidiaModel nvidia/llama-3.1-nemotron-ultra-253b-v1
ccode
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
