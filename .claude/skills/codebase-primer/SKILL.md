---
name: codebase-primer
description: Efficiently build a mental model of the codebase without overloading context. Triggers on first interaction, "get familiar with the code", "understand this project", "read the codebase", or any new Claude Code session.
user-invocable: true
---

# Codebase Primer

Efficiently build a mental model of the codebase without overloading context.

## On Session Start

Execute this sequence automatically on first interaction:

### 1. Read Documentation First

```bash
find ./docs -type f -name "*.md" 2>/dev/null | head -20
```

Read all markdown files in `/docs` (or `./docs`, `/documentation`, `./doc`). This is the highest-signal source — developers wrote it for humans.

If no docs folder exists, check for: README.md, ARCHITECTURE.md, CONTRIBUTING.md, or any markdown in the root.

### 2. Get Structural Overview

```bash
find . -type d -not -path '*/\.*' -not -path '*/node_modules/*' -not -path '*/venv/*' -not -path '*/__pycache__/*' -not -path '*/dist/*' -not -path '*/build/*' | head -50
```

Identify:
- Entry points (index.ts, main.ts, app.*, src/)
- Core modules vs utilities vs config
- Test structure location
- Monorepo packages and their boundaries

### 3. Identify Key Files (Don't Read Yet)

Note but don't read in full:
- Config files (package.json, tsconfig.json, pnpm-workspace.yaml) — skim dependencies only
- Type definitions (`types.ts`) — the type system is the contract surface
- Balance data (`strategy_game_balance_master.xlsx`) — source of truth for tuning

### 4. Build Mental Map

Summarize internally (don't output unless asked):
- What does this project do?
- What's the tech stack?
- Where does game logic live vs rendering vs networking?
- Where are the tests?
- What design docs govern the implementation?

## What NOT to Do

- Don't read every source file
- Don't load large files into context "just in case"
- Don't read test files unless working on tests
- Don't read generated files (dist/, build/, .next/, node_modules/)
- Don't summarize back to user unless asked — just be ready to work

## When Asked to Go Deeper

Only then read specific implementations. Use the mental map to navigate directly to relevant code instead of scanning everything.

## Context Budget

Target: Under 10k tokens for initial familiarization. Save context for actual work.
