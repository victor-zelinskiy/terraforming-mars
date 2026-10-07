/*
 * «ГОРОДА ПЛАТЯТ» — the scene of a card reward THE CELL DECIDES (Turmoil Redux
 * TR21 Arboretum; the pure half and the grammar: `cityDataPayoutModel.ts`).
 *
 * THE OWN SCENE, after the ordinary landing beats (tile → the cell's bonus →
 * water → Ares → the law's wave):
 *  1. RISE — the receiving card (its premium face, a LIVE model frozen at the
 *     payout's `before`, its resource capsule visible) rises out of the
 *     «ДОП. РЕСУРСЫ» satellite's data cell — «your cards with data» — and stands
 *     by the field, beside the greenery, covering neither it nor a paying city;
 *  2. PAY — each paying city wakes once per token it sends (the ocean's
 *     shoreline swell in the city's register), a data token condenses at its
 *     edge toward the greenery and rides the shared Resource Transfer
 *     Framework into the card's capsule; the capsule's counter ticks on each
 *     TOUCHDOWN (`cardResourceLandings`), never before;
 *  3. READ — «2 → 5» stands (the `CARDLAND_READ_MS` class);
 *  4. RETURN — the card goes home to its cell, and the cell's counter ticks
 *     there (the satellite's data hold, seeded at the commit, is released on
 *     the landing);
 *  5. what the TABLE answered (Martian Fiber's M€ — the SERVER measured it,
 *     `payout.reactions`) flies from that cell to the rail, ticking on touchdown.
 *
 * THE REMOTE SCENE (another seat's play on the viewer's board): the same wakes
 * and tokens, flying to that seat's chip in the status strip — their card never
 * rises on somebody else's screen.
 *
 * ONE named hold (`city-data-payout`, reactive, `expire` + `diagnose`), released
 * by the scene's own end — never a timer. Reduced motion: nothing flies, the
 * counters tick with the commit (the callers never seed). Nothing measurable
 * (no satellite, no hex): `degraded` (the layer's `data-city-payout-degraded`)
 * and every hold is released at once — the numbers tick, nothing flies.
 */
import {reactive, nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Units} from '@/common/Units';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  TileRect, OCEAN_PULSE_MS, OCEAN_COIN_LEAD_MS, OCEAN_COIN_FORM_MS, OCEAN_COIN_LIFT_PX, OCEAN_COIN_SPARKS,
  OCEAN_COIN_T, OCEAN_PULSE_T, OCEAN_PULSE_DRIFT, oceanEdgePoint, oceanShoreDirection, oceanWaveLeadMs,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  playOceanActivation, playOceanCoinMaterialize, playOceanCoinHandoff, killOceanTweens,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {boardStorySettling, waitConsoleQuiet} from '@/client/console/rewardPayoutQuiet';
import {registerBoardSceneMember} from '@/client/console/boardSceneMembers';
import {ResourceTransferSpec, TransferPoint, cardResourceKey, transferWaveDelayMs} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  CITY_PAYOUT_BREATH_MS, CITY_PAYOUT_READ_MS, CITY_PAYOUT_RETURN_MS, CITY_PAYOUT_RISE_MS, CITY_PAYOUT_TICK_GAP_MS,
  Rect, SELF_TOKEN_REACH, SELF_WAKE_REACH, cityPayoutPlate, cityPayoutTickAt, cityTokenPlan, directionToward, pointToward,
  sentByTheTile, tokenSpread,
} from '@/client/console/tilePlacement/cityDataPayoutModel';

export type CityPayoutPhase = 'idle' | 'waiting' | 'rising' | 'paying' | 'reading' | 'returning' | 'answering';

/** One WAKE of a paying city — one per token it sends (a stack answers twice). */
export type CityWake = {id: number, city: number, pulseAt: TransferPoint, pulseSize: number, shore: TransferPoint, drift: number};
/** One data TOKEN, condensing at its city's edge toward the greenery. */
export type CityTokenProxy = {id: number, city: number, at: TransferPoint};

