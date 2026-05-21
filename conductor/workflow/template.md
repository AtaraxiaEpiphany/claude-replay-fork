# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` *before* implementation
3. **Test-Driven Development:** Write unit tests before implementing functionality
4. **High Code Coverage:** Aim for >80% code coverage for all modules
5. **User Experience First:** Every decision should prioritize user experience
6. **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode tools to ensure single execution.

## Task Execution

Tasks follow the [Standard Task Workflow](./task-workflow.md). When a phase completes, execute the [Phase Checkpoint Protocol](./phase-checkpoint.md).

## Quality Gates

Before marking any task complete, verify:

- [ ] All tests pass
- [ ] Code coverage meets requirements (>80%)
- [ ] Code follows project's code style guidelines
- [ ] Public functions/methods are documented
- [ ] Type safety is enforced
- [ ] No linting or static analysis errors
- [ ] No security vulnerabilities introduced

## Development Commands

### Environment
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```
> Keep test artifacts and coverage reports out of source: add `coverage/` and `.nyc_output/` to `.gitignore`.

### Setup
```bash
npm install
```

### Daily Development
```bash
npm test              # Run all unit tests (node --test test/test-*.mjs)
node --test test/test-parser.mjs   # Run a single test file
npm run build         # Minify template/player.html → player.min.html (esbuild)
npm run build:website # Build template + website into docs/
npm run test:e2e      # Run Playwright E2E tests (Chromium, headless)
npx oxlint@latest --deny-warnings src/ bin/   # Lint
```

## Testing Requirements

### Unit Testing
- Every module must have corresponding tests
- Use appropriate test setup/teardown mechanisms
- Mock external dependencies
- Test both success and failure cases

### Integration Testing
- Test complete user flows
- Verify database transactions
- Test authentication and authorization

## Commit Guidelines

### Message Format
```
<type>(<scope>): <description>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintenance tasks

## Definition of Done

A task is complete when:

1. All code implemented to specification
2. Unit tests written and passing
3. Code coverage meets project requirements
4. Documentation complete (if applicable)
5. Code passes all configured linting and static analysis checks
6. Implementation notes added to `plan.md`
7. Changes committed with proper message
8. Git note with task summary attached to the commit
