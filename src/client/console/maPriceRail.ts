/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE MILESTONE / AWARD PRICE LEAVES THE RAIL FIRST (PL-1621 — the PL-099 / PL-104 law at the MA workspace's commit,
 * ledger FB). A claim costs 8 M€ (an award 8 / 14 / 20; Helion pays part of it in heat): the counter used to drop in the
 * frame the view applied, under a stage that was already crowning the emblem — a price with no cause on screen. Now the
 * price is a RAIL HALF of the commit, in the action commit's own grammar:
 *
 *   ARM  — the press (`armMaPrice`): the bill AS PAID — the engine's price in M€, or the payment the player composed
 *          in the detail's «› ОПЛАТА» stage (PL-1622: Helion's heat off the heat row) — one loss per row;
 *   SEED — the apply block of the view that pays it (`seedMaPriceRail`, from the transport's `seedRewardHolds` and
 *          `App.update`): the rows keep their pre-commit values ONLY when the two views bear the promise out
 *          (`seedRailReward` — the ONE checker); a view that paid nothing yet leaves it armed for the view that does;
 *   FLY  — before the ceremony (`flyMaPrice`, awaited by the stage): each token is born on its row's ink, leaves
 *          SIDEWAYS at its own row's height and is drawn QUICKLY into the detail's PRINTED PRICE
 *          (`[data-ma-price-target]` — the milestone's «ЦЕНА» chip, the award ladder's next step), the row ticking on the
 *          departure; the ceremony starts once the price has been absorbed — price, then crown.
 *
 * Bounded and named: a seeded half nobody flies is released by its own hold's ceiling (`ma-price-owed`), a refused /
 * abandoned commit releases it at once (`releaseMaPrice`); reduced motion seeds nothing (`seedRailReward` refuses), so
 * the rows tick with the commit. A free claim (Van Allen, Nirgal, Vitor's sponsorship) arms nothing.
 */
import {shallowRef} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {ResourceTransferSpec, TransferEnd} from '@/client/console/resourceTransfer/resourceTransferModel';
import {flyRailRewardLink, railRewardOwed, railRewardPending, releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {firstVisibleEnd} from '@/client/console/resourceTransfer/transferEndVisible';
import {centreEndOf} from '@/client/console/consoleActionCommitMotion';
import {noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/** The rail rows a claim / a funding is paid from — the payment's units that live on the rail. */
export const MA_PRICE_ROWS = ['megacredits', 'heat'] as const;
export type MaPricePaid = Partial<Record<typeof MA_PRICE_ROWS[number], number>>;

const KEY = 'ma-price';
/** The longest a seeded price waits for its flight (the ceremony is its handoff — anything past this never came). */
const OWED_FLY_MS = 6000;

type Armed = {name: string, specs: ReadonlyArray<ResourceTransferSpec>, seeded: boolean};
/** The flight in the air — `flyMaPrice` is IDEMPOTENT while it flies (the commit watcher re-asks on every view). */
let flight: Promise<void> | undefined;
/** The armed price — a SHALLOW REF (the owed hold's supplier reads it: a plain `let` there is a latch). */
const armedRef = shallowRef<Armed | undefined>(undefined);

/** The price's specs — one LOSS per rail row the bill took (pure). */
export function maPriceSpecs(paid: MaPricePaid): Array<ResourceTransferSpec> {
  return MA_PRICE_ROWS
    .filter((row) => (paid[row] ?? 0) > 0)
    .map((row) => ({channel: 'stock', resource: row, amount: paid[row] ?? 0, direction: 'loss'}));
}

/** ARM — the press: the bill as paid (nothing for a free claim). */
export function armMaPrice(name: string, paid: MaPricePaid): void {
  releaseMaPrice('re-armed');
  const specs = maPriceSpecs(paid);
  armedRef.value = specs.length === 0 ? undefined : {name, specs, seeded: false};
}

/**
 * SEED — the apply block. Held only when the two views bear the price out; a view that has paid nothing yet (a poll
 * ahead of the answer) leaves it armed for the view that does.
 */
export function seedMaPriceRail(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const armed = armedRef.value;
  if (armed === undefined || armed.seeded) {
    return;
  }
  const reward = {cause: armed.specs, reactions: []};
  if (railRewardOwed(reward, before, after)) {
    noteTransferTrail('rail:seed', {key: KEY, verdict: 'owed — waiting for the paying view'});
    return;
  }
  if (!seedRailReward(KEY, reward, before, after)) {
    armedRef.value = undefined; // the views did not bear it out — the rows tick with the commit, named by the checker
    return;
  }
  armedRef.value = {...armed, seeded: true};
}

/** The detail's printed price as an OBJECT end (re-measured on the approach) — undefined when it is not painted. */
function priceEnd(): TransferEnd | undefined {
  return centreEndOf(firstVisibleEnd('.con-mafocus [data-ma-price-target]'));
}

/**
 * FLY — before the ceremony: the tokens leave their rows sideways and are absorbed in the printed price. Resolves at
 * the last absorb (at once when nothing is seeded). Never rejects.
 */
export function flyMaPrice(): Promise<void> {
  if (flight !== undefined) {
    return flight;
  }
  const armed = armedRef.value;
  if (armed === undefined || !armed.seeded || !railRewardPending(KEY)) {
    noteTransferTrail('rail:end', {key: KEY, why: armed === undefined ? 'nothing armed' : !armed.seeded ? 'not seeded yet' : 'not held'});
    armedRef.value = undefined;
    return Promise.resolve();
  }
  armedRef.value = undefined;
  // The printed price may still be SURFACING (the plates' face crossing back from «› ОПЛАТА» — 180 ms): wait for it to
  // be painted, bounded, never a landing on a half-faded chip; past the bound the rows tick, named.
  flight = awaitPriceEnd(PRICE_END_WAIT_MS).then((target) => {
    if (target === undefined) {
      noteTransferTrail('rail:end', {key: KEY, why: 'no printed price painted'});
      releaseRailReward(KEY, 'no printed price painted');
      return undefined;
    }
    noteTransferTrail('rail:end', {key: KEY, why: 'flying'});
    // A LOSS walks the geometry backwards: born on its row's ink (the spec's HOME — no `destination`), absorbed at the
    // ORIGIN — the printed price.
    return flyRailRewardLink(KEY, armed.specs, () => target, {absorb: 'quick'}).then(() => undefined, () => undefined);
  }).finally(() => {
    releaseRailReward(KEY, 'flown');
    flight = undefined;
  });
  return flight;
}

/** The longest the flight waits for its printed price to be painted (the face's crossfade is 180 ms × the motion scale — a loaded renderer stretches it; bounded all the same). */
const PRICE_END_WAIT_MS = 1500;

/** The printed price once it is painted — re-asked every frame, bounded by `maxMs`. */
function awaitPriceEnd(maxMs: number): Promise<TransferEnd | undefined> {
  const now = priceEnd();
  if (now !== undefined || typeof window === 'undefined') {
    return Promise.resolve(now);
  }
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const end = priceEnd();
      if (end !== undefined || Date.now() - started >= maxMs) {
        resolve(end);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

/** A refused / abandoned / yielded commit: whatever the price holds ticks now (honestly late, never lost). */
export function releaseMaPrice(why: string): void {
  if (armedRef.value !== undefined) {
    noteTransferTrail('rail:end', {key: KEY, why});
  }
  armedRef.value = undefined;
  releaseRailReward(KEY, why);
}

/** Diagnostics / e2e: the price is armed or seeded and not flown yet. */
export function maPriceOwed(): boolean {
  return armedRef.value !== undefined;
}

// A SEEDED price waits for the ceremony under its own name (notification-only — the next prompt is the commit's own
// business), and the registry's wall-clock ceiling is its net: past it the ceremony never came, the rows tick, named.
registerAnimationHoldSupplier('ma-price-owed', () => armedRef.value?.seeded === true && railRewardPending(KEY), {
  scope: 'notification-only',
  maxHoldMs: OWED_FLY_MS,
  diagnose: () => ({name: armedRef.value?.name ?? ''}),
  expire: () => releaseMaPrice('not flown'),
});
