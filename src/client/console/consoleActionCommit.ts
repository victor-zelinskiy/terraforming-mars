/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ACTION COMMIT — the ONE universal activation beat of a card action
 * (docs/CONSOLE_BLUE_ACTION_PARITY.md, iteration 19; NORTH STAR:
 * docs/claude/console/workspace-band.md § ACTION COMMIT).
 *
 * Between «A Подтвердить» and the result there is a short, systemic moment:
 * the button presses, the SOURCE CARD mechanically fixes the activation, an
 * impulse runs through the SELECTED action graphic and lands on its result
 * icon, and only then the result animation takes over. The commit never
 * depicts the result — it fixes the boundary «настраивал → активировал».
 *
 * This module owns the unit-testable half: the commit lifecycle state (the
 * min-beat gate a fast server must not cut short, the abort a rejected submit
 * must release) and the PLAN — the normalized visual description of the
 * result the shell's handoff consumes (reward specs + per-icon origin points
 * CACHED AT SUBMIT TIME, so the reward wave never depends on the workspace
 * still being mounted when the answer lands). The DOM/GSAP half lives in
 * consoleActionCommitMotion.ts; game logic stays in the existing systems.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionEffect, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {OrOptionsModel} from '@/common/models/PlayerInputModel';
import {Payment} from '@/common/inputs/Payment';
import {
  RATING_RAIL_KEY, ResourceTransferSpec, TransferPoint, TransferRect, extractPlayRewards, isStandardResource, mergeTransferSpecs,
  railRewardSpecs, railRowKey,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import type {RailReward} from '@/client/console/resourceTransfer/railReward';

/**
 * The RESULT CATEGORY the commit hands off to. One systemic commit language;
 * only the handoff differs:
 *  - `deck-check` / `draw` — the impulse ends on the card-draw icon and the
 *    HUD deck answers; the existing physical draw beat follows.
 *  - `resources` — the reward wave (resource-transfer framework) materializes
 *    chips FROM the action graphic's own icons into the rail rows.
 *  - `tile` — the impulse ends on the tile icon; the board takes priority
 *    through the existing placement flow.
 *  - `global` — the impulse ends on the parameter icon; the existing HUD /
 *    scale animations carry the change.
 *  - `rating` — a DIRECT TR of the branch (no tile, no scale ahead of it to
 *    own it): the impulse ends on the printed TR icon and the handoff flies a
 *    token from that icon to the rail's rating cell (`ActionCommitPlan.rail` —
 *    «a gain is a reward», never a number that changed).
 *  - `generic` — the mechanical commit alone (no addressable large result).
 */
export type ActionCommitKind = 'deck-check' | 'draw' | 'resources' | 'tile' | 'global' | 'rating' | 'generic';

/**
 * THE RAIL HALF of a commit — what the branch pays that is HELD on the rail
 * through `railReward.ts` (seeded in the transport's apply block against the
 * diff of the two views, flown by the shell at the handoff): a direct TR, and
 * the moves on the card's own capsule when the printed row is a TIMELINE
 * (`capsuleTimeline`). Built pure (`commitRailPlan`), measured at submit.
 */
export type ActionCommitRail = {
  /** The owner key of the rail reward (`railReward.ts`). */
  key: string;
  /** The promise checked against the views: the cause in the printed order, the table's answer, the branch's other moves. */
  reward: RailReward;
  /**
   * The cause in LINKS — indices into `reward.cause` flown together; link k + 1
   * starts on link k's TOUCHDOWN (TR28: «[fighter] , −2 [fighter] : [TR]» — the
   * fighter lands, then two leave, then the TR is born). One link is the plain
   * case (UNMI: the TR alone).
   */
  links: ReadonlyArray<ReadonlyArray<number>>;
  /** The card is a TARGET or a SOURCE of some link: the workspace stands until the last link is born. */
  holdsSurface: boolean;
  /** Origins aligned with `reward.cause` — the printed icon each token is born on (measured at submit). */
  origins: ReadonlyArray<TransferPoint | undefined>;
  /** The printed TR icon's box, when a later link is born under it — its ring marks that birth. */
  ring?: TransferRect;
};

/**
 * The normalized handoff plan, built and MEASURED at submit time. `origins`
 * aligns to `specs` by index (the resource-transfer contract): each reward
 * chip is born at ITS OWN icon inside the action graphic. `sourcePoint` is
 * the card-level fallback for a spec whose icon could not be resolved.
 */
export type ActionCommitPlan = {
  sourceCard: CardName;
  kind: ActionCommitKind;
  specs: ReadonlyArray<ResourceTransferSpec>;
  origins: ReadonlyArray<TransferPoint | undefined>;
  sourcePoint?: TransferPoint;
  /** The rail half (a direct TR, a capsule timeline) — held through `railReward`, never by the shell's own hold. */
  rail?: ActionCommitRail;
};

/**
 * The commit lifecycle. `active`/`settled` mirror the draw beat's
 * answerIn/beatDone shape (consoleWorkspaceOutcome): the beat owes its
 * minimum time from the CONFIRM, so a fast server answer cannot cut it —
 * the shell holds the dismiss while `actionCommitHolding()`.
 */
export const actionCommitState = reactive({
  /** Armed at submit; released by settle/abort/reset. */
  active: false,
  /** The visual beat has played out (or reduced-motion resolved it). */
  settled: true,
  /**
   * Bumped when a submitted action is REJECTED (server error) — the composer
   * watches this to drop its `submitting` lock and return to the editable
   * state (the premium rollback: nothing stays falsely activated).
   */
  abortNonce: 0,
  /** The pending handoff plan (consumed once by the shell's resolution). */
  plan: undefined as ActionCommitPlan | undefined,
});

/**
 * Backstop only: the settle must never gate the flow forever if the motion
 * episode dies without its callback (a torn-down stage, a stalled timeline in
 * a backgrounded tab). Deliberately short — the healthy beat settles ≈0.7 s,
 * so anything past ~1.4 s is already a failure, and failing fast turns a
 * broken beat into a slightly abrupt one instead of a hang.
 */
const SETTLE_SAFETY_MS = 1400;

let settleTimer: ReturnType<typeof setTimeout> | undefined;

function clearSettleTimer(): void {
  if (settleTimer !== undefined) {
    clearTimeout(settleTimer);
    settleTimer = undefined;
  }
}

/** Arm the commit at submit (synchronous — before the response can land). */
export function armActionCommit(plan: ActionCommitPlan): void {
  actionCommitState.active = true;
  actionCommitState.settled = false;
  actionCommitState.plan = plan;
  clearSettleTimer();
  if (typeof setTimeout === 'function') {
    settleTimer = setTimeout(() => {
      settleTimer = undefined;
      markActionCommitSettled();
    }, SETTLE_SAFETY_MS);
  } else {
    actionCommitState.settled = true;
  }
}

/** The visual beat finished (the motion's own completion, or the backstop). */
export function markActionCommitSettled(): void {
  clearSettleTimer();
  actionCommitState.settled = true;
}

/** Is the minimum readable commit still owed? (The shell's dismiss gate.) */
export function actionCommitHolding(): boolean {
  return actionCommitState.active && !actionCommitState.settled;
}

/** Take the handoff plan (one consumer — the shell's awaiting resolution). */
export function consumeActionCommitPlan(): ActionCommitPlan | undefined {
  const plan = actionCommitState.plan;
  actionCommitState.plan = undefined;
  return plan;
}

/**
 * Who else must let go when the commit is released — the rail half
 * (`consoleActionCommitRail.ts`) registers here, so a commit released WITHOUT
 * its handoff (a result the workspace hosts, a rejected submit, a game switch)
 * never leaves a rail row held for a flight nobody will fly. A seam, not an
 * import: this module stays the unit-testable half.
 */
const releaseListeners: Array<(why: string) => void> = [];

export function onActionCommitRelease(listener: (why: string) => void): void {
  releaseListeners.push(listener);
}

/** The action resolved (result handed off / dismissed) — release the beat. */
export function releaseActionCommit(why = 'released'): void {
  clearSettleTimer();
  actionCommitState.active = false;
  actionCommitState.settled = true;
  actionCommitState.plan = undefined;
  releaseListeners.forEach((listener) => listener(why));
}

/**
 * The submitted action was REJECTED — the premium rollback. Releases every
 * commit hold and tells the composer (via `abortNonce`) to drop its
 * `submitting` lock so the workspace returns to a safe, editable state with
 * the player's captures intact. Never starts a result animation.
 */
export function abortConsoleActionCommit(): void {
  releaseActionCommit('aborted');
  actionCommitState.abortNonce++;
}

/** Full reset (game switch / spec cleanup). */
export function resetActionCommit(): void {
  releaseActionCommit('reset');
  actionCommitState.abortNonce = 0;
}

// ── the pure plan builders ──────────────────────────────────────────────────

/** The scales (and the oceans): a TR beside one of these is the scale's own reward, paid with its step. */
const SCALE_ICONS: ReadonlySet<string> = new Set(['temperature', 'oxygen', 'venus', 'oceans']);

/**
 * The premium chips of the options the player picked in this branch's OR steps
 * — the server's own `OptionMetadata.effects` for the outcome that was actually
 * chosen. The same fact `extractPlayRewards` reads to build the reward specs,
 * asked here for the CATEGORY.
 */
function chosenStepEffects(
  branch: ActionPreviewBranch,
  stepResponses: Readonly<Record<number, unknown>>,
): Array<ActionEffect> {
  const out: Array<ActionEffect> = [];
  (branch.steps ?? []).forEach((step, i) => {
    if (step.kind !== 'input' || step.input.type !== 'or') {
      return;
    }
    const r = stepResponses[i] as {type?: string, index?: number} | undefined;
    if (r === undefined || r.type !== 'or' || typeof r.index !== 'number') {
      return;
    }
    const opt = (step.input as OrOptionsModel).options[r.index] as
      {metadata?: {effects?: ReadonlyArray<ActionEffect>}} | undefined;
    out.push(...(opt?.metadata?.effects ?? []));
  });
  return out;
}

/**
 * The result CATEGORY of a branch — structural, from the same preview the
 * claim kinds derive from (never from the card's identity). Precedence
 * mirrors how large a result's own presentation is: a reveal/draw owns a
 * whole stage, a tile owns the board, a global owns the HUD scale, resources
 * own the rail wave; anything else keeps the mechanical commit alone.
 */
export function commitKindForBranch(
  branch: ActionPreviewBranch | undefined,
  /**
   * The captured step responses. A branch whose RESULT is chosen in a step
   * («получите любой стандартный ресурс» → titanium) states nothing in its own
   * chips — at preview time the resource does not exist yet — so without the
   * answers the category reads `generic` and the commit plays the mechanical
   * beat alone while the rail counters tick behind it, unexplained. The chosen
   * option's own chips join the pool; precedence is unchanged.
   */
  stepResponses: Readonly<Record<number, unknown>> = {},
): ActionCommitKind {
  if (branch === undefined) {
    return 'generic';
  }
  if (branch.reveal !== undefined) {
    return 'deck-check';
  }
  const effects = [...(branch.effects ?? []), ...chosenStepEffects(branch, stepResponses)];
  if (effects.some((e) => e.direction === 'gain' && e.icon === 'cards')) {
    return 'draw';
  }
  if ((branch.steps ?? []).some((s) => s.kind === 'boardPlacement')) {
    return 'tile';
  }
  if (effects.some((e) => e.direction === 'gain' && SCALE_ICONS.has(e.icon))) {
    return 'global';
  }
  // THE PRINTED ROW AS A TIMELINE: its FIRST beat is a resource landing on the card — the impulse lands there,
  // and the TR is born later, under its own ring (`ActionCommitRail.ring`).
  if (capsuleTimeline(branch) !== undefined) {
    return 'resources';
  }
  if (actionRailTrSpecs(branch, stepResponses).length > 0) {
    return 'rating';
  }
  // A TR the rail rule does not own (a chip with a note) keeps the historical landing on its icon.
  if (effects.some((e) => e.direction === 'gain' && e.icon === 'tr')) {
    return 'global';
  }
  // A rail-bound gain (stock or production of a standard resource, or a
  // card-resource gain) → the reward wave / the transfer flows own the result.
  const railGain = effects.some((e) => e.direction === 'gain' && e.amount > 0 && e.unit === undefined &&
    (isStandardResource(e.icon) || e.note === 'on this card' || e.note === 'to a card'));
  return railGain ? 'resources' : 'generic';
}

/**
 * PL-001 FOR ACTIONS — «A GAIN IS A REWARD»: the branch's DIRECT TR as a spec
 * of the rail (`stock:rating`), or nothing. Pure, structural, never the card's
 * name. A TR chip with no note is direct when NOTHING ahead of it owns it:
 *  · a board PLACEMENT step — the TR belongs to the tile (an ocean, a
 *    greenery) and arrives with it (Aquifer Pumping, Water Import);
 *  · a SCALE gain (temperature / oxygen / Venus / oceans) — the TR is the
 *    scale's own step and arrives with it;
 *  · a DRAW or a REVEAL — the result is hosted in the workspace's own stage,
 *    which owns its own pacing.
 * Otherwise (UNMI's «3 M€ → TR», Caretaker Contract's heat, Equatorial
 * Magnetizer's energy production, the TR branches of Nitrite-Reducing Bacteria
 * and Titan Air-scrapping, Earth Army Contract's two fighters) the TR is held
 * on the rail and flies from the printed icon. The chosen OR option's own chips
 * count (the result picked in a step).
 */
export function actionRailTrSpecs(
  branch: ActionPreviewBranch | undefined,
  stepResponses: Readonly<Record<number, unknown>> = {},
): Array<ResourceTransferSpec> {
  return directTrSpecs(branch, branch?.effects ?? [], stepResponses, {drawOwnsTr: true});
}

/**
 * PL-001 FOR PLAYS — the SAME rule at the card-play door: the direct TR of the
 * branch the composer committed, read off the chips the play's own reward beat
 * carries (`heroRewardEffectsOf` — a WALK of the Agenda track pays its own TR
 * off the track's node, TR04). One difference, and it is the door's, not the
 * TR's: a DRAW does not own a play's TR. An action's draw IS its commit's
 * result (the impulse lands on the printed cards, the deck answers), so its TR
 * had no beat of its own; a play's draw is dealt AFTER the landing scene ends,
 * and the scene's reward beat — where this TR flies — is already behind it
 * (UNMI Contractor: «+3 TR, draw a card»).
 */
export function playRailTrSpecs(
  branch: ActionPreviewBranch | undefined,
  effects: ReadonlyArray<ActionEffect>,
  stepResponses: Readonly<Record<number, unknown>> = {},
): Array<ResourceTransferSpec> {
  return directTrSpecs(branch, effects, stepResponses, {drawOwnsTr: false});
}

/** The ONE rule behind both doors (see `actionRailTrSpecs`): a TR chip with no note that nothing ahead owns. */
function directTrSpecs(
  branch: ActionPreviewBranch | undefined,
  branchEffects: ReadonlyArray<ActionEffect>,
  stepResponses: Readonly<Record<number, unknown>>,
  opts: {drawOwnsTr: boolean},
): Array<ResourceTransferSpec> {
  if (branch === undefined || branch.reveal !== undefined || (branch.steps ?? []).some((s) => s.kind === 'boardPlacement')) {
    return [];
  }
  const effects = [...branchEffects, ...chosenStepEffects(branch, stepResponses)];
  if (effects.some((e) => e.direction === 'gain' && (SCALE_ICONS.has(e.icon) || (opts.drawOwnsTr && e.icon === 'cards')))) {
    return [];
  }
  return railRewardSpecs(effects).filter((spec) => spec.resource === RATING_RAIL_KEY);
}

/**
 * THE PRINTED ROW AS A TIMELINE (TR28 Earth Army Contract — «→ [fighter] ,
 * −2 [fighter] : [TR]»): the branch ADDS to its own card and then SPENDS from
 * it — in the server's chips (the printed order) a gain noted «on this card»
 * followed by a cost noted «on this card» of the same resource. Two movements,
 * never a net «−1»: the resource lands on the card's capsule, and only then do
 * the spent units leave it. A spend from the card with no gain BEFORE it
 * (Nitrite-Reducing Bacteria's «−3 here : TR», Titan Air-scrapping's «−2 here»)
 * is not a timeline: its capsule keeps its historical behaviour (owner's
 * decision 6 of the TR28 brief; the class is ready for it).
 */
export function capsuleTimeline(branch: ActionPreviewBranch | undefined): {gain: ActionEffect, spend: ActionEffect} | undefined {
  const effects = branch?.effects ?? [];
  const gainAt = effects.findIndex((e) => e.direction === 'gain' && e.note === 'on this card' && e.amount > 0);
  if (gainAt < 0) {
    return undefined;
  }
  const gain = effects[gainAt];
  const spend = effects.slice(gainAt + 1).find((e) => e.direction === 'cost' && e.note === 'on this card' && e.icon === gain.icon && e.amount > 0);
  return spend === undefined ? undefined : {gain, spend};
}

/**
 * THE COMPOSER'S READING OF A TIMELINE (TR28, before the press): ONE chip for
 * the card's own capsule — where it starts and where it ends (`c → c − 1`) —
 * that carries its two MOVEMENTS in order (`+1 · −2`), never a bare net «−1»
 * and never the spend read before the gain («БУДЕТ СПИСАНО 2 → 0 · ВЫ
 * ПОЛУЧИТЕ 1 → 2» read the printed row backwards). It stands on the RESULT
 * side: the spend is a consequence of the action, not its price. Built from the
 * server's own chips (their `current` / `resulting`), so the numbers are the
 * preview's.
 */
export function capsuleTimelineReading(branch: ActionPreviewBranch | undefined): {effect: ActionEffect, moves: ReadonlyArray<number>, parts: ReadonlyArray<ActionEffect>} | undefined {
  const timeline = capsuleTimeline(branch);
  if (timeline === undefined) {
    return undefined;
  }
  const {gain, spend} = timeline;
  const net = gain.amount - spend.amount;
  return {
    effect: {
      direction: net >= 0 ? 'gain' : 'cost',
      icon: gain.icon,
      amount: Math.abs(net),
      ...(gain.current !== undefined ? {current: gain.current} : {}),
      ...(spend.resulting !== undefined ? {resulting: spend.resulting} : {}),
      note: 'on this card',
    },
    moves: [gain.amount, -spend.amount],
    parts: [gain, spend],
  };
}

/** A `Payment`'s fields that are rail rows (a card resource spent as M€ leaves no rail row). */
const PAYMENT_RAIL_ROWS: ReadonlyArray<keyof Payment> = ['megacredits', 'heat', 'steel', 'titanium', 'plants'];

/**
 * THE BRANCH'S OTHER MOVES ON THE RAIL — what the same response changes on the
 * viewer's rows beside the held reward, keyed by `railRowKey`: the branch's
 * costs (a stock cost, a production cost), its gains the shell's own wave
 * carries, and — when a payment step was answered — that captured payment in
 * place of the M€ cost it settles. The reward's diff check
 * (`railReward.verifyRailReward`) allows for exactly these; a row that moved
 * otherwise is not held and names itself.
 */
export function actionKnownRailMoves(
  branch: ActionPreviewBranch | undefined,
  stepResponses: Readonly<Record<number, unknown>> = {},
  /** A payment made OUTSIDE the steps — a card play's own price, answered with the play itself. */
  paid?: Payment,
): Record<string, number> {
  const known: Record<string, number> = {};
  if (branch === undefined) {
    return known;
  }
  const add = (channel: 'stock' | 'production', resource: string, amount: number) => {
    if (amount !== 0 && isStandardResource(resource)) {
      const row = railRowKey({channel, resource});
      known[row] = (known[row] ?? 0) + amount;
    }
  };
  const payments = Object.values(stepResponses)
    .map((r) => r as {type?: string, payment?: Payment} | undefined)
    .filter((r): r is {type: 'payment', payment: Payment} => r?.type === 'payment' && r.payment !== undefined);
  for (const e of [...(branch.effects ?? []), ...chosenStepEffects(branch, stepResponses)]) {
    if (e.unit !== undefined || e.amount <= 0 || (e.note !== undefined && e.note !== 'production')) {
      continue;
    }
    const channel = e.note === 'production' ? 'production' : 'stock';
    if (e.direction === 'cost') {
      // A cost a payment step settles is that payment's — counted below, never twice.
      if (!(channel === 'stock' && e.icon === 'megacredits' && payments.length > 0)) {
        add(channel, e.icon, -e.amount);
      }
    } else if (e.direction === 'gain') {
      add(channel, e.icon, e.amount);
    }
  }
  // A play's price is no chip of its branch (the payment panel states it), so the loop above settles nothing of it.
  for (const payment of [...payments.map((r) => r.payment), ...(paid !== undefined ? [paid] : [])]) {
    for (const resource of PAYMENT_RAIL_ROWS) {
      add('stock', resource, -(payment[resource] ?? 0));
    }
  }
  return known;
}

/** The rail reward's owner key of one card's action commit. */
export function actionCommitRailKey(card: CardName): string {
  return `action-commit:${card}`;
}

/**
 * THE RAIL HALF OF A BRANCH (pure — measured later, at the press): the direct
 * TR (`actionRailTrSpecs`), the capsule timeline's two movements before it
 * (`capsuleTimeline`), the table's answer read off the branch's forecast (only
 * an `exact` fact addressed to «you» — `reactionRailSpecs`), the branch's other
 * known moves. Undefined when the branch has nothing the rail must hold.
 */
export function commitRailPlan(
  cardName: CardName,
  branch: ActionPreviewBranch | undefined,
  stepResponses: Readonly<Record<number, unknown>>,
  reactions: ReadonlyArray<ResourceTransferSpec>,
): Omit<ActionCommitRail, 'origins' | 'ring'> | undefined {
  const tr = actionRailTrSpecs(branch, stepResponses);
  const timeline = capsuleTimeline(branch);
  if (tr.length === 0 && timeline === undefined) {
    return undefined;
  }
  const cause: Array<ResourceTransferSpec> = [];
  const links: Array<Array<number>> = [];
  if (timeline !== undefined) {
    cause.push({channel: 'card-resource', resource: timeline.gain.icon, amount: timeline.gain.amount, targetCard: cardName});
    links.push([0]);
    cause.push({channel: 'card-resource', resource: timeline.spend.icon, amount: timeline.spend.amount, targetCard: cardName, direction: 'loss'});
    links.push([1]);
  }
  if (tr.length > 0) {
    links.push(tr.map((_, i) => cause.length + i));
    cause.push(...tr);
  }
  const known = actionKnownRailMoves(branch, stepResponses);
  return {
    key: actionCommitRailKey(cardName),
    reward: {cause, reactions: [...reactions], known},
    links,
    holdsSurface: timeline !== undefined,
  };
}

/**
 * THE RAIL HALF OF A CARD PLAY (pure — PL-001 for plays): the branch's direct
 * TR (`playRailTrSpecs` over the chips the landing scene's reward beat carries),
 * the table's answer (an `exact` forecast fact addressed to «you» —
 * `reactionRailSpecs`, handed in), and the branch's other known moves with the
 * play's own price (`paid` — the composer's payment, never a chip of the
 * branch). Undefined when the play gains no direct TR.
 */
export function playRailReward(
  branch: ActionPreviewBranch | undefined,
  effects: ReadonlyArray<ActionEffect>,
  stepResponses: Readonly<Record<number, unknown>>,
  paid: Payment | undefined,
  reactions: ReadonlyArray<ResourceTransferSpec>,
): RailReward | undefined {
  const cause = playRailTrSpecs(branch, effects, stepResponses);
  if (cause.length === 0) {
    return undefined;
  }
  return {cause, reactions: [...reactions], known: actionKnownRailMoves(branch, stepResponses, paid)};
}

/**
 * The reward WAVE the shell flies itself (`ActionCommitPlan.specs`) — every
 * transfer of the branch minus what the rail half holds: a timeline's landing
 * on the card is the rail's first link, never a second chip.
 */
export function commitWaveSpecs(
  cardName: CardName,
  branch: ActionPreviewBranch | undefined,
  stepResponses: Readonly<Record<number, unknown>>,
): Array<ResourceTransferSpec> {
  const specs = commitRewardSpecs(cardName, branch, stepResponses);
  const timeline = capsuleTimeline(branch);
  return timeline === undefined ? specs :
    specs.filter((spec) => !(spec.channel === 'card-resource' && spec.targetCard === cardName && spec.resource === timeline.gain.icon));
}
/**
 * The reward specs the commit wave carries — the SAME extraction the
 * played-card beat uses (`extractPlayRewards`: server-computed preview
 * amounts, never client re-derivations). ALL THREE channels ride: the rail
 * wave (stock/production) AND the card-resource flight to the pre-selected
 * target — an action that puts animals on a card presents the same premium
 * transfer a card PLAY does (one language, every activation door: the
 * ДЕЙСТВИЯ КАРТ commit and the Hydronetwork repeat read this one builder).
 * The transfer framework resolves the landing honestly: the target's own
 * on-screen face when one is painted, else the additional-resources
 * satellite — never a silent counter jump with no flight.
 */
export function commitRewardSpecs(
  cardName: CardName,
  branch: ActionPreviewBranch | undefined,
  stepResponses: Readonly<Record<number, unknown>>,
): Array<ResourceTransferSpec> {
  if (branch === undefined) {
    return [];
  }
  const all = extractPlayRewards({
    cardName,
    effects: branch.effects ?? [],
    steps: branch.steps ?? [],
    stepResponses,
  });
  return mergeTransferSpecs(all);
}
