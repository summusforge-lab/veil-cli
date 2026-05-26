import { type Abi } from 'viem';

const CHAIN_IDS: Record<string, number> = {
  mainnet: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
};

interface EtherscanResponse {
  status: '0' | '1';
  message: string;
  result: string;
}

export async function fetchAbiFromEtherscan(
  address: string,
  chain: string,
  apiKey?: string,
): Promise<Abi | null> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return null;

  const params = new URLSearchParams({
    chainid: chainId.toString(),
    module: 'contract',
    action: 'getabi',
    address,
    ...(apiKey ? { apikey: apiKey } : {}),
  });

  const url = `https://api.etherscan.io/v2/api?${params.toString()}`;

  let data: EtherscanResponse;
  try {
    const res = await fetch(url);
    data = await res.json() as EtherscanResponse;
  } catch {
    return null;
  }

  if (data.status !== '1') return null;

  try {
    return JSON.parse(data.result) as Abi;
  } catch {
    return null;
  }
}
