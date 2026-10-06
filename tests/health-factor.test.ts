import { describe, expect, it } from "vitest";
import { WAD, fromWad, toWad, wadDiv, wadMul } from "../src/money-math/fixed.js";
import {
  healthFactor,
  isLiquidatable,
  maxAdditionalBorrow,
} from "../src/money-math/health-factor.js";

describe("fixed-point helpers", () => {
  it("round-trips decimals", () => {
    expect(toWad("1.5")).toBe(1_500_000_000_000_000_000n);
    expect(fromWad(toWad("1.5"))).toBe("1.5");
  });

  it("wadMul truncates toward zero (no float drift)", () => {
    // 0.1 * 0.2 = 0.02 exactly in WAD
    expect(wadMul(toWad("0.1"), toWad("0.2"))).toBe(toWad("0.02"));
  });

  it("wadDiv throws on zero divisor", () => {
    expect(() => wadDiv(WAD, 0n)).toThrow(/division by zero/);
  });
});

describe("health factor (Aave-style)", () => {
  const collateral = [{ valueWad: toWad(1000), liquidationThresholdWad: toWad("0.825") }];

  it("solvent position: HF > 1", () => {
    // weighted = 825, debt = 500 → HF = 1.65
    const hf = healthFactor(collateral, toWad(500));
    expect(fromWad(hf)).toBe("1.65");
    expect(isLiquidatable(hf)).toBe(false);
  });

  it("boundary: HF exactly 1 is NOT liquidatable (>=1 is solvent)", () => {
    // weighted = 825, debt = 825 → HF = 1.0
    const hf = healthFactor(collateral, toWad(825));
    expect(hf).toBe(WAD);
    expect(isLiquidatable(hf)).toBe(false);
  });

  it("boundary: one wei of extra debt flips to liquidatable", () => {
    const hf = healthFactor(collateral, toWad(825) + 1n);
    expect(isLiquidatable(hf)).toBe(true);
  });

  it("no debt → not liquidatable", () => {
    expect(isLiquidatable(healthFactor(collateral, 0n))).toBe(false);
  });

  it("max additional borrow respects max-LTV", () => {
    // value 1000, maxLtv 0.75 → capacity 750; debt 500 → 250 room
    const room = maxAdditionalBorrow(
      [{ valueWad: toWad(1000), liquidationThresholdWad: toWad("0.825") }],
      toWad(500),
      toWad("0.75"),
    );
    expect(fromWad(room)).toBe("250");
  });

  it("max additional borrow is 0 when over capacity", () => {
    const room = maxAdditionalBorrow(
      [{ valueWad: toWad(1000), liquidationThresholdWad: toWad("0.825") }],
      toWad(900),
      toWad("0.75"),
    );
    expect(room).toBe(0n);
  });
});
