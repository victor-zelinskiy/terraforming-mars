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
 *    zone stands). A parked / absent Parliament gets no hold and no owed beat:
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
 * The AGENDA STEP'S TR BONUS of the viewer rides the same ledger: it is paid
 * by the server in the chain after the first gate (v2), in the SAME response
 * that carries the enactment — the rating is held on the rail's own score
 * cell (`stock` channel, key `rating`) and flies from the reached Agenda step
 * once the marker's glide has landed (the enactment's first beat).
 *
 * Pure + a reactive record; no DOM, no Vue components, no i18n.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {RewardDelivery, rewardAddressOf} from '@/common/parliament/rewardAddress';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {beginPanelRewardHold, releasePanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleParliamentUi} from './consoleParliamentFlow';
import {enterWorldBeatSitting, seedWorldMoveBeat} from './parliamentWorldBeat';

/** The rail's key for the terraform rating (the score cell) — the ONE key the transfer layer, the panel and the seeder share. */
export const RATING_RAIL_KEY = 'rating';

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
  /** The viewer's Agenda TR bonus, held on the rail until the marker's glide has landed. */
  agendaBonus: undefined as AgendaBonusOwed | undefined,
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
});

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
registerAnimationHoldSupplier('parliament-reward-owed', () => parliamentRewardPending(), {
  diagnose: () => ({
    sitting: parliamentRewardState.sitting,
    owed: parliamentRewardState.owed.map((r) => r.key),
    flying: parliamentRewardState.flying.map((r) => r.key),
  }),
  expire: () => flushParliamentRewards('ceiling'),
});