export const cityPayoutState = reactive({
  phase: 'idle' as CityPayoutPhase,
  /** `own` — the card rises; `remote` — the tokens go to a seat's chip. */
  mode: undefined as 'own' | 'remote' | undefined,
  wakes: [] as Array<CityWake>,
  tokens: [] as Array<CityTokenProxy>,
  /** The receiving card on the field (own scene only): its name, its frozen model, its plate. */
  card: undefined as {name: CardName, model: CardModel | undefined, before: number, plate: Rect} | undefined,
  /** The card resource the record moves, as an icon key (`data`, `animal`) — the tokens' face and the reading's icon. */
  resource: 'data',
  /** Tokens that have TOUCHED the card's capsule — the counter reads `before + landed`. */
  landed: 0,
  /** Nothing measurable: the numbers ticked, nothing flew (a probe's witness; a reduced run is not a degrade). */
  degraded: false,
  /** The record being played (a probe reads which). */
  seq: undefined as number | undefined,
});

/** The scene is ON STAGE (a blocking presentation — prompts and surfaces wait for it). */
export function cityPayoutActive(): boolean {
  return cityPayoutState.phase !== 'idle' && cityPayoutState.phase !== 'waiting';
}

/** The scene is OWED: the landing is over, the scales are still telling their story (the feed waits, nothing else). */
export function cityPayoutWaiting(): boolean {
  return cityPayoutState.phase === 'waiting';
}

/** How long the scene waits for the scales' story before it plays anyway (bounded — a story never strands it). */
export const CITY_PAYOUT_SCALES_WAIT_MS = 6000;

/** Releases the running scene still owes (abort pays them all — a hold may never strand). */
let owed: Array<() => void> = [];

function payOwed(): void {
  const list = owed;
  owed = [];
  for (const release of list) {
    release();
  }
}

/** Bumped by abort — a scene mid-await sees the change and stops. */
let epoch = 0;

registerAnimationHoldSupplier('city-data-payout', cityPayoutActive, {
  diagnose: () => ({phase: cityPayoutState.phase, mode: cityPayoutState.mode, tokens: cityPayoutState.tokens.length, landed: cityPayoutState.landed}),
  expire: () => abortCityPayoutBeat(),
});
// While it WAITS for the scales it holds the feed only: a blocking hold here would hold the very board-beat drain
// (and the planet focus's exit) the scales' story needs — the scene waits for them, never they for it.
registerAnimationHoldSupplier('city-data-payout-pending', cityPayoutWaiting, {
  scope: 'notification-only',
  expire: () => abortCityPayoutBeat(),
});
// ON STAGE it is a piece of the board's story: an automatic workspace transition (a yielded stack's return, the
// endgame open) waits it out instead of covering the card standing by the field.
registerBoardSceneMember(cityPayoutActive);

/**
 * THE FIELD SPEAKS FIRST: the tile and the oxygen it raised are the board's own
 * beats — the scales' story (the board-beat park's drain, the planet focus's
 * exit) plays before any city answers. Bounded; resolves at once when no story
 * is owed.
 */
function waitForTheScales(myEpoch: number): Promise<void> {
  return waitConsoleQuiet(() => boardStorySettling(), {maxMs: CITY_PAYOUT_SCALES_WAIT_MS, alive: () => epoch === myEpoch});
}

// ── the stage (the layer plugs in) ──────────────────────────────────────────

export type CityPayoutStageEls = {
  wakes: ReadonlyArray<HTMLElement>,
  tokens: ReadonlyArray<HTMLElement>,
  card?: HTMLElement,
};
let stage: {els: () => CityPayoutStageEls | undefined} | undefined;

export function registerCityPayoutStage(handle: {els: () => CityPayoutStageEls | undefined}): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

// ── geometry ────────────────────────────────────────────────────────────────

function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id;
}

