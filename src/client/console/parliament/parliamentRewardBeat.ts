/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE REWARD BEAT'S LEDGER (Turmoil Redux — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §4, §6 «НАГРАДА»; docs/TURMOIL_REDUX_PARLIAMENT_FINISH.md § Э5): what the
 * enacted resolution has just PAID this seat and has not yet been SHOWN to
 * land — the records whose rail chip still has to leave the carrier card (or
 * the ruling party's plaque) and touch its row, with the panel's counter held
 * back until that contact.
 *
 * The beat is split the way every reward beat in this console is split
 * (`startBonusGain.ts` — ARM/DETECT → SEED → OWE → FLY), because its halves
 * live in different frames:
 *
 *   DETECT — pure, against the AUTHORITATIVE response: the viewer's NEW
 *            records in the live phase (`phase.outcomes`), keyed structurally
 *            (player · step · part · kind — never a title, never a name);
 *   SEED   — in the transport's `seedRewardHolds`, the SAME synchronous block
 *            as the view apply: the panel renders `committed − held`, so a
 *            hold seeded a tick late flushes a phantom −N chip;
 *   OWE    — the records wait here for the sitting director, which flies
 *            them on the reward stage (`sittingDirector.beatReward`);
 *   FLY    — the director consumes them; each touchdown releases its hold.
 *
 * Two honesties:
 *  · a wave plays only when the sitting is ON SCREEN at the seed (the stage
 *    zone stands — or the seat's generation scene rises into it: the soft gates
 *    bring the whole chain with the production). A parked / absent Parliament gets no hold and no owed beat:
 *    the counter ticks at once with its ordinary delta chip — the reward is
 *    announced where the player is looking, never withheld from them — and the
 *    stage reads «Получено» when they come back. A reward beat never REPLAYS
 *    (resume / a yield-return): a counter cannot honestly tick twice;
 *  · NO WALL CLOCK decides a tick (v2). A hold is released by (a) its chip's
 *    touchdown, (b) an explicit END OF THE STAGE — the sitting leaves for the
 *    board, closes, collapses, its section unmounts (`releaseParliamentRewards`
 *    with a named reason), or (c) the hold registry's own 35 s ceiling with
 *    a diagnosis (`parliament-reward-owed` / `parliament-agenda-bonus-owed`,
 *    the wedge net every critical animation shares). A player who pauses on
 *    a page releases nothing: the numbers wait for their beat.
 *
 * The AGENDA STEPS' BONUSES of the viewer ride the same ledger — a QUEUE, one
 * entry per step that PAYS (TR04 walks the marker two steps and «collects the
 * bonus of each»; the sitting's and the quest's one step are a queue of one):
 * a TR step's rating is held on the rail's own score cell (`stock` channel,
 * key `rating`) until its chip has flown from THAT step and touched the row —
 * two TR steps hold the rail twice, and the second release ticks the second
 * point; a CARD step parks the `agenda`-sourced reveal until the cover can
 * lift off its own step. `takeAgendaBonus(generation, step)` takes a step's
 * own entry, `markAgendaBonusLanded(step)` releases exactly it.
 *
 * Pure + a reactive record; no DOM, no Vue components, no i18n.
 */
import {reactive} from 'vue';
import {sittingBaselineOf} from './sittingBaseline';
import {pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {StandardMoves} from '@/common/parliament/ParliamentTypes';
import {RewardDelivery, rewardAddressOf} from '@/common/parliament/rewardAddress';
import {RATING_RAIL_KEY, ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {beginPanelRewardHold, declareHeldAnswers, releasePanelRewardHold, runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cardReactionAnswerFlight} from '@/client/console/cardReaction/cardReactionDirector';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleParliamentUi} from './consoleParliamentFlow';
import {generationSceneRisesIntoSitting} from '@/client/console/generationScene/generationScene';
import {workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {ParliamentBeat, scheduleParliamentBeat} from './parliamentBeat';
import {enterWorldBeatSitting, seedWorldMoveBeat} from './parliamentWorldBeat';
import {sittingRiseOwed} from './sittingRise';
import {releaseCareerGrantWalks, resetCareerGrantBeat, seedCareerGrantWalks} from './careerGrantBeat';
import {releaseOrphanTableReceipts, releaseTableReceipts, resetTableReceiptBeat, seedTableReceipts} from './tableReceiptBeat';

/** The rail's key for the terraform rating (the score cell) — the transfer model's own (`resourceTransferModel.ts`), re-exported for the parliament's seeders. */
export {RATING_RAIL_KEY};

/** THE REASONS a stage ends with holds still standing — every release names one (the trail reads it). */
export type RewardReleaseReason = 'board' | 'close' | 'collapse' | 'unmount' | 'stage-settled' | 'ceiling' | 'new-sitting' | 'reset' | 'no-glide' | 'unmeasurable-step' | 'stage-finished' | 'landed' | 're-seed';

export type RewardBeatKey = string;

/** ONE record the director still owes a flight for. */
export type OwedReward = {
  key: RewardBeatKey;
  outcome: ParliamentEnactOutcomeModel;
  delivery: RewardDelivery;
  /** The rail chip this record flies (the address's unit on the address's row). */
  spec: ResourceTransferSpec;
};

export type AgendaBonusOwed = {
  generation: number;
  player: Color;
  /** The Agenda step the marker reached (the chip's birthplace / the cover's step). */
  step: number;
  /** A TR step pays a rating (held on the rail until its chip lands); a CARD step pays a card (its reveal PARKED until the glide lands on the step). */
  kind: 'tr' | 'card';
  /** The rail chip of a TR step. */
  spec?: ResourceTransferSpec;
  /**
   * THE TABLE'S ANSWER to a TR step (PL-002 — the ruling Greens' M€ for a
   * rating): held on its rows WITH the rating from the seed, never flown, and
   * released one beat of the animation clock after the step's chip has
   * touched the rail — a reaction never ticks before its reason (the rail
   * reward's own law, `railReward.ts`). A card's walk verifies its preview's
   * promise against the two views (`agendaWalkReactions`); the sitting's winner
   * step and the quest read the SERVER's measure of the step
   * (`AgendaAdvanceStep.answer` → `agendaStepAnswerSpecs`).
   */
  reactions?: ReadonlyArray<ResourceTransferSpec>;
  /**
   * The entry belongs to a LAW's step of the Career (Reds Budget — the sitting's КАРЬЕРА beat), never to the winner's
   * step of the enactment: the enactment's own takes and flushes (`takeAgendaBonus` / `markAgendaBonusLanded` without
   * a step, `flushAgendaBonus(…, 'phase')`) pass it by — a neutral winner's «no glide» once swept the law's TR off the
   * rail before its walk had even started.
   */
  career?: true;
  /**
   * A CARD step's cover has LIFTED off its node (TR37 — a card step in the
   * MIDDLE of a walk): the cover scene owns the batch from here, so the park
   * lets go and the ledger's own hold stands down — the take is the PLAYER's
   * (the viewer waits for «Взять»), never a beat on a clock. The entry stays
   * owed until the card has LANDED in the dock (`markAgendaBonusLanded`): the
   * walk's next leg waits for exactly that.
   */
  lifted?: boolean;
};

export const parliamentRewardState = reactive({
  /** The sitting these records belong to (`generation:seq`) — a new sitting drops what the old one still owed. */
  sitting: '',
  /** Records whose wave is still to fly (the panel holds their counters). */
  owed: [] as Array<OwedReward>,
  /** Records whose wave is in the air (consumed by the director, not landed yet). */
  flying: [] as Array<OwedReward>,
  /** Keys whose chips have LANDED (or were released) this sitting — the reading turns «Получено». */
  landed: [] as Array<RewardBeatKey>,
  /** The viewer's Agenda step bonuses, one per paying step of the walk, in the walk's order — each held until its own step has landed. */
  agendaBonuses: [] as Array<AgendaBonusOwed>,
  /**
   * THE WINNER'S TILE JUST LANDED (the viewer's own `ocean` / `greenery`
   * record arrived while the sitting's frame stood aside for the board): when
   * the frame comes back, the reward stage shows its «received» pose — the
   * parameter's move and the TR — for one read beat BEFORE the server's next
   * step takes the page. Consumed by the section on its return.
   */
  tileReceipt: undefined as {sitting: string, outcome: ParliamentEnactOutcomeModel} | undefined,
  /** The section is SHOWING the receipt — the reward beat dwells on the pose (cleared with the beat). */
  receiptShowing: false,
  /**
   * THE WALK IS STILL AHEAD (the soft gates): the records were seeded while no stage stood — the whole chain rode a
   * response the seat received on the board (the last pass was another seat's), and the plate / the generation scene
   * will open the sitting. The rail holds them meanwhile, but their animation holds claim NO foreground until the
   * stage stands (the plate itself must come up); the rising edge then arms the registry's ceiling as ever.
   */
  awaitingStage: false,
});

/**
 * IS THIS SITTING'S WALK STILL AHEAD OF THE SEAT? — the stage stands, the seat's generation scene rises into it, or
 * (the soft gates) the seat's sitting stands for it and no Parliament frame is up yet: the plate or the scene opens
 * it, and the walk plays what this response paid. The ledger's seeders read it as «on screen».
 */
export function sittingWalkAhead(after: PlayerViewModel | undefined): boolean {
  if (consoleParliamentUi.stageStanding || generationSceneRisesIntoSitting(after)) {
    return true;
  }
  return after?.game.parliament?.phase !== undefined && !workspaceFrameKnown('parliament');
}

/** The owed records claim the foreground — always once a stage stands; not while the walk is merely ahead. */
function claimsForeground(): boolean {
  return consoleParliamentUi.stageStanding || !parliamentRewardState.awaitingStage;
}

/**
 * A REWARD OWED OR IN THE AIR HOLDS THE FOREGROUND — from the very block
 * that seeded it. The director arms the stage's own hold only a few frames
 * later (a tick, a probe tick, the run), and the ask that arrived WITH the
 * record (the winner's tile, the take) admits itself in between: the board
 * took the screen, the frame stepped aside, the section unmounted and the
 * wave it owed was flushed unplayed (measured on Biodome Contest — the
 * placement prompt live before a single plant had left the card). A
 * BLOCKING supplier over the ledger's reactive record closes that gap: the
 * placement / host / follow-up families wait on `presentation` until the last
 * chip has landed. The registry's ceiling (35 s, with `diagnose`) is the ONE
 * wedge net (v2 — no wall clock of the ledger's own): its `expire` releases
 * the counters honestly and names what was still in the air.
 */
registerAnimationHoldSupplier('parliament-reward-owed', () => parliamentRewardPending() && claimsForeground(), {
  diagnose: () => ({
    sitting: parliamentRewardState.sitting,
    owed: parliamentRewardState.owed.map((r) => r.key),
    flying: parliamentRewardState.flying.map((r) => r.key),
  }),
  expire: () => flushParliamentRewards('ceiling'),
});

/**
 * An Agenda bonus the ledger still HOLDS the foreground for: every TR step
 * until its chip lands, a card step until its cover has lifted off the node.
 * A LIFTED card step is in the player's hands (the cover scene, then the
 * viewer's «Взять») — a wall clock over a player's reading is not a wedge
 * net, so the ledger stands down there and the scene's own holds take over.
 */
export function parliamentAgendaBonusHeld(): boolean {
  return parliamentRewardState.agendaBonuses.some((bonus) => bonus.kind !== 'card' || bonus.lifted !== true || !agendaCardBeforeThePlayer(bonus.step)) ||
    answering.size > 0 || answersFlying.size > 0;
}

/**
 * A LIFTED card step is in the player's hands only while its batch still STANDS for them (the cover scene, the viewer
 * waiting for «Взять»). A lifted step with no batch of its own left standing is in nobody's hands — the card is flying
 * into the dock (a real motion, ended by its touchdown), or the batch went somewhere it can never be taken from — and
 * the ledger holds it again, so the registry's ceiling bounds a walk that waits for a take that cannot come (a lifted
 * card step was the one entry with no net at all).
 */
function agendaCardBeforeThePlayer(step: number): boolean {
  return pendingRevealEvents().some((e) => e.source?.type === 'agenda' && (e.source.step === undefined || e.source.step === step));
}

/**
 * THE ANSWER BEATS in flight: a TR step's chip has landed and the table's
 * reactions wait one beat of the animation clock before they tick (by step).
 * A flush releases them at once and kills the beat.
 */
const answering = new Map<number, {beat: ParliamentBeat, specs: ReadonlyArray<ResourceTransferSpec>}>();
/**
 * The answers IN THE AIR, by step. A flush never releases their holds: the flight owns them from the beat on (every
 * touchdown releases its own, every way out of `flyAgendaAnswer` the rest).
 */
const answersFlying = new Set<number>();
/**
 * THE LANDING OF A STEP'S ANSWER, owed from `answerAgendaStep` to the flight's end — or to the flush that lets it go:
 * what `agendaAnswerSettled` hands the host that plays ПОВЕСТКА.
 */
const answerLandings = new Map<number, {landed: Promise<void>, settle: () => void}>();

function answerLandingOf(step: number): {landed: Promise<void>, settle: () => void} {
  const known = answerLandings.get(step);
  if (known !== undefined) {
    return known;
  }
  let resolve: () => void = () => undefined;
  const landed = new Promise<void>((r) => {
    resolve = r;
  });
  const entry = {
    landed,
    settle: (): void => {
      if (answerLandings.get(step) === entry) {
        answerLandings.delete(step);
      }
      resolve();
    },
  };
  answerLandings.set(step, entry);
  return entry;
}

function answerAgendaStep(step: number, specs: ReadonlyArray<ResourceTransferSpec>): void {
  answering.get(step)?.beat.kill();
  const landing = answerLandingOf(step);
  const beat = scheduleParliamentBeat(TOUCHDOWN_TICK_GAP_MS, () => {
    answering.delete(step);
    trail('answer-agenda', {step, specs: specs.map((spec) => `${spec.channel}:${spec.resource}+${spec.amount}`)});
    answersFlying.add(step);
    void flyAgendaAnswer(specs).finally(() => {
      answersFlying.delete(step);
      landing.settle();
    });
  });
  answering.set(step, {beat, specs});
}

/**
 * THE STEP'S ANSWER HAS LANDED (or there is none): the host that plays ПОВЕСТКА waits for it before its next beat —
 * the surfaces go IN TURN (the sitting's support, the quest's receipt never start under the charter's tokens). Resolves
 * at once when nothing is owed for `step` (any step when omitted). Never rejects.
 */
export function agendaAnswerSettled(step?: number): Promise<void> {
  const owed = step === undefined ? [...answerLandings.values()] : [answerLandings.get(step)].filter((entry) => entry !== undefined);
  return owed.length === 0 ? Promise.resolve() : Promise.all(owed.map((entry) => entry?.landed)).then(() => undefined);
}

/**
 * THE TABLE'S ANSWER TO A STEP'S RATING (iteration 6 of «СРАБАТЫВАНИЕ КАРТЫ» — a PARTY is a reactor): the answer's
 * rows were DECLARED at the queue, so the Greens' record of it is ATTACHED to this walk — the party's CHARTER comes
 * forward at the rail's edge, each token is born on the charter's printed icon and the row ticks on its own
 * touchdown. Nothing attached (reduced motion, a reload, no record) or no place to be born → the rows tick at once.
 */
async function flyAgendaAnswer(specs: ReadonlyArray<ResourceTransferSpec>): Promise<void> {
  const flight = cardReactionAnswerFlight({rows: [...new Set(specs.map((spec) => railRowKey(spec)))]});
  if (flight === undefined) {
    specs.forEach((spec) => releasePanelRewardHold(spec));
    return;
  }
  try {
    await flight.prepare?.();
    const tokens = specs.flatMap((spec) => flight.tokensOf?.(spec) ?? [spec]);
    const origins = tokens.map((spec) => flight.originOf(spec));
    if (!origins.every((o) => o !== undefined)) {
      specs.forEach((spec) => releasePanelRewardHold(spec));
      return;
    }
    await runResourceTransfers({
      specs: tokens,
      source: {},
      origins,
      arrival: 'auto',
      onArrive: (spec) => releasePanelRewardHold(spec),
    });
  } finally {
    flight.onLeft();
    flight.onDone?.();
  }
}

function flushAgendaAnswers(why: RewardReleaseReason | string): void {
  for (const [step, pending] of answering) {
    pending.beat.kill();
    pending.specs.forEach((spec) => releasePanelRewardHold(spec));
    answerLandings.get(step)?.settle();
    trail('flush-answer', {why, step});
  }
  answering.clear();
}

/** The Agenda bonuses ride the same law: held until each step's own landing, bounded by the registry's ceiling alone. */
registerAnimationHoldSupplier('parliament-agenda-bonus-owed', () => parliamentAgendaBonusHeld() && claimsForeground(), {
  diagnose: () => ({
    sitting: parliamentRewardState.sitting,
    bonuses: parliamentRewardState.agendaBonuses.map((bonus) => ({kind: bonus.kind, step: bonus.step, generation: bonus.generation})),
  }),
  expire: () => flushAgendaBonus('ceiling'),
});

/** The structural identity of one record: its seat, its step, its part and its kind (a reaction shares its cause's step). */
export function rewardBeatKey(outcome: ParliamentEnactOutcomeModel): RewardBeatKey {
  return `${outcome.player}:${outcome.step}:${outcome.part ?? ''}:${outcome.kind}`;
}

/**
 * The rail chip a record flies: a production / stock payout on its own row,
 * a party's answer on the row of what it paid. Undefined for every kind whose
 * address is not the rail (a card resource, cards, a tile, a skip) and for a
 * paying kind that paid nothing. A LOSS (a levy: a `stock` / `production`
 * record with a NEGATIVE amount) flies the same row BACKWARDS —
 * `direction: 'loss'`, the amount as a size — and ticks the counter on
 * departure; a reaction never flies a loss.
 */
export function waveSpecOf(outcome: ParliamentEnactOutcomeModel): ResourceTransferSpec | undefined {
  const amount = outcome.amount ?? 0;
  if (amount === 0) {
    return undefined;
  }
  const size = Math.abs(amount);
  const direction: ResourceTransferSpec['direction'] | undefined = amount < 0 ? 'loss' : undefined;
  const signed = (spec: ResourceTransferSpec): ResourceTransferSpec => (direction === undefined ? spec : {...spec, direction});
  switch (outcome.kind) {
  case 'production':
    return outcome.production === undefined ? undefined : signed({channel: 'production', resource: String(outcome.production), amount: size});
  case 'stock':
    return outcome.stock === undefined ? undefined : signed({channel: 'stock', resource: String(outcome.stock), amount: size});
  case 'reaction':
    if (amount < 0) {
      return undefined;
    }
    if (outcome.production !== undefined) {
      return {channel: 'production', resource: String(outcome.production), amount};
    }
    return outcome.stock === undefined ? undefined : {channel: 'stock', resource: String(outcome.stock), amount};
  default:
    return undefined;
  }
}

function phaseOf(view: PlayerViewModel | undefined): ParliamentPhaseModel | undefined {
  return view?.game.parliament?.phase;
}

/** The sitting's identity — the phase's generation and its monotonic seq (the generation alone on an older save). */
export function sittingKeyOf(view: PlayerViewModel | undefined): string {
  const phase = phaseOf(view);
  return phase === undefined ? '' : `${phase.generation}:${phase.summary?.seq ?? phase.generation}`;
}

/**
 * DETECT (pure): the viewer's records the RESPONSE added to the live phase —
 * present in `after`, absent from `before` (same generation), keyed
 * structurally. A first view (no `before`) or a new generation adds nothing:
 * a reload has no «before» with fewer records, so nothing replays.
 */
export function detectNewViewerRewards(before: PlayerViewModel | undefined, after: PlayerViewModel): Array<OwedReward> {
  const viewer = after.thisPlayer?.color;
  const phase = phaseOf(after);
  const was = sittingBaselineOf(before, after);
  if (viewer === undefined || phase === undefined || was === undefined || was.generation !== phase.generation) {
    return [];
  }
  const known = new Set((was.outcomes ?? []).map(rewardBeatKey));
  const out: Array<OwedReward> = [];
  for (const outcome of phase.outcomes ?? []) {
    if (outcome.player !== viewer) {
      continue;
    }
    const key = rewardBeatKey(outcome);
    if (known.has(key)) {
      continue;
    }
    const delivery = rewardAddressOf(outcome, viewer);
    const spec = waveSpecOf(outcome);
    if (delivery.address.surface !== 'rail' || spec === undefined) {
      continue;
    }
    out.push({key, outcome, delivery, spec});
  }
  return out;
}

/**
 * DETECT (pure): the viewer's BOARD TILE this response recorded (an `ocean` /
 * `greenery` record of theirs — the winner's tile — or a `city` record, the
 * tier a threshold grant placed on their own city) that was not there before:
 * the board scene placed it; the sitting owes its receipt on the way back.
 */
export function detectNewViewerTile(before: PlayerViewModel | undefined, after: PlayerViewModel): ParliamentEnactOutcomeModel | undefined {
  const viewer = after.thisPlayer?.color;
  const phase = phaseOf(after);
  const was = sittingBaselineOf(before, after);
  if (viewer === undefined || phase === undefined || was === undefined || was.generation !== phase.generation) {
    return undefined;
  }
  const known = new Set((was.outcomes ?? []).map(rewardBeatKey));
  return (phase.outcomes ?? []).find((o) => o.player === viewer && (o.kind === 'ocean' || o.kind === 'greenery' || o.kind === 'city') && !known.has(rewardBeatKey(o)));
}

/** The section takes the tile's receipt for THIS sitting (once); undefined when none is owed. */
export function takeTileReceipt(sitting: string): ParliamentEnactOutcomeModel | undefined {
  const receipt = parliamentRewardState.tileReceipt;
  if (receipt === undefined || receipt.sitting !== sitting) {
    return undefined;
  }
  parliamentRewardState.tileReceipt = undefined;
  return receipt.outcome;
}

/**
 * DETECT (pure): the viewer's Agenda step bonus this response RECORDED — the
 * phase's summary names the winner's step and its bonus (a TR step or a CARD
 * step); new when the baseline (`sittingBaselineOf` — the view before, with
 * no sitting yet, or the same sitting short of its Agenda move) had none.
 */
export function detectAgendaBonus(before: PlayerViewModel | undefined, after: PlayerViewModel): AgendaBonusOwed | undefined {
  const viewer = after.thisPlayer?.color;
  const phase = phaseOf(after);
  const agenda = phase?.summary?.agenda;
  if (viewer === undefined || phase === undefined || agenda === undefined || agenda.player !== viewer || (agenda.bonus !== 'tr' && agenda.bonus !== 'card')) {
    return undefined;
  }
  const was = sittingBaselineOf(before, after);
  if (was === undefined || was.summary?.agenda !== undefined) {
    return undefined;
  }
  if (agenda.bonus === 'card') {
    return {generation: phase.generation, player: viewer, step: agenda.to, kind: 'card'};
  }
  // THE TABLE'S ANSWER TO THE STEP'S RATING rides the step's own entry (the server measured it around the step — the
  // ruling Greens' 2 M€): held with the rating, DECLARED at the queue, so the party's record attaches to this walk and
  // ПОВЕСТКА tells it a beat after the step's chip — never the reaction chain's second story at the rail's edge.
  const reactions = agendaStepAnswerSpecs(agenda.answer);
  return {
    generation: phase.generation, player: viewer, step: agenda.to, kind: 'tr', spec: {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1},
    ...(reactions.length === 0 ? {} : {reactions}),
  };
}

/**
 * THE TABLE'S ANSWER TO ONE STEP OF THE CAREER as rail chips (pure): the server's measure of the step
 * (`AgendaAdvanceStep.answer` — what the seat's stock / production gained around the step's own bonus), the GAINS only,
 * in the rail's row order of the measure (stock first). A loss is never an answer the rail flies.
 */
export function agendaStepAnswerSpecs(answer: StandardMoves | undefined): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  for (const [resource, amount] of Object.entries(answer?.stock ?? {})) {
    if ((amount ?? 0) > 0) {
      out.push({channel: 'stock', resource, amount: amount ?? 0});
    }
  }
  for (const [resource, amount] of Object.entries(answer?.production ?? {})) {
    if ((amount ?? 0) > 0) {
      out.push({channel: 'production', resource, amount: amount ?? 0});
    }
  }
  return out;
}

// ── the ledger ─────────────────────────────────────────────────────────────

// ── the trail — what the ledger did and WHY (read by the e2e readiness probe; never by the product) ──
export type RewardTrailEvent = {t: number; ev: string; detail?: unknown};
const TRAIL_CAP = 80;
const rewardTrail: Array<RewardTrailEvent> = [];
function trail(ev: string, detail?: unknown): void {
  rewardTrail.push({t: typeof performance === 'undefined' ? Date.now() : Math.round(performance.now()), ev, detail});
  if (rewardTrail.length > TRAIL_CAP) {
    rewardTrail.splice(0, rewardTrail.length - TRAIL_CAP);
  }
}

/** The ledger's state and its recent trail — one snapshot for a diagnostic (`window.__conReady().parliamentReward`). */
export function parliamentRewardDiag(): {sitting: string; owed: Array<string>; flying: Array<string>; landed: Array<string>; agendaBonuses: Array<{step: number; generation: number; kind: 'tr' | 'card'}>; trail: Array<RewardTrailEvent>} {
  return {
    sitting: parliamentRewardState.sitting,
    owed: parliamentRewardState.owed.map((r) => r.key),
    flying: parliamentRewardState.flying.map((r) => r.key),
    landed: [...parliamentRewardState.landed],
    agendaBonuses: parliamentRewardState.agendaBonuses.map((bonus) => ({step: bonus.step, generation: bonus.generation, kind: bonus.kind})),
    trail: rewardTrail.slice(-40),
  };
}

function noteLanded(key: RewardBeatKey): void {
  if (!parliamentRewardState.landed.includes(key)) {
    parliamentRewardState.landed.push(key);
  }
}

/**
 * THE END OF A STAGE with holds still standing — the sitting leaves for the
 * board («К полю»), closes, collapses or its section unmounts: every owed /
 * flying record and the Agenda bonus release at once, the counters tick
 * (honestly late, never lost). The ONE door the section and the shell use —
 * a release always names its reason in the trail.
 */
export function releaseParliamentRewards(why: RewardReleaseReason): void {
  flushParliamentRewards(why);
  flushAgendaBonus(why);
  // …and the steps of the Career a law granted the seats: every held marker stands on its server step now.
  releaseCareerGrantWalks();
  // …and a receipt of the table still owed: its capsules, the satellite and the points tick now.
  releaseTableReceipts();
}

/** Release every owed / flying record's hold at once (a stage's end, the ceiling, a new sitting) — the counters tick, honestly late. `why` is for the trail. */
export function flushParliamentRewards(why: RewardReleaseReason | string = 'flush'): void {
  const pending = [...parliamentRewardState.owed, ...parliamentRewardState.flying];
  parliamentRewardState.owed = [];
  parliamentRewardState.flying = [];
  if (pending.length > 0) {
    trail('flush', {why, keys: pending.map((r) => r.key)});
  }
  for (const r of pending) {
    releasePanelRewardHold(r.spec);
    noteLanded(r.key);
  }
}

/**
 * Release EVERY Agenda bonus's hold at once (a stage's end, the ceiling, a glide that never came) — the table's answers
 * with them. `why` is for the trail. `scope: 'phase'` releases the ENACTMENT's own entries only (the winner's step) and
 * keeps a law's steps of the Career owed to the reward stage's КАРЬЕРА beat.
 */
export function flushAgendaBonus(why: RewardReleaseReason | string = 'flush', scope: 'all' | 'phase' = 'all'): void {
  const all = parliamentRewardState.agendaBonuses;
  const bonuses = scope === 'all' ? all.splice(0) : all.filter((bonus) => bonus.career !== true);
  if (scope === 'phase') {
    parliamentRewardState.agendaBonuses = all.filter((bonus) => bonus.career === true);
  }
  for (const bonus of bonuses) {
    trail('flush-agenda', {why, kind: bonus.kind, step: bonus.step, generation: bonus.generation});
    if (bonus.spec !== undefined) {
      releasePanelRewardHold(bonus.spec);
    }
    bonus.reactions?.forEach((spec) => releasePanelRewardHold(spec));
  }
  flushAgendaAnswers(why);
}

/**
 * OWE the steps' bonuses — the walk's queue, in the walk's order: a TR step's
 * rating goes on hold on the rail NOW (the same synchronous block as the view
 * apply), a card step parks its reveal. The one door every seeder uses (the
 * sitting's one step, the quest's, a card's walk of N).
 */
export function queueAgendaBonuses(bonuses: ReadonlyArray<AgendaBonusOwed>): void {
  for (const bonus of bonuses) {
    if (bonus.spec !== undefined) {
      beginPanelRewardHold([bonus.spec, ...(bonus.reactions ?? [])]);
      // THE TABLE'S ANSWER IS DECLARED (iteration 6): the party's record of it attaches to this walk — never the
      // chain's second flight over a raw hold (the seeder's `standaloneOverRawHold` class).
      declareHeldAnswers(bonus.reactions ?? []);
    }
    parliamentRewardState.agendaBonuses.push(bonus);
    trail('owe-agenda', {kind: bonus.kind, step: bonus.step, generation: bonus.generation, reactions: bonus.reactions?.length ?? 0});
  }
}

function enterSitting(key: string): void {
  if (parliamentRewardState.sitting === key) {
    return;
  }
  trail('sitting', {from: parliamentRewardState.sitting, to: key});
  flushParliamentRewards('new-sitting');
  flushAgendaBonus('new-sitting');
  parliamentRewardState.sitting = key;
  parliamentRewardState.landed = [];
  parliamentRewardState.tileReceipt = undefined;
  parliamentRewardState.receiptShowing = false;
  parliamentRewardState.awaitingStage = false;
}

/**
 * SEED — called from the transport in the SAME synchronous block as the
 * commit. The sitting must be on screen (its stage zone stands) for a wave
 * to be owed; otherwise the records are marked landed at once and the rail
 * ticks with the commit. Reduced motion never holds anything.
 */
export function seedParliamentRewardHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (after === undefined) {
    return;
  }
  const key = sittingKeyOf(after);
  if (key === '') {
    // No live phase: whatever the last sitting still owed is over.
    enterSitting('');
    enterWorldBeatSitting('');
    // …and a receipt of the table no stage will play (the sitting was never opened): its counters tick now.
    releaseOrphanTableReceipts();
    return;
  }
  enterSitting(key);
  // THE WORLD'S OWN MOVE rides the same block, and is the one record here that
  // belongs to NO seat: every viewer owes the board its story (`parliamentWorldBeat.ts`).
  enterWorldBeatSitting(key);
  seedWorldMoveBeat(before, after);
  const tile = detectNewViewerTile(before, after);
  if (tile !== undefined && !consoleReducedMotionActive()) {
    parliamentRewardState.tileReceipt = {sitting: key, outcome: tile};
  }
  const fresh = detectNewViewerRewards(before, after);
  // ON SCREEN — the stage stands, or the walk is still AHEAD of the seat (`sittingWalkAhead` — the soft gates: the whole
  // chain rides one response, which the seat may receive on the board; the scene or the plate opens the sitting next).
  const onScreen = sittingWalkAhead(after) && !consoleReducedMotionActive();
  if (onScreen && !consoleParliamentUi.stageStanding) {
    parliamentRewardState.awaitingStage = true;
  }
  if (fresh.length > 0 || tile !== undefined) {
    trail('seed', {key, fresh: fresh.map((r) => r.key), tile: tile?.kind, onScreen});
  }
  if (fresh.length > 0) {
    if (!onScreen) {
      fresh.forEach((r) => noteLanded(r.key));
    } else {
      beginPanelRewardHold(fresh.map((r) => r.spec));
      // THE RULING PARTY'S ANSWER TO THE PAYOUT IS DECLARED (iteration 6 of «СРАБАТЫВАНИЕ КАРТЫ» — a party is a
      // reactor): the reward wave flies it ITSELF, off the ruler's plaque, so the party's record of it attaches to
      // this wave — never the chain's second telling at the rail's edge over a raw hold (the seeder's
      // `standaloneOverRawHold` class: RX05's charter rose a second time after the plaque's own chip had landed,
      // and its tokens stood in the air until the wave budget's safety — a blocking hold at «rest»).
      declareHeldAnswers(fresh.filter((r) => r.outcome.kind === 'reaction').map((r) => r.spec));
      parliamentRewardState.owed.push(...fresh);
    }
  }
  // The Agenda bonus rides the same «on screen» honesty: a parked sitting has no track to fly it on — the
  // rating ticks with the commit and the glide plays without a chip when the sitting comes back.
  const bonus = detectAgendaBonus(before, after);
  if (bonus !== undefined && !consoleReducedMotionActive()) {
    trail('seed-agenda', {key, kind: bonus.kind, step: bonus.step, generation: bonus.generation, onScreen});
    flushAgendaBonus('re-seed', 'phase');
    if (onScreen) {
      queueAgendaBonuses([bonus]);
    }
  }
  // The receipts / the Career walks are the stage's own scenes — owed only to a stage that stands, or that this very
  // response brings up (risen by the scene, or on its way up — `sittingRise.ts`, the soft gates: in a game with a bot
  // the pass is a staged response and no scene rises, the plate opens the sitting); a walk merely ahead lets them tick.
  const staged = (consoleParliamentUi.stageStanding || generationSceneRisesIntoSitting(after) || sittingRiseOwed()) && !consoleReducedMotionActive();
  // THE STEPS OF THE CAREER A LAW GRANTED THE SEATS (Reds Budget): every walked seat's marker held on its old step —
  // the reward stage's КАРЬЕРА beat walks them in turn — and the viewer's own paying steps owed BEHIND the winner's
  // (queued after it: the enactment's beat takes the queue's head). Read off the phase's records, never `lastAdvance`.
  const career = seedCareerGrantWalks(key, before, after, staged);
  if (career.length > 0) {
    trail('seed-career', {key, steps: career.map((bonus) => `${bonus.kind}:${bonus.step}`)});
    queueAgendaBonuses(career);
  }
  // A CARD PAYOUT THAT ASKED NOBODY (Sponsored Projects): the receipt of the table — the seat's receiving cards in the
  // zone, their capsules and points held until each token lands. Read off the phase's records, never a prompt.
  seedTableReceipts(key, before, after, staged);
}

/** The director takes what is owed — the records are in the air from here (their holds still stand). */
export function takeOwedRewards(): Array<OwedReward> {
  const taken = parliamentRewardState.owed.splice(0);
  parliamentRewardState.flying.push(...taken);
  if (taken.length > 0) {
    trail('take', taken.map((r) => r.key));
  }
  return taken;
}

/**
 * The director takes ONE step's bonus for its flight (the hold still stands
 * until `markAgendaBonusLanded`): the entry of `step` when a step is named
 * (a walk delivers each step's own), else the first owed — the one-step
 * callers' reading. `generation` guards against a stale entry; `undefined`
 * accepts any (a walk played off the tier's own watcher knows the step, not
 * the sitting's key).
 */
export function takeAgendaBonus(generation: number | undefined, step?: number): AgendaBonusOwed | undefined {
  // Without a step the ENACTMENT's one-step callers ask — a law's step of the Career is never theirs.
  const bonus = step === undefined ?
    parliamentRewardState.agendaBonuses.find((entry) => entry.career !== true) :
    parliamentRewardState.agendaBonuses.find((entry) => entry.step === step);
  trail('take-agenda', {asked: generation, step, held: bonus?.generation, heldStep: bonus?.step});
  if (bonus === undefined || (generation !== undefined && bonus.generation !== generation)) {
    return undefined;
  }
  return bonus;
}

/** ONE chip touched its row: the counter ticks now, the record reads «Получено». */
export function markRewardLanded(reward: OwedReward): void {
  trail('landed', reward.key);
  releasePanelRewardHold(reward.spec);
  parliamentRewardState.flying = parliamentRewardState.flying.filter((r) => r.key !== reward.key);
  noteLanded(reward.key);
}

/** ONE step's chip touched the rail (or its cover may lift): that step's hold releases — the others keep standing. */
export function markAgendaBonusLanded(step?: number): void {
  const index = step === undefined ?
    parliamentRewardState.agendaBonuses.findIndex((entry) => entry.career !== true) :
    parliamentRewardState.agendaBonuses.findIndex((entry) => entry.step === step);
  if (index === -1 || parliamentRewardState.agendaBonuses.length === 0) {
    return;
  }
  const [bonus] = parliamentRewardState.agendaBonuses.splice(index, 1);
  trail('flush-agenda', {why: 'landed', kind: bonus.kind, step: bonus.step, generation: bonus.generation});
  if (bonus.spec !== undefined) {
    releasePanelRewardHold(bonus.spec);
  }
  // The table's answer ticks one beat AFTER its reason (never with it, never before).
  if (bonus.reactions !== undefined && bonus.reactions.length > 0) {
    answerAgendaStep(bonus.step, bonus.reactions);
  }
}

/** A wave is owed or in the air — the field pose and the next door wait for it. */
export function parliamentRewardPending(): boolean {
  return parliamentRewardState.owed.length > 0 || parliamentRewardState.flying.length > 0;
}

/**
 * The CARD step's cover has LIFTED off its node: the park lets the batch go
 * (the scene that lifted it owns it from here), the ledger's hold stands
 * down, and the entry stays OWED until the card has landed in the dock. A
 * step with no card entry (flushed, landed, never owed) is a no-op.
 */
export function markAgendaCardLifted(step: number): void {
  const bonus = parliamentRewardState.agendaBonuses.find((entry) => entry.step === step && entry.kind === 'card');
  if (bonus === undefined || bonus.lifted === true) {
    return;
  }
  bonus.lifted = true;
  trail('lift-agenda', {step: bonus.step, generation: bonus.generation});
}

/** The CARD step's entry is still owed — its card has not LANDED in the dock yet (lifted or not). */
export function agendaCardOwed(step: number): boolean {
  return parliamentRewardState.agendaBonuses.some((entry) => entry.step === step && entry.kind === 'card');
}

/**
 * THE AGENDA CARD PARK: while the viewer's CARD-step bonus is owed and its
 * cover has NOT lifted yet, the `agenda`-sourced reveal batch the server dealt
 * with the summary presents NOWHERE — its one honest presentation is the
 * cover lifting off the step the marker reached, on a track the player can
 * SEE, once the marker has LOCKED on that step (a walk's own signal —
 * `deliverAgendaStepReward` arms the cover scene at the lock; the sitting's
 * and the quest's one-step `launchAgendaBonus` → `markAgendaBonusLanded`
 * release it at the landing). Same law and shape as the board-beat park:
 * scoped to the batch it parks, never «the reveal»; bounded by the idle net
 * (then the standard draw presents it).
 */
export function parliamentParksReveal(source: {type?: string, step?: number} | undefined): boolean {
  if (source?.type !== 'agenda') {
    return false;
  }
  // …SCOPED TO THE BATCH'S OWN STEP: a walk may cross two card steps (TR42 at TR 45 — steps 7 and 10), and a park read
  // over «any card step not lifted» kept step 7's batch parked by step 10's entry while step 7's cover was lifting —
  // the scene found no slot to land in, degraded, and the walk waited for a «Взять» that never came (field
  // 2026-10-25: the Career frozen with the Parliament up). A batch from before the step was named keeps the blanket park.
  const step = source.step;
  return parliamentRewardState.agendaBonuses.some((bonus) => bonus.kind === 'card' && bonus.lifted !== true && (step === undefined || bonus.step === step));
}

/** This record's chip has landed (or the record never had a wave to wait for). */
export function rewardLanded(outcome: ParliamentEnactOutcomeModel): boolean {
  const key = rewardBeatKey(outcome);
  if (parliamentRewardState.landed.includes(key)) {
    return true;
  }
  return !parliamentRewardState.owed.some((r) => r.key === key) && !parliamentRewardState.flying.some((r) => r.key === key);
}

/** Full reset (game switch, test cleanup). */
export function resetParliamentRewards(): void {
  flushParliamentRewards('reset');
  flushAgendaBonus('reset');
  // …and a flight a test left in the air: its landing is let go (nothing waits on a reset).
  [...answerLandings.values()].forEach((entry) => entry.settle());
  answersFlying.clear();
  resetCareerGrantBeat();
  resetTableReceiptBeat();
  parliamentRewardState.sitting = '';
  parliamentRewardState.landed = [];
  parliamentRewardState.tileReceipt = undefined;
  parliamentRewardState.receiptShowing = false;
}
