import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://api.githubcopilot.com/mcp/",
  description: "GitHub repositories, issues, pull requests, commits, and code search.",
  auth: connect({ connector: "github/slack-ai-agent", principalType: "app" }),
});