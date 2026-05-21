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

## Specs

- [Docs index](./docs/README.md)
- [Product spec](./docs/PRODUCT_SPEC.md)
- [Architecture spec](./docs/ARCHITECTURE_SPEC.md)
- [Module spec](./docs/MODULE_SPEC.md)
- [Test spec](./docs/TEST_SPEC.md)
- [AI coding guide](./docs/AI_CODING_GUIDE.md)

## Checks

```bash
pnpm test
pnpm run build
cargo check --package json-draft --manifest-path src-tauri/Cargo.toml
```
