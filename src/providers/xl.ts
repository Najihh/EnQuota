/**
 * EnQuota - XL Axiata (myXL) & AXIS Provider Driver
 * Reverse-engineered from myXL Android v8.9.1 / v8.10.0
 */

import crypto from 'crypto';
import https from 'https';
import {
  TelcoProvider,
  LoginResult,
  OtpResult,
  ProfileResult,
  QuotaResult,
  PackageListResult,
  PurchaseResult,
  TopupResult,
  PackageItem,
  QuotaItem
} from './base.js';
import { SupportedProvider, normalizePhone } from '../detector.js';
import { TelcoSession, defaultSessionManager } from '../session.js';

export class XLProvider extends TelcoProvider {
  readonly provider: SupportedProvider = 'XL';
  readonly name = 'XL Axiata';
  readonly brand = 'myXL';

  private baseUrl = 'https://api.myxl.xlaxiata.co.id';
  private ciamBase = 'https://gede.ciam.xlaxiata.co.id/realms/xl-ciam';

  // Reverse-engineered static keys
  private xdataKey = '5dccbf08920a5527b99e222789c34bb7';
  private axApiSigKey = '18b4d589826af50241177961590e6693';
  private xApiBaseSecret =
    'mU1Y4n1vBjf3M7tMnRkFU08mVyUJHed8B5En3EAniu1mXLixeuASmBmKnkyzVziOye7rG5nIekMdthensbQMcOJ6SLnrkGyfXALD7mrBC6vuWv6G01pmD3XlU5rT7Tzx';
  private apiKey = 'vT8tINqHaOxXbGE7eOWAhA==';

  private ciamClientId = '9fc97ed1-6a30-48d5-9516-60c53ce3a135';
  private ciamClientSecret = 'YDWmF4LJj9XIKwQnzy2e2lb0tJQb29o3';

  // Device identity
  private axDeviceId = '92fb44c0804233eb4d9e29f838223a14';
  private axFingerprint =
    'YmQLy9ZiLLBFAEVcI4Dnw9+NJWZcdGoQyewxMF/9hbfk/8GbKBgtZxqdiiam8+m2lK31E/zJQ7kjuPXpB3EE8naYL0Q8+0WLhFV1WAPl9Eg=';

  private appVersion = '8.10.0';
  private apiUa = 'myXL / 8.9.1(1204); com.android.vending; (samsung; SM-N935F; SDK 33; Android 13)';
  private ciamUa = 'myXL / 8.6.0(1179); com.android.vending; (samsung; SM-N935F; SDK 33; Android 13)';

  constructor(session?: TelcoSession | null) {
    super(session);
  }

  // --- CRYPTO HELPERS ---

  private deriveIv(xtimeMs: number): string {
    return crypto.createHash('sha256').update(String(xtimeMs)).digest('hex').substring(0, 16);
  }

