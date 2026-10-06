# web3-qa-starter

**Tests the flows generic suites skip — real-wallet E2E + DeFi money-math edge cases.**

A small, readable starter that demonstrates the kind of coverage pre-audit QA for
DeFi/dApps actually needs: the exact boundaries where funds move, and the real-wallet
flows a mocked UI test can never reach.

## Why it matters

Protocol audits require evidence that **fund flows are covered** — deposit, borrow,
repay, liquidate, withdraw — including the edge cases that decide whether money is
lost. Most projects arrive with shallow UI tests and no boundary coverage, so auditors
re-derive behavior themselves and bill for it. Concrete coverage of these flows
typically **cuts the audit bill by 15–25%** and shortens the first review round.

## What's inside

- **Money-math edge cases** (`src/money-math/`, `tests/`) — 40 boundary tests in exact
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
- **Real-wallet E2E skeleton** — Playwright + Synpress (MetaMask) against a
  Tenderly-forked mainnet / Anvil node, driven with `viem`. See
  [`README-e2e.md`](./README-e2e.md) for setup and how to run it.

## Run it

Requires Node 22+.

```bash
npm i
npm test          # run the unit / money-math suite (vitest)
npm run typecheck # tsc --noEmit
```

Real-wallet E2E (Playwright + Synpress): see [`README-e2e.md`](./README-e2e.md).

## Stack

TypeScript · ESM · vitest · Playwright + Synpress (MetaMask) · Tenderly forked
mainnet / Anvil · viem

## Hire me

Pre-audit QA for DeFi/dApps — real-wallet E2E, fund-flow and money-math coverage,
audit-ready test reports. Background: 8 years QA, iGaming money-math, Web3.

**Contact:** _[add contact handle here — email / Telegram / booking link]_

## License

MIT — see [`LICENSE`](./LICENSE).
