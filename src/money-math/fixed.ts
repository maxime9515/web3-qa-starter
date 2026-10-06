/**
 * Fixed-point (WAD = 1e18) bigint helpers.
 * Money math on-chain is integers; tests must use bigint, never floats,
 * or they hide rounding / precision bugs that are exactly what breaks DeFi.
 */

export const WAD = 10n ** 18n;

/** a * b / 1e18, truncated toward zero (matches Solidity div semantics). */
export function wadMul(a: bigint, b: bigint): bigint {
  return (a * b) / WAD;
}

/** a * 1e18 / b, truncated toward zero. */
export function wadDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("wadDiv: division by zero");
  return (a * WAD) / b;
}

/** Parse a human decimal like "1.5" into WAD bigint. */
export function toWad(value: string | number): bigint {
  const s = typeof value === "number" ? value.toString() : value;
  const [intPart, fracPart = ""] = s.split(".");
  const frac = (fracPart + "0".repeat(18)).slice(0, 18);
  return BigInt(intPart || "0") * WAD + BigInt(frac || "0");
}

/** Format a WAD bigint back to a human decimal string (trimmed). */
export function fromWad(value: bigint): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const int = v / WAD;
  const frac = (v % WAD).toString().padStart(18, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? "." + frac : ""}`;
}
