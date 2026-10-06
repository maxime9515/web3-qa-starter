# Case study: pre-audit QA for DeFi/dApp fund flows

## The problem

Most projects arrive at an audit with a suite that only exercises the happy path
through a mocked UI. Deposit works; withdraw works. But audits revolve around
**fund flows** — deposit, borrow, repay, liquidate, withdraw — and the edge cases
where fractions of a wei decide whether money is lost. When those boundaries
aren't covered, the audit team has to re-derive the behavior itself and bills for
the time. That work is repeatable and cheap to do *before* the audit starts.

## The approach

Two complementary layers, both aimed at the boundaries that generic suites skip:

**1. Money-math edge cases.** Every formula that moves value is pinned in exact
`bigint` (no floats) and tested against its spec at the boundary, not the middle:

- **Aave-style health factor** — HF exactly `1e18` is solvent; one wei of extra
  debt flips it to liquidatable; zero-debt and division-by-zero handled; max
  additional borrow vs. max-LTV.
- **Uniswap V2** (`getAmountOut` / `getAmountIn` / `quote`) — constant-product
  `x·y=k` with the 997/1000 fee; out rounds DOWN, in rounds UP (+1) so the pool is
  never underpaid; zero/empty reserves and `amountOut ≥ reserveOut` throw
  `INSUFFICIENT_LIQUIDITY`.
- **ERC-4626 vaults** — shares/assets conversions and the `preview*` rounding
  matrix (always in the vault's favour); fresh-vault 1:1; degenerate
  `supply>0, assets==0` rejected; a full first-depositor inflation-attack scenario.
- **Liquidation** — bonus payout and repay/seize amounts, capped at debt.

**2. Wallet-flow E2E.** A mocked UI test can never reach connect → switch network
→ EIP-712 sign → send tx. The suite drives that full flow against a bundled demo
dApp through an injected EIP-1193 **test double** — hermetic: no secrets, no
network, no wallet extension. It runs green out of the box.

## What's in the repo

- `src/money-math/` + `tests/` — **42** boundary tests (health factor, Uniswap V2,
  ERC-4626, liquidation), vitest.
- `e2e/` — **5** wallet-flow E2E specs driving the bundled demo dApp via the
  injected EIP-1193 test double, Playwright.
- `demo-dapp/` — the small dApp the E2E drives.

Status: `npm test` (42) and `npm run e2e` (5) both pass with no setup. The
**real-MetaMask mode is wired up** — `npm run e2e:real` boots a live MetaMask
(Synpress) that injects a genuine `isMetaMask` EIP-1193 provider into the dApp,
and that test passes. The wallet's **connect/sign approval popups are blocked in
this environment** (MetaMask's `notification.html` never surfaces), so those two
tests are visible skips (`test.fixme`), not passes. A forked-mainnet run needs the
wallet extension and an RPC key.

## Run it

```bash
npm i
npm test          # 42 money-math boundary tests (vitest)
npm run e2e       # 5 wallet-flow E2E tests vs the bundled demo dApp (Playwright)
```

## Repo

<https://github.com/maxime9515/web3-qa-starter>
