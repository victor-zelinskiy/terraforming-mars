/*
 * «ШАГ ШКАЛЫ ПЛАТИТ РЕЙТИНГ» — the TERRAFORM RATING a global-parameter step
 * the viewer made pays, told on the board the step moved (Turmoil Redux TR41
 * Plasma Fans — the first card ACTION of the fork whose reward is a scale
 * step through a workspace; the same beat serves a card PLAY's scale step and
 * a standard project's).
 *
 * THE GAP IT CLOSES. A scale step's rating is the SCALE's own (`Game.
 * increaseVenusScaleLevel` → `increaseTerraformRating(steps, {global: true})`),
 * never a chip of the card's branch — so neither rail half (`directTrSpecs`
 * refuses a TR beside a scale gain: «the TR is the scale's») held it, and the
 * rating cell TICKED IN THE FRAME THE VIEW APPLIED: under the open workspace,
 * with nothing on screen to explain it (measured on TR41: the cell read 21 at
 * 165 ms, the workspace still standing, the marker still on 6 %). The ruling
 * Greens' «2 M€ per TR step» then rode the action rail's reactions and ticked
 * on the touchdown of the PRICE — the answer to a cause that had not been
 * shown (PL-002).
 *
 * THE BEATS, in the park's causal order (`boardBeatPark.ts`): the workspace
 * leaves → settle → the held value releases and the marker GLIDES → (this
 * member) the marker's settle breath, then ONE RATING TOKEN PER STEP is born
 * on the marker's rim and flies to the rail's rating cell — the cell ticks on
 * each touchdown; a Venus 16 % track bonus is its own token, born on the 16 %
 * chip it came from → the table's answer (the Greens' M€) ticks one beat
 * after the last touchdown, never before → the step's other payees (TR24's
 * tokens — `scaleStepRewardBeat.ts` waits for this member) → the cover.
 *
 * HOLDS — the census scene's own shape (`scaleStepRewardBeat.ts`), deliberately
 * NOT a `railReward` entry: that module's registry raises a BLOCKING hold for
 * as long as an entry stands, and this beat stands for as long as the board
 * is COVERED — a workspace whose conclusion waits on blocking holds (the
 * colony trade's) would wait for a beat that waits for the workspace. So the
 * PROMISE is checked by the rail module's pure half (`verifyRailReward` — the
 * viewer's rating rose by exactly the steps the scales made (+ the 16 %
 * bonus), in the action phase, the same seat; the answer is the M€ delta only
 * when it is exactly 2 M€ per rating; a row that moved otherwise is not held
 * and names itself — PL-1810: a rise ONE short is the steps less a step a card ATE, accepted only when P57's server
 * mark flipped `armed → spent` in the same response (the eaten first step flies nothing; any other shortfall plays
 * nothing and names itself in the trail `scale-step:refused`)), the counters are held on the PANEL (`beginPanelRewardHold`
 * — the rail paints `committed − held`), the named hold `scale-step-rating`
 * is NOTIFICATION-ONLY, and the stage is a ledger debt that degrades (the
 * player never came back to the board → the cell ticks, nothing flies). A
 * rating another owner already holds (the tile placement's, a direct TR's) is
 * never held twice (`heldStock`). Reduced motion holds nothing.
 *
 * ONE TELLER PER HOST (P66 · GJ): this beat is the ACTION phase's alone — on the START the board is covered for the
 * whole deployment (a field beat there parked 30 s, the 22:15 export), so a prelude's scale steps are told by the HERO
 * (`playRailReward(…, {startHost: true})` → one token per step off the k-th printed scale icon). Never both — and that is
 * not left to the phase gate alone: both tellers CLAIM the unit for the response (`resourceTransfer/oneTeller.ts`), the
 * second yields and the sentinel `[transfer] told twice` turns every e2e spec red.
 */
