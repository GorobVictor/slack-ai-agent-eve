# Skill Review Tools

## Goal

Add agent-callable tools for reviewing, approving, deactivating, and soft-deleting DB-backed Eve skills, guarded by an admin Slack user allowlist.

## Current Shape

The repository already has the right data model for most of this:

- `agent/lib/storage/schema.ts` defines `skills.enabled`, `skills.active`, and `skills.reviewStatus`.
- `agent/lib/storage/skills-repository.ts` already loads only `enabled=true` and `active=true` skills for runtime use.
- `agent/skills/repository-skills.ts` dynamically exposes only active repository skills to Eve.
- Review candidates are created as `enabled=false`, `active=false`, `reviewStatus="review"`, but nothing currently approves, deletes, or lists them through tools.

## Implementation Plan

1. Extend `agent/lib/storage/skills-repository.ts` with focused functions:
   - `getSkillReviewCandidates(input)` returns `reviewStatus="review"` rows.
   - `getActiveSkills(input)` returns active runtime skills for admin inspection.
   - `approveSkillReviewCandidate(input)` promotes a review candidate in a transaction, deactivating the current active skill for the same slug first.
   - `deactivateSkill(input)` marks a skill inactive and disabled, then invalidates the skills cache.
   - `softDeleteSkill(input)` marks a skill inactive and disabled, sets `reviewStatus="deleted"`, and records deletion metadata.

2. Extend the skill lifecycle type:
   - Change `ReviewStatus` to `"approved" | "review" | "deleted"`.
   - Do not add a migration because `review_status` is already a text column.
   - Keep deleted rows out of review and active listings.

3. Add skill-admin authorization:
   - Add a helper under `agent/lib/auth/`.
   - Parse `SKILL_ADMIN_USER_IDS` as a comma-separated Slack user allowlist.
   - Extract the current Slack user id from Eve tool context/session auth.
   - Fail closed when the user cannot be identified or is not allowlisted.
   - Apply this helper to mutating tools.

4. Add Eve tools under `agent/tools/`:
   - `get_skill_review_candidates`
   - `approve_skill_review_candidate`
   - `get_active_skills`
   - `deactivate_active_skill`
   - `delete_skill`

5. Keep runtime loading unchanged:
   - `agent/skills/repository-skills.ts` should continue loading only active enabled skills through `getSkills()`.
   - Cache invalidation should happen after any operation that changes active runtime visibility.

## Expected Behavior

- Review candidates remain invisible to the runtime agent until approved.
- Approving a review candidate makes it the active approved version for its slug.
- Deactivating a skill removes it from runtime without deleting historical data.
- Deleting a skill is a soft delete that removes it from review and active lists while preserving audit metadata.
- Mutating tools can only be used by Slack users listed in `SKILL_ADMIN_USER_IDS`.

## Verification

- Run `npm run typecheck`.
- Run `npm run build` if the current Eve build environment allows it.
- If `.env.local` has `DATABASE_URL`, run a small DB smoke test against seeded review and active rows:
  - List review candidates.
  - Approve one candidate.
  - Confirm it appears in active skills.
  - Deactivate it.
  - Soft-delete it.
