# EnQuota 🇮🇩

> **Unified Indonesian Telco MCP Server & Toolkit dengan Smart ISP Prefix Detection**  
> Kelola kartu SIM, cek kuota, jelajahi paket, isi pulsa, dan tembak paket data murah untuk **Tri (bima+)**, **Indosat (myIM3)**, **Telkomsel (MyTelkomsel)**, dan **by.U** langsung dari terminal & AI Agent (MCP).

[![Build and Release](https://github.com/Najihh/EnQuota/actions/workflows/release.yml/badge.svg)](https://github.com/Najihh/EnQuota/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Technical Specification](https://img.shields.io/badge/Technical-Specification-orange.svg)](docs/TECHSPEC.md)
[![Agentic Guidelines](https://img.shields.io/badge/Agentic-AGENTS.md-purple.svg)](AGENTS.md)

> **🌐 Bahasa**: [🇮🇩 Indonesia](README.id-ID.md) · [🇬🇧 English](README.md)

---

## 🌟 Fitur Unggulan

- **Auto-Deteksi Operator dari Prefix Nomor**: Sistem otomatis mengenali operator dari prefix nomor HP (`0896` ➔ Tri, `0857` ➔ Indosat, `0812` ➔ Telkomsel, `0851` ➔ by.U).
- **Satu Interface untuk Semua Operator**: Satu perintah sederhana (`eq_login`, `eq_get_quota`, `eq_get_profile`, `eq_buy_package`) untuk semua provider.
- **Multi-Akun & Multi-SIM Keystore**: Kelola dan simpan sesi beberapa nomor sekaligus di `~/.enquota/sessions.json`.
- **Fitur Telco API Lengkap**:
  - 📊 Cek Kuota & Sisa Pulsa Real-time (Kuota Utama, Lokal, Aplikasi, Malam, SMS, Roaming).
  - 🎁 Dashboard Poin Loyalitas (BonsTri, IMPoin, Telkomsel Poin, uCoin).
  - 🛒 Jelajahi Katalog Paket & Penawaran Promo/CVM personal.
  - 💳 Beli paket via potong pulsa otomatis atau **QRIS instan** (GoPay, ShopeePay, DANA, OVO, BCA, Mandiri, dll).
- **Tembak Paket Otomatis**: Beli paket data, isi pulsa, dan tambah masa aktif kartu dalam hitungan detik tanpa buka aplikasi operator.
- **Binary Cross-Platform**: Satu file executable tanpa dependensi untuk Linux (x64/ARM64), macOS (Apple Silicon/Intel), dan Windows.

---

## 📱 Operator & Prefix yang Didukung

| Provider | Brand | Prefix | Gateway & Engine | Crypto / Auth |
| :--- | :--- | :--- | :--- | :--- |
| **Tri Indonesia** | `bima+` | `0895`, `0896`, `0897`, `0898`, `0899` | `bimaplus-api.ioh.co.id` | Salted SHA-512 (Odd Salt) + Guest Token |
| **Indosat Ooredoo** | `myIM3` | `0814`-`0816`, `0855`-`0858` | `myim3api1.ioh.co.id` | TS01 WAF + OAuth Bearer |
| **Telkomsel** | `MyTelkomsel` | `0811`-`0813`, `0821`-`0823`, `0852`-`0853` | `api.telkomsel.com` | Telbot Core Engine / RSA + AES |
| **Telkomsel by.U** | `by.U` | `0851` | `pidaw-app.cx.byu.id` | Circles CXOS + HMAC-SHA256 Sign |
| **XL / AXIS / Smartfren** | *Terdeteksi* | `0817`-`0819`, `0831`-`0838`, `0881`-`0889` | *Prefix terdeteksi; engine siap ditambahkan* |

---

## 🛠️ Daftar Tools MCP

Ketika dijalankan sebagai MCP server, `EnQuota` menyediakan tools terpadu berikut dengan prefix `eq_`:

| Tool | Parameter | Deskripsi |
| :--- | :--- | :--- |
| `eq_detect_isp` | `phone` | Deteksi operator, brand, prefix, dan kompatibilitas engine. |
| `eq_login` | `phone`, `provider?` | Mulai autentikasi SMS OTP untuk kartu SIM. |
| `eq_submit_otp` | `otp`, `phone?`, `trans_id?` | Validasi kode OTP 6 digit dan simpan token sesi. |
| `eq_get_profile` | `phone?`, `provider?` | Lihat nama pelanggan, masa aktif, sisa pulsa, dan poin loyalitas. |
| `eq_get_quota` | `phone?`, `provider?` | Cek semua kuota data aktif, aplikasi, dan roaming. |
| `eq_get_packages` | `keyword?`, `category?`, `phone?` | Cari & jelajahi katalog paket dan penawaran CVM. |
| `eq_buy_package` | `package_id`, `payment_method?`, `phone?` | Beli paket data (potong pulsa / QRIS instan). |
| `eq_topup_pulsa` | `amount`, `payment_method?`, `phone?` | Isi ulang pulsa via nominal resmi & QRIS. |
| `eq_list_sessions` | — | Daftar semua sesi SIM yang tersimpan. |
| `eq_logout` | `phone` | Hapus sesi kartu SIM. |

---

## 💻 Instalasi (Semua Platform)

### Opsi 1: Installer Otomatis Satu Perintah (Recommended)

#### Linux & macOS:
```bash
curl -fsSL https://raw.githubusercontent.com/Najihh/EnQuota/release/install.sh | bash
```

#### Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/Najihh/EnQuota/release/install.ps1 | iex
```

---

### Opsi 2: Binary Standalone (Tanpa Dependensi)

Unduh file executable sesuai sistem operasi kamu langsung dari halaman [Releases](https://github.com/Najihh/EnQuota/releases):

| Sistem Operasi | Arsitektur | Perintah Instalasi |
| :--- | :--- | :--- |
| **Linux** | x86_64 / AMD64 | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-linux-amd64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **Linux** | ARM64 / Raspberry Pi | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-linux-arm64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **macOS** | Apple Silicon (M1/M2/M3/M4) | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-darwin-arm64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **macOS** | Intel x86_64 | `curl -L https://github.com/Najihh/EnQuota/releases/latest/download/enquota-darwin-amd64 -o enquota && chmod +x enquota && sudo mv enquota /usr/local/bin/` |
| **Windows** | x86_64 (64-bit) | Download `enquota-windows-amd64.exe` dari Releases dan tambahkan ke PATH. |

---

### Opsi 3: Instalasi Manual dari Source

#### Via Node.js & npm:
```bash
# 1. Clone repository
git clone https://github.com/Najihh/EnQuota.git
cd EnQuota

# 2. Install dependencies & compile TypeScript
npm install
npm run build

# 3. Link global
npm link
```

#### Via Bun (Native TS Engine):
```bash
git clone https://github.com/Najihh/EnQuota.git
cd EnQuota
bun install
bun run build
```

#### Jalankan cepat dengan npx (Tanpa Install):
```bash
npx -y enquota --help
npx -y enquota detect 089612345678
```

---

## ⚡ Setup Integrasi MCP Client

### 1. Hermes Agent (`~/.hermes/config.yaml`)

```yaml
mcp_servers:
  enquota:
    command: enquota # atau: node /path/to/EnQuota/dist/index.js
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

## 🎮 Contoh Penggunaan CLI

```bash
# 1. Deteksi operator dari nomor HP
enquota detect 089612345678

# 2. Login via SMS OTP
enquota login 089612345678

# 3. Cek kuota internet aktif
enquota quota

# 4. Lihat semua sesi SIM tersimpan
enquota sessions
```

---

## 🤖 AI Coding Agents & Rule Files

Proyek ini mengikuti standar **`AGENTS.md`** untuk alur kerja coding AI:
- **`AGENTS.md`**: Sumber kebenaran utama prinsip arsitektur, aturan pengujian, dan runbook.
- **`CLAUDE.md`**: Pointer untuk Claude Code CLI.
- **`.github/copilot-instructions.md`**: Pointer untuk GitHub Copilot.
- **`.cursor/rules/enquota.mdc`**: Aturan path-scoped untuk Cursor IDE.
- **`GEMINI.md`**: Pointer untuk Gemini CLI.

---

## 📖 Spesifikasi Teknis Detail

Untuk dokumentasi mendalam tentang reverse engineering kriptografi operator, skema signature, penanganan WAF, dan dekripsi CXOS HMAC, lihat [Spesifikasi Teknis (docs/TECHSPEC.md)](docs/TECHSPEC.md).

---

## 🔒 Manajemen Sesi & Keamanan

Semua token dan kredensial sesi disimpan secara lokal di `~/.enquota/sessions.json`. Kredensial sensitif tidak pernah dikirim ke server pihak ketiga.

---

## 📄 Lisensi & Kredit

- Fondasi reverse engineering terinspirasi dari [kupas700bawang](https://github.com/Najihh/kupas700bawang) & [telbot](https://github.com/0xtbug/telbot).
- Dilisensikan di bawah **MIT License**.
