# Real-wallet E2E (Playwright)

E2E suite for the **pre-audit QA for DeFi** service. It drives a dApp through the
wallet flows a mocked UI suite cannot reach — **connect, network switch, EIP-712
sign, transaction** — with a real browser wallet (MetaMask) against a fork, or
**offline** against a bundled demo dApp with an injected EIP-1193 test double.

## Status at a glance

| Mode | What runs | Secrets needed | Live? |
| --- | --- | --- | --- |
| **DEMO** (default) | Bundled `demo-dapp/` + injected **EIP-1193 test double** | none | ✅ **5/5 pass** |
| **REAL** (opt-in) | Your dApp + a real MetaMask wallet on a fork | `E2E_BASE_URL`, `E2E_METAMASK_*`, RPC | ⛔ driver still a stub |

```bash
npm run e2e
# → 5 passed (chromium)   — no secrets, no network, no wallet extension
```

> **Honest scope.** The DEMO mode genuinely exercises the dApp's EIP-1193 code
> path end-to-end (a real `window.ethereum` object, real events, real
> `request()` round-trips) — but the *provider* is a local test double, **not
> MetaMask**. Real MetaMask/Synpress wiring is documented below and is **not yet
> implemented**; the wallet tests skip in REAL mode rather than pretend to pass.

---

## Layout

```
demo-dapp/                 # build-free dApp: connect / switch / sign / send (window.ethereum only)
  index.html, app.js, styles.css
e2e/
  playwright.config.ts     # webServer + demo baseURL, chromium project, ENV contract
  static-server.mjs        # dependency-free static server for demo-dapp/ (no `serve` pkg)
  demo-provider.ts         # ⚠️ EIP-1193 TEST DOUBLE — injected via addInitScript
  fixtures.ts              # test/expect + DemoWallet / MetaMaskWallet + auto-injection
  specs/
    wallet-connect.spec.ts # onboarding, connect, switch network, sign, tx
tsconfig.e2e.json          # separate TS config for e2e (root tsconfig excludes e2e)
```

`e2e` is deliberately kept **out of the root `tsconfig.json`** — the e2e code
needs `@playwright/test` types and DOM libs the library config must not carry:

```bash
npm run e2e:typecheck      # tsc -p tsconfig.e2e.json --noEmit
```

`@playwright/test` is already installed; browsers only need installing once
(`npm run e2e:install`; the local cache already has `chromium-1243`).

---

## Running

```bash
npm run e2e        # playwright test --config=e2e/playwright.config.ts
npm run e2e:demo   # same thing (alias, explicit about the default mode)
npm run demo:serve # just the demo dApp at http://localhost:4173 (browse it manually)
npx playwright test --config=e2e/playwright.config.ts --ui
```

### Two modes, picked automatically from ENV

- **DEMO (default).** No `E2E_METAMASK_*` set → Playwright's `webServer` starts a
  local static server for `demo-dapp/`, `baseURL` points at it, and the fixtures
  inject the EIP-1193 test double into every page *before* any page script runs.
  All five tests run for real and pass.
- **REAL (opt-in).** Set `E2E_METAMASK_SEED` + `E2E_METAMASK_PASSWORD` (and
  `E2E_BASE_URL` to your dApp) → **no** double is injected, the demo server is
  **not** started, and the wallet tests **skip** with an explicit reason (the
  Synpress driver is still a stub). The onboarding smoke test only runs if
  `E2E_BASE_URL` is set. A skip is not a pass — read the report.

### ENV contract

| Var | Meaning | Default |
| --- | --- | --- |
| `E2E_BASE_URL` | dApp under test; **its presence disables the demo server** | – (→ demo dApp) |
| `DEMO_DAPP_PORT` | port for the local demo server | `4173` |
| `E2E_CHAIN_ID` | chain id the suite expects | `1` |
| `E2E_RPC_URL` | RPC for the anvil/Tenderly fork | – |
| `E2E_WALLET_ADDRESS` | expected EOA address | – |
| `E2E_METAMASK_SEED` | wallet seed (REAL mode trigger) | – |
| `E2E_METAMASK_PASSWORD` | wallet unlock password (REAL mode trigger) | – |
| `E2E_METAMASK_EXTENSION` | absolute path to unpacked MetaMask ext | – |
| `CI` | enables retries, 1 worker, github reporter | – |

Never commit a seed phrase. Pass it as a CI secret / local env var only.

---

## The demo dApp + test double (what runs offline)

