/*
 * THE MONKEY'S WALK, AS A FUNCTION OF ITS SEED (FREEZE ZERO · B4 — a finding replays without hand-writing its test).
 *
 * The box monkey (`tests/e2e/console-monkey.spec.ts`) and the monkey in the bottle (`monkey.bottle.ts`) walk ONE
 * stream: mulberry32 over `<seed>:<fixture>`, a key by the pad's weights, the player's rhythm, the other seats moving
 * every dozen presses. This module is that stream — number for number the box spec's (`rng`, `KEYS`, `pick`, the pause
 * formula) — so a class the monkey filed under `seed=fz0:<fixture>` is stood up again by
 * `monkeyWalk(bottle, seats, 'fz0:<fixture>', presses)` (`classReplays.bottle.ts`).
 *
 * ⚠ If the box spec's generator changes, this changes with it in the same diff: two streams are two different walks.
 */
import type {BottleKey, ConsoleBottle} from './consoleBottle';

/** mulberry32 — the box monkey's generator (`console-monkey.spec.ts` `rng`). */
export function monkeyRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The pad, weighted like a player's thumb — the box monkey's table (`KEYS`). */
export const MONKEY_KEYS: ReadonlyArray<[BottleKey, number]> = [
  ['ArrowUp', 9], ['ArrowDown', 9], ['ArrowLeft', 9], ['ArrowRight', 9],
  ['Enter', 26], ['Escape', 12],
  ['KeyX', 3], ['KeyY', 3], ['KeyQ', 3], ['KeyE', 3], ['Comma', 3], ['Period', 4], ['KeyC', 2], ['KeyV', 2], ['KeyR', 1],
];
const KEY_TOTAL = MONKEY_KEYS.reduce((sum, [, w]) => sum + w, 0);

export function monkeyPick(r: () => number): BottleKey {
  let x = r() * KEY_TOTAL;
  for (const [key, w] of MONKEY_KEYS) {
    x -= w;
    if (x < 0) {
      return key;
    }
  }
  return 'Enter';
}

/** What a page of the walk had named when it was replaced by a reload (its journal goes with it). */
export type MonkeyCarried = {cls: string, count: number, text: string, blind: boolean};

/**
 * HOW THE NEXT KEY IS CHOSEN.
 *  · `plain`  — the box monkey's stream: the pad's weights, blind to the screen. A walk by its seed IS the box's walk.
 *  · `guided` — a player's eyes: most presses are verbs the command bar OFFERS right now (the hot one first, A and RT
 *    before B), some move the cursor, a few are anything at all. It goes where a blind walk rarely does — through a
 *    composer to its submit, into a nested step, past a commit — because it presses what the screen asks for. Its own
 *    stream (`<seed>:guided`): the plain walk of the same seed is untouched.
 */
export type MonkeyMode = 'plain' | 'guided';

export type MonkeyWalkResult = {
  /** `key:echo`, `[seat n] move`, `[RELOAD]`. */
  log: Array<string>,
  /** The bottle the walk ENDED on — another one than it began on when a reload replaced the page. */
  bottle: ConsoleBottle,
  /** The classes of the pages a reload replaced (the last page's are read by the caller, after its «last word»). */
  carried: Array<MonkeyCarried>,
  /** The coverage keys of the pages a reload replaced (the last page's are read by the caller). */
  carriedCoverage: Array<string>,
};

const ARROWS: ReadonlyArray<BottleKey> = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** A guided press: what the bar offers (weighted), else the cursor, else anything. */
function guidedPick(bottle: ConsoleBottle, g: () => number, r: () => number): BottleKey {
  const roll = g();
  const offered = bottle.offered();
  if (roll < 0.62 && offered.length > 0) {
    // The hot verb is what the screen asks for; A and RT move a flow on; B leaves it (rarer, or the walk never arrives).
    const weight = (o: {key: BottleKey, hot: boolean}): number => (o.hot ? 6 : 0) + (o.key === 'Enter' ? 5 : o.key === 'Period' ? 3 : o.key === 'Escape' ? 1 : 2);
    let x = g() * offered.reduce((sum, o) => sum + weight(o), 0);
    for (const o of offered) {
      x -= weight(o);
      if (x < 0) {
        return o.key;
      }
    }
    return offered[0].key;
  }
  if (roll < 0.9) {
    return ARROWS[Math.floor(g() * ARROWS.length)];
  }
  return monkeyPick(r);
}

/**
 * Walk `presses` presses of the stream `seed` (`<seed>:<fixture>`, as the monkey's annotation prints it) on a booted
 * bottle of a table with `seats` seats. The caller advances the clock past the nets' graces afterwards (the monkey's
 * «last word»: 14 s) and reads the last page's journal.
 *
 * `reloadEvery` — THE RELOAD (the box monkey's `TM_E2E_MONKEY_RELOAD`, here with a rate): on average once in that many
 * presses the page is RELOADED where the walk stands — its own seeded stream (`<seed>:reload`), so a walk's presses
 * are the same with it off. The restore road (a stage re-primed from the server, a flow's latch reset under a live
 * question) is then walked like any press; what the replaced page had named is carried.
 */
export async function monkeyWalk(start: ConsoleBottle, seats: number, seed: string, presses: number,
  opts: {reloadEvery?: number, mode?: MonkeyMode} = {}): Promise<MonkeyWalkResult> {
  let bottle = start;
  const r = monkeyRng(seed);
  const guided = opts.mode === 'guided' ? monkeyRng(`${seed}:guided`) : undefined;
  const carriedCoverage = new Set<string>();
  // (The box monkey's first number chooses its landing; the stream stays in step with it.)
  r();
  const reload = opts.reloadEvery !== undefined && opts.reloadEvery > 0 ? monkeyRng(`${seed}:reload`) : undefined;
  const log: Array<string> = [];
  const carried: Array<MonkeyCarried> = [];
  for (let i = 0; i < presses; i++) {
    // THE OTHER SEATS MOVE — every dozen presses, as on the box.
    if (i % 12 === 11) {
      for (let seat = 1; seat < seats; seat++) {
        const moved = await bottle.otherSeatMoves(seat).catch(() => undefined);
        if (moved !== undefined) {
          log.push(`[seat ${seat}] ${moved}`);
        }
      }
    }
    if (reload !== undefined && reload() < 1 / (opts.reloadEvery ?? 1)) {
      const live = bottle.liveness();
      carried.push(...live.defects.map((d) => ({...d, blind: false})), ...live.blind.map((d) => ({...d, blind: true})));
      for (const key of bottle.coverage()?.keys ?? []) {
        carriedCoverage.add(key);
      }
      log.push('[RELOAD]');
      bottle = await bottle.reload();
      await bottle.advance(3_000);
      continue;
    }
    const key = guided === undefined ? monkeyPick(r) : guidedPick(bottle, guided, r);
    const echo = await bottle.press(key);
    log.push(`${key}:${echo}`);
    // A player's rhythm — the box monkey's own numbers.
    const roll = r();
    const pause = roll < 0.7 ? 120 + r() * 380 : roll < 0.95 ? 600 + r() * 1400 : 3000 + r() * 5000;
    await bottle.advance(Math.round(pause));
  }
  return {log, bottle, carried, carriedCoverage: [...carriedCoverage]};
}
