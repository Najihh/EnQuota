/**
 * EnQuota - Telkomsel Provider Driver
 * Bridges Telkomsel operations with the core Telbot engine
 */

import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import { TelcoProvider, LoginResult, OtpResult, ProfileResult, QuotaResult, PackageListResult, PurchaseResult, TopupResult, PackageItem, QuotaItem } from './base.js';
import { SupportedProvider, normalizePhone } from '../detector.js';
import { TelcoSession } from '../session.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class TelkomselProvider extends TelcoProvider {
  readonly provider: SupportedProvider = 'TELKOMSEL';
  readonly name = 'Telkomsel';
  readonly brand = 'MyTelkomsel / SimPATI';

  private telbotBinPath: string;
  private process: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();

  constructor(session?: TelcoSession | null, customBin?: string) {
    super(session);
    this.telbotBinPath = customBin || this.findTelbotBin();
  }

  private findTelbotBin(): string {
    const candidates = [
      path.join(os.homedir(), '.local', 'bin', 'telbot'),
      '/usr/local/bin/telbot',
      '/usr/bin/telbot',
      'telbot'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'telbot';
  }

  private async ensureProcess(): Promise<void> {
    if (this.process && !this.process.killed) return;

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.telbotBinPath, ['--mcp'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        if (!this.process.stdout || !this.process.stdin) {
          throw new Error('Failed to open stdio for telbot binary');
        }

        this.rl = readline.createInterface({ input: this.process.stdout });

        this.rl.on('line', (line) => {
          try {
            const msg = JSON.parse(line);
            if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
              const { resolve, reject } = this.pendingRequests.get(msg.id)!;
              this.pendingRequests.delete(msg.id);
              if (msg.error) {
                reject(new Error(msg.error.message || JSON.stringify(msg.error)));
              } else {
                resolve(msg.result);
              }
            }
          } catch {
            // Non-JSON log line, ignore
          }
        });

        this.process.on('error', (err) => {
          this.process = null;
          reject(err);
        });

        this.process.on('exit', () => {
          this.process = null;
        });

        // Initialize MCP handshake
        this.callRpc('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'enquota-telco', version: '1.0.0' }
        }).then(() => {
          resolve();
        }).catch(reject);

      } catch (err) {
        reject(err);
      }
    });
  }

  private async callRpc(method: string, params: any = {}): Promise<any> {
    await this.ensureProcess();
    const id = ++this.requestId;

    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(payload) + '\n');
    });
  }

  public async callMcpTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    try {
      const result = await this.callRpc('tools/call', {
        name: toolName,
        arguments: args
      });

      if (result?.content && Array.isArray(result.content)) {
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (textContent) {
          try {
            return JSON.parse(textContent.text);
          } catch {
            return textContent.text;
          }
        }
      }
      return result;
    } catch (e: any) {
      throw new Error(`Telbot Tool (${toolName}) Error: ${e.message}`);
    }
  }

  public async login(phone: string): Promise<LoginResult> {
    const norm = normalizePhone(phone);
    if (!norm.isValid) {
      return { success: false, message: `Invalid Telkomsel number: ${phone}`, requireOtp: false };
    }

    try {
      // Local number for telbot e.g. 812xxxxxxxx
      const localPhone = norm.clean;
      const res = await this.callMcpTool('login', { phone: localPhone });

      const msg = typeof res === 'string' ? res : (res?.message || JSON.stringify(res));
      return {
        success: true,
        message: msg || `Telkomsel login initiated for ${norm.national}. Please enter the OTP sent to your phone.`,
        requireOtp: true,
        extra: { phone: norm.national, msisdn: norm.international }
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Error triggering Telkomsel login',
        requireOtp: false
      };
    }
  }

  public async submitOtp(otp: string, transId?: string, phone?: string): Promise<OtpResult> {
    try {
      const res = await this.callMcpTool('submit_otp', { otp: otp.trim() });
      const norm = phone ? normalizePhone(phone) : (this.session ? normalizePhone(this.session.phone) : { international: '', national: '' });

      const newSession: TelcoSession = {
        phone: norm.national || this.session?.phone || '',
        msisdn: norm.international || this.session?.msisdn || '',
        provider: 'TELKOMSEL',
        brand: 'Telkomsel',
        authToken: 'active_telbot_session',
        userType: 'SUBSCRIBER',
        updatedAt: new Date().toISOString()
      };
      this.session = newSession;

      return {
        success: true,
        message: typeof res === 'string' ? res : (res?.message || 'Telkomsel OTP validated successfully!'),
        session: newSession,
        data: res
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Telkomsel OTP validation failed'
      };
    }
  }

  public async getProfile(): Promise<ProfileResult> {
    try {
      const res = await this.callMcpTool('get_profile');
      const data = typeof res === 'object' ? res : {};

      const name = data.name || data.Name || 'Telkomsel Subscriber';
      const balanceStr = data.balance || data.Balance || '0';
      const balanceNum = typeof balanceStr === 'number' ? balanceStr : Number(balanceStr.replace(/[^0-9]/g, '')) || 0;
      const points = data.points || data.loyalty_points || data.LoyaltyPoints || '0';

      return {
        success: true,
        phone: this.session?.phone || data.phone || '',
        provider: 'TELKOMSEL',
        name,
        balance: balanceNum,
        balanceFormatted: `Rp ${balanceNum.toLocaleString('id-ID')}`,
        activeUntil: data.active_until || data.BalanceExpiry || '-',
        loyaltyPoints: {
          name: 'Telkomsel Poin',
          points: Number(points) || 0,
          tier: data.tier || data.LoyaltyTier || 'Member'
        },
        raw: res
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'TELKOMSEL',
        message: e.message || 'Failed to fetch Telkomsel profile'
      };
    }
  }

  public async getQuota(): Promise<QuotaResult> {
    try {
      const res = await this.callMcpTool('get_quota');
      const items: QuotaItem[] = [];

      if (typeof res === 'object' && res !== null) {
        if (Array.isArray(res.groups || res.Groups)) {
          const groups = res.groups || res.Groups;
          for (const g of groups) {
            for (const it of (g.items || g.Items || [])) {
              items.push({
                name: it.name || it.Name || g.class || 'Internet Quota',
                type: 'MAIN',
                remainingFormatted: it.remaining || it.Remaining || `${it.remaining_value || 0} MB`,
                validUntil: it.expiry || it.Expiry || '-'
              });
            }
          }
        }
      }

      return {
        success: true,
        phone: this.session?.phone || '',
        provider: 'TELKOMSEL',
        totalRemainingFormatted: items.map(i => `${i.name}: ${i.remainingFormatted}`).join(', ') || 'Active Quota',
        items,
        raw: res
      };
    } catch (e: any) {
      return {
        success: false,
        phone: this.session?.phone || '',
        provider: 'TELKOMSEL',
        items: [],
        message: e.message || 'Failed to fetch Telkomsel quota'
      };
    }
  }

  public async getPackages(keyword?: string, category?: string): Promise<PackageListResult> {
    try {
      const res = await this.callMcpTool('get_recommended_offers');
      const list = Array.isArray(res) ? res : (res?.offers || res?.data || []);

      let packages: PackageItem[] = list.map((p: any) => ({
        id: p.offer_id || p.id || p.code,
        name: p.name || p.title || 'Paket Telkomsel',
        price: Number(p.price || 0),
        priceFormatted: `Rp ${Number(p.price || 0).toLocaleString('id-ID')}`,
        quotaFormatted: p.quota || p.data_allowance || p.description,
        validityFormatted: p.validity ? `${p.validity} Hari` : undefined,
        description: p.description,
        category: p.category || 'Recommended'
      }));

      if (keyword) {
        const kw = keyword.toLowerCase();
        packages = packages.filter(p => p.name.toLowerCase().includes(kw) || (p.description && p.description.toLowerCase().includes(kw)));
      }

      return {
        success: true,
        provider: 'TELKOMSEL',
        packages,
        raw: res
      };
    } catch (e: any) {
      return {
        success: false,
        provider: 'TELKOMSEL',
        packages: [],
        message: e.message || 'Failed to fetch Telkomsel packages'
      };
    }
  }

  public async buyPackage(packageId: string, paymentMethod = 'pulsa'): Promise<PurchaseResult> {
    try {
      const res = await this.callMcpTool('buy_package', {
        offer_id: packageId,
        payment_method: paymentMethod.toLowerCase()
      });

      return {
        success: true,
        paymentMethod,
        status: paymentMethod.toLowerCase() === 'pulsa' ? 'SUCCESS' : 'PENDING',
        message: typeof res === 'string' ? res : (res?.message || 'Telkomsel package purchase request sent!'),
        raw: res
      };
    } catch (e: any) {
      return {
        success: false,
        paymentMethod,
        status: 'FAILED',
        message: e.message || 'Error purchasing Telkomsel package'
      };
    }
  }

  public async topupPulsa(amount: number, paymentMethod = 'QRIS'): Promise<TopupResult> {
    return {
      success: false,
      amount,
      paymentMethod,
      status: 'FAILED',
      message: 'Telkomsel top-up requires MyTelkomsel payment link or direct banking channel.'
    };
  }
}
