/**
 * EnQuota - Indosat Ooredoo Hutchison (myIM3) Provider Driver
 * Reverse-engineered for myIM3 API Gateway
 */

import crypto from 'crypto';
import https from 'https';
import { TelcoProvider, LoginResult, OtpResult, ProfileResult, QuotaResult, PackageListResult, PurchaseResult, TopupResult, PackageItem, QuotaItem } from './base.js';
import { SupportedProvider, normalizePhone } from '../detector.js';
import { TelcoSession } from '../session.js';

export class IndosatProvider extends TelcoProvider {
  readonly provider: SupportedProvider = 'INDOSAT';
  readonly name = 'Indosat Ooredoo';
  readonly brand = 'myIM3';

  private baseUrl = 'https://myim3api1.ioh.co.id/api/v2';
  private appVersion = '82.2.0';
  private channel = 'PORTAL';
  private language = 'ID';
  private os = 'BROWSER';
  private deviceId = 'bd4f51a406214740b3604043d76aa099';
  private deviceName = 'BROWSER';
  private serviceKey = 'i4WxFMMLvWqnrvuAyg58';
  private hdrAuthorization = '642d1cc69d90666962726e';
  private cookies = 'TS010ed7c9=01334ce8020a78c96b53f1f207773cdc514392fbc45bb034d8fbc6c323b71fa637e78c6fe6a127cadfcc43e8bbdcd39f33af603592; BUI=bd4f51a4-0621-4740-b360-4043d76aa099';

  constructor(session?: TelcoSession | null) {
    super(session);
    if (session) {
      if (session.deviceId) this.deviceId = session.deviceId;
      if (session.cookies) this.cookies = session.cookies;
    }
  }

  private sha512(str: string): string {
    return crypto.createHash('sha512').update(str).digest('hex');
  }

  private getOddPositionCharacters(str: string): string {
    let res = '';
    for (let i = 0; i < str.length; i += 2) {
      res += str[i];
    }
    return res;
  }

  private getHeaderHashParams(parent: string, os: string, appVersion: string, tokenId: string): string {
    const p = parent && parent !== '' ? parent : 'parent';
    return `${p}$${os}$${appVersion}$${tokenId}`;
  }

