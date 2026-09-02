# Gemini CLI Instructions — EnQuota

Refer to `AGENTS.md` for full project standards and runbooks.

## Key Rules
1. **Source of Truth**: `AGENTS.md`.
2. **Provider Logic**: Extend `TelcoProvider` in `src/providers/base.ts`.
3. **Prefix Routing**: Use `detectIsp()` in `src/detector.ts`.
4. **Session Keystore**: Managed via `SessionManager` in `src/session.ts` at `~/.enquota/sessions.json`.
5. **Releases**: Pushing or merging to `release` triggers automated GitHub Releases.
