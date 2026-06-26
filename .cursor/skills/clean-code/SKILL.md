---
name: clean-code
description: Conservatively clean and refactor existing code without changing behavior. Use when explicitly invoked to remove unnecessary code, simplify implementation, or consolidate duplicated logic.
disable-model-invocation: true
---

# Clean Code

## Goal

Clean existing code while preserving behavior. Prefer less code, less duplication, clearer names, and simpler control flow.

## Workflow

1. Understand the current behavior before editing.
   - Read the relevant files and nearby tests.
   - Identify public APIs, persisted data shapes, user-visible behavior, and integration boundaries.
   - If behavior is unclear and the refactor could change results, ask before editing.
2. Make conservative improvements only.
   - Remove unused imports, variables, functions, branches, comments, and files only when they are clearly unused.
   - Simplify conditionals, loops, and data transformations when the simpler version is easier to read.
   - Merge duplicated code into one local helper when it clearly reduces repetition.
   - Prefer existing utilities and local patterns over new abstractions.
3. Keep behavior stable.
   - Do not change outputs, side effects, error handling, timing assumptions, or API contracts unless the user explicitly asks.
   - Do not introduce compatibility shims for code that can be cleanly replaced within the current branch.
   - Keep changes scoped to the requested code area.
4. Verify after editing.
   - Run the narrowest useful tests, type checks, or linters available for the changed files.
   - If verification cannot be run, explain why and mention the residual risk.

## Refactoring Rules

- Prefer deleting code over moving it when deletion is safe.
- Extract a helper only after finding real duplication or a complex repeated idea.
- Keep helpers close to their callers unless the repository already has a shared utility location.
- Avoid clever abstractions, broad rewrites, and style-only churn.
- Preserve comments that explain important intent; remove comments that only restate obvious code.
- Do not reformat unrelated code.

## Output

When finished, report:

- What was simplified or removed.
- Whether behavior was intentionally preserved.
- What verification was run.
