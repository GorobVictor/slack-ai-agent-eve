# Slack MCP Connection

## Goal

Add Slack as an Eve MCP client connection using the official Slack MCP endpoint
and the existing Vercel Connect identifier `slack/eve`.

## Context

The repository already defines MCP client connections in `agent/connections/`
for GitHub and Notion. Eve derives each connection's runtime name from the file
name under `agent/connections/`, so `agent/connections/slack.ts` registers the
connection as `slack`.

Slack's official remote MCP endpoint is `https://mcp.slack.com/mcp`, which
speaks Streamable HTTP and fits Eve's `defineMcpClientConnection` contract.

## Implementation

1. Add `agent/connections/slack.ts` with the existing connection pattern:
   - `url: "https://mcp.slack.com/mcp"`
   - a model-facing description for Slack workspace search, messages, channels,
     files, canvases, and reactions
   - `auth: connect({ connector: "slack/eve", ... })`
   - Slack MCP's protected resource `https://mcp.slack.com`
   - explicit user token scopes for search, history, files, messages, canvases,
     users, reactions, emoji, and channel metadata

2. Keep the existing Slack channel in `agent/channels/slack.ts` unchanged. The
   channel continues to handle incoming Slack events and bot credentials, while
   the new connection exposes Slack MCP tools through Eve's connection system.

3. Verify the change with `npm run typecheck`.