function measure(selector: string): Rect | undefined {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

function measureHex(spaceId: string): Rect | undefined {
  const r = measure(`.board-space[data_space_id="${escapeId(spaceId)}"]`);
  return r !== undefined && r.w > 8 && r.h > 8 ? r : undefined;
}

/**
 * A SEAT's chip in the top status strip — where another player's units go (and
 * where a remote tile departs from: the opponents live in the top HUD). An
 * unmounted strip falls back to the neutral top table edge.
 */
export function seatChipPoint(color: Color | undefined, ui: number): TransferPoint {
  if (typeof document !== 'undefined' && color !== undefined) {
    const dot = document.querySelector<HTMLElement>(`.con-status__player .player_bg_color_${color}`);
    if (dot !== null) {
      const r = dot.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) {
        return {x: r.left + r.width / 2, y: r.bottom + Math.round(16 * ui)};
      }
    }
  }
  return {x: window.innerWidth / 2, y: Math.round(72 * ui)};
}

/** The satellite's cell of a card resource — «your cards with data / animals», the receiving card's home. */
export function auxCellRect(resource: string): Rect | undefined {
  return measure(`.con-res-aux__cell[data-aux-resource="${cardResourceKey(resource)}"]`);
}

function centre(r: Rect): TransferPoint {
  return {x: r.x + r.w / 2, y: r.y + r.h / 2};
}

/** The cells that SEND the units, measured live (a neighbour, or the placed tile itself); `undefined` when one is not on screen. */
function senderRects(payout: CardAdjacencyPayoutModel): Array<Rect> | undefined {
  const out: Array<Rect> = [];
  for (const n of payout.neighbours) {
    const rect = measureHex(n.spaceId);
    if (rect === undefined) {
      return undefined;
    }
    out.push(rect);
  }
  return out;
}

/**
 * The wakes and the tokens of a payout. A NEIGHBOUR wakes at the edge it
 * shares with the placed tile and its token condenses inside it, toward the
 * tile (the ocean's anatomy); the PLACED TILE ITSELF (`sentByTheTile`) wakes
 * and condenses at its own edge toward `toward` — the card that receives the
 * units, or the seat's chip — since it has no neighbour to face. Several
 * tokens of one sender sit side by side ACROSS that edge, never one on the other.
 */
function tokenGeometry(payout: CardAdjacencyPayoutModel, senders: ReadonlyArray<Rect>, tile: TileRect, ui: number, toward: TransferPoint | undefined):
  {wakes: Array<CityWake>, tokens: Array<CityTokenProxy>} {
  const lift = Math.round(OCEAN_COIN_LIFT_PX * ui);
  const wakes: Array<CityWake> = [];
  const tokens: Array<CityTokenProxy> = [];
  for (const t of cityTokenPlan(payout)) {
    const rect = senders[t.city];
    const self = sentByTheTile(payout, t.spaceId);
    const shore = self ? directionToward(rect, toward ?? {x: rect.x + rect.w / 2, y: rect.y - rect.h}) : oceanShoreDirection(rect, tile);
    const base = self ? pointToward(rect, shore, SELF_TOKEN_REACH, lift) : oceanEdgePoint(rect, tile, OCEAN_COIN_T, lift);
    const spread = Math.round(rect.w * 0.22) * tokenSpread(t.unit, t.units);
    const perp = {x: -shore.y, y: shore.x};
    wakes.push({
      id: t.id,
      city: t.city,
      pulseAt: self ? pointToward(rect, shore, SELF_WAKE_REACH) : oceanEdgePoint(rect, tile, OCEAN_PULSE_T),
      pulseSize: Math.round(rect.w * 0.66),
      shore,
      drift: Math.round(rect.w * OCEAN_PULSE_DRIFT),
    });
    tokens.push({id: t.id, city: t.city, at: {x: base.x + perp.x * spread, y: base.y + perp.y * spread}});
  }
  return {wakes, tokens};
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A wait on the GSAP clock (the clock every proxy of the scene animates on). */
function gsapWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.delayedCall(ms / 1000, () => resolve());
  });
}

/** A GSAP tween as a promise that settles on completion AND on interruption (an abort never strands a caller). */
function tweenTo(el: HTMLElement, vars: gsap.TweenVars): Promise<void> {
  return new Promise<void>((resolve) => {
    gsap.to(el, {...vars, onComplete: () => resolve(), onInterrupt: () => resolve()});
  });
}

