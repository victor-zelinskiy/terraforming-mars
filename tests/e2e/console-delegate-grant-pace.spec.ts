import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';

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

/** MutationObserver + setInterval from the press: each cube's lift and touchdown, the landed read, the flow's leave. */
async function armPace(page: Page, viewer: string): Promise<void> {
  await page.evaluate((viewer) => {
    const p: Pace = {lifts: [], departures: [], touches: [], landedRead: -1, handLeft: -1};
    let reserve = NaN;
    (window as unknown as {__pace: Pace}).__pace = p;
    const t0 = performance.now();
    const seenLifts = new Set<string>();
    const seenTouches = new Set<string>();
    const sample = () => {
      const at = Math.round(performance.now() - t0);
      document.querySelectorAll('[data-parl-flight^="vote"]').forEach((el) => {
        const id = el.getAttribute('data-parl-flight') ?? '';
        if (!seenLifts.has(id)) {
          seenLifts.add(id);
          p.lifts.push(at);
        }
      });
      document.querySelectorAll('.con-hand .con-parl__slot [data-seq][data-landed]').forEach((el) => {
        const seq = el.getAttribute('data-seq') ?? '';
        if (!seenTouches.has(seq)) {
          seenTouches.add(seq);
          p.touches.push(at);
        }
      });
      const raw = document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count');
      const count = raw === null || raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(count)) {
        if (Number.isFinite(reserve) && count < reserve) {
          p.departures.push(at);
        }
        reserve = count;
      }
      if (p.landedRead < 0 && document.querySelector('.con-parl__slot--landed') !== null && p.touches.length >= 2) {
        p.landedRead = at;
      }
      if (p.handLeft < 0 && p.touches.length > 0 && document.querySelector('.con-hand') === null) {
        p.handLeft = at;
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 16);
  }, viewer);
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
    const pace = await page.evaluate(() => (window as unknown as {__pace: Pace}).__pace);
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
