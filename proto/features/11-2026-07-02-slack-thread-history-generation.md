# Slack Thread History For Artifact Generation

## Goal

Fetch current Slack thread history during Slack artifact generation so skill and
schedule candidates can use the full conversation context instead of only the
triggering analytics row.

## Scope

- Add a best-effort Slack thread history loader for artifact generation.
- Fetch thread replies through Slack Web API `conversations.replies`.
- Reuse the existing Vercel Connect Slack credentials for the bot token.
- Normalize messages into a compact role, author, timestamp, and text transcript.
- Bound the transcript by message count and total prompt size.
- Pass the transcript into the artifact generation model prompt.
- Record history fetch metadata and warnings in artifact generation metadata.

## Fallback Behavior

Slack history fetch failures must not fail artifact generation. If Slack API
access is unavailable, returns an error, or lacks the required scope, generation
continues with the stored `slack_message_analytics.user_message` and metadata.

## Prompt Rules

- Use Slack thread history for disambiguation and fuller artifact content.
- Prefer newer explicit user clarifications over the original trigger message.
- Ignore short assistant acknowledgements such as "request received" or
  "processing" as artifact requirements.

## Verification

- Run `npm run typecheck`.
- Verify artifact generation includes Slack thread history for a multi-message
  thread.
- Verify artifact generation still works when Slack history fetch returns an
  empty transcript or warning.
