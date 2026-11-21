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
import {WIRE_FAULTS, WireFault} from './bottleNet';

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

/**
 * ONE STEP OF A WALK, AS IT WAS MADE — with nothing of the stream left in it: a press and the pause after it, the
 * other seats' moves, a reload. What `replaySteps` runs and `shrink.ts` cuts: a list of these IS a walk, whoever
 * produced it (the seeded stream, a guided pick, a hand).
 */
export type MonkeyStep = {do: 'press', key: BottleKey, pauseMs: number} | {do: 'seats'} | {do: 'reload'} | {do: 'away', ms: number, hidden: boolean} |
  {do: 'fault', fault: WireFault, target: FaultTarget};

/** WHICH request a fault waits for: the submit (the move), the poll («anything new?»), the view (the page's read of the game). */
export type FaultTarget = 'submit' | 'poll' | 'view';

const FAULT_MATCH: Readonly<Record<FaultTarget, (method: string, url: string) => boolean>> = {
  submit: (method, url) => method === 'POST' && url.startsWith('/player/input'),
  poll: (_method, url) => url.startsWith('/api/waitingfor'),
  view: (method, url) => method === 'GET' && url.startsWith('/api/player'),
};

/** The server's silence is bounded by the submit's own minute (`submitMachine.SUBMIT_NO_RESPONSE_MS`) — a walk waits it out. */
const SILENCE_MS = 61_000;

/** Arm the fault on the bottle's wire. */
export function armFault(bottle: ConsoleBottle, fault: WireFault, target: FaultTarget): void {
  bottle.wire.faultNext(FAULT_MATCH[target], fault);
}

/**
 * AFTER A PRESS: a fault the press's own request TOOK, and that no answer will ever end (`silent` · `lost`), is waited
 * out — the minute after which the transport gives the request up. The same rule for a walk and for its replay.
 */
async function waitOutSilence(bottle: ConsoleBottle, takenBefore: number): Promise<void> {
  const taken = bottle.wire.faulted.slice(takenBefore);
  if (taken.some((f) => f.fault === 'silent' || f.fault === 'lost')) {
    await bottle.advance(SILENCE_MS);
  }
}

