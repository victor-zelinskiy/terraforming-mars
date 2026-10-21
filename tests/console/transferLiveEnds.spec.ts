import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  TRANSFER_RETARGET_AT, TRANSFER_RETARGET_EPS, isTransferEnd, transferEndMoved, transferEndOf, transferEndPoint, transferRetargetWeight,
} from '../../src/client/console/resourceTransfer/resourceTransferModel';

/*
 * «ОБА КОНЦА ПОЛЁТА — ЖИВЫЕ» (T06, the owner's direction of 2026-10-21 — `.claude/rules/console-ui.md` § THE ENDS OF A
 * FLIGHT ARE VISIBLE … AND LIVE). A flight end is an OBJECT re-measured in the frame it matters — the birth, the final
 * approach, the touchdown — never a point cached at the press. The stand measured what the points did: Pets' animal
 * landed 1094 px (fhd) / 2094 px (4K) off any object, a rival's steel 23 px under red's chip over the console's bare
 * root. The pure half (the end's geometry and the retarget ramp) is pinned here; the director and the run are DOM +
 * GSAP, guarded by their SOURCE (the transferFlightClock pattern) and witnessed end to end by the e2e harness
 * (`transferEndsGuard`, every spec) and `console-flight-live-ends`.
 */
describe('a flight end is an object — the pure half', () => {
  const el = {} as Element;

  it('an end keeps the place INSIDE its object as fractions of the box — re-read against the box it has later', () => {
    const end = transferEndOf(el, {x: 100, y: 200, w: 40, h: 20}, {x: 130, y: 205});
    expect(end).deep.eq({el, fx: 0.75, fy: 0.25});
    // The object moved and grew: the end follows the SAME place on it.
    expect(transferEndPoint({x: 300, y: 50, w: 80, h: 40}, end)).deep.eq({x: 360, y: 60});
    expect(isTransferEnd(end)).eq(true);
    expect(isTransferEnd({x: 1, y: 2})).eq(false);
    expect(isTransferEnd(undefined)).eq(false);
  });

  it('a point outside the box is clamped onto its edge — an end is ON its object; no point is its centre', () => {
    expect(transferEndOf(el, {x: 0, y: 0, w: 10, h: 10}, {x: -5, y: 30})).deep.eq({el, fx: 0, fy: 1});
    expect(transferEndOf(el, {x: 0, y: 0, w: 10, h: 10})).deep.eq({el, fx: 0.5, fy: 0.5});
  });

  it('the retarget ramp: nothing before the read, the whole correction at the touchdown, monotonic and smooth between', () => {
    const readAt = TRANSFER_RETARGET_AT;
    expect(transferRetargetWeight(0.5, readAt)).eq(0);
    expect(transferRetargetWeight(readAt, readAt)).eq(0);
    expect(transferRetargetWeight(1, readAt)).eq(1);
    let last = 0;
    let lastStep = 0;
    for (let q = readAt; q <= 1.0001; q += 0.01) {
      const w = transferRetargetWeight(Math.min(1, q), readAt);
      expect(w, `monotonic at ${q.toFixed(2)}`).gte(last);
      lastStep = w - last;
      last = w;
    }
    // Smooth into the touchdown: the last step of the ramp is small (the token decelerates onto the moved object).
    expect(lastStep, 'no jerk in the last frame').lessThan(0.02);
    // No read (the destination asked nothing) — no correction ever.
    expect(transferRetargetWeight(0.95, -1)).eq(0);
  });

  it('a move below the measuring noise is not a moved object', () => {
    expect(transferEndMoved({x: 10, y: 10}, {x: 10 + TRANSFER_RETARGET_EPS, y: 10})).eq(false);
    expect(transferEndMoved({x: 10, y: 10}, {x: 13, y: 10})).eq(true);
  });
});

const ROOT = path.resolve(__dirname, '..', '..', 'src', 'client', 'console');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

describe('a flight end is an object — the director and the run (source guard)', () => {
  const director = read('resourceTransfer/resourceTransferDirector.ts');
  const run = read('resourceTransfer/consoleResourceTransfer.ts');
  const body = (src: string, name: string) => {
    const start = src.indexOf(`function ${name}(`);
    expect(start, `«${name}» still exists`).greaterThan(-1);
    return src.slice(start, src.indexOf('\n}\n', start));
  };

  it('the SOURCE is measured in the birth frame — gone means never born, moved means born where it is', () => {
    const born = body(director, 'bornThenFlown');
    expect(born.indexOf('if (place !== undefined && !place())'), 'the birth asks the source before it turns visible')
      .lessThan(born.indexOf('gsap.set(chip, {autoAlpha: TRANSFER_BIRTH_ALPHA});'));
    const flight = body(director, 'runTransferFlight');
    expect(flight).to.include('const at = opts.liveFrom();');
    expect(flight, 'a gone source reports itself and is not flown').to.include(`report.born = 'unpainted';`);
    expect(flight, 'a moved source re-plans the arc from where it is').to.include('plan = planFrom(at);');
  });

  it('the DESTINATION is re-read on the final approach (ramped in, no jerk) and once more at the touchdown (a glide)', () => {
    const flight = body(director, 'runTransferFlight');
    expect(flight).to.include('prog.q >= TRANSFER_RETARGET_AT && opts.liveTo !== undefined');
    expect(flight).to.include('transferRetargetWeight(prog.q, corr.readAt)');
    expect(flight, 'a gone end with no stand-in: absorbed in the air where it is, never flown into the old pose').to.include('restingAt = transferArcPoint(plan, prog.q);');
    expect(flight, 'the touchdown reads the end again and glides onto it').to.include('transferEndMoved(restingAt, live)');
    expect(flight, 'the contact beat plays where the chip came to rest').to.include('absorbChip(piece, restingAt, absorbMs)');
    expect(flight, 'never a frame clock of its own — the animation clock alone').to.not.match(/requestAnimationFrame|setTimeout\(/);
  });

  it('the run keeps every end as what it is (an object, the home ladder, a bare point) and hands the director live closures', () => {
    const fn = run.slice(run.indexOf('export async function runResourceTransfers('), run.indexOf('/** One end of a flight as it IS'));
    expect(fn).to.include(`liveFrom,`);
    expect(fn).to.include(`liveTo: () => measureEndRef(e.toRef, e.spec, 'destination'),`);
    expect(fn, 'a double of the home re-homes there, never into the pose it had').to.include('standIn: () => targetPointFor(e.spec)');
    expect(fn, 'the surface folds on the tokens\' own departures').to.include('void Promise.all(departures).then(leftOnce);');
    const measure = body(run, 'measureEndRef');
    expect(measure, 'an object end passes the ONE verdict of a visible end').to.include('transferEndVerdict(ref.el, opts)');
    expect(measure, 'a destination is measured at REST').to.include(`role === 'destination' ? restingRectOf(ref.el as HTMLElement)`);
  });

  it('the SENTINEL speaks in every build — the e2e harness turns it red on every spec', () => {
    const sentinel = body(run, 'sentinel');
    expect(sentinel).to.include('[transfer] end not painted');
    expect(sentinel, 'never gated on a dev build (the e2e serves a production bundle)').to.not.include('NODE_ENV');
    const harness = fs.readFileSync(path.resolve(__dirname, '..', 'e2e', 'consoleTest.ts'), 'utf8');
    expect(harness).to.include(`const TRANSFER_END_NOT_PAINTED = '[transfer] end not painted';`);
    expect(harness).to.include('transferEndsGuard: [async ({context}, use) => {');
  });
});
