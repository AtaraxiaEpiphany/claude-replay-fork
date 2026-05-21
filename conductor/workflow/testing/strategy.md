# Testing Strategy

## Test Directory Structure

<!-- DYNAMIC: This section is generated per-project during setup. -->
<!-- The test_root is determined by scanning the project for existing test directories. -->

### test_root: `test`

All test files MUST be created under `test`. NEVER co-locate test files with source code (exception: Go `_test.go` files follow language convention).

## File Placement Policy

### By Language

| Language | Test Directory | File Pattern | Class/Function Pattern | Convention |
|----------|---------------|--------------|----------------------|------------|
| Python | `tests/` | `test_{module}.py` | `Test{Class}` / `test_{scenario}_{outcome}` | Mirror `src/` structure |
| JavaScript | `__tests__/` or `tests/` | `{module}.test.js` | `describe` + `test`/`it` | Mirror `src/` structure |
| TypeScript | `__tests__/` or `tests/` | `{module}.test.ts` | `describe` + `test`/`it` | Mirror `src/` structure |
| Go | Same package | `{name}_test.go` | `Test{Function}` | Go convention: co-located |
| C++ | `tests/` | `{module}_test.cc` | `TEST_F({Class}Test, {Scenario})` | Mirror `src/` structure |
| C# | `{Project}.Tests/` | `{Class}Tests.cs` | `[Fact] {Method}_{Scenario}_{Outcome}()` | Mirror project structure |
| Dart | `test/` | `{name}_test.dart` | `group` + `test` | Mirror `lib/` structure |

### Mirror Rule

Source-to-test path mapping follows a strict mirror pattern:

```
src/{package}/{module}/{file}  →  test/{module}/{test_file}
```

Examples:
- `src/myapp/services/user.py` → `tests/services/test_user.py`
- `src/components/Button.tsx` → `__tests__/components/Button.test.tsx`
- `lib/src/models/user.dart` → `test/models/user_test.dart`
- `MyApp/Services/UserService.cs` → `MyApp.Tests/Services/UserServiceTests.cs`

### Existing Convention Rule

Before creating any test file:
1. Scan `test/` for existing test files.
2. If files exist, follow the established naming and placement convention.
3. If no files exist, use the language's default pattern from the table above.

## Test Types

| Type | Directory | Purpose | Scope |
|------|-----------|---------|-------|
| Unit | `test/{module}/` | Single function/class in isolation | Fast, no external dependencies |
| Integration | `test/integration/` | Multi-component interactions | May use real DB/API |
| E2E | `test/e2e/` | Full user flows | Slow, production-like |

## Coverage

- **Threshold:** >80% for all new code.
- **Scope:** Line coverage for unit tests. Branch coverage encouraged.
- **Exclusions:** Generated code, type definitions, pure configuration.
- **Enforcement:** Coverage gate (Firewall F3). No commit if below threshold.

## Shared Test Infrastructure

| Artifact | Location | Purpose |
|----------|----------|---------|
| Global fixtures | `test/conftest.py` or `test/setup.ts` | Shared setup/teardown |
| Module fixtures | `test/{module}/conftest.py` | Module-scoped fixtures |
| Test helpers | `test/helpers/` | Reusable utilities |
| Mocks / Fixtures | `test/fixtures/` or `test/__mocks__/` | Test data and mock implementations |
| Factories | `test/factories/` | Test data generation |

## Cache & Artifact Management

<!-- DYNAMIC: Injected from dev-commands/<lang>.md Environment section during setup. -->

Keep test artifacts out of the source tree:
- Python: `PYTHONPYCACHEPREFIX` redirects `__pycache__/` to `/tmp/`.
- Go: `GOCACHE` redirects build cache to `/tmp/`.
- C++: Build artifacts stay in `build/` (out-of-source CMake).
- C#: `bin/` and `obj/` stay in per-project directories (gitignored).
- JS/TS: `coverage/` and `.nyc_output/` gitignored.
- Dart: `.dart_tool/` and `build/` gitignored.

## Violation Recovery

If a test file is found outside `test/`:
1. Move it to the correct location per the mirror rule.
2. Update all imports.
3. Run tests to verify nothing broke.
4. Commit with `refactor(test): move misplaced test file`.
