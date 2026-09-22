import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openMandatoryAnnounce, press, pressUntil, settle} from './consoleStart';
import {answerGateAs, focusParliamentZone, mandatoryPlate, openParliament, parliament, parliamentWire, sittingStage, waitSittingAtRest} from './parliamentDrive';

/**
 * THE PARLIAMENT LEAVES AS ONE SURFACE (v2 § Б5, v3 § В1). From the flow's end to the root's unmount every
 * frame shows the surface WHOLE: every inner block — the government's seat, the ruler's tile, the voting
 * area's slots, the Agenda's track, and the stage panel (the sitting) or the vote layer (a vote) or the
 * opposition row (browse) — is NON-EMPTY in every sample while the root exists, whether the root is still
 * standing or already dissolving. The pre-v3 leave let the surface RE-COMPUTE from the live model while
 * the root was on its way out: the phase's data already gone, each block emptied at its own pace (the
 * government drawn, the ruler's block empty, the voting area empty, the board showing through). Since
 * v3 the leave FREEZES the surface on a latch of the last coherent state, so only the root fades, as one
 * motion. Three endings: a vote's, the sitting's, and B's «свернуть». The sampler is `setInterval` +
 * `MutationObserver`, never rAF.
 */
type Blocks = {gov: boolean, ruler: boolean, voting: boolean, agenda: boolean, stage: boolean | undefined, vote: boolean | undefined, parties: boolean | undefined};
/** The counts behind the verdicts — a failure names WHAT vanished, never just «a block was empty». */
type Counts = {rowTiles: number, rulerTiles: number, voteCards: number, slots: number, steps: number, mounted: string, docTiles: number, rulerSlot: number, tierShown: string, roots: number};
type LeaveSample = {t: number, root: boolean, leaving: boolean, opacity: number, stage: string, frame: number, content: number, blocks: Blocks, counts: Counts};
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
    const shown = (el: Element | null): boolean => el !== null && getComputedStyle(el).display !== 'none';
    const sample = () => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      if (root === null) {
        w.__leave.samples.push({t: performance.now(), root: false, leaving: false, opacity: 0, stage: '', frame: 0, content: 0,
          blocks: {gov: false, ruler: false, voting: false, agenda: false, stage: undefined, vote: undefined, parties: undefined},
          counts: {rowTiles: 0, rulerTiles: 0, voteCards: 0, slots: 0, steps: 0, mounted: '', docTiles: 0, rulerSlot: 0, tierShown: '', roots: 0}});
        return;
      }
      const frame = effective(root.querySelector('.con-parl__head'));
      const vote = root.querySelector('.con-parl__vote--up');
      const candidates = vote !== null ? [vote] : Array.from(root.querySelectorAll('.con-parl__gov, .con-parl__voting, .con-parl__stage, .con-parl__parties-tier, .con-parl__agenda'));
      const content = candidates.reduce((max, el) => Math.max(max, effective(el)), 0);
      // THE BLOCKS (v3): each one either carries its objects or is EMPTY — structurally, never by opacity
      // (the root's dissolve dims everything alike; an emptied block is a block whose objects are gone).
      const stageEl = root.querySelector('.con-parl__stage');
      const partiesTier = root.querySelector('.con-parl__parties-tier');
      const blocks: Blocks = {
        gov: root.querySelector('.con-parl__gov .con-parl__gov-card .pcard, .con-parl__gov .con-parl__gov-empty') !== null,
        ruler: root.querySelector('[data-parl-ruler] .con-parl__party') !== null,
        // In the vote mode the slots are CARRIED into the vote layer (their homes stand empty by design): the area's content is the layer's cards.
        voting: vote !== null ? vote.querySelectorAll('.pcard').length > 0 : root.querySelectorAll('.con-parl__voting .con-parl__slot').length > 0,
        agenda: root.querySelectorAll('.con-parl__agenda .con-parl__step').length > 0,
        stage: stageEl === null ? undefined : (stageEl.querySelector('.con-sit__panel--on')?.textContent?.trim() ?? '') !== '' || stageEl.querySelector('.con-seat__panel') !== null,
        vote: vote === null ? undefined : vote.querySelectorAll('.pcard').length > 0,
        parties: stageEl !== null || !shown(partiesTier) ? undefined : root.querySelectorAll('.con-parl__parties .con-parl__party').length === 5,
      };
      w.__leave.samples.push({
        t: performance.now(), root: true,
        // The director freezes a departing section at its live rect (position: fixed) in the leave hook itself — the
        // positive «the root is leaving» witness, before the first dimmed frame.
        leaving: root.style.position === 'fixed' || Number(getComputedStyle(root).opacity) < 0.999,
        opacity: Number(getComputedStyle(root).opacity),
        stage: root.getAttribute('data-stage') ?? '', frame, content, blocks,
        counts: {
          rowTiles: root.querySelectorAll('.con-parl__parties .con-parl__party').length,
          rulerTiles: root.querySelectorAll('[data-parl-ruler] .con-parl__party').length,
          voteCards: root.querySelectorAll('.con-parl__vote .pcard').length,
          slots: root.querySelectorAll('.con-parl__voting .con-parl__slot').length,
          steps: root.querySelectorAll('.con-parl__agenda .con-parl__step').length,
          mounted: root.getAttribute('data-parl-leaving') ?? '-',
          docTiles: document.querySelectorAll('.con-parl__party').length,
          rulerSlot: document.querySelectorAll('[data-parl-ruler-slot]').length,
          tierShown: ((el) => el === null ? 'none' : getComputedStyle(el).display)(root.querySelector('.con-parl__parties-tier')),
          roots: document.querySelectorAll('.con-parl').length,
        },
      });
      if (w.__leave.samples.length > 8000) {
        w.__leave.samples.splice(0, 1000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-stage']});
    window.setInterval(sample, 16);
  });
}
const readLeave = (page: Page): Promise<LeaveProbe> => page.evaluate(() => (window as unknown as {__leave: LeaveProbe}).__leave);

