/**
 * Demo dApp — vanilla ESM, no build step, no external requests.
 *
 * It only speaks EIP-1193 (`window.ethereum`). In the E2E suite that provider is
 * a local TEST DOUBLE injected by Playwright (see e2e/demo-provider.ts); in a
 * browser with a real wallet it is MetaMask. This app cannot tell the difference
 * — which is the point: the double is protocol-faithful, not a mock of the app.
 *
 * Deliberately CDN-free so `npm run e2e` never touches the network.
 */

const SWITCH_TARGET_CHAIN_ID = 137; // polygon — the demo's "switch to" target

const els = {
  providerState: document.getElementById("provider-state"),
  connect: document.getElementById("connect"),
  info: document.getElementById("wallet-info"),
  address: document.getElementById("address"),
  chainId: document.getElementById("chain-id"),
  actions: document.getElementById("actions"),
  switchBtn: document.getElementById("switch"),
  sign: document.getElementById("sign"),
  send: document.getElementById("send"),
  signature: document.getElementById("signature"),
  txHash: document.getElementById("tx-hash"),
  log: document.getElementById("log"),
};

const provider = typeof window !== "undefined" ? window.ethereum : undefined;

const log = (msg) => {
  els.log.textContent += msg + "\n";
};

if (!provider) {
  els.providerState.textContent =
    "No EIP-1193 provider found (window.ethereum is undefined).";
  els.connect.disabled = true;
} else {
  els.providerState.textContent = provider.isDemoTestDouble
    ? "EIP-1193 provider detected (local test double)."
    : "EIP-1193 provider detected.";
  els.switchBtn.textContent = `Switch to ${SWITCH_TARGET_CHAIN_ID}`;
  init();
}

async function init() {
  // eth_accounts never prompts: it reports an already-authorized session.
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (Array.isArray(accounts) && accounts.length > 0) render(accounts[0]);
  } catch (err) {
    log(`eth_accounts failed: ${err?.message ?? err}`);
  }
  provider.on?.("accountsChanged", (accounts) => render(accounts?.[0]));
  provider.on?.("chainChanged", (chainIdHex) => {
    els.chainId.textContent = String(parseInt(chainIdHex, 16));
  });
}

function render(address) {
  if (address) {
    els.address.textContent = address;
    els.info.hidden = false;
    els.actions.hidden = false;
  } else {
    els.info.hidden = true;
    els.actions.hidden = true;
  }
  refreshChain();
}

async function refreshChain() {
  const chainIdHex = await provider.request({ method: "eth_chainId" });
  els.chainId.textContent = String(parseInt(chainIdHex, 16));
}

els.connect.addEventListener("click", async () => {
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    render(accounts?.[0]);
    log(`connected: ${accounts?.[0]}`);
  } catch (err) {
    log(`connect rejected: ${err?.message ?? err}`);
  }
});

els.switchBtn.addEventListener("click", async () => {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${SWITCH_TARGET_CHAIN_ID.toString(16)}` }],
    });
    await refreshChain();
    log(`switched to chain ${els.chainId.textContent}`);
  } catch (err) {
    log(`switch failed: ${err?.message ?? err}`);
  }
});

els.sign.addEventListener("click", async () => {
  try {
    const typedData = {
      domain: {
        name: "PreAudit",
        version: "1",
        chainId: Number(els.chainId.textContent),
      },
      types: {
        Audit: [
          { name: "target", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "Audit",
      message: { target: els.address.textContent, nonce: 1 },
    };
    const signature = await provider.request({
      method: "eth_signTypedData_v4",
      params: [els.address.textContent, JSON.stringify(typedData)],
    });
    els.signature.textContent = signature;
    log(`signature: ${signature}`);
  } catch (err) {
    log(`sign failed: ${err?.message ?? err}`);
  }
});

els.send.addEventListener("click", async () => {
  try {
    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: els.address.textContent,
          to: els.address.textContent,
          value: "0x0",
        },
      ],
    });
    els.txHash.textContent = hash;
    log(`tx: ${hash}`);
  } catch (err) {
    log(`send failed: ${err?.message ?? err}`);
  }
});
