/**
 * Playwright config for the real-wallet E2E suite.
 *
 * Scope: this config is the SKELETON for the "real wallet on a forked mainnet"
 * flow. It runs as-is against a plain chromium browser; the MetaMask /
 * Synpress wallet wiring is opt-in via ENV (see e2e/fixtures.ts and
 * README-e2e.md). Nothing here forces Synpress to be installed.
 *
 * ENV contract
 * ------------
 *   E2E_BASE_URL              dApp URL under test (default http://localhost:3000)
 *   E2E_CHAIN_ID              chain id the wallet should be on (default 1)
 *   E2E_RPC_URL               RPC the app/anvil fork is reachable at (optional)
 *   E2E_METAMASK_SEED         seed phrase for the wallet (see README for safe handling)
 *   E2E_METAMASK_PASSWORD     wallet unlock password
 *   E2E_METAMASK_EXTENSION    absolute path to an unpacked MetaMask extension (optional)
 *   CI                        when set, retries + fewer workers
 */
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./specs",
  testMatch: "**/*.spec.ts",

  // Wallet flows are stateful (onboarding → connect → sign) and must not race
  // each other against a single MetaMask instance.
  fullyParallel: false,
  workers: isCI ? 1 : undefined,

  // A real-wallet flow is slower than a DOM click: extension boot + RPC round-trips.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  forbidOnly: isCI,
  retries: isCI ? 2 : 0,

  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  outputDir: "./test-results",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
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
    // That is provided by the Synpress wrapper / the custom launch in
    // e2e/fixtures.ts, not by this stock project. See README-e2e.md.
  ],
});
