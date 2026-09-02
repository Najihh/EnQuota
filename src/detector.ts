/**
 * EnQuota - Indonesian Telco ISP Prefix Detector
 */

export type SupportedProvider = 'TRI' | 'INDOSAT' | 'TELKOMSEL' | 'BYU' | 'XL' | 'AXIS' | 'SMARTFREN' | 'UNKNOWN';

export interface IspInfo {
  provider: SupportedProvider;
  name: string;
  brand: string;
  prefix: string;
  normalized: {
    national: string;      // 08xxxxxxxxxx
    international: string; // 628xxxxxxxxxx
  };
  isSupported: boolean;
  engine: string;
}

export interface NormalizedPhone {
  clean: string;
  national: string;
  international: string;
  prefix4: string;
  isValid: boolean;
}

/**
 * Normalize Indonesian phone numbers to standard national (08xx) and international (628xx) formats.
 */
export function normalizePhone(input: string): NormalizedPhone {
  if (!input) {
    return { clean: '', national: '', international: '', prefix4: '', isValid: false };
  }

  // Remove non-digit characters (+, -, space, dots)
  let clean = input.replace(/[^0-9]/g, '');

  if (clean.startsWith('62')) {
    clean = clean.substring(2);
  } else if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // Indonesian mobile numbers usually have 9 to 13 digits after the leading 0/62 (e.g. 81234567890)
  const isValid = clean.startsWith('8') && clean.length >= 9 && clean.length <= 13;
  const national = '0' + clean;
  const international = '62' + clean;
  const prefix4 = national.substring(0, 4);

  return {
    clean,
    national,
    international,
    prefix4,
    isValid
  };
}

/**
 * Prefix Mapping Dictionary
 */
