/**
 * Real-wallet fixtures for the pre-audit DeFi E2E suite.
 *
 * WHAT IS REAL HERE (type-checked, runs):
 *   - the ENV contract (readWalletEnv / hasWalletEnv / hasAppUrl)
 *   - the WalletController interface and the fixture wiring around it
 *
 * WHAT IS A SKELETON — NOT verified live:
 *   - the MetaMask / Synpress driver. Synpress is intentionally NOT a
 *     dependency of this repo (heavy, pulls its own Playwright + a pinned
 *     MetaMask build). See README-e2e.md → "Wiring a real MetaMask wallet"
 *     for the exact install/setup. Every WalletController method below is a
 *     documented stub that throws WalletNotConfiguredError until you wire one
 *     (Synpress or an equivalent driver). They have never been executed here.
 */
import { test as base, expect, type Page } from "@playwright/test";

/** Thrown by every wallet action until a real driver is wired in. */
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

/** True when a dApp target is explicitly configured (E2E_BASE_URL set). */
export function hasAppUrl(): boolean {
  return Boolean(process.env.E2E_BASE_URL);
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
 * Skeleton implementation. Compiles and can be constructed, but every action
 * throws until a real driver replaces the bodies. The TODO comments spell out
 * exactly what Synpress calls go here.
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

type WalletFixtures = {
  walletEnv: WalletEnv;
  wallet: WalletController;
};

/**
 * Extended test. Import `{ test, expect }` from this file, never directly
 * from @playwright/test, so specs get the wallet fixtures.
 *
 * The wallet fixture is lazy: constructing it does not touch MetaMask, so
 * specs that skip on missing ENV still type-check and run to the skip.
 */
export const test = base.extend<WalletFixtures>({
  walletEnv: async ({}, use) => {
    await use(readWalletEnv());
  },
  wallet: async ({ walletEnv }, use) => {
    await use(new MetaMaskWallet(walletEnv));
  },
});

export { expect };
