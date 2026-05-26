import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.config', 'veil');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

interface VeilConfig {
  'etherscan-key'?: string;
  rpc?: Partial<Record<string, string>>;
}

async function readConfig(): Promise<VeilConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as VeilConfig;
  } catch {
    return {};
  }
}

async function writeConfig(config: VeilConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function getConfigValue<K extends keyof VeilConfig>(
  key: K,
): Promise<VeilConfig[K]> {
  const config = await readConfig();
  return config[key];
}

export async function setConfigValue<K extends keyof VeilConfig>(
  key: K,
  value: VeilConfig[K],
): Promise<void> {
  const config = await readConfig();
  config[key] = value;
  await writeConfig(config);
}
