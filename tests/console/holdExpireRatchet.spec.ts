import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A HOLD'S CEILING ENDS THE WEDGE, NOT JUST THE COUNT — a ratchet over every hold that cannot say how its owner
 * recovers (animations.md § «The ceiling MASKS the hold — it cannot fix the owner's state»).
 *
 * The law has stood since 2026-09-10 and was still broken by the owner's field lock of 2026-11-07 01:20: the chairman
 * quest's beat never landed, its hold hit the 20 s ceiling, the registry dropped the COUNT — and the director's run
 * stood «in a beat» with nothing in flight, B absorbed and A «дожать» with nothing to drive, over the next action menu.
 * A ceiling with no `expire` releases the gate everybody else reads and leaves the flow that set it wedged.
 *
 * The rule: every `beginAnimationHold(` / `registerAnimationHoldSupplier(` call carries `expire` (the owner's honest
 * recovery — its abort, its settle), or says in a comment INSIDE the call why there is nothing to recover:
 * `hold-expire: none — <reason>` (a pure count over a GSAP timeline that releases on kill too, for instance).
 * The holds that predate the rule are a per-file BASELINE (`holdExpireBaseline.json`) — the worklist: growth fails
 * (declare the recovery), a fall fails until locked in the same diff (`HOLD_EXPIRE_BASELINE=write`).
 */
const ROOT = path.resolve(__dirname, '..', '..');
const CLIENT = path.join(ROOT, 'src', 'client');
const REGISTRY = path.join(CLIENT, 'components', 'presentation', 'animationHold.ts');
const BASELINE = path.join(__dirname, 'holdExpireBaseline.json');
const CALL = /\b(beginAnimationHold|registerAnimationHoldSupplier)\(/g;

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The call's argument text — from its `(` to the matching `)` (strings and template literals skipped). */
function callText(source: string, open: number): string {
  let depth = 0;
  let quote = '';
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (quote !== '') {
      if (c === '\\') {
        i++;
      } else if (c === quote) {
        quote = '';
      }
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      quote = c;
    } else if (c === '(') {
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0) {
        return source.slice(open, i + 1);
      }
    }
  }
  return source.slice(open);
}

/** Per file: the holds that declare neither `expire` nor a `hold-expire: none — …` reason. */
function holdsWithoutExpire(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const file of walk(CLIENT)) {
    if (file === REGISTRY) {
      continue;
    }
    const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    let missing = 0;
    for (const m of source.matchAll(CALL)) {
      const lineStart = source.lastIndexOf('\n', m.index) + 1;
      const before = source.slice(lineStart, m.index);
      // A mention in a comment / doc line is not a call.
      if (/^\s*(\/\/|\*|\/\*)/.test(before) || /^\s*export function\b/.test(before)) {
        continue;
      }
      const args = callText(source, m.index + m[0].length - 1);
      if (!/\bexpire\b/.test(args) && !/hold-expire: none —/.test(args)) {
        missing++;
      }
    }
    if (missing > 0) {
      out[path.relative(ROOT, file).split(path.sep).join('/')] = missing;
    }
  }
  return out;
}

describe('hold expire ratchet — a ceiling ends the owner\'s wedge, not only its count', () => {
  it('no hold without `expire` beyond the baseline; a fall is locked in the same diff', () => {
    const now = holdsWithoutExpire();
    if (process.env.HOLD_EXPIRE_BASELINE === 'write') {
      fs.writeFileSync(BASELINE, JSON.stringify(now, Object.keys(now).sort(), 2) + '\n');
    }
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew = Object.entries(now).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f}: ${base[f] ?? 0} → ${n}`);
    expect(grew, 'a new hold must declare its owner\'s recovery (`expire`) or `hold-expire: none — <reason>` inside the call').deep.eq([]);
    const fell = Object.entries(base).filter(([f, n]) => (now[f] ?? 0) < n).map(([f, n]) => `${f}: ${n} → ${now[f] ?? 0}`);
    expect(fell, 'the worklist shrank — lock it in: HOLD_EXPIRE_BASELINE=write').deep.eq([]);
  }).timeout(20_000);

  it('reads a real corpus (anti-vacuous): the chairman quest\'s hold is out of the worklist, holds exist', () => {
    const now = holdsWithoutExpire();
    expect(now['src/client/console/parliament/chairmanQuestDirector.ts'], 'the 2026-11-07 hold declares its recovery').eq(undefined);
    expect(Object.keys(now).length, 'the worklist is real').to.be.greaterThan(5);
  }).timeout(20_000);
});
