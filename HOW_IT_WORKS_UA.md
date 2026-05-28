# How Veil Works

Технічний опис архітектури та потоків даних.

---

## Загальна архітектура

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

`veil decode` і `veil explain` потребують ABI контракту щоб розшифрувати calldata. Pipeline пробує три джерела по черзі:

```
loadAbi(address, chain, apiKey?, selector?)
    │
    ├── 1. Etherscan API          — повний ABI, потребує ключа
    │       api.etherscan.io/v2/api
    │       module=contract&action=getabi
    │
    ├── 2. Sourcify               — повний ABI, без ключа
    │       repo.sourcify.dev/contracts/full_match/{chainId}/{address}
    │       repo.sourcify.dev/contracts/partial_match/{chainId}/{address}
    │
    └── 3. 4byte.directory        — тільки сигнатура функції, без ключа
            4byte.directory/api/v1/signatures/?hex_signature={selector}
            parseAbiItem('function transfer(address,uint256)') → мінімальний ABI
```

Якщо всі три не дали результат — команда завершується з підказкою встановити Etherscan ключ.

---

## `veil decode`

```
Input: tx hash або raw calldata (0x...)
    │
    ├── tx hash  → client.getTransaction() → витягуємо .to + .input
    └── calldata → потрібен --address від користувача
    │
    ├── loadAbi(contractAddress, chain, apiKey, selector)
    │
    └── decodeFunctionData({ abi, data: calldata })
            → { functionName, args }
            → chalk pretty-print у термінал
```

---

## `veil approvals`

Сканує event logs замість читання стейту — швидше і не потребує знання ABI токена.

```
Два паралельних запити до Etherscan Logs API:
    ├── topic0 = keccak256("Approval(address,address,uint256)")   ← ERC-20
    └── topic0 = keccak256("ApprovalForAll(address,address,bool)") ← ERC-721
        topic1 = padded wallet address (власник)

Фільтрація:
    ├── latestPerKey(token+spender) — залишаємо тільки останній лог на пару
    ├── ERC-20:  data (amount) > 0  → схвалення не відкликане
    └── ERC-721: data ends with '1' → approved=true

Risk flags:
    └── amount === MaxUint256 → ⚠ UNLIMITED
```

---

## `veil simulate`

Локально форкує мережу через Anvil, відправляє транзакцію, читає дифи балансів.

```
Input: tx.json (Zod-validated) або tx hash
    │
    ├── startAnvil(rpcUrl)
    │       spawn('anvil', ['--fork-url', rpcUrl, '--silent'])
    │       waitForRpc() — polling eth_chainId кожні 200ms до 10s
    │
    ├── simulateTx(tx, anvil.rpcUrl)
    │       ├── getBalance(from) + getBalance(to)   ← баланси ДО
    │       ├── estimateGas(...)                    ← перевірка що tx не реверт
    │       ├── eth_sendTransaction на Anvil RPC    ← виконуємо локально
    │       └── getBalance(from) + getBalance(to)   ← баланси ПІСЛЯ
    │
    ├── anvil.stop() — SIGTERM
    │
    └── вивід: delta балансів + gas estimate
```

Anvil не персистить стан — кожен запуск `veil simulate` стартує чистий форк.

---

## `veil risk`

Паралельно запускає два аналізатори і об'єднує результати:

```
analyzeAddress(address, chain)
    │
    ├── fetchRuleFlags(address, chain)          ← on-chain дані через viem
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
    ├── level  = max(всіх flags)
    ├── flags  = [...ruleFlags, ...goplusFlags]
    └── summary = одне речення з найкритичнішого flag
```

---

## `veil explain`

Ink TUI який рендерить `RiskReport` в інтерактивному екрані.

```
render(<ExplainView loading=true />)     ← одразу показуємо spinner
    │
    ├── analyzeAddress(address, chain)
    │
rerender(<ExplainView risk={report} />)  ← оновлюємо без мигання
    │
setTimeout(unmount, 100ms)               ← даємо Ink flush останній кадр
```

Ink використовує React reconciler — тільки змінені рядки перемальовуються в терміналі.

---

## Конфігурація (`src/config/`)

Зберігається у `~/.config/veil/config.json`:

```json
{
  "etherscan-key": "YOUR_KEY",
  "rpc": {
    "mainnet":  "https://...",
    "arbitrum": "https://..."
  }
}
```

`getConfigValue(key)` / `setConfigValue(key, value)` — типізовані через `VeilConfig` інтерфейс, читають/пишуть файл атомарно.

---

## Chains (`src/chains/`)

`getPublicClient(chain)` повертає viem `PublicClient` з RPC:
1. Якщо є `veil config set rpc-{chain}` — використовує його
2. Інакше — публічний RPC (cloudflare-eth для mainnet, офіційні для L2)

Підтримувані мережі: `mainnet`, `arbitrum`, `optimism`, `base`, `polygon`.

---

## Типи даних

```ts
// Risk engine
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
interface RiskFlag   { code, level, description, source }
interface RiskReport { address, level, flags, summary }

// Simulation
interface TxRequest  { from, to, value?, data?, gas?, gasPrice? }  // Zod-validated
interface SimulationResult { success, gasUsed, balanceDiffs }

// ABI
type Abi = viem.Abi  // стандартний JSON ABI формат
```
