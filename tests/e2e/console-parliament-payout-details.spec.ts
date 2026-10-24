import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, crumbText, pressUntil, settle} from './consoleStart';
import {armLeakWitness, enterSittingByPass, expectParliamentFits, PARLIAMENT_PRESETS, parliamentWire, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';

/*
 * «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24 — `docs/claude/console/parliament-payout-details.md`). On the sitting's
 * RESULTS page X inspects the payouts: an embedded step one level deeper on the same card — the enacted law keeps its
 * column, the other columns release in place, a table per RULE stands where the payouts were, a row per seat with its
 * RECORDED reading. L3 reads the source (the law); X / B fold the step back; A keeps its one meaning (onward).
 *
 * The fixture `parliament-budget-assembly` (the Industrialists' Budget: «lose 10 M€, then 1 M€ per production step +
 * influence», plus a flat production part): the viewer's row must read the LEVY at its head and the day's NET at its
 * tail — the one line the results card's chips cannot say. Screens under screenshots/parliament-payout-details/<preset>/.
 */
async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.resolve('screenshots', 'parliament-payout-details', preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const details = (page: Page) => page.locator('[data-sit-payout-details]');

/** The hot command's box on the bar (A — «Закрыть заседание»): it stands in ONE place on the card and in the step. */
async function hotBox(page: Page): Promise<{x: number, w: number} | undefined> {
  return await page.evaluate(() => {
    const el = document.querySelector('.con-cmdbar__cmd--hot');
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.right), w: Math.round(r.width)};
  });
}