// ── the wakes + tokens (shared by both scenes) ─────────────────────────────

/**
 * Stage the wakes and the tokens, play them, and hand every token to the
 * Resource Transfer Framework. Resolves when the last token has TOUCHED.
 * `false` when the stage could not be lent (the caller degrades).
 */
async function payTokens(
  geometry: {wakes: Array<CityWake>, tokens: Array<CityTokenProxy>},
  tile: TileRect,
  ui: number,
  pace: number,
  specOf: (token: CityTokenProxy) => ResourceTransferSpec,
  destination: TransferPoint | undefined,
  onLanded: () => void,
  myEpoch: number,
): Promise<boolean> {
  cityPayoutState.wakes = geometry.wakes;
  cityPayoutState.tokens = geometry.tokens;
  await nextTick(); // the layer mounts the wakes + tokens
  const els = stage?.els();
  if (epoch !== myEpoch || els === undefined ||
      els.wakes.length !== geometry.wakes.length || els.tokens.length !== geometry.tokens.length) {
    return false;
  }
  // ONE CADENCE: the framework's own wave stagger over the TOKENS, so each
  // token finishes forming as its flight is born on it; each wake rides its
  // own token's delay — a stack's city answers twice, one beat apart.
  const delays = geometry.tokens.map((_, i) => Math.round(motionMs(transferWaveDelayMs(i, geometry.tokens.length)) * pace));
  playOceanActivation(els.wakes, {
    delays,
    shores: geometry.wakes.map((w) => w.shore),
    drifts: geometry.wakes.map((w) => w.drift),
    pulseMs: motionMs(OCEAN_PULSE_MS),
  });
  playOceanCoinMaterialize(els.tokens, {
    delays,
    leadMs: motionMs(OCEAN_COIN_LEAD_MS),
    formMs: motionMs(OCEAN_COIN_FORM_MS),
    sparks: OCEAN_COIN_SPARKS,
  });
  // The lead is waited on the GSAP clock — the one the tokens FORM on. A wall-clock wait drifts ahead of it on a
  // starved renderer (GSAP's lag smoothing slows its own time), and the handoff then dissolved a token that had
  // not formed yet: measured on the opponent's 4K screen, 1 run in 4 — a token flew with no source ever painted.
  await gsapWait(motionMs(oceanWaveLeadMs()));
  if (epoch !== myEpoch) {
    return false;
  }
  playOceanCoinHandoff(els.tokens, {delays, uiScale: ui});
  await runResourceTransfers({
    specs: geometry.tokens.map(specOf),
    origins: geometry.tokens.map((t) => t.at),
    source: {point: centre(tile)},
    arrival: 'auto',
    pace,
    fromBoard: true,
    ...(destination !== undefined ? {destination} : {}),
    onArrive: () => {
      if (epoch === myEpoch) {
        onLanded();
      }
    },
  });
  cityPayoutState.wakes = [];
  cityPayoutState.tokens = [];
  return true;
}

// ── THE OWN SCENE ───────────────────────────────────────────────────────────

export type OwnCityPayoutOpts = {
  /** The SERVER's record of this placement's payout (claimed by the caller). */
  payout: CardAdjacencyPayoutModel,
  /** The placed hex. */
  tileRect: TileRect,
  /** The receiving card's committed model (its face; the count is frozen at `payout.before`). */
  cardModel: CardModel | undefined,
  uiScale: number,
  pace: number,
  alive: () => boolean,
  /** Release the satellite's data hold — called EXACTLY once (the card's landing home, or a degrade). */
  releaseCard: () => void,
  /** Release ONE reaction's stock hold (each at its own touchdown, or at a degrade). */
  releaseReaction: (spec: ResourceTransferSpec) => void,
  /**
   * The points each unit brings its card (`cityPayoutVpSteps`) and their release: the rail's VP cell keeps them
   * back and ticks on the touchdown that crosses a point; whatever is still held at a degrade / an abort is released.
   */
  vpSteps?: ReadonlyArray<number>,
  releaseVp?: (points: number) => void,
};

