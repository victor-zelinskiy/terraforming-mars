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
 *   (3) INCOME     — the STANDARD income (the rating's M€, every production
 *                    value) ticks with the commit, each row speaking through its
 *                    own delta chip — no tokens (the owner, 2026-10-26: a fan of
 *                    chips off every badge overloaded the beat). What a card's
 *                    own production hook paid (the record's `hooks` — Pristar's
 *                    6 M€ and preservation) is HELD in the apply block
 *                    (`railReward.seedRailReward`, checked against the two views)
 *                    and, after the commit, the card's mark on the rail CHARGES
 *                    and the payout is born out of it at the featured pace, the
 *                    row ticking on its touchdown;
 *   (4) RISE       — when the research buy / the draft of the next generation
 *                    is live for this seat, the scene CONCLUDES by standing up
 *                    the draft workspace itself (the owner's decision 6а: the
 *                    purchase rises from the scene) — the mandatory announce of
 *                    that flow is acknowledged by the scene, under the scene's
 *                    own hold, so no plate can appear in the gap. Under Turmoil
 *                    Redux the SITTING stands between the income and the draft
 *                    (the rules' order), and since the soft gates its whole
 *                    chain rides this very response: the scene then rises into
 *                    the SITTING instead (its walk was seeded in the same block
 *                    — `generationSceneRisesIntoSitting`), and the counter does
 *                    not flip until the seat closes it (`presentedGeneration`).
 *
 * The scene holds the foreground from its first beat to its conclusion
 * (`registerAnimationHoldSupplier` — the next prompt, the feed and the bot's
 * turn wait); every beat is bounded by its own completion signal with a leak
 * net on the animation clock. Reduced motion: the flip snaps (CSS), the rail
 * is never held (the seed refuses), the counters tick with the commit — the
 * same numbers, no motion. A view with no record (an old save, a rival's
 * production, a reload) plays nothing: the buy then arrives the ordinary way.
 */
import {reactive, toRaw} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {Units} from '@/common/Units';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ProductionIncomeModel} from '@/common/models/ProductionIncomeModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {RailReward, flyRailReward, railRewardPending, releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {ResourceTransferSpec, TRANSFER_FEATURED_PACE, TransferPoint, cardResourceKey, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {acknowledgeMandatoryBeat} from '@/client/console/consoleMandatoryGate';
import {declareHeldAnswers, surfaceClear} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cardReactionAnswerFlight} from '@/client/console/cardReaction/cardReactionDirector';
import {enterWorkspace, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {betweenGenResearchLive, draftMandatoryFlowBeat} from '@/client/console/draft/consoleDraftFlow';
import {parliamentSittingFlowBeat, presentedGeneration} from '@/client/console/parliament/consoleSittingFlow';

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
  rose: '' as '' | 'draft' | 'parliament',
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
  // The PRESENTED generation: a seat whose sitting still stands is in its sitting's generation — no flip yet.
  const flipTo = next !== undefined && presentedGeneration(prev) < presentedGeneration(next) ? presentedGeneration(next) : undefined;
  armed = {color: mine.color, generation: mine.record.generation, flipTo, record: mine.record, dedupeKey};
  return armed;
}

/** The armed scene (between the detect and the conclusion), if any. */
export function armedGenerationScene(): GenerationSceneEvent | undefined {
  return armed;
}

/**
 * WILL THE SCENE RISE INTO THE SITTING? — the seat's own scene is armed and the
 * seat's sitting stands in `view` (the soft gates: the whole chain rides the
 * response that brings the production). The sitting's seeders read it as «on
 * screen»: the walk is the very next thing this seat sees, so its wave is owed
 * there, never ticked under the scene. Read in the apply block, after the detect.
 */
