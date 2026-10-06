import { describe, expect, it } from "vitest";
import {
  convertToAssets,
  convertToShares,
  donate,
  previewDeposit,
  previewMint,
  previewRedeem,
  previewWithdraw,
  simulateDeposit,
  type VaultState,
} from "../src/money-math/erc4626.js";

const WAD = 10n ** 18n;

describe("ERC-4626 conversion (EIP-4626 rounding)", () => {
  it("fresh vault: shares mint 1:1 with assets", () => {
    expect(convertToShares(100n, 0n, 0n)).toBe(100n);
    expect(convertToAssets(100n, 0n, 0n)).toBe(100n);
  });

  it("convertToShares rounds DOWN", () => {
    // totalAssets=3, totalSupply=1 → 1 share worth 3 assets; 2 assets → 0 shares
    expect(convertToShares(2n, 3n, 1n)).toBe(0n);
    // 5000 * 1000 / 3000 = 1666.66 → 1666
    expect(convertToShares(5000n, 3000n, 1000n)).toBe(1666n);
  });

  it("convertToAssets rounds DOWN", () => {
    // 1 share * 2 assets / 3 supply = 0.66 → 0
    expect(convertToAssets(1n, 2n, 3n)).toBe(0n);
  });

  it("previewDeposit/previewRedeem favour the vault (round DOWN)", () => {
    expect(previewDeposit(2n, 3n, 1n)).toBe(0n);
    expect(previewRedeem(1n, 2n, 3n)).toBe(0n);
  });

  it("previewMint/previewWithdraw favour the vault (round UP)", () => {
    // mint 1 share when 1 share costs 2/3 asset → ceil(2/3) = 1 asset
    expect(previewMint(1n, 2n, 3n)).toBe(1n);
    // withdraw 1 asset when each share is worth 2/3 → ceil(1.5) = 2 shares
    expect(previewWithdraw(1n, 2n, 3n)).toBe(2n);
  });

  it("boundary: vault with supply>0 but assets==0 is degenerate → throws", () => {
    expect(() => convertToShares(1n, 0n, 5n)).toThrow(/degenerate/);
    expect(() => previewMint(1n, 0n, 5n)).toThrow(/degenerate/);
    expect(() => previewWithdraw(1n, 0n, 5n)).toThrow(/degenerate/);
  });
});

describe("ERC-4626 deposit/redeem round trip", () => {
  it("deposit then immediately redeem never yields more than deposited", () => {
    let state: VaultState = { totalAssets: 2000n, totalSupply: 1000n };
    const deposited = 1000n;
    const { shares, state: after } = simulateDeposit(state, deposited);
    expect(shares).toBe(500n); // 1000 * 1000 / 2000
    const redeemed = previewRedeem(shares, after.totalAssets, after.totalSupply);
    expect(redeemed).toBeLessThanOrEqual(deposited);
    expect(redeemed).toBe(deposited); // exact here, no free lunch either way
  });
});

describe("ERC-4626 inflation attack (donation / first-depositor front-run)", () => {
  it("victim deposit rounds down to ZERO shares after attacker inflation", () => {
    // 1. empty vault
    let state: VaultState = { totalAssets: 0n, totalSupply: 0n };

    // 2. attacker deposits the minimum: 1 wei → 1 share
    const attacker = simulateDeposit(state, 1n);
    expect(attacker.shares).toBe(1n);
    state = attacker.state; // {1, 1}

    // 3. attacker donates a large amount directly (no shares minted) → 1 share
    //    now claims (1e18 + 1) assets
    state = donate(state, WAD); // {1e18 + 1, 1}

    // 4. victim deposits 1e18 assets → shares = 1e18 * 1 / (1e18 + 1) = 0
    const victim = convertToShares(WAD, state.totalAssets, state.totalSupply);
    expect(victim).toBe(0n); // rounding in the vault's favour = victim robbed

    // attacker still owns the only share and can redeem the whole vault
    const attackerOut = convertToAssets(1n, state.totalAssets, state.totalSupply);
    expect(attackerOut).toBe(WAD + 1n);
  });

  it("boundary: victim needs exactly totalAssets+1 wei to get their first share", () => {
    const state: VaultState = { totalAssets: WAD + 1n, totalSupply: 1n };
    // 1e18 assets → floor(1e18 / (1e18+1)) = 0 shares
    expect(convertToShares(WAD, state.totalAssets, state.totalSupply)).toBe(0n);
    // +1 wei → floor((1e18+1)/(1e18+1)) = 1 share
    expect(convertToShares(WAD + 1n, state.totalAssets, state.totalSupply)).toBe(1n);
  });
});
