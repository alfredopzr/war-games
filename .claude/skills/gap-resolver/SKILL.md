# Gap Resolver — Audit-to-Code Pipeline

Resolves contract gaps identified by the contract-gap-finder audit. Converts audit findings into contracts, plans, code, and tests.

## Trigger

Invoke with `/gap-resolver` after a contract-gap-finder audit has produced a ledger in `audit/ledgers/`.

## Inputs

- **Ledger**: Most recent `audit/ledgers/*_contract_gaps.md` file
- **Scope**: Default is FIX NOW (P0). User may override with a different priority tier or specific gap IDs.

## Core Principles

These are hard constraints. Every step of the pipeline enforces them:

1. **One path.** There is exactly one code path for any behavior. Legacy paths, compatibility shims, and "old way still works" code are deleted, not preserved.
2. **No fallbacks.** If a function needs data, it requires it. Optional parameters that silently degrade behavior are replaced with required parameters that throw on absence.
3. **Fail fast.** Unexpected state = throw with a clear message. Never silently recover. Never return a default. Never continue with partial data.
4. **Delete, don't deprecate.** Dead code is deleted. Functions replaced by new implementations are removed, not marked `@deprecated`. Tests that exercise dead code paths are rewritten to exercise the live path.
5. **Contracts first.** Code changes only happen after the contract is written and accepted. The contract defines what correct means. The code implements it. The test enforces it.

## Pipeline

### Phase 1 — Scope

1. Read the most recent audit ledger.
2. Extract all gaps at the target priority tier (default: P0).
3. Present the scoped gap list to the user:
   - Gap ID, severity, one-line summary
   - Files affected
   - What the fix requires (contract update, code change, test, deletion)
4. User accepts or narrows the scope.

### Phase 2 — Contracts

For each gap in scope, propose the contract resolution:

| Gap Type | Contract Output |
|----------|----------------|
| Uncontracted mechanic | New rule in the relevant design doc or inline contract comment |
| Uncontracted state transition | Guard assertion + doc update |
| Uncontracted balance surface | Entry in balance.json + doc update |
| Uncontracted interaction | Interaction rule in the owning system's doc |
| Uncontracted edge case | Explicit edge case rule + test scenario |
| Design doc ↔ engine divergence | Update the stale doc to match engine (or update engine if doc is authoritative) |
| Uncontracted API surface | JSDoc contract on the function + validation at boundary |

**Output format per gap:**

```
## GAP-{N}: {title}

### Contract
{The rule, stated precisely. What is correct. What is forbidden. What must hold.}

### Doc Changes
- {file}: {section} — {what changes}

### Code Changes
- {file}:{lines} — {what changes}

### Dead Code Removal
- {file}:{lines} — {what is deleted and why}

### Test Scenarios
- {test description} — asserts {what}
```

Present all proposed contracts to the user. User accepts, rejects, or modifies each.

### Phase 3 — Documentation

Write the accepted contracts into the codebase:

- Update design docs (`docs/*.md`)
- Update `balance.json` if balance surfaces changed
- Add inline contract comments only where the rule is non-obvious from the code itself
- Delete stale doc sections that contradict the new contracts

Do NOT write code yet. Commit the doc changes separately if the user wants.

### Phase 4 — Plan

Enter plan mode. Produce an implementation plan for the code changes:

- Ordered list of changes, grouped by file
- For each change: what it does, what it deletes, what tests it needs
- Dependency order (which changes must land first)
- Dead code inventory: every function, constant, parameter, and test that must be deleted

**Dead code rules for the plan:**

- If a function is replaced, delete the old function. Do not keep it alongside the new one.
- If a parameter becomes required, update every caller. Do not add a default.
- If a test exercises a deleted code path, rewrite the test for the live path. Do not skip or comment it out.
- If a fallback is removed, every caller that relied on the fallback must be updated to pass the required data.

Present plan to user. User accepts or modifies.

### Phase 5 — Implement

Execute the accepted plan:

1. Write tests first (TDD). Tests encode the new contracts.
2. Implement code changes.
3. Delete dead code identified in Phase 4.
4. Run `pnpm test` after each file-level change.
5. If a test fails, fix the code — do not weaken the test to match broken behavior.

### Phase 6 — Verify

1. Run full test suite: `pnpm test`
2. Confirm zero test failures.
3. Confirm no dead code remains from the deletion list.
4. Present summary to user:
   - Gaps resolved (with gap IDs)
   - Contracts written (doc locations)
   - Code changed (files and line counts)
   - Dead code deleted (functions, constants, parameters removed)
   - Tests added/rewritten (count and what they cover)

## Anti-Patterns — Never Do These

- **Never add a fallback to fix a gap.** If vision needs unitStats, make it required. Don't add `?? UNIT_STATS`.
- **Never keep legacy code "for tests."** Tests must exercise the production code path.
- **Never add a guard that silently succeeds.** `if (!data) return;` is not a fix. `if (!data) throw new Error('...')` is.
- **Never preserve backwards compatibility.** If the interface changes, change every caller. This is a monorepo — there are no external consumers.
- **Never add a default parameter to avoid updating callers.** Update the callers.
- **Never comment out dead code.** Delete it.
- **Never mark something `@deprecated`.** Delete it now or don't touch it.

## Commit Discipline

- Doc changes: one commit ("Contract: {gap summary}")
- Code changes per gap or per logical group: one commit ("Fix GAP-{N}: {summary}")
- Dead code deletion can be in the same commit as the fix, not separate
- Test additions in the same commit as the code they test
