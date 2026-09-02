/**
 * EnQuota - Telkomsel by.U Provider Driver
 * Reverse-engineered for Circles.Life CXOS Gateway (pidaw-app.cx.byu.id)
 */

import crypto from 'crypto';
import https from 'https';
import { TelcoProvider, LoginResult, OtpResult, ProfileResult, QuotaResult, PackageListResult, PurchaseResult, TopupResult, PackageItem, QuotaItem } from './base.js';
import { SupportedProvider, normalizePhone } from '../detector.js';
import { TelcoSession } from '../session.js';

export class ByuProvider extends TelcoProvider {
  readonly provider: SupportedProvider = 'BYU';
  readonly name = 'Telkomsel by.U';
  readonly brand = 'by.U';

  private baseUrl = 'https://pidaw-app.cx.byu.id';
  private countryCode = 'id';
  private languageCode = 'id-ID';
  private channel = 'WEB';
  private slocation = 'CL';
  private hmacAesKey = 'EIUFGFJSLOKSJNKOSNMJNARFHNBSLOUB';

  private rubyToken = '';
  private deviceId = '';
  private cookies = '';
  private hmacSecretKey: string | null = null;
  private customerId = '';
  private billingAccountId = '';
  private serviceAccountId = '';

  constructor(session?: TelcoSession | null) {
    super(session);
    if (session) {
      if (session.authToken) this.rubyToken = session.authToken;
      if (session.deviceId) this.deviceId = session.deviceId;
      if (session.cookies) this.cookies = session.cookies;
      if (session.extra?.hmacSecretKey) this.hmacSecretKey = session.extra.hmacSecretKey;
      if (session.extra?.customerId) this.customerId = session.extra.customerId;
      if (session.extra?.billingAccountId) this.billingAccountId = session.extra.billingAccountId;
      if (session.extra?.serviceAccountId) this.serviceAccountId = session.extra.serviceAccountId;
    }

    if (!this.deviceId) {
      this.deviceId = `${Date.now()}-${Math.floor(100000000 + Math.random() * 900000000)}`;
    }
  }

