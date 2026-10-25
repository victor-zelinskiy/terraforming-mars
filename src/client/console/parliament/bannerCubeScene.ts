import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {flyBannerCube, rectOf} from './parliamentFlights';
import {Rect} from './consoleParliamentVoteMotion';
import {bannerCubesOn} from './consoleParliamentModel';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';

/*
 * THE CUBE ON THE BANNER — SEEN ARRIVING (Septem Tribus:redux).
 *
 * A cube is a grant of a party's effect, and the grant is in the view the instant the server answers. The table may
 * not paint it there before its cause: a cube placed by the first action or by a won resolution is HELD (the plaque and
 * the charter draw the banner without it) from the apply block until its flight touches down in the seal's socket —
 * «взял → понёс → поставил» from the seat's own place. A hold nobody plays is released by a bounded net, named.
 *
 *  · `seedBannerCubeHolds(before, after)` — the apply block (both commit roads): every cube in `after` that was not in
 *    `before` is held. A first view seeds nothing (a reload never replays).
 *  · `landBannerCube(party, color, from)` — the flight; releases the hold on the touchdown (reduced motion / nothing
 *    measurable: at once — the same numbers, no flight).
 *  · `bannerCubesShown(party, cubes)` — what a surface draws: the table's cubes minus the held ones.
 */

/** How long the first action's cube may wait for its flight before it is simply shown (a scene that never played). */
export const BANNER_CUBE_HOLD_MAX_MS = 9_000;
/**
 * …and a cube the SITTING owes: the walk reaches its beat only after the Agenda, the support and the enactment have
 * played (and only once the player looks at the Parliament), so the first action's bound shipped the beat SKIPPED —
 * the cube was shown unflown before its turn came (the owner, 2026-10-25: «по факту куб появился»). The sitting
 * releases what it still owes itself when the enactment settles; this is the net under a sitting nobody watched.
 */
export const BANNER_CUBE_SITTING_HOLD_MAX_MS = 60_000;

export const bannerCubeState = reactive({
  /** `party|color` of every cube whose landing is still owed. */
  held: {} as Record<string, true>,
  /** `party|color` of the cubes that landed this session — the socket's one-shot «seated» answer. */
  landed: {} as Record<string, true>,
});

const nets = new Map<string, ReturnType<typeof setTimeout>>();

function keyOf(party: ReduxParty, color: Color): string {
  return `${party}|${color}`;
}

export function bannerCubeHeld(party: ReduxParty, color: Color): boolean {
  return bannerCubeState.held[keyOf(party, color)] === true;
}

/** The cubes a surface draws on `party`'s banner: the table's, minus those still in the air. */
export function bannerCubesShown(party: ReduxParty, cubes: ReadonlyArray<Color>): Array<Color> {
  return cubes.filter((color) => !bannerCubeHeld(party, color));
}

export function bannerCubeJustLanded(party: ReduxParty, color: Color): boolean {
  return bannerCubeState.landed[keyOf(party, color)] === true;
}

export function holdBannerCube(party: ReduxParty, color: Color, netMs: number = BANNER_CUBE_HOLD_MAX_MS): void {
  const key = keyOf(party, color);
  bannerCubeState.held[key] = true;
  const net = nets.get(key);
  if (net !== undefined) {
    clearTimeout(net);
  }
  // A cube nobody flew is SHOWN, never kept hidden: a hidden cube is a worse lie than a missed flight (a bound).
  const showUnflown = () => {
    nets.delete(key);
    if (bannerCubeState.held[key] === true) {
      console.warn(`[banner-cube] ${key} was held ${netMs} ms with no flight — shown without one`);
      releaseBannerCube(party, color);
    }
  };
  nets.set(key, setTimeout(showUnflown, netMs));
}

export function releaseBannerCube(party: ReduxParty, color: Color, landed = false): void {
  const key = keyOf(party, color);
  delete bannerCubeState.held[key];
  const net = nets.get(key);
  if (net !== undefined) {
    clearTimeout(net);
    nets.delete(key);
  }
  if (landed) {
    // The socket's one-shot answer belongs to THIS touchdown (forgotten on its own `animationend`).
    bannerCubeState.landed[key] = true;
  }
}

