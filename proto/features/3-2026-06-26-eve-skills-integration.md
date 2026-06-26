# Eve Skills Integration

## Goal

Add a baseline eve skill that guides the agent to ask clarifying questions when client requests are vague or incomplete, and expose active skills from the existing Postgres-backed repository as eve dynamic skills.

## Context

Eve discovers authored skills under `agent/skills/`. Simple procedures should start as markdown skills, while TypeScript `defineSkill` is appropriate for generated or dynamic skill definitions.

The repository already has a cached storage API in `agent/lib/storage/rules-skills-repository.ts`:

```ts
export async function getSkills() {
  return getCachedArray(SKILLS_CACHE_KEY, loadSkillsFromDb);
}
```

The `skills` table and repository remain the source of truth for repository-backed runtime skills. No storage schema changes are needed for this feature.

## Implementation Plan

1. Add `agent/skills/clarifying-questions.md`.
   - Use this skill when a client request is vague, incomplete, contradictory, or missing information needed to respond or act safely.
   - Instruct the agent to ask 1-3 focused follow-up questions, propose sensible defaults when useful, and avoid inventing missing requirements.

2. Add `agent/skills/repository-skills.ts`.
   - Import `defineDynamic` and `defineSkill` from `eve/skills`.
   - Resolve skills on `session.started` and `turn.started`.
   - Read active enabled skills through `getSkills()`.
   - Convert each stored skill into `defineSkill({ description, markdown })`.
   - Namespace dynamic keys with `repo__` so repository-backed skills do not accidentally override static authored skills.
   - Return `null` when the repository has no active skills.

3. Keep mapping local unless the resolver grows.
   - Sanitize stored slugs before using them as dynamic skill keys.
   - Avoid new migrations or storage schema changes.

4. Verify the integration.
   - Run `npm run typecheck`.
   - Run `npm run build` if feasible to confirm eve skill discovery.
   - If runtime smoke testing requires a valid `DATABASE_URL`, do not print secrets and report whether it was available.

## Expected Behavior

- The agent can load the `clarifying-questions` skill when a request needs clarification before action.
- Active rows from the Postgres `skills` table are advertised as eve dynamic skills without copying them into the filesystem.
- Existing cache-aside repository behavior continues to control runtime skill reads.
