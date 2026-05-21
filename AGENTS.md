# AGENTS.md

This file provides guidance to myflicker when working with code in this repository.

## WHY: Purpose and Goals

jsonDraft is a local-first desktop JSON/JSONC editor for developers needing to view, validate, format, minify, escape/unescape, and navigate small (<10MB) JSON files. v1 is deliberately scoped — no multi-tab, schema validation, or autosave.

## WHAT: Technical Stack

- **Desktop shell:** Tauri 2 (Rust backend, thin I/O-only layer)
- **Frontend:** React 19 + TypeScript 5.8 (strict mode) + Vite 7
- **Editor:** Monaco Editor via `@monaco-editor/react`
- **JSON engine:** `jsonc-parser` (parse, format, JSONPath)
- **Testing:** Vitest 4 + jsdom + Testing Library
- **Package manager:** pnpm
- **No linter/formatter configured** — TypeScript strict mode is the only enforcement

## HOW: Core Development Workflow

```bash
# Frontend dev (browser, no Tauri shell)
pnpm run dev

# Full desktop dev (with Rust backend)
pnpm run tauri dev

# Tests
pnpm test

# Build (TS check + frontend bundle)
pnpm run build
```

## Progressive Disclosure

For detailed information, consult these documents as needed:

- `docs/agent/development_commands.md` — All build, test, Tauri, and Rust commands
- `docs/agent/architecture.md` — Two-layer split, data flow, core invariants
- `docs/agent/testing.md` — Vitest setup, coverage areas, test conventions
- `docs/agent/conventions.md` — Project-specific patterns (Chinese copy, sentinels, etc.)

The project also has comprehensive specs in `docs/`:
- `docs/PRODUCT_SPEC.md` — v1 scope and acceptance criteria
- `docs/ARCHITECTURE_SPEC.md` — full architecture spec
- `docs/MODULE_SPEC.md` — core types and module APIs
- `docs/AI_CODING_GUIDE.md` — explicit AI assistant rules and task→file mapping

**When working on a task, first determine which documentation is relevant, then read only those files.** For non-trivial changes, `docs/AI_CODING_GUIDE.md` is the authoritative starting point.
