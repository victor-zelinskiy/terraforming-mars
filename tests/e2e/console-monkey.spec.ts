import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, FixtureName, openConsole, reloadConsole, sendPlayerInput} from './consoleStart';

/**
 * THE MONKEY — freezes are found by US, never by the field (the owner, 2026-11-08: «делаем глубоко и основательно,
 * чтобы покрыть все возможные кейсы, а не точечно в одном workspace»; ledger HC).
 *
 * Every field freeze so far was a shape nobody had scripted: two flows waiting on each other, a record resetting the one
 * in front of it, a latch that outlived its fact. A scripted spec walks the road its author imagined; the monkey walks
 * the roads nobody did. ONE test per fixture (every table the suite knows — the openings, the Parliament, the draft,
 * the finale, the bots): the viewer's pad is driven by a SEEDED random walk of real console presses (the d-pad, A, B,
 * X, Y, the bumpers and triggers, the stick presses — never the system menu, which leaves the game), with the pauses a
 * player makes, while the OTHER seats move over the API (they pass, they take the first card) so the game keeps
 * turning: rivals' scenes, generations, sittings, drafts, the finale. The harness's guards turn every net that had to
 * run red (`[liveness] stall`, `[workspace-stall] beat`, `[workspace-stale] concluded`, `[workspace-anchor] reaped`,
 * `[start-stranded]`, a Vue error, a reload); the monkey adds the last word — after the walk, a quiet spell long
 * enough for the arbiter to judge the screen it left.
 *
 * OPT-IN (it is hours of box time): `TM_E2E_MONKEY=1 npm run e2e:remote -- <task> console-monkey.spec.ts --shard=k/n`.
 * `TM_E2E_MONKEY_SEED` (default: the date) · `TM_E2E_MONKEY_PRESSES` (default 120) · `TM_E2E_MONKEY_ONLY` (a regex
 * over fixture names). A red names its seed and the whole press log — the walk replays exactly.
 */
const ENABLED = process.env.TM_E2E_MONKEY === '1';
const SEED = process.env.TM_E2E_MONKEY_SEED ?? new Date().toISOString().slice(0, 10);
const PRESSES = Number(process.env.TM_E2E_MONKEY_PRESSES ?? 120);
const ONLY = process.env.TM_E2E_MONKEY_ONLY === undefined ? undefined : new RegExp(process.env.TM_E2E_MONKEY_ONLY);
/**
 * THE DUO (`TM_E2E_MONKEY_DUO=1`): the owner plays two humans over the LAN, so a table with a second human seat is
 * walked by TWO monkeys at once — the second seat's own page, its own seeded walk — so a rival's landing, scene and
 * hand-over arrive WHILE the first player is mid-flow (the API seats only ever answer between presses).
 */
const DUO = process.env.TM_E2E_MONKEY_DUO === '1';
/**
 * THE RELOAD (`TM_E2E_MONKEY_RELOAD=1`): now and then (≈ 1 press in 120, its own seeded stream — an old seed's presses
 * replay unchanged with it off) the page is RELOADED mid-walk, wherever the walk stands: the session's restore paths
 * (a stage re-primed from the server, a flow's latch reset under a live question) are walked like any press.
 */
const RELOAD = process.env.TM_E2E_MONKEY_RELOAD === '1';

/** Every fixture the generator writes — read off the directory, so a new table is walked the day it exists. */
const FIXTURES: ReadonlyArray<string> = fs.readdirSync(path.resolve(__dirname, 'fixtures'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -'.json'.length))
  .filter((name) => ONLY === undefined || ONLY.test(name))
  .sort();

