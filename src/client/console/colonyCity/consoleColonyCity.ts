/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A CITY LANDS ON A COLONY TILE — the CONTROLLER (reactive state, the two
 * tempos, the hold, the seat's presented reading). Turmoil Redux TR22 Nova
 * City; contract: docs/TURMOIL_REDUX_NOVA_CITY.md.
 *
 * TWO TEMPOS, ONE OWNER EACH — the colony roster's law, word for word:
 *
 *  · THE PLAYER'S OWN FLOW is a client-ARMED transport gate (the colony
 *    build's shape): `armColonyCity` at A (BEFORE the POST) →
 *    `detectColonyCity` on the answer (the armed colony tile must have received
 *    EXACTLY the declared tile of the viewer's colour — or the arm is dropped
 *    and the view applies as it is) → `runColonyCity` with the COMMIT HELD
 *    (`transportHolds.colonyCity`). The gate opens AT THE FRAME OF CONTACT: the
 *    commit applies under the proxy, so every counter a trigger moves (Pets'
 *    animal, Tharsis's 3 M€) ticks AFTER the touch by itself — no panel hold is
 *    raised for them. The rest of the scene (the settle, the cube, the read)
 *    plays past the gate under the scene's own hold.
 *
 *  · A WATCHER (a rival's city; the player's own PARKED tail landing later) is
 *    SEEDED from the views' diff in the apply block (`seedColonyCityHolds`) —
 *    ONLY while a measurable seat of that colony tile stands on screen. With no
 *    seat nothing plays and nothing is held: the city simply stands the next
 *    time the colonies are opened.
 *
 * THE SEAT'S PRESENTATION IS ONE READING (`colonyCitySeatView`): what the seat
 * of a colony tile shows right now — nothing, the projection, the waiting
 * contour, the tile, the tile with its cube. The tile, the stage and the
 * dossier all read it, so they cannot disagree, and the real tile is never
 * painted before the contact.
 *
 * THE HOLD IS NAMED, REACTIVE AND BOUNDED: supplier `colony-city`, released by
 * the scene's own end (a beat's end fires on completion AND on interruption),
 * with an owner recovery (`expire`) and a diagnosis. A during the scene
 * «presses it through» (`hurryColonyCity`). A seat that cannot be measured is
 * CONFESSED (`degraded` → `data-colony-city-degraded`): final poses, the hold
 * and the gate released.
 */
import {nextTick, reactive} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel, ColonyTileOnTileModel} from '@/common/models/ColonyModel';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {probeTick} from '@/client/console/probeTick';
import {
  CITY_PRESS_MS, CITY_REDUCED_MS, ColonyCityArm, ColonyCityBeat, ColonyCityLanding, ColonyCityProfile, OWN_CITY_PROFILE,
  WATCHER_CITY_PROFILE, armedLandingOf, colonyCityLandings, colonyCityTimeline, landingSignature,
} from '@/client/console/colonyCity/colonyCityModel';
import {
  CityMotionHandle, CityRect, ColonyCityStageEls, killColonyCityTweens, placeCityProxy, playCityLanding, playCityMaterialize,
  settleCityProxy,
} from '@/client/console/colonyCity/colonyCityDirector';
import {
  ColonyBuildStageEls, disposeCubeProxy, killColonyBuildTweens, placeCubeProxy, playCubeApproach, playCubeDescent,
} from '@/client/console/colonyBuild/colonyBuildDirector';

/** What the seat of ONE colony tile shows. */
export type ColonyCitySeatPose = 'empty' | 'projected' | 'waiting' | 'seated';

export type ColonyCitySeatView = {
  pose: ColonyCitySeatPose;
  /** The owner's colour (the projection's, the waiting seat's or the seated tile's). */
  color?: Color;
  /** The seated tile's card (the name the dossier's fact line prints). */
  card?: CardName;
  /** The owner's cube stands on the tile (false while the cube's own proxy is still in the air). */
  cube: boolean;
};