import {reactive, watch, WatchStopHandle} from 'vue';
import {motionSpan} from '@/client/console/session/sessionWaits';
import {Phase} from '@/common/Phase';
import {getGlobalParameterTracks} from '@/common/boards/GlobalParameterTracks';
import {BoardName} from '@/common/boards/BoardName';
import {venusStepsBetween} from '@/common/venus/venusScale';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {ScaleMarkerAccent, scaleMarkerArrived, scaleMarkerPoses} from '@/client/components/board/scaleMarkerArrival';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {HeldGlobalParams} from '@/client/console/planetFocus';
import {
  boardBeatBoardWatchable, boardBeatHoldsParam, boardBeatParkState, registerBoardBeatStoryMember,
} from '@/client/console/boardBeatPark';
import {verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {
  beginPanelRewardHold, heldStock, noteTransferTrail, releasePanelRewardHold, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  RATING_RAIL_KEY, ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS, TransferPoint, railRowKey,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {SCALE_STEP_BREATH_MS, SCALE_STEP_STAGE_DUE_MS, scaleStepTokenOrigins} from '@/client/console/scaleStepReward/scaleStepRewardModel';
import {freshCardReactions} from '@/client/console/cardReaction/cardReactionModel';
import {SCALE_STEP_RATING_UNIT, claimTeller} from '@/client/console/resourceTransfer/oneTeller';
import {transferEndVerdict} from '@/client/console/resourceTransfer/transferEndVisible';
import {beginCeilingWait} from '@/client/console/waitGraph/ceilingWait';
import {sessionState} from '@/client/console/session/consoleSession';

/** The beat's own name — its notification-only hold, its ledger story, its park membership. */
export const SCALE_STEP_RATING_KEY = 'scale-step-rating';
/**
 * The Venus level whose crossing pays the track's one-time TR — the MAP's (`getGlobalParameterTracks`: 16 %; 22 % on
 * Amazonis Planitia). Its chip as the BOARD marks it (`Board.bonusZoneProps` → `claimKey` `<scale>-<step>` →
 * `data-arc-marker`, `venus-<level>`) carries the token's birth. It read the zone DEFINITION's key `v-tr-16` until
 * P89 · EE (PL-1436), which no element carries: the lookup always missed and the token silently fell back to the rim.
 */
function venusTrBonusLevel(game: GameModel): number | undefined {
  return getGlobalParameterTracks(game.gameOptions?.boardName ?? BoardName.THARSIS).venus.find((t) => t.bonus === 'tr')?.value;
}
/**
 * The temperature track's printed PRODUCTION bonuses — the heat steps (−24 / −20 °C) on every map and Amazonis
 * Planitia's plant step (−12 °C) — PL-1841 ②: the step that crosses one pays +1 production, and that token is the
 * SCALE's (born on the bonus chip the board prints there, `temperature-<step>` → `data-arc-marker`, once the marker has
 * arrived), never a «Сработает» chip of the sheet.
 */
function temperatureProductionSteps(game: GameModel, resource: 'heat' | 'plants'): ReadonlyArray<number> {
  const bonus = resource === 'heat' ? 'heatproduction' : 'plant';
  return getGlobalParameterTracks(game.gameOptions?.boardName ?? BoardName.THARSIS).temperature.filter((t) => t.bonus === bonus).map((t) => t.value);
}
/** The ruling Greens' answer per rating step (`PartyEffects.GREENS_MEGACREDITS_PER_TR`) — the only answer this beat recognizes. */
const GREENS_MEGACREDITS_PER_TR = 2;

/** The scales this beat tells: a rail-less ocean is the tile's own beat. */
export type ScaleStepRatingAccent = Exclude<ScaleMarkerAccent, 'oceans'>;

/** One scale the response moved, with the steps it made and where it rests now. */
export type ScaleStepMove = {
  accent: ScaleStepRatingAccent;
  key: keyof HeldGlobalParams;
  steps: number;
  after: number;
};

/** What the response PAID the viewer for the steps it made — the beat's promise, read off the diff (pure). */
export type ScaleStepRatingPlan = {
  moves: ReadonlyArray<ScaleStepMove>;
  /** The rating steps paid: the scales' steps, plus the Venus 16 % track bonus when it was crossed. */
  rating: number;
  /** The Venus track's TR bonus (16 %; 22 % on Amazonis Planitia) paid one of them. */
  venusBonus: boolean;
  /** …at this level — the chip its token is born on (`venus-<level>`). */
  venusBonusLevel?: number;
  /**
   * The steps a CARD ATE (PL-1810 — P57 Preservation Program: «skip the first TR you gain in each action phase»): the
   * server's own mark flipped `armed → spent` in this very response, so the rise is the steps less that one. Those
   * steps fly nothing (the card's own reaction rises and marks its struck icon); the tokens are the steps that PAID.
   * Absent when nothing was eaten.
   */
  skipped?: number;
  /** The ruling Greens' answer (2 M€ per rating step) — only when the M€ moved by exactly that. */
  reaction?: number;
  /**
   * The temperature track's heat-production bonuses the steps crossed (PL-1841 ② — −24 / −20 °C), each a token born on
   * its printed chip; only when the viewer's heat production rose by exactly that many (else nothing — the row ticks).
   */
  heatBonus?: ReadonlyArray<number>;
  /** Amazonis Planitia's −12 °C plant-production bonus, the same way (its own row, its own chip). */
  plantBonus?: ReadonlyArray<number>;
};

const SCALES: ReadonlyArray<{accent: ScaleStepRatingAccent, key: keyof HeldGlobalParams, field: keyof GameModel, unit: number}> = [
  {accent: 'temperature', key: 'temperature', field: 'temperature', unit: 2},
  {accent: 'oxygen', key: 'oxygenLevel', field: 'oxygenLevel', unit: 1},
  {accent: 'venus', key: 'venusScaleLevel', field: 'venusScaleLevel', unit: 2},
];

/** The steps a scale made — Venus walks 1 % steps above 30 % (Amazonis Planitia), the engine's own arithmetic. */
function scaleSteps(scale: {accent: ScaleStepRatingAccent, unit: number}, from: number, to: number): number {
  return scale.accent === 'venus' ? venusStepsBetween(from, to) : (to - from) / scale.unit;
}

/**
 * THE PROMISE OFF THE DIFF (pure): the viewer's own rating rose, in the action
 * phase, by exactly the steps the temperature / oxygen / Venus scales made in
 * the same response (+ the Venus 16 % bonus) — else nothing (an ocean's TR is
 * the tile's; a direct TR beside a scale step is nobody's to fly; a rival's
 * step never moves the viewer's rating; the World Government pays no rating).
 */
/** The viewer's M€ the fresh card-reaction records moved in this response (CN) — what the step's own answer stands beside. */
function cardReactionMegacredits(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): number {
  const viewer = after?.thisPlayer?.color;
  let sum = 0;
  for (const record of freshCardReactions(before?.game.cardReactions, after?.game.cardReactions, before?.thisPlayer?.color === viewer)) {
    for (const impact of record.impacts) {
      if (impact.kind === 'stock' && impact.resource === 'megacredits' && impact.to === viewer) {
        sum += impact.amount;
      }
    }
  }
  return sum;
}

export function scaleStepRatingPlan(
  before: PlayerViewModel | undefined, after: PlayerViewModel | undefined, heldByOthers = 0,
): ScaleStepRatingPlan | undefined {
  if (before === undefined || after === undefined || before.id !== after.id || after.game.phase !== Phase.ACTION) {
    return undefined;
  }
  const was = before.thisPlayer;
  const now = after.thisPlayer;
  if (was === undefined || now === undefined) {
    return undefined;
  }
  // The part of the rise ANOTHER owner of this same response already holds for a cause of its own (the ocean's TR —
  // its tile beat flies it) is not the scales': a play that raises two scales AND places an ocean reads +3 for two
  // steps, and the scales' two tokens were lost to that one extra point (PL-330, TR47).
  const rating = now.terraformRating - was.terraformRating - heldByOthers;
  if (rating <= 0) {
    return undefined;
  }
  const moves: Array<ScaleStepMove> = [];
  for (const scale of SCALES) {
    const a = before.game[scale.field];
    const b = after.game[scale.field];
    if (typeof a !== 'number' || typeof b !== 'number' || b <= a) {
      continue;
    }
    moves.push({accent: scale.accent, key: scale.key, steps: scaleSteps(scale, a, b), after: b});
  }
  const steps = moves.reduce((sum, move) => sum + move.steps, 0);
  if (steps <= 0 || moves.some((move) => !Number.isInteger(move.steps))) {
    return undefined;
  }
  const venusBefore = before.game.venusScaleLevel;
  const venusAfter = after.game.venusScaleLevel;
  const trLevel = venusTrBonusLevel(after.game);
  const venusBonus = trLevel !== undefined && typeof venusBefore === 'number' && typeof venusAfter === 'number' &&
    venusBefore < trLevel && venusAfter >= trLevel;
  // A rise SHORT of the steps is honest only when the server says why in the same response: P57's mark flipped
  // `armed → spent` (it ate the first rating step). Any other shortfall is not the scales' story — refused (PL-1810).
  const paid = steps + (venusBonus ? 1 : 0);
  const skipped = rating === paid ? 0 : 1;
  if (skipped > 0 && !(ratingStepEaten(was, now) && rating === paid - 1)) {
    return undefined;
  }
  // A CARD's answer on the same row (the server's card-reaction record — Homeostasis Bureau's 3 M€ per step, CN) is
  // subtracted before the match: the party's answer stands beside it, never refused for it.
  const megacredits = now.megacredits - was.megacredits - cardReactionMegacredits(before, after);
  const tBefore = before.game.temperature;
  const tAfter = after.game.temperature;
  const crossedOf = (resource: 'heat' | 'plants'): ReadonlyArray<number> => typeof tBefore === 'number' && typeof tAfter === 'number' ?
    temperatureProductionSteps(after.game, resource).filter((step) => tBefore < step && tAfter >= step) : [];
  const crossed = crossedOf('heat');
  const heatBonus = crossed.length > 0 && now.heatProduction - was.heatProduction === crossed.length ? crossed : [];
  const crossedPlant = crossedOf('plants');
  const plantBonus = crossedPlant.length > 0 && now.plantProduction - was.plantProduction === crossedPlant.length ? crossedPlant : [];
  return {
    moves,
    rating,
    venusBonus,
    ...(venusBonus && trLevel !== undefined ? {venusBonusLevel: trLevel} : {}),
    ...(heatBonus.length > 0 ? {heatBonus} : {}),
    ...(plantBonus.length > 0 ? {plantBonus} : {}),
    ...(skipped > 0 ? {skipped} : {}),
    // The answer is recognized only on a rise that is the scales' alone — beside another owner's rating the M€ row
    // carries that owner's answer too, and a guessed split is never flown.
    ...(heldByOthers === 0 && megacredits === GREENS_MEGACREDITS_PER_TR * rating ? {reaction: megacredits} : {}),
  };
}

/** P57's server mark flipped `armed → spent` between the two views: one rating step of this response was EATEN. */
function ratingStepEaten(was: {ratingSkip?: 'armed' | 'spent'}, now: {ratingSkip?: 'armed' | 'spent'}): boolean {
  return was.ratingSkip === 'armed' && now.ratingSkip === 'spent';
}

/**
 * WHY a diff with a scale step and a rating rise plays no beat (PL-1810 — a refusal NAMES itself): the rise matches
 * neither the steps nor the steps less an eaten one. Undefined when there is nothing to name (no scale moved, no rise,
 * another seat, another phase, or the plan played).
 */
export function scaleStepRatingRefusal(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined, heldByOthers = 0): string | undefined {
  if (before === undefined || after === undefined || before.id !== after.id || after.game.phase !== Phase.ACTION ||
      scaleStepRatingPlan(before, after, heldByOthers) !== undefined) {
    return undefined;
  }
  const rise = (after.thisPlayer?.terraformRating ?? 0) - (before.thisPlayer?.terraformRating ?? 0) - heldByOthers;
  const steps = SCALES.reduce((sum, scale) => {
    const a = before.game[scale.field];
    const b = after.game[scale.field];
    return typeof a === 'number' && typeof b === 'number' && b > a ? sum + scaleSteps(scale, a, b) : sum;
  }, 0);
  return rise > 0 && steps > 0 ? `rating +${rise} for ${steps} scale step(s) — not the scales' rating (no eaten step to explain it)` : undefined;
}

/** Where each token is BORN: on the marker of the scale that paid it — a track bonus on its own chip (`chip`). */
type TokenOrigin = {accent: ScaleStepRatingAccent, bonus: boolean, chip?: string};

export type ScaleStepRatingPhase = 'idle' | 'waiting' | 'flying';

export const scaleStepRatingState = reactive({
  phase: 'idle' as ScaleStepRatingPhase,
  /** The tokens of the beat in flight / still owed (0 when idle). */
  tokens: 0,
  /** Past its due — the player never came back to the board: the cell ticked, nothing flew. */
  due: false,
  /** The last beat degraded: no marker to be born on, or a promise the views did not keep. */
  degraded: false,
  /** Bumped by a redrive (the stage watcher re-asks). */
  nudge: 0,
});

type Entry = {
  plan: ScaleStepRatingPlan;
  origins: Array<TokenOrigin>;
  /** The rating tokens still held on the panel (one spec per token, released on its touchdown). */
  cause: Array<ResourceTransferSpec>;
  /** The table's answer still held (released one beat after the last touchdown). */
  reactions: Array<ResourceTransferSpec>;
};

let entry: Entry | undefined;
let epoch = 0;
let running = false;
/** The epoch of the run that owns `running` — a run the ceiling let go never clears a newer run's flag. */
let runOwner = 0;
/** The entry whose tokens are in flight (already taken off `entry`; its unflown tokens still held). */
let paying: Entry | undefined;
let debt: OwedStoryHandle | undefined;
let quietResolve: (() => void) | undefined;
let quietPromise: Promise<void> = Promise.resolve();

function openQuiet(): void {
  if (quietResolve === undefined) {
    quietPromise = new Promise<void>((resolve) => {
      quietResolve = resolve;
    });
  }
}

function resolveQuiet(): void {
  const r = quietResolve;
  quietResolve = undefined;
  r?.();
}

/** The beat is OWED or PLAYING — the step's other payees and the park's cover wait for it. */
export function scaleStepRatingBusy(): boolean {
  void scaleStepRatingState.phase;
  return scaleStepRatingState.phase !== 'idle';
}

/** Resolves once the beat is quiet (at once when idle). */
export function scaleStepRatingQuiet(): Promise<void> {
  return scaleStepRatingState.phase === 'idle' ? Promise.resolve() : quietPromise;
}

// A MEMBER of the park's drain: the cover lifts only once the rating has landed.
registerBoardBeatStoryMember(SCALE_STEP_RATING_KEY, {busy: scaleStepRatingBusy, quiet: scaleStepRatingQuiet});

// NOTIFICATION-ONLY (a reaction never delays a decision the player owes, and a blocking hold here would wait on the
// very workspace that waits on it): the feed waits for the rating's story, nothing else does.
registerAnimationHoldSupplier(SCALE_STEP_RATING_KEY, scaleStepRatingBusy, {
  scope: 'notification-only',
  diagnose: () => ({phase: scaleStepRatingState.phase, tokens: scaleStepRatingState.tokens, due: scaleStepRatingState.due,
    owed: entry !== undefined, paying: paying !== undefined}),
  // THE CEILING ENDS THE WEDGE, NOT JUST THE COUNT: a flight that never reported its touchdowns ends by the abort of
  // the beat (`resetScaleStepRating`) — every held rating / answer released (the rows read the applied view), the quiet
  // resolved so the drain of the park goes on; the wedged run lets go of `running` so the next beat can play.
  expire: () => {
    if (scaleStepRatingState.phase === 'idle') {
      return;
    }
    console.warn(`[scaleStepRatingBeat] scale-step rating beat (${scaleStepRatingState.phase}): outlived its ceiling — ended`);
    const flying = paying;
    paying = undefined;
    resetScaleStepRating();
    if (flying !== undefined) {
      releaseHeld(flying);
    }
    scaleStepRatingState.degraded = true;
    running = false;
  },
});

/** The tokens' birth order: the steps of each scale, in the scales' order, then the Venus 16 % bonus. */
function originsOf(plan: ScaleStepRatingPlan): Array<TokenOrigin> {
  const out: Array<TokenOrigin> = [];
  for (const move of plan.moves) {
    for (let i = 0; i < move.steps; i++) {
      out.push({accent: move.accent, bonus: false});
    }
  }
  if (plan.venusBonus) {
    out.push({accent: 'venus', bonus: true, chip: `venus-${plan.venusBonusLevel ?? 16}`});
  }
  // The EATEN step is the FIRST rating step of the event (P57 skips the first TR gained) — it flies nothing.
  return out.slice(plan.skipped ?? 0);
}

/** The heat-production bonus tokens of the plan, one per crossed chip — after the rating (the chip lights as the marker passes). */
function heatBonusOriginsOf(plan: ScaleStepRatingPlan): Array<TokenOrigin> {
  return (plan.heatBonus ?? []).map((step) => ({accent: 'temperature', bonus: true, chip: `temperature-${step}`}));
}

/** The plant-production bonus tokens (Amazonis Planitia's −12 °C), the same way. */
function plantBonusOriginsOf(plan: ScaleStepRatingPlan): Array<TokenOrigin> {
  return (plan.plantBonus ?? []).map((step) => ({accent: 'temperature', bonus: true, chip: `temperature-${step}`}));
}

/** Release whatever the panel still holds for the entry — idempotent. */
function releaseHeld(e: Entry): void {
  for (const spec of e.cause.splice(0)) {
    releasePanelRewardHold(spec);
  }
  for (const spec of e.reactions.splice(0)) {
    releasePanelRewardHold(spec);
  }
}

/**
 * SEED — the transport's apply block (the SAME synchronous block as the view
 * apply), AFTER every owner that may hold the rating for a cause of its own:
 * a rating already held is never held twice.
 */
export function seedScaleStepRatingHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined, heldThisResponse = 0): void {
  // An OLDER hold of the rating stands (a beat of an earlier response still owed): never held twice. What THIS
  // response's other owners hold (`heldThisResponse` — the transport measures it across its own seed block) is
  // subtracted from the rise instead, so the scales' own steps still fly beside an ocean's TR (PL-330).
  if (heldStock(RATING_RAIL_KEY) > heldThisResponse) {
    return;
  }
  const plan = scaleStepRatingPlan(before, after, heldThisResponse);
  if (plan === undefined) {
    const why = scaleStepRatingRefusal(before, after, heldThisResponse);
    if (why !== undefined) {
      noteTransferTrail('scale-step:refused', {why});
    }
    return;
  }
  if (typeof document === 'undefined' || consoleReducedMotionActive()) {
    return;
  }
  // ONE UNIT, ONE TELLER (P66 · GJ): a host of this response already tells the scale's rating (the start's hero, off the
  // printed scale icons) — the field yields, by name; never a second story of the same steps.
  if (!claimTeller(after, SCALE_STEP_RATING_UNIT, SCALE_STEP_RATING_KEY)) {
    return;
  }
  const origins = originsOf(plan);
  const cause: Array<ResourceTransferSpec> = origins.map(() => ({channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}));
  const reactions: Array<ResourceTransferSpec> = plan.reaction === undefined ? [] :
    [{channel: 'stock', resource: 'megacredits', amount: plan.reaction}];
  // A CARD's answer to the step on the same row (Homeostasis Bureau's 3 M€ per temperature step — the server's
  // card-reaction record, CN) is a KNOWN move of the M€ row: the Greens' answer is verified beside it, never refused
  // for a payment this beat was not told about; the card's own share is the reaction chain's (flown off its face).
  const known: Record<string, number> = {};
  if (heldThisResponse > 0) {
    known[railRowKey(cause[0])] = heldThisResponse;
  }
  const cardShares = cardReactionMegacredits(before, after);
  if (cardShares !== 0) {
    known['stock:megacredits'] = (known['stock:megacredits'] ?? 0) + cardShares;
  }
  const verdict = verifyRailReward({
    cause, reactions, ...(Object.keys(known).length > 0 ? {known} : {}),
  }, before, after);
  if (verdict.mismatches.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[scale-step-rating] not shown as promised — ${verdict.mismatches.join('; ')}`);
  }
  if (verdict.cause.length === 0) {
    scaleStepRatingState.degraded = true;
    return;
  }
  // THE TRACK'S HEAT-PRODUCTION BONUS (PL-1841 ②) — checked on its OWN row, so a foreign move of heat production in
  // the same response costs the bonus its token (the row ticks), never the rating its tokens.
  const heatOrigins = heatBonusOriginsOf(plan);
  const heatSpecs: Array<ResourceTransferSpec> = heatOrigins.map(() => ({channel: 'production', resource: 'heat', amount: 1}));
  const heatHeld = heatSpecs.length > 0 && verifyRailReward({cause: heatSpecs, reactions: []}, before, after).cause.length > 0;
  if (heatHeld) {
    origins.push(...heatOrigins);
    verdict.cause.push(...heatSpecs);
  }
  const plantOrigins = plantBonusOriginsOf(plan);
  const plantSpecs: Array<ResourceTransferSpec> = plantOrigins.map(() => ({channel: 'production', resource: 'plants', amount: 1}));
  if (plantSpecs.length > 0 && verifyRailReward({cause: plantSpecs, reactions: []}, before, after).cause.length > 0) {
    origins.push(...plantOrigins);
    verdict.cause.push(...plantSpecs);
  }
  beginPanelRewardHold([...verdict.cause, ...verdict.reactions]);
  // A beat still owed for an earlier response plays this one's tokens too.
  const previous = entry;
  entry = {
    plan,
    origins: [...(previous?.origins ?? []), ...origins],
    cause: [...(previous?.cause ?? []), ...verdict.cause],
    reactions: [...(previous?.reactions ?? []), ...verdict.reactions],
  };
  scaleStepRatingState.tokens = entry.cause.length;
  scaleStepRatingState.due = false;
  scaleStepRatingState.degraded = false;
  openQuiet();
  scaleStepRatingState.phase = 'waiting';
  void run();
}

function markerOf(accent: ScaleStepRatingAccent): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`.scale-marker[data-scale-marker="${accent}"]`);
}

/** The stage stands: the player sees the board, the park let every moved value go, and every marker has ARRIVED. */
function stageReady(e: Entry): boolean {
  void boardBeatParkState.heldParams;
  if (!boardBeatBoardWatchable()) {
    return false;
  }
  for (const move of e.plan.moves) {
    void scaleMarkerPoses[move.accent];
    if (boardBeatHoldsParam(move.key)) {
      return false;
    }
    // No cursor at all (a board without this dial): nothing will ever arrive — the beat degrades honestly.
    if (!scaleMarkerArrived(move.accent, move.after) && markerOf(move.accent) !== null) {
      return false;
    }
    // THE MARKER IS A FLIGHT END (the law of visible ends — the map audit of 2026-11-05). A landing routinely raises
    // a DECISION in the same response (Arabia Terra's data cell with two holders, Amazonis' microbes: «on which
    // card?»), and a decision never waits on a story — so its plate stands over the board while the step is told,
    // and the rating token was born UNDER it: on screen it left the plate's own card («Суперкомпьютер» seemed to pay
    // the rating). The token waits for a marker the player can see; the watchable probe stays coverage facts only —
    // this is the END's own verdict, asked on the ledger's re-drive (`nudge`), bounded by the stage's due.
    const end = transferEndVerdict(markerOf(move.accent));
    if (!end.visible && end.why === 'covered') {
      return false;
    }
  }
  return true;
}

/** Wait for the stage — resolves `true` on the stage, `false` past its due or on an abort. */
function waitForStage(e: Entry, myEpoch: number): Promise<boolean> {
  if (stageReady(e)) {
    return Promise.resolve(true);
  }
  debt?.settle();
  debt = owePresentation({
    id: SCALE_STEP_RATING_KEY,
    ready: () => stageReady(e),
    redrive: () => {
      scaleStepRatingState.nudge++;
    },
    dueMs: SCALE_STEP_STAGE_DUE_MS,
    degrade: () => {
      scaleStepRatingState.due = true;
    },
    diagnose: () => ({
      rating: e.plan.rating, watchable: boardBeatBoardWatchable(),
      moves: e.plan.moves.map((m) => `${m.accent}:${m.steps}→${m.after} parked=${boardBeatHoldsParam(m.key)} marker=${JSON.stringify(scaleMarkerPoses[m.accent])}`),
    }),
  });
  // The wait waits: a node of the wait graph beside its ledger story, the due ending it said (`ceilingWait.ts`).
  const wait = beginCeilingWait({id: 'scale-step-rating:stage', owner: 'scaleStepRatingBeat', what: 'the stage of the scale step rating', maxMs: SCALE_STEP_STAGE_DUE_MS});
  return new Promise<boolean>((resolve) => {
    const stop: WatchStopHandle = watch(
      () => {
        void scaleStepRatingState.nudge;
        if (epoch !== myEpoch) {
          return 'abort';
        }
        if (scaleStepRatingState.due) {
          return 'due';
        }
        return stageReady(e) ? 'ready' : 'wait';
      },
      (verdict) => {
        if (verdict !== 'wait') {
          stop();
          debt?.settle();
          debt = undefined;
          if (verdict === 'ready') {
            wait.met();
          } else if (verdict === 'due') {
            wait.ceiling();
          } else {
            wait.end();
          }
          resolve(verdict === 'ready');
        }
      });
  });
}

/** A wait on the GSAP clock — the clock the tokens animate on. */
function gsapWait(ms: number): Promise<void> {
  return motionSpan(ms);
}

/** The birth point of each token: the marker's rim (fanned per marker), the 16 % chip's centre for the bonus. */
function birthPoints(origins: ReadonlyArray<TokenOrigin>): Array<TransferPoint | undefined> {
  const out: Array<TransferPoint | undefined> = origins.map(() => undefined);
  const perMarker = new Map<ScaleStepRatingAccent, Array<number>>();
  origins.forEach((origin, i) => {
    if (origin.bonus && origin.chip !== undefined) {
      const chip = typeof document === 'undefined' ? null :
        document.querySelector<HTMLElement>(`.bonus-zone[data-arc-marker="${origin.chip}"]`);
      const box = chip?.getBoundingClientRect();
      if (box !== undefined && box.width > 1) {
        out[i] = {x: box.left + box.width / 2, y: box.top + box.height / 2};
        return;
      }
    }
    perMarker.set(origin.accent, [...(perMarker.get(origin.accent) ?? []), i]);
  });
  for (const [accent, indices] of perMarker) {
    const box = markerOf(accent)?.getBoundingClientRect();
    if (box === undefined || box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > window.innerHeight) {
      continue;
    }
    const points = scaleStepTokenOrigins({x: box.left, y: box.top, w: box.width, h: box.height}, indices.length);
    indices.forEach((index, n) => {
      out[index] = points[n];
    });
  }
  return out;
}

/** Fly the entry's tokens off their birth points; each touchdown releases one rating; the answer a beat after the last. */
async function pay(e: Entry, myEpoch: number): Promise<void> {
  scaleStepRatingState.phase = 'flying';
  const points = birthPoints(e.origins);
  const specs = [...e.cause];
  if (points.some((p) => p === undefined)) {
    // Nothing to be born on (no marker on screen) — the counters tick now, honestly.
    scaleStepRatingState.degraded = true;
    releaseHeld(e);
    return;
  }
  await runResourceTransfers({
    specs,
    origins: points,
    source: {},
    arrival: 'auto',
    // Born on the board: under a workspace opened mid-flight the wave recedes with it.
    fromBoard: true,
    onArrive: (spec) => {
      const index = e.cause.indexOf(spec);
      if (index >= 0) {
        e.cause.splice(index, 1);
        releasePanelRewardHold(spec);
      }
    },
    onDegrade: () => {
      scaleStepRatingState.degraded = true;
    },
  });
  if (epoch !== myEpoch) {
    return;
  }
  // Whatever a token's honest fallback did not release (never strand a counter).
  for (const spec of e.cause.splice(0)) {
    releasePanelRewardHold(spec);
  }
  // THE ANSWER — one beat after the last touchdown, on the animation clock.
  const answers = e.reactions.splice(0);
  if (answers.length > 0) {
    await gsapWait(motionMs(TOUCHDOWN_TICK_GAP_MS));
    for (const spec of answers) {
      releasePanelRewardHold(spec);
    }
  }
}

async function run(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  const myEpoch = ++epoch;
  runOwner = myEpoch;
  try {
    while (epoch === myEpoch && entry !== undefined) {
      const e = entry;
      scaleStepRatingState.phase = 'waiting';
      const ready = await waitForStage(e, myEpoch);
      if (epoch !== myEpoch) {
        return;
      }
      if (!ready) {
        // Past its due: the player never came back to the board — the cell ticks, nothing flies.
        entry = undefined;
        releaseHeld(e);
        continue;
      }
      // The marker's settle accent is the step's own last word — the token leaves on its breath.
      await gsapWait(motionMs(SCALE_STEP_BREATH_MS));
      if (epoch !== myEpoch || entry !== e) {
        continue;
      }
      // The stage is asked AGAIN after the breath: a surface that came over the marker inside it (a plate re-judged, a
      // scene's card standing up) is waited out — a token is never born on a stage it only had a breath ago.
      if (!stageReady(e)) {
        continue;
      }
      entry = undefined;
      paying = e;
      await pay(e, myEpoch);
      if (paying === e) {
        paying = undefined;
      }
    }
  } finally {
    if (runOwner === myEpoch) {
      running = false;
    }
    if (epoch === myEpoch) {
      scaleStepRatingState.phase = 'idle';
      scaleStepRatingState.tokens = 0;
      resolveQuiet();
    } else if (entry !== undefined) {
      void run();
    }
  }
}

/** Abort / game switch: stop, release whatever the panel still holds for this beat (a hold never strands a counter). Idempotent. */
export function resetScaleStepRating(): void {
  epoch++;
  const e = entry;
  entry = undefined;
  debt?.settle();
  debt = undefined;
  if (e !== undefined) {
    releaseHeld(e);
  }
  scaleStepRatingState.phase = 'idle';
  scaleStepRatingState.tokens = 0;
  scaleStepRatingState.due = false;
  scaleStepRatingState.degraded = false;
  resolveQuiet();
}

// THE GAME SCREEN LEAVES: this state goes with it — declared here, taken down by the session's ordered pass
// (architecture v2 — PLAN §10 · C5; the number is its place in that pass — `leaveConsoleSession`).
sessionState('scale-step-rating', resetScaleStepRating, 60);