/** The reactions of a record as stock specs (what the table paid, the server's measure). */
export function cityPayoutReactionSpecs(payout: CardAdjacencyPayoutModel): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  for (const [resource, amount] of Object.entries(payout.reactions ?? {}) as Array<[keyof Units, number]>) {
    if (amount > 0) {
      out.push({channel: 'stock', resource, amount});
    }
  }
  return out;
}

/**
 * Play it. Never rejects; degrades honestly (every hold released, the numbers
 * tick, `degraded` raised) whenever something it must see is not there.
 */
export async function runCityPayoutBeat(opts: OwnCityPayoutOpts): Promise<void> {
  const myEpoch = ++epoch;
  const reactions = cityPayoutReactionSpecs(opts.payout);
  let cardReleased = false;
  const releaseCard = () => {
    if (!cardReleased) {
      cardReleased = true;
      opts.releaseCard();
    }
  };
  const pendingReactions = new Set(reactions);
  const releaseReaction = (spec: ResourceTransferSpec) => {
    if (pendingReactions.delete(spec)) {
      opts.releaseReaction(spec);
    }
  };
  // The points the units bring: released on the touchdown that crosses them, the rest at any way out.
  const vpSteps = [...(opts.vpSteps ?? [])];
  const releaseVpThrough = (landed: number) => {
    let points = 0;
    for (let k = 0; k < Math.min(landed, vpSteps.length); k++) {
      points += vpSteps[k];
      vpSteps[k] = 0;
    }
    if (points !== 0) {
      opts.releaseVp?.(points);
    }
  };
  const releaseAll = () => {
    releaseVpThrough(vpSteps.length);
    releaseCard();
    for (const spec of [...pendingReactions]) {
      releaseReaction(spec);
    }
  };
  owed = [releaseAll];
  const end = () => {
    if (epoch === myEpoch) {
      cityPayoutState.phase = 'idle';
      cityPayoutState.mode = undefined;
      cityPayoutState.wakes = [];
      cityPayoutState.tokens = [];
      cityPayoutState.card = undefined;
      cityPayoutState.seq = undefined;
      payOwed();
    }
  };
  const degrade = () => {
    cityPayoutState.degraded = true;
    end();
  };
  cityPayoutState.degraded = false;
  cityPayoutState.landed = 0;
  cityPayoutState.seq = opts.payout.seq;
  cityPayoutState.resource = cardResourceKey(opts.payout.resource);
  if (typeof document === 'undefined') {
    end();
    return;
  }
  cityPayoutState.mode = 'own';
  cityPayoutState.phase = 'waiting';
  await waitForTheScales(myEpoch);
  if (epoch !== myEpoch) {
    return;
  }
  cityPayoutState.phase = 'rising';
  await wait(motionMs(CITY_PAYOUT_BREATH_MS));
  if (epoch !== myEpoch || !opts.alive()) {
    end();
    return;
  }
  const home = auxCellRect(opts.payout.resource);
  const senders = senderRects(opts.payout);
  if (home === undefined || senders === undefined) {
    degrade();
    return;
  }

  // 1. RISE — mount the card invisible, measure its box, stand it by the field.
  cityPayoutState.card = {name: opts.payout.target, model: opts.cardModel, before: opts.payout.before, plate: {x: 0, y: 0, w: 0, h: 0}};
  await nextTick();
  const cardEl = stage?.els()?.card;
  if (epoch !== myEpoch || cardEl === undefined) {
    degrade();
    return;
  }
  const box = cardEl.getBoundingClientRect();
  if (box.width < 4 || box.height < 4) {
    degrade();
    return;
  }
  const board = measure('.con-board') ?? measure('.board-cont') ?? {x: 0, y: 0, w: window.innerWidth, h: window.innerHeight};
  // The card's place on the field includes its reading under it («2 → 6») — neither may cover the tile or a payer.
  const read = cardEl.querySelector('[data-city-payout-read]')?.getBoundingClientRect();
  const height = read !== undefined && read.height > 0 ? Math.max(box.height, read.bottom - box.top) : box.height;
  const plate = cityPayoutPlate(opts.tileRect, senders, {w: box.width, h: height}, board, Math.round(14 * opts.uiScale));
  // The tokens are placed once the card's stand is known: a tile that pays its own card sends them out by the edge facing it.
  const geometry = tokenGeometry(opts.payout, senders, opts.tileRect, opts.uiScale, centre(plate));
  cityPayoutState.card = {...cityPayoutState.card, plate};
  await nextTick(); // the plate's own left/top are in the DOM
  if (epoch !== myEpoch) {
    end();
    return;
  }
  const fromScale = Math.max(0.12, Math.min(home.w / plate.w, home.h / plate.h));
  const fromX = centre(home).x - centre(plate).x;
  const fromY = centre(home).y - centre(plate).y;
  // The card COMES OUT of its cell: its first painted frame is the cell's own box, at full opacity — the source
  // is seen before anything moves; only then does it grow toward the field.
  gsap.set(cardEl, {x: fromX, y: fromY, scale: fromScale, autoAlpha: 1, transformOrigin: '50% 50%'});
  await tweenTo(cardEl, {x: 0, y: 0, scale: 1, duration: motionMs(CITY_PAYOUT_RISE_MS) / 1000, ease: 'power2.inOut'});
  if (epoch !== myEpoch || !opts.alive()) {
    end();
    return;
  }

  // 2. PAY — every token born at its own city, landing in the capsule; each touchdown is its own tick.
  cityPayoutState.phase = 'paying';
  const tickGap = motionMs(CITY_PAYOUT_TICK_GAP_MS);
  let lastTick = -Infinity;
  let ticks: Promise<unknown> = Promise.resolve();
  const tick = () => {
    if (epoch === myEpoch) {
      cityPayoutState.landed = Math.min(opts.payout.amount, cityPayoutState.landed + 1);
      releaseVpThrough(cityPayoutState.landed);
    }
  };
  const paid = await payTokens(geometry, opts.tileRect, opts.uiScale, opts.pace,
    () => ({channel: 'card-resource', resource: cardResourceKey(opts.payout.resource), amount: 1, targetCard: opts.payout.target}),
    undefined,
    () => {
      const now = performance.now();
      lastTick = cityPayoutTickAt(now, lastTick, tickGap);
      if (lastTick <= now) {
        tick();
      } else {
        ticks = Promise.all([ticks, wait(lastTick - now).then(tick)]);
      }
    },
    myEpoch);
  await ticks;
  if (!paid) {
    if (epoch === myEpoch) {
      degrade();
    }
    return;
  }
  cityPayoutState.landed = opts.payout.amount;
  releaseVpThrough(opts.payout.amount);

  // 3. READ — «before → after» stands.
  cityPayoutState.phase = 'reading';
  await wait(motionMs(CITY_PAYOUT_READ_MS));
  if (epoch !== myEpoch) {
    return;
  }

  // 4. RETURN — the card goes home, and the satellite's counter ticks on its landing.
  cityPayoutState.phase = 'returning';
  // …and it goes back INTO it: it lands on the cell's box, and only there leaves the screen.
  await tweenTo(cardEl, {x: fromX, y: fromY, scale: fromScale, duration: motionMs(CITY_PAYOUT_RETURN_MS) / 1000, ease: 'power2.in'});
  gsap.set(cardEl, {autoAlpha: 0});
  releaseCard();
  if (epoch !== myEpoch) {
    return;
  }
  cityPayoutState.card = undefined;

  // 5. What the TABLE answered — from the cell the card went home to, to the rail.
  if (reactions.length > 0) {
    cityPayoutState.phase = 'answering';
    await runResourceTransfers({
      specs: reactions,
      source: {point: centre(home)},
      arrival: 'auto',
      onArrive: (spec) => releaseReaction(spec),
    });
  }
  end();
}