/** A seat's presentation hold: `tile` — the landed tile is not shown yet; `cube` — the tile is, its cube is not. */
type SeatHold = 'tile' | 'cube';

/** How many measurement ticks the proxy waits for its seat to paint the real tile (bounded — then it confesses). */
const SEAT_PAINT_TICKS = 12;

/** What the grid states once the stage has folded home — the receipt of a finished landing. */
export type ColonyCityReceipt = {colony: ColonyName, card?: CardName};

export const colonyCityState = reactive({
  /** OWN FLOW: the confirmed landing, awaiting its answer. */
  armed: undefined as ColonyCityArm | undefined,
  /** A scene is on screen — the pad is its own, the hold stands. */
  live: false,
  /** Which beat is playing ('' between them). */
  beat: '' as '' | ColonyCityBeat,
  /** Where it plays: the tile's stage (the player's own flow) or the seat of a tile / a dossier (a watcher). */
  scale: 'stage' as 'stage' | 'tile',
  /** The landing being played — what the layer's proxy wears. */
  landing: undefined as ColonyCityLanding | undefined,
  /** The measured seat the proxy lands on, and its cube's resting box (real px) — the layer mounts from them. */
  seatRect: undefined as CityRect | undefined,
  cubeRect: undefined as CityRect | undefined,
  /** The cube's proxy is on stage (mounted for the cube beat only). */
  cubeOn: false,
  /** Per colony tile: what its seat still withholds (see `SeatHold`). */
  holds: {} as Record<string, SeatHold>,
  /** The seat that ANSWERS the contact — one shot, cleared by the seat's own `animationend`. */
  landed: '' as ColonyName | '',
  /** The seat whose tile takes the cube's «press» — one shot. */
  pressed: '' as ColonyName | '',
  /** OWN FLOW: the cube has touched down — the stage's count flips, the VP line lights. */
  counted: false,
  /** OWN FLOW, after the scene: what the grid states while it stands as a receipt (no cursor, no verbs). */
  receipt: undefined as ColonyCityReceipt | undefined,
  /** OWN FLOW: the shell's HOMING beat — the stage folds home, the receipt is read (input: none). */
  homing: false,
  /** Why the last scene could not be flown ('' = it flew). CONFESSED on the section root. */
  degraded: '',
});

// ── the stage registry (the layer plugs in) ─────────────────────────────────

export type ColonyCityStageHandle = {
  /** The tile proxy's parts and the seat shadow — `undefined` while the layer has not mounted them. */
  els: () => ColonyCityStageEls | undefined,
  /** The cube proxy's parts (the colony build's own anatomy) — `undefined` until the cube is on stage. */
  cube: () => ColonyBuildStageEls | undefined,
};

let stage: ColonyCityStageHandle | undefined;

export function registerColonyCityStage(handle: ColonyCityStageHandle | undefined): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

let handle: CityMotionHandle | undefined;
/** The transport's commit gate (resolved at the frame of contact; an abort must always free it). */
let gateResolve: (() => void) | undefined;
/** The whole scene (through the read) — what the shell's HOMING beat awaits. */
let sceneResolve: (() => void) | undefined;
let scenePromise: Promise<void> | undefined;
let safety: number | undefined;
/** The landing the player's OWN gate just played — the apply block that follows it must not seed it again. */
let ownPlayed: string | undefined;
/** «Дожать» was pressed: every remaining beat of this scene ends at once. */
let hurried = false;

registerAnimationHoldSupplier('colony-city', () => colonyCityState.live, {
  diagnose: () => ({
    beat: colonyCityState.beat,
    scale: colonyCityState.scale,
    colony: colonyCityState.landing?.colony,
    armed: colonyCityState.armed?.colony,
    degraded: colonyCityState.degraded,
  }),
  expire: () => abortColonyCity('expired'),
});

// ── predicates ──────────────────────────────────────────────────────────────

