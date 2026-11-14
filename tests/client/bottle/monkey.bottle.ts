/*
 * THE MONKEY IN THE BOTTLE (FREEZE ZERO · B2 / B5 — docs/claude/console/freeze-zero/PLAN.md §3).
 *
 * The box's monkey (`tests/e2e/console-monkey.spec.ts`) walks every table with a seeded stream of presses in a real
 * browser — an hour of the Steam Machine per shard. This is the SAME walk in the bottle: the same fixtures, the same
 * seed → the same keys with the same pauses (the two files share the generator below, number for number), the other
 * seats moving at the same presses — against the real application and the real server in this process, on the manual
 * clock. No box, no chance: a walk is seconds, and a finding replays identically.
 *
 * What it files is what the box's monkey files — one `cause-classes/<fixture>.json` per walk, the product's own
 * journal by cause class — so `node scripts/monkey-report.mjs <out dir>` sums it, and `--against` the box's baseline
 * says which classes the two agree on. A class is DATA here, never a red test: the report and its gate judge.
 *
 * What it cannot see is what needs layout (`LAYOUT_BLIND` — filed apart, tier `info`): a rect, a paint, a CSS end.
 * A class only the bottle names is a candidate — confirm it on the box with the same seed before calling it one.
 *
 * OPT-IN (it is an hour of the laptop): `TM_BOTTLE_MONKEY=1 npm run test:client:one -- tests/client/bottle/monkey.bottle.ts`
 *   TM_BOTTLE_MONKEY_SEED (default `fz0`) · TM_BOTTLE_MONKEY_PRESSES (60) · TM_BOTTLE_MONKEY_ONLY (a regex over
 *   fixture names) · TM_BOTTLE_MONKEY_SHARD (`k/n`) · TM_BOTTLE_MONKEY_OUT (default `.e2e-remote/bottle-monkey` — beside the box monkey's).
 */
import {bootBottle, BottleKey, ConsoleBottle} from './consoleBottle';
import {bottleServer, nodeProcess, nodeRequire} from './bottleNode';

const env = nodeProcess().env as Record<string, string | undefined>;
const ENABLED = env.TM_BOTTLE_MONKEY === '1';
const SEED = env.TM_BOTTLE_MONKEY_SEED ?? 'fz0';
const PRESSES = Number(env.TM_BOTTLE_MONKEY_PRESSES ?? 60);
const ONLY = env.TM_BOTTLE_MONKEY_ONLY === undefined ? undefined : new RegExp(env.TM_BOTTLE_MONKEY_ONLY);
const OUT = env.TM_BOTTLE_MONKEY_OUT ?? '.e2e-remote/bottle-monkey';
const [SHARD, SHARDS] = (env.TM_BOTTLE_MONKEY_SHARD ?? '1/1').split('/').map(Number);

/** mulberry32 — the box monkey's generator, number for number (`console-monkey.spec.ts` `rng`). */
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

/** The pad, weighted like a player's thumb — the box monkey's table (`KEYS`). */
const KEYS: ReadonlyArray<[BottleKey, number]> = [
  ['ArrowUp', 9], ['ArrowDown', 9], ['ArrowLeft', 9], ['ArrowRight', 9],
  ['Enter', 26], ['Escape', 12],
  ['KeyX', 3], ['KeyY', 3], ['KeyQ', 3], ['KeyE', 3], ['Comma', 3], ['Period', 4], ['KeyC', 2], ['KeyV', 2], ['KeyR', 1],
];
const KEY_TOTAL = KEYS.reduce((sum, [, w]) => sum + w, 0);

function pick(r: () => number): BottleKey {
  let x = r() * KEY_TOTAL;
  for (const [key, w] of KEYS) {
    x -= w;
    if (x < 0) {
      return key;
    }
  }
  return 'Enter';
}

type Filed = {cls: string, shape: string, tier: string, family: string, page: number, count: number, lines: number, atMs: number, title: string, dims: Record<string, string>};
const filed = (cls: string, tier: string, count: number, text: string): Filed => ({
  cls, shape: cls.split('/').slice(0, 2).join('/'), tier, family: cls.split('/')[0], page: 0, count, lines: count, atMs: 0,
  title: text.split('\n')[0].slice(0, 300), dims: {},
});

