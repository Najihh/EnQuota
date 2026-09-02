/**
 * EnQuota - Multi-Account & Multi-ISP Session Store
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { SupportedProvider } from './detector.js';

export interface TelcoSession {
  phone: string;              // National e.g. 089612345678 or International 6289612345678
  msisdn: string;             // Normalized 628xxxxxxxx
  provider: SupportedProvider;
  brand: string;
  authToken?: string;
  userType?: string;          // 'SUBSCRIBER' | 'GUEST'
  deviceId?: string;
  cookies?: string;
  extra?: Record<string, any>; // Provider-specific tokens / keys
  updatedAt: string;
}

export interface SessionStoreData {
  activePhone?: string;
  sessions: Record<string, TelcoSession>; // Keyed by normalized msisdn (628...)
}

export class SessionManager {
  private dirPath: string;
  private filePath: string;

  constructor(customDir?: string) {
    this.dirPath = customDir || path.join(os.homedir(), '.enquota');
    this.filePath = path.join(this.dirPath, 'sessions.json');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }
  }

  public readStore(): SessionStoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch {
      // Fallback on parse error
    }
    return { sessions: {} };
  }

  public writeStore(data: SessionStoreData): void {
    this.ensureDirectory();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  public saveSession(session: TelcoSession, setActive = true): void {
    const store = this.readStore();
    const key = session.msisdn;
    store.sessions[key] = {
      ...session,
      updatedAt: new Date().toISOString()
    };
    if (setActive || !store.activePhone) {
      store.activePhone = key;
    }
    this.writeStore(store);
  }

  public getSession(phoneOrMsisdn?: string): TelcoSession | null {
    const store = this.readStore();
    if (phoneOrMsisdn) {
      const clean = phoneOrMsisdn.replace(/[^0-9]/g, '');
      const msisdn = clean.startsWith('0') ? '62' + clean.substring(1) : (clean.startsWith('62') ? clean : '62' + clean);
      return store.sessions[msisdn] || null;
    }

    // Default to active phone or first session available
    if (store.activePhone && store.sessions[store.activePhone]) {
      return store.sessions[store.activePhone];
    }

    const keys = Object.keys(store.sessions);
    if (keys.length > 0) {
      return store.sessions[keys[0]];
    }

    return null;
  }

  public listSessions(): TelcoSession[] {
    const store = this.readStore();
    return Object.values(store.sessions);
  }

  public removeSession(phoneOrMsisdn: string): boolean {
    const store = this.readStore();
    const clean = phoneOrMsisdn.replace(/[^0-9]/g, '');
    const msisdn = clean.startsWith('0') ? '62' + clean.substring(1) : (clean.startsWith('62') ? clean : '62' + clean);
    
    if (store.sessions[msisdn]) {
      delete store.sessions[msisdn];
      if (store.activePhone === msisdn) {
        const remaining = Object.keys(store.sessions);
        store.activePhone = remaining.length > 0 ? remaining[0] : undefined;
      }
      this.writeStore(store);
      return true;
    }
    return false;
  }

  public setActivePhone(phoneOrMsisdn: string): boolean {
    const store = this.readStore();
    const clean = phoneOrMsisdn.replace(/[^0-9]/g, '');
    const msisdn = clean.startsWith('0') ? '62' + clean.substring(1) : (clean.startsWith('62') ? clean : '62' + clean);
    if (store.sessions[msisdn]) {
      store.activePhone = msisdn;
      this.writeStore(store);
      return true;
    }
    return false;
  }
}

export const defaultSessionManager = new SessionManager();
