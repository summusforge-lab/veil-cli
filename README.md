# veil

> Security-first terminal wallet for EVM chains — explain what you sign.

`veil` decodes calldata into human-readable function calls, scans token approvals, simulates transactions locally, and scores contract risk —
before you sign anything.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node 18+](https://img.shields.io/badge/node-18%2B-green.svg)

---

## Install

```bash
npm install -g veil-cli
```

Requires [Foundry](https://getfoundry.sh) for `veil simulate`.

---

## Commands

### `veil decode <calldata|tx-hash>`

Decode raw calldata or a transaction hash into a human-readable function call.

```bash
# by tx hash
veil decode 0xabc123... --chain mainnet

# by raw calldata + contract address
veil decode 0xa9059cbb... --address 0xdAC17F... --chain mainnet
```

ABI sources (in order): Etherscan → Sourcify → 4byte.directory

---

### `veil approvals <address>`

List all active ERC-20 and ERC-721 approvals for a wallet. Flags unlimited approvals.

```bash
veil approvals 0xYourWallet --chain mainnet
```

---

### `veil simulate <tx.json|tx-hash>`

Fork the chain locally with Anvil and show balance changes before submitting.

```bash
veil simulate tx.json --chain mainnet
veil simulate 0xabc123... --chain arbitrum
```

`tx.json` format:
```json
{
  "from":  "0xYourAddress",
  "to":    "0xContractAddress",
  "value": "0xde0b6b3a7640000",
  "data":  "0xa9059cbb..."
}
```

---

### `veil risk <address>`

Analyze a contract for security risks using on-chain heuristics and GoPlus Security API.

```bash
veil risk 0xContractAddress --chain mainnet
```

Checks: honeypot, blacklist, pausable transfers, upgradeable proxy, high sell tax, unverified source.

---

### `veil explain <address>`

Interactive TUI combining risk analysis in one screen.

```bash
veil explain 0xContractAddress --chain base
```

---

### `veil config`

```bash
veil config set etherscan-key YOUR_KEY
veil config get etherscan-key
```

---

## Supported chains

`mainnet` · `arbitrum` · `optimism` · `base` · `polygon`

---

## Stack

- [viem](https://viem.sh) — EVM client & ABI decoding
- [Commander.js](https://github.com/tj/commander.js) — CLI framework
- [Ink](https://github.com/vadimdemedes/ink) — React-based TUI
- [GoPlus Security](https://gopluslabs.io) — honeypot & risk data
- [Foundry/Anvil](https://getfoundry.sh) — local fork simulation

---

## License

MIT
