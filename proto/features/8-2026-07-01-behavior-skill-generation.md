# Behavior Skill Generation From Slack Messages

## Goal

Adjust Slack artifact analysis and generation so durable reusable behavior instructions, such as code-only response preferences, can become DB-backed Eve skills without restoring the removed custom `rules` feature.

## Scope

- Keep custom DB `rules` removed.
- Treat short reusable behavior instructions as valid DB-backed Eve skills when they can be expressed as markdown skill content with a focused `description`.
- Avoid reintroducing always-on rule storage or `rule.*` intents.

## Implementation Plan

1. Update intent classification:
   - Broaden `skill.create` and `skill.improve` in `agent/lib/prompts/slack-message-intent-prompt.ts` to include reusable behavior instructions and response-format preferences.
   - Add examples that classify messages like "when I ask for code, send only code" as `skill.create` unless an existing skill already covers them.
   - Keep one-off requests and broad always-on policies that cannot be loaded as a useful skill as `none`.

2. Update artifact generation:
   - Define skills in `agent/lib/prompts/slack-artifact-generation-prompt.ts` as reusable workflows, procedures, capability packs, or focused behavior instructions.
   - Instruct the generator to produce compact markdown skills with a clear description, matching Eve's frontmatter style conceptually while preserving the DB fields `title`, `description`, and `content`.
   - Add guidance for response-style skills: concise description, direct instruction body, no unrelated policy text.

3. Tighten generator validation only where useful:
   - Keep `agent/lib/analytics/slack-artifact-generation.ts` skill-only.
   - If the model returns valid skill content but omits `target`, accept the required target from the analytics row instead of skipping solely on a missing output target.

## Verification

- Run `npm run typecheck`.
- Re-run targeted searches for `rule.*` and `rules` in `agent/` to confirm this does not restore custom rules.
- Retry `npm run build`; the known `google/gemma-4-31b-it` compaction metadata issue may still block it independently.