// ── THE REMOTE SCENE ────────────────────────────────────────────────────────

export type RemoteCityPayoutOpts = {
  payout: CardAdjacencyPayoutModel,
  tileRect: TileRect,
  uiScale: number,
  /** Where the tokens land: the paid seat's chip in the status strip (an opponent),
   *  or `undefined` for the viewer's own satellite cell (a parked pin landing on the remote stage). */
  destination: TransferPoint | undefined,
  /** The viewer's own holds, when the payout is theirs (released per token / at a degrade). */
  release?: () => void,
};

export async function runRemoteCityPayoutBeat(opts: RemoteCityPayoutOpts): Promise<void> {
  const myEpoch = ++epoch;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      opts.release?.();
    }
  };
  owed = [release];
  const end = () => {
    if (epoch === myEpoch) {
      cityPayoutState.phase = 'idle';
      cityPayoutState.mode = undefined;
      cityPayoutState.wakes = [];
      cityPayoutState.tokens = [];
      cityPayoutState.seq = undefined;
      payOwed();
    }
  };
  cityPayoutState.degraded = false;
  cityPayoutState.seq = opts.payout.seq;
  cityPayoutState.resource = cardResourceKey(opts.payout.resource);
  if (typeof document === 'undefined') {
    end();
    return;
  }
  cityPayoutState.mode = 'remote';
  cityPayoutState.phase = 'waiting';
  await waitForTheScales(myEpoch);
  if (epoch !== myEpoch) {
    return;
  }
  cityPayoutState.phase = 'paying';
  await wait(motionMs(CITY_PAYOUT_BREATH_MS));
  const senders = epoch === myEpoch ? senderRects(opts.payout) : undefined;
  // Where the units are going: the seat's chip, or — the viewer's own payout — their satellite cell.
  const home = opts.destination === undefined ? auxCellRect(opts.payout.resource) : undefined;
  const toward = opts.destination ?? (home !== undefined ? centre(home) : undefined);
  const geometry = senders !== undefined ? tokenGeometry(opts.payout, senders, opts.tileRect, opts.uiScale, toward) : undefined;
  if (geometry === undefined) {
    if (epoch === myEpoch) {
      cityPayoutState.degraded = true;
    }
    end();
    return;
  }
  const resource = cardResourceKey(opts.payout.resource);
  const paid = await payTokens(geometry, opts.tileRect, opts.uiScale, 1,
    () => ({channel: 'card-resource', resource, amount: 1}),
    opts.destination,
    () => undefined,
    myEpoch);
  if (!paid && epoch === myEpoch) {
    cityPayoutState.degraded = true;
  }
  end();
}

