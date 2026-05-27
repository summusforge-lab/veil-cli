import { createPublicClient, http, formatEther, type Address } from 'viem';
import type { TxRequest } from './schema.js';

export interface BalanceDiff {
  address: Address;
  before: bigint;
  after: bigint;
  delta: bigint;
}

export interface SimulationResult {
  success: boolean;
  gasUsed: bigint;
  balanceDiffs: BalanceDiff[];
}

export async function simulateTx(
  tx: TxRequest,
  rpcUrl: string,
): Promise<SimulationResult> {
  const client = createPublicClient({ transport: http(rpcUrl) });

  const addresses: Address[] = [tx.from as Address, tx.to as Address];

  // Баланси ДО
  const beforeBalances = await Promise.all(
    addresses.map(a => client.getBalance({ address: a })),
  );

  // eth_call щоб перевірити що tx не реверт + отримати gasUsed
  let gasUsed = 0n;
  let success = true;
  try {
    gasUsed = await client.estimateGas({
      account: tx.from as Address,
      to: tx.to as Address,
      value: tx.value ? BigInt(tx.value) : undefined,
      data: tx.data as `0x${string}` | undefined,
    });
  } catch {
    success = false;
  }

  // Якщо успіх — симулюємо через eth_sendTransaction на Anvil
  if (success) {
    await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2,
        method: 'eth_sendTransaction',
        params: [{
          from: tx.from,
          to: tx.to,
          value: tx.value,
          data: tx.data,
          gas: tx.gas,
          gasPrice: tx.gasPrice ?? '0x0',
        }],
      }),
    });
  }
  
  // Баланси ПІСЛЯ
  const afterBalances = await Promise.all(
    addresses.map(a => client.getBalance({ address: a })),
  );

  const balanceDiffs: BalanceDiff[] = addresses.map((address, i) => ({
    address,
    before: beforeBalances[i]!,
    after: afterBalances[i]!,
    delta: afterBalances[i]! - beforeBalances[i]!,
  }));

  return { success, gasUsed, balanceDiffs };
}

export function formatDiff(diff: BalanceDiff): string {
  const sign = diff.delta >= 0n ? '+' : '';
  return `${diff.address}  ${sign}${formatEther(diff.delta)} ETH`;
}