/**
 * THE PLAYER'S OWN scene is on stage (the gate's — it plays at the stage's scale). A WATCHER's landing is not this:
 * it touches one seat of a grid the player is merely looking at, and nothing else on that screen may react to it —
 * no locked pad, no silent bar, no status line taken away («only what is touched answers»).
 */
export function colonyCityOwnSceneLive(): boolean {
  return colonyCityState.live && colonyCityState.scale === 'stage';
}

/** The pad is the scene's: every verb is `none` (A hurries it through). The player's own flow only. */
export function isColonyCityInputLocked(): boolean {
  return colonyCityOwnSceneLive() || colonyCityState.homing;
}

/** A landing is confirmed and its answer has not finished playing (the stage is pinned). */
export function colonyCityPending(): boolean {
  return colonyCityState.armed !== undefined || colonyCityOwnSceneLive();
}

/** The player's own landing is confirmed, playing, or being read as a receipt — the door's prompt is ANSWERED. */
export function colonyCityAnswered(): boolean {
  return colonyCityState.armed !== undefined || colonyCityOwnSceneLive() || colonyCityState.receipt !== undefined || colonyCityState.homing;
}

/** The shell's HOMING beat (the stage folding home, the receipt's read) — the pad stays the scene's through it. */
export function setColonyCityHoming(on: boolean): void {
  colonyCityState.homing = on;
}

/** The scene's end as a promise (resolved at once when none is playing) — the HOMING beat waits for it. */
export function colonyCitySceneDone(): Promise<void> {
  return scenePromise ?? Promise.resolve();
}

// ── THE SEAT'S PRESENTATION — one reading for the tile, the stage, the dossier ──

/**
 * What the seat of `colony` shows right now. `projection` is the colour of the
 * city a standing «city» door would place (undefined = no door / not a
 * candidate); it is ignored once the door is answered.
 */
export function colonyCitySeatView(colony: Pick<ColonyModel, 'name' | 'tiles'>, projection: Color | undefined): ColonyCitySeatView {
  const tile: ColonyTileOnTileModel | undefined = colony.tiles?.[0];
  const hold = colonyCityState.holds[colony.name];
  if (tile !== undefined && hold !== 'tile') {
    const view: ColonyCitySeatView = {pose: 'seated', color: tile.color, cube: hold !== 'cube'};
    if (tile.card !== undefined) {
      view.card = tile.card;
    }
    return view;
  }
  // The landed tile is withheld (a watcher's scene before its contact), or the player's own landing is on the wire /
  // in the air: the seat WAITS — the contour of a place that is about to be taken.
  const landing = colonyCityState.landing;
  if (hold === 'tile' && tile !== undefined) {
    return {pose: 'waiting', color: tile.color, cube: false};
  }
  if (colonyCityState.armed?.colony === colony.name) {
    return {pose: 'waiting', color: colonyCityState.armed.color, cube: false};
  }
  if (colonyCityState.live && landing?.colony === colony.name) {
    return {pose: 'waiting', color: landing.tile.color, cube: false};
  }
  if (projection !== undefined && !colonyCityAnswered()) {
    return {pose: 'projected', color: projection, cube: false};
  }
  return {pose: 'empty', cube: false};
}

// ── element resolution — the seat as the DOM publishes it ───────────────────

function quoted(name: string): string {
  return name.replace(/["\\]/g, '\\$&');
}

/** A real, PAINTED box: laid out, not `visibility: hidden` (a parked browse layer hides its tiles that way). */
function standing(el: HTMLElement | null): el is HTMLElement {
  if (el === null || !el.isConnected) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) {
    return false;
  }
  return typeof getComputedStyle !== 'function' || getComputedStyle(el).visibility !== 'hidden';
}

/**
 * THE SEAT of a colony tile, by a measured ladder: the focus stage's, then the
 * dossier's, then the grid tile's — the first with a real, painted box (the
 * parked grid under a stage publishes the same anchor and is geometrically
 * wrong). `stageOnly`: the player's own flow lands on the stage or not at all.
 */
function seatEl(colony: string, stageOnly: boolean): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const anchor = `[data-colony-city-seat="${quoted(colony)}"]`;
  const ladder = stageOnly ?
    [`.con-colfocus ${anchor}`] :
    [`.con-colfocus ${anchor}`, `.con-colinspect ${anchor}`, `.con-colonies__grid ${anchor}`];
  for (const selector of ladder) {
    const el = document.querySelector<HTMLElement>(selector);
    if (standing(el)) {
      return el;
    }
  }
  return null;
}

