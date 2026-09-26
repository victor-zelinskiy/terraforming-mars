/*
 * THE BILL OF A RESOLUTION ACTION (Turmoil Redux — Trade Industries: «pay
 * 12 M€ to gain an extra trade fleet; you can pay with titanium, and you get
 * a M€ discount equal to 2 times your Influence»).
 *
 * A PAID action declares its price as DATA, beside `scaled` / `levy` /
 * `winnerReward`: the printed sum, what one point of influence takes off it,
 * and whether titanium may pay. ONE function turns the declaration and a
 * seat's influence into the price everybody reads — the action's own gate
 * (`canAct`), the bill the server raises (`SelectPaymentDeferred`), the
 * result chips of the action tile (`preview`), the composer's price line and
 * the stand's scenarios. Computed in two places it would be shown as 6 and
 * charged as 8 the first time the two drifted; computed here it cannot.
 *
 * The discount never takes the price below zero (influence 6 buys the fleet
 * for nothing), and the rounding is the printed rule's own — a whole number
 * of M€ per point, nothing to round.
 */

export type ResolutionActionBill = {
  /** The printed price, before any discount. */
  amount: number;
  /** The M€ ONE point of influence takes off the printed price. */
  discountPerInfluence: number;
  /** The bill accepts titanium at the engine's own rate. */
  titanium: boolean;
};

/** The price of a bill for a seat with `influence` — every part of the arithmetic, so a surface can STATE it. */
export type ActionBillPrice = {
  /** The printed sum. */
  printed: number;
  /** The seat's influence the discount was read from. */
  influence: number;
  /** What the influence takes off (never more than the printed sum). */
  discount: number;
  /** What is charged: the printed sum less the discount, floored at zero. */
  price: number;
};

export function actionBillPrice(bill: ResolutionActionBill, influence: number): ActionBillPrice {
  const printed = Math.max(0, bill.amount);
  const points = Math.max(0, influence);
  const discount = Math.min(printed, points * Math.max(0, bill.discountPerInfluence));
  return {printed, influence: points, discount, price: printed - discount};
}
