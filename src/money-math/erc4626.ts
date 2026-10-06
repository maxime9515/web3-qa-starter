/**
 * ERC-4626 tokenized-vault share math, in exact bigint.
 *
 * Source: EIP-4626 (eips.ethereum.org/EIPS/eip-4626). Rounding rules the
 * standard mandates and that decide who eats the rounding dust:
 *
 *   convertToShares   MUST round DOWN
 *   convertToAssets   MUST round DOWN
 *   previewDeposit    MUST round DOWN (fewer shares)
 *   previewMint       MUST round UP   (user pays more)
 *   previewWithdraw   MUST round UP   (user burns more shares)
 *   previewRedeem     MUST round DOWN (fewer assets out)
 *
 * Ordering rule: preview* results are always in favour of the VAULT, never
 * the user, so an integration cannot be drained by rounding in a loop.
 *
 * When totalSupply == 0 the vault is fresh: shares mint 1:1 with assets.
 * A vault with totalSupply > 0 but totalAssets == 0 is degenerate (fully
 * drained / donation-shrunk) and any share lookup is undefined → we throw.
 */

/** a / b rounded UP (integer ceiling division). */
export function divCeil(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error("divCeil: division by zero");
  return (a + b - 1n) / b;
}

/** assets → shares, rounded DOWN. Fresh vault (no supply) is 1:1. */
export function convertToShares(assets: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  if (assets < 0n) throw new Error("convertToShares: negative assets");
  if (totalSupply === 0n) return assets; // first depositor: 1 share per asset
  if (totalAssets === 0n) {
    throw new Error("convertToShares: vault has supply>0 but assets==0 (degenerate)");
  }
  return (assets * totalSupply) / totalAssets; // floor
}

/** shares → assets, rounded DOWN. */
export function convertToAssets(shares: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  if (shares < 0n) throw new Error("convertToAssets: negative shares");
  if (totalSupply === 0n) return shares; // fresh vault: 1:1
  return (shares * totalAssets) / totalSupply; // floor
}

/** previewDeposit: assets in, shares out (rounds DOWN, favours vault). */
export function previewDeposit(assets: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  return convertToShares(assets, totalAssets, totalSupply);
}

/** previewRedeem: shares in, assets out (rounds DOWN, favours vault). */
export function previewRedeem(shares: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  return convertToAssets(shares, totalAssets, totalSupply);
}

/** previewMint: shares wanted, assets required (rounds UP, favours vault). */
export function previewMint(shares: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  if (shares < 0n) throw new Error("previewMint: negative shares");
  if (totalSupply === 0n) return shares;
  if (totalAssets === 0n) {
    throw new Error("previewMint: vault has supply>0 but assets==0 (degenerate)");
  }
  return divCeil(shares * totalAssets, totalSupply);
}

/** previewWithdraw: assets wanted, shares burned (rounds UP, favours vault). */
export function previewWithdraw(assets: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  if (assets < 0n) throw new Error("previewWithdraw: negative assets");
  if (totalSupply === 0n) return assets;
  if (totalAssets === 0n) {
    throw new Error("previewWithdraw: vault has supply>0 but assets==0 (degenerate)");
  }
  return divCeil(assets * totalSupply, totalAssets);
}

export interface VaultState {
  totalAssets: bigint;
  totalSupply: bigint;
}

/**
 * Simulate a deposit (assets in → shares minted, rounded DOWN) and return the
 * resulting vault state. Handy for chaining the inflation-attack scenario.
 */
export function simulateDeposit(state: VaultState, assets: bigint): { shares: bigint; state: VaultState } {
  const shares = convertToShares(assets, state.totalAssets, state.totalSupply);
  return {
    shares,
    state: { totalAssets: state.totalAssets + assets, totalSupply: state.totalSupply + shares },
  };
}

/** Direct token donation to the vault (a bare transfer, no shares minted). */
export function donate(state: VaultState, assets: bigint): VaultState {
  if (assets < 0n) throw new Error("donate: negative assets");
  return { totalAssets: state.totalAssets + assets, totalSupply: state.totalSupply };
}
