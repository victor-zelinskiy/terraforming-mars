/*
 * CONSOLE RESOURCE TRANSFER — the run lifecycle of the shared premium
 * "receiving resources" language (console-native only):
 *
 *   reward source → a physical resource chip carrying its amount → the exact
 *   destination zone in the left panel → the delta chip.
 *
 * Two clients today: the patent-sale payout (one M€ chip out of the trade
 * terminal, `arrival: 'hold'` — the chip rests on the M€ row until the gated
 * commit fires the delta chip, then `settleResourceTransfers()` absorbs it)
 * and the played-card reward beat (`arrival: 'auto'` — the view is ALREADY
 * committed under the PANEL REWARD HOLD, and each chip's touchdown releases
 * its metric from the hold, firing that delta chip at the exact contact).
 *
 * THE PANEL REWARD HOLD is the framework's delayed-visual-commit half (the
 * startSetupReveal idiom, generalized): ConsoleResourcePanel displays every
 * held metric MINUS its pending amount, so committing the authoritative view
 * doesn't fire the reward's delta chips early — each release makes the
 * displayed value jump by exactly the transferred amount, and the existing
 * AnimatedMetricValue fires the chip from that honest watch transition. One
 * value system (the committed view), one chip system (unchanged) — the hold
 * only re-times WHEN the panel shows the reward.
 *
 * Anchors are resolved from the REAL interface at flight time (never a fixed
 * trajectory): the played card's slot in «Разыграно», the sale terminal's
 * slit, the panel's stock value / production zone / the chosen host card /
 * the additional-resources satellite. A transfer whose source or target
 * can't be measured degrades honestly: no flight, its hold releases at once
 * (the delta chip fires marginally later than the commit — never lost).
 *
 * DESKTOP SAFETY: only console-shell flows call into this module; nothing
 * here is reachable from the desktop surfaces.
 */

import {reactive, nextTick} from 'vue';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  ResourceTransferSpec, TransferPoint, TransferRect,
  transferFlightBudgetMs, transferWaveDelayMs, sourceSpawnPoint, cardResourceKey,
  TRANSFER_BEAT_MS,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  TransferStagePiece, runTransferFlight, settleTransferChip, killTransferPiece,
} from '@/client/console/resourceTransfer/resourceTransferDirector';

export type TransferFlight = {
  id: number,
  spec: ResourceTransferSpec,
};

export const resourceTransferState = reactive({
  flights: [] as Array<TransferFlight>,
  nonce: 0,
});

// ── the PANEL REWARD HOLD (delayed visual commit of reward metrics) ─────────

type PanelRewardHold = {
  /** Any metric held — ConsoleResourcePanel consults the maps only then. */
  active: boolean;
  /** Pending amounts by standard resource key (displayed = committed − held). */
  stock: Record<string, number>;
  production: Record<string, number>;
  /** Pending card-resource amounts by normalized icon key (the aux satellite). */
  cardRes: Record<string, number>;
};

export const panelRewardHold = reactive<PanelRewardHold>({
  active: false,
  stock: {},
  production: {},
  cardRes: {},
});

function holdMapFor(spec: ResourceTransferSpec): Record<string, number> {
  switch (spec.channel) {
  case 'stock': return panelRewardHold.stock;
  case 'production': return panelRewardHold.production;
  case 'card-resource': return panelRewardHold.cardRes;
  }
}

/** Seed the hold BEFORE the commit — the panel keeps showing the pre-reward
 *  values of the held metrics while everything else commits normally. */
export function beginPanelRewardHold(specs: ReadonlyArray<ResourceTransferSpec>): void {
  for (const spec of specs) {
    if (spec.amount <= 0) {
      continue;
    }
    const map = holdMapFor(spec);
    map[spec.resource] = (map[spec.resource] ?? 0) + spec.amount;
  }
  syncHoldActive();
}

/** Release ONE transfer's metric — the displayed value jumps by exactly the
 *  transferred amount and its delta chip fires from that transition. */
export function releasePanelRewardHold(spec: ResourceTransferSpec): void {
  const map = holdMapFor(spec);
  const left = (map[spec.resource] ?? 0) - spec.amount;
  if (left > 0) {
    map[spec.resource] = left;
  } else {
    delete map[spec.resource];
  }
  syncHoldActive();
}

/** Drop every pending hold at once (abort / safety) — the panel snaps to the
 *  committed truth and any remaining chips fire in one honest transition. */
export function clearPanelRewardHold(): void {
  panelRewardHold.stock = {};
  panelRewardHold.production = {};
  panelRewardHold.cardRes = {};
  panelRewardHold.active = false;
}

function syncHoldActive(): void {
  panelRewardHold.active =
    Object.keys(panelRewardHold.stock).length > 0 ||
    Object.keys(panelRewardHold.production).length > 0 ||
    Object.keys(panelRewardHold.cardRes).length > 0;
}

