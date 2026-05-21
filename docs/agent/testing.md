# Testing

For test scope details and the manual regression checklist see `docs/TEST_SPEC.md`.

## Framework

- **Vitest 4.1.6** as test runner
- **jsdom** as DOM environment (configured in `vite.config.ts`)
- **Testing Library** packages installed (`@testing-library/react`, `jest-dom`, `user-event`) but **no React component tests exist yet** — flagged as future work.
- Test config lives inline in `vite.config.ts` under the `test:` key (no separate `vitest.config.ts`):
  ```ts
  test: { environment: "jsdom", globals: true }
  ```

## Test File Locations

Tests are **co-located** with source under `src/lib/`:

```
src/lib/
├── jsonTools.ts
├── jsonTools.test.ts      # parsing, formatting, JSONPath, tree generation
├── fileState.ts
└── fileState.test.ts      # FileState transitions, payload conversion
```

Naming convention: `<module>.test.ts`.

## Running Tests

```bash
pnpm test                              # one-shot run (CI)
pnpm run test:watch                    # watch mode (TDD)
pnpm test src/lib/jsonTools.test.ts    # single file
pnpm test -t "format"                  # filter by test name
```

## What Is Covered

**`jsonTools.test.ts`:**
- Strict JSON vs JSONC parsing (comments, trailing commas)
- Error messages with line/column positions
- JSONPath computation from cursor offset
- Tree node generation + truncation at `MAX_TREE_NODES`
- Format / minify / escape / unescape

**`fileState.test.ts`:**
- `createDemoFileState()` produces the bundled demo
- `createBlankFileState()`
- `fileStateFromPayload()` correctly maps Rust → JS shape
- Dirty flag transitions on `updateFileContent`
- `markSaved()` advances `originalContent` baseline correctly (incl. save-race scenarios)

## What Is NOT Covered

- React components (App, ErrorBoundary) — no UI tests yet
- Rust commands — verified only via `cargo check`; integration tests are future work
- End-to-end Tauri scenarios — manual checklist in `docs/TEST_SPEC.md`

## Conventions

1. **Pure functions only.** Tests target `src/lib/` modules — no Tauri mocking needed.
2. **Globals enabled** (`globals: true`) — use `describe`, `it`, `expect` directly without imports.
3. **No fixtures directory** — inline test data in the spec file. For demo content, import from `examples/` via `?raw`.
4. **When adding a JSON transform**, you MUST add a corresponding `*.test.ts` case (per `docs/MODULE_SPEC.md` contract).