const PREFIX_MAP: Record<string, { provider: SupportedProvider; name: string; brand: string; engine: string; supported: boolean }> = {
  // --- TRI INDONESIA (IOH) ---
  '0895': { provider: 'TRI', name: 'Tri Indonesia', brand: 'bima+', engine: 'IOH ESB (bimaplus-api.ioh.co.id)', supported: true },
  '0896': { provider: 'TRI', name: 'Tri Indonesia', brand: 'bima+', engine: 'IOH ESB (bimaplus-api.ioh.co.id)', supported: true },
  '0897': { provider: 'TRI', name: 'Tri Indonesia', brand: 'bima+', engine: 'IOH ESB (bimaplus-api.ioh.co.id)', supported: true },
  '0898': { provider: 'TRI', name: 'Tri Indonesia', brand: 'bima+', engine: 'IOH ESB (bimaplus-api.ioh.co.id)', supported: true },
  '0899': { provider: 'TRI', name: 'Tri Indonesia', brand: 'bima+', engine: 'IOH ESB (bimaplus-api.ioh.co.id)', supported: true },

  // --- INDOSAT OOREDOO HUTCHISON (IOH) ---
  '0814': { provider: 'INDOSAT', name: 'Indosat Ooredoo', brand: 'myIM3 / Broadband', engine: 'IOH Microservices (myim3api1.ioh.co.id)', supported: true },
  '0815': { provider: 'INDOSAT', name: 'Indosat Ooredoo', brand: 'myIM3 (Matrix/Mentari)', engine: 'IOH Microservices (myim3api1.ioh.co.id)', supported: true },
  '0816': { provider: 'INDOSAT', name: 'Indosat Ooredoo', brand: 'myIM3 (Matrix/Mentari)', engine: 'IOH Microservices (myim3api1.ioh.co.id)', supported: true },
  '0855': { provider: 'INDOSAT', name: 'Indosat Ooredoo', brand: 'myIM3 (Matrix)', engine: 'IOH Microservices (myim3api1.ioh.co.id)', supported: true },
  '0856': { provider: 'INDOSAT', name: 'Indosat Ooredoo', brand: 'myIM3', engine: 'IOH Microservices (myim3api1.ioh.co.id)', supported: true },
  '0857': { provider: 'INDOSAT', name: 'Indosat Ooredoo', brand: 'myIM3', engine: 'IOH Microservices (myim3api1.ioh.co.id)', supported: true },
  '0858': { provider: 'INDOSAT', name: 'Indosat Ooredoo', brand: 'myIM3 (Mentari)', engine: 'IOH Microservices (myim3api1.ioh.co.id)', supported: true },

  // --- TELKOMSEL (MyTelkomsel) ---
  '0811': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'Kartu Halo', engine: 'MyTelkomsel / Telbot Engine', supported: true },
  '0812': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'SimPATI / Halo', engine: 'MyTelkomsel / Telbot Engine', supported: true },
  '0813': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'SimPATI', engine: 'MyTelkomsel / Telbot Engine', supported: true },
  '0821': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'SimPATI', engine: 'MyTelkomsel / Telbot Engine', supported: true },
  '0822': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'SimPATI / Loop', engine: 'MyTelkomsel / Telbot Engine', supported: true },
  '0823': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'Kartu AS', engine: 'MyTelkomsel / Telbot Engine', supported: true },
  '0852': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'Kartu AS', engine: 'MyTelkomsel / Telbot Engine', supported: true },
  '0853': { provider: 'TELKOMSEL', name: 'Telkomsel', brand: 'Kartu AS', engine: 'MyTelkomsel / Telbot Engine', supported: true },

  // --- TELKOMSEL by.U (Circles CXOS) ---
  '0851': { provider: 'BYU', name: 'Telkomsel by.U', brand: 'by.U', engine: 'Circles CXOS (pidaw-app.cx.byu.id)', supported: true },

  // --- XL AXIATA & AXIS ---
  '0817': { provider: 'XL', name: 'XL Axiata', brand: 'XL Prabayar', engine: 'XL Gateway', supported: false },
  '0818': { provider: 'XL', name: 'XL Axiata', brand: 'XL Prabayar', engine: 'XL Gateway', supported: false },
  '0819': { provider: 'XL', name: 'XL Axiata', brand: 'XL Prabayar', engine: 'XL Gateway', supported: false },
  '0859': { provider: 'XL', name: 'XL Axiata', brand: 'XL Prioritas', engine: 'XL Gateway', supported: false },
  '0877': { provider: 'XL', name: 'XL Axiata', brand: 'XL Prabayar', engine: 'XL Gateway', supported: false },
  '0878': { provider: 'XL', name: 'XL Axiata', brand: 'XL Prabayar', engine: 'XL Gateway', supported: false },
  '0831': { provider: 'AXIS', name: 'AXIS', brand: 'AXIS', engine: 'AXISnet Gateway', supported: false },
  '0832': { provider: 'AXIS', name: 'AXIS', brand: 'AXIS', engine: 'AXISnet Gateway', supported: false },
  '0833': { provider: 'AXIS', name: 'AXIS', brand: 'AXIS', engine: 'AXISnet Gateway', supported: false },
  '0838': { provider: 'AXIS', name: 'AXIS', brand: 'AXIS', engine: 'AXISnet Gateway', supported: false },

  // --- SMARTFREN ---
  '0881': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0882': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0883': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0884': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0885': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0886': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0887': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0888': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
  '0889': { provider: 'SMARTFREN', name: 'Smartfren', brand: 'Smartfren', engine: 'Smartfren Gateway', supported: false },
};

/**
 * Detect ISP and metadata from an Indonesian phone number.
 */
export function detectIsp(input: string, overrideProvider?: SupportedProvider): IspInfo {
  const norm = normalizePhone(input);
  
  if (overrideProvider && overrideProvider !== 'UNKNOWN') {
    return {
      provider: overrideProvider,
      name: overrideProvider,
      brand: overrideProvider,
      prefix: norm.prefix4,
      normalized: {
        national: norm.national,
        international: norm.international,
      },
      isSupported: ['TRI', 'INDOSAT', 'TELKOMSEL', 'BYU'].includes(overrideProvider),
      engine: 'Manual Override'
    };
  }

  const match = PREFIX_MAP[norm.prefix4];
  if (match) {
    return {
      provider: match.provider,
      name: match.name,
      brand: match.brand,
      prefix: norm.prefix4,
      normalized: {
        national: norm.national,
        international: norm.international,
      },
      isSupported: match.supported,
      engine: match.engine
    };
  }

  return {
    provider: 'UNKNOWN',
    name: 'Unknown Operator',
    brand: 'Unknown',
    prefix: norm.prefix4,
    normalized: {
      national: norm.national,
      international: norm.international,
    },
    isSupported: false,
    engine: 'None'
  };
}
