/**
 * Uniswap V2 constant-product (x*y=k) swap math, in exact bigint.
 *
 * Reserves are integer token base units (wei), exactly as stored on-chain —
 * NOT WAD-scaled. Every intermediate is bigint; no float ever touches this.
 *
 * Source: UniswapV2Library.sol (docs.uniswap.org .../smart-contracts/library),
 * canonical implementation:
 *
 *   getAmountOut(amountIn, reserveIn, reserveOut):
 *     amountInWithFee = amountIn * 997
 *     numerator      = amountInWithFee * reserveOut
 *     denominator    = reserveIn * 1000 + amountInWithFee
 *     return numerator / denominator
 *
 *   getAmountIn(amountOut, reserveIn, reserveOut):
 *     numerator   = reserveIn * amountOut * 1000
 *     denominator = (reserveOut - amountOut) * 997
 *     return numerator / denominator + 1     // round UP: never undercharge
 *
 * The 0.3% fee is the 997/1000 factor. getAmountOut rounds DOWN (user never
 * gets more than fair); getAmountIn rounds UP (user never pays less than fair).
 * That asymmetry is the part generic UI suites fail to test.
 */

const FEE_NUM = 997n; // 1000 - 3
const FEE_DEN = 1000n;

/** Given an input amount, returns the max output (rounds down, fee applied). */
export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n) throw new Error("getAmountOut: amountIn must be > 0");
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error("getAmountOut: INSUFFICIENT_LIQUIDITY (zero reserve)");
  }
  const amountInWithFee = amountIn * FEE_NUM;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * FEE_DEN + amountInWithFee;
  return numerator / denominator;
}

/** Given a desired output amount, returns the min input required (rounds up). */
export function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountOut <= 0n) throw new Error("getAmountIn: amountOut must be > 0");
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error("getAmountIn: INSUFFICIENT_LIQUIDITY (zero reserve)");
  }
  if (amountOut >= reserveOut) {
    throw new Error("getAmountIn: INSUFFICIENT_LIQUIDITY (amountOut >= reserveOut)");
  }
  const numerator = reserveIn * amountOut * FEE_DEN;
  const denominator = (reserveOut - amountOut) * FEE_NUM;
  return numerator / denominator + 1n;
}

/**
 * quote(amountA, reserveA, reserveB) → equivalent amountB at the current spot
 * ratio, ignoring fees and slippage (used to size liquidity provision).
 *   amountB = amountA * reserveB / reserveA
 */
export function quote(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  if (amountA <= 0n) throw new Error("quote: amountA must be > 0");
  if (reserveA <= 0n || reserveB <= 0n) {
    throw new Error("quote: INSUFFICIENT_LIQUIDITY (zero reserve)");
  }
  return (amountA * reserveB) / reserveA;
}