function rectOf(el: HTMLElement): CityRect {
  const r = el.getBoundingClientRect();
  return {x: r.left, y: r.top, w: r.width, h: r.height};
}

/** Is a measurable seat of `colony` on screen right now? — the watcher's licence to play (and to hold). */
export function colonyCitySeatStands(colony: string): boolean {
  return seatEl(colony, false) !== null;
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** One measurement tick: the next painted frame, or the fallback — never rAF alone (a quiet screen has no frames). */
function tick(): Promise<void> {
  return new Promise<void>((resolve) => probeTick(() => resolve()));
}

/** A beat as a promise: resolved by the handle's end — natural, hurried or killed. A hurried scene ends each beat at once. */
function beat(play: (done: () => void) => CityMotionHandle): Promise<void> {
  return new Promise<void>((resolve) => {
    handle = play(() => {
      handle = undefined;
      resolve();
    });
    if (hurried) {
      handle?.finish();
    }
  });
}

// ── the scene ───────────────────────────────────────────────────────────────

function begin(landing: ColonyCityLanding, scale: 'stage' | 'tile'): void {
  // The landed tile is WITHHELD on its seat from the first frame — the player's own commit arrives mid-scene (at the
  // contact) and a watcher's has already arrived: either way the real tile is not painted before the piece is at rest.
  colonyCityState.holds[landing.colony] = 'tile';
  colonyCityState.landing = landing;
  colonyCityState.scale = scale;
  colonyCityState.live = true;
  colonyCityState.beat = 'handover';
  colonyCityState.degraded = '';
  colonyCityState.counted = false;
  colonyCityState.cubeOn = false;
  hurried = false;
  scenePromise = new Promise<void>((resolve) => {
    sceneResolve = resolve;
  });
}

function freeGate(): void {
  const resolve = gateResolve;
  gateResolve = undefined;
  resolve?.();
}

function end(): void {
  const landing = colonyCityState.landing;
  if (landing !== undefined) {
    delete colonyCityState.holds[landing.colony];
  }
  colonyCityState.live = false;
  colonyCityState.beat = '';
  colonyCityState.landing = undefined;
  colonyCityState.seatRect = undefined;
  colonyCityState.cubeRect = undefined;
  colonyCityState.cubeOn = false;
  if (safety !== undefined) {
    window.clearTimeout(safety);
    safety = undefined;
  }
  freeGate();
  const resolve = sceneResolve;
  sceneResolve = undefined;
  scenePromise = undefined;
  resolve?.();
}

/** THE FRAME OF CONTACT: the commit gate opens (the view applies under the proxy) and the seat answers — once. */
function contact(landing: ColonyCityLanding): void {
  colonyCityState.landed = landing.colony;
  freeGate();
}

/** The piece is AT REST: the real tile paints on its seat from now on (its cube is still in the air). */
function seatTile(landing: ColonyCityLanding): void {
  colonyCityState.holds[landing.colony] = 'cube';
}

/** Is the seat of `colony` PAINTING its real tile yet (the commit has reached the screen)? */
function seatPainted(colony: string): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  return document.querySelector(`[data-colony-city-seat="${quoted(colony)}"][data-colony-city-pose="seated"]`) !== null;
}

