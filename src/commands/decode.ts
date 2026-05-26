import type { Command } from 'commander';
import { CHAIN_NAMES, type ChainName } from '../chains/index.js';
import { loadAbi } from '../abi/index.js';
import { getConfigValue } from '../config/index.js';
import { decodeFunctionData } from 'viem';
import { getPublicClient } from '../chains/index.js';
import { createSpinner } from '../ui/spinner.js';
import { formatValue, label } from '../ui/format.js';
import chalk from 'chalk';

type InputKind = 'txhash' | 'calldata' | 'invalid';

function classifyInput(input: string): InputKind {
  if (!input.startsWith('0x')) return 'invalid';
  const hex = input.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return 'invalid';
  if (hex.length === 64) return 'txhash';
  if (hex.length >= 8 && hex.length % 2 === 0) return 'calldata';
  return 'invalid';
}

export function registerDecode(program: Command): void {
  program
    .command('decode')
    .description('Decode calldata or a transaction into human-readable form')
    .argument('<input>', 'Raw calldata (0x...) or a transaction hash')
    .option('-c, --chain <chain>', `Chain to query (${CHAIN_NAMES.join('|')})`, 'mainnet')
    .option('-a, --address <address>', 'Contract address (required for raw calldata)')
    .action(async (input: string, options: { chain: string; address?: string }) => {
      if (!CHAIN_NAMES.includes(options.chain as ChainName)) {
        console.error(`Unknown chain: "${options.chain}". Valid: ${CHAIN_NAMES.join(', ')}`);
        process.exit(1);
      }
      const chain = options.chain as ChainName;

      const kind = classifyInput(input);
      if (kind === 'invalid') {
        console.error('Invalid input: expected 0x-prefixed hex calldata or 32-byte tx hash');
        process.exit(1);
      }

      if (kind === 'calldata' && !options.address) {
        console.error('Raw calldata requires --address <contract address>');
        process.exit(1);
      }

      const spinner = createSpinner('Fetching ABI…');
      spinner.start();

      const apiKey = await getConfigValue('etherscan-key');

      let contractAddress: string;
      let calldata: `0x${string}`;

      if (kind === 'txhash') {
        const client = await getPublicClient(chain);
        const tx = await client.getTransaction({ hash: input as `0x${string}` });
        if (!tx.to) {
          console.error('Transaction is a contract deployment — no calldata to decode');
          process.exit(1);
        }
        contractAddress = tx.to;
        calldata = tx.input;
      } else {
        contractAddress = options.address!;
        calldata = input as `0x${string}`;
      }

      const abi = await loadAbi(contractAddress, chain, apiKey ?? undefined);

      if (!abi) {
        spinner.fail(chalk.red(`Could not load ABI for ${contractAddress}`));
        console.error(chalk.dim('Tip: veil config set etherscan-key <key>'));
        process.exit(1);
      }
      spinner.succeed(chalk.green(`ABI loaded`) + chalk.dim(` (${abi.length} entries)`));

      let decoded: { functionName: string; args: readonly unknown[] };
      try {
        const result = decodeFunctionData({ abi, data: calldata });
        decoded = {
          functionName: result.functionName,
          args: result.args ?? [],
        };
      } catch {
        console.error('Could not decode calldata — selector not found in ABI');
        process.exit(1);
      }

      console.log('');
      console.log(`${label('Function')} ${chalk.bold.cyan(decoded.functionName)}`);
      console.log(`${label('Contract')} ${chalk.yellow(contractAddress)}`);

      if (decoded.args.length > 0) {
        console.log('');
        console.log(chalk.dim('Arguments'));
        for (const [i, arg] of decoded.args.entries()) {
          console.log(`  ${chalk.dim(`[${i}]`)} ${formatValue(arg)}`);
        }
      }
    });
}
