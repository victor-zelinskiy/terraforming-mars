import {test, expect, Page} from './consoleTest';
import {bootFixture, focusCard, press, settle} from './consoleStart';

/**
 * P86 — the owner's «СБРОШЕНО: 0»: the table's discard pile counted TOUCHDOWNS, never the server's truth, so any path
 * where a touchdown did not happen (the carry's guard timer firing before the timeline's contact under a starved main
 * thread, an abort of the liveness arbiter, a degraded scene) left the pile reading «0» over a card the server
 * discarded. Now every owner DECLARES what it lays (`expectDiscardPileCount`) and SETTLES it at its read and at any
 * abort (`settleDiscardPile`); a release under the declaration is the sentinel `[discard-pile] released under its count`
 * — red on EVERY e2e (`transferEndsGuard`), so this stand is red if a settle is ever skipped.
 *
 * The stand starves the renderer (CDP CPU throttling ×6) and plays the P86 discard out of the dock (the play's price),
 * sampling the pile on every mutation: the LAST count the pile shows before it leaves is ≥ the server's discards.
 * Run it as a RATE: `--repeat-each=8`. The POSITIVE CONTROL (the sentinel speaks when the settle is off) is the unit
 * spec `discardPile.spec` § the TRUTH — here the sentinel would turn the harness red by design.
 *
 * TIMING class (sampled per mutation under a throttle; alone).
 */

const CARD = 'Unexpected Application';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';

async function armPileProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const rec = {seen: false, last: -1, lastBeforeLeave: -1, expected: 0};
    (window as unknown as {__pileTruth: typeof rec}).__pileTruth = rec;
    const sample = () => {
      const pile = document.querySelector<HTMLElement>('[data-discard-pile]');
      if (pile !== null) {
        rec.seen = true;
        rec.last = Number(pile.dataset.discardPileCount ?? -1);
        rec.expected = Math.max(rec.expected, Number(pile.dataset.discardPileExpected ?? 0));
      } else if (rec.seen && rec.lastBeforeLeave < 0) {
        rec.lastBeforeLeave = rec.last;
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ['data-discard-pile-count', 'data-discard-pile-expected']});
  });
}

test.describe(`the discard pile reads the server's truth under a starved renderer · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('P86\'s discard out of the dock under CPU ×6: the pile never leaves under the server\'s count', async ({page, request, context}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'unexpected-application-sole', {query: PRESET.query});
    await settle(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 6});
    test.info().annotations.push({type: 'cpu-throttle', description: '×6 (the stand)'});
    for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
      await press(page, 'Period', 900);
      await press(page, 'Enter', 2400);
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 30_000});
    await settle(page, {timeoutMs: 60_000});
    expect(await focusCard(page, CARD, 10), `never focused «${CARD}»`).toBe(true);
    for (let i = 0; i < 3 && await page.locator(COMPOSER).count() === 0; i++) {
      await press(page, 'Enter', 2000);
    }
    await page.locator(COMPOSER).waitFor({timeout: 30_000});
    await settle(page, {timeoutMs: 60_000});
    await armPileProbe(page);
    for (let i = 0; i < 10 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 400);
    }
    await press(page, 'Enter', 600);
    await expect.poll(async () => page.evaluate(() => (window as unknown as {__pileTruth: {lastBeforeLeave: number}}).__pileTruth.lastBeforeLeave),
      {timeout: 90_000, message: 'the pile came out and went home'}).toBeGreaterThanOrEqual(0);
    const rec = await page.evaluate(() => (window as unknown as {__pileTruth: {seen: boolean, last: number, lastBeforeLeave: number, expected: number}}).__pileTruth);
    test.info().annotations.push({type: 'pile', description: JSON.stringify(rec)});
    expect(rec.expected, `the scene declared its truth (${JSON.stringify(rec)})`).toBeGreaterThanOrEqual(1);
    expect(rec.lastBeforeLeave, `the pile left reading the server's discards (${JSON.stringify(rec)})`).toBeGreaterThanOrEqual(1);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
  });
});
