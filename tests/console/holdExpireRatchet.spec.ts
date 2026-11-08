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

/**
 * The call's argument text — from its `(` to the matching `)` (strings and template literals skipped) — and the same
 * text with its COMMENTS removed (`code`): a quote inside a comment («the phrase's end») is prose, never a string that
 * hides the rest of the call, and a comment that merely MENTIONS `expire` declares nothing (ledger HC).
 */
function callText(source: string, open: number): {raw: string, code: string} {
  let depth = 0;
  let quote = '';
  let code = '';
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (quote === '' && c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end - 1;
      continue;
    }
    if (quote === '' && c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    code += c;
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
        return {raw: source.slice(open, i + 1), code};
      }
    }
  }
  return {raw: source.slice(open), code};
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
      if (!/\bexpire\b/.test(args.code) && !/hold-expire: none —/.test(args.raw)) {
        missing++;
      }
    }
    if (missing > 0) {
      out[path.relative(ROOT, file).split(path.sep).join('/')] = missing;
    }
  }
  return out;
}

/** How many hold calls the scan reads at all (the anti-vacuous half). */
function holdCallCount(): number {
  let n = 0;
  for (const file of walk(CLIENT)) {
    if (file !== REGISTRY) {
      n += [...fs.readFileSync(file, 'utf8').matchAll(CALL)].length;
    }
  }
  return n;
}

describe('hold expire ratchet — a ceiling ends the owner\'s wedge, not only its count', () => {
  it('EVERY hold declares its owner\'s recovery — the worklist reached zero (ledger HC) and stays there', () => {
    const now = holdsWithoutExpire();
    if (process.env.HOLD_EXPIRE_BASELINE === 'write') {
      fs.writeFileSync(BASELINE, JSON.stringify(now, Object.keys(now).sort(), 2) + '\n');
    }
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew = Object.entries(now).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f}: ${base[f] ?? 0} → ${n}`);
    expect(grew, 'a new hold must declare its owner\'s recovery (`expire`) or `hold-expire: none — <reason>` inside the call').deep.eq([]);
    const fell = Object.entries(base).filter(([f, n]) => (now[f] ?? 0) < n).map(([f, n]) => `${f}: ${n} → ${now[f] ?? 0}`);
    expect(fell, 'the worklist shrank — lock it in: HOLD_EXPIRE_BASELINE=write').deep.eq([]);
    expect(base, 'the baseline is EMPTY since 2026-11-08: a hold without a recovery is a defect, never a worklist row').deep.eq({});
  }).timeout(20_000);

  it('reads a real corpus (anti-vacuous): the holds are found, and a comment\'s apostrophe never hides a call\'s `expire`', () => {
    expect(holdCallCount(), 'the scan reads the corpus of holds').to.be.greaterThan(40);
    const quoted = 'x(1, {\n  // the phrase\'s end\n  expire: () => undefined,\n})';
    expect(/\bexpire\b/.test(callText(quoted, 1).code), 'an apostrophe in a comment is prose, not a string').is.true;
    const mention = 'x(1, {\n  // no expire here\n  scope: \'blocking\',\n})';
    expect(/\bexpire\b/.test(callText(mention, 1).code), 'a comment MENTIONING expire declares nothing').is.false;
  }).timeout(20_000);
});
