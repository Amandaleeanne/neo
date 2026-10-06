# Code map

NEO has no bundler. `main.js` is the Electron entry point; it creates the
window and coordinates filesystem, menus, and IPC. The renderer starts from
`index.html`, exposes only the preload bridge, and loads the scripts below in
order. Renderer scripts remain classic scripts so they can share the existing
application state without changing runtime behavior or the content security
policy.

## Main process and shared services

| File or folder | Role |
|---|---|
| `main.js` | Electron main-process entry point, shared services, window, IPC coordination, menus, and updates |
| `src/main/import.js` | DOCX/TXT/Markdown parsing and import IPC handlers |
| `src/main/export.js` | PDF generation, ZIP exports, file saving, and email-draft IPC handlers |
| `src/main/backups.js` | Daily library backup creation and retention |
| `src/main/updates.js` | Manual and automatic update checks and their IPC handlers |
| `src/main/menu.js` | Application menu construction and menu-state IPC |
| `src/main/library.js` | Library/book/chapter filesystem operations and durable-write recovery |
| `preload.js` | The complete renderer API exposed as `window.neo` |
| `i18n.js` | Shared translation lookup and formatting (`t()`, `tk()`) |
| `art.js` | Main-process cover painting service |
| `spell-worker.js` | Hunspell worker launched by the main process |

## Renderer

`app.js` contains shared renderer state, translation setup, and common
chapter/book helpers. `index.html` loads the remaining scripts in this order:

| Module | Role |
|---|---|
| `src/renderer/bookshelf.js` | Bookshelf display and book/shelf actions |
| `src/renderer/bound-shelves.js` | Bound-shelf books and their assembled pages |
| `src/renderer/editor-open.js` | Opening a book and rendering its editor |
| `src/renderer/editor-typing.js` | Manuscript editing and keyboard input |
| `src/renderer/paragraph-styles.js` | Poetry and flush-paragraph writing styles |
| `src/renderer/vim-keys.js` | Vim-style navigation and editing keys |
| `src/renderer/screenplay.js` | Screenplay editing rules, scene outline cards, Fountain/FDX conversion, pagination, and screenplay exports |
| `src/renderer/placeholders.js` | Manuscript placeholders and stickies |
| `src/renderer/navigation.js` | Chapter navigation pane and chapter actions |
| `src/renderer/tabs.js` | Manuscript, notes, outline, and darlings tabs |
| `src/renderer/outline.js` | Structured outline editing and manuscript sync |
| `src/renderer/counters.js` | Word, goal, and position counters |
| `src/renderer/persistence.js` | Debounced saves and synchronization with disk changes |
| `src/renderer/structural-undo.js` | Undo for structural edits and other large changes |
| `src/renderer/read-aloud.js` | Read-aloud controls and sentence highlighting |
| `src/renderer/find-replace.js` | Find and replace interactions |
| `src/renderer/import-ui.js` | Manuscript import interactions |
| `src/renderer/spellcheck.js` | On-demand spellcheck, suggestions, and typewriter scrolling |
| `src/renderer/focus-goals.js` | Focus mode, writing goals, sprints, and progress chart |
| `src/renderer/app-menus.js` | Cover-art settings and renderer-side menu actions |
| `src/renderer/export.js` | Book export and email-draft UI |
| `src/renderer/accessibility.js` | Keyboard accessibility, screen readers, and system settings |

## Other UI assets

| File or folder | Role |
|---|---|
| `index.html` | Bookshelf/editor markup, content security policy, and renderer script order |
| `styles.css` | UI styling and design tokens |
| `covers.js` | Shelf-cover illustrations and title typography |
| `locales/` | Interface translations |
| `pocket/` | Capacitor shell that reuses the desktop renderer |

## Syncing upstream changes

Run `npm run sync:upstream` from a clean worktree to fetch `upstream/main`.
The script compares against the common upstream base, then three-way merges
renderer and main-process source into their corresponding modules. Other
changed upstream files are merged in place. It does not create commits or
push changes. Review and commit its updates before running it again.

If changes overlap, it leaves all source files untouched and appends a
timestamped comparison to `UPDATE-CONFLICTS.md`. Resolve the reported sections
manually, commit the resolution, and run the sync again.
