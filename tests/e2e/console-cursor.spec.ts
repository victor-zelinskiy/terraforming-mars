import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, cinematicBeat, openQuickWheel, press, settle} from './consoleStart';
import {storyboard} from './consoleEndgameHarness';
import {FocusWitnessOptions, FocusWitnessReport, armFocusWitness, focusTrailAround, focusWitness, focusWitnessSummary} from './focusWitness';

/*
 * TR58 «КУРСОР — ОДИН ЖИВОЙ ОБЪЕКТ» (`.claude/rules/console-ui.md` § THE CURSOR IS ONE LIVING OBJECT).
 *
 * The owner's report of 2026-10-16: a workspace opens, the first card takes the focus — and the focus «appears in one
 * frame» while the card makes «a micro-jump». The probes before this spec read the CLASS of the focused element, which
 * is on or off; a ring that snaps and a ring that grows read the same to them. This spec reads the PAINTED pose through
 * `focusWitness` (MutationObserver + setInterval, never rAF) on every surface the cursor stands on, on fhd and 4K:
 *  · OPEN — the default focus ARRIVES: no ring born under a copy and revealed with it (`bornHidden`), no ring that goes
 *    0 → full in one sample (`snaps`); for the hand, the flying copy hands the card over on the NEXT frame (no
 *    cross-fade of two pictures) at the resting slot's box, and only then does the ring come in;
 *  · STEP — the ring leaves the old object and comes to the new one on the lift's own clock (no `snaps`), the leaving
 *    object never dives under its neighbour while still enlarged (`zFlips`), and nothing moves without a motion
 *    (`jumps`).
 * Timings and storyboards are taken on the GPU (`TM_E2E_GPU=1`); `TM_E2E_STORYBOARD=1` writes the frames to
 * `test-results/cursor/`.
 */

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

const OUT = path.resolve('test-results', 'cursor');

const HAND: FocusWitnessOptions = {
  candidates: '.con-hand__slot',
  face: ':scope > .pcard, :scope > .card-container',
  keyAttr: 'data-zoom-slot',
  proxy: '.con-handreveal-layer [data-hand-dock-card="${key}"]',
  proxyFace: '.pcard',
};
const TILES: FocusWitnessOptions = {candidates: '.con-cardactions__tile', keyAttr: 'data-action-card'};
const COLONIES: FocusWitnessOptions = {candidates: '.con-coltile'};
const STDP: FocusWitnessOptions = {candidates: '.con-stdp__card'};

/** Every defect of the class, with the trail around the first of each kind — a red names the moment. */
function expectLiving(r: FocusWitnessReport, where: string): void {
  // The witness's numbers are the iteration's acceptance record (the report's «after» column) — kept beside the frames.
  const line = `${where}: ${focusWitnessSummary(r)}`;
  test.info().annotations.push({type: 'focus-witness', description: line});
  fs.mkdirSync(OUT, {recursive: true});
  fs.appendFileSync(path.join(OUT, 'witness.txt'), line + String.fromCharCode(10));
  const around = (list: ReadonlyArray<{t: number, key: string, what: string}>) =>
    list.slice(0, 3).map((f) => `${f.key} @${f.t} ms: ${f.what}\n${focusTrailAround(r, f.t, f.key)}`).join('\n---\n');
  expect(r.samples, `${where}: the witness sampled (a dead sampler proves nothing) — ${focusWitnessSummary(r)}`).toBeGreaterThan(1);
  expect(r.bornHidden, `${where}: a cursor pose born invisible and revealed with its object\n${around(r.bornHidden)}`).toEqual([]);
  expect(r.snaps, `${where}: a ring that snapped in one sample\n${around(r.snaps)}`).toEqual([]);
  expect(r.jumps, `${where}: a face that jumped with no motion\n${around(r.jumps)}`).toEqual([]);
  expect(r.zFlips, `${where}: an enlarged object dove under its neighbour\n${around(r.zFlips)}`).toEqual([]);
  expect(r.scrollJumps, `${where}: an instant scroll\n${around(r.scrollJumps)}`).toEqual([]);
}

/** The key the cursor stands on after the scenario (the strongest ring at the end of the trail). */
function cursoredKey(r: FocusWitnessReport): string | undefined {
  const lastT = Math.max(...r.trail.map((s) => s.t));
  const tail = r.trail.filter((s) => s.t === lastT && s.ring > 0);
  return tail.sort((a, b) => b.ring - a.ring)[0]?.key;
}

async function arrivalBeat(page: Page): Promise<void> {
  // The arrival is a ≈ 180 ms beat AFTER the surface is ready — no hold carries it (a cursor never blocks input).
  await cinematicBeat(page, 700, 'the cursor arrival plays out after the surface settles');
}

