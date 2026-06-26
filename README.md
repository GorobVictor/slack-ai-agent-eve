# slack-ai-agent-eve

An [eve](https://eve.dev) agent application scaffolded for Slack and web messaging.

## Prerequisites

- Node.js 24.x
- npm

## Setup

```bash
npm install
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local eve development server |
| `npm run build` | Compile the agent for deployment |
| `npm run start` | Run the compiled agent |
| `npm run typecheck` | Run TypeScript type checking |

## Project layout

```text
agent/
├── agent.ts           # Agent runtime config (model, name, build, …)
├── instructions.md    # Always-on agent instructions
├── channels/
│   ├── eve.ts         # Eve channel with local dev and Vercel OIDC auth
│   └── slack.ts       # Slack channel with Vercel Connect auth and thread context
└── tools/
    ├── get_current_datetime.ts # Returns the current localized datetime
    └── get_weather.ts          # Example weather tool backed by Open-Meteo
```

## Documentation

- [eve docs](https://eve.dev/docs)
- Installed package docs: `node_modules/eve/docs/`
- Agent guidance for AI assistants: [AGENTS.md](./AGENTS.md)

## Development notes

- Replace `placeholderAuth()` in `agent/channels/eve.ts` before exposing the agent in production.
- Point `connectSlackCredentials(...)` in `agent/channels/slack.ts` at your Vercel Connect Slack client UID and attach its trigger to `/eve/v1/slack` before deploying for Slack messaging.
- Slack app mentions include recent thread messages since the agent's last reply as context for the next response.
- Compiled artifacts and local runtime state are written under `.eve/` and are gitignored.
