/**
 * Aave-style health factor math (bigint, WAD).
 *
 *   HF = Σ(collateral_i * liquidationThreshold_i) / Σ(debt_i)
 *
 * HF >= 1e18 → position is solvent.
 * HF <  1e18 → position is liquidatable.
 *
 * This is the "money math" a generic UI suite never checks: the exact
 * boundary where a position becomes liquidatable, and the rounding that
 * decides it. Tested at the boundary, not with a hand-wavy "looks fine".
 */
import { WAD, wadDiv, wadMul } from "./fixed.js";

export interface Collateral {
  /** Collateral value in WAD (already priced). */
  valueWad: bigint;
  /** Liquidation threshold, WAD (e.g. 0.825e18 = 82.5%). */
  liquidationThresholdWad: bigint;
}

export function healthFactor(collaterals: Collateral[], totalDebtWad: bigint): bigint {
  if (totalDebtWad === 0n) return (2n ** 255n); // no debt → effectively infinite HF
  const weighted = collaterals.reduce(
    (acc, c) => acc + wadMul(c.valueWad, c.liquidationThresholdWad),
    0n,
  );
  return wadDiv(weighted, totalDebtWad);
}

export function isLiquidatable(hfWad: bigint): boolean {
  return hfWad < WAD;
}

/** Max additional borrow allowed at a given max-LTV, given current weighted collateral. */
export function maxAdditionalBorrow(
  collaterals: Collateral[],
  totalDebtWad: bigint,
  maxLtvWad: bigint,
): bigint {
  const weighted = collaterals.reduce((acc, c) => acc + c.valueWad, 0n);
  const borrowCapacity = wadMul(weighted, maxLtvWad);
  return borrowCapacity > totalDebtWad ? borrowCapacity - totalDebtWad : 0n;
}
