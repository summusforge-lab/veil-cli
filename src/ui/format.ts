import chalk from 'chalk';

export function formatAddress(address: string): string {
  return chalk.yellow(address.slice(0, 6) + '…' + address.slice(-4));
}

export function formatValue(value: unknown): string {
  if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
    return chalk.yellow(value);
  }
  if (typeof value === 'bigint') {
    return chalk.cyan(value.toLocaleString());
  }
  return chalk.white(String(value));
}

export function label(text: string): string {
  return chalk.dim(text.padEnd(10));
}
