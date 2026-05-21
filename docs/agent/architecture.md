# Architecture

For the full, authoritative spec see `docs/ARCHITECTURE_SPEC.md` and `docs/MODULE_SPEC.md`. This document is a navigational summary for AI agents.

## Two-Layer Split

```
┌──────────────────────────────────────────────────┐
│  React Frontend (src/)                           │
│  - All JSON business logic                       │
│  - All UI state, dirty tracking, mode switching  │
│  - Recent files, tree nav, JSONPath, diagnostics │
└──────────────────────────────────────────────────┘
                  ↕ tauri.invoke
┌──────────────────────────────────────────────────┐
│  Rust Backend (src-tauri/)  — ~113 lines, thin   │
│  - File I/O only (open/save dialogs + read/write)│
│  - 10MB hard limit                               │
│  - Returns "CANCELLED" sentinel on user cancel   │
└──────────────────────────────────────────────────┘
```

**Critical rule:** Never put JSON parsing or transforms in Rust. All business logic stays in `src/lib/` as pure, testable functions.

## Directory Responsibilities

```
src/
├── main.tsx              # Entry: wraps App in ErrorBoundary + StrictMode
├── App.tsx               # ~990 lines — UI shell, state orchestration, command handlers
├── ErrorBoundary.tsx     # React error fallback
└── lib/                  # Pure logic, framework-agnostic, fully unit-tested
    ├── jsonTools.ts      # parse / format / minify / escape / unescape / tree / JSONPath
    ├── fileState.ts      # FileState type + transitions (createDemoFileState, fileStateFromPayload, updateFileContent, markSaved)
    └── *.test.ts         # Vitest specs (co-located)

src-tauri/src/
├── main.rs               # Binary entry → calls lib::run()
└── lib.rs                # 4 Tauri commands + plugin init
```

## The 4 Tauri Commands

| Command | Purpose |
|---|---|
| `open_json_file()` | Show open dialog, read file (≤10MB), return `FilePayload` |
| `open_json_file_at(path)` | Read file at known path (used by recent files) |
| `save_json_file(path, content)` | Write to known path |
| `save_json_file_as(content)` | Show save dialog, write |

All use `#[serde(rename_all = "camelCase")]` so JS sees `{ filePath, fileName, content, sizeBytes }` etc.

## Data Flow

```
User action → App handler → invoke() → Rust → FilePayload
           → fileStateFromPayload() → setFile()
           → useMemo(analyzeJson(content, mode, cursorOffset))
           → side panels (diagnostics, summary, tree) re-render
```

Editor `onChange` → `updateFileContent()` → recomputes `dirty` flag → memoized `analyzeJson` re-runs.

## Core Invariants

1. **Dirty tracking:** `dirty === (content !== originalContent)` except briefly during save-race protection.
2. **Save-race safety:** if user edits during a save, the new content stays dirty; only the baseline `originalContent` advances to what was actually written.
3. **Demo file is mandatory startup state** — `createDemoFileState()` ensures the editor is never empty on launch.
4. **Tree node cap:** `MAX_TREE_NODES = 250` to prevent UI jank on deeply nested JSON.
5. **Cancellation is not an error:** Tauri commands return the literal string `"CANCELLED"`; UI shows "操作已取消".

## Key Types (from `src/lib/`)

```ts
type JsonMode = "json" | "jsonc"

interface FileState {
  path: string | null
  name: string
  content: string
  originalContent: string
  dirty: boolean
  sizeBytes: number
}

interface ParseResult {
  value: unknown
  issues: ParseIssue[]
  summary: JsonSummary
  tree: JsonTreeNode[]
  treeTruncated: boolean
}
```

## Extension Path (Adding a New Transform)

Per `docs/MODULE_SPEC.md`, every new JSON transform requires:

1. A **pure function** in `src/lib/jsonTools.ts`
2. A **Vitest spec** in `src/lib/jsonTools.test.ts`
3. A **handler + button + shortcut** in `src/App.tsx`
4. **Doc updates** in `docs/MODULE_SPEC.md` and `docs/PRODUCT_SPEC.md`

## Explicit Non-Goals (v1)

- No multi-tab editing
- No JSON Schema validation
- No autosave
- No remote files
- No large-file (>10MB) optimization
- No plugin system