  private encryptXdata(plaintext: string, xtimeMs: number): string {
    const iv = Buffer.from(this.deriveIv(xtimeMs), 'utf8');
    const key = Buffer.from(this.xdataKey, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private decryptXdata(xdata: string, xtimeMs: number): string {
    const iv = Buffer.from(this.deriveIv(xtimeMs), 'utf8');
    const key = Buffer.from(this.xdataKey, 'utf8');
    let b64 = xdata.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(Buffer.from(b64, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  private makeXSignature(idToken: string, method: string, path: string, sigTimeSec: number): string {
    const keyStr = `${this.xApiBaseSecret};${idToken};${method};${path};${sigTimeSec}`;
    const msgStr = `${idToken};${sigTimeSec};`;
    return crypto
      .createHmac('sha512', Buffer.from(keyStr, 'utf8'))
      .update(Buffer.from(msgStr, 'utf8'))
      .digest('hex');
  }

  private makeXSignaturePayment(
    accessToken: string,
    sigTimeSec: number,
    packageCode: string,
    tokenPayment: string,
    paymentMethod: string,
    paymentFor: string,
    path: string
  ): string {
    const keyStr = `${this.xApiBaseSecret};${sigTimeSec}#ae-hei_9Tee6he+Ik3Gais5=;POST;${path};${sigTimeSec}`;
    const msgStr = `${accessToken};${tokenPayment};${sigTimeSec};${paymentFor};${paymentMethod};${packageCode};`;
    return crypto
      .createHmac('sha512', Buffer.from(keyStr, 'utf8'))
      .update(Buffer.from(msgStr, 'utf8'))
      .digest('hex');
  }

  private makeAxApiSignature(tsForSign: string, contact: string, code: string, contactType = 'SMS'): string {
    const preimage = `${tsForSign}password${contactType}${contact}${code}openid`;
    return crypto
      .createHmac('sha256', Buffer.from(this.axApiSigKey, 'ascii'))
      .update(Buffer.from(preimage, 'utf8'))
      .digest('base64');
  }

  private formatGmt7(date = new Date(), withoutColon = false, msDigits = 3): string {
    const gmt7 = new Date(date.getTime() + (7 * 60 + date.getTimezoneOffset()) * 60000);
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    const Y = gmt7.getFullYear();
    const M = pad(gmt7.getMonth() + 1);
    const D = pad(gmt7.getDate());
    const h = pad(gmt7.getHours());
    const m = pad(gmt7.getMinutes());
    const s = pad(gmt7.getSeconds());
    const ms = String(gmt7.getMilliseconds()).padStart(3, '0').substring(0, msDigits);
    const tz = withoutColon ? '+0700' : '+07:00';
    return `${Y}-${M}-${D}T${h}:${m}:${s}.${ms}${tz}`;
  }

  private getCiamBasicAuth(): string {
    return 'Basic ' + Buffer.from(`${this.ciamClientId}:${this.ciamClientSecret}`).toString('base64');
  }

  // --- HTTP HELPERS ---

  private async rawRequest(urlStr: string, options: https.RequestOptions, body?: string | Buffer): Promise<{ statusCode: number; headers: any; body: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const reqOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 200,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  public async sendApiRequest(
    method: string,
    path: string,
    body: Record<string, any> = {},
    xSignatureOverride?: string
  ): Promise<any> {
    const idToken = this.session?.authToken || '';
    const xtimeMs = Date.now();
    const sigTimeSec = Math.floor(xtimeMs / 1000);
    const cleanPath = path.replace(/^\//, '');

    const plaintext = JSON.stringify(body);
    const xdata = this.encryptXdata(plaintext, xtimeMs);
    const xSignature = xSignatureOverride || this.makeXSignature(idToken, method, cleanPath, sigTimeSec);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': 'api.myxl.xlaxiata.co.id',
      'x-api-key': this.apiKey,
      'authorization': `Bearer ${idToken}`,
      'x-hv': 'v3',
      'x-signature': xSignature,
      'x-signature-time': String(sigTimeSec),
      'x-request-id': crypto.randomUUID(),
      'x-request-at': this.formatGmt7(new Date(), false, 2),
      'x-version-app': this.appVersion,
      'User-Agent': this.apiUa
    };

    const payload = JSON.stringify({ xdata, xtime: xtimeMs });
    const fullUrl = `${this.baseUrl}/${cleanPath}`;

    const res = await this.rawRequest(fullUrl, { method, headers }, payload);
    let rawJson: any = null;
    try {
      rawJson = JSON.parse(res.body);
    } catch {
      return res.body;
    }

    // Auto-refresh token if 401 Unauthorized
    if (res.statusCode === 401 && this.session?.extra?.refreshToken) {
      const refreshed = await this.refreshToken(this.session.extra.refreshToken);
      if (refreshed?.id_token) {
        return this.sendApiRequest(method, path, body, xSignatureOverride);
      }
    }

    if (rawJson?.xdata && rawJson?.xtime) {
      try {
        const decrypted = this.decryptXdata(rawJson.xdata, Number(rawJson.xtime));
        return JSON.parse(decrypted);
      } catch {
        return rawJson;
      }
    }

    return rawJson;
  }

  public async refreshToken(refreshTokenStr: string): Promise<{ access_token?: string; refresh_token?: string; id_token?: string } | null> {
    const now = new Date();
    const axRequestAt = this.formatGmt7(now, true, 3);
    const axRequestId = crypto.randomUUID();

    const headers: Record<string, string> = {
      'Authorization': this.getCiamBasicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': 'gede.ciam.xlaxiata.co.id',
      'Ax-Device-Id': this.axDeviceId,
      'Ax-Fingerprint': this.axFingerprint,
      'Ax-Request-At': axRequestAt,
      'Ax-Request-Device': 'samsung',
      'Ax-Request-Device-Model': 'SM-N935F',
      'Ax-Request-Id': axRequestId,
      'Ax-Substype': 'PREPAID',
      'User-Agent': this.ciamUa
    };

    const formBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenStr
    }).toString();

    try {
      const res = await this.rawRequest(`${this.ciamBase}/protocol/openid-connect/token`, { method: 'POST', headers }, formBody);
      const data = JSON.parse(res.body);
      if (data?.id_token) {
        if (this.session) {
          this.session.authToken = data.id_token;
          if (!this.session.extra) this.session.extra = {};
          this.session.extra.accessToken = data.access_token;
          this.session.extra.refreshToken = data.refresh_token || refreshTokenStr;
          this.session.updatedAt = new Date().toISOString();
          defaultSessionManager.saveSession(this.session, true);
        }
        return {
          access_token: data.access_token,
          refresh_token: data.refresh_token || refreshTokenStr,
          id_token: data.id_token
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // --- TELCO PROVIDER IMPLEMENTATION ---

  public async login(phone: string): Promise<LoginResult> {
    const norm = normalizePhone(phone);
    if (!norm.isValid) {
      return { success: false, message: `Invalid XL / AXIS phone number: ${phone}`, requireOtp: false };
    }

    const contact = norm.international; // e.g. 62817xxxxxxx
    const now = new Date();
    const axRequestAt = this.formatGmt7(now, false, 2);
    const axRequestId = crypto.randomUUID();

    const headers: Record<string, string> = {
      'Authorization': this.getCiamBasicAuth(),
      'Ax-Device-Id': this.axDeviceId,
      'Ax-Fingerprint': this.axFingerprint,
      'Ax-Request-Device': 'samsung',
      'Ax-Request-Device-Model': 'SM-N935F',
      'Ax-Request-At': axRequestAt,
      'Ax-Request-Id': axRequestId,
      'Ax-Substype': 'PREPAID',
      'Content-Type': 'application/json',
      'Host': 'gede.ciam.xlaxiata.co.id',
      'User-Agent': this.ciamUa
    };

    const url = `${this.ciamBase}/auth/otp?contact=${contact}&contactType=SMS&alternateContact=false`;

    try {
      const res = await this.rawRequest(url, { method: 'GET', headers });
      const data = JSON.parse(res.body);

      if (res.statusCode === 200 && data.subscriber_id) {
        return {
          success: true,
          message: `Kode OTP berhasil dikirim via SMS ke ${norm.national} (${norm.international})!`,
          transId: data.subscriber_id,
          requireOtp: true,
          extra: { subscriberId: data.subscriber_id, msisdn: norm.international }
        };
      }

      return {
        success: false,
        message: data.error_description || data.message || `Gagal mengirim OTP XL (Status ${res.statusCode})`,
        requireOtp: false
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Error saat menghubungi CIAM XL Gateway',
        requireOtp: false
      };
    }
  }

  public async submitOtp(otp: string, transId?: string, phone?: string): Promise<OtpResult> {
    const norm = phone
      ? normalizePhone(phone)
      : this.session
      ? normalizePhone(this.session.phone)
      : { international: '', national: '' };
    const contact = norm.international;

    if (!contact || otp.trim().length !== 6) {
      return { success: false, message: 'Nomor HP dan kode OTP 6 digit wajib diisi.' };
    }

    const now = new Date();
    const tsForSign = this.formatGmt7(now, true, 3);
    const tsHeader = this.formatGmt7(new Date(now.getTime() - 5 * 60000), true, 3); // 5 mins back as per app convention
    const signature = this.makeAxApiSignature(tsForSign, contact, otp.trim(), 'SMS');
    const axRequestId = crypto.randomUUID();

    const headers: Record<string, string> = {
      'Authorization': this.getCiamBasicAuth(),
      'Ax-Api-Signature': signature,
      'Ax-Device-Id': this.axDeviceId,
      'Ax-Fingerprint': this.axFingerprint,
      'Ax-Request-At': tsHeader,
      'Ax-Request-Device': 'samsung',
      'Ax-Request-Device-Model': 'SM-N935F',
      'Ax-Request-Id': axRequestId,
      'Ax-Substype': 'PREPAID',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': 'gede.ciam.xlaxiata.co.id',
      'User-Agent': this.ciamUa
    };

    const formBody = new URLSearchParams({
      contactType: 'SMS',
      code: otp.trim(),
      grant_type: 'password',
      contact: contact,
      scope: 'openid'
    }).toString();

    try {
      const res = await this.rawRequest(
        `${this.ciamBase}/protocol/openid-connect/token`,
        { method: 'POST', headers },
        formBody
      );

      const data = JSON.parse(res.body);

      if (res.statusCode === 200 && data.id_token) {
        const newSession: TelcoSession = {
          phone: norm.national,
          msisdn: norm.international,
          provider: 'XL',
          brand: 'myXL',
          authToken: data.id_token,
          userType: 'SUBSCRIBER',
          deviceId: this.axDeviceId,
          extra: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            subscriberId: transId,
            expiresIn: data.expires_in
          },
          updatedAt: new Date().toISOString()
        };
        this.session = newSession;

        return {
          success: true,
          message: `Login berhasil untuk nomor XL / AXIS ${norm.national}!`,
          session: newSession,
          data
        };
      }

      return {
        success: false,
        message: data.error_description || data.error || 'Validasi OTP gagal.'
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error saat validasi OTP XL' };
    }
  }

  public async getProfile(): Promise<ProfileResult> {
    if (!this.session?.authToken) {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'XL',
        message: 'Belum ada sesi XL yang aktif. Silakan login terlebih dahulu.'
      };
    }

    try {
      const accessToken = this.session.extra?.accessToken || '';
      const [profRes, balRes] = await Promise.all([
        this.sendApiRequest('POST', 'api/v8/profile', {
          access_token: accessToken,
          app_version: this.appVersion,
          is_enterprise: false,
          lang: 'en'
        }),
        this.sendApiRequest('POST', 'api/v8/packages/balance-and-credit', {
          is_enterprise: false,
          lang: 'en',
          access_token: accessToken
        })
      ]);

      const profData = profRes?.data || profRes;
      const balData = balRes?.data || balRes;

      const name = profData?.name || profData?.profile?.name || 'XL Subscriber';
      const balanceNum = Number(balData?.balance || balData?.total_balance || 0);
      const activeUntil = balData?.expired_date || balData?.active_until || profData?.active_until || '-';
      const point = Number(profData?.point || profData?.loyalty_point || 0);
      const tier = profData?.tier || profData?.membership_tier || 'Member';

      return {
        success: true,
        phone: this.session.phone || profData?.msisdn || '',
        provider: 'XL',
        name,
        balance: balanceNum,
        balanceFormatted: `Rp ${balanceNum.toLocaleString('id-ID')}`,
        activeUntil,
        loyaltyPoints: {
          name: 'Poin myXL',
          points: point,
          tier
        },
        raw: { profRes, balRes }
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session.phone,
        provider: 'XL',
        message: e.message || 'Gagal mengambil profil XL'
      };
    }
  }

  public async getQuota(): Promise<QuotaResult> {
    if (!this.session?.authToken) {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'XL',
        items: [],
        message: 'Belum ada sesi XL yang aktif. Silakan login terlebih dahulu.'
      };
    }

    try {
      const accessToken = this.session.extra?.accessToken || '';
      const res = await this.sendApiRequest('POST', 'api/v8/packages/quota-details', {
        is_enterprise: false,
        lang: 'en',
        access_token: accessToken
      });

      const data = res?.data || res;
      const quotas = data?.quotas || data?.packages || data?.quota_details || [];
      const items: QuotaItem[] = [];

      if (Array.isArray(quotas)) {
        quotas.forEach((q: any) => {
          const rem = q.remaining_quota || q.remaining || q.quota_remaining;
          let remFormatted = typeof rem === 'number' ? `${(rem / (1024 * 1024 * 1024)).toFixed(2)} GB` : String(rem || '0 MB');
          if (q.remaining_display) remFormatted = q.remaining_display;

          items.push({
            name: q.name || q.group_name || q.quota_name || 'Kuota Internet XL',
            type: q.type || 'MAIN',
            remainingFormatted: remFormatted,
            validUntil: q.expired_date || q.validity || '-'
          });
        });
      }

      const totalFormatted = items.map((i) => `${i.name}: ${i.remainingFormatted}`).join(', ') || '0 GB';

      return {
        success: true,
        phone: this.session.phone || '',
        provider: 'XL',
        totalRemainingFormatted: totalFormatted,
        items,
        raw: res
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session.phone,
        provider: 'XL',
        items: [],
        message: e.message || 'Gagal mengambil data kuota XL'
      };
    }
  }

  public async getPackages(keyword?: string, category?: string): Promise<PackageListResult> {
    if (!this.session?.authToken) {
      return {
        success: false,
        provider: 'XL',
        packages: [],
        message: 'Katalog paket XL memerlukan login akun XL terlebih dahulu.'
      };
    }

    try {
      const searchBody = {
        is_enterprise: false,
        filters: [
          { unit: 'THOUSAND', id: 'FIL_SEL_P', type: 'PRICE', items: [] },
          { unit: 'GB', id: 'FIL_SEL_MQ', type: 'DATA_TYPE', items: [] },
          { unit: 'PACKAGE_NAME', id: 'FIL_PKG_N', type: 'PACKAGE_NAME', items: [{ id: '', label: '' }] },
          { unit: 'DAY', id: 'FIL_SEL_V', type: 'VALIDITY', items: [] }
        ],
        substype: 'PREPAID',
        text_search: keyword || '',
        lang: 'en'
      };

      const res = await this.sendApiRequest('POST', 'api/v9/xl-stores/options/search', searchBody);
      const data = res?.data || {};
      const list = [...(data?.results || []), ...(data?.results_price_only || [])];
      const packages: PackageItem[] = [];
      const seen = new Set<string>();

      list.forEach((p: any) => {
        const id = p.action_param || p.package_option_code || p.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          const price = Number(p.original_price || p.discounted_price || p.price || 0);
          packages.push({
            id,
            name: p.title || p.name || p.package_name,
            price,
            priceFormatted: `Rp ${price.toLocaleString('id-ID')}`,
            quotaFormatted: p.quota || p.total_quota || p.benefit,
            validityFormatted: p.validity || (p.validity_days ? `${p.validity_days} Hari` : undefined),
            description: p.description,
            category: p.family_name || 'XL Store'
          });
        }
      });

      return {
        success: true,
        provider: 'XL',
        packages,
        raw: res
      };
    } catch (e: any) {
      return {
        success: false,
        provider: 'XL',
        packages: [],
        message: e.message || 'Gagal mengambil katalog paket XL'
      };
    }
  }

  public async buyPackage(packageId: string, paymentMethod = 'PULSA'): Promise<PurchaseResult> {
    if (!this.session?.authToken) {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: 'Pemesanan paket XL memerlukan sesi login aktif.'
      };
    }

    try {
      const idToken = this.session.authToken || '';
      const accessToken = this.session.extra?.accessToken || '';

      // 1. Get Option Detail to retrieve token_confirmation & exact price
      const detailRes = await this.sendApiRequest('POST', 'api/v8/xl-stores/options/detail', {
        package_option_code: packageId,
        is_enterprise: false,
        is_transaction_routine: false,
        migration_type: 'NONE',
        family_role_hub: '',
        is_autobuy: false,
        is_shareable: false,
        is_migration: false,
        lang: 'id',
        is_upsell_pdp: false,
        package_family_code: '',
        package_variant_code: ''
      });

      const d = detailRes?.data || {};
      const opt = d?.package_option || {};
      const optionCode = opt?.package_option_code || packageId;
      const price = Number(opt?.price || 0);
      const tokenConfirmation = d?.token_confirmation || '';

      if (!tokenConfirmation) {
        return {
          success: false,
          paymentMethod,
          status: 'FAILED',
          message: 'Gagal mendapatkan token_confirmation untuk paket XL ini.',
          raw: detailRes
        };
      }

      // 2. Intercept Page (Required by myXL app flow)
      await this.sendApiRequest('POST', 'misc/api/v8/utility/intercept-page', {
        is_enterprise: false,
        lang: 'en',
        package_option_code: optionCode
      });

      // 3. Payment Methods Option
      const pmRes = await this.sendApiRequest('POST', 'payments/api/v8/payment-methods-option', {
        payment_type: 'PURCHASE',
        is_enterprise: false,
        payment_target: optionCode,
        lang: 'en',
        is_referral: false,
        token_confirmation: tokenConfirmation
      });

      const pdata = pmRes?.data || pmRes || {};
      const tokenPayment = pdata?.token_payment || '';
      const tsToSign = Number(pdata?.timestamp || Math.floor(Date.now() / 1000));

      if (!tokenPayment) {
        return {
          success: false,
          paymentMethod,
          status: 'FAILED',
          message: 'Gagal mendapatkan token_payment dari gateway XL.',
          raw: pmRes
        };
      }

      const isBalance = paymentMethod.toUpperCase() === 'PULSA' || paymentMethod.toUpperCase() === 'BALANCE';

      // 4A. PULSA / BALANCE SETTLEMENT
      if (isBalance) {
        const xtimeMs = Date.now();
        const sigTimeSec = Math.floor(xtimeMs / 1000);
        const path = 'payments/api/v8/settlement-balance';
        const xSignature = this.makeXSignaturePayment(
          accessToken,
          sigTimeSec,
          optionCode,
          tokenPayment,
          'BALANCE',
          'BUY_PACKAGE',
          path
        );

        const body = {
          payment_type: 'PURCHASE',
          is_enterprise: false,
          payment_target: optionCode,
          lang: 'en',
          is_referral: false,
          with_upsell: false,
          topup_number: '',
          stage_token: '',
          authentication_id: '',
          token: '',
          token_confirmation: tokenConfirmation,
          access_token: accessToken,
          wallet_number: '',
          additional_data: {},
          total_amount: price,
          is_using_autobuy: false,
          items: [
            {
              item_code: optionCode,
              product_type: '',
              item_price: price,
              item_name: opt?.name || '',
              tax: 0
            }
          ]
        };

        const res = await this.sendApiRequest('POST', path, body, xSignature);
        if (res?.status === 'SUCCESS' || res?.data?.status === 'SUCCESS') {
          return {
            success: true,
            transactionId: res?.data?.transaction_code || res?.transaction_code,
            paymentMethod: 'PULSA',
            status: 'SUCCESS',
            amount: price,
            amountFormatted: `Rp ${price.toLocaleString('id-ID')}`,
            message: 'Pembelian paket XL berhasil dipotong dari pulsa utama!',
            raw: res
          };
        }

        return {
          success: false,
          paymentMethod: 'PULSA',
          status: 'FAILED',
          message: res?.message || 'Gagal memotong pulsa XL. Pastikan saldo mencukupi.',
          raw: res
        };
      }

      // 4B. QRIS SETTLEMENT
      const xtimeMs = Date.now();
      const path = 'payments/api/v8/settlement-multipayment/qris';
      const xSignature = this.makeXSignaturePayment(
        accessToken,
        tsToSign,
        optionCode,
        tokenPayment,
        'QRIS',
        'BUY_PACKAGE',
        path
      );

      const qrisBody = {
        akrab: { akrab_members: [], akrab_parent_alias: '', members: [] },
        can_trigger_rating: false,
        total_discount: 0,
        coupon: '',
        payment_for: 'BUY_PACKAGE',
        topup_number: '',
        stage_token: '',
        is_enterprise: false,
        autobuy: {
          is_using_autobuy: false,
          activated_autobuy_code: '',
          autobuy_threshold_setting: { label: '', type: '', value: 0 }
        },
        access_token: accessToken,
        is_myxl_wallet: false,
        additional_data: {
          original_price: price,
          is_spend_limit_temporary: false,
          migration_type: '',
          spend_limit_amount: 0,
          is_spend_limit: false,
          tax: 0,
          benefit_type: '',
          quota_bonus: 0,
          cashtag: '',
          is_family_plan: false,
          combo_details: [],
          is_switch_plan: false,
          discount_recurring: 0,
          has_bonus: false,
          discount_promo: 0
        },
        total_amount: price,
        total_fee: 0,
        is_use_point: false,
        lang: 'en',
        items: [
          {
            item_code: optionCode,
            product_type: '',
            item_price: price,
            item_name: opt?.name || '',
            tax: 0,
            token_confirmation: tokenConfirmation
          }
        ],
        verification_token: tokenPayment,
        payment_method: 'QRIS',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const settleRes = await this.sendApiRequest('POST', path, qrisBody, xSignature);
      const transactionCode = settleRes?.data?.transaction_code || settleRes?.transaction_code;

      if (!transactionCode) {
        return {
          success: false,
          paymentMethod: 'QRIS',
          status: 'FAILED',
          message: settleRes?.message || 'Gagal membuat settlement QRIS XL.',
          raw: settleRes
        };
      }

      // 5. Fetch QR Code string from pending-detail
      const qrRes = await this.sendApiRequest('POST', 'payments/api/v8/pending-detail', {
        transaction_id: transactionCode,
        is_enterprise: false,
        lang: 'en',
        status: ''
      });

      const qrCode = qrRes?.data?.qr_code || qrRes?.qr_code;

      return {
        success: true,
        transactionId: transactionCode,
        paymentMethod: 'QRIS',
        status: 'PENDING',
        qrisData: qrCode,
        amount: price,
        amountFormatted: `Rp ${price.toLocaleString('id-ID')}`,
        message: 'Tagihan QRIS XL berhasil dibuat! Silakan scan untuk menyelesaikan pembayaran.',
        raw: { settleRes, qrRes }
      };
    } catch (e: any) {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error saat memproses pembelian paket XL'
      };
    }
  }

  public async topupPulsa(amount: number, paymentMethod = 'QRIS'): Promise<TopupResult> {
    return {
      success: false,
      amount,
      paymentMethod,
      status: 'FAILED',
      message: 'Isi ulang pulsa XL dapat dilakukan langsung via menu pembelian paket atau channel perbankan resmi.'
    };
  }
}