/** Frames with the FRAME visible and the CONTENT gone — the v2 defect. */
function emptyFrames(samples: ReadonlyArray<LeaveSample>): Array<string> {
  return samples.filter((s) => s.root && s.frame > 0.3 && s.content < 0.1)
    .map((s) => `@${Math.round(s.t)} ms stage=${s.stage} frame=${s.frame.toFixed(2)} content=${s.content.toFixed(2)}`);
}

/** Frames where the root EXISTS and any inner block stands EMPTY — the v3 defect (a surface re-computing on its way out). */
function emptyBlockFrames(samples: ReadonlyArray<LeaveSample>): Array<string> {
  return samples.filter((s) => s.root).flatMap((s) => {
    const empty = (Object.keys(s.blocks) as Array<keyof Blocks>).filter((k) => s.blocks[k] === false);
    return empty.length === 0 ? [] : [`@${Math.round(s.t)} ms stage=${s.stage} leaving=${s.leaving} latched=${s.counts.mounted} opacity=${s.opacity.toFixed(2)} empty=${empty.join(',')} counts=${JSON.stringify(s.counts)}`];
  });
}

async function expectWholeLeave(page: Page, from: number, label: string): Promise<void> {
  const all = (await readLeave(page)).samples;
  const s = all.slice(from);
  const before = all[Math.max(0, from - 1)] ?? all[0];
  const gone = s.findIndex((x) => !x.root);
  // The BASELINE: what stood one sample before the window. An «empty» block that was already empty then is the
  // scenario's own shape, not the leave's doing — the message says so instead of blaming the leave.
  const baseline = `baseline @${Math.round(before.t)} ms stage=${before.stage} counts=${JSON.stringify(before.counts)}`;
  expect(gone, `${label}: the root left`).toBeGreaterThan(0);
  const during = s.slice(0, gone);
  // A 170 ms section leave at a 16 ms interval is ~10 samples; a loaded runner can halve that — only a DEAD sampler fails this.
  expect(during.length, `${label}: the sampler lived through the leave`).toBeGreaterThanOrEqual(3);
  expect(during.some((x) => x.leaving), `${label}: the leave was seen`).toBe(true);
  expect(emptyFrames(during), `${label}: no frame stood over an empty body`).toEqual([]);
  const offenders = emptyBlockFrames(during);
  expect(offenders, `${label}: no frame with an EMPTY block while the root exists (${offenders.length} of ${during.length} samples)\n${baseline}\n${offenders.slice(0, 4).join('\n')}`).toEqual([]);
}

