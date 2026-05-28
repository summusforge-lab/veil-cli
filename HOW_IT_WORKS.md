# How Veil Works

Technical overview of the architecture and data flows.

---

## Architecture

```
CLI entry (cli.ts)
    │
    ├── commands/        ← Commander.js subcommands
    │       ├── decode.ts
    │       ├── approvals.ts
    │       ├── simulate.ts
    │       ├── risk.ts
    │       ├── explain.ts
    │       └── config.ts
    │
    ├── abi/             ← ABI resolution pipeline
    ├── chains/          ← viem public clients per chain
    ├── risk/            ← risk engine (rules + GoPlus)
    ├── simulation/      ← Anvil fork runner
    ├── config/          ← persistent config (~/.config/veil)
    └── ui/              ← Ink TUI + chalk helpers
```

---

## ABI Pipeline (`src/abi/`)

`veil decode` and `veil explain` need a contract ABI to decode calldata. The pipeline tries three sources in order:

```
loadAbi(address, chain, apiKey?, selector?)
    │
    ├── 1. Etherscan API          — full ABI, requires API key
    │       api.etherscan.io/v2/api
    │       module=contract&action=getabi
    │
    ├── 2. Sourcify               — full ABI, no key required
    │       repo.sourcify.dev/contracts/full_match/{chainId}/{address}
    │       repo.sourcify.dev/contracts/partial_match/{chainId}/{address}
    │
    └── 3. 4byte.directory        — function signature only, no key required
            4byte.directory/api/v1/signatures/?hex_signature={selector}
            parseAbiItem('function transfer(address,uint256)') → minimal ABI
```

If all three fail, the command exits with a hint to set an Etherscan API key.

---

## `veil decode`

```
Input: tx hash or raw calldata (0x...)
    │
    ├── tx hash  → client.getTransaction() → extract .to + .input
    └── calldata → requires --address from the user
    │
    ├── loadAbi(contractAddress, chain, apiKey, selector)
    │
    └── decodeFunctionData({ abi, data: calldata })
            → { functionName, args }
            → chalk pretty-print to terminal
```

---

## `veil approvals`

Scans event logs instead of reading state — faster and requires no knowledge of the token ABI.

```
Two parallel requests to Etherscan Logs API:
    ├── topic0 = keccak256("Approval(address,address,uint256)")    ← ERC-20
    └── topic0 = keccak256("ApprovalForAll(address,address,bool)") ← ERC-721
        topic1 = padded wallet address (owner)

Filtering:
    ├── latestPerKey(token+spender) — keep only the latest log per pair
    ├── ERC-20:  data (amount) > 0  → approval not revoked
    └── ERC-721: data ends with '1' → approved=true

Risk flags:
    └── amount === MaxUint256 → ⚠ UNLIMITED
```

---

## `veil simulate`

Forks the network locally via Anvil, sends the transaction, reads balance diffs.

```
Input: tx.json (Zod-validated) or tx hash
    │
    ├── startAnvil(rpcUrl)
    │       spawn('anvil', ['--fork-url', rpcUrl, '--silent'])
    │       waitForRpc() — polling eth_chainId every 200ms up to 10s
    │
    ├── simulateTx(tx, anvil.rpcUrl)
    │       ├── getBalance(from) + getBalance(to)   ← balances BEFORE
    │       ├── estimateGas(...)                    ← verify tx won't revert
    │       ├── eth_sendTransaction on Anvil RPC    ← execute locally
    │       └── getBalance(from) + getBalance(to)   ← balances AFTER
    │
    ├── anvil.stop() — SIGTERM
    │
    └── output: balance deltas + gas estimate
```

Anvil does not persist state — every `veil simulate` run starts a clean fork.

---

## `veil risk`

Runs two analyzers in parallel and merges the results:

```
analyzeAddress(address, chain)
    │
    ├── fetchRuleFlags(address, chain)          ← on-chain data via viem
    │       ├── getBytecode()  → EOA check
    │       ├── getStorageAt(EIP-1967 slot)     → proxy detection
    │       └── bytecode.length < 100 bytes     → TINY_BYTECODE
    │
    └── fetchGoPlusFlags(address, chainId)      ← GoPlus Security API
            api.gopluslabs.io/api/v1/token_security/{chainId}
            ├── is_honeypot      → HONEYPOT (critical)
            ├── is_blacklisted   → BLACKLIST (high)
            ├── transfer_pausable→ PAUSABLE (high)
            ├── sell_tax > 10%   → HIGH_SELL_TAX (high/critical)
            ├── is_mintable      → MINTABLE (medium)
            └── is_open_source=0 → NOT_VERIFIED (medium)

RiskReport:
    ├── level  = max(all flags)
    ├── flags  = [...ruleFlags, ...goplusFlags]
    └── summary = one sentence from the most critical flag
```

---

## `veil explain`

Ink TUI that renders a `RiskReport` in an interactive screen.

```
render(<ExplainView loading=true />)     ← show spinner immediately
    │
    ├── analyzeAddress(address, chain)
    │
rerender(<ExplainView risk={report} />)  ← update without flicker
    │
setTimeout(unmount, 100ms)               ← give Ink time to flush the last frame
```

Ink uses a React reconciler — only changed lines are redrawn in the terminal.

---

## Configuration (`src/config/`)

Stored at `~/.config/veil/config.json`:

```json
{
  "etherscan-key": "YOUR_KEY",
  "rpc": {
    "mainnet":  "https://...",
    "arbitrum": "https://..."
  }
}
```

`getConfigValue(key)` / `setConfigValue(key, value)` — typed via the `VeilConfig` interface, reads/writes the file atomically.

---

## Chains (`src/chains/`)

`getPublicClient(chain)` returns a viem `PublicClient` with an RPC URL:
1. If `veil config set rpc-{chain}` is set — uses that
2. Otherwise — public RPC (cloudflare-eth for mainnet, official endpoints for L2s)

Supported networks: `mainnet`, `arbitrum`, `optimism`, `base`, `polygon`.

---

## Data Types

```ts
// Risk engine
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
interface RiskFlag   { code, level, description, source }
interface RiskReport { address, level, flags, summary }

// Simulation
interface TxRequest  { from, to, value?, data?, gas?, gasPrice? }  // Zod-validated
interface SimulationResult { success, gasUsed, balanceDiffs }

// ABI
type Abi = viem.Abi  // standard JSON ABI format
```
