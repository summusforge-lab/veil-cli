import type { RiskFlag } from './types.js';

interface GoPlusTokenSecurity {
  is_honeypot?: string; // '0' | '1'
  is_blacklisted?: string;
  is_open_source?: string;
  is_proxy?: string;
  can_take_back_ownership?: string;
  owner_change_balance?: string;
  buy_tax?: string;
  sell_tax?: string;
  is_mintable?: string;
  transfer_pausable?: string;
}

interface GoPlusResponse {
  code: number;
  message: string;
  result: Record<string, GoPlusTokenSecurity>;
}

export async function fetchGoPlusFlags(
  address: string,
  chainId: number,
): Promise<RiskFlag[]> {
  try {
    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];

    const data = await res.json() as GoPlusResponse;
    if (data.code !== 1) return [];

    const token = data.result[address.toLowerCase()];
    if (!token) return [];

    const flags: RiskFlag[] = [];

    if (token.is_honeypot === '1') {
      flags.push({
        code: 'HONEYPOT', level: 'critical', source: 'goplus',
        description: 'Contract is a honeypot — you can buy but not sell'
      });
    }
    if (token.is_blacklisted === '1') {
      flags.push({
        code: 'BLACKLIST', level: 'high', source: 'goplus',
        description: 'Contract has a blacklist function that can block transfers'
      });
    }
    if (token.transfer_pausable === '1') {
      flags.push({
        code: 'PAUSABLE', level: 'high', source: 'goplus',
        description: 'Owner can pause all token transfers'
      });
    }
    if (token.can_take_back_ownership === '1') {
      flags.push({
        code: 'RECLAIM_OWNERSHIP', level: 'high', source: 'goplus',
        description: 'Ownership can be reclaimed after renouncing'
      });
    }
    if (token.is_mintable === '1') {
      flags.push({
        code: 'MINTABLE', level: 'medium', source: 'goplus',
        description: 'Owner can mint unlimited tokens, diluting supply'
      });
    }
    if (token.is_open_source === '0') {
      flags.push({
        code: 'NOT_VERIFIED', level: 'medium', source: 'goplus',
        description: 'Contract source code is not verified'
      });
    }

    const buyTax = parseFloat(token.buy_tax ?? '0');
    const sellTax = parseFloat(token.sell_tax ?? '0');
    if (sellTax > 0.1) {
      flags.push({
        code: 'HIGH_SELL_TAX', level: sellTax > 0.5 ? 'critical' : 'high', source: 'goplus',
        description: `Sell tax is ${(sellTax * 100).toFixed(0)}% — typical in rugpull schemes`
      });
    } else if (buyTax > 0.1) {
      flags.push({
        code: 'HIGH_BUY_TAX', level: 'medium', source: 'goplus',
        description: `Buy tax is ${(buyTax * 100).toFixed(0)}%`
      });
    }

    return flags;
  } catch {
    return [];
  }
}
