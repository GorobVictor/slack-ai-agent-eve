# DB-Backed Schedule Dispatcher

## Goal

Execute active DB-backed Eve schedules at runtime using Eve's dynamic scheduling
pattern: one static minute-level dispatcher schedule, a Postgres-backed schedule
adapter, atomic leases, and proactive Slack `receive(...)` handoff.

## Scope

- Add dispatch lifecycle fields to the `schedules` table.
- Set `next_run_at` when schedule versions are created or improved.
- Atomically claim due schedules with a recoverable lease.
- Dispatch claimed rows through the Slack channel as proactive Eve sessions.
- Complete successful dispatches by clearing the lease and computing the next
  run from the stored cron expression.
- Release failed dispatches by clearing the lease, storing a bounded error, and
  setting a retry time.

## Behavior

The dispatcher runs from `agent/schedules/repository-schedules.ts` every minute.
It claims due rows where `enabled = true`, `active = true`, and `next_run_at` is
in the past, as long as no unexpired lease is present.

Dispatch delivery is at least once. If the process crashes after Slack
`receive(...)` succeeds but before completion is recorded, the row can be
claimed again after the lease expires. Scheduled prompts that perform
side-effecting work should be written to tolerate repeated execution.

## Verification

- Run `npm run db:generate` and review the generated migration.
- Run `npm run typecheck`.
- In local development, use Eve's schedule dispatch route for
  `repository-schedules` to exercise the claim, receive, complete, and release
  paths.
