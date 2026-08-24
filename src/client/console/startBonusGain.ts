/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * THE «ФОРА» GAIN REWARD BEAT — the steel and the M€ a bonus-action window
 * grants, made PHYSICAL.
 *
 * Every other gain in this console arrives the same way: it emerges from the
 * card that produced it as a resource chip, flies to its row in the left panel,
 * and its delta chip fires AT THE TOUCHDOWN (`resourceTransfer/*` + the panel
 * reward hold). Head Start's two gains were the exception — the counter simply
 * jumped, both when the player claimed one on purpose and when the window's end
 * granted the rest automatically. The second case is the worse of the two: the
 * player is somewhere else entirely (the board) when the server resolves them,
 * so by the time they are back in the workspace the only evidence the card ever
 * did anything is a number that changed while they were not looking.
 *
 * WHY THIS IS A MODULE AND NOT A FEW LINES IN THE SCENE. The two halves of the
 * beat live in different places and different frames:
 *
 *  · the AMOUNT and the HOLD must be settled in the SAME SYNCHRONOUS BLOCK as
 *    the view commit (the transport's `seedRewardHolds`) — the panel renders
 *    `committed − held`, so a hold seeded even one micro-task early flushes a
 *    phantom −N chip that the commit then undoes;
 *  · the FLIGHT must wait for the workspace to be back on screen, which for the
 *    auto-resolve is several beats later (the board excursion releases, the
 *    scene re-mounts, «РАЗЫГРАНО» returns). The scene runs it when it can.
 *
 * So: ARM (or DETECT) → SEED → OWE → the scene FLIES it. Same seed/run split
 * `consoleHydroMarker` uses, for the same reason.
 *
 * THE AMOUNT IS NEVER GUESSED. A claim carries the server's own row amount. The
 * auto-resolve is computed exactly as the server computes it
 * (`Player.bonusGainAmount`): steel is the printed constant, M€ is
 * `perCardInHand × the hand as it stands` — and the hand as it stands is the
 * COMMITTED view's, because resolving the gains does not touch the hand. That
 * is the whole strategic point of the choice the card offers (draw and the M€
 * grow, play and they shrink), so an amount taken from the older prompt would
 * be a different number from the one the player actually received.
 *
 * Unit-tested under the server runner:
 * tests/client/components/console/startBonusGain.spec.ts
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {BonusGainRow, bonusActionGains, bonusActionSource, bonusActionsOwed} from '@/client/console/bonusAction';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {beginPanelRewardHold, clearPanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** What the beat owes: where it comes from, and what is arriving. */
export type BonusGainReward = {
  /** The card that granted the gains — the flight's physical origin. */
  source: CardName | undefined;
  specs: ReadonlyArray<ResourceTransferSpec>;
  /**
   * An explicit spawn point, captured at the PRESS.
   *
   * A claimed row is ANSWERED by the same response that grants it, so by the
   * time the chip may fly the row the player pressed is gone from the DOM. The
   * honest origin of a claim is the thing the player pressed, so it is measured
   * while it is still there; the auto-resolve has no press and no row, and
   * emerges from the card itself.
   */
  point?: TransferPoint;
  /** Which half of the contract produced this (the scene's own readiness test
   *  differs: a claim flies from its captured point, the auto-resolve needs
   *  «РАЗЫГРАНО» to be back on screen first). */
  kind: 'claim' | 'auto';
};

type PendingSnapshot = {
  rows: ReadonlyArray<BonusGainRow>;
  source: CardName | undefined;
};

/**
 * THE BEAT'S ONE REACTIVE FACT — what is standing, held, and waiting to fly.
 *
 * Reactive because the SCENE watches it: the auto-resolve is seeded while the
 * start workspace is not even mounted, and what starts the flight is that
 * workspace coming back. A plain module `let` cannot be watched, and polling
 * for it would be a timer pretending to be a signal.
 */
export const bonusGainRewardState = reactive({
  owed: undefined as BonusGainReward | undefined,
});

/** The gains the window still owed as of the LAST view that stated them. */
let snapshot: PendingSnapshot = {rows: [], source: undefined};

/** A claim the player pressed, waiting for its response. */
let armedClaim: BonusGainReward | undefined;

/**
 * The hold's backstop. The flight waits for a surface, and a surface that never
 * comes must not leave the panel reading a stale number for the rest of the
 * game. Generous next to the workspace's own return (~1 s), short enough that
 * the failure reads as «the chip fired a little late» rather than «my resources
 * did not arrive».
 */
const BONUS_GAIN_HOLD_SAFETY_MS = 6_000;

let safety: ReturnType<typeof setTimeout> | undefined;

function clearSafety(): void {
  if (safety !== undefined) {
    clearTimeout(safety);
    safety = undefined;
  }
}

/**
 * REMEMBER WHAT THE WINDOW STILL OWES.
 *
 * Called for EVERY view (the shell's own `playerView` watcher, `immediate`), and
 * updated only from a view that actually STATES the gains — the bonus-window
 * prompt carries them, the payment / placement / draw prompts INSIDE a bonus
 * action do not. Overwriting from those would forget the pending set halfway
 * through the very action whose end resolves it.
 *
 * An EMPTY list on a marked prompt is real information (everything was claimed
 * early) and is recorded as such.
 */
export function noteBonusGainRows(view: PlayerViewModel): void {
  if (view.waitingFor?.bonusActionPrompt === undefined) {
    return;
  }
  snapshot = {rows: bonusActionGains(view), source: bonusActionSource(view)};
}

/** The gains the window still owes, as last stated by the server. */
export function pendingBonusGainRows(): ReadonlyArray<BonusGainRow> {
  return snapshot.rows;
}

/** One row as a transfer spec (`stock` — both gains land on the panel). */
export function bonusGainSpec(resource: 'steel' | 'megacredits', amount: number): ResourceTransferSpec {
  return {channel: 'stock', resource, amount: Math.max(0, Math.round(amount))};
}

/**
 * THE PLAYER PRESSED «Получить сейчас» — arm the beat for the response that is
 * about to arrive. `point` is the pressed row's own centre, measured now.
 */
export function armBonusGainClaim(
  row: BonusGainRow,
  source: CardName | undefined,
  point?: TransferPoint,
): void {
  armedClaim = {
    source,
    specs: [bonusGainSpec(row.resource, row.amount)],
    point,
    kind: 'claim',
  };
}

/**
 * THE WINDOW JUST CLOSED WITH GAINS STILL PENDING — the server resolved them
 * inside this very response (`Player.spendBonusAction` →
 * `resolvePendingBonusGains`), so the panel already carries them and nobody
 * told the player where they came from.
 *
 * PURE, so the arithmetic that has to match the server's is testable on its
 * own. `undefined` when this response is not that moment.
 */
export function detectBonusGainAutoResolve(
  before: PlayerViewModel | undefined,
  after: PlayerViewModel,
  pending: PendingSnapshot = snapshot,
): BonusGainReward | undefined {
  if (before === undefined || bonusActionsOwed(before) <= 0 || bonusActionsOwed(after) > 0) {
    return undefined;
  }
  const hand = after.cardsInHand?.length ?? 0;
  const specs = pending.rows
    // THE SERVER'S OWN ARITHMETIC (`Player.bonusGainAmount`): steel is the
    // printed constant, the M€ read the hand AT THIS MOMENT — which is the
    // committed one, because resolving a gain does not touch the hand.
    .map((row) => bonusGainSpec(
      row.resource,
      row.perCardInHand !== undefined ? row.perCardInHand * hand : row.amount))
    .filter((spec) => spec.amount > 0);
  if (specs.length === 0) {
    return undefined;
  }
  return {source: pending.source ?? bonusActionSource(after), specs, kind: 'auto'};
}

/**
 * THE COMMIT — settle whichever half of the contract fired, hold the panel to
 * it, and leave the beat OWED for whoever can fly it.
 *
 * Called from the transport in the SAME SYNCHRONOUS BLOCK as the commit (see
 * the seeders' shared contract). Reduced motion opts out entirely: no hold, no
 * flight, the chips fire with the commit — the honest default.
 */
export function seedBonusGainRewardHold(
  before: PlayerViewModel | undefined,
  after: PlayerViewModel | undefined,
): void {
  const claim = armedClaim;
  armedClaim = undefined;
  if (after === undefined || consoleReducedMotionActive()) {
    return;
  }
  const auto = detectBonusGainAutoResolve(before, after);
  // A claim answered by the SAME response that closes the window is already
  // part of what the auto-resolve is paying out — never two waves for one
  // payout, and never a hold for an amount that was counted twice.
  const reward = auto ?? (claim !== undefined && claim.specs.some((s) => s.amount > 0) ? claim : undefined);
  if (auto !== undefined) {
    // The window is over: nothing is pending any more, whatever the last
    // marked prompt said.
    snapshot = {rows: [], source: snapshot.source};
  }
  if (reward === undefined) {
    return;
  }
  bonusGainRewardState.owed = reward;
  beginPanelRewardHold(reward.specs);
  clearSafety();
  if (typeof setTimeout === 'function') {
    safety = setTimeout(() => {
      safety = undefined;
      bonusGainRewardState.owed = undefined;
      clearPanelRewardHold();
    }, BONUS_GAIN_HOLD_SAFETY_MS);
  }
}

/** The scene took it — it is flying now and must not be started twice. */
export function consumeBonusGainReward(): BonusGainReward | undefined {
  const taken = bonusGainRewardState.owed;
  bonusGainRewardState.owed = undefined;
  clearSafety();
  return taken;
}

/** Full reset (game switch, an abort, test cleanup). */
export function resetBonusGainReward(): void {
  clearSafety();
  snapshot = {rows: [], source: undefined};
  armedClaim = undefined;
  bonusGainRewardState.owed = undefined;
}

/**
 * WHERE THE CHIPS COME FROM, in the order the card can be standing on screen.
 *
 * A CLAIM has an explicit point (the pressed row) and never reaches this. The
 * auto-resolve does: the window is over, so the granting card is back where it
 * belongs — its family pile in the workspace's «РАЗЫГРАНО». The embed seat is
 * tried too, for the case where a stage is still holding the card in its source
 * column. A source that cannot be measured means no flight at all, and the gain
 * is then announced by its delta chip alone — marginally late, never lost.
 */
export function bonusGainSourceSelectors(source: CardName | undefined): Array<string> {
  const name = source ?? '';
  if (name === '') {
    return ['[data-embed-source-slot]'];
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
  return [
    `.con-start__played [data-played-key="${esc}"] .con-splayed__face`,
    `.con-start__played [data-played-key="${esc}"]`,
    '[data-embed-source-slot]',
    `.con-played [data-played-key="${esc}"]`,
  ];
}
