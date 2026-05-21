# Tech Stack

## Runtime & Language

- **Runtime:** Node.js >= 18
- **Language:** JavaScript (ESM only, `.mjs` extension)
- **Module system:** ES Modules (`"type": "module"` in package.json)

## Build Tools

- **Bundler:** esbuild (minifies template HTML)
- **Package manager:** npm

## Testing

- **Unit tests:** Node.js built-in test runner (`node:test` + `node:assert/strict`)
- **E2E tests:** Playwright (`@playwright/test`)
- **Test directory:** `test/`
- **Test file pattern:** `test/test-*.mjs`

## Linting

- **Linter:** oxlint
- **Config:** `--deny-warnings` flag, targets `src/` and `bin/`

## CI/CD

- **Platform:** GitHub Actions
- **Containers:** Docker (for CI)

## Dependencies

- **Runtime:** Zero (design constraint)
- **Dev:** esbuild, @playwright/test

## Key Libraries (Internal)

- `src/formats/shared.mjs` — Canonical data model (`Turn`, `AssistantBlock`, `ToolCall`)
- `src/parser.mjs` — Public API facade
- `src/formats/index.mjs` — Format registry (plugin pattern)
