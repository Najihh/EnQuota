@AGENTS.md

# Claude Code Project Instructions

- **Source of Truth**: All architectural principles, component maps, and commands are defined in `AGENTS.md`.
- **Build & Verification**: Always run `npm run build` after modifying TypeScript files in `src/`.
- **Testing**: Test CLI and MCP commands via `node dist/index.js <command>` or `tsx src/index.ts <command>`.
- **Releases**: Merging to `release` triggers automated cross-platform binary builds via GitHub Actions.
