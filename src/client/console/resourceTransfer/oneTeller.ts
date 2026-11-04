import {noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/**
 * ONE UNIT, ONE TELLER (P66 · GJ — the owner, 2026-11-05: «двойной показ — критический баг, защита должна быть
 * АРХИТЕКТУРНОЙ»). A change the player is shown has exactly ONE story. Where two stories of the same response can reach
 * for the same unit, the unit is CLAIMED here for the applied view, the first teller wins, and a second claimant YIELDS —
 * it never tells — while the sentinel names the collision in every build (red on every e2e spec: `consoleTest.ts`
 * `transferEndsGuard`). A yield is never a normal path: it means an exclusion upstream (a phase gate, a host flag) let
 * two tellers through, and THAT is the bug to fix.
 *
 * The units claimed today:
 *  · `scale-step-rating` — the rating a scale step pays. The FIELD tells it in the action phase (`scaleStepRatingBeat` —
 *    one token per step off the marker's rim); the HERO tells it on the start host, where the board is covered
 *    (`seedRailReward` of a rail reward whose cause is born on a printed scale icon — `bornOn`). Never both.
 * The table's answer to a rating (the ruling Greens' M€) is single by the ANSWER LEDGER instead (`declareHeldAnswers`
 * → the card-reaction seeder ATTACHES a declared row to the host and plays no standalone chain for it): the answer is
 * always shown by the card-reaction framework (the party's emblem rises, its tokens are born there); the host only gives
 * it its moment, after its own cause has landed.
 *
 * Claims are keyed by the APPLIED VIEW object (the one the apply block hands every seeder), so they live exactly as long
 * as that response and need no reset.
 */
export const TOLD_TWICE = '[transfer] told twice';

/** The rating a scale step pays (temperature / oxygen / Venus) — see the header. */
export const SCALE_STEP_RATING_UNIT = 'scale-step-rating';

const claims = new WeakMap<object, Map<string, string>>();

/**
 * Claim `unit` of the response `view` for `teller`. True: tell it (first claim, or the same teller again). False: another
 * teller already tells it — yield, tell nothing; the collision is named (trail + sentinel). A missing view claims nothing
 * and never refuses (no response, no collision).
 */
export function claimTeller(view: object | undefined, unit: string, teller: string): boolean {
  if (view === undefined) {
    return true;
  }
  let owners = claims.get(view);
  if (owners === undefined) {
    owners = new Map();
    claims.set(view, owners);
  }
  const owner = owners.get(unit);
  if (owner === undefined || owner === teller) {
    owners.set(unit, teller);
    return true;
  }
  noteTransferTrail('teller:yield', {unit, tells: owner, yields: teller});
  console.warn(`${TOLD_TWICE} — ${unit}: ${owner} tells it; ${teller} reached for it too and yields (a second story of one change — find the exclusion that let it through)`);
  return false;
}

/** Who tells `unit` of the response `view` (a probe's / a spec's read). */
export function tellerOf(view: object | undefined, unit: string): string | undefined {
  return view === undefined ? undefined : claims.get(view)?.get(unit);
}
