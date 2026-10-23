import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, focusCard, openActionFocus, openCardActions, press, settle, walkFocusUntil} from './consoleStart';
import {storyboard} from './consoleEndgameHarness';
import {armBeatWitness, BeatReport, beatSummary, beatTrailAround, beatWitness} from './beatWitness';
import {armFocusWitness, focusWitness, focusWitnessSummary, FocusWitnessReport} from './focusWitness';
import {focusParliamentZone, openParliament} from './parliamentDrive';

/*
 * THE SMOOTHNESS ITERATION AFTER TR58 (the owner, 2026-10-16: «все четыре очень важные полировки — отдельная итерация»).
 * «Nothing changes in one frame» on the four routes the cursor iteration left open, against a real server, fhd + 4K:
 *
 *  (A) PL-473 — THE TARGET STEP ENTERS, never «empty glass»: once the composer's review has let go, the step's cards
 *      are half there within 160 ms (they used to stand invisible ≈ 180–230 ms at 4K — the press decoded their FULL
 *      art in its own frames while the payload print hung on the tile's place), and they come in (never one frame).
 *      Both composers: the play composer (TR56 — floaters → the target row) and the action composer (TR58 — the
 *      plants → the target row; its step had no entry at all).
 *  (B) PL-509 — THE PARLIAMENT'S CURSOR is one living object: a step over the plaques and the voting plate rings with
 *      the cursor's clock (no snap), the ruler's tile carries ONE ring (never the block's AND the plaque's).
 *  (C) PL-510 — A SLOW PREVIEW'S CONTENT ARRIVES: the play composer on a cache miss (the preview route held) — the
 *      review, its rows and the commit row come in as a cascade when the preview lands, and the cursor ARRIVES after
 *      them (never revealed with the content in one frame).
 * (PL-508 — the hand's chrome in beats — rides `console-cursor.spec`'s hand scenario.)
 * Every witness line is appended to `test-results/smoothness/witness.txt` (the report's before / after record).
 */

const PROFILES = [
  {tag: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {tag: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const OUT = path.resolve('test-results', 'smoothness');
const PLAY = '.con-composer--play';
const ACTION = '.con-cardactions__stagewrap .con-composer--stage';

function record(line: string): void {
  test.info().annotations.push({type: 'smoothness', description: line});
  fs.mkdirSync(OUT, {recursive: true});
  fs.appendFileSync(path.join(OUT, 'witness.txt'), line + String.fromCharCode(10));
}

/**
 * THE EMPTY GLASS — from the sample the review is gone (≤ 5 %) to the first sample the step's cards are HALF there
 * (≥ 50 %): what the player waits through with only the carried print on screen.
 */
function emptyGlassMs(r: BeatReport, gone: string, coming: string): {ms: number, at: number} {
  const goneAt = r.trail.find((s) => (s.vis[gone] ?? 0) <= 0.05)?.t;
  if (goneAt === undefined) {
    return {ms: 0, at: -1};
  }
  const halfAt = r.trail.find((s) => s.t >= goneAt && (s.vis[coming] ?? 0) >= 0.5)?.t;
  return {ms: halfAt === undefined ? Number.POSITIVE_INFINITY : halfAt - goneAt, at: goneAt};
}

/**
 * The empty-glass window NET of the long tasks inside it: a task that holds the main thread holds the frames too, so
 * on a starved renderer (CI's SwiftShader at 4K: 96 + 255 ms tasks inside a 196 ms window) the step cannot be painted
 * in that time whatever the product does — the frames' time, never the product's (the finale's FLIP accounting).
 */
function glassNet(glass: {ms: number, at: number}, long: Array<[number, number]>): {ms: number, starved: number} {
  if (!Number.isFinite(glass.ms) || glass.at < 0) {
    return {ms: glass.ms, starved: 0};
  }
  const from = glass.at;
  const to = glass.at + glass.ms;
  const starved = long.reduce((sum, [start, dur]) => sum + Math.max(0, Math.min(to, start + dur) - Math.max(from, start)), 0);
  return {ms: glass.ms - starved, starved};
}

/** Long tasks while the witness ran (PerformanceObserver — the press's own cost). */
async function armLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window as unknown as {__long?: Array<[number, number]>, __longObs?: PerformanceObserver};
    g.__longObs?.disconnect();
    const out: Array<[number, number]> = [];
    const t0 = performance.now();
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        out.push([Math.round(e.startTime - t0), Math.round(e.duration)]);
      }
    });
    obs.observe({type: 'longtask', buffered: false});
    g.__long = out;
    g.__longObs = obs;
  });
}
async function longTasks(page: Page): Promise<Array<[number, number]>> {
  return page.evaluate(() => (window as unknown as {__long?: Array<[number, number]>}).__long ?? []);
}

