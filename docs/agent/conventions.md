# Project Conventions

Patterns specific to jsonDraft that go beyond what TypeScript strict mode catches. For the AI-assistant playbook see `docs/AI_CODING_GUIDE.md`.

## Language: Chinese UI, English Code

- **All user-facing copy is Simplified Chinese** — UI labels, toast messages, error strings (including those returned from Rust), doc files.
- **All identifiers, comments, commit messages are English.**
- When adding a new feature, write the Chinese copy following the tone in `docs/PRODUCT_SPEC.md` (concise, neutral, technical).

Examples of Rust-side Chinese error strings:
```rust
"无法读取文件：{path}"
"文件超过 10MB，v1 暂不支持打开。"
```

## Cancellation Sentinel, Not Error

Tauri file dialog commands return the **string literal `"CANCELLED"`** when the user closes the dialog — they do **NOT** throw. Frontend handlers must check for this string explicitly and show "操作已取消" instead of treating it as failure.

```ts
const result = await invoke<string>("save_json_file_as", { content });
if (result === "CANCELLED") { /* show cancel toast */ return; }
```

## Rust ↔ JS Naming via Serde

All Rust structs crossing the boundary use:
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FilePayload { file_path: String, file_name: String, ... }
```
JS receives `{ filePath, fileName }`. Never use snake_case keys in TypeScript types.

## File Size Limit

`MAX_FILE_BYTES = 10 * 1024 * 1024` is enforced in **Rust**, not JS. Don't duplicate the check in the frontend; let the Rust error propagate.

## State Mutation Pattern

`FileState` is the single source of truth. All transitions go through pure helpers in `src/lib/fileState.ts`:

- `createDemoFileState()` / `createBlankFileState()` — initial states
- `fileStateFromPayload(payload)` — after Rust I/O
- `updateFileContent(state, content)` — on editor change
- `markSaved(state, savedContent)` — after successful write (handles save-race)

**Never mutate `FileState` inline in `App.tsx`** — always call a helper.

## Memoization Pattern

`parseResult` is derived via `useMemo` from `(content, mode, cursorOffset)`. When adding state that affects parsing/analysis, extend this dependency tuple — don't introduce a parallel `useEffect`.

## Demo File on Startup

The app **must never open with an empty editor**. `createDemoFileState()` imports `examples/customer-profile.json` via Vite's `?raw` query and uses it as the initial state. If you change this default, update `docs/PRODUCT_SPEC.md` accordingly.

## Tree Truncation

JSON tree navigation is capped at `MAX_TREE_NODES = 250`. The `ParseResult` returns `treeTruncated: boolean` — UI shows a "...truncated" hint when true.

## Keyboard Shortcuts

Defined centrally in `App.tsx`. Standard set:

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+N` | New |
| `Cmd/Ctrl+O` | Open |
| `Cmd/Ctrl+S` | Save |
| `Cmd/Ctrl+Shift+S` | Save As |
| `Cmd/Ctrl+Enter` | Format |
| `Cmd/Ctrl+Shift+M` | Minify |
| `Cmd/Ctrl+Shift+E` | Escape |
| `Cmd/Ctrl+Shift+U` | Unescape |

When adding a shortcut, register it in the same handler block and document it in `docs/MODULE_SPEC.md`.

## Documentation Is a Contract

The `docs/*.md` specs are not aspirational — they describe the current state and are dated. When changing behavior:

1. Update the relevant spec(s): `PRODUCT_SPEC`, `ARCHITECTURE_SPEC`, `MODULE_SPEC`, `TEST_SPEC`.
2. Bump the date in the doc header.
3. The `docs/AI_CODING_GUIDE.md` "task → file" table is the canonical lookup for "where do I make this change?"
