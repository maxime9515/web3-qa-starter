# Real-wallet E2E (Playwright + MetaMask/Synpress)

E2E suite for the **pre-audit QA for DeFi** service: it drives a dApp with a
**real browser wallet** (MetaMask) against a **forked mainnet**, so it catches
the flows a mocked/RPC-less suite cannot — connect, network switch, EIP-712
sign, and transaction approval with real popups.

> **Status: SKELETON.** The config, fixtures, spec and tsconfig are real and
> type-check. The MetaMask/Synpress driver is **not wired** — every wallet
> action throws `WalletNotConfiguredError` on purpose. **Nothing in this suite
> has been run live.** Follow the setup below to make it real.

---

## Layout

```
e2e/
  playwright.config.ts     # chromium project, baseURL/timeout from ENV
  fixtures.ts              # WalletController + MetaMaskWallet (stub) + test/expect
  specs/
    wallet-connect.spec.ts # onboarding, connect, switch network, sign, tx
tsconfig.e2e.json          # separate TS config for e2e (root tsconfig excludes e2e)
```

`e2e` is deliberately kept **out of the root `tsconfig.json`** — the e2e code
needs `@playwright/test` types and DOM libs that the library config should not
carry. Type-check it with its own config:

```bash
npm run e2e:typecheck      # tsc -p tsconfig.e2e.json --noEmit
```

`@playwright/test` is already installed. Playwright browsers are only needed to
*run*; install once with `npm run e2e:install` (this repo's cache already has
`chromium-1243`).

---

## Running

The runner picks up the config via the npm script:

```bash
npm run e2e                 # playwright test --config=e2e/playwright.config.ts
npx playwright test --config=e2e/playwright.config.ts --ui   # interactive
```

With no ENV set, the suite loads the config and **every test skips** with an
explicit reason — nothing is green-washed. Set `E2E_BASE_URL` to run the smoke
check, and wallet ENV to run the real flows. A skip is not a pass — read the
report.

### ENV contract

| Var | Meaning | Default |
| --- | --- | --- |
| `E2E_BASE_URL` | dApp URL under test | `http://localhost:3000` |
| `E2E_CHAIN_ID` | chain id the wallet should be on | `1` (mainnet) |
| `E2E_RPC_URL` | RPC for the anvil/Tenderly fork | – |
| `E2E_WALLET_ADDRESS` | expected EOA address | – |
| `E2E_METAMASK_SEED` | wallet seed phrase | – |
| `E2E_METAMASK_PASSWORD` | wallet unlock password | – |
| `E2E_METAMASK_EXTENSION` | absolute path to unpacked MetaMask ext | – |
| `CI` | enables retries, 1 worker, github reporter | – |

Never commit a seed phrase. Pass it as a CI secret / local env var only.

---

## Raising a forked mainnet (one line)

Use [Foundry](https://book.getfoundry.sh) Anvil, or Tenderly Virtual TestNets:

```bash
# Anvil, forking mainnet through your RPC provider
anvil --fork-url "$RPC_URL" --chain-id 1

# Tenderly: create a Virtual TestNet in the dashboard, copy its RPC URL,
# then point both the dApp and the wallet at it:
export E2E_RPC_URL="https://virtual.mainnet.rpc.tenderly.co/<id>"
```

Then point the dApp at the same fork and set `E2E_BASE_URL`. A fork gives you
real token balances, real contract code, and deterministic state — exactly what
a pre-audit run needs without spending mainnet gas.

In MetaMask, add a custom network with the fork's RPC and chain id
(`E2E_CHAIN_ID`); the wallet fixture's `switchNetwork` will do this once wired.

---

## Wiring a real MetaMask wallet (Synpress)

Synpress is intentionally **not** a dependency of this repo — it is heavy and
pins its own Playwright + MetaMask build. Install it only when you want a real
run:

```bash
# Option A — Synpress v3 (@synthetixio/synpress) with its Playwright wrapper
npm i -D @synthetixio/synpress
npx synpress install-metamask       # downloads the pinned MetaMask extension
```

Then replace the stub bodies in `e2e/fixtures.ts`:

1. **Boot context** — MetaMask needs a *persistent* context with the unpacked
   extension loaded (`--disable-extensions-except` + `--load-extension`, pointed
   at `E2E_METAMASK_EXTENSION` or Synpress's downloaded path). Use Synpress's
   `testWithSynpress` / `metaMaskFixtures` wrapper, or launch it yourself with
   `chromium.launchPersistentContext(userDataDir, { args })`.
2. **`unlock()`** — import the seed (`E2E_METAMASK_SEED`) into a fresh profile
   and set `E2E_METAMASK_PASSWORD`.
3. **`connect(page)`** — click the dApp's connect button, then confirm in the
   MetaMask popup (`metaMask.connectToDapp()`).
4. **`switchNetwork(page, chainId)`** — `metaMask.switchNetwork(...)`, adding the
   fork network first if MetaMask doesn't know it.
5. **`signTypedData` / `approveTransaction`** — click Sign / Confirm in the
   popup; return the dApp-visible result.

Because those bodies are contract-checked by `WalletController`, wiring them is
a drop-in replacement — the spec files do not change.

> The exact Synpress API varies by major version. Treat the snippets above as
> the shape of the integration, verify against the Synpress docs for your
> version, and never assume the stub passed anything.

---

## CI

```yaml
# .github/workflows/e2e.yml (sketch)
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run e2e:typecheck
      - run: npx playwright install --with-deps chromium
      # Start a fork + dApp, then run the suite:
      - run: anvil --fork-url "${{ secrets.RPC_URL }}" --chain-id 1 &
      - run: npm run e2e
        env:
          E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
          E2E_METAMASK_SEED: ${{ secrets.E2E_METAMASK_SEED }}
          E2E_METAMASK_PASSWORD: ${{ secrets.E2E_METAMASK_PASSWORD }}
```

Without the secrets the wallet tests skip and only the smoke check runs — the
job stays green but is honest about what it actually verified.

---

## What's verified vs. not

| Item | State |
| --- | --- |
| `@playwright/test` installed, package.json intact | ✅ verified |
| `tsc -p tsconfig.e2e.json --noEmit` | ✅ passes |
| Config / fixtures / spec type-check & load | ✅ verified |
| MetaMask connect / switch / sign / tx | ⛔ **stub only, never run live** |
| Forked-mainnet run | ⛔ requires fork + dApp + RPC key |
