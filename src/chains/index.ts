import { createPublicClient, http } from 'viem';
import { mainnet, arbitrum, optimism, base, polygon } from 'viem/chains';
import { getConfigValue } from '../config/index.js';

const CHAINS = { mainnet, arbitrum, optimism, base, polygon } as const;

export type ChainName = keyof typeof CHAINS;

export const CHAIN_NAMES = Object.keys(CHAINS) as ChainName[];
const DEFAULT_RPC_URLS: Record<ChainName, string> = {
  mainnet: 'https://ethereum-rpc.publicnode.com',
  arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
  optimism: 'https://optimism-rpc.publicnode.com',
  base: 'https://base-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
};

export async function getPublicClient(chainName: ChainName) {
  const chain = CHAINS[chainName];
  const configuredRpc = (await getConfigValue('rpc'))?.[chainName];
  const rpcUrl = configuredRpc ?? DEFAULT_RPC_URLS[chainName];
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 20_000, retryCount: 2 }),
  });
}
