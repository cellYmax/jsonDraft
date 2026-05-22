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

## Documentation Map

All authoritative project documentation lives under `docs/`:

- `docs/PRODUCT_SPEC.md` — v1 scope, user flows, acceptance criteria, non-goals.
- `docs/ARCHITECTURE_SPEC.md` — Two-layer split (Rust/React), data flow, security, invariants, Tauri commands overview.
- `docs/MODULE_SPEC.md` — Core types, Tauri command details, `jsonTools` / `fileState` / `App` APIs, extension points.
- `docs/TEST_SPEC.md` — All build/test commands, Vitest setup, unit-test coverage, manual regression checklist, risk matrix.
- `docs/AI_CODING_GUIDE.md` — **Authoritative starting point for AI assistants.** Project conventions (Chinese UI, CANCELLED sentinel, serde camelCase, FileState helpers, etc.), task→file lookup, change-flow templates.

**When working on a task, start from `docs/AI_CODING_GUIDE.md`, then read only the SPEC(s) relevant to your change.**
