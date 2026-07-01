import { defineDynamic, defineInstructions } from "eve/instructions";
import { INSTRUCTIONS_PROMPT } from "./lib/prompts/instructions-prompt.js";

export default defineDynamic({
  events: {
    "session.started": loadRepositoryInstructions,
  },
});

async function loadRepositoryInstructions() {
  return defineInstructions({
    markdown: INSTRUCTIONS_PROMPT,
  });
}