for (const profile of PROFILES) {
  test.describe(`the cursor is one living object · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('«Карты в руке»: the copies hand over on the next frame at the resting slot, then the cursor arrives; a step', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'mu-research-colony', {query: profile.query});
      await settle(page);
      await openQuickWheel(page);
      await armFocusWitness(page, HAND);
      const stop = await storyboard(page, OUT, `${profile.tag}-hand-open`);
      await page.keyboard.press('Enter');
      await expect(page.locator('.con-hand:not(.con-hand--transit) .con-hand__slot--selected')).toHaveCount(1, {timeout: 15_000});
      await settle(page);
      await arrivalBeat(page);
      await stop();
      const open = await focusWitness(page);
      expectLiving(open, `${profile.tag} hand open`);
      const first = cursoredKey(open);
      expect(first, `the cursor stands on a card — ${focusWitnessSummary(open)}`).toBeDefined();
      const handoff = open.handoff.find((h) => h.key === first);
      expect(handoff, `the focused card was flown in by its copy — ${focusWitnessSummary(open)}`).toBeDefined();
      const ui = profile.tag === 'tv4k' ? 2 : 1;
      expect(handoff!.delta, `the copy lands on the RESTING slot (face to face) — ${JSON.stringify(handoff)}`).toBeLessThanOrEqual(1.5 * ui);
      expect(handoff!.coexistMs, `the copy leaves on the next frame, never a cross-fade of two pictures — ${JSON.stringify(handoff)}`).toBeLessThanOrEqual(40);
      const ringStart = open.trail.find((s) => s.key === first && s.ring > 0.02 && s.vis >= 0.5)?.t ?? -1;
      expect(ringStart, `the ring arrives only after the copy has gone (${JSON.stringify(handoff)})`).toBeGreaterThan(handoff!.t + handoff!.coexistMs);
      const grow = new Set(open.trail.filter((s) => s.key === first && s.ring > 0.02 && s.ring < 0.98 * open.full[first!]).map((s) => s.ring));
      expect(grow.size, `the ring GROWS over several samples (${[...grow].join(', ')})`).toBeGreaterThanOrEqual(3);

      await armFocusWitness(page, HAND);
      const stop2 = await storyboard(page, OUT, `${profile.tag}-hand-step`);
      await press(page, 'ArrowRight', 0);
      await arrivalBeat(page);
      await press(page, 'ArrowRight', 0);
      await arrivalBeat(page);
      await stop2();
      const step = await focusWitness(page);
      expectLiving(step, `${profile.tag} hand step`);
      expect(step.ringed.length, `the ring travelled over three cards — ${focusWitnessSummary(step)}`).toBeGreaterThanOrEqual(3);
    });

    test('«Действия карт»: the first tile takes the cursor as an arrival; a step', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'expedition-mechs-family', {query: profile.query});
      await settle(page);
      await openQuickWheel(page);
      await armFocusWitness(page, TILES);
      const stop = await storyboard(page, OUT, `${profile.tag}-actions-open`);
      await page.keyboard.press('ArrowUp');
      await expect(page.locator('.con-cardactions__tile--focused')).toHaveCount(1, {timeout: 15_000});
      await settle(page);
      await arrivalBeat(page);
      await stop();
      expectLiving(await focusWitness(page), `${profile.tag} actions open`);

      await armFocusWitness(page, TILES);
      await press(page, 'ArrowRight', 0);
      await arrivalBeat(page);
      await press(page, 'ArrowDown', 0);
      await arrivalBeat(page);
      const step = await focusWitness(page);
      expectLiving(step, `${profile.tag} actions step`);
      expect(step.ringed.length, `the ring travelled — ${focusWitnessSummary(step)}`).toBeGreaterThanOrEqual(2);
    });

    test('«Колонии»: the first tile takes the cursor as an arrival; a step', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'sponsored-academies', {query: profile.query});
      await settle(page);
      await openQuickWheel(page);
      await armFocusWitness(page, COLONIES);
      const stop = await storyboard(page, OUT, `${profile.tag}-colonies-open`);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.con-coltile--focused')).toHaveCount(1, {timeout: 15_000});
      await settle(page);
      await arrivalBeat(page);
      await stop();
      expectLiving(await focusWitness(page), `${profile.tag} colonies open`);

      await armFocusWitness(page, COLONIES);
      await press(page, 'ArrowRight', 0);
      await arrivalBeat(page);
      const step = await focusWitness(page);
      expectLiving(step, `${profile.tag} colonies step`);
      expect(step.ringed.length, `the ring travelled — ${focusWitnessSummary(step)}`).toBeGreaterThanOrEqual(2);
    });

    test('«Стандартные проекты»: the cursor arrives once, never re-seated; a step', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'mu-research-colony', {query: profile.query});
      await settle(page);
      await armFocusWitness(page, STDP);
      await press(page, 'Comma', 1100);
      await page.keyboard.press('Enter');
      await expect(page.locator('.con-stdp')).toHaveCount(1, {timeout: 15_000});
      await settle(page);
      await arrivalBeat(page);
      const open = await focusWitness(page);
      expectLiving(open, `${profile.tag} stdp open`);
      expect(open.ringed.length, `the cursor stands on ONE row from the open (never seated on the last visit's, then moved) — ${focusWitnessSummary(open)}`).toBe(1);

      await armFocusWitness(page, STDP);
      await press(page, 'ArrowDown', 0);
      await arrivalBeat(page);
      const step = await focusWitness(page);
      expectLiving(step, `${profile.tag} stdp step`);
    });
  });
}
