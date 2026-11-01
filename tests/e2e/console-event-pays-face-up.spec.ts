import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {FixtureName, bootFixture, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {armEventFaceProbe, eventFaceLine, readEventFaceProbe} from './eventFaceWitness';

/**
 * «СОБЫТИЕ ПЛАТИТ ДО ВЗЛЁТА · НАГРАДА — С ПЕЧАТНОГО ЗНАЧКА» (P84 · DK — the owner's direction of 2026-11-01: the arc's
 * flip read more premium, the pay-back moves to the moment the face is still up) — the witness of the play's landing
 * scene across its corpus. TIMING class: the real boot, motion ×1, alone (`tests/e2e/timingSpecs.ts`).
 *
 *   (а) an EVENT PAYS before its lift — its pay-back runs (`data-hero-payback` paying → paid) while the card still stands
 *       in the composer (every token born in the `shipping` phase), the lift only after it;
 *   (б) every token of the play is born on a PRINTED icon of its channel (`printed:<sprite>` · `vp-badge` · `tag:`) —
 *       never on the stage (`recv:*`), never over glass;
 *   (в) the event then TURNS OVER IN THE ARC (the flip chassis reaches its back) and lands face down; the pile reads
 *       N + 1 from that landing;
 *   (г) a non-event (Terraforming Ganymede) — no pay-back before the lift, it flies face up and pays from its landed
 *       face, every gain on its printed icon;
 *   (д) THE LENGTH: press (`data-hero-phase` leaves idle) → the FIRST frame of the next surface (the search's reveal /
 *       the board), written per scenario to `screenshots/event-pays-face-up/<profile>/timing.json`; with
 *       `TM_E2E_EVENT_FACE_BASELINE=<a HEAD run's file>` every scenario must stay ≤ HEAD + 50 ms. The HEAD run sets
 *       `TM_E2E_EVENT_FACE_MEASURE_ONLY=1` (its assertions are the law it does not know yet).
 */

const OUT = path.resolve('screenshots', 'event-pays-face-up');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const MEASURE_ONLY = process.env.TM_E2E_EVENT_FACE_MEASURE_ONLY === '1';
const BUDGET_MS = 50;

type Scenario = {key: string, fixture: FixtureName, card: string, event: boolean, next: 'reveal' | 'board'};
const SCENARIOS: ReadonlyArray<Scenario> = [
  {key: 'p84', fixture: 'stratospheric-expedition-sole', card: 'Stratospheric Expedition', event: true, next: 'reveal'},
  {key: 'ishtar', fixture: 'ishtar-expedition', card: 'Ishtar Expedition', event: true, next: 'reveal'},
  {key: 'bribed', fixture: 'play-tr-reward', card: 'Bribed Committee', event: true, next: 'board'},
  {key: 'x87', fixture: 'shipment-to-earth', card: 'Shipment to Earth', event: true, next: 'board'},
  {key: 'ganymede', fixture: 'play-tr-reward', card: 'Terraforming Ganymede', event: false, next: 'board'},
];

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** RT → «КАРТЫ» → the card → A: the play composer of `card`, nothing sent. */
async function openComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${card}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await page.locator(COMPOSER).waitFor({timeout: 15_000});
  await settle(page);
}

function readTimings(file: string): Record<string, number> {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, number> : {};
}

