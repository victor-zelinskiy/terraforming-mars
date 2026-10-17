/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE GENERATION CHANGE IS ONE SCENE (TR61 — «СМЕНА ПОКОЛЕНИЯ — ОДНА СЦЕНА»).
 *
 * The moment that comes EVERY generation to EVERY player — the counter flips,
 * the energy turns to heat, the production pays — used to be three unrelated
 * ticks on the console: the «ПКЛ.» flip, the conversion gate, and six `+N`
 * chips changing the rail in one frame; then, a second later, a buy plate.
 * This module makes it ONE phrase, played off the SERVER'S OWN RECORD of the
 * phase (`PlayerViewModel.productionIncome` — TR61 part А) and never off a
 * diff of two views:
 *
 *   (1) FLIP       — the generation counter flips FIRST (the HUD tick stays the
 *                    announcement — `terraforming-progress-hud.md`): the
 *                    displayed view's generation is set ahead of the commit
 *                    (the marker-hold precedent, `applyGlobalParamPreview`) and
 *                    the scene waits for the strip's own completion signal
 *                    (`noteGenerationFlipEnd`), never a timer of its own;
 *   (2) CONVERSION — the existing energy → heat gate (`energyConversionTransition`)
 *                    plays as the scene's second beat, unchanged — the rules'
 *                    order (the conversion comes BEFORE the income);
 *   (3) INCOME     — in the transport's apply block the rail rows the record
 *                    names are HELD (`railReward.seedRailReward` — the promise is
 *                    checked against the two views, a row that disagrees ticks
 *                    with the commit and says why), and after the commit each
 *                    income flows from its PRODUCTION BADGE into its stock
 *                    figure, the rating's M€ out of the RATING CELL, top to bottom
 *                    in one wave, every counter ticking on its own touchdown
 *                    (PL-099 — the action commit's reward language);
 *   (4) RISE       — when the research buy / the draft of the next generation
 *                    is live for this seat, the scene CONCLUDES by standing up
 *                    the draft workspace itself (the owner's decision 6а: the
 *                    purchase rises from the scene) — the mandatory announce of
 *                    that flow is acknowledged by the scene, under the scene's
 *                    own hold, so no plate can appear in the gap.
 *
 * The scene holds the foreground from its first beat to its conclusion
 * (`registerAnimationHoldSupplier` — the next prompt, the feed and the bot's
 * turn wait); every beat is bounded by its own completion signal with a leak
 * net on the animation clock. Reduced motion: the flip snaps (CSS), the rail
 * is never held (the seed refuses), the counters tick with the commit — the
 * same numbers, no motion. A view with no record (an old save, a rival's
 * production, a reload) plays nothing: the buy then arrives the ordinary way.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {Units} from '@/common/Units';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ProductionIncomeModel} from '@/common/models/ProductionIncomeModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {RailReward, flyRailReward, railRewardPending, releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {RATING_RAIL_KEY, ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {acknowledgeMandatoryBeat} from '@/client/console/consoleMandatoryGate';
