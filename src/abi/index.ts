import { type Abi } from 'viem';
import { fetchAbiFromEtherscan } from './etherscan.js';
import { fetchAbiFromSourcify } from './sourcify.js';
import { fetchAbiFrom4Byte } from './fourbyte.js';

export async function loadAbi(
  address: string,
  chain: string,
  apiKey?: string,
  selector?: string,
): Promise<Abi | null> {
  if (apiKey) {
    const abi = await fetchAbiFromEtherscan(address, chain, apiKey);
    if (abi) return abi;
  }

  const abi = await fetchAbiFromSourcify(address, chain);
  if (abi) return abi;

  if (selector) {
    const abi = await fetchAbiFrom4Byte(selector);
    if (abi) return abi;
  }
  return null;
}
