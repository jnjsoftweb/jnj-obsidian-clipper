# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript + bundle with Webpack (outputs to dist/)
npm run dev          # Watch mode for development (tsc -w & webpack --watch)
```

There are no tests in this project.

After building, load the extension in Chrome via `chrome://extensions/` → "Load unpacked" → select the `dist/` folder.

## Architecture Overview

This is a Chrome Extension (Manifest V3) that clips web content into Obsidian vaults as Markdown notes.

### Extension Entry Points

| File | Role |
|------|------|
| `src/background.ts` | Service worker — routes messages, handles `quick_clip` keyboard command |
| `src/content.ts` | Content script injected on all pages — responds to `getPageContent` and `extractContent` messages, extracts page HTML, selected text, and schema.org JSON-LD |
| `src/core/popup.ts` | Popup UI — orchestrates the full clipping flow |
| `src/core/settings.ts` | Options page — manages templates and general settings |

### Clipping Flow

1. User opens popup (or triggers `quick_clip` shortcut)
2. Popup sends `getPageContent` message to content script via `chrome.tabs.sendMessage`
3. Content script returns raw HTML, selected HTML, and schema.org data
4. `content-extractor.ts:initializePageContent()` parses HTML with Readability, extracts metadata (title, author, description, etc.), and builds the `currentVariables` map (`{{variable}}` → value)
5. `triggers.ts:findMatchingTemplate()` selects the best template by matching URL patterns or schema.org `@type`
6. Template variables are resolved via `content-extractor.ts:replaceVariables()`, which handles `{{variable}}`, `{{selector:css}}`, and `{{schema:key}}` syntaxes, then applies filters via `filters.ts`
7. `obsidian-note-creator.ts:saveToObsidian()` constructs an `obsidian://new?...` URI and navigates the active tab to it, which opens Obsidian and creates the note

### Template Storage

Templates are stored in `chrome.storage.sync` compressed with `lz-string` (UTF-16) to fit within Chrome's storage quotas:
- `template_list` → array of template IDs
- `template_{id}` → array of compressed string chunks (max 8000 chars each)
- General settings are at `general_settings` + `vaults` keys
- UI state (e.g., `propertiesCollapsed`, `lastSelectedVault`) uses `chrome.storage.local`

### Key Modules

- **`src/utils/content-extractor.ts`** — Variable extraction pipeline. `initializePageContent()` builds the variables map; `replaceVariables()` resolves all `{{...}}` expressions in template strings.
- **`src/utils/markdown-converter.ts`** — Converts HTML → Markdown using Mozilla Readability + Turndown with GFM plugin.
- **`src/utils/filters.ts`** — Implements all template filters (`blockquote`, `callout`, `capitalize`, `date`, `join`, `slice`, `wikilink`, etc.).
- **`src/utils/triggers.ts`** — Template auto-selection: simple URL prefix matching, regex patterns (`/regex/`), and `schema:@type=Value` matching.
- **`src/managers/template-manager.ts`** — CRUD for templates, handles lz-string compression/chunking.
- **`src/managers/template-ui.ts`** / **`general-settings-ui.ts`** — UI logic for the settings page.

### Template Behaviors

The `Template.behavior` field controls how notes are created:
- `create` — new note with YAML frontmatter
- `append-specific` — append to a named note (`specificNoteName`)
- `append-daily` — append to today's daily note (formatted with `dailyNoteFormat`)

### Variable Syntax

Templates use `{{variable}}`, `{{variable|filter}}`, `{{selector:css:attr}}`, `{{schema:key.path}}`, and `{{meta:name:key}}` / `{{meta:property:key}}`. Filters are chainable with `|`.
