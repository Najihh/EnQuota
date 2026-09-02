# GitHub Copilot Instructions — EnQuota

EnQuota is a unified Indonesian Telco MCP server and CLI utility for Tri, Indosat, Telkomsel, and by.U.

## Core Directives
1. Refer to `AGENTS.md` for full project standards and component mapping.
2. Ensure phone numbers are normalized using `normalizePhone()` in `src/detector.ts`.
3. All provider implementations must extend `TelcoProvider` from `src/providers/base.ts`.
4. Stdio MCP tools must use the `eq_` prefix (`eq_detect_isp`, `eq_login`, `eq_get_quota`, etc.).
5. Never log or transmit sensitive credentials (`authToken`, `rubyToken`, cookies) to external services.
