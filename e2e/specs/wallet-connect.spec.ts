/**
 * Wallet E2E spec.
 *
 * DEMO MODE (default): runs for REAL against the local demo dApp
 * (demo-dapp/) with a deterministic EIP-1193 test double injected by the
 * fixtures. connect / switch / sign / send all actually execute and assert.
 * No secrets, no wallet extension, no RPC — so `npm run e2e` passes out of
 * the box.
 *
 * REAL MODE (E2E_METAMASK_SEED + E2E_METAMASK_PASSWORD set): the double is NOT
 * injected and the wallet tests SKIP with an explicit reason — the MetaMask
 * /Synpress driver is still a documented stub (see README-e2e.md). A skip is
 * not a pass; do not green-wash it.
 */
import { expect, hasAppUrl, test, walletMode } from "../fixtures";
import {
  DEMO_ADDRESS,
  DEMO_CHAIN_ID,
  DEMO_SIGNATURE,
  DEMO_SWITCH_CHAIN_ID,
  DEMO_TX_HASH,
} from "../demo-provider";

const demo = walletMode() === "demo";
const REAL_SKIP =
  "Real MetaMask driver is not wired (stub) — see README-e2e.md. " +
  "Run without E2E_METAMASK_* to exercise the demo dApp + injected EIP-1193 test double.";

test.describe("wallet connect flow", () => {
  test.beforeEach(async ({ page }) => {
    // Real mode with no E2E_BASE_URL has no target to load — skip before navigating.
    test.skip(!hasAppUrl(), "No E2E_BASE_URL — real mode has no default dApp target.");
    await page.goto("/");
  });

  test("dApp loads and exposes a connect entrypoint", async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("button", { name: /connect.*wallet/i }).first()).toBeEnabled();
  });

  test("connect wallet: dApp → provider approval → address shown", async ({ page, wallet }) => {
    test.skip(!demo, REAL_SKIP);

    await wallet.connect(page);

    // The address the provider handed back must be rendered by the dApp.
    await expect(page.getByTestId("address")).toHaveText(DEMO_ADDRESS);
    // Scoped to the wallet panel — the address string also appears in the event log.
    await expect(page.locator("#wallet-info").getByText(DEMO_ADDRESS)).toBeVisible();
  });

  test("switch network: dApp reflects the new chain id", async ({ page, wallet }) => {
    test.skip(!demo, REAL_SKIP);

    await wallet.connect(page);
    await expect(page.getByTestId("chain-id")).toHaveText(String(DEMO_CHAIN_ID));

    await wallet.switchNetwork(page, DEMO_SWITCH_CHAIN_ID);
    await expect(page.getByTestId("chain-id")).toHaveText(String(DEMO_SWITCH_CHAIN_ID));
  });

  test("sign: EIP-712 typed-data signature is produced", async ({ page, wallet }) => {
    test.skip(!demo, REAL_SKIP);

    await wallet.connect(page);

    const signature = await wallet.signTypedData(page, { domain: { name: "PreAudit" } });
    expect(signature).toMatch(/^0x[0-9a-f]+$/i);
    expect(signature).toBe(DEMO_SIGNATURE);
    await expect(page.getByTestId("signature")).toHaveText(DEMO_SIGNATURE);
  });

  test("tx: approve a transaction returns a hash", async ({ page, wallet }) => {
    test.skip(!demo, REAL_SKIP);

    await wallet.connect(page);
    await wallet.approveTransaction(page);

    await expect(page.getByTestId("tx-hash")).toHaveText(DEMO_TX_HASH);
  });
});
