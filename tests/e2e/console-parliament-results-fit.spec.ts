import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, FixtureName, openMandatoryAnnounce, pressUntil, settle} from './consoleStart';
import {expectParliamentFits, expectResultsContained, mandatoryPlate, PARLIAMENT_PRESETS, parliament, sittingStage, waitSittingAtRest} from './parliamentDrive';

/**
 * THE RESULTS CARD HOLDS ITS CONTENT — ON EVERY PROFILE (P71 · ledger CY; the owner's two frames of 2026-10-28: the seats'
 * plates spilled over each other and out of the card, the crown lay over a name). The card is SOLVED
 * (`resultsLayout.ts`) and this guard reads the real boxes (`expectResultsContained`): nothing leaves the card, a row's
 * pieces stay in their row, no two rows intersect, the crown never covers the name, no name or total is cut, a fresh
 * face keeps its caption's size — and in «ПОДРОБНОСТИ ВЫПЛАТ» nothing leaves its seat's column sideways.
 *
 * Three profiles on purpose (the guard is about a profile-specific geometry — the `KEEP` exception of the TV-only rule).
 * The tables: the owner's two frames (Mohole with the Greens' answer · MarsBot the winner on a colonial table), the
 * colonial table on three seats, a budget's levy, a law that walks the Career, a winner's tile, the Greens' answer.
 */
const FIXTURES: ReadonlyArray<FixtureName> = [
  'parliament-mohole-adjourn',
  'parliament-results-bot-colonial',
  'parliament-results-colonial-three',
  'parliament-budget-adjourn',
  'parliament-architecture-adjourn',
  'parliament-climate-adjourn',
];

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.resolve('screenshots', 'p71', preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`the results card holds its content (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    for (const fixture of FIXTURES) {
      test(`${fixture}: the card contained, the breakdown in its columns`, async ({page, request}) => {
        test.setTimeout(240_000);
        await bootFixtureSeats(page, request, fixture, {query: preset.query, landing: 'prompt'});
        await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
        expect(await openMandatoryAnnounce(page), 'the plate opens the sitting').toBe(true);
        await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
        await expect.poll(() => sittingStage(page), {timeout: 30_000}).toBe('results');
        await waitSittingAtRest(page, 30_000);
        await expect(page.locator('[data-sit-results]:not([data-sit-results-hidden])')).toHaveCount(1, {timeout: 30_000});
        await settle(page, {timeoutMs: 20_000});
        test.info().annotations.push({type: 'tier', description: await page.locator('[data-sit-results]').getAttribute('data-sit-tier') ?? '(none)'});
        // THE SOLVER'S VIEW, for a red's reader: the card's box, the rem, the scale and the numbers it decided.
        const solverView = await page.evaluate(() => {
          const card = document.querySelector<HTMLElement>('[data-sit-results]');
          const root = getComputedStyle(document.documentElement);
          const cs = card === null ? undefined : getComputedStyle(card);
          const vars = ['--sit-total-size', '--sit-row-pad', '--sit-enacted-zoom', '--sit-fresh-zoom', '--sit-enacted-w', '--sit-next-w'].map((v) => `${v}=${cs?.getPropertyValue(v).trim()}`);
          const rows = Array.from(document.querySelectorAll('[data-sit-payout]')).map((r) => {
            const rect = r.getBoundingClientRect();
            const who = r.querySelector('.con-sit__payout-who')?.getBoundingClientRect();
            return `${Math.round(rect.width)}×${Math.round(rect.height)} who ${Math.round(who?.width ?? 0)}`;
          });
          return `card ${card?.clientWidth}×${card?.clientHeight} rem ${root.fontSize} scale ${root.getPropertyValue('--con-ui-scale')} · ${vars.join(' ')} · rows ${rows.join(' | ')}`;
        });
        test.info().annotations.push({type: 'solver', description: solverView});
        console.log(`[solver] ${preset.id} ${fixture}: ${solverView}`);
        await shoot(page, preset.id, `fit-${fixture}`);
        await expectResultsContained(page, `${preset.id} ${fixture}`);
        // An ordinary table never FOLDS — the fold is the solver's theoretical edge; folding here means it under-measured the room.
        await expect(page.locator('[data-sit-total-fold]'), 'no row folded its tokens').toHaveCount(0);
        await expectParliamentFits(page, `${preset.id} ${fixture}`);
        if (await page.locator('[data-sit-payout]').count() > 0) {
          expect(await pressUntil(page, 'KeyX', async () => await page.locator('[data-sit-payout-details]').count() === 1, {tries: 3, settleMs: 900}),
            'X opens «ПОДРОБНОСТИ ВЫПЛАТ»').toBe(true);
          await settle(page, {timeoutMs: 20_000});
          await shoot(page, preset.id, `fit-${fixture}-details`);
          await expectResultsContained(page, `${preset.id} ${fixture} breakdown`);
        }
      });
    }
  });
}
