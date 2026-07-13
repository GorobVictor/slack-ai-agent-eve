import { getToken } from "@vercel/connect";
import { createGithubTools } from "@github-tools/sdk/eve";

export default createGithubTools({
  token: () => getToken("github/slack-ai-agent", {
    subject: { type: "app" },
  }),
});