/** Wait (bounded) for the real tile under the proxy — the proxy may never leave a seat that paints nothing. */
async function awaitSeatPainted(colony: string): Promise<boolean> {
  for (let i = 0; i < SEAT_PAINT_TICKS; i++) {
    await nextTick();
    if (seatPainted(colony) || !colonyCityState.live) {
      return true;
    }
    await tick();
  }
  return seatPainted(colony);
}

/** The final poses with no flight — reduced motion, or a seat that cannot be measured (confessed by the caller). */
async function landWithoutFlight(landing: ColonyCityLanding): Promise<void> {
  contact(landing);
  seatTile(landing);
  await wait(motionMs(CITY_REDUCED_MS));
  delete colonyCityState.holds[landing.colony];
  colonyCityState.counted = true;
}

async function play(landing: ColonyCityLanding, profile: ColonyCityProfile, stageOnly: boolean): Promise<void> {
  if (consoleReducedMotionActive() || typeof document === 'undefined') {
    await landWithoutFlight(landing);
    return;
  }
  // HANDOVER — the seat's ghost has let go (the waiting contour stands); the proxy is born INVISIBLE now and is
  // positioned on the next tick, off a seat measured at rest.
  await nextTick();
  await tick();
  const seat = seatEl(landing.colony, stageOnly);
  if (seat === null || !colonyCityState.live) {
    if (seat === null) {
      colonyCityState.degraded = `no seat: ${landing.colony}`;
    }
    await landWithoutFlight(landing);
    return;
  }
  const seatRect = rectOf(seat);
  const cubeSlot = seat.querySelector<HTMLElement>('[data-colony-city-cube]');
  colonyCityState.seatRect = seatRect;
  colonyCityState.cubeRect = cubeSlot === null ? undefined : rectOf(cubeSlot);
  await nextTick(); // the layer mounts the proxy at the measured seat
  const els = stage?.els();
  if (els === undefined || !placeCityProxy(els, seatRect, profile)) {
    colonyCityState.degraded = `no stage: ${landing.colony}`;
    await landWithoutFlight(landing);
    return;
  }
  // MATERIALIZE — above its own seat: the edge, then the art; the shadow gathers on the seat.
  colonyCityState.beat = 'materialize';
  await beat((done) => playCityMaterialize(els, profile, motionMs, done));
  if (!colonyCityState.live) {
    return;
  }
  // WEIGHT — full stillness: the piece in the hand, over the table.
  if (profile.weightMs > 0 && !hurried) {
    colonyCityState.beat = 'weight';
    await wait(motionMs(profile.weightMs));
    if (!colonyCityState.live) {
      return;
    }
  }
  // LANDING — one progress; the commit gate opens in the frame of CONTACT.
  colonyCityState.beat = 'land';
  let touched = false;
  await beat((done) => playCityLanding(els, {
    seat: seatRect,
    profile,
    ms: motionMs,
    uiScale: conUiScale(),
    onContact: () => {
      touched = true;
      contact(landing);
    },
  }, done));
  if (!touched) {
    contact(landing);
  }
  if (!colonyCityState.live) {
    return;
  }
  // The piece is AT REST: the real tile paints under the proxy (the commit applied at the contact), and only once
  // it does the proxy leaves — on the NEXT frame. Show, then remove: never a crossfade, never a blank seat.
  settleCityProxy(els, seatRect, profile);
  seatTile(landing);
  if (!(await awaitSeatPainted(landing.colony))) {
    colonyCityState.degraded = `seat never painted: ${landing.colony}`;
  }
  await tick();
  colonyCityState.seatRect = undefined;
  if (!colonyCityState.live) {
    return;
  }
  // THE CUBE — the owner's own, in the colony build's language, half as loud; the tile answers with a press.
  colonyCityState.beat = 'cube';
  await playCube(landing, profile);
  delete colonyCityState.holds[landing.colony];
  colonyCityState.counted = true;
  if (!colonyCityState.live) {
    return;
  }
  // READ — the seated city is read before the stage folds home.
  if (profile.readMs > 0 && !hurried) {
    colonyCityState.beat = 'read';
    await wait(motionMs(profile.readMs));
  }
}

