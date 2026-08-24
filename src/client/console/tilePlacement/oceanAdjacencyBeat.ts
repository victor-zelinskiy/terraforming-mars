/*
 * THE OCEAN-ADJACENCY BEAT — "I built next to water, so THAT water paid me".
 *
 * ONE implementation, TWO callers. The server grants the M€ and names WHICH
 * neighbours paid (`thisPlayer.lastOceanBonus`) for every placement that runs
 * through `Game.grantPlacementBonuses` — and that includes the placements
 * where NO TILE lands: Mars Nomads moving its camp collects the destination's
 * placement bonus «as if placing a special tile there», ocean adjacency
 * included. So the beat cannot live inside the tile-placement transaction:
 * the camp hop is the same physical statement about the same water, and it
 * must be the SAME animation, never a second dialect of it.
 *
 * (What is NOT here is equally load-bearing: Ares adjacency, Turmoil
 * placement bonuses and the Arcadian M€ are gated on `space.tile !== undefined`
 * server-side, so a camp move earns none of them — the card's own published
 * ruling. A scene that flew them would be lying about money.)
 *
 * Anatomy per paying ocean: the shoreline it shares with the placement WAKES
 * (a local swell that drifts to the shore under an opening ring), an M€ coin
 * CONDENSES out of that light just inside the water, and the coin is handed
 * to the shared Resource Transfer Framework — same arc, same halo, same
 * touchdown as every other reward in the game. One ocean → one coin, always.
 *
 * The DELTA CHIP is deliberately AGGREGATED by the CALLER: the panel hold
 * covers the whole payout and is released ONCE, when the last coin lands, so
 * the counter announces «+2/+4/+6 M€» once — the individual sources are told
 * by the coins themselves.
 *
 * Ownership: the staging state + this choreography live here; the DOM is the
 * board payout stage (`ConsoleTilePlacementLayer`, which registers its ocean
 * pieces through `registerOceanBeatStage`); the tweens are the shared
 * tilePlacementDirector.
 */

import {reactive, nextTick} from 'vue';
import {OceanAdjacencyBonusModel} from '@/common/models/OceanAdjacencyBonusModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  TileRect,
  OCEAN_PULSE_MS, OCEAN_COIN_LEAD_MS, OCEAN_COIN_FORM_MS, OCEAN_BEAT_BREATH_MS,
  OCEAN_COIN_LIFT_PX, OCEAN_COIN_SPARKS, OCEAN_COIN_T, OCEAN_PULSE_T, OCEAN_PULSE_DRIFT,
  oceanEdgePoint, oceanShoreDirection, oceanTransferSpecs, oceanWaveLeadMs,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  playOceanActivation, playOceanCoinMaterialize, playOceanCoinHandoff, killOceanTweens,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {TransferPoint, transferWaveDelayMs} from '@/client/console/resourceTransfer/resourceTransferModel';

/**
 * ONE paying ocean, ready to be staged: where its water wakes, where its coin
 * condenses, and which way the shore faces. All viewport-space (measured live
 * from the real hexes), so board zoom / TV scale need no compensation.
 */
export type OceanCoinProxy = {
  id: number,
  /** The M€ this single ocean pays (the numeral struck on its coin). */
  amount: number,
  /** The coin's birth point — just inside the water, lifted off the surface. */
  at: TransferPoint,
  /** The activation pulse's centre — nearer the shared shore. */
  pulseAt: TransferPoint,
  /** The pulse's box size (proportional to the ocean hex, never fixed px). */
  pulseSize: number,
  /** Unit vector ocean → placement (the light drifts along it). */
  shore: TransferPoint,
  /** How far back into the water the pulse's light starts, in px. */
  drift: number,
};

/** The staged coins the payout stage renders (empty = the beat is not up). */
export const oceanBeatState = reactive({
  coins: [] as Array<OceanCoinProxy>,
});

export function isOceanBeatStaged(): boolean {
  return oceanBeatState.coins.length > 0;
}

/** The DOM the payout stage lends this beat, index-aligned with `coins`. */
export type OceanStageEls = {
  pulses: ReadonlyArray<HTMLElement>,
  coins: ReadonlyArray<HTMLElement>,
};

let stage: {els: () => OceanStageEls | undefined} | undefined;

export function registerOceanBeatStage(handle: {els: () => OceanStageEls | undefined}): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

export type OceanBeatOpts = {
  /** The SERVER's own breakdown for THIS placement (already matched to it). */
  bonus: OceanAdjacencyBonusModel,
  /** The live rect of the hex that was placed on / moved onto. */
  tileRect: TileRect,
  uiScale: number,
  /** Is the CALLING transaction still alive? (an abort must strand nothing). */
  alive: () => boolean,
  /** Release the aggregated panel hold — called EXACTLY once, however the
   *  beat ends (all coins landed, degraded, aborted). */
  release: () => void,
};

/**
 * Play it. Degrades honestly at every step (no stage, unmeasurable hexes, an
 * rAF stall): the hold is released and the reward is announced by its delta
 * chip alone. Never rejects.
 */