/**
 * SEVERAL CARDS PAID BY ONE TILE play IN TURN, in the engine's order — one
 * stage, one record at a time (the own card rising and going home, then the
 * next). An abort stops the sequence, and what the records not played yet owe
 * is released at once (`release`) — a hold never strands.
 */
export async function runCityPayoutSequence(steps: ReadonlyArray<{play: () => Promise<void>, release: () => void}>): Promise<void> {
  const before = aborts;
  for (let i = 0; i < steps.length; i++) {
    if (aborts !== before) {
      steps.slice(i).forEach((step) => step.release());
      return;
    }
    await steps[i].play();
  }
}

/** How many times the scene was aborted — a sequence of records reads it to stop with the scene (and pay the rest). */
let aborts = 0;
export function cityPayoutAbortCount(): number {
  return aborts;
}

/** Abort / unmount: stop every tween, pay every owed release, drop the stage (idempotent). */
export function abortCityPayoutBeat(): void {
  epoch++;
  aborts++;
  const els = stage?.els();
  if (els !== undefined) {
    killOceanTweens([...els.wakes, ...els.tokens]);
    if (els.card !== undefined) {
      gsap.killTweensOf(els.card);
    }
  }
  cityPayoutState.phase = 'idle';
  cityPayoutState.mode = undefined;
  cityPayoutState.wakes = [];
  cityPayoutState.tokens = [];
  cityPayoutState.card = undefined;
  cityPayoutState.seq = undefined;
  payOwed();
}