export function generationSceneRisesIntoSitting(view: PlayerViewModel | undefined): boolean {
  return armed !== undefined && view !== undefined && armed.color === view.thisPlayer?.color && parliamentSittingFlowBeat(view) !== undefined;
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

/** The tokens a card's own production hook pays (the record's `hooks`), by spec object → the card they are born on. */
const hookSpecs = new Map<ResourceTransferSpec, CardName>();

/**
 * THE PROMISE of the income beat, read off the record. THE STANDARD INCOME DOES NOT FLY (the owner, 2026-10-26: a
 * fan of chips — one token off every production badge at once — overloaded the beat and drew the eye off the
 * rail): the rating's M€, every production value and the conversion are KNOWN moves, so the rows tick with the
 * commit and each speaks through its own delta chip.
 *
 * What FLIES is what the phase did not pay by its own rule — a card's OWN production hook (the record's `hooks`:
 * Pristar's 6 M€ and its preservation), one token per resource it paid, born on the card's mark on this screen
 * (`[data-income-hook]` — Pristar's token on the rating cell) after the mark has charged. A hook's resource on its
 * own card lands on the card's counter (its satellite cell) with the points it brings.
 */
export function generationIncomeReward(record: ProductionIncomeModel): RailReward {
  const cause: Array<ResourceTransferSpec> = [];
  hookSpecs.clear();
  const known: Record<string, number> = {};
  const add = (resource: keyof Units, amount: number): void => {
    if (amount !== 0) {
      known[`stock:${resource}`] = (known[`stock:${resource}`] ?? 0) + amount;
    }
  };
  /** The points each cause token brings (aligned with `cause`) — a hook's resource on a scoring card (Pristar). */
  const vp: Array<number> = [];
  add('megacredits', record.rating);
  for (const resource of INCOME_ORDER) {
    add(resource, record.income[resource]);
  }
  for (const hook of record.hooks ?? []) {
    for (const resource of INCOME_ORDER) {
      const amount = hook.income[resource];
      if (amount > 0) {
        const spec: ResourceTransferSpec = {channel: 'stock', resource, amount};
        hookSpecs.set(spec, hook.card);
        cause.push(spec);
      } else {
        add(resource, amount);
      }
    }
    const stored = hook.cardResources;
    if (stored !== undefined && stored.amount > 0) {
      const spec: ResourceTransferSpec = {channel: 'card-resource', resource: cardResourceKey(stored.resource), amount: stored.amount, targetCard: hook.card};
      hookSpecs.set(spec, hook.card);
      vp[cause.length] = stored.vp;
      cause.push(spec);
    }
  }
  if (record.conversion > 0) {
    add('energy', -record.conversion);
    add('heat', record.conversion);
  }
  const points = cause.map((_, i) => vp[i] ?? 0);
  return {cause, reactions: [], known, ...(points.some((v) => v !== 0) ? {vp: points} : {})};
}

/**
 * BEAT 3, the SEED — called from the transport's apply block (the SAME
 * synchronous block as the commit): the rows a card's hook paid keep that
 * payment out until its token's touchdown (the standard income ticks with the
 * commit). Returns whether anything is held (reduced motion holds nothing).
 */
export function seedGenerationIncomeHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): boolean {
  if (armed === undefined) {
    return false;
  }
  generationSceneState.phase = 'income';
  const held = seedRailReward(GENERATION_INCOME_KEY, generationIncomeReward(armed.record), before, after);
  if (held) {
    // Declared for the card-reaction seeder (CN): a hook's rows are this scene's — flown off the card's own face, risen
    // beside the rail — never the chain's second flight.
    declareHeldAnswers([...hookSpecs.keys()]);
  }
  return held;
}

/** The mark a paying card wears on this screen (`data-income-hook` = its name) — undefined when it wears none. */
function hookMarkOf(card: CardName): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return Array.from(document.querySelectorAll<HTMLElement>('.con-res [data-income-hook]')).find((el) => el.dataset.incomeHook === card);
}