async function playCube(landing: ColonyCityLanding, profile: ColonyCityProfile): Promise<void> {
  const slot = colonyCityState.cubeRect;
  if (slot === undefined) {
    return;
  }
  colonyCityState.cubeOn = true;
  await nextTick(); // the layer mounts the cube proxy at its resting box
  const cube = stage?.cube();
  if (cube === undefined || !placeCubeProxy(cube, {slot})) {
    colonyCityState.cubeOn = false;
    return;
  }
  if (hurried) {
    disposeCubeProxy(cube);
    colonyCityState.cubeOn = false;
    return;
  }
  await playCubeApproach(cube, {slot, ms: motionMs(profile.cubeApproachMs)});
  if (colonyCityState.live && !hurried) {
    await playCubeDescent(cube, {dropMs: motionMs(profile.cubeDropMs), settleMs: motionMs(CITY_PRESS_MS)});
  }
  // The cube has touched: the tile takes its press, the real cube paints under the proxy, the proxy leaves next frame.
  colonyCityState.pressed = landing.colony;
  delete colonyCityState.holds[landing.colony];
  await nextTick();
  disposeCubeProxy(cube);
  await tick();
  colonyCityState.cubeOn = false;
}

// ── THE PLAYER'S OWN FLOW — the armed transport gate ────────────────────────

/** ARM (A on the stage, BEFORE the POST). */
export function armColonyCity(arm: ColonyCityArm): void {
  colonyCityState.armed = arm;
  colonyCityState.receipt = undefined;
  colonyCityState.counted = false;
  colonyCityState.degraded = '';
}

/**
 * DETECT (the transport's commit path) — consume the arm exactly once. The
 * answer must really carry the armed landing: a parked tail, a re-ask or a
 * refusal carries none, the arm stays for the flow to clear and the view
 * applies as it is.
 */
export function detectColonyCity(prevView: ViewModel | undefined, newView: ViewModel | undefined): ColonyCityLanding | undefined {
  const arm = colonyCityState.armed;
  if (arm === undefined) {
    return undefined;
  }
  const landing = armedLandingOf(prevView?.game?.colonies, newView?.game?.colonies, arm);
  if (landing === undefined) {
    return undefined;
  }
  colonyCityState.armed = undefined;
  return landing;
}

/**
 * RUN (the transport awaits it with the commit HELD) — the landing on the
 * tile's stage. Resolves AT THE FRAME OF CONTACT: the caller commits right
 * there, and the scene goes on past the gate (the settle, the cube, the read)
 * under its own hold. NEVER rejects — every failure degrades, confesses and
 * frees the gate.
 */
export function runColonyCity(landing: ColonyCityLanding): Promise<void> {
  return new Promise<void>((resolve) => {
    gateResolve = resolve;
    ownPlayed = landingSignature(landing);
    begin(landing, 'stage');
    colonyCityState.receipt = landing.tile.card === undefined ? {colony: landing.colony} : {colony: landing.colony, card: landing.tile.card};
    safety = window.setTimeout(() => abortColonyCity('safety'), motionMs(colonyCityTimeline(OWN_CITY_PROFILE).totalMs) + 4000);
    void play(landing, OWN_CITY_PROFILE, true).finally(() => end());
  });
}

// ── A WATCHER — seeded from the views' diff ─────────────────────────────────

/**
 * THE APPLY-BLOCK SEED (`gameTransport.seedRewardHolds`, and `App.update` for
 * a poll / WS view): a tile came to lie on a colony tile, nobody on this screen
 * is playing it, and a measurable seat of that tile stands → withhold the tile
 * on its seat and play the landing there. No seat → nothing is seeded and
 * nothing is held. A no-op for every other view.
 */
