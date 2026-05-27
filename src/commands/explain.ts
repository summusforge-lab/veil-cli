import process from 'node:process';
import React from 'react';
import { render } from 'ink';
import type { Command } from 'commander';
import { getAddress } from 'viem';
import { CHAIN_NAMES, type ChainName } from '../chains/index.js';
import { analyzeAddress } from '../risk/index.js';
import { ExplainView } from '../ui/ExplainView.js';

export function registerExplain(program: Command): void {
  program
    .command('explain')
    .description('Interactive TUI: decode + risk in one screen')
    .argument('<address>', 'Contract address to explain')
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

      // Render loading state immediately
      const { rerender, unmount } = render(
        React.createElement(ExplainView, {
          address,
          decoded: null,
          risk: null,
          loading: true,
          error: null,
        }),
      );

      try {
        // Fetch risk (decode requires calldata — explain focuses on address risk)
        const risk = await analyzeAddress(address, chain);

        rerender(
          React.createElement(ExplainView, {
            address,
            decoded: null,
            risk,
            loading: false,
            error: null,
          }),
        );
      } catch (e) {
        rerender(
          React.createElement(ExplainView, {
            address,
            decoded: null,
            risk: null,
            loading: false,
            error: (e as Error).message,
          }),
        );
      } finally {
        // Give Ink time to flush final render, then exit
        setTimeout(() => {
          unmount();
        }, 100);
      }
    });
}