async function openPlayComposer(page: Page, card: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY), 'the play composer stands').toHaveCount(1);
}

/** A on the variant tile at `index` of a composer — the press SEALS it. */
async function sealTile(page: Page, root: string, index: number): Promise<void> {
  const focusedAt = () => page.locator(`${root} .con-vchoice__opt`).evaluateAll((els) => els.findIndex((e) => e.classList.contains('con-vchoice__opt--focused')));
  for (let i = 0; i < 6 && await focusedAt() < 0; i++) {
    await press(page, 'ArrowUp', 300);
  }
  for (let i = 0; i < 6; i++) {
    const at = await focusedAt();
    if (at === index || at < 0) {
      break;
    }
    await press(page, at < index ? 'ArrowRight' : 'ArrowLeft', 300);
  }
  const sealed = () => page.locator(`${root} .con-vchoice__opt`).nth(index).evaluate((e) => e.classList.contains('con-vchoice__opt--selected'));
  for (let i = 0; i < 3 && !(await sealed()); i++) {
    await press(page, 'Enter', 500);
  }
  expect(await sealed(), `tile ${index} sealed`).toBe(true);
  await settle(page);
}

/** Walk the composer's cursor onto its target row («КУДА: …»). */
async function focusTargetRow(page: Page, root: string): Promise<void> {
  const onRow = () => page.locator(`${root} [data-composer-target-row]`).evaluate((row) => row.closest('.con-composer__row')?.classList.contains('con-composer__row--focused') ?? false).catch(() => false);
  for (let i = 0; i < 8 && !(await onRow()); i++) {
    await press(page, 'ArrowDown', 350);
  }
  expect(await onRow(), 'the cursor stands on the target row').toBe(true);
  await settle(page);
}

/** Arm, press A on the target row ONCE, wait for the step and read the entry. */
async function enterTargetStep(page: Page, root: string, review: string, where: string, story: string): Promise<{glass: {ms: number, at: number}, beats: BeatReport, long: Array<[number, number]>}> {
  await armLongTasks(page);
  await armBeatWitness(page, {
    review,
    step: `${root} .con-ptsel`,
    cards: `${root} .con-ptsel__slot`,
    payload: `${root} [data-ptsel-payload]`,
  });
  const stop = await storyboard(page, OUT, story);
  await page.keyboard.press('Enter');
  await expect(page.locator(`${root} .con-ptsel__slot`).first(), 'the step opened').toBeVisible({timeout: 10_000});
  await settle(page);
  await stop();
  const beats = await beatWitness(page);
  const long = await longTasks(page);
  const glass = emptyGlassMs(beats, 'review', 'cards');
  record(`${where}: empty glass ${glass.ms} ms @${glass.at} · ${beatSummary(beats)} · long ${JSON.stringify(long.slice(0, 6))}`);
  if (process.env.SMOOTH_TRAIL === '1') {
    record(beats.trail.map((x) => `  ${x.t} ${JSON.stringify(x.vis)} ${JSON.stringify(x.anim)}`).join(String.fromCharCode(10)));
  }
  return {glass, beats, long};
}

