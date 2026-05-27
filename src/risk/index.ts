import type { ChainName } from '../chains/index.js';
import type { RiskFlag, RiskLevel, RiskReport } from './types.js';
import { fetchRuleFlags } from './rules.js';
import { fetchGoPlusFlags } from './goplus.js';

const CHAIN_IDS: Record<ChainName, number> = {
  mainnet: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
};

const LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

function highestLevel(flags: RiskFlag[]): RiskLevel {
  if (flags.length === 0) return 'low';
  return flags.reduce<RiskLevel>((max, f) =>
    LEVEL_ORDER[f.level] > LEVEL_ORDER[max] ? f.level : max,
    'low');
}

function buildSummary(level: RiskLevel, flags: RiskFlag[]): string {
  if (flags.length === 0) return 'No risk signals detected.';
  const critical = flags.filter(f => f.level === 'critical');
  if (critical.length > 0) return `CRITICAL: ${critical[0]!.description}`;
  const high = flags.filter(f => f.level === 'high');
  if (high.length > 0) return `High risk — ${high[0]!.description}`;
  return `${level.charAt(0).toUpperCase() + level.slice(1)} risk — ${flags[0]!.description}`;
}

export async function analyzeAddress(
  address: string,
  chain: ChainName,
): Promise<RiskReport> {
  const chainId = CHAIN_IDS[chain];

  const [ruleFlags, goplusFlags] = await Promise.all([
    fetchRuleFlags(address, chain),
    fetchGoPlusFlags(address, chainId),
  ]);

  const flags = [...ruleFlags, ...goplusFlags];
  const level = highestLevel(flags);
  const summary = buildSummary(level, flags);

  return { address, level, flags, summary };
}
