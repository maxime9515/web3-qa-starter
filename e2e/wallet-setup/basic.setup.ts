/**
 * Synpress wallet-setup — REAL MetaMask onboarding for the `e2e:real` mode.
 *
 * Safe by construction:
 *   - The seed phrase is the PUBLIC, well-known hardhat/anvil test mnemonic
 *     (`test … junk`). It is deliberately NOT a secret: it is documented in
 *     Hardhat/Anvil and controls NO funds on any network. Never use a real
 *     seed here — this file is committed.
 *   - The unlock password below is a throwaway for a local throwaway wallet.
 *
 * `npx synpress e2e/wallet-setup` runs this once, onboard a fresh MetaMask with
 * the seed, then caches the browser profile under `.cache-synpress/<hash>/`.
 * The `e2e:real` spec re-uses that cache to boot MetaMask already imported.
 */
import { defineWalletSetup } from "@synthetixio/synpress";
import { MetaMask, getExtensionId } from "@synthetixio/synpress/playwright";
import type { BrowserContext, Page } from "@playwright/test";

/** PUBLIC hardhat/anvil test mnemonic — controls no funds, safe to commit. */
export const SEED_PHRASE =
  "test test test test test test test test test test test junk";

/** Throwaway password for the throwaway wallet. Not a secret. */
export const WALLET_PASSWORD = "Synpress123!";

export default defineWalletSetup(WALLET_PASSWORD, async (rawContext, rawWalletPage) => {
  // Synpress types this callback against its own (older) playwright-core, which
  // differs from @playwright/test's. The objects are compatible at runtime; the
  // cast just bridges the two type identities.
  const context = rawContext as unknown as BrowserContext;
  const walletPage = rawWalletPage as unknown as Page;

  const extensionId = await getExtensionId(context, "MetaMask");
  const metamask = new MetaMask(context, walletPage, WALLET_PASSWORD, extensionId);

  // MetaMask 13.x's Get-Started page only enables the import button once the
  // terms checkbox is ticked; Synpress's importWallet() does not tick it, so the
  // click can time out. Tick it first (best-effort).
  await walletPage
    .locator('[data-testid="onboarding-terms-checkbox"]')
    .click({ timeout: 5_000 })
    .catch(() => {});

  await metamask.importWallet(SEED_PHRASE);

  // MetaMask 13.x ends onboarding on a "Your wallet is ready!" screen that
  // Synpress' importWallet() does not dismiss — leaving the cached profile stuck
  // there (the home page never becomes reachable, so the later unlock fails).
  // Click through it so the cached profile lands on the unlocked wallet home.
  await walletPage
    .getByTestId("onboarding-complete-done")
    .click({ timeout: 10_000 })
    .catch(() => {});
  await walletPage.waitForTimeout(2000);
});
