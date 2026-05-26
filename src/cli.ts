#!/usr/bin/env node
import { Command } from 'commander';
import { registerHello } from './commands/hello.js';
import { registerDecode } from './commands/decode.js';
import { registerConfig } from './commands/config.js';
import { registerApprovals } from './commands/approvals.js';

const program = new Command();

program
  .name('veil')
  .description('Security-first terminal wallet for EVM chains — explain what you sign')
  .version('0.0.1');

registerHello(program);

registerDecode(program);

registerConfig(program);

registerApprovals(program);

program.parse();
