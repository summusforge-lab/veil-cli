import type { Command } from 'commander';
import { getAddress, hexToBigInt, maxUint256, type Address } from 'viem';
import { CHAIN_NAMES, type ChainName } from '../chains/index.js';
import { getConfigValue } from '../config/index.js';
import { fetchLogsByTopic, padAddress, type RawLog } from '../abi/logs.js';
import { createSpinner } from '../ui/spinner.js';
import chalk from 'chalk';

const ERC20_APPROVAL = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
const ERC721_APPROVAL_FOR_ALL = '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31';

function topicToAddress(topic: string): Address {
  return getAddress('0x' + topic.slice(26));
}

function latestPerKey(logs: RawLog[], keyFn: (l: RawLog) => string): RawLog[] {
  const map = new Map<string, RawLog>();
  for (const log of logs) {
    const key = keyFn(log);
    const existing = map.get(key);
    if (!existing || BigInt(log.blockNumber) > BigInt(existing.blockNumber)) {
      map.set(key, log);
    }
  }
  return [...map.values()];
}

export function registerApprovals(program: Command): void {
  program
    .command('approvals')
    .description('Show all active token approvals for an address')
    .argument('<address>', 'Wallet address to check')
    .option('-c, --chain <chain>', `Chain to query (${CHAIN_NAMES.join('|')})`, 'mainnet')
    .action(async (rawAddress: string, options: { chain: string }) => {
      if (!CHAIN_NAMES.includes(options.chain as ChainName)) {
        console.error(`Unknown chain: "${options.chain}". Valid: ${CHAIN_NAMES.join(', ')}`);
        process.exit(1);
      }

      let address: Address;
      try {
        address = getAddress(rawAddress);
      } catch {
        console.error(`Invalid address: ${rawAddress}`);
        process.exit(1);
      }

      const apiKey = await getConfigValue('etherscan-key');
      if (!apiKey) {
        console.error('etherscan-key is required for approvals. Run: veil config set etherscan-key <key>');
        process.exit(1);
      }

      const chain = options.chain as ChainName;
      const topic1 = padAddress(address);
      const spinner = createSpinner('Fetching approvals…');
      spinner.start();

      const [erc20Logs, erc721Logs] = await Promise.all([
        fetchLogsByTopic({ chain, topic0: ERC20_APPROVAL, topic1, apiKey }),
        fetchLogsByTopic({ chain, topic0: ERC721_APPROVAL_FOR_ALL, topic1, apiKey }),
      ]);

      // ERC-20: keep latest per (token, spender), filter revoked (value = 0)
      const erc20Active = latestPerKey(
        erc20Logs,
        l => `${l.address}-${l.topics[2]}`,
      ).filter(l => l.data && l.data !== '0x' && hexToBigInt(l.data as `0x${string}`) > 0n);

      // ERC-721: keep latest per (collection, operator), filter revoked
      const erc721Active = latestPerKey(
        erc721Logs,
        l => `${l.address}-${l.topics[2]}`,
      ).filter(l => l.data.endsWith('1'));

      spinner.succeed(`Found ${erc20Active.length + erc721Active.length} active approval(s)`);

      if (erc20Active.length === 0 && erc721Active.length === 0) {
        console.log(chalk.green('\n✔ No active approvals found'));
        return;
      }

      if (erc20Active.length > 0) {
        console.log(`\n${chalk.bold('ERC-20 Approvals')}`);
        for (const log of erc20Active) {
          const spender = topicToAddress(log.topics[2] ?? '');
          const value = hexToBigInt(log.data as `0x${string}`);
          const isUnlimited = value === maxUint256;
          const risk = isUnlimited
            ? chalk.red('⚠ UNLIMITED')
            : chalk.green('✔ limited');

          console.log(`  ${chalk.dim('token')}   ${chalk.yellow(log.address)}`);
          console.log(`  ${chalk.dim('spender')} ${chalk.yellow(spender)}`);
          console.log(`  ${chalk.dim('amount')}  ${risk}${isUnlimited ? '' : chalk.cyan(' ' + value.toLocaleString())}`);
          console.log('');
        }
      }

      if (erc721Active.length > 0) {
        console.log(`${chalk.bold('ERC-721 ApprovalForAll')}`);
        for (const log of erc721Active) {
          const operator = topicToAddress(log.topics[2] ?? '');
          console.log(`  ${chalk.dim('collection')} ${chalk.yellow(log.address)}`);
          console.log(`  ${chalk.dim('operator')}   ${chalk.yellow(operator)}`);
          console.log(`  ${chalk.dim('scope')}      ${chalk.red('⚠ ALL TOKENS')}`);
          console.log('');
        }
      }
    });
}
