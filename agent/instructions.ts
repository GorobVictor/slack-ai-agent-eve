import { defineDynamic, defineInstructions } from "eve/instructions";
import { INSTRUCTIONS_PROMPT } from "./lib/prompts/instructions-prompt.js";
import { loadArtifactInventory } from "./lib/analytics/artifact-inventory.js";

export default defineDynamic({
  events: {
    "session.started": loadRepositoryInstructions,
  },
});

async function loadRepositoryInstructions() {
  return defineInstructions({
    markdown: await buildInstructionsPrompt(),
  });
}

async function buildInstructionsPrompt() {
  const { inventory } = await loadArtifactInventory();
  const rulesPrompt = inventory.rules
    .map((rule) => `- ${rule.slug}: ${rule.title} - ${rule.scope}\n`)
    .join("");

  return INSTRUCTIONS_PROMPT + rulesPrompt;
}