/** The Agenda bonus rides the same law: held until the marker's glide lands, bounded by the registry's ceiling alone. */
registerAnimationHoldSupplier('parliament-agenda-bonus-owed', () => parliamentRewardState.agendaBonus !== undefined, {
  diagnose: () => {
    const bonus = parliamentRewardState.agendaBonus;
    return {sitting: parliamentRewardState.sitting, bonus: bonus === undefined ? undefined : {kind: bonus.kind, step: bonus.step, generation: bonus.generation}};
  },
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
  const was = phaseOf(before);
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
 * DETECT (pure): the viewer's WINNER TILE this response recorded (an `ocean` /
 * `greenery` record of theirs that was not there before) — the board scene
 * placed it; the sitting owes its receipt on the way back.
 */
export function detectNewViewerTile(before: PlayerViewModel | undefined, after: PlayerViewModel): ParliamentEnactOutcomeModel | undefined {
  const viewer = after.thisPlayer?.color;
  const phase = phaseOf(after);
  const was = phaseOf(before);
  if (viewer === undefined || phase === undefined || was === undefined || was.generation !== phase.generation) {
    return undefined;
  }
  const known = new Set((was.outcomes ?? []).map(rewardBeatKey));
  return (phase.outcomes ?? []).find((o) => o.player === viewer && (o.kind === 'ocean' || o.kind === 'greenery') && !known.has(rewardBeatKey(o)));
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
 * step); new when the previous view had no phase of this generation or no
 * agenda move yet.
 */
export function detectAgendaBonus(before: PlayerViewModel | undefined, after: PlayerViewModel): AgendaBonusOwed | undefined {
  const viewer = after.thisPlayer?.color;
  const phase = phaseOf(after);
  const agenda = phase?.summary?.agenda;
  if (viewer === undefined || phase === undefined || agenda === undefined || agenda.player !== viewer || (agenda.bonus !== 'tr' && agenda.bonus !== 'card')) {
    return undefined;
  }
  const was = phaseOf(before);
  if (before === undefined || (was !== undefined && was.generation === phase.generation && was.summary?.agenda !== undefined)) {
    return undefined;
  }
  return agenda.bonus === 'tr' ?
    {generation: phase.generation, player: viewer, step: agenda.to, kind: 'tr', spec: {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}} :
    {generation: phase.generation, player: viewer, step: agenda.to, kind: 'card'};
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
export function parliamentRewardDiag(): {sitting: string; owed: Array<string>; flying: Array<string>; landed: Array<string>; agendaBonus?: {step: number; generation: number; kind: 'tr' | 'card'}; trail: Array<RewardTrailEvent>} {
  const bonus = parliamentRewardState.agendaBonus;
  return {
    sitting: parliamentRewardState.sitting,
    owed: parliamentRewardState.owed.map((r) => r.key),
    flying: parliamentRewardState.flying.map((r) => r.key),
    landed: [...parliamentRewardState.landed],
    ...(bonus === undefined ? {} : {agendaBonus: {step: bonus.step, generation: bonus.generation, kind: bonus.kind}}),
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

/** Release the Agenda bonus's hold (a stage's end, the ceiling, a glide that never came). `why` is for the trail. */
export function flushAgendaBonus(why: RewardReleaseReason | string = 'flush'): void {
  const bonus = parliamentRewardState.agendaBonus;
  parliamentRewardState.agendaBonus = undefined;
  if (bonus !== undefined) {
    trail('flush-agenda', {why, kind: bonus.kind, step: bonus.step, generation: bonus.generation});
    if (bonus.spec !== undefined) {
      releasePanelRewardHold(bonus.spec);
    }
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
  const onScreen = consoleParliamentUi.stageStanding && !consoleReducedMotionActive();
  if (fresh.length > 0 || tile !== undefined) {
    trail('seed', {key, fresh: fresh.map((r) => r.key), tile: tile?.kind, onScreen});
  }
  if (fresh.length > 0) {
    if (!onScreen) {
      fresh.forEach((r) => noteLanded(r.key));
    } else {
      beginPanelRewardHold(fresh.map((r) => r.spec));
      parliamentRewardState.owed.push(...fresh);
    }
  }
  // The Agenda bonus rides the same «on screen» honesty: a parked sitting has no track to fly it on — the
  // rating ticks with the commit and the glide plays without a chip when the sitting comes back.
  const bonus = detectAgendaBonus(before, after);
  if (bonus !== undefined && !consoleReducedMotionActive()) {
    trail('seed-agenda', {key, kind: bonus.kind, step: bonus.step, generation: bonus.generation, onScreen});
    flushAgendaBonus('re-seed');
    if (onScreen) {
      if (bonus.spec !== undefined) {
        beginPanelRewardHold([bonus.spec]);
      }
      parliamentRewardState.agendaBonus = bonus;
    }
  }
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

/** The director takes the Agenda bonus for its flight (the hold still stands until `markAgendaBonusLanded`). */
export function takeAgendaBonus(generation: number): AgendaBonusOwed | undefined {
  const bonus = parliamentRewardState.agendaBonus;
  trail('take-agenda', {asked: generation, held: bonus?.generation, step: bonus?.step});
  if (bonus === undefined || bonus.generation !== generation) {
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

export function markAgendaBonusLanded(): void {
  flushAgendaBonus('landed');
}

/** A wave is owed or in the air — the field pose and the next door wait for it. */
export function parliamentRewardPending(): boolean {
  return parliamentRewardState.owed.length > 0 || parliamentRewardState.flying.length > 0;
}

/**
 * THE AGENDA CARD PARK: while the viewer's CARD-step bonus is owed, the
 * `agenda`-sourced reveal batch the server dealt with the summary presents
 * NOWHERE — its one honest presentation is the cover lifting off the step the
 * marker reached, on a track the player can SEE, after the enactment's glide
 * (`launchAgendaBonus` → `markAgendaBonusLanded` releases it). Same law and
 * shape as the board-beat park: scoped to the batch it parks, never «the
 * reveal»; bounded by the idle net (then the standard draw presents it).
 */
export function parliamentParksReveal(source: {type?: string} | undefined): boolean {
  return source?.type === 'agenda' && parliamentRewardState.agendaBonus?.kind === 'card';
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
  parliamentRewardState.sitting = '';
  parliamentRewardState.landed = [];
  parliamentRewardState.tileReceipt = undefined;
  parliamentRewardState.receiptShowing = false;
}
