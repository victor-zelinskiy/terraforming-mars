import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {FixtureName, bootFixture, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {armEventFaceProbe, eventFaceLine, readEventFaceProbe} from './eventFaceWitness';

/**
 * «СОБЫТИЕ ПЛАТИТ ЛИЦОМ · НАГРАДА — С ПЕЧАТНОГО ЗНАЧКА» (P84 · DK) — the witness of the play's landing scene across its
 * corpus (docs/claude/prompts/prelude2-p84-stratospheric-expedition.md §4.6). TIMING class: the real boot, motion ×1,
 * alone (`tests/e2e/timingSpecs.ts`).
 *
 *   (а) an EVENT flies FACE UP on every sample of its flight and lands on its face over the pile;
 *   (б) every token of the play is born on the face — on the PRINTED icon of its channel (`printed:<sprite>` · `vp-badge`),
 *       never on the card's body while the face prints the icon, never over glass;
 *   (в) the order: the landing → the gains → the TURN → the touchdown on the pile (the count ticks there) → the next surface;
 *   (г) the pile reads N + 1 only after the touchdown;
 *   (д) a non-event (Terraforming Ganymede) — its gains on its printed icons too, nothing turns;
 *   (е) `endsOverGlass` empty;
 *   (ж) THE BUDGET (the owner, 2026-11-01): the scene's length — the press (`data-hero-phase` leaves idle) to the FIRST
 *       frame of the next surface (the search's reveal / the board) — is written per scenario to
 *       `screenshots/event-pays-face-up/<profile>/timing.json`; with `TM_E2E_EVENT_FACE_BASELINE=<that file of HEAD's run>`
 *       every scenario must stay ≤ HEAD + 50 ms. The HEAD run itself sets `TM_E2E_EVENT_FACE_MEASURE_ONLY=1` (its
 *       assertions (а)–(д) are the law it does not know yet).
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

test.describe(`P84 · DK — an event pays FACE UP, every reward from its printed icon, not one new millisecond · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  for (const sc of SCENARIOS) {
    test(`${sc.key} · ${sc.card}: ${sc.event ? 'face-up flight, pay-back from the printed icons, the turn inside the pause' : 'every gain from its printed icon, nothing turns'} · the scene ≤ HEAD + ${BUDGET_MS} ms`, async ({page, request}) => {
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

      // (е)
      expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
      // (б) the play's gains on the printed icons — never the card's body while its face prints them.
      expect(witness.births.filter((b) => b.under === 'recv:front').map((b) => b.value), `nothing born on the card's body (trail:\n${transferTrail(witness)})`).toEqual([]);
      expect(witness.births.some((b) => /^printed:|^vp-badge$/.test(b.under)), `the play's tokens were born on its printed icons (trail:\n${transferTrail(witness)})`).toBe(true);
      if (!sc.event) {
        // (д) a non-event: nothing turns, no side.
        expect(probe.tTurnStart, 'a non-event never turns').toBeUndefined();
        expect(probe.flipCosMin, 'a non-event flies face up').toBeGreaterThan(0.99);
        return;
      }
      // (а) the face-up flight.
      expect(probe.flipCosMin, `the event flew FACE UP (${eventFaceLine(probe)})`).toBeGreaterThan(0.99);
      // (в) the gains before the turn: every token born on the stage was born face up.
      expect(probe.birthSides.filter((side) => side !== 'up' && side !== '-'), `every token born while the event stood face up (${probe.birthSides.join(' ')})`).toEqual([]);
      expect(probe.tTurnStart, 'the event turned over').toBeDefined();
      expect(probe.tNext!, 'the next surface after the face was let go').toBeGreaterThanOrEqual(probe.tTurnStart!);
      // (г) the pile ticks on the touchdown, after the turn.
      const ticked = probe.counts.findIndex(([, c], i) => i > 0 && c !== probe.counts[0][1]);
      if (ticked > 0) {
        expect(probe.counts[ticked][0], 'the pile ticks on the touchdown, never before the turn').toBeGreaterThanOrEqual(probe.tTurned ?? Infinity);
      }
      // The turn lives INSIDE the reading pause — its own length never above the residual pause (220 ms) + a frame.
      if (probe.tTurned !== undefined) {
        expect(probe.tTurned - probe.tTurnStart!, `the turn's length (${eventFaceLine(probe)})`).toBeLessThanOrEqual(220 + 60);
      }
    });
  }
});
