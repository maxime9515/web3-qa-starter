/**
 * Playwright fixtures for the E2E suite.
 *
 * TWO MODES, chosen automatically from ENV:
 *
 *   DEMO MODE (default — no secrets):
 *     Playwright's webServer serves `demo-dapp/` locally and a deterministic
 *     EIP-1193 TEST DOUBLE (`e2e/demo-provider.ts`) is injected into the
 *     browser before any page script runs. connect / switch / sign / send all
 *     execute for real against the dApp — offline, deterministic, no keys, no
 *     RPC. `npm run e2e` exercises this out of the box and it PASSES.
 *
 *   REAL MODE (E2E_METAMASK_SEED + E2E_METAMASK_PASSWORD set):
 *     NO double is injected — behaviour is as before. The MetaMask/Synpress
 *     driver is still a documented stub (see README-e2e.md); the wallet specs
 *     skip with an explicit reason rather than pretend to pass.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { DEMO_ADDRESS, DEMO_CHAIN_ID, demoProviderInitScript } from "./demo-provider";

export {
  DEMO_ADDRESS,
  DEMO_CHAIN_ID,
  DEMO_SWITCH_CHAIN_ID,
  DEMO_TX_HASH,
  DEMO_SIGNATURE,
} from "./demo-provider";

/** Thrown by every real-wallet action until a real driver is wired in. */
export class WalletNotConfiguredError extends Error {
  constructor(action: string) {
    super(
      `Wallet action "${action}" is not implemented: this is a skeleton fixture. ` +
        `Wire Synpress (or an equivalent MetaMask driver) — see README-e2e.md.`,
    );
    this.name = "WalletNotConfiguredError";
  }
}

export interface WalletEnv {
  /** EOA address the wallet should end up controlling. */
  address: string;
  /** MetaMask unlock password. */
  password: string;
  /** Seed phrase. Handle via CI secret, never commit. */
  seedPhrase: string;
  /** Absolute path to an unpacked MetaMask extension (optional). */
  extensionPath?: string;
  /** Chain id the suite expects to operate on. */
  chainId: number;
  /** RPC the app + wallet should be pointed at (fork/anvil/tenderly). */
  rpcUrl?: string;
}

const DEFAULT_CHAIN_ID = 1; // mainnet

/** Read the whole wallet ENV contract into one typed object. */
export function readWalletEnv(): WalletEnv {
  return {
    address: process.env.E2E_WALLET_ADDRESS ?? "",
    password: process.env.E2E_METAMASK_PASSWORD ?? "",
    seedPhrase: process.env.E2E_METAMASK_SEED ?? "",
    extensionPath: process.env.E2E_METAMASK_EXTENSION,
    chainId: Number(process.env.E2E_CHAIN_ID ?? DEFAULT_CHAIN_ID),
    rpcUrl: process.env.E2E_RPC_URL,
  };
}

/** True when there is enough ENV to boot a real wallet (seed + password). */
export function hasWalletEnv(env: WalletEnv = readWalletEnv()): boolean {
  return env.seedPhrase.length > 0 && env.password.length > 0;
}

/**
 * Which suite is in play:
 *   "real" when a real-wallet ENV is present, otherwise "demo".
 */
export type WalletMode = "demo" | "real";

export function walletMode(env: WalletEnv = readWalletEnv()): WalletMode {
  return hasWalletEnv(env) ? "real" : "demo";
}

/** True when a dApp target is reachable (demo server, or an explicit E2E_BASE_URL). */
export function hasAppUrl(): boolean {
  return Boolean(process.env.E2E_BASE_URL) || walletMode() === "demo";
}

export interface WalletController {
  readonly address: string;
  readonly chainId: number;

  /** Onboarding: import the seed into a fresh wallet / unlock it. */
  unlock(): Promise<void>;

  /** Click "Connect Wallet" (or equivalent) in the dApp and approve in MetaMask. */
  connect(page: Page): Promise<void>;

  /** Move the wallet onto `chainId`, adding the network if unknown. */
  switchNetwork(page: Page, chainId: number): Promise<void>;

