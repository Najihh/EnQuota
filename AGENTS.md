# AGENTS.md — EnQuota Project Runbook & AI Agent Guidelines

> Single Source of Truth for autonomous coding agents (Claude Code, Cursor, Copilot, Codex, Gemini CLI, Hermes, Devin).

---

## 1. Project Overview

**EnQuota** is a high-performance, unified Indonesian Telco MCP Server and CLI Toolkit. It enables AI agents and command-line users to seamlessly manage, check quota, explore package catalogs, top up pulsa, and purchase data plans across **Tri (bima+)**, **Indosat (myIM3)**, **Telkomsel (MyTelkomsel)**, and **by.U** with zero-configuration **smart ISP prefix auto-routing**.

### Component Map

| Directory / File | Role / Responsibility |
| :--- | :--- |
| `src/index.ts` | Main application entrypoint (switches between Stdio MCP server and CLI mode). |
| `src/detector.ts` | Prefix-based Indonesian ISP detector & phone number normalizer (`08xx` / `628xx`). |
| `src/session.ts` | Multi-account persistent session manager (`~/.enquota/sessions.json`). |
| `src/providers/base.ts` | Abstract `TelcoProvider` interface and standardized result types. |
| `src/providers/tri.ts` | Tri (bima+) client: Salted SHA-512 auth, SMS OTP, quotas, CVM promo, QRIS reload. |
| `src/providers/indosat.ts` | Indosat (myIM3) client: WAF cookies, SMS OTP, balance activation, Freedom catalog, QRIS reload. |
| `src/providers/byu.ts` | Telkomsel by.U client: Circles.Life CXOS HMAC-SHA256 crypto, uCoin, catalog. |
| `src/providers/telkomsel.ts` | Telkomsel client: Bridge to telbot engine, regex parsing for profile/quota/packages/QRIS. |
| `src/providers/index.ts` | Provider registry and dynamic factory (`resolveProvider`). |
| `src/mcp/server.ts` | Model Context Protocol (MCP) server implementation (`@modelcontextprotocol/sdk`). |
| `src/cli/index.ts` | Interactive Commander CLI interface (`detect`, `login`, `sessions`, `quota`). |
| `docs/TECHSPEC.md` | Full architectural and cryptographic specification. |
| `.github/workflows/release.yml` | Multi-target cross-compilation release pipeline (Bun compiler). |

---

## 2. Getting Started & Development

### Prerequisites
- **Node.js**: `>= 18.0.0` (or **Bun** `>= 1.1.0` for standalone binary compilation).
- **TypeScript**: `>= 5.0.0`.

### Setup & Commands

```bash
# Clone & install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Run in Development Mode (Live TS execution via tsx)
npm run dev -- detect 089612345678

# Run Stdio MCP Server locally
npm run mcp

# Link executable binary locally
npm link
```

---

## 3. Branching & Release Pipeline

| Branch | Purpose & Rules |
| :--- | :--- |
| `main` | Primary active development branch. Direct feature work and PRs land here. |
| `release` | **Protected Release Branch**. Pushes or merges to `release` automatically trigger the GitHub Actions workflow to build 5 cross-platform native binaries (`linux-amd64`, `linux-arm64`, `darwin-arm64`, `darwin-amd64`, `windows-amd64.exe`) and publish GitHub Releases with assets. |

---

## 4. House Rules & Coding Standards

1. **Verify with Real Output**: Never assume API responses or fabricated data. Always test against actual carrier gateway payloads or mock mocks with real JSON structures.
2. **Provider Isolation**: Keep operator-specific cryptography, headers, and API endpoints isolated inside `src/providers/<operator>.ts`. Standardize outputs through `src/providers/base.ts`.
3. **Session Safety**: All persistent tokens and user credentials MUST be stored in `~/.enquota/sessions.json` locally and never leaked to external telemetry or third-party loggers.
4. **Clean Process Exits**: Any CLI command or child process execution MUST cleanly exit with `process.exit(0)` on success or `process.exit(1)` on error to prevent hanging handles in non-TTY environments.
5. **Shortest Working Diff**: Write clean, modern TypeScript. No unrequested abstractions, no bloated dependencies.
