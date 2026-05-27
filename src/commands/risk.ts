import process from 'node:process';
import type { Command } from 'commander';
import { getAddress } from 'viem';
import { CHAIN_NAMES, type ChainName } from '../chains/index.js';
import { analyzeAddress } from '../risk/index.js';
import { createSpinner } from '../ui/spinner.js';
import type { RiskLevel } from '../risk/types.js';
import chalk, { type ChalkInstance} from 'chalk';

const LEVEL_COLOR: Record<RiskLevel, ChalkInstance> = {
  low: chalk.green,
  medium: chalk.yellow,
  high: chalk.red,
  critical: chalk.bgRed.white,
};

const LEVEL_ICON: Record<RiskLevel, string> = {
  low: '✔',
  medium: '⚠',
  high: '✖',
  critical: '☠',
};

export function registerRisk(program: Command): void {
  program
    .command('risk')
    .description('Analyze an address for security risks')
    .argument('<address>', 'Contract or wallet address to analyze')
    .option('-c, --chain <chain>', `Chain to query (${CHAIN_NAMES.join('|')})`, 'mainnet')
    .action(async (rawAddress: string, options: { chain: string }) => {
      if (!CHAIN_NAMES.includes(options.chain as ChainName)) {
        console.error(`Unknown chain: "${options.chain}". Valid: ${CHAIN_NAMES.join(', ')}`);
        process.exit(1);
      }

      let address: string;
      try {
        address = getAddress(rawAddress);
      } catch {
        console.error(`Invalid address: ${rawAddress}`);
        process.exit(1);
      }

      const chain = options.chain as ChainName;
      const spinner = createSpinner('Analyzing address…');
      spinner.start();

      const report = await analyzeAddress(address, chain);

      spinner.stop();

      const color = LEVEL_COLOR[report.level];
      const icon = LEVEL_ICON[report.level];

      console.log('');
      console.log(`${chalk.dim('Address')} ${chalk.yellow(report.address)}`);
      console.log(`${chalk.dim('Risk')}    ${color(`${icon} ${report.level.toUpperCase()}`)}`);
      console.log(`${chalk.dim('Summary')} ${report.summary}`);

      if (report.flags.length > 0) {
        console.log('');
        console.log(chalk.bold('Flags'));
        for (const flag of report.flags) {
          const fc = LEVEL_COLOR[flag.level];
          console.log(`  ${fc(LEVEL_ICON[flag.level])} ${chalk.bold(flag.code)} ${chalk.dim(`[${flag.source}]`)}`);
          console.log(`    ${flag.description}`);
        }
      }

      console.log('');
    });
}
