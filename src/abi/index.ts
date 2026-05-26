import { type Abi } from 'viem';
import { fetchAbiFromEtherscan } from './etherscan.js';
import { fetchAbiFromSourcify } from './sourcify.js';

export async function loadAbi(
  address: string,
  chain: string,
  apiKey?: string,
): Promise<Abi | null> {
  const abi = await fetchAbiFromEtherscan(address, chain, apiKey);
  if (abi) return abi;

  // TODO: Sourcify fallback (завдання #9)
  // TODO: 4byte fallback (завдання #10)

  return null;
}