export async function runOceanAdjacencyBeat(opts: OceanBeatOpts): Promise<void> {
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      opts.release();
    }
  };
  if (typeof document === 'undefined') {
    release();
    return;
  }
  const coins = buildOceanCoins(opts.bonus, opts.tileRect, opts.uiScale);
  if (coins.length === 0) {
    release();
    return;
  }

  // One calm breath after the cause (the tile — or the camp — has settled),
  // then the water responds.
  await wait(motionMs(OCEAN_BEAT_BREATH_MS));
  if (!opts.alive()) {
    release();
    return;
  }
  oceanBeatState.coins = coins;
  await nextTick(); // the stage mounts the pulses + coins
  const els = stage?.els();
  if (!opts.alive() || els === undefined ||
      els.coins.length !== coins.length || els.pulses.length !== coins.length) {
    oceanBeatState.coins = [];
    release();
    return;
  }

  // The cascade uses the framework's OWN per-index wave stagger, so each coin
  // finishes forming exactly as its chip is born on it — for any ocean count,
  // and compressing automatically when several oceans pay at once.
  const delays = coins.map((_, i) => motionMs(transferWaveDelayMs(i, coins.length)));
  playOceanActivation(els.pulses, {
    delays,
    shores: coins.map((c) => c.shore),
    drifts: coins.map((c) => c.drift),
    pulseMs: motionMs(OCEAN_PULSE_MS),
  });
  playOceanCoinMaterialize(els.coins, {
    delays,
    leadMs: motionMs(OCEAN_COIN_LEAD_MS),
    formMs: motionMs(OCEAN_COIN_FORM_MS),
    sparks: OCEAN_COIN_SPARKS,
  });
  await wait(motionMs(oceanWaveLeadMs()));
  if (!opts.alive()) {
    oceanBeatState.coins = [];
    release();
    return;
  }
  playOceanCoinHandoff(els.coins, {delays, uiScale: opts.uiScale});

  let arrived = 0;
  await runResourceTransfers({
    specs: oceanTransferSpecs(coins.length, opts.bonus.perOcean),
    origins: coins.map((c) => c.at),
    source: {point: {x: opts.tileRect.x + opts.tileRect.w / 2, y: opts.tileRect.y + opts.tileRect.h / 2}},
    arrival: 'auto',
    // ONE aggregated release, only once EVERY coin of this bonus has landed.
    // (`onArrive` can legitimately fire more than once per spec — the wave's
    // safety net re-releases everything — hence the guard inside `release`.)
    onArrive: () => {
      arrived++;
      if (arrived >= coins.length) {
        release();
      }
    },
  });
  release(); // no-op when the arrivals already did it
  oceanBeatState.coins = [];
}

/** Abort/unmount: drop the staged coins and kill their tweens (idempotent). */
export function abortOceanBeat(): void {
  const els = stage?.els();
  if (els !== undefined) {
    killOceanTweens([...els.pulses, ...els.coins]);
  }
  oceanBeatState.coins = [];
}

/**
 * Measure the paying oceans and derive each coin's staging geometry. Oceans
 * whose hex isn't on screen (an off-grid slot, a mid-scroll measurement) are
 * skipped — their share still rides the aggregated delta chip, so the money is
 * never misreported, only its source is not illustrated.
 */
export function buildOceanCoins(
  bonus: OceanAdjacencyBonusModel,
  tileRect: TileRect,
  uiScale: number,
): Array<OceanCoinProxy> {
  const lift = Math.round(OCEAN_COIN_LIFT_PX * uiScale);
  const out: Array<OceanCoinProxy> = [];
  bonus.oceanSpaceIds.forEach((id, i) => {
    const rect = measureHex(id);
    if (rect === undefined) {
      return;
    }
    out.push({
      id: i,
      amount: bonus.perOcean,
      at: oceanEdgePoint(rect, tileRect, OCEAN_COIN_T, lift),
      pulseAt: oceanEdgePoint(rect, tileRect, OCEAN_PULSE_T),
      pulseSize: Math.round(rect.w * 0.66),
      shore: oceanShoreDirection(rect, tileRect),
      drift: Math.round(rect.w * OCEAN_PULSE_DRIFT),
    });
  });
  return out;
}

/**
 * The SERVER's breakdown, accepted only when it names the space THIS
 * transaction acted on and actually paid — a stale snapshot from an earlier
 * input (or the second tile of a two-tile card) can never mis-attribute a
 * payout. Both callers ask this one question.
 */
export function oceanBonusFor(
  bonus: OceanAdjacencyBonusModel | undefined,
  spaceId: string,
): OceanAdjacencyBonusModel | undefined {
  return bonus !== undefined && bonus.spaceId === spaceId &&
    bonus.megacredits > 0 && bonus.oceanSpaceIds.length > 0 ? bonus : undefined;
}

/** The live rect of a board hex (post pan/zoom truth). A local twin of the
 *  placement scene's measurer on purpose: this module is shared BY that
 *  transaction and by the nomad move, so it may import neither. */
function measureHex(spaceId: string): TileRect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(spaceId) : spaceId;
  const el = document.querySelector<HTMLElement>(`.board-space[data_space_id="${esc}"]`);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 8 && r.height > 8 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
