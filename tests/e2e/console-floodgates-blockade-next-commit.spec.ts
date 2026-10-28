import {test, expect, Page} from './consoleTest';
import {bootFixture, openActionFocus, openCardActions, press, settle, waitForBoardHome} from './consoleStart';

/**
 * «ПОСЛЕ БЛОКАДЫ ДЕЙСТВИЯ НЕ ЗАВИСАЮТ» — the owner's field log of 2026-10-28.
 *
 * A Modular Floodgates BLOCKADE (variant B) hands its commit to the Hydronetwork's execution surface instead of the
 * ordinary dismissal. That branch left the shell's «fold owed» flag raised, and the shell's awaiting resolution skips
 * while it stands — so EVERY later card action of the session had its rail half seeded and never flown: the button
 * read «Выполняется…» until the half's 6 s ceiling (`[animation-hold] "action-commit-rail-owed" held for over 6000ms`,
 * Atmo Collectors / Jupiter Floating Station in the log). The healthy commit folds in ≈ 2 s.
 *
 * The table (`floodgates-blockade-then-action`): blue with Modular Floodgates (1 steel) and Electro Catapult (8 plants —
 * its price leaves the rail, so the commit seeds a rail half), red at the track's start. Blue deploys the blockade,
 * answers «Готово», then activates the catapult in the SAME session: the composer must fold on its own phrase, with no
 * ceiling warning.
 */

const PROFILE = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
/** The healthy fold is ≈ 2 s at motion ×1 (the commit beat + the rail half); the bug held it to the 6 s ceiling. */
const FOLD_BUDGET_MS = 4500;

async function focusedTile(page: Page): Promise<string> {
  return page.evaluate(() => {
    const tile = document.querySelector('.con-cardactions__tile--focused');
    const variant = (document.querySelector('.con-cardactions__detail-variant')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return `${tile?.getAttribute('data-action-card') ?? ''}|${variant}`;
  });
}

/** Walk the «Действия карт» grid until `match` holds for the focused tile (a 2D walk — the grid wraps by rows). */
async function focusAction(page: Page, match: (tile: string) => boolean): Promise<void> {
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && !match(await focusedTile(page)); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(match(await focusedTile(page)), `the action is focused (at «${await focusedTile(page)}»)`).toBe(true);
}

test.describe(`console-floodgates-blockade-next-commit · ${PROFILE.id}`, () => {
  test.use({viewport: PROFILE.viewport, deviceScaleFactor: 1, screen: PROFILE.viewport});

  test('after a blockade and «Готово», the next card action folds on its own phrase — never on the rail half\'s ceiling', async ({page, request}) => {
    test.setTimeout(420_000);
    const warnings: Array<string> = [];
    page.on('console', (m) => {
      if (m.type() === 'warning' && /action-commit-rail-owed|surface folded under its token/.test(m.text())) {
        warnings.push(m.text());
      }
    });
    await bootFixture(page, request, 'floodgates-blockade-then-action', {query: PROFILE.query});

    // ── 1. THE BLOCKADE: the deploy variant → its target → the commit → the execution surface → «Готово». ──
    await openCardActions(page);
    await focusAction(page, (t) => t.startsWith('Modular Floodgates|') && t.includes('2 / 2'));
    const stage = page.locator(COMPOSER);
    for (let i = 0; i < 4 && await stage.count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(stage, 'the deploy composer').toHaveCount(1, {timeout: 8000});
    for (let i = 0; i < 10 && await page.locator('.con-hydro__layer--blockpick').count() === 0; i++) {
      const missingFocused = await page.locator('.con-composer__row--focused.con-composer__row--missing').count();
      await press(page, missingFocused > 0 ? 'Enter' : 'ArrowDown', missingFocused > 0 ? 1300 : 260);
    }
    await page.waitForSelector('.con-hydro__layer--blockpick', {timeout: 10_000});
    await press(page, 'Enter', 1500);
    await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 10_000});
    await expect(stage, 'the composer came back with the target').toHaveCount(1, {timeout: 8000});
    for (let i = 0; i < 6 && await page.locator('.con-hydro__layer--blockexec').count() === 0; i++) {
      await press(page, 'Enter', 1600);
    }
    await page.waitForSelector('.con-hydro__layer--blockexec', {timeout: 15_000});
    await press(page, 'Enter', 1500);
    await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 10_000});
    await settle(page, {timeoutMs: 45_000});
    await waitForBoardHome(page, 30);

    // ── 2. THE NEXT CARD ACTION in the same session: Electro Catapult (a plant off the rail → 7 M€). ──
    await openCardActions(page);
    await focusAction(page, (t) => t.startsWith('Electro Catapult|'));
    await openActionFocus(page);
    await settle(page);
    for (let i = 0; i < 4 && await page.locator(`${COMPOSER} .con-composer__branches .con-vchoice__opt--selected[data-branch-pos], ${COMPOSER} .con-composer__cta--ready`).count() === 0; i++) {
      await press(page, 'Enter', 300);
    }
    for (let i = 0; i < 8 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 200);
    }
    await expect(page.locator(`${COMPOSER} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);

    const pressedAt = Date.now();
    await press(page, 'Enter', 0);
    await page.waitForSelector('.con-composer__cta--waiting', {timeout: 5000});
    await page.waitForSelector('.con-composer__cta--waiting', {state: 'detached', timeout: 15_000});
    const busyMs = Date.now() - pressedAt;
    expect(busyMs, `«Выполняется…» stood ${busyMs} ms — the fold waited for something past its own phrase`).toBeLessThan(FOLD_BUDGET_MS);
    expect(warnings, 'no rail half waited for its ceiling, no surface folded under its token').toEqual([]);
  });
});
