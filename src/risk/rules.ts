import { getAddress } from 'viem';
import type { RiskFlag } from './types.js';
import { getPublicClient } from '../chains/index.js';
import type { ChainName } from '../chains/index.js';

export async function fetchRuleFlags(
  address: string,
  chain: ChainName,
): Promise<RiskFlag[]> {
  const flags: RiskFlag[] = [];

  let checksummed: string;
  try {
    checksummed = getAddress(address);
  } catch {
    flags.push({
      code: 'INVALID_ADDRESS', level: 'critical', source: 'rules',
      description: 'Address is not a valid EVM address'
    });
    return flags;
  }

  const client = await getPublicClient(chain);

  // 1. EOA — не контракт
  const bytecode = await client.getBytecode({ address: checksummed as `0x${string}` });
  if (!bytecode || bytecode === '0x') {
    flags.push({
      code: 'EOA', level: 'medium', source: 'rules',
      description: 'Address is an EOA (wallet), not a contract'
    });
    return flags;
  }

  // 2. EIP-1967 proxy — delegatecall до implementation
  const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const implRaw = await client.getStorageAt({ address: checksummed as `0x${string}`, slot: implSlot });
  if (implRaw && implRaw !== '0x' + '0'.repeat(64)) {
    flags.push({
      code: 'PROXY_UPGRADEABLE', level: 'medium', source: 'rules',
      description: 'Contract is an upgradeable proxy — logic can be silently replaced'
    });
  }

  // 3. Дуже малий байткод (< 100 bytes) — підозрілий мінімалістичний контракт
  const byteLen = (bytecode.length - 2) / 2;
  if (byteLen < 100) {
    flags.push({
      code: 'TINY_BYTECODE', level: 'medium', source: 'rules',
      description: `Contract bytecode is unusually small (${byteLen} bytes)`
    });
  }

  return flags;
}
