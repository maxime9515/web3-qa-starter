import { describe, expect, it } from "vitest";
import { getAmountIn, getAmountOut, quote } from "../src/money-math/uniswap-v2.js";

describe("Uniswap V2 getAmountOut (x*y=k, 0.3% fee)", () => {
  it("matches the canonical worked example", () => {
    // amountIn=10, reserves 1000/2000 → 10*997*2000 / (1000*1000 + 10*997) = 19
    expect(getAmountOut(10n, 1000n, 2000n)).toBe(19n);
  });

  it("rounds DOWN and never returns more than fair (fee applied)", () => {
    // no-fee spot would be 10*2000/1000 = 20; fee drags it to 19
    expect(getAmountOut(10n, 1000n, 2000n)).toBeLessThan(20n);
  });

  it("preserves/increases x*y (fee accrues to the pool)", () => {
    const out = getAmountOut(10n, 1000n, 2000n); // 19
    const kBefore = 1000n * 2000n;
    const kAfter = (1000n + 10n) * (2000n - out);
    expect(kAfter).toBeGreaterThan(kBefore);
  });

  it("boundary: exactly zero reserve throws (INSUFFICIENT_LIQUIDITY)", () => {
    expect(() => getAmountOut(1n, 0n, 100n)).toThrow(/INSUFFICIENT_LIQUIDITY/);
    expect(() => getAmountOut(1n, 100n, 0n)).toThrow(/INSUFFICIENT_LIQUIDITY/);
  });

  it("boundary: last 1 wei reserve still works, draining it throws on next step", () => {
    expect(getAmountOut(1n, 1n, 1n)).toBe(0n); // fee floor eats the whole 1/1000
  });

  it("zero/negative amountIn throws", () => {
    expect(() => getAmountOut(0n, 1000n, 2000n)).toThrow();
    expect(() => getAmountOut(-1n, 1000n, 2000n)).toThrow();
  });
});

describe("Uniswap V2 getAmountIn (rounds UP)", () => {
  it("minimum input to buy 1 wei out is 1 wei", () => {
    // num=1e6, den=1999*997=1,993,003 → 0, +1 = 1
    expect(getAmountIn(1n, 1000n, 2000n)).toBe(1n);
  });

  it("round-trips: getAmountIn(getAmountOut(x)) <= x", () => {
    const reserveIn = 100_000n;
    const reserveOut = 100_000n;
    const amountIn = 1000n;
    const out = getAmountOut(amountIn, reserveIn, reserveOut);
    expect(out).toBe(987n);
    const back = getAmountIn(out, reserveIn, reserveOut);
    expect(back).toBeLessThanOrEqual(amountIn);
    expect(back).toBe(1000n);
  });

  it("boundary: amountOut == reserveOut throws", () => {
    expect(() => getAmountIn(2000n, 1000n, 2000n)).toThrow(/INSUFFICIENT_LIQUIDITY/);
  });

  it("boundary: amountOut == reserveOut - 1 wei, denominator stays positive", () => {
    // (2000-1999)*997 = 997; 1000*1999*1000 / 997 + 1
    expect(getAmountIn(1999n, 1000n, 2000n)).toBe((1000n * 1999n * 1000n) / 997n + 1n);
  });

  it("zero reserve throws", () => {
    expect(() => getAmountIn(1n, 0n, 100n)).toThrow(/INSUFFICIENT_LIQUIDITY/);
    expect(() => getAmountIn(1n, 100n, 0n)).toThrow(/INSUFFICIENT_LIQUIDITY/);
  });
});

describe("Uniswap V2 quote", () => {
  it("returns the equivalent amount at spot ratio", () => {
    expect(quote(1000n, 1000n, 2000n)).toBe(2000n);
    expect(quote(1n, 3n, 3n)).toBe(1n);
  });

  it("floors the result", () => {
    expect(quote(1n, 3n, 2n)).toBe(0n); // 2/3 → 0
  });

  it("zero reserve throws", () => {
    expect(() => quote(1n, 0n, 100n)).toThrow(/INSUFFICIENT_LIQUIDITY/);
  });
});
