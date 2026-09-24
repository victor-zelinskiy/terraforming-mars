/*
 * THE LEVY STEP (Turmoil Redux) — the ONE executor of a resolution's
 * `levy` declaration (`common/parliament/resolutionLevy.ts`): the fixed sum
 * every participant LOSES at the enactment before anything is paid — the
 * BUDGET family's first part («Lose 10 M€», Industrialist Budget; «Lose 12
 * M€», Mars First Budget). A card declares the sum; this step is the same for
 * every one of them, so the next budget adds no code here.
 *
 * WHAT THE STEP FIXES:
 *  · THE TAKE IS BOUNDED BY THE SEAT: `levyPaid` — never below zero, never
 *    more than the seat holds. A short seat pays what it has and the record
 *    NAMES the shortfall (`owed` beside the negative `amount`, the reason on
 *    the paying record itself — the journal line carries both sums); a seat
 *    holding nothing pays nothing and records a `skipped` with the same
 *    `owed` — and still receives every later part: the card asks no solvency.
 *  · THE MUTATION CARRIES ITS SOURCE: `stock.add(resource, −paid, {from:
 *    {resolution}})`. Without `from` the engine writes `logIllegalState`
 *    whenever the take exceeds the supply (`Stock.add`); with it the take is
 *    the standard deduction — its events, the recorder, the journal, the
 *    party reactions all see it under the resolution.
 *  · ONE record per seat, negative: `kind: 'stock'` with `amount < 0` — the
 *    address table reads the sign (`RewardDelivery.direction: 'loss'`), the
 *    reward beat flies it BACKWARDS (rail → the card's icon) and ticks the
 *    counter on departure. Never a skip, never a kind of its own.
 *  · ONCE, at the enactment: the driver's idempotency key
 *    (`effect:<generation>:<instance>:<player>:levy`) makes a reload take
 *    nothing twice; the step mutates and never asks (IResolution.ts).
 */
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {LEVY_STEP_KEY, levyNothingReasonKey, levyPaid, levyShortReasonKey, ResolutionLevy} from '../../../common/parliament/resolutionLevy';
import {EnactStep} from './IResolution';

/** THE SHARED LEVY STEP of `resolution` — declared FIRST in a budget's `immediateSteps` (the printed order). */
export function levyStep(resolution: ResolutionId, levy: ResolutionLevy): EnactStep {
  return {
    key: LEVY_STEP_KEY,
    run(ctx) {
      const player = ctx.player;
      const resource = levy.resource;
      const owed = Math.floor(levy.amount);
      const before = player.stock.get(resource);
      const paid = levyPaid(levy, before);
      if (paid <= 0) {
        ctx.game.log('${0} has no ${1} — ${2} takes nothing of the ${3} owed', (b) =>
          b.player(player).resource(resource).resolution(resolution).number(owed));
        ctx.report({kind: 'skipped', stock: resource, amount: 0, owed, reason: levyNothingReasonKey(resource)});
        return undefined;
      }
      // The standard deduction under the resolution's source: never below zero
      // (the take is bounded above), never an illegal-state line (`from` is set).
      player.stock.add(resource, -paid, {log: false, from: {resolution}});
      const after = player.stock.get(resource);
      if (paid < owed) {
        ctx.game.log('${0} pays only ${1} of the ${2} ${3} owed to ${4} — not enough (${5} → ${6})', (b) =>
          b.player(player).number(paid).number(owed).resource(resource).resolution(resolution).number(before).number(after));
        ctx.report({kind: 'stock', stock: resource, amount: -paid, owed, before, after, reason: levyShortReasonKey(resource)});
        return undefined;
      }
      ctx.game.log('${0} pays ${1} ${2} to ${3} (${4} → ${5})', (b) =>
        b.player(player).number(paid).resource(resource).resolution(resolution).number(before).number(after));
      ctx.report({kind: 'stock', stock: resource, amount: -paid, owed, before, after});
      return undefined;
    },
  };
}
