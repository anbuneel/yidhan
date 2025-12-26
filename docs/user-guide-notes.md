# Zenote User Guide Notes

This document collects information for a future user guide. These are explanations and tips that would be helpful for users.

---

## Copy to Clipboard Options

Zenote offers two ways to copy a note from the editor (via the export menu or `Cmd/Ctrl+Shift+C`):

### Copy as text (plain text)
**Best for:** Email, Slack, text fields, anywhere

Example output:
```
Morning Reflection

Tags: journal, mindfulness

Today I'm grateful for the quiet moments...
• First item
• Second item
```

- Strips all HTML formatting
- Universal compatibility
- Lists become `•` bullets or `1.` numbers
- Task lists become `[ ]` or `[x]`

### Copy with formatting (HTML)
**Best for:** Google Docs, Word, rich email composers, Notion

- Preserves **bold**, *italic*, headings, lists
- Paste into rich editors maintains structure
- Provides both HTML and plain text (app chooses best format)

### When to use which?

| Destination | Recommended Option |
|-------------|-----|
| Slack, Discord, SMS | Copy as text |
| Plain text email | Copy as text |
| Google Docs, Word | Copy with formatting |
| Rich email (Gmail compose) | Copy with formatting |
| Notion, Confluence | Copy with formatting |
| Terminal, code editor | Copy as text |

**Note:** The keyboard shortcut `Cmd/Ctrl+Shift+C` uses plain text (safer default).

---

## Keyboard Shortcuts

| Shortcut | Action | Where |
|----------|--------|-------|
| `Cmd/Ctrl + N` | Create new note | Library |
| `Cmd/Ctrl + K` | Focus search | Library |
| `Escape` | Save and go back | Editor |
| `Cmd/Ctrl + Shift + C` | Copy note to clipboard | Editor |
| `Cmd/Ctrl + B` | Bold | Editor |
| `Cmd/Ctrl + I` | Italic | Editor |
| `Cmd/Ctrl + U` | Underline | Editor |

---

## Slash Commands

Type `/` in the editor to access quick commands:

| Command | What it does |
|---------|-------------|
| `/h1`, `/h2`, `/h3` | Insert headings |
| `/bullet` | Start a bullet list |
| `/numbered` | Start a numbered list |
| `/todo` | Insert a task checkbox |
| `/quote` | Insert a blockquote |
| `/code` | Insert a code block |
| `/highlight` | Highlight text |
| `/divider` | Insert a horizontal line |
| `/date` | Insert today's date (e.g., "Dec 25, 2024") |
| `/time` | Insert current time (e.g., "3:30 PM") |
| `/now` | Insert date and time |

---

## Faded Notes (Soft Delete)

When you delete a note, it moves to "Faded Notes" instead of being permanently deleted.

- Notes rest in Faded Notes for **30 days**
- Access via the profile menu → "Faded Notes"
- **Restore**: Brings the note back to your library
- **Release**: Permanently deletes the note
- After 30 days, notes are automatically released

---

## Temporal Chapters

Notes are automatically organized by time:

- **Pinned**: Notes you've pinned (always at top)
- **Today**: Notes edited today
- **This Week**: Notes from the past 7 days
- **Last Week**: Notes from 7-14 days ago
- **This Month**: Notes from this calendar month
- **Earlier**: Notes from previous months
- **Archive**: Notes older than 6 months

Click a chapter header to collapse/expand it.

---

## Export Options

### From Library (profile menu)
- **Export (JSON)**: Full backup of all notes and tags
- **Export (Markdown)**: All notes in a single `.md` file
- **Import Notes**: Restore from JSON or Markdown backup

### From Editor (export button)
- **Copy as text**: Copy to clipboard (plain text)
- **Copy with formatting**: Copy to clipboard (HTML)
- **Download (.md)**: Save note as Markdown file
- **Download (.json)**: Save note as JSON file

---

## Tips

### Pin important notes
Click the pin icon on any note card to keep it at the top of your library.

### Quick search
Press `Cmd/Ctrl + K` anywhere in the library to jump to search.

### Tag filtering
Click tags in the filter bar to show only notes with those tags. Click "All Notes" to clear filters.

### Theme toggle
Click the sun/moon icon in the header to switch between light and dark themes.

---

*This document will be expanded as more user-facing features are added.*