import {enterWorkspace, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {betweenGenResearchLive, draftMandatoryFlowBeat} from '@/client/console/draft/consoleDraftFlow';

/** The rail-reward key of the income wave (one scene at a time). */
export const GENERATION_INCOME_KEY = 'generation-income';

/** The flip's own choreography length (ConsoleFlipValue's FLIP_TOTAL_MS) — the leak net stands above it. */
const FLIP_NET_MS = 940 + 600;

export type GenerationScenePhase = 'idle' | 'flip' | 'conversion' | 'income' | 'rise';

export type GenerationSceneEvent = {
  color: Color;
  /** The generation whose production this is (the record's). */
  generation: number;
  /** The generation the strip FLIPS to in this response, when it advanced (undefined: no flip — a Redux sitting stands between). */
  flipTo: number | undefined;
  record: ProductionIncomeModel;
  dedupeKey: string;
};

export const generationSceneState = reactive({
  phase: 'idle' as GenerationScenePhase,
  /** The seat whose scene plays. */
  color: '' as Color | '',
  generation: 0,
  /** Bumped at every scene start (the e2e probe's clock). */
  nonce: 0,
  /** Why the last scene ended ('' after a full phrase) — diagnostics. */
  lastEnd: '',
  /** The flow the scene stood up at its conclusion (the e2e witness), '' when none. */
  rose: '' as '' | 'draft',
});

/** Replays of one record (the same view re-fetched) never re-animate. */
const seen = new Set<string>();

let armed: GenerationSceneEvent | undefined;
let flipResolve: (() => void) | undefined;
let flipNet: ReturnType<typeof setTimeout> | undefined;

// The scene owns the foreground from its first beat to its conclusion — the next prompt, the feed and the bot's
// story wait. Bounded by the registry's ceiling; its `expire` ends the WEDGE, not just the hold.
registerAnimationHoldSupplier('generation-scene', () => generationSceneState.phase !== 'idle', {
  diagnose: () => ({phase: generationSceneState.phase, generation: generationSceneState.generation, pending: railRewardPending(GENERATION_INCOME_KEY)}),
  expire: () => endGenerationScene('expired'),
});

function viewerRecord(view: PlayerViewModel | undefined): {color: Color, record: ProductionIncomeModel} | undefined {
  const record = view?.productionIncome;
  const color = view?.thisPlayer?.color;
  if (record === undefined || color === undefined) {
    return undefined;
  }
  return {color, record};
}

/**
 * Detect (and atomically CLAIM) the scene of the prev → next view transition.
 * Returns the event only when it should play now; a fresh load (no `prev`)
 * claims the record so a later poll never replays a phase the player never
 * saw happen. Claimed here — synchronous — so two near-simultaneous responses
 * cannot both play it (the conversion gate's own discipline).
 */
export function detectGenerationScene(prev: PlayerViewModel | undefined, next: PlayerViewModel | undefined): GenerationSceneEvent | undefined {
  const mine = viewerRecord(next);
  if (mine === undefined) {
    return undefined;
  }
  const dedupeKey = `${mine.color}:${mine.record.generation}`;
  if (seen.has(dedupeKey)) {
    return undefined;
  }
  seen.add(dedupeKey);
  // A fresh load plays nothing; a scene still armed or playing refuses a second (the record stays claimed).
  if (prev === undefined || armed !== undefined || generationSceneState.phase !== 'idle') {
    return undefined;
  }
  const flipTo = next !== undefined && prev.game.generation < next.game.generation ? next.game.generation : undefined;
  armed = {color: mine.color, generation: mine.record.generation, flipTo, record: mine.record, dedupeKey};
  return armed;
}

/** The armed scene (between the detect and the conclusion), if any. */
export function armedGenerationScene(): GenerationSceneEvent | undefined {
  return armed;
}

/**
 * BEAT 1 — the FLIP. The displayed view's generation is set to the next
 * view's NOW (the commit follows the scene), so the strip's own flip-swap
 * plays; the promise settles on the strip's completion signal
 * (`noteGenerationFlipEnd`) — or at once under reduced motion / with no flip
 * in this response — with a net on the animation clock.
 */
export function runGenerationFlip(event: GenerationSceneEvent, displayed: PlayerViewModel): Promise<void> {
  generationSceneState.phase = 'flip';
  generationSceneState.color = event.color;
  generationSceneState.generation = event.generation;
  generationSceneState.rose = '';
  generationSceneState.lastEnd = '';
  generationSceneState.nonce++;
  if (event.flipTo === undefined || displayed.game.generation >= event.flipTo) {
    return Promise.resolve();
  }
  const to = event.flipTo;
  // The preview: the strip reads the displayed view, so this is the flip's trigger (the marker-hold precedent).
  displayed.game.generation = to;
  if (consoleReducedMotionActive()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const settle = () => {
      if (flipNet !== undefined) {
        clearTimeout(flipNet);
        flipNet = undefined;
      }
      flipResolve = undefined;
      resolve();
    };
    flipResolve = settle;
    flipNet = setTimeout(settle, motionMs(FLIP_NET_MS));
  });
}

/** The strip's completion signal (ConsoleFlipValue → ConsoleStatusStrip): the generation readout finished its flip. */
export function noteGenerationFlipEnd(generation: number): void {
  if (flipResolve !== undefined && generationSceneState.phase === 'flip' && generation >= generationSceneState.generation) {
    flipResolve();
  }
}

/** BEAT 2 is the conversion gate's own (`energyConversionTransition`); the scene only names the phase. */
export function markGenerationConversion(): void {
  if (generationSceneState.phase === 'flip') {
    generationSceneState.phase = 'conversion';
  }
}

const INCOME_ORDER: ReadonlyArray<keyof Units> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

/** The ONE spec object of the rating's M€ (released by identity on its own touchdown — two M€ tokens are two flights). */
let ratingSpec: ResourceTransferSpec | undefined;

/**
 * THE PROMISE of the income wave, read off the record: one token per
 * production value that landed (positive), the rating's M€ as a token of its
 * own; the moves the diff must allow for beside them — the conversion
 * (energy −, heat +) and a NEGATIVE M€ production — are `known`.
 */
