import { type Abi, getAddress } from 'viem';

const CHAIN_IDS: Record<string, number> = {
  mainnet: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
};

interface SourcifyMetadata {
  output: {
    abi: Abi;
  };
}

async function tryFetch(url: string): Promise<SourcifyMetadata | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json() as SourcifyMetadata;
  } catch {
    return null;
  }
}

export async function fetchAbiFromSourcify(
  address: string,
  chain: string,
): Promise<Abi | null> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return null;

  try {
    address = getAddress(address);
  } catch {
    return null;
  }
  const base = `https://repo.sourcify.dev/contracts`;

  // Full match — точний збіг байткоду
  const full = await tryFetch(`${base}/full_match/${chainId}/${address}/metadata.json`);
  if (full) return full.output.abi;

  // Partial match — збіг метаданих без байткоду
  const partial = await tryFetch(`${base}/partial_match/${chainId}/${address}/metadata.json`);
  if (partial) return partial.output.abi;

  return null;
}
