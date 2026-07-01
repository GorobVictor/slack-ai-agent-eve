# slack-ai-agent-eve

An [eve](https://eve.dev) agent application scaffolded for Slack and web messaging.

## Prerequisites

- Node.js 24.x
- npm

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `DATABASE_URL` before running database migrations or the storage-backed
agent code.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local eve development server |
| `npm run build` | Compile the agent for deployment |
| `npm run start` | Run the compiled agent |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:generate` | Generate Drizzle migrations from the storage schema |
| `npm run db:migrate` | Apply Drizzle migrations using `.env.local` |
| `npm run db:studio` | Open Drizzle Studio using `.env.local` |

## Project layout

```text
agent/
├── agent.ts           # Agent runtime config (model, name, build, …)
├── instructions.ts    # Dynamic always-on agent instructions
├── channels/
│   ├── eve.ts         # Eve channel with local dev and Vercel OIDC auth
│   └── slack.ts       # Slack channel with Vercel Connect auth and thread context
├── lib/
│   ├── analytics/
│   │   ├── artifact-inventory.ts               # Active DB skill context for analytics
│   │   ├── slack-artifact-generation.ts        # Generates skill review candidates
│   │   ├── slack-artifact-generation-processor.ts # Processes actionable artifact signals
│   │   ├── slack-message-analysis-processor.ts # Processes pending Slack analytics rows
│   │   └── slack-message-intent.ts             # Structured intent classification
│   ├── prompts/
│   │   ├── instructions-prompt.ts              # Editable base agent instructions prompt
│   │   ├── slack-artifact-generation-prompt.ts # Editable artifact generation prompt
│   │   └── slack-message-intent-prompt.ts      # Editable Slack analytics prompt
│   └── storage/
│       ├── cache.ts   # Postgres-backed cache helpers
│       ├── db.ts      # Lazy Neon/Drizzle database client
│       ├── skills-repository.ts # Cache-aside repository for skills
│       ├── schema.ts  # Versioned Drizzle tables for runtime data
│       └── slack-message-analytics-repository.ts # Slack analytics storage access
├── schedules/
│   ├── slack-artifact-review.ts   # Recurring skill review candidate generation
│   └── slack-message-analytics.ts # Recurring async Slack intent analysis
├── skills/
│   ├── clarifying-questions.md # Procedure for ambiguous client requests
│   └── repository-skills.ts    # Dynamic skills loaded from Postgres storage
└── tools/
    ├── get_current_datetime.ts # Returns the current localized datetime
    └── get_weather.ts          # Example weather tool backed by Open-Meteo
```

Storage migrations live under `drizzle/`, and approved feature plans live under
`proto/features/`.

## Documentation

- [eve docs](https://eve.dev/docs)
- Installed package docs: `node_modules/eve/docs/`
- Agent guidance for AI assistants: [AGENTS.md](./AGENTS.md)
- Cursor rules, skills, and hooks live under `.cursor/`.

## Development notes

- Replace `placeholderAuth()` in `agent/channels/eve.ts` before exposing the agent in production.
- Point `connectSlackCredentials(...)` in `agent/channels/slack.ts` at your Vercel Connect Slack client UID and attach its trigger to `/eve/v1/slack` before deploying for Slack messaging.
- Slack app mentions include recent thread messages since the agent's last reply as context for the next response.
- Slack app mentions are recorded in Neon Postgres for analytics, then classified asynchronously into DB-backed skill signals by the `slack-message-analytics` schedule.
- Completed skill signals are processed by the `slack-artifact-review` schedule into disabled review candidates with Slack source metadata.
- Runtime skills are stored in Neon Postgres and read through a Postgres-backed cache-aside repository.
- Editable prompt constants live under `agent/lib/prompts/` as multiline template literals.
- VS Code launch profiles in `.vscode/launch.json` run `eve dev` and `eve start` with source maps enabled.
- The `/gen-commits` workflow runs a follow-up `/clean-code` pass through `.cursor/hooks.json`.
- Compiled artifacts and local runtime state are written under `.eve/` and are gitignored.
