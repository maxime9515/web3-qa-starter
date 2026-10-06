# Real-wallet E2E (Playwright)

E2E suite for the **pre-audit QA for DeFi** service. It drives a dApp through the
wallet flows a mocked UI suite cannot reach — **connect, network switch, EIP-712
sign, transaction** — with a real browser wallet (MetaMask) against a fork, or
**offline** against a bundled demo dApp with an injected EIP-1193 test double.

## Status at a glance

| Mode | Command | What runs | Secrets | Status |
| --- | --- | --- | --- | --- |
| **DEMO** (default) | `npm run e2e` | Bundled `demo-dapp/` + injected **EIP-1193 test double** | none | ✅ **5 passed / 0 skipped** |
| **REAL** | `npm run e2e:real` | Bundled `demo-dapp/` + a **LIVE MetaMask 13.13.1** extension (Synpress) | none (public test mnemonic) | ⚠️ **1 passed / 2 skipped (blocked)** |

```bash
npm run e2e            # → 5 passed (chromium) — no secrets, no network, no wallet extension
npm run e2e:real       # → 1 passed, 2 skipped — boots a real MetaMask (see below)
```

> **Honest scope.**
> * **DEMO** genuinely exercises the dApp's EIP-1193 code path end-to-end, but the
>   *provider* is a local test double, **not** MetaMask.
> * **REAL** really boots the MetaMask extension (v13.13.1, Synpress' pinned build)
>   inside a Chromium persistent context; the wallet-setup onboards it from the
>   **public hardhat/anvil test mnemonic** (`e2e/wallet-setup/basic.setup.ts`). The
>   passing test verifies that an **unlocked account is present** and that the dApp
>   receives a **real** `window.ethereum` (`isMetaMask: true`) answering
>   `eth_chainId`. It does **not** assert the exact account address (the wallet UI
>   hides it and `eth_accounts` is empty until the dApp is connected — which needs
>   the blocked approval popup).
> * The wallet **approval popups** — `connect` and `sign` — are **BLOCKED** in this
>   environment: MetaMask's `notification.html` popup is never surfaced, so
>   `metamask.connectToDapp()` / `confirmSignature()` time out. Those two tests are
>   `test.fixme` (visible skips), **not** passes. Full write-up below.

---

## Layout

```
demo-dapp/                 # build-free dApp: connect / switch / sign / send (window.ethereum only)
  index.html, app.js, styles.css
e2e/
  playwright.config.ts     # DEMO config: webServer + demo baseURL, chromium project, ENV contract
  playwright.real.config.ts# REAL config: boots MetaMask (Synpress), runs *.real.spec.ts only
  static-server.mjs        # dependency-free static server for demo-dapp/ (no `serve` pkg)
  demo-provider.ts         # ⚠️ EIP-1193 TEST DOUBLE — injected via addInitScript (DEMO only)
  fixtures.ts              # DEMO test/expect + DemoWallet + auto-injection
  wallet-setup/
    basic.setup.ts         # Synpress wallet-setup: imports the PUBLIC test mnemonic (REAL)
  specs/
    wallet-connect.spec.ts      # DEMO: onboarding, connect, switch network, sign, tx
    wallet-connect.real.spec.ts # REAL: live MetaMask (Synpress metaMaskFixtures)
tsconfig.e2e.json          # separate TS config for e2e (root tsconfig excludes e2e)
.cache-synpress/           # git-ignored: downloaded MetaMask extension + cached wallet profile
```

`e2e` is deliberately kept **out of the root `tsconfig.json`** — the e2e code
needs `@playwright/test` types and DOM libs the library config must not carry:

```bash
npm run e2e:typecheck      # tsc -p tsconfig.e2e.json --noEmit
```

---

## Running

### DEMO (default, hermetic)

```bash
npm run e2e        # playwright test --config=e2e/playwright.config.ts
npm run e2e:demo   # same thing (alias, explicit about the default mode)
npm run demo:serve # just the demo dApp at http://localhost:4173 (browse it manually)
```

No `E2E_BASE_URL` set → Playwright's `webServer` starts a local static server
for `demo-dapp/`, `baseURL` points at it, and `fixtures.ts` injects the EIP-1193
test double into every page *before* any page script runs. **All five tests run
for real and pass.** The REAL specs (`*.real.spec.ts`) are excluded via
`testIgnore` so they can never leak into the hermetic run.

### REAL (live MetaMask via Synpress)

```bash
# one-time setup
npm run e2e:real:install     # Chromium build for Synpress' pinned playwright-core@1.48.2
npm run e2e:real:setup       # `synpress e2e/wallet-setup` — downloads MetaMask 13.13.1
                             # and caches an onboarded profile under .cache-synpress/

# run
npm run e2e:real             # playwright test --config=e2e/playwright.real.config.ts
HEADLESS=false npm run e2e:real   # same, with a visible browser window
```

The REAL config serves the same bundled `demo-dapp/` (unless `E2E_BASE_URL`
points at your own app), then `e2e/specs/wallet-connect.real.spec.ts` uses
Synpress' `testWithSynpress(metaMaskFixtures(basicSetup))`. That fixture launches
a Chromium **persistent context** with the unpacked MetaMask extension loaded and
restored from the cached, already-onboarded profile, then unlocks it.

> The cached profile is keyed by a hash of the wallet-setup function's source. If
> you edit `e2e/wallet-setup/basic.setup.ts`, **re-run `npm run e2e:real:setup`** —
> otherwise you get `Cache for <hash> does not exist`.

---

## Real MetaMask — what works and what is blocked

### ✅ Verified (the passing REAL test)

| Assertion | How |
| --- | --- |
| MetaMask 13.13.1 extension boots in a persistent Chromium context | Synpress `metaMaskFixtures` |
| An **unlocked account is present** (the wallet-setup onboards it from the public hardhat/anvil test mnemonic — `e2e/wallet-setup/basic.setup.ts`) | MetaMask' own home UI shows an account, not the lock screen. The exact account address is **not** asserted (see note). |
| The dApp receives a **real** EIP-1193 provider | `window.ethereum.isMetaMask === true` |
| The provider answers a real call | `eth_chainId` returns a live hex chain id |

> **Note on the account.** The wallet is onboarded from the public test mnemonic,
> but the passing test asserts only that an **unlocked account is present** — not
> that it equals account #0 of that mnemonic. MetaMask' home UI does not render the
> address as readable text, and `eth_accounts` returns `[]` until the dApp is
> connected (which requires the approval popup that is blocked here), so the exact
> address cannot be asserted reliably in this environment.

### ⛔ Blocked: connect & sign approval popups

`metamask.connectToDapp()` and `metamask.confirmSignature()` fail with:

```
[getNotificationPageAndWaitForLoad] Notification page did not appear after 10000ms and 2 retries.
```

Diagnosis (verified with a throwaway instrumentation spec):

* The dApp raises `eth_requestAccounts`; `window.ethereum` is present
  (`isMetaMask: true`) and MetaMask' MV3 service worker (`scripts/app-init.js`)
  is alive.
* **No `notification.html` page/window is ever created** — a `context.on("page")`
  listener never fires for it, in **both** headless and headed mode, and polled
  `context.pages()` is unchanged for 15s. So the popup MetaMask uses to approve a
  connection/signature never surfaces under this Chromium/Playwright setup.
* This is a MetaMask-UI ↔ automation-environment issue, not a test bug and not a
  secret/config problem.

`wallet-connect.real.spec.ts` keeps `connect` and `sign` as **`test.fixme`** with
that reason — a visible, honest skip.

### ⛔ Cache-build flakiness (worked around)

Synpress' `npx synpress <wallet-setup-dir>` cache build is flaky here: its
onboarding clicks intermittently time out, and its `launchPersistentContext`
(which passes **both** `--disable-extensions-except` and `--load-extension`) can
hang. Notes worth keeping:

* MetaMask's Get-Started page only enables the import button once the terms
  checkbox is ticked; Synpress' `importWallet()` does not tick it — `basic.setup.ts`
  ticks it first.
* MetaMask 13.x ends onboarding on a "Your wallet is ready!" screen Synpress does
  not dismiss — `basic.setup.ts` clicks `onboarding-complete-done`.
* **Two `playwright-core` versions coexist**: `@playwright/test@1.63` (chromium
  1243) and Synpress' `playwright-core@1.48.2` (chromium **1140**). The cache is
  built with 1140 (`npm run e2e:real:install` provides it) — do **not** "unify"
  them with an npm `override`: chromium 1243 fails to load a fresh unpacked
  extension in headless and **hangs** in headed mode with
  `--disable-extensions-except`.

### 🧭 Alternative path (no cache): direct `launchPersistentContext`

If the Synpress cache flow is unusable, the same result is reachable directly —
launch a persistent context and onboard in-session, using Synpress' own page
objects:

```ts
import { chromium } from "@playwright/test";
import { MetaMask, getExtensionId, unlockForFixture } from "@synthetixio/synpress/playwright";
import { prepareExtension } from "@synthetixio/synpress-cache";

const extensionPath = await prepareExtension();          // downloads MetaMask if needed
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  // headless: add "--headless=new" — but see the chromium-version caveat above.
});
const extensionId = await getExtensionId(context, "MetaMask");
const walletPage = context.pages()[0] ?? (await context.newPage());
await walletPage.goto(`chrome-extension://${extensionId}/home.html`);
const metamask = new MetaMask(context, walletPage, WALLET_PASSWORD, extensionId);
await metamask.importWallet(SEED_PHRASE);                 // ticks terms + imports
await unlockForFixture(walletPage, WALLET_PASSWORD);      // unlock
```

This was verified to onboard a fresh throwaway profile successfully; it is the
fallback if a future Synpress release regresses the cache flow.

---

## ENV contract

| Var | Meaning | Default |
| --- | --- | --- |
| `E2E_BASE_URL` | dApp under test; **its presence disables the demo server** (both configs) | – (→ demo dApp) |
| `DEMO_DAPP_PORT` | port for the local demo server | `4173` |
| `E2E_CHAIN_ID` | chain id the suite expects | `1` |
| `E2E_RPC_URL` | RPC for the anvil/Tenderly fork | – |
| `E2E_WALLET_ADDRESS` | expected EOA address (only read by the unused real-mode skeleton fixture) | – |
| `HEADLESS` | REAL mode: `"true"` runs `--headless=new`; default is headless | `true` |
| `CI` | enables retries, 1 worker, github reporter | – |

There is **no seed/password/extension ENV**. The REAL suite needs none: it onboards
from the **public** hardhat/anvil test mnemonic (`test … junk`) and a throwaway
password hardcoded in `e2e/wallet-setup/basic.setup.ts` — a throwaway that controls
no funds. Never commit a real seed phrase.

The REAL config (`playwright.real.config.ts`) sets **`retries: 1`** to absorb an
environmental flake (MetaMask occasionally tears the browser down mid-run).
Playwright reports a retry-pass as **flaky**, not as a clean pass — so read the REAL
result as "1 passed · 2 skipped" only when no `flaky` line appears; a `flaky` line
means the green came from a retry, not a first-try pass.

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
  It is injected with `context.addInitScript` by the auto-fixture `demoProvider`.

> ⚠️ The double **fabricates a chain**. Never inject it into a run against a real
> network, and never treat its signatures or tx hashes as real.

---

## Raising a forked mainnet (for the REAL path)

```bash
anvil --fork-url "$RPC_URL" --chain-id 1        # fork mainnet through your RPC
# or a Tenderly Virtual TestNet:
export E2E_RPC_URL="https://virtual.mainnet.rpc.tenderly.co/<id>"
```

Then point the dApp at the same fork and set `E2E_BASE_URL`.

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

The DEMO job stays hermetic and green. `npm run e2e:real` needs a network fetch
of the MetaMask extension and is not wired into CI; its connect/sign popups are
blocked in this environment (above).

---

## What's verified vs. not

| Item | State |
| --- | --- |
| `npm run e2e:typecheck` | ✅ passes |
| `npm run e2e` (DEMO: demo dApp + injected EIP-1193 test double) | ✅ **5 passed / 0 skipped** |
| `npm run e2e:real` — live MetaMask boots + is unlocked (account present) + injects a real EIP-1193 provider | ✅ **1 passed** |
| REAL `connect` (approval popup) | ⛔ **blocked** — MetaMask notification popup never surfaces (`test.fixme`) |
| REAL `sign` (approval popup) | ⛔ **blocked** — same root cause (`test.fixme`) |
| REAL `switchNetwork` / `tx` | — **not implemented in the real spec** (DEMO only; the real suite covers `connect` + `sign`) |
| Static server path-traversal guard | ✅ 403/404 (verified with curl) |
| Forked-mainnet run with a real wallet | ⛔ requires fork + dApp + RPC key |