for (const profile of PROFILES) {
  test.describe(`smoothness after TR58 · ${profile.tag}`, () => {
    test.use({viewport: profile.viewport});

    test(`(A) PL-473 the play composer's target step enters — never empty glass (${profile.tag})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'robotics-factory', {query: profile.query});
      await settle(page);
      await openPlayComposer(page, 'Robotics Factory');
      await settle(page);
      await sealTile(page, PLAY, 2);
      await focusTargetRow(page, PLAY);
      const {glass, beats, long} = await enterTargetStep(page, PLAY, `${PLAY} .con-composer__resulthero`, `${profile.tag} play step`, `${profile.tag}-play-step`);
      const net = glassNet(glass, long);
      expect(net.ms, `the step's cards are half there within 160 ms of the review letting go (${glass.ms} ms − ${net.starved} ms of long tasks) — ${beatSummary(beats)}\n${beatTrailAround(beats, glass.at, 260)}`).toBeLessThanOrEqual(160);
      expect(beats.marks.cards.snapped, `the step's cards come in, never in one frame — ${beatSummary(beats)}`).toBeUndefined();
    });

    test(`(A) PL-473 the action composer's target step enters — never empty glass, never one frame (${profile.tag})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'reprocessing-plant', {query: profile.query});
      await settle(page);
      await openCardActions(page);
      const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
      expect(await walkFocusUntil(page, async () => await focused() === 'Reprocessing Plant', focused, 10)).toBe(true);
      await openActionFocus(page);
      await settle(page);
      await sealTile(page, ACTION, 0);
      await focusTargetRow(page, ACTION);
      const {glass, beats, long} = await enterTargetStep(page, ACTION, `${ACTION} [data-composer-target-row]`, `${profile.tag} action step`, `${profile.tag}-action-step`);
      const net = glassNet(glass, long);
      expect(net.ms, `the step's cards are half there within 160 ms of the row letting go (${glass.ms} ms − ${net.starved} ms of long tasks) — ${beatSummary(beats)}\n${beatTrailAround(beats, glass.at, 260)}`).toBeLessThanOrEqual(160);
      expect(beats.marks.cards.snapped, `the step's cards come in, never in one frame — ${beatSummary(beats)}`).toBeUndefined();
    });

    test(`(B) PL-509 the Parliament's cursor: one ring, on the cursor's clock (${profile.tag})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'parliament-dense', {query: profile.query, landing: 'board'});
      await settle(page);
      // THE ENTRY: the default cursor (the voting plate) ARRIVES after the frame — never a ring revealed with it.
      await armFocusWitness(page, {candidates: '.con-parl .con-pseal, .con-parl .con-parl__voting'});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      const entry = await focusWitness(page);
      record(`${profile.tag} parliament entry: ${focusWitnessSummary(entry)}`);
      expect(entry.bornHidden, `the default cursor arrives after the frame — ${focusWitnessSummary(entry)}`).toEqual([]);
      await focusParliamentZone(page, 'parties');
      await settle(page);
      await armFocusWitness(page, {candidates: '.con-parl .con-pseal, .con-parl .con-parl__voting, .con-parl .con-parl__ruler'});
      for (let i = 0; i < 3; i++) {
        await press(page, 'ArrowRight', 350);
      }
      await focusParliamentZone(page, 'voting');
      await press(page, 'ArrowRight', 350);
      await focusParliamentZone(page, 'ruler');
      await settle(page);
      const walk = await focusWitness(page);
      record(`${profile.tag} parliament walk: ${focusWitnessSummary(walk)}`);
      expect(walk.samples, `the witness sampled — ${focusWitnessSummary(walk)}`).toBeGreaterThan(1);
      expect(walk.snaps, `no ring snapped — ${focusWitnessSummary(walk)}`).toEqual([]);
      expect(walk.jumps, `nothing jumped — ${focusWitnessSummary(walk)}`).toEqual([]);
      // The ruler's tile: ONE ring at the end of the walk — never the block's AND the plaque's.
      const ringsNow = await page.evaluate(() => {
        // A ring = the console's cursor cyan (`@con-cyan`, rgb(106, 176, 230)) painted OPAQUE on the element or on its
        // cursor layer (a transparent rgba(…, 0) is a ring at rest).
        const CYAN = /rgb\(106, 176, 230\)/;
        const ringed = (el: Element): boolean => {
          const own = getComputedStyle(el).boxShadow;
          const layers = (['::after', '::before'] as const).map((p) => getComputedStyle(el, p))
            .filter((cs) => (Number.parseFloat(cs.opacity) || 0) > 0.5 && CYAN.test(cs.boxShadow));
          return CYAN.test(own) || layers.length > 0;
        };
        const block = document.querySelector('.con-parl .con-parl__ruler');
        const plaque = document.querySelector('.con-parl [data-parl-ruler] .con-pseal');
        return [block !== null && ringed(block) ? 'block' : '', plaque !== null && ringed(plaque) ? 'plaque' : ''].filter((n) => n !== '');
      });
      record(`${profile.tag} parliament ruler rings: ${ringsNow.join(',') || 'none'}`);
      expect(ringsNow, 'the ruler\'s tile carries ONE ring — its own, never the block\'s beside it').toEqual(['plaque']);
    });

    test(`(C) PL-510 a slow preview's content ARRIVES, and the cursor after it (${profile.tag})`, async ({page, request}) => {
      test.setTimeout(300_000);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/card-play-preview*', async (route) => {
        await gate;
        await route.continue();
      });
      await bootFixtureSeats(page, request, 'robotics-factory', {query: profile.query});
      await settle(page);
      await openPlayComposer(page, 'Robotics Factory');
      await expect(page.locator(`${PLAY} .con-composer__loading`), 'the cache missed: «Загрузка…»').toHaveCount(1);
      await settle(page);
      await armBeatWitness(page, {
        loading: `${PLAY} .con-composer__loading`,
        hero: `${PLAY} .con-composer__resulthero`,
        tiles: `${PLAY} .con-vchoice__opt`,
        cta: `${PLAY} .con-composer__cta`,
        // The cursor's gate on the composer's root — «visible» while it stands (the root itself is opaque).
        held: `${PLAY}[data-cursor-pending]`,
      });
      await armFocusWitness(page, {candidates: `${PLAY} .con-vchoice__opt, ${PLAY} .con-composer__row, ${PLAY} .con-composer__cta`});
      const stop = await storyboard(page, OUT, `${profile.tag}-play-late`);
      release();
      await expect(page.locator(`${PLAY} .con-composer__cta`), 'the preview landed').toHaveCount(1, {timeout: 15_000});
      // The content's cascade is no hold — `settle` can return mid-rise: the cursor's gate lifting is the end of the beat.
      await expect(page.locator(`${PLAY}[data-cursor-pending]`), 'the cursor arrived (the gate lifted)').toHaveCount(0, {timeout: 8_000});
      await settle(page);
      await stop();
      const beats = await beatWitness(page);
      const cursor: FocusWitnessReport = await focusWitness(page);
      record(`${profile.tag} play late: ${beatSummary(beats)} · cursor ${focusWitnessSummary(cursor)}`);
      fs.mkdirSync(OUT, {recursive: true});
      await page.screenshot({path: path.join(OUT, `${profile.tag}-play-late-end.png`)});
      const snapped = ['hero', 'tiles', 'cta'].filter((k) => beats.marks[k]?.snapped !== undefined);
      expect(snapped, `the late content comes in, never in one frame — ${beatSummary(beats)}`).toEqual([]);
      // The cursor's pose waited while the content rose: every sample with the hero mid-rise had the gate standing.
      const rising = beats.trail.filter((x) => (x.vis.hero ?? 0) > 0.05 && (x.vis.hero ?? 0) < 0.95);
      expect(rising.length, `the rise was sampled — ${beatSummary(beats)}`).toBeGreaterThan(0);
      expect(rising.every((x) => (x.vis.held ?? 0) > 0.5), `the cursor's gate stood through the content's rise — ${beatSummary(beats)}\n${beatTrailAround(beats, rising[0]?.t ?? 0, 300)}`).toBe(true);
      // …and the cursor ARRIVED: the gate is gone, and the focused object's ring layer is lit.
      const lit = await page.evaluate((root) => {
        const host = document.querySelector(root);
        if (host === null || host.hasAttribute('data-cursor-pending')) {
          return {gate: true, ring: 0};
        }
        const focused = host.querySelector('.con-vchoice__opt--focused, .con-composer__row--focused, .con-composer__cta--focused');
        if (focused === null) {
          return {gate: false, ring: -1};
        }
        return {gate: false, ring: Math.max(Number.parseFloat(getComputedStyle(focused, '::after').opacity) || 0, Number.parseFloat(getComputedStyle(focused, '::before').opacity) || 0)};
      }, PLAY);
      record(`${profile.tag} play late cursor: ${JSON.stringify(lit)}`);
      if (process.env.SMOOTH_TRAIL === '1') {
        const groups = await page.evaluate((root) => Array.from(document.querySelectorAll(`${root} [data-unfold-item]`)).map((el) => ({
          cls: (el.getAttribute('class') ?? '').split(' ')[0],
          style: (el as HTMLElement).getAttribute('style') ?? '',
          op: getComputedStyle(el).opacity,
        })), PLAY);
        record(`  groups ${JSON.stringify(groups)}`);
        record(beats.trail.map((x) => `  ${x.t} ${JSON.stringify(x.vis)} ${JSON.stringify(x.anim)}`).join(String.fromCharCode(10)));
      }
      expect(lit.gate, 'the gate is lifted once the content has landed').toBe(false);
      expect(lit.ring, 'the cursor arrived — the focused object\'s ring layer is lit').toBeGreaterThan(0.9);
      expect(cursor.snaps, `no ring snapped — ${focusWitnessSummary(cursor)}`).toEqual([]);
    });
  });
}
