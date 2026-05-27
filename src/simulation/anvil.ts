import { spawn, type ChildProcess } from 'node:child_process';

const ANVIL_PORT = 8545;
const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;

export interface AnvilHandle {
  rpcUrl: string;
  stop: () => void;
}

export async function startAnvil(forkUrl: string, forkBlock?: bigint): Promise<AnvilHandle> {
  const args = [
    '--port', String(ANVIL_PORT),
    '--fork-url', forkUrl,
    '--silent',
  ];
  if (forkBlock !== undefined) {
    args.push('--fork-block-number', String(forkBlock));
  }

  const proc: ChildProcess = spawn('anvil', args, { stdio: 'ignore' });

  proc.on('error', (err: Error & { code?: string }) => {
    if (err.code === 'ENOENT') {
      throw new Error('anvil not found — install Foundry: https://getfoundry.sh');
    }
    throw err;
  });

  await waitForRpc(ANVIL_RPC, 10_000);

  return {
    rpcUrl: ANVIL_RPC,
    stop: () => proc.kill('SIGTERM'),
  };
}

async function waitForRpc(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      if (res.ok) return;
    } catch {
      // ще не готовий
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Anvil did not start within ${timeoutMs}ms`);
}
