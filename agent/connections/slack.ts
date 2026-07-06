import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://mcp.slack.com/mcp",
  description:
    "Slack workspace: search messages, read channels and threads, read files, manage canvases, send messages, and add reactions.",
   auth: connect("slack/eve"),
});