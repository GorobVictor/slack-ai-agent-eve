import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.notion.com/sse",
  description: "Notion workspace: pages, databases, comments, and content management.",
  auth: connect("mcp.notion.com/slack-ai-agent-eve"),
});