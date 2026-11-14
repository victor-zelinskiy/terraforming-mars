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
import {bootBottle, ConsoleBottle} from './consoleBottle';
import {bottleServer, nodeProcess, nodeRequire} from './bottleNode';
import {monkeyWalk} from './monkeyWalk';

const env = nodeProcess().env as Record<string, string | undefined>;
const ENABLED = env.TM_BOTTLE_MONKEY === '1';
const SEED = env.TM_BOTTLE_MONKEY_SEED ?? 'fz0';
const PRESSES = Number(env.TM_BOTTLE_MONKEY_PRESSES ?? 60);
const ONLY = env.TM_BOTTLE_MONKEY_ONLY === undefined ? undefined : new RegExp(env.TM_BOTTLE_MONKEY_ONLY);
const OUT = env.TM_BOTTLE_MONKEY_OUT ?? '.e2e-remote/bottle-monkey';
const [SHARD, SHARDS] = (env.TM_BOTTLE_MONKEY_SHARD ?? '1/1').split('/').map(Number);

// (The walk itself — the generator, the pad's weights, the rhythm — is `monkeyWalk.ts`: the class replays use it too.)

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
      let log: Array<string> = [];
      const records: Array<Filed> = [];
      let why: Array<string> = [];
      let status = 'passed';
      try {
        const table = await bottleServer().bootFixture(fixture);
        bottle = await bootBottle(table);
        await bottle.advance(3_000);
        log = await monkeyWalk(bottle, table.seats.length, seed, PRESSES);
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
