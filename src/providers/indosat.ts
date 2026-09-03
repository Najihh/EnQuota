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
      const balanceNum = dash?.prepaidinfo?.balance != null ? Number(dash.prepaidinfo.balance) : (dash?.packdata?.lastbalance != null ? Number(dash.packdata.lastbalance) : 0);
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
          tier: prof?.currenttier || prof?.segment || 'Regular'
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

      const items: QuotaItem[] = [];
      if (Array.isArray(packages)) {
        packages.forEach((pkg: any) => {
          if (Array.isArray(pkg.Quotas)) {
            pkg.Quotas.forEach((q: any) => {
              if (q.benefitType === 'DATA' || q.benefitType === 'INTERNET' || q.quotaUnit === 'MB' || q.quotaUnit === 'GB') {
                items.push({
                  name: q.name || q.description || pkg.ServiceName || 'Paket Internet',
                  type: 'MAIN',
                  remainingFormatted: q.remainingQuota ? `${q.remainingQuota} ${q.quotaUnit || 'MB'}` : (q.rawRemainingQuota ? `${q.rawRemainingQuota} MB` : '0 MB'),
                  validUntil: pkg.EndDate || '-'
                });
              }
            });
          }
        });
      }

      if (items.length === 0) {
        items.push({
          name: 'Freedom Internet',
          type: 'MAIN',
          remainingFormatted: '0 GB (Habis)',
          validUntil: dash?.prepaidinfo?.cardactiveuntil || '-'
        });
      }

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

      const packages: PackageItem[] = [];
      const seenPvr = new Set<string>();

      // 1. Fetch Personalized CVM Promos (Hanya Untukmu) if logged in
      if (this.session?.userType === 'SUBSCRIBER') {
        try {
          const promoRes = await this.request('/personalization/packs', {});
          const promoList = promoRes.body?.data?.commercial_package || [];
          if (Array.isArray(promoList)) {
            promoList.forEach((p: any) => {
              const pvr = p.pvr_code || p.package_id || p.id;
              if (pvr && !seenPvr.has(pvr)) {
                seenPvr.add(pvr);
                const price = Number(p.tariff != null ? p.tariff : (p.original_tariff || p.price || 0));
                packages.push({
                  id: pvr,
                  name: p.package_name || p.name,
                  price,
                  priceFormatted: `Rp ${price.toLocaleString('id-ID')}`,
                  quotaFormatted: p.commercial_attribute?.total_data_quota || p.commercial_attribute?.short_benefit || p.package_subtitle || p.quota,
                  validityFormatted: p.validity ? `${p.validity} Hari` : (p.commercial_attribute?.validity ? `${p.commercial_attribute.validity} Hari` : undefined),
                  description: p.commercial_attribute?.description || p.description,
                  category: 'Hanya Untukmu (Spesial CVM)',
                  isPromo: true
                });
              }
            });
          }
        } catch {}
      }

      // 2. Search Store Packages
      const term = (keyword || 'freedom').trim();
      const searchRes = await this.request('/packages/search', {
        SEARCH_TERM: term,
        servicename: 'GET PACKAGE'
      });

      const cats = searchRes.body?.data?.commercial_package_category || [];
      cats.forEach((c: any) => {
        if (Array.isArray(c.commercial_package)) {
          c.commercial_package.forEach((p: any) => {
            const pvr = p.pvr_code || p.package_id || p.id;
            if (pvr && !seenPvr.has(pvr)) {
              seenPvr.add(pvr);
              const price = Number(p.tariff != null ? p.tariff : (p.original_tariff || 0));
              packages.push({
                id: pvr,
                name: p.package_name || p.name,
                price,
                priceFormatted: `Rp ${price.toLocaleString('id-ID')}`,
                quotaFormatted: p.commercial_attribute?.short_benefit || p.commercial_attribute?.benefit_type || p.benefit,
                validityFormatted: p.validity ? `${p.validity} Hari` : undefined,
                description: p.commercial_attribute?.description || p.description,
                category: c.category_name || c.category || 'Freedom'
              });
            }
          });
        }
      });

      return {
        success: true,
        provider: 'INDOSAT',
        packages,
        raw: searchRes.body
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
      const isBalance = paymentMethod.toUpperCase() === 'PULSA' || paymentMethod.toUpperCase() === 'BALANCE';
      
      if (isBalance) {
        const activatePayload = {
          transtype: 'package',
          operationtype: 'buy',
          paymentchannel: 'BALANCE',
          offerid: packageId,
          tomsisdn: this.session.msisdn,
          type: 'BALANCE',
          balancereceive: '0'
        };

        const res = await this.request('/packages/activate', activatePayload);
        if (res.body?.status === '0') {
          return {
            success: true,
            transactionId: res.body?.transid,
            paymentMethod: 'PULSA',
            status: 'SUCCESS',
            message: 'Pembelian paket berhasil menggunakan pulsa!',
            raw: res.body
          };
        }

        return {
          success: false,
          paymentMethod: 'PULSA',
          status: 'FAILED',
          message: res.body?.data?.protip || res.body?.message || 'Gagal memotong pulsa utama. Pastikan saldo pulsa mencukupi.',
          raw: res.body
        };
      }

      // QRIS / E-Wallet
      const payload = {
        transtype: 'package',
        operationtype: 'buy',
        paymentchannel: paymentMethod.toUpperCase(),
        offerid: packageId,
        tomsisdn: this.session.msisdn,
        type: paymentMethod.toUpperCase() === 'QRIS' ? 'QRIS' : 'WALLET',
        balancereceive: '0'
      };

      const res = await this.request('/payment/payment', payload);
      const data = res.body?.data?.SendPaymentResp || res.body?.data;

      if (res.body?.status === '0' && data) {
        return {
          success: true,
          transactionId: data.uniqueTransactionCode || res.body.transid,
          paymentMethod,
          status: 'PENDING',
          qrisData: data.actionData,
          amount: Number(data.amount || 0),
          amountFormatted: `Rp ${Number(data.amount || 0).toLocaleString('id-ID')}`,
          message: 'Order pembayaran QRIS berhasil dibuat!',
          raw: data
        };
      }

      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: res.body?.message || 'Metode pembayaran tidak didukung untuk paket ini (Paket ini memerlukan pulsa utama).',
        raw: res.body
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

      const denomMap: Record<number, string> = {
        10000: '14',
        13000: '16',
        16000: '17',
        21000: '18',
        25000: '2',
        26000: '2',
        30000: '19',
        31000: '19',
        36000: '28',
        40500: '20',
        50000: '4',
        100000: '5'
      };

      const offerid = denomMap[amount] || '4'; // default to 50k denom id
      const payload = {
        transtype: 'reload',
        operationtype: 'buy',
        paymentchannel: paymentMethod.toUpperCase(),
        offerid,
        keyword: '',
        shortcode: '',
        tomsisdn: this.session?.msisdn || '',
        normalprice: String(amount),
        discountprice: '0',
        packagename: String(amount),
        name: '',
        transid: '',
        walletmsisdn: '',
        type: paymentMethod.toUpperCase() === 'QRIS' ? 'QRIS' : 'WALLET',
        balancereceive: '0'
      };

      const res = await this.request('/payment/payment', payload);
      const pData = res.body?.data?.SendPaymentResp || res.body?.data;

      if (res.body?.status === '0' && pData) {
        return {
          success: true,
          transactionId: pData.uniqueTransactionCode || res.body.transid,
          amount: Number(pData.amount || amount),
          paymentMethod,
          status: 'PENDING',
          qrisData: pData.actionData,
          message: `QRIS Isi Ulang Pulsa Rp ${amount.toLocaleString('id-ID')} berhasil dibuat!`,
          raw: pData
        };
      }

      return {
        success: false,
        amount,
        paymentMethod,
        status: 'FAILED',
        message: res.body?.message || 'Gagal membuat QRIS isi ulang pulsa',
        raw: res.body
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
