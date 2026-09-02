/**
 * EnQuota - Tri (bima+) Provider Driver
 * Reverse-engineered for Tri Indonesia (IOH)
 */

import crypto from 'crypto';
import https from 'https';
import { TelcoProvider, LoginResult, OtpResult, ProfileResult, QuotaResult, PackageListResult, PurchaseResult, TopupResult, PackageItem, QuotaItem } from './base.js';
import { SupportedProvider, normalizePhone } from '../detector.js';
import { TelcoSession } from '../session.js';

export class TriProvider extends TelcoProvider {
  readonly provider: SupportedProvider = 'TRI';
  readonly name = 'Tri Indonesia';
  readonly brand = 'bima+';

  private baseUrl = 'https://bimaplus-api.ioh.co.id/api/v2';
  private appVersion = '5.2.0';
  private channel = 'PORTAL';
  private language = 'ID';
  private os = 'BROWSER';
  private deviceId = '56826f1045584651bc499d268febea91';
  private deviceName = 'EnQuota Terminal (Linux)';
  private serviceKey = 'FPi7ZP3Jy8Uv3KBd4QeG';
  private hdrAuthorization = '642d1cc69d90666962726e';
  private cookies = 'TS01503f77=01334ce802d3fdb350e5f70de0216dd87e89b5b0b42039fa21a80610a6e9f41e405fae3d8d67f4e517f73cf985e5160a259dbf777e; BUI=56826f10-4558-4651-bc49-9d268febea91';

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
    const now = new Date();
    const uid = this.formatDate(now) + String(Math.floor(100 + Math.random() * 900));
    const tokenId = this.session?.authToken || (Date.now().toString() + '1');

    const oddToken = this.getOddPositionCharacters(tokenId);
    const imiOauth = this.sha512(`REQBODY=${bodyStr}&SALT=${oddToken}`);

    const hashParams = this.getHeaderHashParams('parent', this.os, this.appVersion, tokenId);
    const oddUid = this.getOddPositionCharacters(uid);
    const imiHash = this.sha512(`${hashParams}&SALT=${oddUid}`);

