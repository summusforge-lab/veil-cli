import type { Command } from 'commander';
import { getConfigValue, setConfigValue } from '../config/index.js';
import { CHAIN_NAMES } from '../chains/index.js';

export function registerConfig(program: Command): void {
  const config = program
    .command('config')
    .description('Manage veil configuration');

  config
    .command('set <key> <value>')
    .description('Set a config value (etherscan-key, rpc-mainnet, rpc-arbitrum, ...)')
    .action(async (key: string, value: string) => {
      if (key === 'etherscan-key') {
        await setConfigValue('etherscan-key', value);
        console.log(`etherscan-key saved to ~/.config/veil/config.json`);
        return;
      }

      const rpcPrefix = 'rpc-';
      if (key.startsWith(rpcPrefix)) {
        const chain = key.slice(rpcPrefix.length);
        if (!CHAIN_NAMES.includes(chain as never)) {
          console.error(`Unknown chain: "${chain}". Valid: ${CHAIN_NAMES.join(', ')}`);
          process.exit(1);
        }
        const current = await getConfigValue('rpc') ?? {};
        await setConfigValue('rpc', { ...current, [chain]: value });
        console.log(`rpc-${chain} saved`);
        return;
      }

      console.error(`Unknown key: "${key}". Valid keys: etherscan-key, rpc-<chain>`);
      process.exit(1);
    });

  config
    .command('get <key>')
    .description('Get a config value')
    .action(async (key: string) => {
      if (key === 'etherscan-key') {
        const val = await getConfigValue('etherscan-key');
        console.log(val ? `etherscan-key: ${'*'.repeat(val.length - 4)}${val.slice(-4)}` : 'not set');
        return;
      }
      console.error(`Unknown key: "${key}"`);
      process.exit(1);
    });
}
