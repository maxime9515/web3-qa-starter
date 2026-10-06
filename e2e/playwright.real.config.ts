/**
 * Playwright config for the REAL-wallet E2E mode (`npm run e2e:real`).
 *
 * Separate from `playwright.config.ts` (the hermetic DEMO mode) so the two never
 * interfere: the demo run keeps its injected EIP-1193 test double and stays
 * green offline; this config boots a REAL MetaMask extension via Synpress.
 *
 * What it does:
 *   - serves the bundled `demo-dapp/` with the same dependency-free static
 *     server the demo mode uses (so there is always a dApp to drive), unless
 *     `E2E_BASE_URL` points at your own app;
 *   - runs only `*.real.spec.ts` specs, which use
 *     `testWithSynpress(metaMaskFixtures(...))` — that fixture launches a
 *     Chromium *persistent context* with the unpacked MetaMask extension
 *     loaded, restored from the cached onboarding profile produced by
 *     `npx synpress e2e/wallet-setup`.
 *
 * ENV
 *   E2E_BASE_URL   dApp under test (default: the local demo dApp)
 *   DEMO_DAPP_PORT port for the local demo server (default 4173)
 *   HEADLESS       "false" opens a visible browser; default here is headless
 *
 * The wallet is a THROWAWAY MetaMask imported from the PUBLIC hardhat/anvil
 * test mnemonic in `e2e/wallet-setup/basic.setup.ts` — no real secrets.
 */
import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const DEMO_PORT = Number(process.env.DEMO_DAPP_PORT ?? 4173);
const DEMO_URL = `http://localhost:${DEMO_PORT}/`;
const baseURL = process.env.E2E_BASE_URL ?? DEMO_URL;

// Start the local demo server only when no explicit dApp URL is given — the same
// guard the demo config uses, so `E2E_BASE_URL` genuinely points the run at your
// own app instead of silently serving the bundled dApp alongside it.
const useDemoServer = !process.env.E2E_BASE_URL;

// Synpress's MetaMask fixtures honour HEADLESS. Default to headless so the run
// works in CI / no-display environments; set HEADLESS=false for a visible one.
if (process.env.HEADLESS === undefined) process.env.HEADLESS = "true";

export default defineConfig({
  testDir: "./specs",
  // Only the real-wallet specs; the demo specs use a different config.
  testMatch: "**/*.real.spec.ts",

  // A single MetaMask profile cannot be shared by parallel workers.
  fullyParallel: false,
  workers: 1,

  // The MetaMask + persistent-context boot is occasionally torn down by this
  // environment mid-run ("Target page ... closed" / "Failed to open a new tab").
  // One retry re-runs the test in a fresh context so an environmental crash does
  // not read as a product failure. A clean run is still reported as "1 passed".
  retries: 1,

  // Onboarding + popup round-trips are slow on a cold profile.
  timeout: 180_000,
  expect: { timeout: 20_000 },

  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-real" }]],
  outputDir: "./test-results-real",

  webServer: useDemoServer
    ? {
        command: `node "${join(HERE, "static-server.mjs")}"`,
        url: DEMO_URL,
        reuseExistingServer: true,
        timeout: 30_000,
        stdout: "pipe",
        stderr: "pipe",
        env: { DEMO_DAPP_PORT: String(DEMO_PORT) },
      }
    : undefined,

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [{ name: "metamask", use: { browserName: "chromium" } }],
});
