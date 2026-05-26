import type { Command } from 'commander';

export function registerHello(program: Command): void {
  program
    .command('hello')
    .description('Sanity check — prints a greeting')
    .action(() => {
      console.log('veil is alive');
    });
}
