# EnQuota — Technical Specification & Architecture

> Complete reference document for the EnQuota Unified Indonesian Telco System, Cryptographic Protocols, and MCP Architecture.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          EnQuota Core System                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────┐                          ┌──────────────────────┐
│ Stdio MCP Server     │                          │ Interactive CLI      │
│ (tools: eq_*)        │                          │ (enquota <command>)  │
└──────────┬───────────┘                          └──────────┬───────────┘
           │                                                 │
           └────────────────────────┬────────────────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │   Smart ISP Prefix Router    │
                     │      (src/detector.ts)       │
                     └──────────────┬───────────────┘
                                    │
          ┌─────────────────┬───────┴─────────┬──────────────────┐
          ▼                 ▼                 ▼                  ▼
  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  ┌───────────────┐
  │  Tri (bima+)  │ │ Indosat(myIM3)│ │   Telkomsel   │  │ Telkomsel by.U│
  │    Driver     │ │    Driver     │ │ Telbot Bridge │  │  CXOS Driver  │
  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘  └───────┬───────┘
          │                 │                 │                  │
          ▼                 ▼                 ▼                  ▼
  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  ┌───────────────┐
  │ bimaplus-api  │ │  myim3api1    │ │ api.telkomsel │  │ pidaw-app.cx  │
  │  .ioh.co.id   │ │  .ioh.co.id   │ │     .com      │  │    .byu.id    │
  └───────────────┘ └───────────────┘ └───────────────┘  └───────────────┘
```

---

## 2. Phone Number Normalization & Prefix Detection

### 2.1 Normalization Algorithm (`src/detector.ts`)
Indonesian MSISDNs can arrive in various formats (`+628...`, `08...`, `628...`, `8...`, spaces, hyphens).
1. Non-digit characters are stripped: `input.replace(/[^0-9]/g, '')`.
2. Prefix `62` or `0` is removed to produce standard clean digits `8xxxxxxxx`.
3. Validated: `clean.startsWith('8') && clean.length >= 9 && clean.length <= 13`.
4. Outputs:
   - `national`: `'0' + clean` (e.g. `089612345678`)
   - `international`: `'62' + clean` (e.g. `6289612345678`)
   - `prefix4`: `national.substring(0, 4)` (e.g. `0896`)

### 2.2 Operator Prefix Routing Table

```
Tri Indonesia (bima+)         ➔ 0895, 0896, 0897, 0898, 0899
Indosat Ooredoo (myIM3)       ➔ 0814, 0815, 0816, 0855, 0856, 0857, 0858
Telkomsel (MyTelkomsel)       ➔ 0811, 0812, 0813, 0821, 0822, 0823, 0852, 0853
Telkomsel by.U                ➔ 0851 (CXOS Engine)
XL Axiata (Future)            ➔ 0817, 0818, 0819, 0859, 0877, 0878
AXIS (Future)                 ➔ 0831, 0832, 0833, 0838
Smartfren (Future)            ➔ 0881 - 0889
```

---

## 3. Carrier Reverse Engineering & Cryptography

### 3.1 Tri Indonesia (`src/providers/tri.ts`)
- **Gateway**: `https://bimaplus-api.ioh.co.id/api/v2`
- **Authentication**: Salted SHA-512 signature using odd-position characters from `tokenId` and `uid`.
- **Signature Computation**:
  $$\text{oddToken} = \text{ExtractOddChars}(\text{tokenId})$$
  $$\text{x-imi-oauth} = \text{SHA512}(\text{`REQBODY=`} + \text{bodyStr} + \text{`&SALT=`} + \text{oddToken})$$
  $$\text{hashParams} = \text{parent} + \text{"\$"} + \text{os} + \text{"\$"} + \text{appVersion} + \text{"\$"} + \text{tokenId}$$
  $$\text{X-IMI-HASH} = \text{SHA512}(\text{hashParams} + \text{`&SALT=`} + \text{ExtractOddChars}(\text{uid}))$$
- **Guest Flow**: `POST /token/guest` provides temporary guest `tokenid` for catalog discovery.
- **Subscriber Flow**: `POST /otp/send/v1` (SMS trigger) ➔ `POST /otp/validate/v1` (JWT subscriber token).

### 3.2 Indosat Ooredoo (`src/providers/indosat.ts`)
- **Gateway**: `https://myim3api1.ioh.co.id/api/v2`
- **Security**: F5 TS01 WAF cookies (`TS010ed7c9`, `BUI`) paired with Salted SHA-512 header signatures.
- **Activation Flow**:
  - `POST /packages/activate` for balance auto-deduct.
  - `POST /payment/payment` (`transtype: 'reload'`) for instant dynamic QRIS generation (Ottocash/IOH Gateway).

### 3.3 Telkomsel by.U (`src/providers/byu.ts`)
- **Gateway**: `https://pidaw-app.cx.byu.id`
- **Architecture**: Circles.Life CXOS.
- **HMAC Secret Key Decryption**:
  - Encrypted configuration is fetched from `GET /v1/utility/configuration`.
  - Decrypted via **AES-256-CBC**:
    - `Key`: `Buffer.from("EIUFGFJSLOKSJNKOSNMJNARFHNBSLOUB", "utf8")`
    - `IV`: First 16 bytes of base64 payload.
    - `Ciphertext`: Remaining payload bytes.
- **Request Signing**:
  $$\text{X-Signature} = \text{HMAC-SHA256}(\text{bodyStr}, \text{decryptedSecretKey})$$