  /** Approve an EIP-712 / personal_sign request the dApp raised. */
  signTypedData(page: Page, typedData: unknown): Promise<string>;

  /** Confirm a pending transaction popup in MetaMask. */
  approveTransaction(page: Page): Promise<void>;
}

/**
 * REAL-MODE controller — SKELETON. Compiles and can be constructed, but every
 * action throws until a real driver (Synpress or equivalent) replaces the
 * bodies. The TODO comments spell out exactly what Synpress calls go here.
 */
export class MetaMaskWallet implements WalletController {
  readonly address: string;
  readonly chainId: number;

  constructor(private readonly env: WalletEnv) {
    this.address = env.address;
    this.chainId = env.chainId;
  }

  async unlock(): Promise<void> {
    // TODO(synpress): metaMask.setup({ seed: this.env.seedPhrase, password: this.env.password })
    // TODO(synpress): metaMask.unlock(); wait for the popup network indicator.
    throw new WalletNotConfiguredError("unlock");
  }

  async connect(_page: Page): Promise<void> {
    // TODO(synpress): await metaMask.connectToDapp(); await walletPage.getByTestId('confirm').click()
    throw new WalletNotConfiguredError("connect");
  }

  async switchNetwork(_page: Page, _chainId: number): Promise<void> {
    // TODO(synpress): await metaMask.switchNetwork('mainnet') or
    // metaMask.addNetwork({ chainId, rpcUrl: this.env.rpcUrl, ... }) for a fork.
    throw new WalletNotConfiguredError("switchNetwork");
  }

  async signTypedData(_page: Page, _typedData: unknown): Promise<string> {
    // TODO(synpress): click Sign; return the signature surfaced by the dApp.
    throw new WalletNotConfiguredError("signTypedData");
  }

  async approveTransaction(_page: Page): Promise<void> {
    // TODO(synpress): click Confirm on the MetaMask tx popup; wait for success.
    throw new WalletNotConfiguredError("approveTransaction");
  }
}

/**
 * DEMO-MODE controller. Drives the demo dApp through its real UI; the EIP-1193
 * test double (injected by the `demoProvider` auto-fixture) answers every
 * request. No wallet extension, no keys, no network.
 */
export class DemoWallet implements WalletController {
  readonly address = DEMO_ADDRESS;
  readonly chainId = DEMO_CHAIN_ID;

  /** No onboarding: the double is already present via addInitScript. */
  async unlock(): Promise<void> {
    /* no-op by design */
  }

  async connect(page: Page): Promise<void> {
    await page.getByRole("button", { name: /connect.*wallet/i }).first().click();
  }

  async switchNetwork(page: Page, _chainId: number): Promise<void> {
    await page.getByRole("button", { name: /switch/i }).first().click();
  }

  async signTypedData(page: Page, _typedData: unknown): Promise<string> {
    await page.getByRole("button", { name: /sign/i }).first().click();
    return (await page.locator("#signature").textContent())?.trim() ?? "";
  }

  async approveTransaction(page: Page): Promise<void> {
    await page.getByRole("button", { name: /send.*transaction/i }).first().click();
  }
}

type WalletFixtures = {
  walletMode: WalletMode;
  walletEnv: WalletEnv;
  wallet: WalletController;
  /** Auto-fixture: injects the EIP-1193 test double in demo mode only. */
  demoProvider: void;
};

/**
 * Extended test. Import `{ test, expect }` from this file, never directly
 * from @playwright/test, so specs get the wallet fixtures + demo injection.
 */
export const test = base.extend<WalletFixtures>({
  walletMode: async ({}, use) => {
    await use(walletMode());
  },

  walletEnv: async ({}, use) => {
    await use(readWalletEnv());
  },

  demoProvider: [
    async ({ context, walletEnv }, use) => {
      if (walletMode(walletEnv) === "demo") {
        await context.addInitScript({ content: demoProviderInitScript() });
      }
      await use();
    },
    { auto: true },
  ],

  wallet: async ({ walletEnv }, use) => {
    await use(walletMode(walletEnv) === "demo" ? new DemoWallet() : new MetaMaskWallet(walletEnv));
  },
});

export { expect };