/** mulberry32 — small, fast, and the same walk on every machine for one seed. */
function rng(seed: string): () => number {
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

/**
 * The pad, weighted like a player's thumb: the d-pad most, A next (it is what moves a game on), B (one level back, the
 * collapse), then the rest. Never `KeyM` — the system menu's «exit to the main menu» leaves the game the walk is about.
 */
const KEYS: ReadonlyArray<[string, number]> = [
  ['ArrowUp', 9], ['ArrowDown', 9], ['ArrowLeft', 9], ['ArrowRight', 9],
  ['Enter', 26], ['Escape', 12],
  ['KeyX', 3], ['KeyY', 3], ['KeyQ', 3], ['KeyE', 3], ['Comma', 3], ['Period', 4], ['KeyC', 2], ['KeyV', 2], ['KeyR', 1],
];
const KEY_TOTAL = KEYS.reduce((sum, [, w]) => sum + w, 0);

function pick(r: () => number): string {
  let x = r() * KEY_TOTAL;
  for (const [key, w] of KEYS) {
    x -= w;
    if (x < 0) {
      return key;
    }
  }
  return 'Enter';
}

type Wire = {waitingFor?: {type?: string, promptId?: number, options?: Array<{title: string | {message: string}}>, cards?: Array<{name: string}>, min?: number}};

/**
 * THE OTHER SEATS MOVE — the plainest legal answer, over the API, so the viewer's game keeps turning (their turn comes
 * back, rivals' scenes play on the viewer's screen, the generation ends). A shape this cannot answer is left standing:
 * the game simply waits there, as a slow friend would.
 */
async function moveOthers(request: APIRequestContext, seats: ReadonlyArray<string>, log: Array<string>): Promise<void> {
  for (const seat of seats) {
    let wire: Wire;
    try {
      wire = await fetchPlayerModel(request, seat) as unknown as Wire;
    } catch {
      continue;
    }
    const wf = wire.waitingFor;
    if (wf === undefined) {
      continue;
    }
    const titleOf = (o: {title: string | {message: string}}) => (typeof o.title === 'string' ? o.title : o.title.message).trim();
    try {
      if (wf.type === 'or') {
        const options = wf.options ?? [];
        const index = options.findIndex((o) => /^(pass\b|end turn|skip|do nothing|don't)/i.test(titleOf(o)));
        if (index !== -1) {
          await sendPlayerInput(request, seat, {type: 'or', index, response: {type: 'option'}, promptId: wf.promptId} as never);
          log.push(`[${seat}] ${titleOf(options[index])}`);
        }
      } else if (wf.type === 'card') {
        const cards = (wf.cards ?? []).map((c) => c.name).slice(0, Math.max(wf.min ?? 0, 1));
        await sendPlayerInput(request, seat, {type: 'card', cards, promptId: wf.promptId} as never);
        log.push(`[${seat}] card ${cards.join(',')}`);
      } else if (wf.type === 'option') {
        await sendPlayerInput(request, seat, {type: 'option', promptId: wf.promptId} as never);
        log.push(`[${seat}] option`);
      }
    } catch {
      // A refused answer is the server's word — the seat simply stays where it is.
    }
  }
}

async function walk(page: Page, request: APIRequestContext, others: ReadonlyArray<string>, r: () => number, log: Array<string>,
  reload?: () => number): Promise<void> {
  for (let i = 0; i < PRESSES; i++) {
    if (page.isClosed()) {
      return;
    }
    if (i % 12 === 11) {
      await moveOthers(request, others, log);
    }
    if (reload !== undefined && reload() < 1 / 120) {
      log.push(`${Date.now() % 1_000_000}:RELOAD`);
      await reloadConsole(page);
      continue;
    }
    const key = pick(r);
    // The press with its moment (the console tail's clock) — a red is read press by press against the lines.
    log.push(`${Date.now() % 1_000_000}:${key}`);
    await page.keyboard.press(key);
    // A player's rhythm: mostly quick, sometimes reading, now and then watching a scene play out.
    const roll = r();
    const pause = roll < 0.7 ? 120 + r() * 380 : roll < 0.95 ? 600 + r() * 1400 : 3000 + r() * 5000;
    await cinematicBeat(page, pause, 'the rhythm of the monkey — a player pauses between presses, by design');
  }
}

test.describe('THE MONKEY — a seeded random walk over every table', () => {
  test.skip(!ENABLED, 'opt-in: TM_E2E_MONKEY=1 (hours of box time)');

  for (const fixture of FIXTURES) {
    test(`monkey · ${fixture}`, async ({page, request}) => {
      test.setTimeout(6 * 60_000);
      const seed = `${SEED}:${fixture}`;
      const r = rng(seed);
      const log: Array<string> = [];
      test.info().annotations.push({type: 'monkey-seed', description: seed});
      // A third of the walks start IN the opening (the start's own flows); the rest on the board.
      const landing = r() < 0.34 ? 'prompt' : 'board';
      let seats: Array<string> | undefined;
      // A table whose standing question the API cannot answer for a board landing (a sitting's close, an enactment)
      // is walked from its PROMPT instead — a skip is coverage lost, so it is the last resort, never the first.
      for (const how of landing === 'board' ? ['board', 'prompt'] as const : ['prompt'] as const) {
        try {
          ({seats} = await bootFixtureSeats(page, request, fixture as FixtureName, {landing: how}));
          break;
        } catch (err) {
          test.info().annotations.push({type: 'monkey-boot', description: `${how}: ${String(err).slice(0, 160)}`});
        }
      }
      if (seats === undefined) {
        test.skip(true, 'the fixture did not boot for a walk on either landing');
        return;
      }
      // The console's own account of the walk (the last lines), filed beside the press log — a red names WHAT the screen
      // said in the seconds before, not only that a net fired. THE MOMENT A NET FIRES — the frame, the wait graph and the
      // readiness probe, filed beside the walk: a red names what the screen looked like and who was waiting on whom.
      const consoleTail: Array<string> = [];
      const evidence: Array<Promise<unknown>> = [];
      let shots = 0;
      const NET = /\[(liveness\] (stall|still hold)|workspace-stall\]|workspace-stale\]|transfer\] (token painted|end not painted)|wait-graph\] (cycle|dangling|dead-end|ceiling)|animation-hold\] .*force-released|page-error\])/;
      const watch = (p: Page, tag: string): void => {
        p.on('console', (message) => {
          const text = message.text();
          consoleTail.push(`${Date.now() % 1_000_000} ${tag}${message.type()} ${text.slice(0, 600)}`);
          if (consoleTail.length > 400) {
            consoleTail.shift();
          }
          if (NET.test(text) && shots < 4 && !p.isClosed()) {
            const n = ++shots;
            const suffix = tag === '' ? '' : '-p2';
            evidence.push(p.screenshot({path: test.info().outputPath(`net-${n}${suffix}.png`)}).catch(() => undefined));
            evidence.push(p.evaluate(() => {
              const w = window as unknown as {__conWaitGraph?: () => unknown, __conReady?: () => unknown, __conStartDiag?: () => unknown};
              return {graph: w.__conWaitGraph?.(), ready: w.__conReady?.(), startDiag: w.__conStartDiag?.()};
            }).then((st) => fs.writeFileSync(test.info().outputPath(`net-${n}${suffix}.json`), JSON.stringify({line: text, seat: tag, ...st as object}, null, 1)))
              .catch(() => undefined));
          }
        });
      };
      watch(page, '');
      // THE DUO: the second seat, when it is a human (never the bot's), walks its own page beside the first.
      const second = DUO && seats.length > 1 && !/marsbot/i.test(seats[1]) ? seats[1] : undefined;
      let page2: Page | undefined;
      const log2: Array<string> = [];
      if (second !== undefined) {
        page2 = await page.context().newPage();
        watch(page2, 'P2 ');
        await openConsole(page2, second);
        test.info().annotations.push({type: 'monkey-duo', description: second});
      }
      try {
        const apiSeats = seats.slice(second === undefined ? 1 : 2);
        await Promise.all([
          walk(page, request, apiSeats, r, log, RELOAD ? rng(`${seed}:reload`) : undefined),
          ...(page2 === undefined ? [] : [walk(page2, request, [], rng(`${seed}:duo`), log2, RELOAD ? rng(`${seed}:duo:reload`) : undefined)]),
        ]);
        // THE LAST WORD: a quiet spell longer than the arbiter's grace — whatever the walk left on screen is judged.
        await cinematicBeat(page, 14_000, 'the last word — a quiet spell past the liveness grace, so the arbiter judges the screen the walk left');
      } finally {
        const walkLog = `seed=${seed} landing=${landing}${second !== undefined ? ` duo=${second}` : ''}\n${log.join(' ')}` +
          (log2.length > 0 ? `\nP2 ${log2.join(' ')}` : '');
        // A FILE beside the error context (pulled back with test-results) — the attachment lives in the report only.
        fs.writeFileSync(test.info().outputPath('monkey-walk.txt'), `${walkLog}\n\n── console (last ${consoleTail.length}) ──\n${consoleTail.join('\n')}\n`);
        await Promise.all(evidence);
        await test.info().attach('monkey-walk', {body: walkLog, contentType: 'text/plain'});
      }
      expect(page.isClosed(), 'the page survived the walk').toBe(false);
      expect(page2?.isClosed() ?? false, 'the second seat survived the walk').toBe(false);
    });
  }
});