test.describe(`P84 · DK — an event pays before its lift, every reward from its printed icon, the turn in the arc · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  for (const sc of SCENARIOS) {
    test(`${sc.key} · ${sc.card}: ${sc.event ? 'the pay-back before the lift from the printed icons, the turn in the arc' : 'every gain from its printed icon, face up all the way'} · the scene ≤ HEAD + ${BUDGET_MS} ms`, async ({page, request}) => {
      test.setTimeout(420_000);
      await bootFixture(page, request, sc.fixture, {query: PRESET.query});
      await settle(page);
      const posts = watchPosts(page);
      await openComposer(page, sc.card);
      await expect(page.locator(`${COMPOSER} .con-composer__row--missing`), 'the scenario asks nothing before A').toHaveCount(0);
      for (let i = 0; i < 6 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
        await press(page, 'ArrowDown', 300);
      }
      await armTransferWitness(page);
      await armEventFaceProbe(page);
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      await expect.poll(async () => (await readEventFaceProbe(page)).tNext, {timeout: 60_000, message: `the next surface (${sc.next})`}).toBeDefined();
      await settle(page, {timeoutMs: 40_000});
      const probe = await readEventFaceProbe(page);
      const witness = await transferWitness(page);
      const dir = path.join(OUT, PRESET.id);
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(path.join(dir, `${sc.key}-trail.txt`), `${eventFaceLine(probe)}\n${transferTrail(witness)}\n`);
      test.info().annotations.push({type: 'event-face', description: eventFaceLine(probe)});

      // (ж) the scene's length — written, and judged against HEAD's run when one is given.
      const length = (probe.tNext ?? NaN) - (probe.tArmed ?? NaN);
      expect(Number.isFinite(length), `the scene was measured (${eventFaceLine(probe)})`).toBe(true);
      expect(probe.nextKind, 'the next surface is the scenario\'s').toBe(sc.next);
      const timingFile = path.join(dir, `timing${MEASURE_ONLY ? '-head' : ''}.json`);
      const timings = readTimings(timingFile);
      timings[`${sc.key}#${Date.now()}`] = length;
      fs.writeFileSync(timingFile, JSON.stringify(timings, null, 1));
      test.info().annotations.push({type: 'scene-ms', description: `${sc.key} ${length} ms${MEASURE_ONLY ? ' (HEAD — measure only)' : ''}`});
      const baselineFile = process.env.TM_E2E_EVENT_FACE_BASELINE;
      if (!MEASURE_ONLY && baselineFile !== undefined && baselineFile !== '') {
        const base = readTimings(baselineFile);
        const runs = Object.entries(base).filter(([k]) => k.startsWith(`${sc.key}#`)).map(([, v]) => v).sort((a, b) => a - b);
        if (runs.length > 0) {
          const median = runs[Math.floor(runs.length / 2)];
          expect(length, `${sc.key}: the scene ${length} ms ≤ HEAD's median ${median} + ${BUDGET_MS} ms`).toBeLessThanOrEqual(median + BUDGET_MS);
        }
      }
      if (MEASURE_ONLY) {
        return;
      }

      // (б)
      expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
      expect(witness.births.some((b) => /^printed:|^vp-badge$|^tag:/.test(b.under)), `the play's tokens were born on its printed icons (trail:\n${transferTrail(witness)})`).toBe(true);
      if (!sc.event) {
        // (г) a non-event: no pay-back before the lift, face up all the way.
        expect(probe.paybacks, 'a non-event pays after its landing').toEqual([]);
        expect(probe.flipCosMin, 'a non-event flies face up').toBeGreaterThan(0.99);
        return;
      }
      // (а) the pay-back before the lift.
      expect(probe.paybacks.map(([, st]) => st), `the pay-back ran before the lift (${eventFaceLine(probe)})`).toEqual(['paying', 'paid']);
      expect(probe.birthPhases.filter((ph) => ph !== 'shipping'), `every token was born while the card stood (${probe.birthPhases.join(' ')})`).toEqual([]);
      expect(witness.births.filter((b) => /^recv:/.test(b.under)).map((b) => `${b.value}@${b.under}`), 'nothing born on the stage').toEqual([]);
      expect(probe.tLifting!, 'the lift only after the pay-back').toBeGreaterThanOrEqual(probe.tPaid!);
      // (в) the arc's turn and the face-down landing.
      expect(probe.flipCosMin, `the event turned over in the arc (${eventFaceLine(probe)})`).toBeLessThan(-0.9);
      const ticked = probe.counts.findIndex(([, c], i) => i > 0 && c !== probe.counts[0][1]);
      if (ticked > 0) {
        expect(probe.counts[ticked][0], 'the pile ticks on the landing').toBeGreaterThanOrEqual(probe.tRevealed ?? Infinity);
      }
    });
  }
});
