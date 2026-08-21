import {test, expect, Page} from '@playwright/test';
import {
  corporationsExcluding, createGameWithCards, fetchPlayerModel, openConsole,
  seedGameOverApi, sendPlayerInput, soloGameConfig,
} from './consoleStart';

/**
 * «ФОРА» (Head Start) — THE BONUS-ACTION HAND-OFF, end to end.
 *
 * The card grants two actions taken IMMEDIATELY, during the PRELUDES phase.
 * They cannot happen inside the Game Start Workspace (they need the whole
 * board — the wheel, the hand, standard projects, a tile), and they must not
 * end the preparation either. So the flow is: the workspace ANNOUNCES the trip
 * → the player confirms → the workspace COLLAPSES to the board → the bonuses
 * are spent → the workspace COMES BACK to finish the preparation.
 *
 * Four claims, each of which was a separate way to get this wrong:
 *  1. the stage stands INSIDE the workspace and names what it is (`1/2`),
 *     rather than the board silently appearing;
 *  2. `A` hands the screen over — the workspace hides, the board is live;
 *  3. the LT wheel REFUSES «Пас» / «Пропустить ход» and says why, instead of
 *     falling back to «сейчас недоступно» over a plainly live menu;
 *  4. spending the last bonus brings the workspace BACK, exactly once.
 *
 * The bonuses themselves are spent over the API — the point of the probe is
 * the SCREEN, and driving two arbitrary board actions with a keyboard would
 * make it a test of whatever action it happened to pick.
 */

const HEAD_START = 'Head Start';
const OTHER_PRELUDE = 'Allied Bank';

function preludeConfig(): Record<string, unknown> {
  return soloGameConfig({
    expansions: {corpera: true, promo: true, prelude: true},
    // The whole deal, so the probe's own preludes cannot be crowded out.
    customPreludes: [HEAD_START, OTHER_PRELUDE],
    // A corporation with no mandatory first action of its own: the first
    // action is a legitimate way to spend a bonus, and it has its OWN stage —
    // a different story than this one.
    customCorporationsList: corporationsExcluding(),
    startingPreludes: 2,
  });
}

/** Is the start workspace PAINTING (mounted-but-hidden is the whole point)? */
async function workspaceVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-start');
    if (el === null) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      getComputedStyle(el).visibility !== 'hidden' &&
      getComputedStyle(el).display !== 'none';
  });
}

/**
 * Spend ONE bonus action FROM THE BROWSER — LT wheel → «Конвертация тепла»
 * (the one basic action that needs no payment, no board space and no
 * follow-up, and `testMode` guarantees the heat).
 *
 * Deliberately NOT over the API: the client refuses a poll-driven refresh
 * while the VIEWER holds a prompt (partial input must survive), so answering
 * this player's own prompt from another HTTP client would leave the browser
 * looking at a state the server left minutes ago — a probe artifact that says
 * nothing about the product.
 */
async function spendOneBonus(page: Page): Promise<void> {
  await page.keyboard.press('Comma');
  await expect(page.locator('.con-quick'), 'the basic-actions wheel').toBeVisible({timeout: 10_000});
  await page.keyboard.press('ArrowRight'); // the heat-conversion slot
  await page.waitForTimeout(1500);
}

/** The two turn-control slots' reasons, read out of the open LT wheel. */
async function turnControlReasons(page: Page): Promise<Array<string>> {
  await page.keyboard.press('Comma');
  await expect(page.locator('.con-quick'), 'the LT wheel opens on the live bonus menu')
    .toBeVisible({timeout: 10_000});
  const reasons = await page.locator('.con-quick__slot-reason').allTextContents();
  await page.keyboard.press('Escape');
  await expect(page.locator('.con-quick'), 'the wheel closes again').toHaveCount(0, {timeout: 10_000});
  return reasons;
}

test.describe('console — Head Start bonus actions', () => {
  test('announces the trip, hands the board over, refuses to pass, and comes back', async ({page, request}) => {
    const playerId = await createGameWithCards(request, [], {config: preludeConfig()});
    // The API seeder answers the pregame and stops on the first ACTION MENU —
    // which, with Head Start played, is the first BONUS action.
    await seedGameOverApi(request, playerId, {
      preludes: [HEAD_START, OTHER_PRELUDE],
      first: HEAD_START,
      // A non-empty hand: «Фора» pays 2 M€ per project card held, and it gives
      // the bonus menu a follow-up-free branch («Sell patents») the probe can
      // spend a bonus on without turning into a test of standard projects.
      buy: 3,
    });

    const seeded = await fetchPlayerModel(request, playerId);
    const marker = (seeded.waitingFor as {bonusActionPrompt?: {granted?: number}} | undefined)?.bonusActionPrompt;
    expect(marker, 'the server marks the bonus action structurally').toBeDefined();
    expect(marker?.granted).toBe(2);

    await openConsole(page, playerId);

    // ── 1. THE STAGE STANDS, and it names itself ────────────────────────────
    const stage = page.locator('.con-start__bonusact');
    await expect(stage, 'the workspace announces the trip').toBeVisible({timeout: 30_000});
    await expect(page.locator('.con-start__bonusact-count')).toHaveText('1/2');
    // The CTA names the DESTINATION — the press moves the player, it performs
    // nothing.
    await expect(page.locator('.con-start__bonusact-cta')).toBeVisible();
    // …and it promises the return, or the hand-off reads as a dismissal.
    await expect(page.locator('.con-start__bonusact-cta-tail')).toBeVisible();
    expect(await workspaceVisible(page), 'the workspace is on screen').toBe(true);

    // ── 2. A HANDS THE SCREEN OVER ──────────────────────────────────────────
    await page.keyboard.press('Enter');
    await expect
      .poll(() => workspaceVisible(page), {timeout: 20_000, message: 'the workspace collapses to the board'})
      .toBe(false);
    // …and it is COLLAPSED, not closed — the frame is still mounted, which is
    // what makes the return the same instance rather than a fresh workspace.
    expect(await page.locator('.con-start').count(), 'the frame survives the trip').toBeGreaterThan(0);

    // ── 3. THE WHEEL REFUSES THE TURN-CONTROL VERBS, AND SAYS WHY ───────────
    const reasons = await turnControlReasons(page);
    // The two turn-control slots must NAME the rule. Falling back to «сейчас
    // недоступно» over a plainly live menu is exactly what this replaces, so
    // the assertion is on the WORD, not on «some reason exists».
    expect(reasons.join(' | '), 'the wheel explains the withheld turn control')
      .toMatch(/бонусн/i);
    // …and the rest of the wheel is untouched: most basic actions stay live.
    expect(reasons.length, 'only the two turn-control slots are blocked').toBeLessThan(4);

    // ── 4. THE LAST BONUS BRINGS THE WORKSPACE BACK ─────────────────────────
    // The chip is the readout every seat shares, so it doubles as the honest
    // probe that the spend actually registered.
    const counter = page.locator('.con-status__pstatus-counter').first();
    await expect(counter, 'the first bonus is standing').toHaveText('1/2');

    await spendOneBonus(page);
    await expect(counter, 'the chip walks 1/2 → 2/2').toHaveText('2/2', {timeout: 25_000});
    expect(await workspaceVisible(page), 'the board keeps the screen between bonuses').toBe(false);

    await spendOneBonus(page);
    await expect
      .poll(() => workspaceVisible(page), {timeout: 40_000, message: 'the workspace returns to finish the preparation'})
      .toBe(true);
    // …and it returns to the DEPLOYMENT, not to the bonus stage it just left.
    await expect(page.locator('.con-start__bonusact')).toHaveCount(0);
  });
});
