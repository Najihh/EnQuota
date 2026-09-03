/**
 * EnQuota - Provider Registry & Factory
 */

import { TelcoProvider } from './base.js';
import { TriProvider } from './tri.js';
import { IndosatProvider } from './indosat.js';
import { ByuProvider } from './byu.js';
import { TelkomselProvider } from './telkomsel.js';
import { XLProvider } from './xl.js';
import { SupportedProvider, detectIsp, normalizePhone } from '../detector.js';
import { SessionManager, defaultSessionManager } from '../session.js';

export * from './base.js';
export * from './tri.js';
export * from './indosat.js';
export * from './byu.js';
export * from './telkomsel.js';
export * from './xl.js';

export function createProvider(providerType: SupportedProvider, sessionManager: SessionManager = defaultSessionManager, phone?: string): TelcoProvider {
  const session = phone ? sessionManager.getSession(phone) : sessionManager.getSession();

  switch (providerType) {
    case 'TRI':
      return new TriProvider(session);
    case 'INDOSAT':
      return new IndosatProvider(session);
    case 'BYU':
      return new ByuProvider(session);
    case 'TELKOMSEL':
      return new TelkomselProvider(session);
    case 'XL':
    case 'AXIS':
      return new XLProvider(session);
    default:
      throw new Error(`Unsupported ISP provider: ${providerType}`);
  }
}

export function resolveProvider(input?: { phone?: string; provider?: string }, sessionManager: SessionManager = defaultSessionManager): { provider: TelcoProvider; detectedProvider: SupportedProvider; phone?: string } {
  // 1. If explicit provider is specified
  if (input?.provider) {
    const provKey = input.provider.toUpperCase() as SupportedProvider;
    return {
      provider: createProvider(provKey, sessionManager, input.phone),
      detectedProvider: provKey,
      phone: input.phone
    };
  }

  // 2. If phone number is specified, auto-detect ISP from prefix
  if (input?.phone) {
    const ispInfo = detectIsp(input.phone);
    if (!ispInfo.isSupported || ispInfo.provider === 'UNKNOWN') {
      throw new Error(`ISP for prefix ${ispInfo.prefix} (${ispInfo.name}) is not currently supported or number format is invalid.`);
    }
    return {
      provider: createProvider(ispInfo.provider, sessionManager, input.phone),
      detectedProvider: ispInfo.provider,
      phone: ispInfo.normalized.national
    };
  }

  // 3. Fallback to active stored session
  const activeSession = sessionManager.getSession();
  if (activeSession) {
    return {
      provider: createProvider(activeSession.provider, sessionManager, activeSession.phone),
      detectedProvider: activeSession.provider,
      phone: activeSession.phone
    };
  }

  throw new Error('No phone number provided and no active session found. Please provide a phone number or login first.');
}