export type MonkeyWalkResult = {
  /** `key:echo`, `[seat n] move`, `[RELOAD]`. */
  log: Array<string>,
  /** The walk as a list of steps — replayed by `replaySteps`, cut down by `shrinkSteps`. */
  steps: Array<MonkeyStep>,
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
 *
 * `faultEvery` — THE WIRE BREAKS (stage 4): on average once in that many presses the NEXT request of a seeded kind (the
 * submit mostly, the poll, the view) breaks in a seeded way (`bottleNet.WireFault` — refused, a 5xx, the network, the
 * server's silence, an answer lost or malformed AFTER the server made the move). Its own seeded stream
 * (`<seed>:fault`): a walk's presses are the same with it off. A fault stays armed until a request takes it.
 *
 * `awayEvery` — THE PAGE NOBODY LOOKS AT (the box monkey's `TM_E2E_MONKEY_HIDDEN`, here with a rate): on average once
 * in that many presses the page is not painted for a seeded 3…20 s — half the spells a hidden tab (the document says
 * so), half a window behind another (it does not) — and then the walk goes on. Its own seeded stream
 * (`<seed>:hidden`): a walk's presses are the same with it off.
 */
export async function monkeyWalk(start: ConsoleBottle, seats: number, seed: string, presses: number,
  opts: {reloadEvery?: number, awayEvery?: number, faultEvery?: number, mode?: MonkeyMode} = {}): Promise<MonkeyWalkResult> {
  let bottle = start;
  const r = monkeyRng(seed);
  const guided = opts.mode === 'guided' ? monkeyRng(`${seed}:guided`) : undefined;
  const carriedCoverage = new Set<string>();
  // (The box monkey's first number chooses its landing; the stream stays in step with it.)
  r();
  const reload = opts.reloadEvery !== undefined && opts.reloadEvery > 0 ? monkeyRng(`${seed}:reload`) : undefined;
  const away = opts.awayEvery !== undefined && opts.awayEvery > 0 ? monkeyRng(`${seed}:hidden`) : undefined;
  const faulty = opts.faultEvery !== undefined && opts.faultEvery > 0 ? monkeyRng(`${seed}:fault`) : undefined;
  const log: Array<string> = [];
  const steps: Array<MonkeyStep> = [];
  const carried: Array<MonkeyCarried> = [];
  for (let i = 0; i < presses; i++) {
    // THE OTHER SEATS MOVE — every dozen presses, as on the box.
    if (i % 12 === 11) {
      steps.push({do: 'seats'});
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
      steps.push({do: 'reload'});
      bottle = await bottle.reload();
      await bottle.advance(3_000);
      continue;
    }
    if (away !== undefined && away() < 1 / (opts.awayEvery ?? 1)) {
      const ms = 3_000 + Math.floor(away() * 17_000);
      const hidden = away() < 0.5;
      log.push(`[AWAY ${ms}ms ${hidden ? 'hidden' : 'behind'}]`);
      steps.push({do: 'away', ms, hidden});
      await bottle.away(ms, hidden);
      continue;
    }
    if (faulty !== undefined && faulty() < 1 / (opts.faultEvery ?? 1)) {
      const fault = WIRE_FAULTS[Math.floor(faulty() * WIRE_FAULTS.length)];
      const roll = faulty();
      const target: FaultTarget = roll < 0.7 ? 'submit' : roll < 0.85 ? 'poll' : 'view';
      log.push(`[FAULT ${fault}@${target}]`);
      steps.push({do: 'fault', fault, target});
      armFault(bottle, fault, target);
    }
    const key = guided === undefined ? monkeyPick(r) : guidedPick(bottle, guided, r);
    const takenBefore = bottle.wire.faulted.length;
    const echo = await bottle.press(key);
    log.push(`${key}:${echo}`);
    // A player's rhythm — the box monkey's own numbers.
    const roll = r();
    const pause = roll < 0.7 ? 120 + r() * 380 : roll < 0.95 ? 600 + r() * 1400 : 3000 + r() * 5000;
    steps.push({do: 'press', key, pauseMs: Math.round(pause)});
    await bottle.advance(Math.round(pause));
    await waitOutSilence(bottle, takenBefore);
  }
  return {log, steps, bottle, carried, carriedCoverage: [...carriedCoverage]};
}

/**
 * REPLAY a list of steps on a booted bottle of a table with `seats` seats — the same three verbs `monkeyWalk` makes,
 * in the order given. Returns the bottle the replay ended on (a reload replaces it). The caller advances the clock
 * past the nets' graces afterwards and reads the journal, as after a walk.
 */
export async function replaySteps(start: ConsoleBottle, seats: number, steps: ReadonlyArray<MonkeyStep>): Promise<ConsoleBottle> {
  let bottle = start;
  for (const step of steps) {
    if (step.do === 'seats') {
      for (let seat = 1; seat < seats; seat++) {
        await bottle.otherSeatMoves(seat).catch(() => undefined);
      }
    } else if (step.do === 'reload') {
      bottle = await bottle.reload();
      await bottle.advance(3_000);
    } else if (step.do === 'away') {
      await bottle.away(step.ms, step.hidden);
    } else if (step.do === 'fault') {
      armFault(bottle, step.fault, step.target);
    } else {
      const takenBefore = bottle.wire.faulted.length;
      await bottle.press(step.key);
      await bottle.advance(step.pauseMs);
      await waitOutSilence(bottle, takenBefore);
    }
  }
  return bottle;
}

/** A step as a line a human reads (and pastes into a replay): `Enter +420ms`, `[seats]`, `[reload]`. */
export function stepLine(step: MonkeyStep): string {
  return step.do === 'press' ? `${step.key} +${step.pauseMs}ms` : step.do === 'away' ? `[away ${step.ms}ms ${step.hidden ? 'hidden' : 'behind'}]` :
    step.do === 'fault' ? `[fault ${step.fault}@${step.target}]` : `[${step.do}]`;
}
