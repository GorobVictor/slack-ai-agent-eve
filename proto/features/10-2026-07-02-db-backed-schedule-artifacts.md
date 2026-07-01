# DB-Backed Slack Schedule Artifacts

## Goal

Create and improve DB-backed Eve schedules from Slack analytics messages, using
the existing two-stage analysis and artifact generation pipeline.

## Scope

- Add a `schedules` storage table for owner-scoped active schedules.
- Classify explicit recurring-task Slack messages as `schedule.create`.
- Classify explicit improvements to an existing active schedule as
  `schedule.improve`.
- Generate schedule artifacts with strict `cron` and `markdown` output.
- Store generated schedules as active DB records.
- Let schedule owners list and delete their schedules.
- Let admins listed in `SKILL_ADMIN_USER_IDS` list all schedules and delete any
  schedule.

## Out Of Scope

Actual runtime execution of DB-backed schedules is deferred. Eve-authored
schedules are static files, so executing stored schedules later requires a
static dispatcher schedule that claims due rows and hands them to a channel with
`receive()`.

## Implementation Notes

- Schedule improvements create a new active version for the same owner and slug,
  and deactivate the previous active version.
- Schedule intent and generation inventory is scoped to the Slack user that sent
  the message, so generated improvements do not target another user's schedules.
- Artifact generation skips incomplete schedule output when either `cron` or
  `markdown` is missing, or when `cron` is not a five-field expression.