describe('THE MONKEY IN THE BOTTLE — the box monkey\'s walk, on the laptop, on the manual clock', function() {
  // A walk boots a whole application; a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(3_600_000);

  if (!ENABLED) {
    it.skip('opt-in: TM_BOTTLE_MONKEY=1 (an hour of the laptop for every table)', () => undefined);
    return;
  }

  const fs = nodeRequire()('fs') as typeof import('fs');
  const path = nodeRequire()('path') as typeof import('path');
  const outDir = path.resolve(nodeProcess().cwd(), OUT, 'cause-classes');
  fs.mkdirSync(outDir, {recursive: true});
  const fixtures = bottleServer().fixtureNames()
    .filter((name) => ONLY === undefined || ONLY.test(name))
    .sort()
    .filter((_, index) => index % SHARDS === SHARD - 1);

  let bottle: ConsoleBottle | undefined;
  afterEach(async () => {
    await bottle?.dispose();
    bottle = undefined;
  });

  for (const fixture of fixtures) {
    it(`monkey · ${fixture}`, async () => {
      const seed = `${SEED}:${fixture}`;
      const r = rng(seed);
      // (The box monkey's first number chooses its landing; the stream stays in step with it.)
      r();
      const log: Array<string> = [];
      const records: Array<Filed> = [];
      let why: Array<string> = [];
      let status = 'passed';
      try {
        const table = await bottleServer().bootFixture(fixture);
        bottle = await bootBottle(table);
        await bottle.advance(3_000);
        for (let i = 0; i < PRESSES; i++) {
          // THE OTHER SEATS MOVE — every dozen presses, as on the box.
          if (i % 12 === 11) {
            for (let seat = 1; seat < table.seats.length; seat++) {
              const moved = await bottle.otherSeatMoves(seat).catch(() => undefined);
              if (moved !== undefined) {
                log.push(`[seat ${seat}] ${moved}`);
              }
            }
          }
          const key = pick(r);
          const echo = await bottle.press(key);
          log.push(`${key}:${echo}`);
          // A player's rhythm — the box monkey's own numbers.
          const roll = r();
          const pause = roll < 0.7 ? 120 + r() * 380 : roll < 0.95 ? 600 + r() * 1400 : 3000 + r() * 5000;
          await bottle.advance(Math.round(pause));
        }
        // THE LAST WORD: a quiet spell past the arbiter's grace — whatever the walk left on screen is judged.
        await bottle.advance(14_000);
        const live = bottle.liveness();
        why = live.why;
        for (const defect of live.defects) {
          records.push(filed(defect.cls, 'defect', defect.count, defect.text));
        }
        for (const blind of live.blind) {
          records.push(filed(blind.cls, 'info', blind.count, `(the bottle is blind here) ${blind.text}`));
        }
      } catch (error) {
        // A table the bottle cannot stand, or a walk it could not finish, is the HARNESS's — named, never a class of the game.
        status = 'harness';
        records.push(filed('bottle/harness-error', 'info', 1, error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)));
      }
      fs.writeFileSync(path.join(outDir, `bottle-monkey--monkey-${fixture}-r0.json`), JSON.stringify({
        file: 'monkey.bottle.ts', title: `monkey · ${fixture}`, retry: 0, status, records,
        monkey: {seed, fixture, landing: 'boot', duo: false, reload: false, presses: log.filter((l) => !l.startsWith('[')).length, perturb: {netMs: 0, cpu: 0, motion: ''}, bottle: true, why},
        walk: log.join(' '),
      }, null, 1));
      const defects = records.filter((record) => record.tier === 'defect');
      if (defects.length > 0 || status !== 'passed') {
        console.log(`      · ${fixture}: ${status === 'passed' ? defects.map((d) => d.cls).join(' | ') : `HARNESS — ${records[records.length - 1].title.slice(0, 160)}`}`);
      }
    });
  }
});
