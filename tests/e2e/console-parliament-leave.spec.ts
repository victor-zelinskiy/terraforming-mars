import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openMandatoryAnnounce, press, pressUntil, settle} from './consoleStart';
import {answerGateAs, focusParliamentZone, mandatoryPlate, openParliament, parliament, parliamentWire, sittingStage, waitSittingAtRest} from './parliamentDrive';

/**
 * THE PARLIAMENT LEAVES AS ONE SURFACE (v2, § Б5). From the flow's end to the root's unmount every frame
 * shows either the surface WITH its body (the vote layer with its cards, or the tiers and the stage) or
 * the root already dissolving as a whole — never a frame with the crumb and the head standing over an
 * EMPTY body (the pre-v2 vote faded its layer first, 220 ms of a frame over a parked body; the sitting
 * folded its stage to browse under a leaving frame). Three endings: a vote's, the sitting's, and B's
 * «свернуть». The sampler is `setInterval` + `MutationObserver`, never rAF.
 */
type LeaveSample = {t: number, root: boolean, stage: string, frame: number, content: number};
type LeaveProbe = {samples: Array<LeaveSample>};

async function armLeaveProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__leave: LeaveProbe};
    w.__leave = {samples: []};
    /** The EFFECTIVE opacity of an element: its own, times every ancestor's up to the parliament root (inclusive). */
    const effective = (el: Element | null): number => {
      if (el === null) {
        return 0;
      }
      let o = 1;
      for (let a: Element | null = el; a !== null && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        o *= Number(cs.opacity);
        if (a.classList.contains('con-parl')) {
          break;
        }
      }
      return o;
    };
    const sample = () => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      if (root === null) {
        w.__leave.samples.push({t: performance.now(), root: false, stage: '', frame: 0, content: 0});
        return;
      }
      const frame = effective(root.querySelector('.con-parl__head'));
      // The CONTENT is whatever the body currently shows: the vote layer while it stands, else the tiers and the stage.
      const vote = root.querySelector('.con-parl__vote--up');
      const candidates = vote !== null ? [vote] : Array.from(root.querySelectorAll('.con-parl__gov, .con-parl__voting, .con-parl__stage, .con-parl__parties-tier, .con-parl__agenda'));
      const content = candidates.reduce((max, el) => Math.max(max, effective(el)), 0);
      w.__leave.samples.push({t: performance.now(), root: true, stage: root.getAttribute('data-stage') ?? '', frame, content});
      if (w.__leave.samples.length > 8000) {
        w.__leave.samples.splice(0, 1000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-stage']});
    window.setInterval(sample, 16);
  });
}
const readLeave = (page: Page): Promise<LeaveProbe> => page.evaluate(() => (window as unknown as {__leave: LeaveProbe}).__leave);

/** Frames with the FRAME visible and the CONTENT gone — the defect this probe exists for. */
function emptyFrames(samples: ReadonlyArray<LeaveSample>): Array<string> {
  return samples.filter((s) => s.root && s.frame > 0.3 && s.content < 0.1)
    .map((s) => `@${Math.round(s.t)} ms stage=${s.stage} frame=${s.frame.toFixed(2)} content=${s.content.toFixed(2)}`);
}

test.describe('the parliament leaves as one surface (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a vote\'s end: from the landing to the unmount, never a frame over an empty body', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'parliament', {query: '&consoleProfile=auto', landing: 'board'});
    await openParliament(page);
    await focusParliamentZone(page, 'voting');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200})).toBe(true);
    await settle(page, {timeoutMs: 20_000});
    await armLeaveProbe(page);
    await press(page, 'Enter', 200);
    await expect(parliament(page), 'the flow left').toHaveCount(0, {timeout: 40_000});
    const s = (await readLeave(page)).samples;
    const landedAt = s.findIndex((x) => x.stage === 'landed');
    expect(landedAt, 'the landing was seen').toBeGreaterThanOrEqual(0);
    const gone = s.findIndex((x, i) => i > landedAt && !x.root);
    expect(gone, 'the root left').toBeGreaterThan(landedAt);
    expect(s.slice(landedAt, gone).length, 'the sampler lived through the leave').toBeGreaterThan(5);
    expect(emptyFrames(s.slice(landedAt, gone)), 'no frame stood over an empty body').toEqual([]);
  });

  test('the sitting\'s end: the phase is over — the stage leaves WITH the frame, never folding to browse first', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-architecture-adjourn', {query: '&consoleProfile=auto', landing: 'prompt'});
    const red = seats[1];
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    await press(page, 'Enter', 1200);
    await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000}).toBeUndefined();
    await armLeaveProbe(page);
    await answerGateAs(request, red, 'adjourn');
    await expect(parliament(page), 'the sitting leaves with the phase').toHaveCount(0, {timeout: 60_000});
    const s = (await readLeave(page)).samples;
    const gone = s.findIndex((x) => !x.root);
    expect(gone, 'the root left').toBeGreaterThan(0);
    expect(s.slice(0, gone).every((x) => x.stage === 'sitting' || x.stage === 'submitting'), 'the stage never folded to browse before the leave').toBe(true);
    expect(emptyFrames(s.slice(0, gone)), 'no frame stood over an empty body').toEqual([]);
  });

  test('B «свернуть» on the verdict: the whole surface parks as one motion', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 20_000);
    await armLeaveProbe(page);
    await press(page, 'Escape', 200);
    await expect(parliament(page), 'the workspace parked').toHaveCount(0, {timeout: 20_000});
    await expect(mandatoryPlate(page), 'the return card').toHaveCount(1, {timeout: 15_000});
    const s = (await readLeave(page)).samples;
    const gone = s.findIndex((x) => !x.root);
    expect(gone).toBeGreaterThan(0);
    expect(emptyFrames(s.slice(0, gone)), 'no frame stood over an empty body').toEqual([]);
  });
});
