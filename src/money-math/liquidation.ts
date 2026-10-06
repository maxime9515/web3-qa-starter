/**
 * Aave-style liquidation payout math (bigint, WAD).
 *
 * Source: Aave V3 docs — liquidation mechanics. A liquidator repays part of an
 * unhealthy position's debt and receives collateral worth that debt times a
 * liquidation bonus (a discount for the liquidator, punished on the borrower):
 *
 *   collateralSeized = debtRepaid * liquidationBonus
 *
 * with liquidationBonus WAD (e.g. 1.05e18 = 5% bonus). Repayment is capped at
 * the outstanding debt; you can never repay more than is owed.
 */
import { WAD, wadMul } from "./fixed.js";
import { isLiquidatable } from "./health-factor.js";

export { isLiquidatable };

/** Collateral value (WAD) a liquidator receives for repaying `debtRepaidWad`. */
export function seizeAmount(debtRepaidWad: bigint, liquidationBonusWad: bigint): bigint {
  if (debtRepaidWad < 0n) throw new Error("seizeAmount: negative debt");
  if (liquidationBonusWad < WAD) {
    throw new Error("seizeAmount: liquidationBonus must be >= 1e18 (no discount without a bonus)");
  }
  return wadMul(debtRepaidWad, liquidationBonusWad);
}

/** Effective repayment never exceeds the outstanding debt. */
export function cappedRepay(requestedRepayWad: bigint, totalDebtWad: bigint): bigint {
  if (requestedRepayWad < 0n) throw new Error("cappedRepay: negative repay");
  return requestedRepayWad > totalDebtWad ? totalDebtWad : requestedRepayWad;
}

/** Close factor: fraction of debt a liquidation may repay in one call (WAD). */
export function appliedRepay(
  requestedRepayWad: bigint,
  totalDebtWad: bigint,
  closeFactorWad: bigint,
): bigint {
  const maxByCloseFactor = wadMul(totalDebtWad, closeFactorWad);
  return cappedRepay(requestedRepayWad, maxByCloseFactor);
}
