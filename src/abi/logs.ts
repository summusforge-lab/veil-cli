import { type Address, pad, toHex } from 'viem';

const CHAIN_IDS: Record<string, number> = {
  mainnet: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
};

export interface RawLog {
  address: Address;
  topics: [string, ...string[]];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

interface EtherscanLogsResponse {
  status: '0' | '1';
  message: string;
  result: RawLog[] | string;
}

export async function fetchLogsByTopic(params: {
  chain: string;
  topic0: string;
  topic1?: string;
  apiKey: string;
}): Promise<RawLog[]> {
  const chainId = CHAIN_IDS[params.chain];
  if (!chainId) return [];

  const query = new URLSearchParams({
    chainid: chainId.toString(),
    module: 'logs',
    action: 'getLogs',
    fromBlock: '0',
    toBlock: 'latest',
    topic0: params.topic0,
    ...(params.topic1 ? { topic1: params.topic1, topic0_1_opr: 'and' } : {}),
    apikey: params.apiKey,
  });

  try {
    const res = await fetch(`https://api.etherscan.io/v2/api?${query.toString()}`);
    const data = await res.json() as EtherscanLogsResponse;
    if (data.status !== '1' || !Array.isArray(data.result)) return [];
    return data.result;
  } catch {
    return [];
  }
}

export function padAddress(address: Address): string {
  return pad(address, { size: 32 });
}