export function generationIncomeReward(record: ProductionIncomeModel): RailReward {
  const cause: Array<ResourceTransferSpec> = [];
  ratingSpec = undefined;
  if (record.rating > 0) {
    ratingSpec = {channel: 'stock', resource: 'megacredits', amount: record.rating};
    cause.push(ratingSpec);
  }
  const known: Record<string, number> = {};
  for (const resource of INCOME_ORDER) {
    const amount = record.income[resource];
    if (amount > 0) {
      cause.push({channel: 'stock', resource, amount});
    } else if (amount < 0) {
      known[`stock:${resource}`] = (known[`stock:${resource}`] ?? 0) + amount;
    }
  }
  if (record.conversion > 0) {
    known['stock:energy'] = (known['stock:energy'] ?? 0) - record.conversion;
    known['stock:heat'] = (known['stock:heat'] ?? 0) + record.conversion;
  }
  return {cause, reactions: [], known};
}

/**
 * BEAT 3, the SEED — called from the transport's apply block (the SAME
 * synchronous block as the commit): the rows the income pays keep their
 * pre-income values until each token's touchdown. Returns whether anything
 * is held (reduced motion holds nothing — the counters tick with the commit).
 */
export function seedGenerationIncomeHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): boolean {
  if (armed === undefined) {
    return false;
  }
  generationSceneState.phase = 'income';
  return seedRailReward(GENERATION_INCOME_KEY, generationIncomeReward(armed.record), before, after);
}

function centerOf(selector: string): TransferPoint | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = document.querySelector<HTMLElement>(selector);
  const r = el?.getBoundingClientRect();
  if (r === undefined || r.width < 2 || r.height < 2) {
    return undefined;
  }
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

/** Where a token is BORN: the rating's M€ in the rating cell, a production value on its row's production badge. */
export function incomeOriginOf(spec: ResourceTransferSpec): TransferPoint | undefined {
  if (spec === ratingSpec || spec.resource === RATING_RAIL_KEY) {
    return centerOf('.con-res .con-score__cell--tr .con-score__value') ?? centerOf('.con-res .con-score__cell--tr');
  }
  return centerOf(`.con-res__row--${spec.resource} .con-res__prod`) ?? centerOf(`.con-res__row--${spec.resource}`);
}

/**
 * BEAT 3, the FLIGHTS — after the commit (the real values stand under the
 * held rows): the wave flies top to bottom, every row ticking on its own
 * touchdown; then BEAT 4 concludes the scene. Resolves when the scene is over.
 */
export async function runGenerationIncomeFlights(view: () => PlayerViewModel | undefined): Promise<void> {
  const event = armed;
  if (event === undefined) {
    return;
  }
  generationSceneState.phase = 'income';
  try {
    if (railRewardPending(GENERATION_INCOME_KEY)) {
      await flyRailReward(GENERATION_INCOME_KEY, (spec) => incomeOriginOf(spec));
    }
  } finally {
    concludeGenerationScene(view());
  }
}

/**
 * BEAT 4 — the RISE: the research buy / the next generation's draft is live
 * for this seat → the scene stands the draft workspace up ITSELF (the owner's
 * decision 6а) and acknowledges that flow's mandatory announce under its own
 * hold, so the plate never appears in the gap; a flow already standing (a
 * restore) is left alone. Then the hold falls. Idempotent.
 */
function concludeGenerationScene(view: PlayerViewModel | undefined): void {
  if (armed === undefined) {
    return;
  }
  generationSceneState.phase = 'rise';
  try {
    if (view !== undefined && betweenGenResearchLive(view) && !workspaceFrameKnown('draft') &&
        (view.game.phase === Phase.RESEARCH || view.game.phase === Phase.DRAFTING)) {
      const beat = draftMandatoryFlowBeat(view);
      if (beat !== undefined) {
        acknowledgeMandatoryBeat(beat.key);
      }
      enterWorkspace('draft', {anchor: {type: 'phase', phase: 'draft'}});
      generationSceneState.rose = 'draft';
    }
  } finally {
    armed = undefined;
    generationSceneState.phase = 'idle';
    generationSceneState.lastEnd = generationSceneState.lastEnd === '' ? 'concluded' : generationSceneState.lastEnd;
  }
}

/** END on an interrupt / the ceiling: every held row ticks now, the hold falls, nothing stands up. Idempotent. */
export function endGenerationScene(reason: string): void {
  if (flipResolve !== undefined) {
    flipResolve();
  }
  releaseRailReward(GENERATION_INCOME_KEY, reason);
  if (armed !== undefined || generationSceneState.phase !== 'idle') {
    generationSceneState.lastEnd = reason;
  }
  armed = undefined;
  generationSceneState.phase = 'idle';
}

/** Game-switch boundary / tests: a full reset (the dedupe memory included). */
export function resetGenerationScene(): void {
  endGenerationScene('reset');
  seen.clear();
  ratingSpec = undefined;
  generationSceneState.color = '';
  generationSceneState.generation = 0;
  generationSceneState.nonce = 0;
  generationSceneState.lastEnd = '';
  generationSceneState.rose = '';
}
