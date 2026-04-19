English | [简体中文](./README.zh-CN.md)

# mi-note-export

Batch export all notes from Xiaomi Cloud Notes (i.mi.com) as Markdown files.

## Features

- Automatically fetch all notes and convert to Markdown
- Preserve headings, lists, checkboxes, blockquotes, horizontal rules, etc.
- Download attachments (images, audio, video)
- **Content-hash-based incremental sync** (only fetch notes with content changes; won't re-export even if local file was moved)
- Automatically clean up notes deleted from the cloud
- Delete specific cloud notes (move to trash)
- Organize notes by folder
- Cookie caching + browser identity persistence to reduce repeated logins

## AI Skill

This project provides an AI coding assistant Skill definition file that enables AI assistants to perform note export operations for you:

```bash
npx skills add ceynri/mi-note-export
```

You can also manually copy `skills/mi-note-export/SKILL.md` to your project's Skill directory.

## Installation

Global installation:

```bash
npm install -g mi-note-export
```

Or install as a project dev dependency:

```bash
npm install -D mi-note-export
```

> Playwright Chromium (~200+ MB) will be automatically downloaded during installation. If auto-installation fails, run `npx playwright install chromium` manually.

## Usage

```bash
mi-note              # Incremental sync
mi-note --force      # Full re-sync
mi-note -o ./notes   # Specify output directory
```

Or run directly via `npx` without installing:

```bash
npx mi-note-export
```

## Options

| Option | Description |
|---|---|
| `-h, --help` | Show help |
| `-f, --force` | Full re-sync (ignore incremental state) |
| `-o, --output <dir>` | Specify output directory (default: reads from `.mi-note-export.json`, otherwise `output`) |
| `--login` | Force re-login (ignore cached Cookie) |
| `--delete-id <id>` | Delete a cloud note by ID (moves to trash, recoverable within 30 days) |
| `--clear-cache` | Clear system cache directory (Cookie and browser data) |
| `-y, --yes` | Skip confirmation prompts |
| `-v, --version` | Show version |

## Authentication Flow

1. **First run**: Opens a Chromium browser via Playwright → user manually logs in to Xiaomi account → Cookie is automatically extracted and cached
2. **Subsequent runs**: Reads cached Cookie → validates it → uses it if valid, otherwise opens browser for re-login

Browser identity data is persisted in the system cache directory (see "Data Directory" below). Xiaomi will recognize it as the same device on subsequent logins, usually without requiring SMS verification.

## Output Structure

```
output/
├── assets/                    # Attachments (images, audio, etc.)
├── folder-name/               # Note folder (if any)
│   └── note-title.md
├── note-title.md              # Notes with titles
└── 2025-01-01_12-00-00.md     # Untitled notes, named by creation time
```

## Configuration File

You can create a `.mi-note-export.json` file in the current working directory to avoid specifying `-o` every time:

```json
{ "output": "./my-notes" }
```

Output directory priority: `-o` CLI argument > `.mi-note-export.json` > default `output`.

## Data Directory

### System Cache Directory

Cookie and Playwright browser persistence data are stored in the system cache directory:

- **macOS**: `~/Library/Caches/mi-note-export/`
- **Linux**: `$XDG_CACHE_HOME/mi-note-export/` or `~/.cache/mi-note-export/`
- **Windows**: `%LOCALAPPDATA%/mi-note-export/cache/`

Contents:

- `cookie` — Cached login Cookie
- `browser-data/` — Playwright browser persistence data (device identity preserved to reduce re-verification)

### Output Directory

The incremental sync state file is stored inside the output directory:

- `<output>/.sync-state.json` — Tracks synced notes, modification dates, and content hashes (used to detect content changes)

## Known Limitations

- Private notes, todos, and mind maps are not supported
- Cookie has a limited lifespan (typically a few days); re-login is required after expiration
- Empty notes (no title and no content) are automatically skipped

## Development

```bash
pnpm install       # Install dependencies
pnpm build         # Compile TypeScript
pnpm dev           # Watch mode compilation
pnpm start         # Run
```

## Project Structure

```
mi-note-export/
├── src/
│   ├── cli.ts        # CLI entry point
│   ├── auth.ts       # Cookie retrieval, caching, validation
│   ├── api.ts        # Xiaomi Cloud Notes API wrapper
│   ├── converter.ts  # Note content parsing & Markdown conversion
│   ├── sync.ts       # Incremental sync logic & state management
│   ├── types.ts      # Type definitions
│   └── utils.ts      # Utility functions
├── .agents/          # AI assistant configuration (rules/agents)
├── skills/           # AI Skill source (for npx skills add)
├── dist/             # Build output (git ignored)
├── tsconfig.json
└── package.json
```

## License

MIT
