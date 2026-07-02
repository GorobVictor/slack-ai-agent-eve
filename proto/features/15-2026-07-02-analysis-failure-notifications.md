# Analysis Failure Notifications

## Goal

Notify the originating Slack thread when Slack message intent analysis fails and
the analytics row is marked with `analysis_status = failed`.

## Scope

- Post a best-effort Slack message after intent analysis throws.
- Keep the Slack message short and user-facing.
- Do not expose stack traces, model internals, secrets, or raw errors in Slack.
- Store notification status, Slack message timestamp, or notification error in
  the existing analytics metadata JSON.
- Avoid schema changes.

## Behavior

Slack notification delivery must not control analysis failure handling. If the
analyzer fails, the analytics row is marked as failed even when notification
posting also fails.

## Verification

- Run `npm run typecheck`.
- Verify a simulated analyzer failure marks `analysis_status = failed`.
- Verify a simulated analyzer failure posts a Slack notification.
- Verify Slack notification failure records metadata but does not crash the
  schedule processor.
