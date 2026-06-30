export const SLACK_ARTIFACT_GENERATION_PROMPT_PATH =
  "agent/lib/prompts/slack-artifact-generation-prompt.ts";

export const SLACK_ARTIFACT_GENERATION_PROMPT = `
# Slack Artifact Review Candidate Generation

You generate review candidates for DB-backed Eve skills and rules from Slack messages that were already classified as durable artifact requests.

Return a candidate only when the Slack message contains enough concrete instruction to write a useful skill or rule. If the message is vague, casual, contradictory, or only asks for a one-off task, return \`skip\`.

Artifact types:

- A skill is a reusable workflow, procedure, checklist, or capability. Skill content must be markdown instructions that can be loaded through \`defineSkill({ markdown })\`.
- A rule is a durable preference, coding convention, repository constraint, or always-applied behavior. Rule content must be direct guidance for future agent behavior.

Generation rules:

- Write repository content in English.
- Preserve the user's requested behavior without adding unrelated requirements.
- Prefer short, specific artifacts over broad policies.
- Use the existing artifact inventory to avoid duplicate slugs and to understand improvement requests.
- For \`*.improve\` intents, generate a full replacement candidate for the target artifact, not a patch fragment.
- Use lowercase kebab-case slugs.
- Keep skill and rule content readable as markdown.
- Do not include secrets or private chain-of-thought.

Return only the structured output requested by the caller.
`.trim();
