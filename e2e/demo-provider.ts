/**
 * DETERMINISTIC EIP-1193 TEST DOUBLE — NOT A WALLET.
 *
 * ============================================================================
 * This module is a LOCAL, IN-PAGE STUB injected with `context.addInitScript`.
 * It is NOT MetaMask, holds NO private keys, stores NO seed phrase, and makes
 * NO network / RPC calls. Every response below is canned so the E2E suite can
 * exercise the demo dApp's connect / switch / sign / send flows offline and
 * deterministically.
 *
 * It fabricates a chain. NEVER inject it into a run against a real network and
 * never treat its signatures or tx hashes as real. Its only job is to be a
 * faithful *protocol* double for `window.ethereum` so the dApp's EIP-1193
 * handling can be tested without a real wallet.
 * ============================================================================
 */

/** A clearly-fake, non-owned EOA address returned by the double. */
export const DEMO_ADDRESS = "0x1111111111111111111111111111111111111111";
/** "mainnet" as a bare number — the double attaches no real meaning to it. */
export const DEMO_CHAIN_ID = 1;
/** Target the demo dApp's "Switch network" button asks for (polygon). */
export const DEMO_SWITCH_CHAIN_ID = 137;
/** Deterministic fake hash (32 bytes) returned by `eth_sendTransaction`. */
export const DEMO_TX_HASH = "0x" + "ab".repeat(32);
/** Deterministic fake signature (65 bytes) returned by the sign methods. */
export const DEMO_SIGNATURE = "0x" + "cd".repeat(65);

export interface DemoProviderConfig {
  address: string;
  chainId: number;
  switchChainId: number;
  txHash: string;
  signature: string;
}

export const DEMO_PROVIDER_CONFIG: DemoProviderConfig = {
  address: DEMO_ADDRESS,
  chainId: DEMO_CHAIN_ID,
  switchChainId: DEMO_SWITCH_CHAIN_ID,
  txHash: DEMO_TX_HASH,
  signature: DEMO_SIGNATURE,
};

/**
 * Plain-JS source for the double (no TS syntax in the emitted string), safe to
 * pass to Playwright as `addInitScript({ content })`. Runs before any page
 * script, so the dApp always sees `window.ethereum` from the first line.
 */
export function demoProviderInitScript(config: DemoProviderConfig = DEMO_PROVIDER_CONFIG): string {
  return `(() => {
  "use strict";
  // --- TEST DOUBLE. No keys, no network. See e2e/demo-provider.ts header. ---
  const cfg = ${JSON.stringify(config)};
  const accounts = [];
  let chainId = cfg.chainId;
  const listeners = Object.create(null);

  const emit = (event, ...args) => {
    (listeners[event] || []).forEach((handler) => {
      try { handler(...args); } catch (_) { /* ignore listener errors */ }
    });
  };
  const hex = (n) => "0x" + Number(n).toString(16);

  const provider = {
    isMetaMask: false,            // explicitly NOT MetaMask
    isDemoTestDouble: true,       // dApp can show "test double" in its UI
    request: async ({ method, params }) => {
      switch (method) {
        case "eth_requestAccounts":
          if (accounts.length === 0) {
            accounts.push(cfg.address);
            emit("accountsChanged", [cfg.address]);
          }
          return accounts.slice();
        case "eth_accounts":
          return accounts.slice();
        case "eth_chainId":
          return hex(chainId);
        case "net_version":
          return String(chainId);
        case "wallet_switchEthereumChain": {
          const requested = (params && params[0]) || {};
          const raw = requested.chainId;
          const next = typeof raw === "string" ? parseInt(raw, 16) : Number(raw);
          if (Number.isFinite(next)) {
            chainId = next;
            emit("chainChanged", hex(chainId));
          }
          return null;
        }
        case "wallet_addEthereumChain":
          return null;
        case "eth_sendTransaction":
          return cfg.txHash;
        case "eth_signTypedData":
        case "eth_signTypedData_v4":
        case "personal_sign":
          return cfg.signature;
        case "eth_getBalance":
          return "0xde0b6b3a7640000"; // 1 ETH, fake
        default:
          throw new Error("demo provider (test double): unsupported method " + method);
      }
    },
    on: (event, handler) => {
      (listeners[event] = listeners[event] || []).push(handler);
      return provider;
    },
    removeListener: (event, handler) => {
      listeners[event] = (listeners[event] || []).filter((h) => h !== handler);
      return provider;
    },
    removeAllListeners: () => {
      for (const key in listeners) delete listeners[key];
      return provider;
    },
  };

  Object.defineProperty(window, "ethereum", {
    value: provider,
    configurable: true,
    writable: true,
  });
  window.__DEMO_PROVIDER__ = true;
  window.dispatchEvent(new Event("ethereum#initialized"));
})();`;
}