export function seedColonyCityHolds(before: PlayerViewModel | ViewModel | undefined, after: PlayerViewModel | ViewModel | undefined): void {
  if (before?.game?.colonies === undefined || after?.game?.colonies === undefined) {
    return;
  }
  const landings = colonyCityLandings(before.game.colonies, after.game.colonies);
  if (landings.length === 0) {
    return;
  }
  for (const landing of landings) {
    if (ownPlayed === landingSignature(landing)) {
      // The player's own gate played this very landing with the commit held — it is not a watcher's.
      ownPlayed = undefined;
      continue;
    }
    if (colonyCityState.live || !colonyCitySeatStands(landing.colony)) {
      continue; // one scene at a time; with no seat on screen the city simply stands
    }
    // The player's own PARKED tail landing later arrives here too — its arm is spent with the landing.
    if (colonyCityState.armed?.colony === landing.colony) {
      colonyCityState.armed = undefined;
    }
    colonyCityState.holds[landing.colony] = 'tile';
    begin(landing, 'tile');
    safety = window.setTimeout(() => abortColonyCity('safety'), motionMs(colonyCityTimeline(WATCHER_CITY_PROFILE).totalMs) + 4000);
    void play(landing, WATCHER_CITY_PROFILE, false).finally(() => end());
  }
}

// ── hurry · abort · clear ───────────────────────────────────────────────────

/**
 * A WATCHER's landing lost its surface (the player descended into a stage, opened a dossier, left the colonies): the
 * seat it was measured on is not where it stood — the scene ends in its final poses at once. The player's own scene
 * is not this (its stage is pinned for its whole length).
 */
export function endWatchedColonyCity(): void {
  if (colonyCityState.live && colonyCityState.scale === 'tile') {
    abortColonyCity();
  }
}

/** A during the scene — «дожать»: the playing beat jumps to its final pose and the rest follow at once (never a second submit). */
export function hurryColonyCity(): void {
  if (!colonyCityState.live) {
    return;
  }
  hurried = true;
  handle?.finish();
}

/** ABORT — a refusal, a safety, an expired hold, an unmount: final poses, every hold of its own released, the gate freed. */
export function abortColonyCity(why: string = 'abort'): void {
  if (colonyCityState.live && why !== 'abort') {
    colonyCityState.degraded = `${colonyCityState.landing?.colony ?? ''}: ${why}`;
  }
  const playing = handle;
  handle = undefined;
  hurried = true;
  playing?.kill();
  const els = stage?.els();
  if (els !== undefined) {
    killColonyCityTweens(els);
  }
  const cube = stage?.cube();
  if (cube !== undefined) {
    killColonyBuildTweens(cube);
  }
  for (const key of Object.keys(colonyCityState.holds)) {
    delete colonyCityState.holds[key];
  }
  if (colonyCityState.live || gateResolve !== undefined || sceneResolve !== undefined) {
    end();
  }
}

/** A refused submit / a re-ask / a parked tail: the arm goes, the door stands as it was (the projection returns). */
export function disarmColonyCity(): void {
  abortColonyCity();
  colonyCityState.armed = undefined;
  colonyCityState.receipt = undefined;
  colonyCityState.counted = false;
}

/**
 * The flow that armed the landing is over (or was cancelled): the arm and the
 * receipt go; a scene mid-flight ends in its final pose. Idempotent — the
 * transport's abort battery calls it on every refusal.
 */
export function clearColonyCity(): void {
  abortColonyCity();
  colonyCityState.armed = undefined;
  colonyCityState.receipt = undefined;
  colonyCityState.homing = false;
  colonyCityState.counted = false;
  colonyCityState.landed = '';
  colonyCityState.pressed = '';
  ownPlayed = undefined;
}

/** A seat's one-shot answer has played — the seat calls it on `animationend`. */
export function ackColonyCitySeat(colony: string, which: 'landed' | 'pressed'): void {
  if (colonyCityState[which] === colony) {
    colonyCityState[which] = '';
  }
}

/** Test-only reset. */
export function resetColonyCity(): void {
  clearColonyCity();
  colonyCityState.degraded = '';
  stage = undefined;
}
