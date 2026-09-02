# EnQuota 🇮🇩

> **Unified Indonesian Telco MCP Server & Toolkit with Smart ISP Prefix Detection**  
> Manage, check quota, explore packages, top up, and purchase data plans across **Tri (bima+)**, **Indosat (myIM3)**, **Telkomsel (MyTelkomsel)**, and **by.U** via Model Context Protocol (MCP) and interactive CLI.

---

## 🌟 Key Features

- **Smart Prefix Auto-Routing**: Automatically identifies the provider from the phone number prefix (`0896` ➔ Tri, `0857` ➔ Indosat, `0812` ➔ Telkomsel, `0851` ➔ by.U).
- **Multi-ISP Unified MCP Tools**: One clean interface (`telco_login`, `telco_get_quota`, `telco_get_profile`, `telco_buy_package`) for all telcos.
- **Multi-Account Session Keystore**: Manage and persist sessions across multiple numbers and operators locally in `~/.enquota/sessions.json`.
- **Full Telco API Capabilities**:
  - 📊 Real-time Quota & Balance Checks (Main, Local, App, Night, Roaming).
  - 🎁 Loyalty Points Dashboard (BonsTri, IMPoin, Telkomsel Poin, uCoin).
  - 🛒 Catalog Explorer & Personalized CVM/Promo Search.
  - 💳 Airtime Pulsa Auto-Deduct & Instant QRIS payment generation.

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

When running as an MCP server, `EnQuota` exposes the following unified tools:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `telco_detect_isp` | `phone` | Identifies ISP provider, brand, prefix, and engine compatibility. |
| `telco_login` | `phone`, `provider?` | Starts SMS OTP authentication for the specified SIM card. |
| `telco_submit_otp` | `otp`, `phone?`, `trans_id?` | Validates 6-digit OTP code and caches session token. |
| `telco_get_profile` | `phone?`, `provider?` | Retrieves subscriber name, SIM active date, balance, and loyalty points. |
| `telco_get_quota` | `phone?`, `provider?` | Retrieves all active data, app, and roaming quota balances. |
| `telco_get_packages` | `keyword?`, `category?`, `phone?` | Searches/lists available package catalogs and CVM promo deals. |
| `telco_buy_package` | `package_id`, `payment_method?`, `phone?` | Buys data plan (auto-deduct Pulsa or instant QRIS). |
| `telco_topup_pulsa` | `amount`, `payment_method?`, `phone?` | Recharges SIM credit via official denominations. |
| `telco_list_sessions` | — | Lists all stored SIM sessions across providers. |
| `telco_logout` | `phone` | Clears stored session for a given number. |

---

## 🚀 Installation & Usage

### 1. Interactive CLI Mode

```bash
# Clone repository
git clone https://github.com/Najihh/EnQuota.git
cd EnQuota

# Install dependencies & build
npm install
npm run build

# Detect ISP from number
node dist/index.js detect 089612345678

# Interactive Login
node dist/index.js login 089612345678

# Check Quota
node dist/index.js quota

# List active sessions
node dist/index.js sessions
```

### 2. Hermes Agent MCP Configuration

Add `enquota` to your `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  enquota:
    command: node
    args:
      - /path/to/EnQuota/dist/index.js
      - --mcp
    enabled: true
```

Or via `npx`:

```yaml
mcp_servers:
  enquota:
    command: npx
    args:
      - -y
      - enquota
      - --mcp
    enabled: true
```

---

## 🔒 Session Management & Security

All tokens and session credentials are encrypted and stored locally under `~/.enquota/sessions.json`. Sensitive credentials are never sent to third-party servers.

---

## 📄 License & Credits

- Reverse engineering foundations inspired by [kupas700bawang](https://github.com/Najihh/kupas700bawang) & [telbot](https://github.com/0xtbug/telbot).
- Licensed under the **MIT License**.
