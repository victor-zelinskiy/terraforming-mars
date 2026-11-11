import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A PHRASE PLAYED IN THE FRAMES OF A MOUNT RIDES THE COMPOSITOR (CI 2026-11-11, `console-smoothness` (A)): the
 * target step's carry is played in the flush that inserts the step, and a GSAP timeline created there takes its clock
 * from the tick BEFORE the mount's long task — its first painted frame was the cascade well past its start (the
 * cards 0 in one sample, whole 18 ms later). `payloadCarry.ts` plays Web Animations only (animations.md law 7).
 */
describe('step entry · the payload carry is compositor-driven', () => {
  const src = fs.readFileSync(path.resolve('src/client/console/played/payloadCarry.ts'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('imports no GSAP and runs no main-thread descend episode', () => {
    expect(code).to.not.match(/from 'gsap'/);
    expect(code).to.not.match(/guardedDescend|descendCascade\(/);
  });

  it('cascades and carries through the composited primitives', () => {
    expect(code).to.match(/descendCascadeComposited\(/);
    expect(code).to.match(/descendFlipComposited\(/);
  });
});
