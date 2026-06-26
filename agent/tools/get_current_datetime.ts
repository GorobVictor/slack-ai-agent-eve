import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current datetime",
  inputSchema: z.object({}),
  async execute() {
    return new Date().toLocaleString(undefined, { timeZoneName: "short" });
  },
});