- **`demo-dapp/`** is a vanilla-ESM dApp with **no build step and no CDN**. It
  speaks only EIP-1193 (`window.ethereum`): a **Connect Wallet** button, then
  address + chain id, plus **Switch network**, **Sign typed data** and **Send
  transaction** buttons that render their results. Anything that serves static
  files can host it — the suite uses `e2e/static-server.mjs` (a ~50-line Node
  server, so there is **no `serve`/`http-server` dependency to download**).
- **`e2e/demo-provider.ts`** is a **deterministic EIP-1193 TEST DOUBLE**, not a
  wallet. It holds **no keys**, stores **no seed**, and makes **no network calls**.
  It answers `eth_requestAccounts`, `eth_accounts`, `eth_chainId`,
  `wallet_switchEthereumChain`, `wallet_addEthereumChain`, `eth_sendTransaction`
  (canned hash), `eth_signTypedData_v4` / `personal_sign` (canned signature) and
  `eth_getBalance` with constants, and emits `accountsChanged` / `chainChanged`.
  It is injected with `context.addInitScript` by the auto-fixture `demoProvider`.

> ⚠️ The double **fabricates a chain**. Never inject it into a run against a real
> network, and never treat its signatures or tx hashes as real. Its only job is
> to be a faithful *protocol* double so the dApp's EIP-1193 handling is covered
> without a browser wallet.

`DemoWallet` (in `fixtures.ts`) implements the same `WalletController` contract
as the real driver, but its methods click the demo dApp's real buttons — so the
tests drive the app's actual UI, not a bypassed shortcut.

---

## Raising a forked mainnet (for the REAL path)

Use [Foundry](https://book.getfoundry.sh) Anvil, or Tenderly Virtual TestNets:

```bash
anvil --fork-url "$RPC_URL" --chain-id 1        # fork mainnet through your RPC
# or a Tenderly Virtual TestNet:
export E2E_RPC_URL="https://virtual.mainnet.rpc.tenderly.co/<id>"
```

Then point the dApp at the same fork and set `E2E_BASE_URL`. A fork gives real
token balances and contract code without spending mainnet gas.

---

## Wiring a real MetaMask wallet (Synpress) — NOT done yet

Synpress is intentionally **not** a dependency of this repo (heavy; pins its own
Playwright + MetaMask build). Install it only when you want a real run:

```bash
npm i -D @synthetixio/synpress
npx synpress install-metamask       # downloads the pinned MetaMask extension
```

Then replace the stub bodies in `MetaMaskWallet` (`e2e/fixtures.ts`):

1. **Boot context** — MetaMask needs a *persistent* context with the unpacked
   extension loaded (`--disable-extensions-except` + `--load-extension`, pointed
   at `E2E_METAMASK_EXTENSION` or Synpress's path), via
   `chromium.launchPersistentContext(userDataDir, { args })` or Synpress's
   `testWithSynpress` / `metaMaskFixtures` wrapper.
2. **`unlock()`** — import `E2E_METAMASK_SEED`, set `E2E_METAMASK_PASSWORD`.
3. **`connect(page)`** — click the dApp's connect button, confirm in the popup.
4. **`switchNetwork(page, chainId)`** — add the fork network if unknown, switch.
5. **`signTypedData` / `approveTransaction`** — click Sign / Confirm in the popup.

Because those bodies are contract-checked by `WalletController`, wiring them is
a drop-in replacement — the spec files do not change. The exact Synpress API
varies by major version; verify against its docs and never assume a stub passed.

---

## CI

```yaml
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
      # DEMO mode: no secrets, no network, deterministic. The webServer starts itself.
      - run: npm run e2e
```

This green run is **real**: the demo dApp is served and driven by the injected
double. For the REAL path, add `E2E_BASE_URL` + `E2E_METAMASK_*` secrets and a
fork — without them the wallet tests skip, and the job stays honest.

---

## What's verified vs. not

| Item | State |
| --- | --- |
| `npm run e2e:typecheck` | ✅ passes |
| `npm run e2e` (DEMO: demo dApp + injected EIP-1193 test double) | ✅ **5 passed / 0 skipped** |
| connect / switch / sign / send against the demo dApp | ✅ run live, asserted |
| Static server path-traversal guard | ✅ 403/404 (verified with curl) |
| Real MetaMask connect / switch / sign / tx | ⛔ **stub only — never run live** |
| Forked-mainnet run with a real wallet | ⛔ requires fork + dApp + RPC key + Synpress |