function hookMarkCenter(card: CardName): TransferPoint | undefined {
  const r = hookMarkOf(card)?.getBoundingClientRect();
  return r === undefined || r.width < 2 || r.height < 2 ? undefined : {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

/**
 * The card a token of the beat is born on (pure — the registry's Proxy unwrapped), undefined for a token that is no
 * hook's. ⚠ The flight asks with the spec the rail-reward REGISTRY holds — a reactive store, so a Proxy: the identity
 * test reads the raw object (asked by identity on the Proxy, no hook token ever found its mark — PL-982).
 */
export function incomeHookOf(asked: ResourceTransferSpec): CardName | undefined {
  return hookSpecs.get(toRaw(asked));
}

/** Where a token is BORN, measured: its card's mark (none on screen → the token degrades by name, its row ticks). */
export function incomeOriginOf(spec: ResourceTransferSpec): TransferPoint | undefined {
  const card = incomeHookOf(spec);
  return card === undefined ? undefined : hookMarkCenter(card);
}

/** The charge's own length (CSS `con-income-charge`) — the net above it never decides, the mark's `animationend` does. */
const CHARGE_NET_MS = 560 + 400;

/**
 * THE CARD ANSWERS FIRST: each paying card's mark CHARGES once (a one-shot on the mark itself — it swells, a ring
 * leaves it) and its tokens are born out of it only once the charge has played — the payout reads as the card's,
 * never as a chip out of nowhere. Settles on the marks' own `animationend`, a net on the animation clock beside it;
 * a card wearing no mark charges nothing. Reduced motion never gets here (nothing is held).
 */
function chargeHookMarks(cards: ReadonlyArray<CardName>): Promise<void> {
  const marks = cards.map((card) => hookMarkOf(card)).filter((el): el is HTMLElement => el !== undefined);
  return Promise.all(marks.map((mark) => new Promise<void>((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      mark.removeEventListener('animationend', onEnd);
      clearTimeout(net);
      mark.removeAttribute('data-income-charging');
      resolve();
    };
    const onEnd = (e: AnimationEvent): void => {
      if (e.target === mark && e.animationName === 'con-income-charge') {
        done();
      }
    };
    mark.addEventListener('animationend', onEnd);
    mark.setAttribute('data-income-charging', '');
    const net = setTimeout(done, motionMs(CHARGE_NET_MS));
  }))).then(() => undefined);
}

/**
 * BEAT 3, the FLIGHTS — after the commit (the standard income has ticked, a hook's payment stands held): the paying
 * marks charge, their tokens fly at the FEATURED pace (a beat the eye must follow, slower than a reward wave), every
 * row ticking on its touchdown; then BEAT 4 concludes the scene. Resolves when the scene is over.
 */
export async function runGenerationIncomeFlights(view: () => PlayerViewModel | undefined): Promise<void> {
  const event = armed;
  if (event === undefined) {
    return;
  }
  generationSceneState.phase = 'income';
  try {
    if (railRewardPending(GENERATION_INCOME_KEY)) {
      // «СРАБАТЫВАНИЕ КАРТЫ» (CN): the paying card RISES beside the rail while its mark on the rail charges as the CAUSE,
      // and its tokens are born on ITS printed effect (Pristar's «[preservation] 6 M€»); a face that could not rise keeps
      // the mark as the birth place.
      const reaction = cardReactionAnswerFlight({rows: [...new Set([...hookSpecs.keys()].map((spec) => railRowKey(spec)))]});
      await Promise.all([chargeHookMarks([...new Set(hookSpecs.values())]), reaction?.prepare?.() ?? Promise.resolve()]);
      await flyRailReward(GENERATION_INCOME_KEY, (spec) => reaction?.originOf(spec) ?? incomeOriginOf(spec), undefined, undefined, {pace: TRANSFER_FEATURED_PACE});
      reaction?.onDone?.();
      // THE RISE WAITS FOR THE LAST ABSORB, never for a touchdown alone: a hook's resource lands on its card's cell of the
      // ДОП. РЕСУРСЫ satellite (Pristar's preservation), which every band surface covers — the purchase rising on the
      // touchdown painted its workspace over the token still being absorbed there (PL-983). Bounded by the law's own ceiling.
      await surfaceClear(typeof document === 'undefined' ? null : document.querySelector('.con-res-host'));
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
    // THE SITTING FIRST (the rules' order — production → the parliament → the next generation's research): its
    // whole chain arrived with this response, and the seat reads it before the draft can rise for it.
    const sitting = view === undefined ? undefined : parliamentSittingFlowBeat(view);
    if (sitting !== undefined) {
      if (!workspaceFrameKnown('parliament')) {
        acknowledgeMandatoryBeat(sitting.key);
        enterWorkspace('parliament', {anchor: {type: 'phase', phase: Phase.PARLIAMENT}});
        generationSceneState.rose = 'parliament';
      }
    } else if (view !== undefined && betweenGenResearchLive(view) && !workspaceFrameKnown('draft') &&
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
  hookSpecs.clear();
  generationSceneState.color = '';
  generationSceneState.generation = 0;
  generationSceneState.nonce = 0;
  generationSceneState.lastEnd = '';
  generationSceneState.rose = '';
}