/** Panel readers (ConsoleResourcePanel) — 0 when nothing is held. */
export function heldStock(resource: string): number {
  return panelRewardHold.active ? (panelRewardHold.stock[resource] ?? 0) : 0;
}
export function heldProduction(resource: string): number {
  return panelRewardHold.active ? (panelRewardHold.production[resource] ?? 0) : 0;
}
export function heldCardResource(iconKey: string): number {
  return panelRewardHold.active ? (panelRewardHold.cardRes[iconKey] ?? 0) : 0;
}

// ── stage registry (the layer plugs in) ─────────────────────────────────────

type TransferStageHandle = {piece: (id: number) => TransferStagePiece | undefined};
let stage: TransferStageHandle | undefined;

export function registerResourceTransferStage(handle: TransferStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

// ── the run lifecycle ───────────────────────────────────────────────────────

export type ResourceTransferRun = {
  specs: ReadonlyArray<ResourceTransferSpec>;
  /**
   * Where the rewards visually emerge:
   *  - `point`     — an explicit stage point (the sale terminal's slit);
   *  - `selectors` — candidate DOM selectors tried in order (the played
   *    card's slot / the events backstack), spawn points spread across the
   *    matched element's lower band.
   */
  source: {point?: TransferPoint, selectors?: ReadonlyArray<string>};
  /**
   * PER-SPEC origin override, aligned with `specs` by index (the tile
   * placement scene: each printed bonus icon on the field is its own
   * birth point). An undefined entry falls back to the shared `source`.
   */
  origins?: ReadonlyArray<TransferPoint | undefined>;
  /**
   * `auto` — each chip is absorbed at its destination right after the
   * contact beat (the played-card reward wave);
   * `hold` — landed chips REST on their destination until
   * `settleResourceTransfers()` (the sale payout, whose commit is gated on
   * the touchdown).
   */
  arrival: 'auto' | 'hold';
  /** Fired at each transfer's TOUCHDOWN (release the hold / free a gate). */
  onArrive?: (spec: ResourceTransferSpec) => void;
};

let flightSeq = 0;
/** Landed hold-mode chips awaiting settle (id → its landing point). */
let heldChips: Array<{id: number, at: TransferPoint}> = [];
let runActive = false;

export function isResourceTransferActive(): boolean {
  return runActive || resourceTransferState.flights.length > 0;
}

/**
 * Run one transfer wave. Resolves when EVERY transfer has ARRIVED (its
 * `onArrive` fired) — the absorb/dissolve tail continues past the resolve
 * for `auto` runs so the caller is never held on decoration. NEVER rejects;
 * a transfer whose geometry can't be measured releases immediately (the
 * reward is announced by its delta chip alone, marginally late, never lost).
 */
export async function runResourceTransfers(run: ResourceTransferRun): Promise<void> {
  // `origins` aligns with `run.specs` by index — pair them BEFORE filtering.
  const specEntries = run.specs
    .map((spec, i) => ({spec, origin: run.origins?.[i]}))
    .filter((e) => e.spec.amount > 0);
  if (specEntries.length === 0) {
    return;
  }
  const releaseAll = (list: ReadonlyArray<{spec: ResourceTransferSpec}>) => {
    for (const e of list) {
      run.onArrive?.(e.spec);
    }
  };
  if (consoleReducedMotionActive() || typeof document === 'undefined') {
    releaseAll(specEntries);
    return;
  }
  const sourceRect = resolveSourceRect(run.source);
  if (sourceRect === undefined && !specEntries.some((e) => e.origin !== undefined)) {
    releaseAll(specEntries);
    return;
  }
  // Resolve each spec's destination NOW (the wave flies into real, settled
  // geometry); unresolvable ones release immediately and never fly.
  const flights: Array<{spec: ResourceTransferSpec, to: TransferPoint, origin: TransferPoint | undefined}> = [];
  for (const e of specEntries) {
    const to = targetPointFor(e.spec);
    if (to === undefined || (e.origin === undefined && sourceRect === undefined)) {
      run.onArrive?.(e.spec);
    } else {
      flights.push({spec: e.spec, to, origin: e.origin});
    }
  }
  if (flights.length === 0) {
    return;
  }

  runActive = true;
  resourceTransferState.nonce++;
  const entries = flights.map((f, i) => ({
    id: ++flightSeq,
    spec: f.spec,
    to: f.to,
    from: f.origin ?? run.source.point ??
      sourceSpawnPoint(sourceRect ?? {x: 0, y: 0, w: 0, h: 0}, i, flights.length),
    delayMs: motionMs(transferWaveDelayMs(i, flights.length)),
    index: i,
  }));
  resourceTransferState.flights = [...resourceTransferState.flights, ...entries.map((e) => ({id: e.id, spec: e.spec}))];
  await nextTick(); // the layer mounts the chips

  const uiScale = conUiScale();
  const waveBudget = motionMs(transferFlightBudgetMs()) +
    motionMs(transferWaveDelayMs(entries.length - 1, entries.length)) + 2200;
  let safetyFired = false;
  const safety = window.setTimeout(() => {
    // rAF stall / lost stage — release everything, never wedge the caller.
    safetyFired = true;
    entries.forEach((e) => run.onArrive?.(e.spec));
  }, waveBudget);

  // The caller resolves at the TOUCHDOWNS (never held on the absorb tail);
  // the finish chain removes each piece when its decoration fully ends.
  const touchdowns = entries.map((e) => {
    const piece = stage?.piece(e.id);
    if (piece === undefined) {
      if (!safetyFired) {
        run.onArrive?.(e.spec);
      }
      removeFlight(e.id);
      return Promise.resolve();
    }
    const handles = runTransferFlight(piece, {
      from: e.from,
      to: e.to,
      index: e.index,
      delayMs: e.delayMs,
      uiScale,
      hold: run.arrival === 'hold',
    });
    const touched = handles.touched.then(() => {
      if (!safetyFired) {
        run.onArrive?.(e.spec);
      }
      // A hold-mode chip registers as RESTING synchronously with its
      // touchdown — the caller's commit/settle (which awaits the
      // touchdowns) can never race past an unregistered landed chip.
      if (run.arrival === 'hold') {
        heldChips.push({id: e.id, at: e.to});
      }
    });
    void handles.finished.then((outcome) => {
      if (outcome !== 'landed') {
        removeFlight(e.id); // 'auto' — absorbed at the destination
      }
    });
    return touched;
  });
  await Promise.all(touchdowns);
  window.clearTimeout(safety);
  runActive = false;
}

/**
 * Finalize a `hold` run (the sale, post-commit): the landed chips are
 * absorbed into the (just updated) panel rows under one-shot halos.
 */
export async function settleResourceTransfers(): Promise<void> {
  const held = heldChips;
  heldChips = [];
  if (held.length === 0 || typeof document === 'undefined') {
    held.forEach((h) => removeFlight(h.id));
    return;
  }
  await Promise.all(held.map(async (h) => {
    const piece = stage?.piece(h.id);
    if (piece !== undefined) {
      await settleTransferChip(piece, h.at, motionMs(TRANSFER_BEAT_MS));
    }
    removeFlight(h.id);
  }));
}

/** Abort — unmount every chip with zero trace and drop the pending holds.
 *  Callers' own onArrive gates are freed by their run's safety net. */
export function abortResourceTransfers(): void {
  for (const f of resourceTransferState.flights) {
    const piece = stage?.piece(f.id);
    if (piece !== undefined) {
      killTransferPiece(piece);
    }
  }
  resourceTransferState.flights = [];
  heldChips = [];
  runActive = false;
}

function removeFlight(id: number): void {
  resourceTransferState.flights = resourceTransferState.flights.filter((f) => f.id !== id);
}

// ── anchors (measured from the REAL interface, per profile) ─────────────────

function measureRect(selector: string): TransferRect | undefined {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

function centerOf(rect: TransferRect): TransferPoint {
  return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2};
}

function resolveSourceRect(source: ResourceTransferRun['source']): TransferRect | undefined {
  if (source.point !== undefined) {
    return {x: source.point.x, y: source.point.y, w: 0, h: 0};
  }
  for (const sel of source.selectors ?? []) {
    const r = measureRect(sel);
    if (r !== undefined) {
      return r;
    }
  }
  return undefined;
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

/** The exact landing point per destination channel (the left panel / the
 *  chosen host card in the «Разыграно» table / the aux satellite). */
function targetPointFor(spec: ResourceTransferSpec): TransferPoint | undefined {
  if (spec.channel === 'stock') {
    const r = measureRect(`.con-res__row--${spec.resource} .con-res__stockwrap`) ??
      measureRect(`.con-res__row--${spec.resource}`);
    return r !== undefined ? centerOf(r) : undefined;
  }
  if (spec.channel === 'production') {
    const r = measureRect(`.con-res__row--${spec.resource} .con-res__prod`) ??
      measureRect(`.con-res__row--${spec.resource}`);
    return r !== undefined ? centerOf(r) : undefined;
  }
  // card-resource: the PRE-SELECTED host card when it's on screen (the
  // «Разыграно» table is open through the reward beat), else the
  // additional-resources satellite cell, else no flight.
  if (spec.targetCard !== undefined) {
    const r = measureRect(`.con-played [data-played-key="${escapeName(spec.targetCard)}"]`);
    if (r !== undefined) {
      return centerOf(r);
    }
  }
  const aux = measureRect(`.con-res-aux__cell[data-aux-resource="${cardResourceKey(spec.resource)}"]`);
  return aux !== undefined ? centerOf(aux) : undefined;
}
