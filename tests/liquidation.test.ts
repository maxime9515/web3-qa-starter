import { describe, expect, it } from "vitest";
import { WAD, toWad } from "../src/money-math/fixed.js";
import {
  appliedRepay,
  cappedRepay,
  isLiquidatable,
  seizeAmount,
} from "../src/money-math/liquidation.js";

describe("liquidation: seize (collateral out for debt repaid)", () => {
  it("applies the liquidation bonus", () => {
    // repay 100, 5% bonus → seize 105
    expect(seizeAmount(toWad(100), toWad("1.05"))).toBe(toWad(105));
  });

  it("boundary: bonus == 1e18 means seize == repay (no discount)", () => {
    expect(seizeAmount(toWad(100), WAD)).toBe(toWad(100));
  });

  it("boundary: bonus < 1e18 throws (no bonus, position would be unfillable)", () => {
    expect(() => seizeAmount(toWad(100), WAD - 1n)).toThrow(/liquidationBonus/);
  });

  it("rounding is in the vault's favour (wadMul floors)", () => {
    // 1 wei * 1.05 → 1.05 wei floored to 1 wei
    expect(seizeAmount(1n, toWad("1.05"))).toBe(1n);
  });
});

describe("liquidation: repay capping", () => {
  it("caps repayment at the outstanding debt", () => {
    expect(cappedRepay(toWad(1000), toWad(500))).toBe(toWad(500));
    expect(cappedRepay(toWad(400), toWad(500))).toBe(toWad(400));
  });

  it("boundary: repaying exactly the debt is allowed, +1 wei is capped", () => {
    expect(cappedRepay(toWad(500), toWad(500))).toBe(toWad(500));
    expect(cappedRepay(toWad(500) + 1n, toWad(500))).toBe(toWad(500));
  });

  it("close factor limits repayment in one call", () => {
    // debt 1000, closeFactor 0.5 → at most 500 repayable
    expect(appliedRepay(toWad(1000), toWad(1000), toWad("0.5"))).toBe(toWad(500));
    // requesting less than the close-factor cap is honoured
    expect(appliedRepay(toWad(200), toWad(1000), toWad("0.5"))).toBe(toWad(200));
  });
});

describe("liquidation: gating on health factor", () => {
  it("only an HF < 1 position is liquidatable", () => {
    expect(isLiquidatable(WAD - 1n)).toBe(true);
    expect(isLiquidatable(WAD)).toBe(false); // boundary: exactly 1 is solvent
    expect(isLiquidatable(WAD + 1n)).toBe(false);
  });
});
