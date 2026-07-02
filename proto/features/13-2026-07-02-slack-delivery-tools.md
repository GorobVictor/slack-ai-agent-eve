# Slack Delivery Tools

## Goal

Give the agent explicit tools for delivering useful follow-up content to Slack:
posting a message in the current thread, sending a direct message to the
triggering user, or uploading a generated text file.

## Scope

- Add shared Slack Web API helpers backed by the existing Vercel Connect Slack
  credentials.
- Add a Slack session context helper for tool calls.
- Add `send_slack_message` for current-thread or DM delivery.
- Add `send_slack_file` for generated text file upload to a thread or DM.
- Default DMs to the triggering Slack user.
- Keep thread delivery scoped to the current Slack channel and thread unless
  explicit overrides are provided.

## Guardrails

- Use delivery tools only when the user asks or when delivery is clearly useful
  to complete the task.
- Do not send DMs to third parties by default.
- Do not include secrets or private chain-of-thought in messages or files.
- Prefer a message for short updates and a file for larger generated output.

## Slack Scopes

The connected Slack app must support the Slack APIs used by these tools:

- `chat:write` for `chat.postMessage`.
- `im:write` for `conversations.open` when sending DMs.
- File upload scopes required by Slack for `files.getUploadURLExternal` and
  `files.completeUploadExternal`.

## Verification

- Run `npm run typecheck`.
- Verify `send_slack_message` posts to the current thread.
- Verify `send_slack_message` sends a DM to the triggering user.
- Verify `send_slack_file` uploads a text file to a thread or DM.
- Verify tools fail clearly outside a Slack auth context.