/** Every cube of the parliament, by `party|color`. */
function cubeKeysOf(model: ParliamentModel | undefined): Set<string> {
  const out = new Set<string>();
  if (model === undefined) {
    return out;
  }
  for (const party of REDUX_PARTIES) {
    for (const color of bannerCubesOn(model, party)) {
      out.add(keyOf(party, color));
    }
  }
  return out;
}

/**
 * THE APPLY BLOCK: every cube that appears between two applied views is held until its flight lands. A first view
 * (no `before`) seeds nothing; reduced motion is decided at the flight (it releases at once).
 */
export function seedBannerCubeHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const was = before?.game.parliament;
  const now = after?.game.parliament;
  if (was === undefined || now === undefined) {
    return;
  }
  // ONLY A CUBE SOMEBODY WILL FLY IS HELD: the viewer's own answer to the banner prompt (the first action's scene), or
  // a cube the sitting's record names (its «куб на знамя» beat — every viewer watches it). Any other cube (a rival's
  // first action) simply stands: holding it would hide it until the net.
  const viewer = before?.thisPlayer?.color;
  const ownAnswer = before?.waitingFor?.bannerPrompt !== undefined;
  const record = now.phase?.summary?.bannerCubes ?? now.lastPhase?.bannerCubes ?? [];
  const sitting = new Set(record.map((c) => keyOf(c.party, c.player)));
  let warm = false;
  const old = cubeKeysOf(was);
  for (const key of cubeKeysOf(now)) {
    if (old.has(key)) {
      continue;
    }
    const [party, color] = key.split('|') as [ReduxParty, Color];
    if (sitting.has(key)) {
      holdBannerCube(party, color, BANNER_CUBE_SITTING_HOLD_MAX_MS);
      warm = true;
    } else if (ownAnswer && color === viewer) {
      holdBannerCube(party, color);
    }
  }
  // The card that will stand up for the sitting's cube paints its art from its first frame (decoded now, not at the rise).
  if (warm) {
    preloadPremiumCardArt(Array.from(new Set(record.map((c) => c.card))), ['full', 'thumb']);
  }
}

/** The socket a cube lands in: the seal's lower-right corner of the party's plaque on screen (the first visible one). */
export function bannerCubeTargetRect(party: ReduxParty): Rect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  for (const seal of Array.from(document.querySelectorAll<HTMLElement>(`.con-pseal[data-party="${party}"] .con-pseal__seal`))) {
    const r = rectOf(seal);
    if (r === undefined) {
      continue;
    }
    const size = r.width * 0.42;
    return {left: r.left + r.width - size * 0.7, top: r.top + r.height - size * 0.75, width: size, height: size};
  }
  return undefined;
}

/**
 * THE FLIGHT: the seat's cube from `from` onto the party's banner socket; the hold drops on the touchdown, the socket
 * answers once (`landed`). Nothing measurable or reduced motion → released at once.
 */
export function landBannerCube(party: ReduxParty, color: Color, from: Rect | undefined, onLanded: () => void = () => {}): void {
  const to = bannerCubeTargetRect(party);
  flyBannerCube(color, from, to, () => {
    releaseBannerCube(party, color, true);
    onLanded();
  });
}

/** Every cube still owed its flight is shown where it stands (the sitting's enactment settled without its beat). */
export function releaseHeldBannerCubes(): void {
  for (const key of Object.keys(bannerCubeState.held)) {
    const [party, color] = key.split('|') as [ReduxParty, Color];
    releaseBannerCube(party, color);
  }
}

/** The socket's seat answer ended (its `animationend`): a plaque mounted later shows the cube at rest. */
export function forgetBannerCubeLanding(party: ReduxParty, color: Color): void {
  delete bannerCubeState.landed[keyOf(party, color)];
}

/** The game switch: nothing held, nothing landed. */
export function resetBannerCubeScene(): void {
  for (const net of nets.values()) {
    clearTimeout(net);
  }
  nets.clear();
  bannerCubeState.held = {};
  bannerCubeState.landed = {};
}
