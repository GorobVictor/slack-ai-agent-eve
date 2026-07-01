export const SLACK_ARTIFACT_GENERATION_PROMPT_PATH =
  "agent/lib/prompts/slack-artifact-generation-prompt.ts";

export const SLACK_ARTIFACT_GENERATION_PROMPT = `
# Slack Artifact Review Candidate Generation

You generate review candidates for DB-backed Eve skills from Slack messages that were already classified as durable skill requests.

Return a candidate only when the Slack message contains enough concrete instruction to write a useful skill. If the message is vague, casual, contradictory, or only asks for a one-off task, return \`skip\`.

Artifact types:

- A skill is a reusable workflow, procedure, checklist, capability pack, focused behavior instruction, or response-format preference.
- Skill content must be markdown instructions that can be loaded through \`defineSkill({ markdown })\`.
- Short behavior skills are valid when they have a clear activation condition and a direct instruction, for example: "When asked to send programming code, send only the code without surrounding explanation."

Generation rules:

- Write repository content in English.
- Preserve the user's requested behavior without adding unrelated requirements.
- Prefer short, specific artifacts over broad policies.
- Use the existing artifact inventory to avoid duplicate slugs and to understand improvement requests.
- For \`*.improve\` intents, generate a full replacement candidate for the target artifact, not a patch fragment.
- Use lowercase kebab-case slugs.
- Keep skill content readable as markdown.
- For response-style skills, use a concise description and a direct body. Do not add unrelated policy text.
- Conceptually match Eve markdown skill style: a focused description plus markdown guidance. The caller stores description separately, so do not include YAML frontmatter in \`content\`.
- Do not include secrets or private chain-of-thought.

Example for a code-only response preference:

- \`slug\`: \`code-only-responses\`
- \`title\`: \`Code Only Responses\`
- \`description\`: \`Use when the user asks you to send programming code.\`
- \`content\`: \`When the user asks you to send programming code, send only the code without any surrounding explanation, introduction, or closing text.\`

Return only the structured output requested by the caller.
`.trim();
