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

/**
 * Walk `presses` presses of the stream `seed` (`<seed>:<fixture>`, as the monkey's annotation prints it) on a booted
 * bottle of a table with `seats` seats. Returns the log (`key:echo`, `[seat n] move`). The caller advances the clock
 * past the nets' graces afterwards (the monkey's «last word»: 14 s).
 */
export async function monkeyWalk(bottle: ConsoleBottle, seats: number, seed: string, presses: number): Promise<Array<string>> {
  const r = monkeyRng(seed);
  // (The box monkey's first number chooses its landing; the stream stays in step with it.)
  r();
  const log: Array<string> = [];
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
    const key = monkeyPick(r);
    const echo = await bottle.press(key);
    log.push(`${key}:${echo}`);
    // A player's rhythm — the box monkey's own numbers.
    const roll = r();
    const pause = roll < 0.7 ? 120 + r() * 380 : roll < 0.95 ? 600 + r() * 1400 : 3000 + r() * 5000;
    await bottle.advance(Math.round(pause));
  }
  return log;
}
