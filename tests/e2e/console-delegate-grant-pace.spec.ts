import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';
import {armWitness, witnessOf} from './witness';

/**
 * THE GRANT'S PACE (P72 «Делегаты Венеры», ledger CZ — TIMING class, motion ×1, `--exclusive --workers=1`): a live grant
 * of 2 from the A on the resolution to the LAST cube's touchdown and to the flow's leave. Its claim is an A/B against
 * HEAD in ONE snapshot (`docs/claude/…/ab-baseline`): the pair as ONE phrase is shorter than the old queue by about one
 * flight minus the stagger, and no beat is lost (both cubes lift and touch down, the landed read is played, the flow
 * leaves). The starts' rhythm (law 12 — ≥ 90 ms) is asserted here, where the clock is the product's own (×1); a HEAD
 * baseline run (`TM_E2E_AB_BASELINE=1`) records its numbers without the phrase's claims.
 */

const CARD = 'Envoys From Venus';
const OUT = path.resolve('screenshots', 'p72');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const VOTE = '.con-hand .con-parl--embedded [data-parl-vote-door="card"]';
const BASELINE = process.env.TM_E2E_AB_BASELINE === '1';

/**
 * `lifts` — each vote proxy's first sighting (the DOM mounts it a tick before its motion — the first one late, inside
 * the landing's heavy frame); `departures` — the reserve's count stepping down, i.e. a figure VISIBLY leaving the stack
 * (the flight's own `onDeparted`): the rhythm the eye reads, and the one law 12 is about.
 */
type Pace = {lifts: Array<number>, departures: Array<number>, touches: Array<number>, landedRead: number, handLeft: number};

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** One recorded state — an OBSERVATION; the pace is folded from them on the Node side. */
type PaceSeen = {flights: Array<string>, landed: Array<string>, reserve: number | null, slotLanded: boolean, hand: boolean};

const PACE_WITNESS = 'p72:pace';

/**
 * RECORDED from the press (FLAKE ZERO — `armWitness`: sampled in the task the product writes and on every frame, the
 * page's clock): each cube's lift and touchdown, the landed read, the flow's leave.
 */
async function armPace(page: Page, viewer: string): Promise<void> {
  await armWitness<PaceSeen, string>(page, PACE_WITNESS, (viewer) => {
    const raw = document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count');
    const count = raw === null || raw === undefined ? NaN : Number(raw);
    return {
      flights: Array.from(document.querySelectorAll('[data-parl-flight^="vote"]')).map((el) => el.getAttribute('data-parl-flight') ?? ''),
      landed: Array.from(document.querySelectorAll('.con-hand .con-parl__slot [data-seq][data-landed]')).map((el) => el.getAttribute('data-seq') ?? ''),
      reserve: Number.isFinite(count) ? count : null,
      slotLanded: document.querySelector('.con-parl__slot--landed') !== null,
      hand: document.querySelector('.con-hand') !== null,
    };
  }, {args: viewer});
}

/** Stop the recording and fold it: every time in ms since the arm, on the page's clock. */
async function readPace(page: Page): Promise<Pace> {
  const samples = await witnessOf<PaceSeen>(page, PACE_WITNESS).stop();
  const t0 = samples[0]?.t ?? 0;
  const p: Pace = {lifts: [], departures: [], touches: [], landedRead: -1, handLeft: -1};
  const seenLifts = new Set<string>();
  const seenTouches = new Set<string>();
  let reserve = NaN;
  for (const {t, v} of samples) {
    const at = t - t0;
    for (const id of v.flights) {
      if (!seenLifts.has(id)) {
        seenLifts.add(id);
        p.lifts.push(at);
      }
    }
    for (const seq of v.landed) {
      if (!seenTouches.has(seq)) {
        seenTouches.add(seq);
        p.touches.push(at);
      }
    }
    if (v.reserve !== null) {
      if (Number.isFinite(reserve) && v.reserve < reserve) {
        p.departures.push(at);
      }
      reserve = v.reserve;
    }
    if (p.landedRead < 0 && v.slotLanded && p.touches.length >= 2) {
      p.landedRead = at;
    }
    if (p.handLeft < 0 && p.touches.length > 0 && !v.hand) {
      p.handLeft = at;
    }
  }
  return p;
}

test.describe(`P72 · a grant of 2 — the pace of ONE phrase (A/B) · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the press → the last touchdown → the flow leaves, every beat seen', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'envoys-from-venus', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await settle(page);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
    await press(page, 'Enter', 1200);
    await page.locator('.con-composer--play').waitFor({timeout: 15_000});
    await settle(page);
    await pressUntil(page, 'Enter', async () => posts.length >= 1, {tries: 3, settleMs: 1500});
    await page.locator(VOTE).waitFor({timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const viewer = (await fetchPlayerModel(request, id) as unknown as {thisPlayer: {color: string}}).thisPlayer.color;
    await armPace(page, viewer);
    await pressUntil(page, 'Enter', async () => posts.length >= 2, {tries: 3, settleMs: 1500});
    await expect(page.locator('.con-hand'), 'the flow leaves').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    const pace = await readPace(page);
    const told = JSON.stringify(pace);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.appendFileSync(path.join(OUT, PRESET.id, `pace${BASELINE ? '-head' : ''}.jsonl`), told + '\n');
    test.info().annotations.push({type: 'pace', description: `${BASELINE ? 'HEAD' : 'branch'} ${told}`});
    expect(pace.lifts.length, `both cubes lifted (${told})`).toBe(2);
    expect(pace.touches.length, `both cubes touched down (${told})`).toBe(2);
    expect(pace.landedRead, `the landed read was played (${told})`).toBeGreaterThan(pace.touches[1] - 1);
    expect(pace.handLeft, `the flow left after the read (${told})`).toBeGreaterThan(pace.landedRead);
    if (!BASELINE) {
      expect(pace.departures.length, `the reserve stepped down per figure (${told})`).toBe(2);
      expect(pace.departures[1] - pace.departures[0], `the figures leave the stack ≥ 90 ms apart at motion ×1 (${told})`).toBeGreaterThanOrEqual(90);
      expect(pace.lifts[1], `ONE PHRASE — the second cube lifts before the first touches down (${told})`).toBeLessThan(pace.touches[0]);
    }
  });
});
