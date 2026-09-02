/**
 * EnQuota - Base Provider Interface
 */

import { SupportedProvider } from '../detector.js';
import { TelcoSession } from '../session.js';

export interface LoginResult {
  success: boolean;
  message: string;
  transId?: string;
  requireOtp: boolean;
  extra?: Record<string, any>;
}

export interface OtpResult {
  success: boolean;
  message: string;
  session?: TelcoSession;
  data?: any;
}

export interface ProfileResult {
  success: boolean;
  phone: string;
  provider: SupportedProvider;
  name?: string;
  balance?: number;
  balanceFormatted?: string;
  activeUntil?: string;
  loyaltyPoints?: {
    name: string; // 'BonsTri', 'IMPoin', 'Telkomsel Poin', 'uCoin'
    points: number;
    tier?: string;
    expiresAt?: string;
  };
  raw?: any;
  message?: string;
}

export interface QuotaItem {
  name: string;
  type: string;        // 'MAIN' | 'APP' | 'LOCAL' | 'NIGHT' | 'CALL' | 'SMS'
  remainingBytes?: number;
  remainingMb?: number;
  remainingGb?: number;
  totalBytes?: number;
  totalFormatted?: string;
  remainingFormatted: string;
  validUntil?: string;
}

export interface QuotaResult {
  success: boolean;
  phone: string;
  provider: SupportedProvider;
  totalRemainingFormatted?: string;
  items: QuotaItem[];
  raw?: any;
  message?: string;
}

export interface PackageItem {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  quotaFormatted?: string;
  validityFormatted?: string;
  description?: string;
  category?: string;
  isPromo?: boolean;
}

export interface PackageListResult {
  success: boolean;
  provider: SupportedProvider;
  packages: PackageItem[];
  categories?: string[];
  raw?: any;
  message?: string;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  paymentMethod: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  qrisData?: string;     // QR Code raw string or URL / image path
  qrisBase64?: string;
  checkoutUrl?: string;
  amount?: number;
  amountFormatted?: string;
  message: string;
  raw?: any;
}

export interface TopupResult {
  success: boolean;
  transactionId?: string;
  amount: number;
  paymentMethod: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  qrisData?: string;
  checkoutUrl?: string;
  message: string;
  raw?: any;
}

export abstract class TelcoProvider {
  abstract readonly provider: SupportedProvider;
  abstract readonly name: string;
  abstract readonly brand: string;

  protected session: TelcoSession | null = null;

  constructor(session?: TelcoSession | null) {
    if (session) {
      this.session = session;
    }
  }

  public setSession(session: TelcoSession | null): void {
    this.session = session;
  }

  public getSession(): TelcoSession | null {
    return this.session;
  }

  abstract login(phone: string): Promise<LoginResult>;
  abstract submitOtp(otp: string, transId?: string, phone?: string): Promise<OtpResult>;
  abstract getProfile(): Promise<ProfileResult>;
  abstract getQuota(): Promise<QuotaResult>;
  abstract getPackages(keyword?: string, category?: string): Promise<PackageListResult>;
  abstract buyPackage(packageId: string, paymentMethod: string): Promise<PurchaseResult>;
  abstract topupPulsa(amount: number, paymentMethod: string): Promise<TopupResult>;
}
