# Developer Manual

This manual outlines the architecture and structure of the jnj-obsidian-clipper Chrome extension based on src-structure.md.

## Key Components
- **Background Script**: Handles shortcuts like quick_clip (background.ts).
- **Content Script**: Extracts page content (content.ts).
- **Popup and Settings**: UI for clipping and configuration (core/popup.ts, core/settings.ts).

## Data Flow
- General clipping: Extract content → Match template → Save to Obsidian.
- AI Chat clipping: Extract AI content → Build variables → Save.

Refer to src-structure.md for details.