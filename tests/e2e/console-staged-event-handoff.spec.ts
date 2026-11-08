import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, focusCard, placementState, pressUntil, settle} from './consoleStart';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * THE STAGED EVENT HANDS THE BOARD OVER AT ONCE (the owner's field freeze of 2026-11-08 — game g245a35e2022f, Flooding).
 *
 * A staged play's landing ritual is the PRE-COMMIT half: the card lands on its pile, then the board takes the screen for
 * the cell, and only the cell's confirm sends anything. An EVENT with something to pay (Flooding's −1 VP on its face, the
 * Greens answering the ocean) took the event's «pay before the lift» road inside that ritual — it let a commit through
 * that did not exist and waited for its pay-back: the card stood 9 s in the composer with the pad absorbed, the board
 * opening only past the 8 s ceiling (`PAYBACK_WAIT_MAX_MS`). The law read here: from «Разыграть» to the aiming reticle
 * the ritual never enters the pay-back (`data-hero-payback` never reads `paying`), the board aims well inside the old
 * ceiling, and the wait graph names no dead end on the way.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
/** The ritual (lift · arc · touchdown · the read beat) and the hand-off — far under the 8 s the freeze waited. */
const HANDOFF_BUDGET_MS = 5_000;

async function openFloodingComposer(page: Page): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, 'Flooding', Math.max(14, slots * 3)), 'the cursor stands on Flooding').toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
}

test.describe('a staged EVENT hands the board over at once — no pay-back inside the landing ritual', () => {
  test.use({viewport: PRESET.viewport});

  test('Flooding (−1 VP, the Greens answering): «Разыграть» → the aiming reticle inside the budget, the ritual never pays, no dead end', async ({page, request}) => {
    const graph: Array<string> = [];
    page.on('console', (m) => {
      if (m.text().includes('[wait-graph]')) {
        graph.push(m.text());
      }
    });
    await bootFixtureSeats(page, request, 'flooding-staged', {query: PRESET.query});
    await openFloodingComposer(page);
    await recordTransient(page, 'payback', () => document.querySelector('[data-hero-payback]')?.getAttribute('data-hero-payback') ?? '');
    const t0 = Date.now();
    // The ritual has begun once the scene leaves `idle` — the frozen road never lifted the card (no proxy), it stood in the
    // composer in its `shipping` phase, so a proxy is no witness of the press.
    const started = async () => await page.locator('[data-hero-phase]:not([data-hero-phase="idle"])').count() > 0 ||
      await page.locator('.con-played-hero__proxy').count() > 0 || await placementState(page) !== 'none';
    expect(await pressUntil(page, 'Enter', started, {tries: 4, settleMs: 1200}), '«Разыграть» started the staged play').toBe(true);
    await expect.poll(() => placementState(page), {timeout: 20_000, message: 'the staged board never aimed'}).toBe('aiming');
    const handoffMs = Date.now() - t0;
    const payback = (await readTransient<string>(page, 'payback')).map((s) => s.v);
    expect(payback, `the ritual of a staged event never enters the pay-back (recorded: ${payback.join(' → ')})`).not.toContain('paying');
    expect(handoffMs, `«Разыграть» → the aiming reticle took ${handoffMs} ms (the freeze stood 9 s)`).toBeLessThan(HANDOFF_BUDGET_MS);
    expect(graph.filter((l) => /dead-end|cycle|dangling/.test(l)), 'the wait graph saw no dead end, cycle or dangling wait on the way').toEqual([]);
  });
});
