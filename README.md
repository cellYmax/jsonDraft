# jsonDraft

Local desktop JSON editor built with Tauri, React, TypeScript, and Monaco Editor.

## Features

- Open, edit, save, and save as local JSON or JSONC files.
- Validate strict JSON and JSONC with clear parse issues.
- Format, minify, escape, and unescape JSON content.
- Inspect summary metadata, current JSON path, and a collapsible tree view.
- Start with bundled demo JSON files for local testing.

## Development

```bash
pnpm install
pnpm run tauri dev
```

## Checks

```bash
pnpm test
pnpm run build
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
```
