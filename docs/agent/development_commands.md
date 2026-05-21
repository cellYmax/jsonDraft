# Development Commands

All commands assume `pnpm` as the package manager (see `pnpm-lock.yaml`).

## Frontend Development

| Command | Description |
|---|---|
| `pnpm run dev` | Start Vite dev server on port 1420 (browser only, no Tauri shell). Useful for fast UI iteration. |
| `pnpm run preview` | Preview the production frontend bundle. |
| `pnpm run build` | Run `tsc` (type check, no emit) then `vite build`. This is the canonical "does it compile" check. |

## Desktop (Tauri) Development

| Command | Description |
|---|---|
| `pnpm run tauri dev` | Launch the full desktop app with Rust backend + Vite HMR. |
| `pnpm run tauri build` | Produce a production desktop bundle (platform-specific installer). |
| `pnpm run tauri` | Pass-through to the Tauri CLI for any subcommand. |

## Testing

| Command | Description |
|---|---|
| `pnpm test` | Run Vitest once (CI mode). |
| `pnpm run test:watch` | Run Vitest in watch mode for TDD. |

To run a single test file: `pnpm test src/lib/jsonTools.test.ts`.
To filter by name: `pnpm test -t "format"`.

## Rust / Backend Checks

The Tauri backend lives in `src-tauri/`. There is no `cargo` script in `package.json` — invoke directly:

```bash
# Type-check the Rust crate
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml

# Run the native binary directly (without Tauri webview wrapper)
cargo run --package json-draft --bin json-draft --manifest-path src-tauri/Cargo.toml
```

The crate is named `json-draft`; the library target is `json_draft_lib` (renamed to avoid Windows binary/lib name conflicts).

## Linting & Formatting

**None configured.** There is no ESLint, Prettier, or Biome config in the repository. Code quality is enforced exclusively via TypeScript strict settings:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

`pnpm run build` (which runs `tsc`) is the de-facto lint step.

## Recommended Pre-Commit Sequence

```bash
pnpm test
pnpm run build
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
```
