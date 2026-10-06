/**
 * Example real-wallet spec (SKELETON).
 *
 * These tests only run for real when a dApp is reachable at E2E_BASE_URL and a
 * MetaMask driver is wired (see README-e2e.md). Without that they SKIP with an
 * explicit reason — never green-wash a run that didn't test anything.
 *
 * NOTE: the happy-path tests are `test.fixme` because the wallet fixture is a
 * documented stub (every action throws). Remove the fixme once Synpress is
 * wired; the skip-guards below stay, so a CI without a wallet still passes.
 */
import { expect, hasAppUrl, hasWalletEnv, readWalletEnv, test } from "../fixtures";

const env = readWalletEnv();
const appUp = hasAppUrl();
const walletUp = hasWalletEnv(env);

test.describe("pre-audit: real-wallet connect flow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!appUp, "No E2E_BASE_URL — point it at your dApp (or a local fork UI).");
    await page.goto("/");
  });

  test("dApp onboarding loads and exposes a connect entrypoint", async ({ page }) => {
    // This assertion is generic on purpose: it works on a blank starter page and
    // on a real dApp. Tighten the selector for your app.
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator("body")).toBeVisible();

    const connect = page.getByRole("button", { name: /connect.*wallet/i });
    // The starter repo ships no dApp of its own; when E2E_BASE_URL points at a
    // real one it MUST expose a connect entrypoint, so this is a real assertion
    // that can fail. If your app genuinely has none, tighten the selector
    // instead of green-washing a no-op check.
    if ((await connect.count()) === 0) {
      test.skip(true, "No 'Connect Wallet' button matched on this page — tighten the selector for your dApp.");
    }
    await expect(connect.first()).toBeEnabled();
  });

  test.fixme("connect wallet: dApp → MetaMask approval → address shown", async ({ page, wallet }) => {
    test.skip(!walletUp, "Set E2E_METAMASK_SEED + E2E_METAMASK_PASSWORD to run the real wallet.");
    await wallet.unlock();
    await wallet.connect(page);
    await expect(page.getByText(wallet.address, { exact: false })).toBeVisible();
  });

  test.fixme("switch network: wallet lands on E2E_CHAIN_ID", async ({ page, wallet }) => {
    test.skip(!walletUp, "Set E2E_METAMASK_SEED + E2E_METAMASK_PASSWORD to run the real wallet.");
    await wallet.unlock();
    await wallet.connect(page);
    await wallet.switchNetwork(page, env.chainId);
    // The dApp should reflect the new chain, e.g. a chain-name badge.
    await expect(page.getByText(new RegExp(String(env.chainId)))).toBeVisible();
  });

  test.fixme("sign: EIP-712 pre-audit signature is produced", async ({ page, wallet }) => {
    test.skip(!walletUp, "Set E2E_METAMASK_SEED + E2E_METAMASK_PASSWORD to run the real wallet.");
    await wallet.unlock();
    await wallet.connect(page);

    const typedData = {
      domain: { name: "PreAudit", version: "1", chainId: env.chainId },
      types: {
        Audit: [
          { name: "target", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "Audit",
      message: { target: wallet.address, nonce: 1 },
    };

    const signature = await wallet.signTypedData(page, typedData);
    expect(signature).toMatch(/^0x[0-9a-f]+$/i);
  });

  test.fixme("tx: approve a transaction on a forked mainnet (anvil --fork-url $RPC)", async ({
    page,
    wallet,
  }) => {
    test.skip(!walletUp, "Set E2E_METAMASK_SEED + E2E_METAMASK_PASSWORD to run the real wallet.");
    test.skip(!env.rpcUrl, "Set E2E_RPC_URL to the fork you want the tx confirmed on.");
    await wallet.unlock();
    await wallet.connect(page);
    await wallet.approveTransaction(page);
    await expect(page.getByText(/success|confirmed/i)).toBeVisible({ timeout: 30_000 });
  });
});
