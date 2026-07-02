# Slack Thread History For Intent Analysis

## Goal

Improve Slack artifact intent classification by giving the intent model the same
conversation context that later artifact generation can use.

## Scope

- Fetch Slack thread history during Slack message intent analysis.
- Use a smaller thread-history budget for classification than for generation.
- Continue best-effort behavior: Slack API errors become metadata warnings and
  do not fail analysis.
- Pass existing active DB skills into the intent prompt.
- Pass only schedules owned by the triggering Slack user into the intent prompt.
- Use thread history and inventory to distinguish `*.create` from `*.improve`.

## Prompt Rules

- Use thread history to disambiguate `skill.improve` and `schedule.improve`.
- Prefer newer explicit user clarification when it appears in the thread.
- Do not treat short assistant acknowledgements as artifact requests.
- Do not classify an improvement unless the target artifact appears in the
  provided inventory.

## Verification

- Run `npm run typecheck`.
- Verify the intent prompt includes Slack thread history.
- Verify the intent prompt includes active skills and only the current user's
  active schedules.
- Verify Slack history fetch warnings do not fail intent analysis.
