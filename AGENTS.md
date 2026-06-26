# eve Agent App

This project uses the eve framework. Before writing code, read the relevant guide
from the installed eve package docs. In most installs, those docs are at
`node_modules/eve/docs/`. In workspaces or local package installs, resolve the
installed `eve` package location first and read its `docs/` directory. If
package docs are unavailable, use https://eve.dev/docs as a fallback.

## Cursor Agent Workflows

This repository includes Cursor guidance under `.cursor/`:

- `.cursor/rules/` contains always-applied repository rules for future agent work.
- `.cursor/skills/` contains local skills such as `/clean-code`.
- `.cursor/hooks.json` wires stop hooks, including the `/gen-commits` cleanup flow.
