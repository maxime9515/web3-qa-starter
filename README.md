# web3-qa-starter

**Tests the flows generic suites skip — wallet-flow E2E + DeFi money-math edge cases.**

A small, readable starter that demonstrates the kind of coverage pre-audit QA for
DeFi/dApps actually needs: the exact boundaries where funds move, and the wallet
flows a mocked UI test can never reach.

## Why it matters

Protocol audits require evidence that **fund flows are covered** — deposit, borrow,
repay, liquidate, withdraw — including the edge cases that decide whether money is
lost. Most projects arrive with shallow UI tests and no boundary coverage, so auditors
re-derive behavior themselves and bill for it. Concrete coverage of these flows
typically **cuts the audit bill by 15–25%** and shortens the first review round.

## What's inside

- **Money-math edge cases** (`src/money-math/`, `tests/`) — 42 boundary tests in exact
  `bigint` (no floats), each formula verified against its spec:
  - **Aave-style health factor** — HF exactly `1e18` is solvent; one wei of extra debt flips
    it to liquidatable; zero-debt and division-by-zero handled; max additional borrow vs max-LTV.
  - **Uniswap V2** (`getAmountOut` / `getAmountIn` / `quote`) — constant-product x·y=k with the
    997/1000 fee; out rounds DOWN, in rounds UP (+1) so the pool is never underpaid; zero/empty
    reserves and `amountOut ≥ reserveOut` throw `INSUFFICIENT_LIQUIDITY`.
  - **ERC-4626 vaults** — shares/assets conversions and the `preview*` rounding matrix (always in
    favour of the vault); fresh-vault 1:1; degenerate `supply>0, assets==0` rejected; a full
    first-depositor inflation-attack scenario.
  - **Liquidation** — bonus payout and repay/seize amounts, capped at debt.
- **Wallet-flow E2E that runs out of the box** (`e2e/`) — `npm run e2e` starts a bundled
  demo dApp and drives the full flow through an injected EIP-1193 **test double**:
  connect → switch network → EIP-712 sign → send tx. Hermetic: no secrets, no network.
  **Real MetaMask (Synpress) is documented but not wired yet** — see
  [`README-e2e.md`](./README-e2e.md) for the wiring steps and what a real run needs.

> **What runs live vs. what doesn't.** `npm test` (42 money-math tests) and `npm run e2e`
> (5 wallet-flow tests against the bundled demo dApp) both pass with no setup. The **real**
> MetaMask/Synpress driver is still a documented stub that throws on use; a live real-wallet
> run needs MetaMask + a forked-mainnet RPC key and is **not green**. Details in
> [`README-e2e.md`](./README-e2e.md).

## Run it

Requires Node 22+.

```bash
npm i
npm test          # 42 money-math boundary tests (vitest)
npm run e2e       # 5 wallet-flow E2E tests vs the bundled demo dApp (Playwright)
npm run typecheck # tsc --noEmit
```

Real MetaMask (forked mainnet, wallet extension): see [`README-e2e.md`](./README-e2e.md).

## Stack

TypeScript · ESM · vitest · Playwright (EIP-1193 wallet flows; Synpress wiring documented,
not yet enabled) · Tenderly forked mainnet / Anvil · viem

## Hire me

Pre-audit QA for DeFi/dApps — real-wallet E2E, fund-flow and money-math coverage,
audit-ready test reports. Background: 8 years QA, iGaming money-math, Web3.

**Contact:** _[add contact handle here — email / Telegram / booking link]_

## License

MIT — see [`LICENSE`](./LICENSE).