    return {
      'Host': 'bimaplus-api.ioh.co.id',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
      'Content-Type': 'application/json',
      'Origin': 'https://bimatri.ioh.co.id',
      'Referer': 'https://bimatri.ioh.co.id/',
      'Authorization': this.hdrAuthorization,
      'X-IMI-App-OS': this.os,
      'X-IMI-APPVERSION': this.appVersion,
      'X-IMI-CHANNEL': this.channel,
      'X-IMI-LANGUAGE': this.language,
      'x-imi-oauth': imiOauth,
      'X-IMI-HASH': imiHash,
      'X-IMI-TOKENID': tokenId,
      'X-IMI-VERSION': this.appVersion,
      'X-DEVICEID': this.deviceId,
      'X-DEVICENAME': this.deviceName,
      'X-IMI-SERVICEKEY': this.serviceKey,
      'X-IMI-UID': uid,
      'Cookie': this.cookies
    };
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
          provider: 'TRI',
          brand: 'bima+',
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
    throw new Error(`Failed to initialize guest: ${JSON.stringify(res.body)}`);
  }

  public async login(phone: string): Promise<LoginResult> {
    const norm = normalizePhone(phone);
    if (!norm.isValid) {
      return { success: false, message: `Invalid phone number format: ${phone}`, requireOtp: false };
    }

    try {
      if (!this.session?.authToken) {
        await this.initGuest();
      }

      const sendRes = await this.request('/otp/send/v1', {
        msisdn: norm.international,
        action: 'register'
      });

      if (!sendRes.body || sendRes.body.status !== '0') {
        return {
          success: false,
          message: sendRes.body?.message || `Failed to send OTP (${sendRes.statusCode})`,
          requireOtp: false
        };
      }

      const transId = sendRes.body.transid || sendRes.body.data?.transid;
      return {
        success: true,
        message: `OTP sent successfully via SMS to ${norm.international}`,
        transId,
        requireOtp: true,
        extra: { msisdn: norm.international }
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error requesting Tri OTP', requireOtp: false };
    }
  }

  public async submitOtp(otp: string, transId?: string, phone?: string): Promise<OtpResult> {
    try {
      const valRes = await this.request('/otp/validate/v1', {
        transid: transId || '',
        otp: otp.trim()
      });

      if (valRes.body && valRes.body.status === '0' && valRes.body.data) {
        const token = valRes.body.data.tokenid || valRes.body.data.token;
        const norm = phone ? normalizePhone(phone) : (this.session ? normalizePhone(this.session.phone) : { international: '', national: '' });
        
        const newSession: TelcoSession = {
          phone: norm.national || this.session?.phone || '',
          msisdn: norm.international || this.session?.msisdn || '',
          provider: 'TRI',
          brand: 'bima+',
          authToken: token,
          userType: 'SUBSCRIBER',
          deviceId: this.deviceId,
          cookies: this.cookies,
          updatedAt: new Date().toISOString()
        };
        this.session = newSession;

        return {
          success: true,
          message: `Login successful for Tri (${norm.national || norm.international})`,
          session: newSession,
          data: valRes.body.data
        };
      }

      return {
        success: false,
        message: valRes.body?.message || 'OTP validation failed'
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error validating Tri OTP' };
    }
  }

  public async getProfile(): Promise<ProfileResult> {
    if (!this.session?.authToken || this.session.userType === 'GUEST') {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'TRI',
        message: 'No authenticated Tri subscriber session. Please login first.'
      };
    }

    try {
      const [dashRes, profRes] = await Promise.all([
        this.request('/dashboard/get/v4', {}),
        this.request('/profile/get', {})
      ]);

      const dash = dashRes.body?.data;
      const prof = profRes.body?.data;

      const fullName = [prof?.fname, prof?.lname].filter(Boolean).join(' ') || prof?.uname || prof?.name || 'Tri Subscriber';
      const balanceNum = dash?.prepaidinfo?.balance != null ? Number(dash.prepaidinfo.balance) : (dash?.packdata?.lastbalance != null ? Number(dash.packdata.lastbalance) : 0);
      const activeUntil = dash?.prepaidinfo?.cardactiveuntil || dash?.packdata?.expireddate || '-';
      const bonstri = Number(dash?.bonstriDetails?.totalPoints ?? (dash?.impoints?.value ?? 0));

      return {
        success: true,
        phone: this.session.phone || this.session.msisdn,
        provider: 'TRI',
        name: fullName,
        balance: balanceNum,
        balanceFormatted: `Rp ${balanceNum.toLocaleString('id-ID')}`,
        activeUntil,
        loyaltyPoints: {
          name: 'BonsTri',
          points: bonstri,
          tier: dash?.bonstriDetails?.tierName || 'Classic'
        },
        raw: { dash, prof }
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session.phone,
        provider: 'TRI',
        message: e.message || 'Failed to fetch Tri profile'
      };
    }
  }

  public async getQuota(): Promise<QuotaResult> {
    if (!this.session?.authToken || this.session.userType === 'GUEST') {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'TRI',
        items: [],
        message: 'No authenticated Tri subscriber session. Please login first.'
      };
    }

    try {
      const dashRes = await this.request('/dashboard/get/v4', {});
      const dash = dashRes.body?.data;
      const packages = dash?.packdata?.packageslist || [];

      const items: QuotaItem[] = packages.map((p: any) => ({
        name: p.packagename || p.name || 'Paket Internet',
        type: 'MAIN',
        remainingFormatted: p.total_quota || p.quota || '0 GB',
        validUntil: p.expireddate || p.activeuntil || '-'
      }));

      return {
        success: true,
        phone: this.session.phone || this.session.msisdn,
        provider: 'TRI',
        totalRemainingFormatted: items.map(i => `${i.name}: ${i.remainingFormatted}`).join(', ') || '0 GB',
        items,
        raw: dash
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session.phone,
        provider: 'TRI',
        items: [],
        message: e.message || 'Failed to fetch Tri quota'
      };
    }
  }

  public async getPackages(keyword?: string, category?: string): Promise<PackageListResult> {
    try {
      if (!this.session?.authToken) {
        await this.initGuest();
      }

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
          quotaFormatted: p.quota || p.total_quota || p.benefit,
          validityFormatted: p.validity ? `${p.validity} Hari` : undefined,
          description: p.description,
          category: p.category_name || 'Search'
        }));

        return {
          success: true,
          provider: 'TRI',
          packages,
          raw: searchRes.body
        };
      }

      const catRes = await this.request('/appinit/all/categories', {});
      const catData = catRes.body?.data?.id?.['1'] || [];
      const categories = catData.map((c: any) => c.title);

      const modRes = await this.request('/pages/getmodules', { name: 'bima-home' });
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
        provider: 'TRI',
        packages,
        categories,
        raw: { catData, modules }
      };
    } catch (e: any) {
      return {
        success: false,
        provider: 'TRI',
        packages: [],
        message: e.message || 'Failed to fetch Tri packages'
      };
    }
  }

  public async buyPackage(packageId: string, paymentMethod = 'PULSA'): Promise<PurchaseResult> {
    if (!this.session?.authToken || this.session.userType === 'GUEST') {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: 'Tri package purchase requires an authenticated subscriber session.'
      };
    }

    try {
      const orderRes = await this.request('/order/v2/create', {
        product_id: packageId,
        msisdn: this.session.msisdn,
        payment_method: paymentMethod.toUpperCase()
      });

      if (!orderRes.body || orderRes.body.status !== '0') {
        return {
          success: false,
          paymentMethod,
          status: 'FAILED',
          message: orderRes.body?.message || 'Failed to create Tri order'
        };
      }

      const data = orderRes.body.data;
      const isSuccess = paymentMethod.toUpperCase() === 'PULSA';

      return {
        success: true,
        transactionId: data?.transid || data?.order_id,
        paymentMethod,
        status: isSuccess ? 'SUCCESS' : 'PENDING',
        qrisData: data?.qr_string || data?.qr_code,
        checkoutUrl: data?.payment_url || data?.redirect_url,
        amount: Number(data?.total_amount || data?.amount || 0),
        amountFormatted: `Rp ${Number(data?.total_amount || data?.amount || 0).toLocaleString('id-ID')}`,
        message: isSuccess ? 'Paket Tri berhasil dibeli menggunakan pulsa!' : 'Order dibuat. Silakan selesaikan pembayaran.',
        raw: data
      };
    } catch (e: any) {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error purchasing Tri package'
      };
    }
  }

  public async topupPulsa(amount: number, paymentMethod = 'QRIS'): Promise<TopupResult> {
    try {
      if (!this.session?.authToken) await this.initGuest();

      const reloadRes = await this.request('/reload/order/v1', {
        msisdn: this.session?.msisdn || '',
        amount: amount,
        payment_method: paymentMethod.toUpperCase()
      });

      if (!reloadRes.body || reloadRes.body.status !== '0') {
        return {
          success: false,
          amount,
          paymentMethod,
          status: 'FAILED',
          message: reloadRes.body?.message || 'Failed to create reload order'
        };
      }

      const data = reloadRes.body.data;
      return {
        success: true,
        transactionId: data?.transid,
        amount,
        paymentMethod,
        status: 'PENDING',
        qrisData: data?.qr_string || data?.qr_code,
        checkoutUrl: data?.payment_url,
        message: `Isi ulang pulsa Tri Rp ${amount.toLocaleString('id-ID')} dibuat.`,
        raw: data
      };
    } catch (e: any) {
      return {
        success: false,
        amount,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error topping up Tri pulsa'
      };
    }
  }
}
