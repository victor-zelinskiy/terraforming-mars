import {expect} from 'chai';
import {readFileSync} from 'fs';
import {join} from 'path';
import {analyseFocusTrail, FocusSample, ringCurveGain} from '../e2e/focusWitness';

/**
 * THE FOCUS WITNESS'S «SNAP» VERDICT (`tests/e2e/focusWitness.ts`, TR58) — pure, so its law is held here, not re-learned
 * on CI. A ring that loses (or gains) its strength faster than the cursor's own curve allows between two reads is a
 * snap — unless the EARLIER read caught the ring's opacity transition still PENDING (`held`): the main thread then
 * holds the transition at its start value while the compositor already plays it, and the next read jumps by the
 * compositor's latency (CI 2026-11-11, `console-cursor` «Стандартные проекты» step: «0.91 → 0.01 in 48 ms»).
 */
function row(t: number, key: string, ring: number, held?: boolean): FocusSample {
  return {t, key, ring, vis: 1, scale: 1, z: 1, box: [540, 274, 1614, 377.5], animating: false, held};
}

describe('focusWitness — the snap verdict', () => {
  it('a ring that drops faster than the curve between two plain reads is a snap', () => {
    const r = analyseFocusTrail([row(0, '0', 0.91), row(48, '0', 0.01)], [], [], 1);
    expect(r.snaps.map((s) => s.key)).to.deep.eq(['0']);
  });

  it('…and so does a ring that ARRIVES in one read — the verdict is symmetric', () => {
    const r = analyseFocusTrail([row(0, '2', 0.01), row(20, '2', 0.95), row(40, '2', 1)], [], [], 1);
    expect(r.snaps.map((s) => s.key)).to.deep.eq(['2']);
  });

  it('a pair whose earlier read caught the ring\'s transition PENDING is no evidence', () => {
    const r = analyseFocusTrail([row(0, '0', 0.91, true), row(48, '0', 0.01)], [], [], 1);
    expect(r.snaps).to.deep.eq([]);
  });

  it('…but a later pair of plain reads is judged again (a held read excuses ONE gap, never the trail)', () => {
    const r = analyseFocusTrail([row(0, '0', 0.95, true), row(30, '0', 0.95), row(60, '0', 0.02)], [], [], 1);
    expect(r.snaps.map((s) => s.key)).to.deep.eq(['0']);
  });

  it('a leave on the cursor\'s own curve, read every 4 ms, is no snap', () => {
    const trail: Array<FocusSample> = [];
    for (let t = 0; t <= 200; t += 4) {
      trail.push(row(t, '0', Math.round((1 - ringCurveGain(t)) * 100) / 100));
    }
    expect(analyseFocusTrail(trail, [], [], 1).snaps).to.deep.eq([]);
  });

  it('the sampler records the hold off the ring\'s own transition (source guard)', () => {
    const src = readFileSync(join(__dirname, '..', 'e2e', 'focusWitness.ts'), 'utf8');
    expect(src, 'every recorded row carries `held`').to.match(/held: ringHeldOf\(el\)/);
    expect(src, 'the hold reads a PENDING opacity transition on the ring layer').to.match(/a\.pending && pseudo !== null/);
    expect(src, 'the verdict skips a pair only when its EARLIER read was held').to.match(/prev\.held !== true/);
  });
});