test.describe('the parliament leaves as one surface (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a vote\'s end: from the landing to the unmount, every block stands until the root is gone', async ({page, request}) => {
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
    await expectWholeLeave(page, landedAt, 'the vote\'s end');
  });

  test('the sitting\'s end: the phase is over — the stage leaves WITH the frame, every block standing, never folding to browse first', async ({page, request}) => {
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
    const trail = s.slice(0, gone).map((x) => x.stage).filter((v, i, all) => i === 0 || all[i - 1] !== v);
    expect(s.slice(0, gone).every((x) => x.stage === 'sitting' || x.stage === 'submitting'),
      `the stage never folded to browse before the leave (trail: ${trail.join(' → ')})`).toBe(true);
    await expectWholeLeave(page, 0, 'the sitting\'s end');
  });

  test('B «свернуть» on the verdict: the whole surface parks as one motion, every block standing', async ({page, request}) => {
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
    await expectWholeLeave(page, 0, 'B «свернуть»');
  });

  /*
   * THE LEAVE IS A CROSSFADE (surfaceMotionDirector § sectionLeaveEpisode). The section is GLASS: while it
   * stands the board behind it is hidden, and the leave re-shows the board in its first task. Before the fix
   * the planet showed at FULL strength through a surface still at opacity 1 — the plates seemed to vanish
   * into the planet and only the opaque resolution cards stayed, going a beat later. Now the board rises on
   * the section's own curve: in every task-clock sample while the root exists, the board is never more
   * visible than the glass has let go (board ≤ 1 − root + slack), and no resolution card outlives its root.
   */
  test('closing from the overview: the board rises exactly as the glass lets go, and the cards leave with the surface', async ({page, request}) => {
    test.setTimeout(180_000);
    await bootFixtureSeats(page, request, 'parliament', {query: '&consoleProfile=auto', landing: 'board'});
    await openParliament(page);
    await settle(page, {timeoutMs: 20_000});
    await page.evaluate(() => {
      const w = window as unknown as {__xfade: Array<{root: number, board: number, cards: Array<number>}>};
      w.__xfade = [];
      const ink = (el: Element | null): number => {
        if (el === null) {
          return -1;
        }
        let v = 1;
        for (let n: Element | null = el; n !== null && n !== document.documentElement; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none') {
            return 0;
          }
          v *= Number(cs.opacity);
        }
        return getComputedStyle(el).visibility === 'hidden' ? 0 : v;
      };
      // Task clock only (setInterval) — a MutationObserver microtask can see a state the browser never paints.
      window.setInterval(() => {
        const root = document.querySelector('.con-parl');
        if (root === null) {
          return;
        }
        const cards = Array.from(document.querySelectorAll('.pcard')).filter((c) => Array.from(c.classList).some((k) => k.startsWith('pcard--rdx-')));
        w.__xfade.push({root: ink(root), board: ink(document.querySelector('.con-board')), cards: cards.map(ink)});
      }, 8);
    });
    await press(page, 'Escape', 200);
    await expect(parliament(page), 'the workspace closed').toHaveCount(0, {timeout: 20_000});
    const samples = await page.evaluate(() => (window as unknown as {__xfade: Array<{root: number, board: number, cards: Array<number>}>}).__xfade);
    const leaving = samples.filter((s) => s.root < 0.999);
    const standing = samples.filter((s) => s.root >= 0.999);
    expect(samples.length, `the sampler ran (${samples.length} samples)`).toBeGreaterThan(0);
    expect(standing.some((s) => s.cards.length > 0), 'the resolution cards were on the table before the leave').toBe(true);
    const fmt = (s: {root: number, board: number, cards: Array<number>}) => `root=${s.root.toFixed(2)} board=${s.board.toFixed(2)} cards=[${s.cards.map((c) => c.toFixed(2)).join(' ')}]`;
    expect(samples.filter((s) => s.board > 1 - s.root + 0.2).map(fmt),
      `the planet never shows through a standing surface (${leaving.length} leaving samples)`).toEqual([]);
    expect(samples.filter((s) => s.cards.some((c) => c > s.root + 0.02)).map(fmt), 'no card outlives its surface').toEqual([]);
  });
});