- **Auth**: Ruby Token (JWT) sent via `x-auth` header and `rubyToken` cookie.

### 3.4 Telkomsel MyTelkomsel (`src/providers/telkomsel.ts`)
- **Engine**: Bridges the compiled native `telbot` binary via stdio JSON-RPC MCP channel.
- **Fulfillment**: Parses order IDs and Midtrans QRIS URLs (`api.midtrans.com/v2/qris/.../qr-code`).

### 3.5 XL Axiata & AXIS (`src/providers/xl.ts`)
- **CIAM Gateway**: `https://gede.ciam.xlaxiata.co.id/realms/xl-ciam`
- **Business API Gateway**: `https://api.myxl.xlaxiata.co.id`
- **Authentication & Signatures**:
  - **CIAM SMS OTP Request**: `GET /auth/otp?contact=628...&contactType=SMS&alternateContact=false` with Basic Auth.
  - **CIAM OTP Submission**: `POST /protocol/openid-connect/token` with header `Ax-Api-Signature`:
    $$\text{Ax-Api-Signature} = \text{Base64}(\text{HMAC-SHA256}(\text{tsForSign} + \text{"passwordSMS"} + \text{contact} + \text{otp} + \text{"openid"}, \text{AX\_API\_SIG\_KEY}))$$
  - **Payload Encryption (`xdata`)**: Request bodies are encrypted using **AES-256-CBC** with PKCS7 padding and urlsafe Base64:
    $$\text{IV} = \text{SHA256}(\text{xtimeMs})[:16]$$
    $$\text{xdata} = \text{Base64UrlSafe}(\text{AES-256-CBC}_{\text{XDATA\_KEY}, \text{IV}}(\text{plaintext}))$$
  - **API Request Signature (`x-signature`)**:
    $$\text{keyStr} = \text{X\_API\_BASE\_SECRET} + \text{";"} + \text{idToken} + \text{";"} + \text{method} + \text{";"} + \text{path} + \text{";"} + \text{sigTimeSec}$$
    $$\text{x-signature} = \text{HMAC-SHA512}(\text{idToken} + \text{";"} + \text{sigTimeSec} + \text{";"}, \text{keyStr})$$
- **Purchase & Payment Flows**:
  - `POST api/v8/xl-stores/options/detail` ➔ retrieves `token_confirmation` and item price.
  - `POST misc/api/v8/utility/intercept-page` ➔ app intercept requirement.
  - `POST payments/api/v8/payment-methods-option` ➔ retrieves `token_payment` & timestamp.
  - `POST payments/api/v8/settlement-balance` ➔ auto-deduct pulsa.
  - `POST payments/api/v8/settlement-multipayment/qris` ➔ initiates QRIS settlement; retrieves `transaction_code`.
  - `POST payments/api/v8/pending-detail` ➔ returns raw EMVCo QRIS string.

---

## 4. Session Keystore & Storage Security

All sessions are persisted locally at:
```
~/.enquota/sessions.json
```

### Schema:
```json
{
  "activePhone": "6289676304643",
  "sessions": {
    "6289676304643": {
      "phone": "089676304643",
      "msisdn": "6289676304643",
      "provider": "TRI",
      "brand": "bima+",
      "authToken": "eyJhbG...",
      "userType": "SUBSCRIBER",
      "deviceId": "56826f1045584651bc499d268febea91",
      "cookies": "TS01503f77=...; BUI=...",
      "updatedAt": "2026-09-02T12:54:52.469Z"
    }
  }
}
```

---

## 5. MCP Tool Definitions

| Tool | Parameters | Returns |
| :--- | :--- | :--- |
| `eq_detect_isp` | `{ phone: string }` | `IspInfo` (Provider, Brand, Engine, Support Status) |
| `eq_login` | `{ phone: string, provider?: string }` | `LoginResult` (SMS OTP confirmation, transId) |
| `eq_submit_otp` | `{ otp: string, phone?: string, trans_id?: string }` | `OtpResult` (Session persistence) |
| `eq_get_profile` | `{ phone?: string, provider?: string }` | `ProfileResult` (Name, balance, loyalty points, active date) |
| `eq_get_quota` | `{ phone?: string, provider?: string }` | `QuotaResult` (Quota allowances, validity dates) |
| `eq_get_packages` | `{ keyword?: string, category?: string, phone?: string }` | `PackageListResult` (Catalog & CVM promo offers) |
| `eq_buy_package` | `{ package_id: string, payment_method?: string, phone?: string }` | `PurchaseResult` (Status, QRIS data, transaction ID) |
| `eq_topup_pulsa` | `{ amount: number, payment_method?: string, phone?: string }` | `TopupResult` (QRIS payload for airtime reload) |
| `eq_list_sessions`| `{}` | `TelcoSession[]` (List of connected SIM cards) |
| `eq_logout` | `{ phone: string }` | Removal confirmation |

---

## 6. Build & CI/CD Pipeline

- **Compiler**: Bun Native Compiler (`bun build --compile --minify`).
- **Matrix Targets**:
  - `linux-x64` (AMD64 Linux)
  - `linux-arm64` (AArch64 Linux)
  - `darwin-arm64` (Apple Silicon M-Series)
  - `darwin-x64` (Intel macOS)
  - `windows-x64` (`.exe`)
- **Release Trigger**: Restricted strictly to pushes and merges on the `release` branch.
