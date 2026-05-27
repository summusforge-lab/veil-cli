import process from 'node:process';
import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { CHAIN_NAMES, type ChainName, getPublicClient } from '../chains/index.js';
import { getConfigValue } from '../config/index.js';
import { TxRequestSchema, type TxRequest } from '../simulation/schema.js';
import { startAnvil } from '../simulation/anvil.js';
import { simulateTx, formatDiff } from '../simulation/differ.js';
import { createSpinner } from '../ui/spinner.js';
import chalk from 'chalk';

async function loadTx(input: string, chain: ChainName): Promise<TxRequest> {
  // tx hash — завантажуємо з мережі
  if (/^0x[0-9a-fA-F]{64}$/.test(input)) {
    const client = await getPublicClient(chain);
    const tx = await client.getTransaction({ hash: input as `0x${string}` });
    if (!tx.to) throw new Error('Contract deployment tx — nothing to simulate');
    return TxRequestSchema.parse({
      from: tx.from,
      to: tx.to,
      value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
      data: tx.input !== '0x' ? tx.input : undefined,
      gas: tx.gas ? `0x${tx.gas.toString(16)}` : undefined,
      gasPrice: tx.gasPrice ? `0x${tx.gasPrice.toString(16)}` : undefined,
    });
  }

  // JSON файл
  try {
    const raw = JSON.parse(readFileSync(input, 'utf8'));
    return TxRequestSchema.parse(raw);
  } catch (e) {
    throw new Error(`Cannot load tx: ${(e as Error).message}`);
  }
}

export function registerSimulate(program: Command): void {
  program
    .command('simulate')
    .description('Simulate a transaction via local Anvil fork and show balance diffs')
    .argument('<tx>', 'Transaction hash or path to tx.json')
    .option('-c, --chain <chain>', `Chain to fork (${CHAIN_NAMES.join('|')})`, 'mainnet')
    .action(async (input: string, options: { chain: string }) => {
      if (!CHAIN_NAMES.includes(options.chain as ChainName)) {
        console.error(`Unknown chain: "${options.chain}". Valid: ${CHAIN_NAMES.join(', ')}`);
        process.exit(1);
      }
      const chain = options.chain as ChainName;

      const spinner = createSpinner('Loading transaction…');
      spinner.start();

      let tx: TxRequest;
      try {
        tx = await loadTx(input, chain);
      } catch (e) {
        spinner.fail((e as Error).message);
        process.exit(1);
      }
      spinner.succeed('Transaction loaded');

      const rpcs = await getConfigValue('rpc');
      const rpcUrl = rpcs?.[chain];
      if (!rpcUrl) {
        console.error(`No RPC for ${chain}. Set it in veil config`);
        process.exit(1);
      }

      const forkSpinner = createSpinner('Starting Anvil fork…');
      forkSpinner.start();

      let anvil;
      try {
        anvil = await startAnvil(rpcUrl);
      } catch (e) {
        forkSpinner.fail((e as Error).message);
        process.exit(1);
      }
      forkSpinner.succeed('Anvil fork ready');

      const simSpinner = createSpinner('Simulating…');
      simSpinner.start();

      let result;
      try {
        result = await simulateTx(tx, anvil.rpcUrl);
      } finally {
        anvil.stop();
      }

      if (result.success) {
        simSpinner.succeed(chalk.green('Transaction succeeded'));
      } else {
        simSpinner.fail(chalk.red('Transaction would revert'));
      }

      console.log('');
      console.log(chalk.bold('Balance changes'));
      for (const diff of result.balanceDiffs) {
        if (diff.delta === 0n) continue;
        const color = diff.delta > 0n ? chalk.green : chalk.red;
        console.log('  ' + color(formatDiff(diff)));
      }
      console.log('');
      console.log(`${chalk.dim('Gas estimate')}  ${chalk.cyan(result.gasUsed.toLocaleString())}`);
    });
}
