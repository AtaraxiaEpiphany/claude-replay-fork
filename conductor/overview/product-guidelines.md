# Product Guidelines

## Design Principles

1. **Zero runtime dependencies** — the published package must have zero production dependencies. Only devDependencies (esbuild, playwright) are allowed.
2. **Self-contained output** — generated HTML files must be fully standalone, requiring no server or external resources.
3. **ESM only** — all source files use `.mjs` extension and ES module syntax. No CommonJS.
4. **Node.js >= 18** — target the built-in test runner, built-in zlib, and modern JS features.
5. **Plugin architecture** — format parsers are independent modules behind a registry. Adding a new format must not modify existing parsers.

## Code Quality

- **Pre-commit hooks** — oxlint runs on `src/` and `bin/` before every commit.
- **Test runner** — Node.js built-in `node:test` + `node:assert/strict` for unit tests.
- **E2E testing** — Playwright for browser-based integration tests.
- **Linting** — oxlint with `--deny-warnings` flag.

## Scope Boundaries

- **In scope:** Parsing transcripts, rendering HTML replays, secrets redaction, themes, CLI UX, editor UI.
- **Out of scope:** Real-time streaming, server-side hosting, user accounts, database storage.

## Naming Conventions

- **Files:** kebab-case (`my-format.mjs`, `test-parser.mjs`)
- **Exports:** camelCase functions, PascalCase classes/types
- **CLI flags:** kebab-case (`--theme-name`, `--no-redact`)

## Commit Conventions

Format: `<type>(<scope>): <description>`
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
