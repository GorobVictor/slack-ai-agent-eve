# Artifact Success Notifications

## Goal

Notify the originating Slack thread when Slack artifact generation successfully
creates or updates a DB-backed skill or schedule artifact.

## Scope

- Post a best-effort Slack message after the artifact database write succeeds.
- Notify skill requests as review candidate creation, not approval or activation.
- Notify schedule creates as created schedules.
- Notify schedule improves as updated schedules with the new version.
- Store notification status, message timestamp, or error in artifact generation
  metadata.

## Behavior

Slack notification delivery must not control artifact generation success. If the
artifact is created or updated in the database and Slack notification fails, the
analytics row still completes with artifact generation status `review`.

## Verification

- Run `npm run typecheck`.
- Verify successful skill candidate generation posts a review-candidate
  notification.
- Verify successful schedule create/update posts a schedule notification.
- Verify Slack notification failure records metadata but does not fail artifact
  generation.