/** The enacted law's card on the results card — sampled on TASKS (`setInterval`, never rAF) through the step's entry. */
async function armLawProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__lawTops: Array<number>, __lawTimer: number};
    w.__lawTops = [];
    w.__lawTimer = window.setInterval(() => {
      const card = document.querySelector('[data-sit-enacted] .con-sit__enacted-card');
      if (card !== null) {
        w.__lawTops.push(card.getBoundingClientRect().top);
      }
    }, 16);
  });
}
async function readLawProbe(page: Page): Promise<Array<number>> {
  return await page.evaluate(() => {
    const w = window as unknown as {__lawTops: Array<number>, __lawTimer: number};
    window.clearInterval(w.__lawTimer);
    return w.__lawTops;
  });
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`«Подробности выплат» (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('X opens the table per rule on the results card, L3 reads the law, X / B fold it back', async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-budget-assembly', {query: preset.query});
      await armLeakWitness(page);
      const viewer = (await parliamentWire(request, playerId)).thisPlayer.color;
      await enterSittingByPass(page, request, playerId);
      await expect.poll(() => sittingStage(page), {timeout: 120_000, message: 'the walk reaches the results'}).toBe('results');
      await waitSittingAtRest(page, 60_000);
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator('[data-sit-results]:not([data-sit-results-hidden])')).toHaveCount(1, {timeout: 30_000});
      await expect(details(page), 'the step is closed until X').toHaveCount(0);
      await shoot(page, preset.id, '01-results');
      const barBefore = await hotBox(page);
      expect(barBefore, 'A «Закрыть заседание» stands on the bar').toBeDefined();
      await armLawProbe(page);

      // ── X — the payouts' inspection, ONE level deeper on the same card.
      expect(await pressUntil(page, 'KeyX', async () => await details(page).count() === 1, {tries: 3, settleMs: 900}), 'X opens «ПОДРОБНОСТИ ВЫПЛАТ»').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      // The enacted law never moves on the way in (the owner, 2026-10-24: it jumped up and down) — task samples only.
      const tops = await readLawProbe(page);
      expect(tops.length, 'the law probe sampled the entry').toBeGreaterThan(5);
      expect(Math.max(...tops) - Math.min(...tops), `the enacted law stands still (tops ${tops.slice(0, 40).map((t) => t.toFixed(1)).join(' ')})`).toBeLessThanOrEqual(1);
      // …and A keeps its place on the bar; the step offers no X «Закрыть» hint of its own.
      expect(await hotBox(page), 'A stands in the SAME place on the step').toEqual(barBefore);
      expect(await page.locator('.con-cmdbar__cmd:not(.con-cmdbar__cmd--hot)').filter({hasText: /Закрыть/}).count(), 'no X «Закрыть» hint in the step').toBe(0);
      expect(await crumbText(page), 'the crumb grows forward one level').toMatch(/ИТОГИ\s*·\s*ВЫПЛАТЫ/i);
      const read = await page.evaluate((viewer) => {
        const opacity = (sel: string) => {
          const el = document.querySelector<HTMLElement>(sel);
          return el === null ? -1 : Number(getComputedStyle(el).opacity);
        };
        const rule = document.querySelector('[data-sitpd-kind="rule"]');
        const mine = rule?.querySelector(`[data-sitpd-seat="${viewer}"]`) ?? null;
        return {
          enacted: opacity('[data-sit-enacted]'),
          payouts: opacity('[data-sit-section="payouts"]'),
          table: opacity('[data-sit-section="table"]'),
          sections: Array.from(document.querySelectorAll('[data-sitpd-section]')).map((s) => s.getAttribute('data-sitpd-section')),
          ruleHead: rule?.querySelector('[data-sitpd-rule]') !== null && rule !== null,
          rows: rule === null ? 0 : rule.querySelectorAll('[data-sitpd-seat]').length,
          mineReading: mine?.querySelector('[data-sitpd-reading] [data-yield-context]')?.getAttribute('data-yield-context') ?? '',
          mineLevy: mine?.querySelector('[data-yield-levy]') !== null && mine !== null,
          mineNet: mine?.querySelector('[data-yield-net-line]')?.getAttribute('data-yield-net-amount') ?? '',
          mineGot: mine === null ? 0 : mine.querySelectorAll('.con-sitpd__got [data-sit-part]').length,
        };
      }, viewer);
      expect(read.enacted, 'the enacted law keeps its column — the carried object').toBe(1);
      expect(read.payouts, 'the payouts column released in place').toBe(0);
      expect(read.table, 'the next-vote column released in place').toBe(0);
      expect(read.sections.length, 'a section per rule').toBeGreaterThan(0);
      expect(read.ruleHead, 'a rule section prints the card\'s own formula').toBe(true);
      expect(read.rows, 'a row per paid seat').toBeGreaterThan(0);
      expect(read.mineReading, 'the row reads the RECORDED payout').toBe('applied');
      expect(read.mineLevy, 'the levy rides at the head of its payout\'s row').toBe(true);
      expect(read.mineNet, 'the day\'s net closes the row').not.toBe('');
      expect(read.mineGot, 'what reached the seat — the results card\'s own chips').toBeGreaterThan(0);
      await expectParliamentFits(page, `${preset.id} payout details`);
      await shoot(page, preset.id, '02-details');

      // ── L3 — the SOURCE of the payouts, the enacted law, over the step.
      expect(await pressUntil(page, 'KeyC', async () => await page.locator('dialog.con-zoom[open].con-zoom--parliament').count() === 1, {tries: 3, settleMs: 900}),
        'L3 reads the enacted law').toBe(true);
      await shoot(page, preset.id, '03-source');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('dialog.con-zoom[open]').count() === 0, {tries: 3, settleMs: 900}), 'the law closes').toBe(true);
      await expect(details(page), 'the step stands under the source it lent').toHaveCount(1);

      // ── X folds it back; X opens again; B folds it back too.
      expect(await pressUntil(page, 'KeyX', async () => await details(page).count() === 0, {tries: 3, settleMs: 900}), 'X folds the step back').toBe(true);
      await expect.poll(() => page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-sit-section="payouts"]')!).opacity)), {timeout: 10_000}).toBe(1);
      expect(await pressUntil(page, 'KeyX', async () => await details(page).count() === 1, {tries: 3, settleMs: 900}), 'X opens it again').toBe(true);
      expect(await pressUntil(page, 'Escape', async () => await details(page).count() === 0, {tries: 3, settleMs: 900}), 'B folds it back').toBe(true);
      expect(await sittingStage(page), 'B never left the results page').toBe('results');
      expect(await strandedReports(page)).toEqual([]);
    });
  });
}
