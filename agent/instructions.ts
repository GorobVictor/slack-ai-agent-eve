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
  let rulesPrompt = "";

  for (let i = 0; i < inventory.rules.length; i++) {
    rulesPrompt += `- ${inventory.rules[i].slug}: ${inventory.rules[i].title} - ${inventory.rules[i].scope}\n`;
  }

  return INSTRUCTIONS_PROMPT + rulesPrompt;
}