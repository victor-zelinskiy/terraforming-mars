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
 *   fixture names) · TM_BOTTLE_MONKEY_LAYOUT (`synthetic` — measured ends are non-empty, so flights land and a walk
 *   reaches what stands behind them) · TM_BOTTLE_MONKEY_MODE (`guided` — the walk presses what the command bar offers: far deeper into
 *   the flows than the blind stream; its own seeded stream) · TM_BOTTLE_MONKEY_RELOAD (`<n>` — a reload of the page on average once in n presses, its own
 *   seeded stream: the restore road walked on every table) · TM_BOTTLE_MONKEY_SHRINK (`<regex over class keys>` — a walk that
 *   names a matching class is cut down to the steps that make it: `shrink.ts`) · TM_BOTTLE_MONKEY_SHARD (`k/n`) · TM_BOTTLE_MONKEY_OUT (default `.e2e-remote/bottle-monkey` — beside the box monkey's).
 */
import {bootBottle, ConsoleBottle, disposeLiveBottle} from './consoleBottle';
import {bottleServer, nodeProcess, nodeRequire} from './bottleNode';
import {MonkeyMode, monkeyRng, MonkeyStep, monkeyWalk, replaySteps, stepLine} from './monkeyWalk';
import {shrinkSteps} from './shrink';

const env = nodeProcess().env as Record<string, string | undefined>;
const ENABLED = env.TM_BOTTLE_MONKEY === '1';
const SEED = env.TM_BOTTLE_MONKEY_SEED ?? 'fz0';
const PRESSES = Number(env.TM_BOTTLE_MONKEY_PRESSES ?? 60);
const ONLY = env.TM_BOTTLE_MONKEY_ONLY === undefined ? undefined : new RegExp(env.TM_BOTTLE_MONKEY_ONLY);
const OUT = env.TM_BOTTLE_MONKEY_OUT ?? '.e2e-remote/bottle-monkey';
const [SHARD, SHARDS] = (env.TM_BOTTLE_MONKEY_SHARD ?? '1/1').split('/').map(Number);
/** `plain` — the box monkey's blind stream (the default); `guided` — it presses what the command bar offers (`monkeyWalk.ts`). */
const MODE: MonkeyMode = env.TM_BOTTLE_MONKEY_MODE === 'guided' ? 'guided' : 'plain';
/** `synthetic` — every displayed element has a non-empty rect, so flights land (`bottleDom.ts`); default: jsdom's 0×0. */
const LAYOUT: 'none' | 'synthetic' = env.TM_BOTTLE_MONKEY_LAYOUT === 'synthetic' ? 'synthetic' : 'none';
/**
 * THE SHRINK (`TM_BOTTLE_MONKEY_SHRINK=<regex over class keys>`, with `TM_BOTTLE_MONKEY_ONLY` naming the table): a
 * walk that names a matching class is cut down to the steps that make it (`shrink.ts` — each candidate replayed on a
 * fresh bottle) and filed as `<out>/shrunk/<fixture>.txt` — the presses to read, and to paste into a replay.
 */
const SHRINK = env.TM_BOTTLE_MONKEY_SHRINK === undefined ? undefined : new RegExp(env.TM_BOTTLE_MONKEY_SHRINK);
/** THE RELOAD: on average once in this many presses the page is reloaded where the walk stands (unset = never). */
const RELOAD_EVERY = env.TM_BOTTLE_MONKEY_RELOAD === undefined ? undefined : Number(env.TM_BOTTLE_MONKEY_RELOAD);
/** The untouched spell after a walk (`TM_BOTTLE_MONKEY_IDLE_MS`): past the arbiter's grace and the loop's twenty looks. */
const IDLE_MS = Number(env.TM_BOTTLE_MONKEY_IDLE_MS ?? 25_000);

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
  /**
   * THE WALK'S WHOLE WORLD IS ITS SEED. The presses are (the stream of `monkeyWalk`); so must be everything else that
   * rolls — the ids a fixture is remapped to, a shuffle the engine did not seed, the page's cosmetic choices: all of
   * it is `Math.random`, seeded per walk from the walk's own seed. A gate that is red on a NEW class may not owe a
   * class to a roll, and a shrink's replay must stand in the world the walk stood in.
   */
  let restoreRandom: (() => void) | undefined;
  const seedWorld = (seed: string): void => {
    restoreRandom?.();
    restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
  };
  afterEach(async () => {
    await bottle?.dispose();
    bottle = undefined;
    // …and a bottle a reload stood up inside a walk that then threw.
    await disposeLiveBottle();
    restoreRandom?.();
    restoreRandom = undefined;
  });

  for (const fixture of fixtures) {
    it(`monkey · ${fixture}`, async () => {
      const seed = `${SEED}:${fixture}`;
      let log: Array<string> = [];
      const records: Array<Filed> = [];
      let why: Array<string> = [];
      let status = 'passed';
      let coverageKeys: Array<string> = [];
      let coverage: {keys: Array<string>, machines: Record<string, Array<string>>, frames: Array<string>} | undefined;
      let steps: Array<MonkeyStep> = [];
      let seats = 1;
      try {
        seedWorld(seed);
        const table = await bottleServer().bootFixture(fixture);
        // (`coverage=1` — the page marks how much of the kernel's state space the walk went through.)
        bottle = await bootBottle(table, {query: 'coverage=1', layout: LAYOUT});
        await bottle.advance(3_000);
        const walked = await monkeyWalk(bottle, table.seats.length, seed, PRESSES, {reloadEvery: RELOAD_EVERY, mode: MODE});
        bottle = walked.bottle;
        log = walked.log;
        steps = walked.steps;
        seats = table.seats.length;
        coverageKeys = walked.carriedCoverage;
        for (const before of walked.carried) {
          records.push(filed(before.cls, before.blind ? 'info' : 'defect', before.count, before.blind ? `(the bottle is blind here) ${before.text}` : before.text));
        }
        // THE LAST WORD: a quiet spell past the arbiter's grace AND past the loop's whole road (ten untouched looks to
        // be named, ten more to be due — `livenessOscillation.ts`): whatever the walk left on screen is judged, and a
        // healthy screen left alone must neither stall nor turn.
        await bottle.advance(IDLE_MS);
        const live = bottle.liveness();
        why = live.why;
        const covered = bottle.coverage();
        if (covered !== undefined) {
          coverage = {keys: [...new Set([...coverageKeys, ...covered.keys])].sort(), machines: covered.machines, frames: covered.frames};
        }
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
        ...(coverage !== undefined ? {coverage} : {}),
        monkey: {seed, fixture, mode: MODE, layout: LAYOUT, landing: 'boot', duo: false, reload: RELOAD_EVERY !== undefined, presses: log.filter((l) => !l.startsWith('[')).length, perturb: {netMs: 0, cpu: 0, motion: ''}, bottle: true, why},
        walk: log.join(' '),
      }, null, 1));
      const defects = records.filter((record) => record.tier === 'defect');
      if (defects.length > 0 || status !== 'passed') {
        console.log(`      · ${fixture}: ${status === 'passed' ? defects.map((d) => d.cls).join(' | ') : `HARNESS — ${records[records.length - 1].title.slice(0, 160)}`}`);
      }
      // THE SHRINK — asked for by name: the first class of this walk that matches, cut down to the steps that make it.
      const target = SHRINK === undefined ? undefined : records.find((record) => SHRINK.test(record.cls))?.cls;
      if (target !== undefined && status === 'passed') {
        await bottle?.dispose();
        bottle = undefined;
        const names = async (candidate: ReadonlyArray<MonkeyStep>): Promise<boolean> => {
          seedWorld(seed);
          const table = await bottleServer().bootFixture(fixture);
          let replayed = await bootBottle(table, {layout: LAYOUT});
          try {
            await replayed.advance(3_000);
            replayed = await replaySteps(replayed, seats, candidate);
            await replayed.advance(14_000);
            const live = replayed.liveness();
            return [...live.defects, ...live.blind].some((named) => named.cls === target);
          } finally {
            await replayed.dispose();
            await disposeLiveBottle();
            bottleServer().reset();
          }
        };
        const lines = [`THE SHRINK · ${fixture} · seed ${seed} · class ${target}`];
        if (!(await names(steps))) {
          lines.push('the recorded steps do NOT name the class again on a fresh bottle — nothing to cut (a walk that does not replay is the first thing to read)');
        } else {
          const shrunk = await shrinkSteps(steps, names);
          lines.push(`${steps.length} steps → ${shrunk.steps.length} in ${shrunk.tries} replays${shrunk.cut ? ' (the budget ran out — not yet minimal)' : ''}:`,
            ...shrunk.steps.map((step) => `  ${stepLine(step)}`));
        }
        console.log(lines.map((line) => `      ${line}`).join('\n'));
        const shrunkDir = path.resolve(nodeProcess().cwd(), OUT, 'shrunk');
        fs.mkdirSync(shrunkDir, {recursive: true});
        fs.writeFileSync(path.join(shrunkDir, `${fixture}.txt`), `${lines.join('\n')}\n`);
      }
    });
  }
});
