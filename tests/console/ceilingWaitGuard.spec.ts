import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A WAIT WHOSE ONLY WAY OUT IS A CEILING STANDS ON THE PRIMITIVE (`console/waitGraph/ceilingWait.ts`) — the owner's
 * field freeze of 2026-11-08 (Flooding: a lift waited for a pay-back whose commit waited for the lift; 8 s of a still
 * card) was such a wait, invisible to the wait graph. On the primitive a wait is a node for its life and a ceiling hit
 * is SAID (`[wait-graph] ceiling …`) — the worklist of hidden mutual waits the monkey and every e2e test harvest.
 *
 * Read off the console's source: ① `Promise.race(` (the commonest hand-rolled ceiling) never outside the primitive;
 * ② a `wait…` / `await…` helper whose body carries a ceiling (a timer, a bound, a budget) reaches the primitive — or one
 * of the shared waits already on it — or is listed in `ALLOW` with its reason. A row that stops being needed fails too.
 */
const ROOTS = ['src/client/console', 'src/client/components/console'].map((r) => path.resolve(r));
const PRIMITIVE = path.resolve('src/client/console/waitGraph/ceilingWait.ts');
/** Waits already on the primitive — a helper that delegates to one of them is covered. */
const ON_PRIMITIVE = /\b(beginCeilingWait|raceCeiling|untilCeiling|waitConsoleQuiet|waitRewardPayoutQuiet|waitBoardSceneQuiet|waitBoardStoryQuiet|waitScreenHandoff|waitQuiet)\(/;
/** What makes a body a CEILING: a timer, a bound, a budget, a frame count. */
const CEILING = /\b(setTimeout|scheduleParliamentBeat|delayedCall|maxMs|budgetMs|maxFrames|cap)\b|[A-Z_]+_MS\b/;

/** `file::helper` → why it is not on the primitive. */
const ALLOW: Readonly<Record<string, string>> = {
  'src/client/console/terraformedScene/terraformedScene.ts::waitUnskippable':
    'a fixed beat of the scene (the phrase the player may not skip) — a duration, not a wait for something that may never come',
};

function files(dir: string): Array<string> {
  const out: Array<string> = [];
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...files(p));
    } else if (/\.(ts|vue)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** The body of the function / method whose declaration starts at `at` (brace matching from its first `{`). */
function bodyAt(src: string, at: number): string {
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
    } else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(open, i + 1);
      }
    }
  }
  return src.slice(open);
}

const HELPER = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function\s+)?((?:wait|await)[A-Z]\w*)\s*(?:<[^>]*>)?\([^)]*\)\s*(?::\s*Promise<[^{]*>)?\s*\{/g;

describe('ceilingWaitGuard — a wait whose only way out is a ceiling stands on the primitive', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);
  const sources = new Map<string, string>();
  for (const root of ROOTS) {
    for (const f of files(root)) {
      sources.set(f, fs.readFileSync(f, 'utf8'));
    }
  }
  const rel = (f: string) => path.relative(path.resolve('.'), f).replace(/\\/g, '/');

  it('no `Promise.race(` outside the primitive', () => {
    const offenders = [...sources].filter(([f, s]) => f !== PRIMITIVE && /Promise\.race\(/.test(s.replace(/\/\/.*$/gm, ''))).map(([f]) => rel(f));
    expect(offenders, 'race through `raceCeiling` (console/waitGraph/ceilingWait.ts)').to.deep.eq([]);
  });

  it('every ceiling-bearing wait helper reaches the primitive (or is ALLOWed with its reason); no stale ALLOW row', () => {
    const offenders: Array<string> = [];
    const seen = new Set<string>();
    for (const [f, s] of sources) {
      if (f === PRIMITIVE || /[\\/]waitGraph[\\/]/.test(f)) {
        continue;
      }
      for (const m of s.matchAll(HELPER)) {
        const key = `${rel(f)}::${m[1]}`;
        const body = bodyAt(s, m.index ?? 0);
        if (!CEILING.test(body)) {
          continue;
        }
        if (ON_PRIMITIVE.test(body)) {
          continue;
        }
        seen.add(key);
        if (ALLOW[key] === undefined) {
          offenders.push(key);
        }
      }
    }
    expect(offenders, 'put the ceiling on `beginCeilingWait` / `raceCeiling`, or list it in ALLOW with its reason').to.deep.eq([]);
    expect(Object.keys(ALLOW).filter((k) => !seen.has(k)), 'ALLOW rows no longer needed').to.deep.eq([]);
  });
});