  private formatDate(date: Date): string {
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`;
  }

  private buildHeaders(bodyStr: string): Record<string, string> {
    const activeToken = this.session?.authToken || this.deviceId;
    const now = new Date();
    const uid = this.formatDate(now) + String(Math.floor(100 + Math.random() * 900));

    const saltOauth = this.getOddPositionCharacters(activeToken);
    const oauth = this.sha512(`REQBODY=${bodyStr}&SALT=${saltOauth}`);

    const saltHash = this.getOddPositionCharacters(uid);
    const hashData = this.getHeaderHashParams('', this.os, this.appVersion, activeToken);
    const hash = this.sha512(`${hashData}&SALT=${saltHash}`);

    const headers: Record<string, string> = {
      'Authorization': this.hdrAuthorization,
      'X-IMI-SERVICEKEY': this.serviceKey,
      'X-IMI-TOKENID': activeToken,
      'X-IMI-UID': uid,
      'X-IMI-HASH': hash,
      'x-imi-oauth': oauth,
      'X-IMI-App-OS': this.os,
      'X-IMI-APPVERSION': this.appVersion,
      'X-IMI-CHANNEL': this.channel,
      'X-IMI-LANGUAGE': this.language,
      'X-DEVICEID': this.deviceId,
      'X-DEVICENAME': this.deviceName,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://myim3app.indosatooredoo.com',
      'Referer': 'https://myim3app.indosatooredoo.com/'
    };

    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    return headers;
  }

  public async request(endpoint: string, bodyObj: Record<string, any> = {}): Promise<{ statusCode: number; headers: any; body: any }> {
    const bodyStr = JSON.stringify(bodyObj);
    const headers = this.buildHeaders(bodyStr);

    return new Promise((resolve, reject) => {
      const req = https.request(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: headers
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.headers['set-cookie']) {
            this.updateCookies(res.headers['set-cookie'] as string[]);
          }
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode || 200, headers: res.headers, body: parsed });
          } catch {
            resolve({ statusCode: res.statusCode || 200, headers: res.headers, body: data });
          }
        });
      });

      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }

  private updateCookies(cookieHeaders: string[]): void {
    const currentCookies: Record<string, string> = {};
    if (this.cookies) {
      this.cookies.split(';').forEach(c => {
        const parts = c.trim().split('=');
        if (parts.length >= 2) currentCookies[parts[0]] = parts.slice(1).join('=');
      });
    }
    cookieHeaders.forEach(ch => {
      const main = ch.split(';')[0].trim();
      const parts = main.split('=');
      if (parts.length >= 2) currentCookies[parts[0]] = parts.slice(1).join('=');
    });
    this.cookies = Object.entries(currentCookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  public async initGuest(): Promise<string> {
    const res = await this.request('/token/guest', {});
    if (res.body && res.body.status === '0' && res.body.data?.tokenid) {
      const token = res.body.data.tokenid;
      if (!this.session) {
        this.session = {
          phone: '',
          msisdn: '',
          provider: 'INDOSAT',
          brand: 'myIM3',
          authToken: token,
          userType: 'GUEST',
          deviceId: this.deviceId,
          cookies: this.cookies,
          updatedAt: new Date().toISOString()
        };
      } else {
        this.session.authToken = token;
      }
      return token;
    }
    throw new Error(`Failed to initialize guest for myIM3: ${JSON.stringify(res.body)}`);
  }

  public async login(phone: string): Promise<LoginResult> {
    const norm = normalizePhone(phone);
    if (!norm.isValid) {
      return { success: false, message: `Invalid IM3 phone number: ${phone}`, requireOtp: false };
    }

    try {
      if (!this.session?.authToken) {
        await this.initGuest();
      }

      const sendRes = await this.request('/otp/send/v1', {
        msisdn: norm.international,
        action: 'register'
      });

      if (sendRes.body?.status !== '0') {
        return {
          success: false,
          message: sendRes.body?.message || `Failed to send IM3 OTP (${sendRes.statusCode})`,
          requireOtp: false
        };
      }

      const transId = sendRes.body?.transid;
      return {
        success: true,
        message: `OTP sent successfully via SMS to ${norm.international}`,
        transId,
        requireOtp: true,
        extra: { msisdn: norm.international }
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error requesting IM3 OTP', requireOtp: false };
    }
  }

  public async submitOtp(otp: string, transId?: string, phone?: string): Promise<OtpResult> {
    try {
      const valRes = await this.request('/otp/validate/v1', {
        transid: transId || '',
        otp: otp.trim()
      });

      if (valRes.body?.status === '0' && valRes.body?.data?.tokenid) {
        const token = valRes.body.data.tokenid;
        const norm = phone ? normalizePhone(phone) : (this.session ? normalizePhone(this.session.phone) : { international: '', national: '' });

        const newSession: TelcoSession = {
          phone: norm.national || this.session?.phone || '',
          msisdn: norm.international || this.session?.msisdn || '',
          provider: 'INDOSAT',
          brand: 'myIM3',
          authToken: token,
          userType: 'SUBSCRIBER',
          deviceId: this.deviceId,
          cookies: this.cookies,
          updatedAt: new Date().toISOString()
        };
        this.session = newSession;

        return {
          success: true,
          message: `Login successful for Indosat myIM3 (${norm.national || norm.international})`,
          session: newSession,
          data: valRes.body.data
        };
      }

      return {
        success: false,
        message: valRes.body?.message || 'IM3 OTP validation failed'
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error validating IM3 OTP' };
    }
  }

  public async getProfile(): Promise<ProfileResult> {
    if (!this.session?.authToken || this.session.userType === 'GUEST') {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'INDOSAT',
        message: 'No authenticated myIM3 subscriber session. Please login first.'
      };
    }

    try {
      const [dashRes, profRes] = await Promise.all([
        this.request('/dashboard/get/v4', {}),
        this.request('/profile/get', {})
      ]);

      const dash = dashRes.body?.data;
      const prof = profRes.body?.data;

      const fullName = [prof?.fname, prof?.lname].filter(Boolean).join(' ') || prof?.uname || prof?.name || 'IM3 Subscriber';
      const balanceNum = dash?.prepaidinfo?.balance != null ? Number(dash.prepaidinfo.balance) : 0;
      const activeUntil = dash?.cardactiveuntil || dash?.prepaidinfo?.cardactiveuntil || '-';
      const impoin = Number(dash?.impoinDetails?.totalPoints || dash?.impoints?.value || 0);

      return {
        success: true,
        phone: this.session.phone || this.session.msisdn,
        provider: 'INDOSAT',
        name: fullName,
        balance: balanceNum,
        balanceFormatted: `Rp ${balanceNum.toLocaleString('id-ID')}`,
        activeUntil,
        loyaltyPoints: {
          name: 'IMPoin',
          points: impoin,
          tier: prof?.segment || 'Regular'
        },
        raw: { dash, prof }
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session.phone,
        provider: 'INDOSAT',
        message: e.message || 'Failed to fetch myIM3 profile'
      };
    }
  }

  public async getQuota(): Promise<QuotaResult> {
    if (!this.session?.authToken || this.session.userType === 'GUEST') {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'INDOSAT',
        items: [],
        message: 'No authenticated myIM3 subscriber session. Please login first.'
      };
    }

    try {
      const dashRes = await this.request('/dashboard/get/v4', {});
      const dash = dashRes.body?.data;
      const packages = dash?.packdata?.packageslist || dash?.packageslist || [];

      const items: QuotaItem[] = (Array.isArray(packages) ? packages : []).map((p: any) => ({
        name: p.packagename || p.name || 'Freedom Internet',
        type: 'MAIN',
        remainingFormatted: p.total_quota || p.quota || '0 GB',
        validUntil: p.expireddate || p.activeuntil || '-'
      }));

      return {
        success: true,
        phone: this.session.phone || this.session.msisdn,
        provider: 'INDOSAT',
        totalRemainingFormatted: items.map(i => `${i.name}: ${i.remainingFormatted}`).join(', ') || '0 GB',
        items,
        raw: dash
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session.phone,
        provider: 'INDOSAT',
        items: [],
        message: e.message || 'Failed to fetch myIM3 quota'
      };
    }
  }

  public async getPackages(keyword?: string, category?: string): Promise<PackageListResult> {
    try {
      if (!this.session?.authToken) await this.initGuest();

      if (keyword) {
        const searchRes = await this.request('/package/search/v1', {
          keyword: keyword.trim(),
          page: 1,
          limit: 25
        });

        const list = searchRes.body?.data?.packages || searchRes.body?.data || [];
        const packages: PackageItem[] = (Array.isArray(list) ? list : []).map((p: any) => ({
          id: p.pvr_code || p.product_id || p.offerid || p.id,
          name: p.package_name || p.name || p.title,
          price: Number(p.tariff || p.price || 0),
          priceFormatted: `Rp ${Number(p.tariff || p.price || 0).toLocaleString('id-ID')}`,
          quotaFormatted: p.quota || p.total_quota,
          validityFormatted: p.validity ? `${p.validity} Hari` : undefined,
          description: p.description,
          category: 'Search Freedom'
        }));

        return {
          success: true,
          provider: 'INDOSAT',
          packages,
          raw: searchRes.body
        };
      }

      const modRes = await this.request('/pages/getmodules', { name: 'myim3-home' });
      const modules = modRes.body?.data || [];
      const packages: PackageItem[] = [];

      modules.forEach((m: any) => {
        if (Array.isArray(m.packages)) {
          m.packages.forEach((p: any) => {
            packages.push({
              id: p.pvr_code || p.product_id || p.offerid || p.id,
              name: p.package_name || p.name,
              price: Number(p.tariff || p.price || 0),
              priceFormatted: `Rp ${Number(p.tariff || p.price || 0).toLocaleString('id-ID')}`,
              quotaFormatted: p.quota || p.total_quota,
              validityFormatted: p.validity ? `${p.validity} Hari` : undefined,
              category: m.title || m.name
            });
          });
        }
      });

      return {
        success: true,
        provider: 'INDOSAT',
        packages,
        raw: modules
      };
    } catch (e: any) {
      return {
        success: false,
        provider: 'INDOSAT',
        packages: [],
        message: e.message || 'Failed to fetch myIM3 packages'
      };
    }
  }

  public async buyPackage(packageId: string, paymentMethod = 'PULSA'): Promise<PurchaseResult> {
    if (!this.session?.authToken || this.session.userType === 'GUEST') {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: 'myIM3 package purchase requires an authenticated subscriber session.'
      };
    }

    try {
      const orderRes = await this.request('/order/v2/create', {
        product_id: packageId,
        msisdn: this.session.msisdn,
        payment_method: paymentMethod.toUpperCase()
      });

      if (orderRes.body?.status !== '0') {
        return {
          success: false,
          paymentMethod,
          status: 'FAILED',
          message: orderRes.body?.message || 'Failed to create myIM3 order'
        };
      }

      const data = orderRes.body.data;
      const isSuccess = paymentMethod.toUpperCase() === 'PULSA';

      return {
        success: true,
        transactionId: data?.transid,
        paymentMethod,
        status: isSuccess ? 'SUCCESS' : 'PENDING',
        qrisData: data?.qr_string || data?.qr_code,
        checkoutUrl: data?.payment_url,
        amount: Number(data?.total_amount || data?.amount || 0),
        amountFormatted: `Rp ${Number(data?.total_amount || data?.amount || 0).toLocaleString('id-ID')}`,
        message: isSuccess ? 'Paket Freedom myIM3 berhasil dibeli!' : 'Order dibuat. Silakan bayar.',
        raw: data
      };
    } catch (e: any) {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error purchasing myIM3 package'
      };
    }
  }

  public async topupPulsa(amount: number, paymentMethod = 'QRIS'): Promise<TopupResult> {
    try {
      if (!this.session?.authToken) await this.initGuest();

      const reloadRes = await this.request('/reload/order/v1', {
        msisdn: this.session?.msisdn || '',
        amount,
        payment_method: paymentMethod.toUpperCase()
      });

      if (reloadRes.body?.status !== '0') {
        return {
          success: false,
          amount,
          paymentMethod,
          status: 'FAILED',
          message: reloadRes.body?.message || 'Failed to create IM3 reload order'
        };
      }

      const data = reloadRes.body.data;
      return {
        success: true,
        transactionId: data?.transid,
        amount,
        paymentMethod,
        status: 'PENDING',
        qrisData: data?.qr_string,
        checkoutUrl: data?.payment_url,
        message: `Isi ulang pulsa myIM3 Rp ${amount.toLocaleString('id-ID')} dibuat.`,
        raw: data
      };
    } catch (e: any) {
      return {
        success: false,
        amount,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error topping up myIM3 pulsa'
      };
    }
  }
}
