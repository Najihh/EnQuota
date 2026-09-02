# EnQuota 🇮🇩

> **Unified Indonesian Telco MCP Server & Toolkit with Smart ISP Prefix Detection**  
> Manage, check quota, explore packages, top up, and purchase data plans across **Tri (bima+)**, **Indosat (myIM3)**, **Telkomsel (MyTelkomsel)**, and **by.U** via Model Context Protocol (MCP) and interactive CLI.

[![Build and Release](https://github.com/Najihh/EnQuota/actions/workflows/release.yml/badge.svg)](https://github.com/Najihh/EnQuota/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Technical Specification](https://img.shields.io/badge/Technical-Specification-orange.svg)](docs/TECHSPEC.md)
[![Agentic Guidelines](https://img.shields.io/badge/Agentic-AGENTS.md-purple.svg)](AGENTS.md)

> **🌐 Languages / Bahasa**: [🇮🇩 Indonesia](README.id-ID.md) · [🇬🇧 English](README.md)

---

## 🌟 Key Features

- **Smart Prefix Auto-Routing**: Automatically identifies the provider from the phone number prefix (`0896` ➔ Tri, `0857` ➔ Indosat, `0812` ➔ Telkomsel, `0851` ➔ by.U).
- **Multi-ISP Unified MCP Tools**: One clean interface (`eq_login`, `eq_get_quota`, `eq_get_profile`, `eq_buy_package`) for all telcos.
- **Multi-Account Session Keystore**: Manage and persist sessions across multiple numbers and operators locally in `~/.enquota/sessions.json`.
- **Full Telco API Capabilities**:
  - 📊 Real-time Quota & Balance Checks (Main, Local, App, Night, SMS, Roaming).
  - 🎁 Loyalty Points Dashboard (BonsTri, IMPoin, Telkomsel Poin, uCoin).
  - 🛒 Catalog Explorer & Personalized CVM/Promo Search.
  - 💳 Airtime Pulsa Auto-Deduct & Instant QRIS payment generation.
- **Cross-Platform Standalone Binaries**: Precompiled single executables available for Linux (x64/ARM64), macOS (Apple Silicon/Intel), and Windows.

---

## 📱 Supported Operators & Prefix Matrix

| Provider | Brand | Prefix Ranges | Gateway & Engine | Crypto / Auth |
| :--- | :--- | :--- | :--- | :--- |
| **Tri Indonesia** | `bima+` | `0895`, `0896`, `0897`, `0898`, `0899` | `bimaplus-api.ioh.co.id` | Salted SHA-512 (Odd Salt) + Guest Token |
| **Indosat Ooredoo** | `myIM3` | `0814`-`0816`, `0855`-`0858` | `myim3api1.ioh.co.id` | TS01 WAF + OAuth Bearer |
| **Telkomsel** | `MyTelkomsel` | `0811`-`0813`, `0821`-`0823`, `0852`-`0853` | `api.telkomsel.com` | Telbot Core Engine / RSA + AES |
| **Telkomsel by.U** | `by.U` | `0851` | `pidaw-app.cx.byu.id` | Circles CXOS + HMAC-SHA256 Sign |
| **XL / AXIS / Smartfren** | *Detected* | `0817`-`0819`, `0831`-`0838`, `0881`-`0889` | *Prefix detected; engine pluggable* |

---

## 🛠️ MCP Tools Reference

When running as an MCP server, `EnQuota` exposes the following unified tools prefixed with `eq_`:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `eq_detect_isp` | `phone` | Identifies ISP provider, brand, prefix, and engine compatibility. |
| `eq_login` | `phone`, `provider?` | Starts SMS OTP authentication for the specified SIM card. |
| `eq_submit_otp` | `otp`, `phone?`, `trans_id?` | Validates 6-digit OTP code and caches session token. |
| `eq_get_profile` | `phone?`, `provider?` | Retrieves subscriber name, SIM active date, balance, and loyalty points. |
| `eq_get_quota` | `phone?`, `provider?` | Retrieves all active data, app, and roaming quota balances. |
| `eq_get_packages` | `keyword?`, `category?`, `phone?` | Searches/lists available package catalogs and CVM promo deals. |
| `eq_buy_package` | `package_id`, `payment_method?`, `phone?` | Buys data plan (auto-deduct Pulsa or instant QRIS). |
| `eq_topup_pulsa` | `amount`, `payment_method?`, `phone?` | Recharges SIM credit via official denominations. |
| `eq_list_sessions` | — | Lists all stored SIM sessions across providers. |
| `eq_logout` | `phone` | Clears stored session for a given number. |

---

## 💻 Installation (All Platforms)

### Option 1: Automatic One-Liner Installer (Recommended)

#### Linux & macOS:
```bash
curl -fsSL https://raw.githubusercontent.com/Najihh/EnQuota/release/install.sh | bash
```

#### Windows (PowerShell as Administrator or User):
```powershell
irm https://raw.githubusercontent.com/Najihh/EnQuota/release/install.ps1 | iex
```

---

### Option 2: Precompiled Standalone Binaries (Zero Dependencies)

Download the executable matching your operating system and architecture directly from the [Releases](https://github.com/Najihh/EnQuota/releases) page:

| Operating System | Architecture | Download & Installation Command |
| :--- | :--- | :--- |
| **Linux** | x86_64 / AMD64 | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-linux-amd64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **Linux** | ARM64 / AArch64 / Raspberry Pi | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-linux-arm64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **macOS** | Apple Silicon (M1/M2/M3/M4) | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-darwin-arm64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **macOS** | Intel x86_64 | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-darwin-amd64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **Windows** | x86_64 (64-bit) | Download `enquota-windows-amd64.exe` from Releases and add to your PATH. |

---

### Option 3: Manual Source Installation

#### Via Node.js & npm:
```bash
# 1. Clone repository
git clone https://github.com/Najihh/EnQuota.git
cd EnQuota

# 2. Install dependencies & compile TypeScript
npm install
npm run build

# 3. Link globally
npm link
```

#### Via Bun (Native TS Engine):
```bash
git clone https://github.com/Najihh/EnQuota.git
cd EnQuota
bun install
bun run build
```

#### Quick Run with npx (No Install):
```bash
npx -y enquota --help
npx -y enquota detect 089612345678
```

---

## ⚡ MCP Client Integration Setup

### 1. Hermes Agent (`~/.hermes/config.yaml`)

```yaml
mcp_servers:
  enquota:
    command: enquota # or: node /path/to/EnQuota/dist/index.js
    args:
      - --mcp
    enabled: true
```

### 2. Claude Desktop (`claude_desktop_config.json`)

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "enquota": {
      "command": "enquota",
      "args": ["--mcp"]
    }
  }
}
```

### 3. Cursor IDE (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "enquota": {
      "command": "enquota",
      "args": ["--mcp"]
    }
  }
}
```

---

## 🎮 Interactive CLI Usage Examples

```bash
# 1. Detect ISP and brand from phone number
enquota detect 089612345678

# 2. Login via SMS OTP
enquota login 089612345678

# 3. Check active internet quotas
enquota quota

# 4. View all saved multi-SIM sessions
enquota sessions
```

---

## 🤖 AI Coding Agents & Rule Files

This project adheres to the **`AGENTS.md`** standard for full-lifecycle AI coding workflows:
- **`AGENTS.md`**: Single source of truth for architectural principles, testing rules, and runbooks.
- **`CLAUDE.md`**: Pointers for Claude Code CLI.
- **`.github/copilot-instructions.md`**: Pointers for GitHub Copilot.
- **`.cursor/rules/enquota.mdc`**: Path-scoped rules for Cursor IDE.
- **`GEMINI.md`**: Pointers for Gemini CLI.

---

## 📖 Detailed Technical Specification

For in-depth documentation regarding reverse-engineered carrier cryptography, signature schemas, WAF handling, and CXOS HMAC decryption, see the [Technical Specification (docs/TECHSPEC.md)](docs/TECHSPEC.md).

---

## 🔒 Session Management & Security

All tokens and session credentials are encrypted and stored locally under `~/.enquota/sessions.json`. Sensitive credentials are never sent to third-party servers.

---

## 📄 License & Credits

- Reverse engineering foundations inspired by [kupas700bawang](https://github.com/Najihh/kupas700bawang) & [telbot](https://github.com/0xtbug/telbot).
- Licensed under the **MIT License**.
