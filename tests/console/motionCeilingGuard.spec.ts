import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A CEILING IS NEVER MOTION-SCALED DOWN (FLAKE ZERO Ф4, class N — `.claude/rules/animations.md` § A MOTION IS RIGHT
 * ON A SLOW FRAME BY CONSTRUCTION; `motionCeilingMs` in `src/client/components/motion/motionTokens.ts`).
 *
 * A «never happened» bound over a motion / a scene — a SAFETY, a MAX, a CEILING, a WAIT bound — that goes through
 * `motionMs` / `consoleMotionMs` HALVES under the functional e2e's `?motion=0.5` (and collapses to a blink under
 * reduced motion through `consoleMotionMs`), while the awaited thing takes a machine's frames, not the setting's:
 * on CI's 300 ms software frame the bound ran out with the scene legitimately still on its way, and its expiry changed
 * what the player saw (an absorb in place, a snap, a scene cut). The audit of 2026-11-16 found ~30 such sites; every
 * one is `motionCeilingMs` now (or re-bound to its event) and the baseline is EMPTY — the zero is the law: a new
 * bound is `motionCeilingMs`, and a constant that is genuinely a DURATION (a beat, a pace) is named as one.
 *
 * The scan: a call `motionMs(` / `consoleMotionMs(` whose argument is a constant NAMED like a bound
 * (`…SAFETY…_MS`, `…MAX…_MS`, `…CEILING…_MS`, `…WAIT…_MS`, `…NET…_MS`, `…BACKSTOP…_MS`, `…GUARD…_MS`, `…TIMEOUT…_MS`,
 * `…BOUND…_MS`, `…BUDGET…_MS`). GROWTH fails (a new file starts at zero); a FALL fails until locked in
 * (`MOTION_CEILING_BASELINE=write`, or edit `tests/console/motionCeilingBaseline.json` in the same diff).
 */
const SRC = path.resolve(__dirname, '../../src/client');
const BASELINE = path.resolve(__dirname, 'motionCeilingBaseline.json');
// A bound's word is a whole SEGMENT of the constant's name (`…_NET_MS`, `CHARGE_NET_MS`) — never a substring
// (`PLANET_FOCUS_ENTER_MS` is a duration whose «PLANET» merely contains «NET»).
export const SCALED_CEILING =
  /\b(?:consoleMotionMs|motionMs)\(\s*(?:[A-Z0-9]+_)*(?:SAFETY|MAX|CEILING|WAIT|NET|BACKSTOP|GUARD|TIMEOUT|BOUND|BUDGET)(?:_[A-Z0-9]+)*_MS\b/g;

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, (_m, p1: string) => p1);
}

function filesUnder(dir: string): Array<string> {
  const out: Array<string> = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...filesUnder(full));
    } else if (/\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

export function scaledCeilingSites(text: string): Array<string> {
  return Array.from(stripComments(text).matchAll(SCALED_CEILING)).map((m) => m[0]);
}

describe('motionCeilingGuard — a «never happened» ceiling is never motion-scaled down', function() {
  // A tree walk, not a timing — the budget is that walk on a busy box.
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);

  it('the scan SEES a scaled ceiling — and not a duration, not motionCeilingMs, not a comment (negative control)', () => {
    expect(scaledCeilingSites('const t = motionMs(DEAL_START_SAFETY_MS);')).to.have.length(1);
    expect(scaledCeilingSites('flow.after(consoleMotionMs(STAGE_WAIT_MAX_MS), w, f);')).to.have.length(1);
    expect(scaledCeilingSites('const t = motionMs(CARD_LIFT_MS);'), 'a duration').to.have.length(0);
    expect(scaledCeilingSites('}, consoleMotionMs(PLANET_FOCUS_ENTER_MS));'), 'a word inside a word is not a bound').to.have.length(0);
    expect(scaledCeilingSites('guarantee(motionMs(CHARGE_NET_MS), w, f);'), 'a whole segment is').to.have.length(1);
    expect(scaledCeilingSites('const t = motionCeilingMs(DEAL_START_SAFETY_MS);'), 'the right form').to.have.length(0);
    expect(scaledCeilingSites('// motionMs(DEAL_START_SAFETY_MS) was the bug'), 'a comment').to.have.length(0);
  });

  it('THE RATCHET: scaled ceilings per file never grow, and a fall is locked in', () => {
    const counts: Record<string, number> = {};
    const sites: Record<string, Array<string>> = {};
    for (const file of filesUnder(SRC)) {
      const found = scaledCeilingSites(fs.readFileSync(file, 'utf8'));
      if (found.length > 0) {
        const rel = path.relative(SRC, file).split(path.sep).join('/');
        counts[rel] = found.length;
        sites[rel] = found;
      }
    }
    if (process.env.MOTION_CEILING_BASELINE === 'write') {
      const sorted = Object.fromEntries(Object.keys(counts).sort().map((k) => [k, counts[k]]));
      fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + String.fromCharCode(10));
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew: Array<string> = [];
    const fell: Array<string> = [];
    for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
      const now = counts[file] ?? 0;
      const was = baseline[file] ?? 0;
      if (now > was) {
        grew.push(`${file}: ${was} → ${now} — a «never happened» bound is motionCeilingMs (scales up, never down), a duration ` +
          `is named as one; bind the wait to its EVENT (animations.md § A MOTION IS RIGHT ON A SLOW FRAME): ${sites[file].join(' · ')}`);
      } else if (now < was) {
        fell.push(`${file}: ${was} → ${now}`);
      }
    }
    expect(grew, grew.join(String.fromCharCode(10))).to.deep.eq([]);
    expect(fell, 'the scaled-ceiling debt FELL — lock it in: tests/console/motionCeilingBaseline.json (or run with ' +
      `MOTION_CEILING_BASELINE=write)${String.fromCharCode(10)}${fell.join(String.fromCharCode(10))}`).to.deep.eq([]);
  });
});
