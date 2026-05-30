import fs from 'fs';
import path from 'path';
import os from 'os';
import { Command } from 'commander';
import { intro, outro, text, password, isCancel, cancel } from '@clack/prompts';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { isHex } from 'viem';
import { encryptKeystore, decryptKeystore, type KeystoreV3 } from '../utils/keystore.js';

const WALLETS_DIR = path.join(os.homedir(), '.veil', 'wallets');

function ensureWalletsDir() {
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
}

function walletPath(name: string) {
  return path.join(WALLETS_DIR, `${name}.json`);
}

function walletExists(name: string) {
  return fs.existsSync(walletPath(name));
}

function saveWallet(name: string, keystore: KeystoreV3) {
  ensureWalletsDir();
  fs.writeFileSync(walletPath(name), JSON.stringify(keystore, null, 2), { mode: 0o600 });
}

export function loadWallet(name: string): KeystoreV3 {
  const p = walletPath(name);
  if (!fs.existsSync(p)) {
    throw new Error(`Wallet "${name}" not found`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as KeystoreV3;
}

export async function unlockWallet(name: string, promptText = 'Password'): Promise<`0x${string}`> {
  const keystore = loadWallet(name);
  const pwd = await password({ message: promptText });
  if (isCancel(pwd)) {
    cancel('Cancelled');
    process.exit(0);
  }
  return decryptKeystore(keystore, pwd as string);
}

async function askPassword(): Promise<string> {
  const pwd = await password({ message: 'Password' });
  if (isCancel(pwd)) { cancel('Cancelled'); process.exit(0); }

  const confirm = await password({ message: 'Confirm password' });
  if (isCancel(confirm)) { cancel('Cancelled'); process.exit(0); }

  if (pwd !== confirm) {
    console.error('Passwords do not match');
    process.exit(1);
  }
  return pwd as string;
}

export function registerWallet(program: Command): void {
  const cmd = program
    .command('wallet')
    .description('Manage local keystores');

  cmd
    .command('create')
    .description('Generate a new wallet and save encrypted keystore')
    .action(async () => {
      intro('veil wallet create');

      const name = await text({ message: 'Wallet name', placeholder: 'main' });
      if (isCancel(name)) { cancel('Cancelled'); process.exit(0); }

      if (walletExists(name as string)) {
        console.error(`Wallet "${name}" already exists at ${walletPath(name as string)}`);
        process.exit(1);
      }

      const pwd = await askPassword();

      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const keystore = await encryptKeystore(privateKey, pwd, account.address);

      saveWallet(name as string, keystore);

      outro(`Wallet created: ${account.address}\nSaved to ${walletPath(name as string)}`);
    });

  cmd
    .command('import')
    .description('Import an existing private key into an encrypted keystore')
    .action(async () => {
      intro('veil wallet import');

      const name = await text({ message: 'Wallet name', placeholder: 'main' });
      if (isCancel(name)) { cancel('Cancelled'); process.exit(0); }

      if (walletExists(name as string)) {
        console.error(`Wallet "${name}" already exists at ${walletPath(name as string)}`);
        process.exit(1);
      }

      const rawKey = await password({ message: 'Private key (0x...)' });
      if (isCancel(rawKey)) { cancel('Cancelled'); process.exit(0); }

      const key = rawKey as string;
      if (!isHex(key) || key.length !== 66) {
        console.error('Invalid private key — expected 0x-prefixed 32-byte hex');
        process.exit(1);
      }

      const pwd = await askPassword();

      const account = privateKeyToAccount(key as `0x${string}`);
      const keystore = await encryptKeystore(key as `0x${string}`, pwd, account.address);

      saveWallet(name as string, keystore);

      outro(`Wallet imported: ${account.address}\nSaved to ${walletPath(name as string)}`);
    });

  cmd
    .command('list')
    .description('List all saved wallets')
    .action(() => {
      ensureWalletsDir();
      const files = fs.readdirSync(WALLETS_DIR).filter(f => f.endsWith('.json'));

      if (files.length === 0) {
        console.log('No wallets found. Run: veil wallet create');
        return;
      }

      for (const file of files) {
        const name = file.replace('.json', '');
        try {
          const ks = JSON.parse(fs.readFileSync(path.join(WALLETS_DIR, file), 'utf8')) as KeystoreV3;
          console.log(`${name}  0x${ks.address}`);
        } catch {
          console.log(`${name}  (unreadable)`);
        }
      }
    });
}
