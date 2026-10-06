/**
 * Playwright config for the E2E suite.
 *
 * TWO WAYS TO RUN
 * ---------------
 * 1) DEMO (default — no secrets, no network): Playwright's `webServer` boots a
 *    tiny local static server for `demo-dapp/` and `baseURL` defaults to it;
 *    fixtures inject a deterministic EIP-1193 TEST DOUBLE. This is what
 *    `npm run e2e` does out of the box — it PASSES.
 *
 * 2) REAL WALLET (opt-in via ENV): set E2E_BASE_URL to your dApp (and
 *    E2E_METAMASK_* for the wallet). The demo server is then NOT started and
 *    the run targets your app. The MetaMask/Synpress driver is still a stub —
 *    see README-e2e.md.
 *
 * ENV contract
 * ------------
 *   E2E_BASE_URL              dApp URL under test (default: the demo server)
 *   DEMO_DAPP_PORT            port for the local demo server (default 4173)
 *   E2E_CHAIN_ID              chain id the suite expects (default 1)
 *   E2E_RPC_URL               RPC the app/anvil fork is reachable at (optional)
 *   E2E_WALLET_ADDRESS        expected EOA address (real mode)
 *   E2E_METAMASK_SEED         seed phrase for a real wallet (real mode)
 *   E2E_METAMASK_PASSWORD     wallet unlock password (real mode)
 *   E2E_METAMASK_EXTENSION    absolute path to unpacked MetaMask ext (optional)
 *   CI                        when set, retries + 1 worker
 */
import { defineConfig, devices } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const isCI = Boolean(process.env.CI);

const DEMO_PORT = Number(process.env.DEMO_DAPP_PORT ?? 4173);
const DEMO_URL = `http://localhost:${DEMO_PORT}/`;

// Real target wins; otherwise the locally-served demo dApp.
const baseURL = process.env.E2E_BASE_URL ?? DEMO_URL;

// Start the demo server only in DEMO mode (no explicit dApp URL, no real wallet ENV).
const hasWalletEnv = Boolean(process.env.E2E_METAMASK_SEED && process.env.E2E_METAMASK_PASSWORD);
const useDemoServer = !process.env.E2E_BASE_URL && !hasWalletEnv;

export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.spec.ts",
  // The REAL MetaMask specs (`*.real.spec.ts`) belong to playwright.real.config.ts
  // and depend on a live MetaMask extension — never run them in the hermetic demo.
  testIgnore: "**/*.real.spec.ts",

  // Wallet flows are stateful (connect → switch → sign → send) and must not
  // race each other.
  fullyParallel: false,
  workers: isCI ? 1 : undefined,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  forbidOnly: isCI,
  retries: isCI ? 2 : 0,

  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  outputDir: "./test-results",

  // Local, dependency-free static server for demo-dapp/ (see e2e/static-server.mjs).
  // Skipped entirely when you point E2E_BASE_URL at your own dApp.
  webServer: useDemoServer
    ? {
        command: `node "${join(HERE, "static-server.mjs")}"`,
        url: DEMO_URL,
        reuseExistingServer: !isCI,
        timeout: 30_000,
        stdout: "pipe",
        stderr: "pipe",
        env: { DEMO_DAPP_PORT: String(DEMO_PORT) },
      }
    : undefined,

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // NOTE: a real MetaMask run needs a *persistent* context with the unpacked
    // extension loaded (chromium.launchPersistentContext + --load-extension).
    // That is provided by the Synpress wrapper / a custom launch, not by this
    // stock project. See README-e2e.md.
  ],
});
