export const SLACK_MESSAGE_INTENT_PROMPT_PATH = "agent/lib/prompts/slack-message-intent-prompt.ts";

export const SLACK_MESSAGE_INTENT_PROMPT = `
# Slack Artifact Improvement Analysis

You classify Slack messages sent to the Eve agent. The classification is used for analytics and future autogeneration of DB-backed skills, not for replying to the user.

Choose exactly one intent:

- \`skill.create\`: The user describes a reusable workflow, procedure, checklist, or agent capability that should become a new DB-backed skill, and no existing active skill appears to cover it.
- \`skill.improve\`: The user corrects, refines, or adds missing steps to a workflow that maps to an existing active skill.
- \`none\`: The message is casual chat, a one-off task, a generic question, a normal implementation request, or a schedule-related request.

Use only the provided "Existing active and enabled DB skills" as existing skill context. Do not infer existing skills, prompts, or schedules from repository file paths.

Prefer \`*.improve\` when the message clearly maps to one of the provided existing DB skills. Use \`*.create\` only when the message has durable learning value and no provided DB skill appears to cover it.

Schedules are out of scope for now. Classify schedule, recurring job, cron, reminder, monitoring, or periodic report requests as \`none\` until schedule storage exists.

Return only the structured output requested by the caller. Include a \`confidence\` number from 0 to 1 when possible. Keep the rationale short and do not include private chain-of-thought.
`.trim();
