import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A COLONY TRACK'S MARKER WALK IS RIGHT ON A SLOW FRAME BY CONSTRUCTION (animations.md § A MOTION IS RIGHT ON A SLOW
 * FRAME, law 2 — a dependent beat follows its predecessor's EVENT, in a LATER frame).
 *
 * One starved tick used to carry the whole walk (CI-like box runs of `console-colony-sponsors`, ~1 in 8): the proxy's
 * first painted pose was already mid-track — never on the cell it left — and the last cell's touch and the landing
 * fell into one task, so the destination never lit up as crossed before the marker sat on it. Source guard — the
 * director is DOM + GSAP and its real proof is that e2e probe.
 */
const DIRECTOR = path.resolve(__dirname, '..', '..', 'src', 'client', 'console', 'colonyTrade', 'colonyTradeDirector.ts');

describe('the colony track glide — a birth painted on its cell, a landing after its last touch', () => {
  const raw = fs.readFileSync(DIRECTOR, 'utf8').replace(/\r\n/g, '\n');
  const start = raw.indexOf('export function runColonyTrackGlide(');
  const glide = raw.slice(start, raw.indexOf('\n}\n', start));

  it('the director still has the glide', () => {
    expect(start).to.be.greaterThan(-1);
  });

  it('the proxy is BORN on its cell (visible, on a tick) and the glide is built only in a LATER frame', () => {
    const born = glide.slice(glide.indexOf('const born = (): void => {'));
    expect(born, 'the birth turns the proxy visible where it stands').to.include('gsap.set(marker, {autoAlpha: 1});');
    expect(born, 'the glide waits for a later frame').to.include('laterFrame(glide);');
    // …on the MOTION clock, with an owner (`motionAfter` = `gsap.delayedCall` as a row of the session's wait table).
    expect(glide, 'the stagger is the birth\'s, never a delay on the timeline').to.include('motionAfter(s(args.delayMs ?? 0) * 1000, ');
    expect(glide, 'the birth is the stagger\'s callback').to.match(/motionAfter\(s\(args\.delayMs \?\? 0\) \* 1000, '[^\n]*', born\)/);
    expect(glide, 'a later frame is counted on the ticker').to.include('if (gsap.ticker.frame <= since) {');
    expect(glide, 'never a wall clock').to.not.match(/setTimeout|requestAnimationFrame/);
  });

  it('the landing FOLLOWS the last cell\'s touch — never in the frame that touched it', () => {
    expect(glide, 'the timeline ends on the guarded landing').to.include('gsap.timeline({onComplete: landed})');
    const landed = glide.slice(glide.indexOf('const landed = (): void => {'), glide.indexOf('const glide = (): void => {'));
    expect(landed).to.include('if (lastTouchFrame === gsap.ticker.frame) {');
    expect(landed).to.include('laterFrame(args.onLanded);');
    expect(glide, 'every touch goes through the frame-keeping one').to.not.match(/args\.onCellPassed\(i\), undefined/);
  });

  it('a kill cancels the birth, the glide and every frame waiter', () => {
    const kill = glide.slice(glide.lastIndexOf('return {kill: () => {'));
    expect(kill).to.include('cancelBirth();');
    expect(kill).to.include('tl?.kill();');
    expect(kill).to.include('gsap.ticker.remove(w)');
  });
});