  public async request(endpoint: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}): Promise<{ statusCode: number; headers: any; body: any }> {
    const method = (options.method || 'GET').toUpperCase();
    const bodyObj = options.body;
    const bodyStr = bodyObj ? (typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj)) : null;
    const extraHeaders = options.headers || {};
    const reqId = `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const fullEndpoint = endpoint
      .replace('{country_code}', this.countryCode)
      .replace('{language_code}', this.languageCode)
      .replace('{channel}', this.channel);

    const headers: Record<string, string> = {
      'Host': 'pidaw-app.cx.byu.id',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
      'Origin': 'https://pidaw-webfront.cx.byu.id',
      'Referer': 'https://pidaw-webfront.cx.byu.id/',
      'X-DeviceId': this.deviceId,
      'X-Request-Id': reqId,
      'Slocation': this.slocation,
      'channel': this.channel,
      ...extraHeaders
    };

    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(bodyStr));
    }

    if (this.rubyToken) {
      headers['x-auth'] = this.rubyToken;
      headers['Authorization'] = `Bearer ${this.rubyToken}`;
    }

    if (this.cookies) {
      let cStr = this.cookies;
      if (this.rubyToken && !cStr.includes('rubyToken=')) {
        cStr += `; rubyToken=${this.rubyToken}`;
      }
      headers['Cookie'] = cStr;
    }

    const url = new URL(fullEndpoint, this.baseUrl);

    return new Promise((resolve, reject) => {
      const req = https.request(url.toString(), {
        method,
        headers
      }, res => {
        let rawData = '';
        res.on('data', chunk => rawData += chunk);
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }

          if (res.headers['set-cookie']) {
            const newCookies = (res.headers['set-cookie'] as string[]).map(c => c.split(';')[0]).join('; ');
            this.cookies = this.mergeCookies(this.cookies, newCookies);
          }

          resolve({
            statusCode: res.statusCode || 200,
            headers: res.headers,
            body: parsed
          });
        });
      });

      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  private mergeCookies(oldStr = '', newStr = ''): string {
    const map = new Map<string, string>();
    oldStr.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0]) map.set(parts[0], parts.slice(1).join('='));
    });
    newStr.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0]) map.set(parts[0], parts.slice(1).join('='));
    });
    return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  public async getOrFetchHmacKey(): Promise<string> {
    if (this.hmacSecretKey) return this.hmacSecretKey;

    const res = await this.request('/v1/utility/configuration', { method: 'GET' });
    const encryptedKey = res.body?.response || res.body?.result;
    if (!encryptedKey) {
      throw new Error('Gagal mengambil konfigurasi enkripsi HMAC dari server by.U');
    }

    try {
      const combined = Buffer.from(encryptedKey.replace(/\s+/g, ''), 'base64');
      const iv = combined.subarray(0, 16);
      const ciphertext = combined.subarray(16);
      const aesKey = Buffer.from(this.hmacAesKey, 'utf8');

      const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
      let decrypted = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      this.hmacSecretKey = decrypted;
      return decrypted;
    } catch (e: any) {
      throw new Error(`Gagal mendekripsi HMAC secret key: ${e.message}`);
    }
  }

  public async signPayload(payloadObj: any): Promise<string> {
    const key = await this.getOrFetchHmacKey();
    const dataStr = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
    return crypto.createHmac('sha256', key).update(dataStr).digest('hex');
  }

  public async login(phone: string): Promise<LoginResult> {
    const norm = normalizePhone(phone);
    return {
      success: true,
      message: `by.U uses persistent Web Session / Ruby Token auth. If you have an active rubyToken or cookie, submit it with eq_submit_otp(otp="<rubyToken>"). (Nomor: ${norm.national})`,
      requireOtp: true,
      extra: { msisdn: norm.international }
    };
  }

  public async submitOtp(otp: string, transId?: string, phone?: string): Promise<OtpResult> {
    // If rubyToken or JWT passed as otp/token
    if (otp.length > 20) {
      this.rubyToken = otp;
      const norm = phone ? normalizePhone(phone) : { international: '', national: '' };
      
      // Fetch initial account details to verify token
      try {
        const detailsRes = await this.request('/v2/service-account/details', { method: 'GET' });
        const item = detailsRes.body?.result?.data?.[0];
        if (item) {
          this.customerId = item.customerId || '';
          this.billingAccountId = item.billingAccountId || '';
          this.serviceAccountId = item.serviceAccountId || '';
        }
      } catch {}

      const newSession: TelcoSession = {
        phone: norm.national || this.session?.phone || '',
        msisdn: norm.international || this.session?.msisdn || '',
        provider: 'BYU',
        brand: 'by.U',
        authToken: otp,
        userType: 'SUBSCRIBER',
        deviceId: this.deviceId,
        cookies: this.cookies,
        extra: {
          hmacSecretKey: this.hmacSecretKey,
          customerId: this.customerId,
          billingAccountId: this.billingAccountId,
          serviceAccountId: this.serviceAccountId
        },
        updatedAt: new Date().toISOString()
      };
      this.session = newSession;

      return {
        success: true,
        message: 'by.U Ruby Token set successfully!',
        session: newSession
      };
    }

    return {
      success: false,
      message: 'by.U authentication requires the rubyToken JWT string from your by.U web session.'
    };
  }

  public async getProfile(): Promise<ProfileResult> {
    try {
      const detailsRes = await this.request('/v2/service-account/details', { method: 'GET' });
      const item = detailsRes.body?.result?.data?.[0];
      if (item) {
        this.customerId = item.customerId || this.customerId;
        this.billingAccountId = item.billingAccountId || this.billingAccountId;
        this.serviceAccountId = item.serviceAccountId || this.serviceAccountId;
      }

      let uCoin = 0;
      if (this.customerId) {
        try {
          const loyaltyRes = await this.request(`/v1/loyalty/member-details/${encodeURIComponent(this.customerId)}`, { method: 'GET' });
          uCoin = Number(loyaltyRes.body?.result?.totalPoints || loyaltyRes.body?.result?.points || 0);
        } catch {}
      }

      const balanceVal = Number(item?.creditBalance || item?.balance || 0);

      return {
        success: true,
        phone: this.session?.phone || item?.msisdn || '',
        provider: 'BYU',
        name: item?.customerName || item?.name || 'by.U Subscriber',
        balance: balanceVal,
        balanceFormatted: `Rp ${balanceVal.toLocaleString('id-ID')}`,
        activeUntil: item?.expiryDate || item?.validUntil || '-',
        loyaltyPoints: {
          name: 'uCoin',
          points: uCoin,
          tier: 'by.U Crew'
        },
        raw: { item }
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'BYU',
        message: e.message || 'Failed to fetch by.U profile'
      };
    }
  }

  public async getQuota(): Promise<QuotaResult> {
    try {
      if (!this.billingAccountId) {
        const detailsRes = await this.request('/v2/service-account/details', { method: 'GET' });
        const item = detailsRes.body?.result?.data?.[0];
        if (item) {
          this.billingAccountId = item.billingAccountId;
          this.serviceAccountId = item.serviceAccountId;
        }
      }

      const acc = this.billingAccountId || this.serviceAccountId;
      const usageRes = await this.request(`/v2/account/usage?accountNumber=${encodeURIComponent(acc)}`, { method: 'GET' });
      const usage = usageRes.body?.result?.data || usageRes.body?.response || [];

      const items: QuotaItem[] = (Array.isArray(usage) ? usage : []).map((u: any) => ({
        name: u.displayName || u.name || 'Kuota by.U',
        type: 'MAIN',
        remainingFormatted: u.remainingQuotaFormatted || `${u.remainingQuota || 0} MB`,
        validUntil: u.expiryDate || u.validUntil || '-'
      }));

      return {
        success: true,
        phone: this.session?.phone || '',
        provider: 'BYU',
        totalRemainingFormatted: items.map(i => `${i.name}: ${i.remainingFormatted}`).join(', ') || '0 MB',
        items,
        raw: usage
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'BYU',
        items: [],
        message: e.message || 'Failed to fetch by.U usage quota'
      };
    }
  }

  public async getPackages(keyword?: string, category?: string): Promise<PackageListResult> {
    try {
      const planRes = await this.request('/v1/items/grouped?productCategory=prepaid', { method: 'GET' });
      const groups = planRes.body?.result?.data || [];
      const packages: PackageItem[] = [];

      if (Array.isArray(groups)) {
        groups.forEach((g: any) => {
          if (Array.isArray(g.items)) {
            g.items.forEach((it: any) => {
              const price = Number(it.price || it.tariff || 0);
              packages.push({
                id: it.id || it.sku || it.itemCode,
                name: it.displayName || it.name,
                price,
                priceFormatted: `Rp ${price.toLocaleString('id-ID')}`,
                quotaFormatted: it.dataAllowance || it.benefit,
                validityFormatted: it.validity ? `${it.validity} Hari` : undefined,
                description: it.description,
                category: g.groupName || 'by.U Plan'
              });
            });
          }
        });
      }

      let filtered = packages;
      if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = packages.filter(p => p.name.toLowerCase().includes(kw) || (p.description && p.description.toLowerCase().includes(kw)));
      }

      return {
        success: true,
        provider: 'BYU',
        packages: filtered,
        raw: planRes.body
      };
    } catch (e: any) {
      return {
        success: false,
        provider: 'BYU',
        packages: [],
        message: e.message || 'Failed to fetch by.U catalog'
      };
    }
  }

  public async buyPackage(packageId: string, paymentMethod = 'PULSA'): Promise<PurchaseResult> {
    try {
      const orderPayload = {
        plan_id: packageId,
        payment_method: paymentMethod.toUpperCase(),
        channel: this.channel
      };

      const signature = await this.signPayload(orderPayload);
      const res = await this.request('/v3/orders', {
        method: 'POST',
        body: orderPayload,
        headers: { 'X-Signature': signature }
      });

      const data = res.body?.response || res.body?.result;
      return {
        success: res.statusCode === 200 || res.statusCode === 201,
        transactionId: data?.orderId || data?.id,
        paymentMethod,
        status: paymentMethod.toUpperCase() === 'PULSA' ? 'SUCCESS' : 'PENDING',
        qrisData: data?.qrString || data?.qrCode,
        checkoutUrl: data?.paymentUrl,
        amount: Number(data?.totalAmount || 0),
        amountFormatted: `Rp ${Number(data?.totalAmount || 0).toLocaleString('id-ID')}`,
        message: `Order by.U dibuat. ID: ${data?.orderId || '-'}`,
        raw: data
      };
    } catch (e: any) {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error ordering by.U package'
      };
    }
  }

  public async topupPulsa(amount: number, paymentMethod = 'QRIS'): Promise<TopupResult> {
    try {
      const payload = {
        amount,
        payment_method: paymentMethod.toUpperCase()
      };
      const signature = await this.signPayload(payload);
      const res = await this.request('/v3/orders', {
        method: 'POST',
        body: payload,
        headers: { 'X-Signature': signature }
      });

      const data = res.body?.response || res.body?.result;
      return {
        success: res.statusCode === 200,
        transactionId: data?.orderId,
        amount,
        paymentMethod,
        status: 'PENDING',
        qrisData: data?.qrString,
        checkoutUrl: data?.paymentUrl,
        message: `Isi ulang pulsa by.U Rp ${amount.toLocaleString('id-ID')} dibuat.`,
        raw: data
      };
    } catch (e: any) {
      return {
        success: false,
        amount,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error topping up by.U pulsa'
      };
    }
  }
}
