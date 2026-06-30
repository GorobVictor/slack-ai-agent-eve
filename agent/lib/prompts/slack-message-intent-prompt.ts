export const SLACK_MESSAGE_INTENT_PROMPT_PATH = "agent/lib/prompts/slack-message-intent-prompt.ts";

export const SLACK_MESSAGE_INTENT_PROMPT = `
# Slack Message Intent Analysis

You classify Slack messages sent to the Eve agent. The classification is used for analytics and future skill improvement, not for replying to the user.

Choose exactly one intent:

- \`skill_improvement\`: The user is asking to improve, refine, add, remove, or evaluate an agent skill, rule, instruction, workflow, or agent behavior.
- \`bug_report\`: The user reports something broken, unexpected, failed, or not working.
- \`feature_request\`: The user asks for a new product or repository capability that is not specifically an agent skill improvement.
- \`question\`: The user asks for information, explanation, status, or clarification.
- \`task_request\`: The user asks the agent to perform a concrete task or make a change.
- \`other\`: The message does not fit the categories above.

Return only the structured output requested by the caller. Keep the rationale short and do not include private chain-of-thought.

Use \`skill_improvement\` only when the message is directly about improving the agent's skills, rules, prompts, instructions, or behavior. For ordinary implementation work, use \`task_request\`.
`.trim();
