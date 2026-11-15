import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, press, settle} from './consoleStart';

/**
 * THE PLAYER'S OWN WORKSPACE OVER A LIVE PLACEMENT (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4, the
 * monkey's second seed: `fz1 · parliament-skyscrapers-enact`, cut down by the shrink to «A · RT · A»).
 *
 * The wheels keep working while a cell is being picked — a player looks at the hand before placing a tile — and the
 * hand opened there has the pad by the router's own rule (an open section is asked before the placement). Two
 * readers did not know that rule:
 *
 *  · THE COMMAND BAR stayed the placement's — «Размещение тайла · A Выбрать клетку» over an open hand, where A acts
 *    in the hand: the bar named a verb the pad did not have;
 *  · THE SCREEN SHADOW filed «expected board, on screen hand» — a defect event for a look at one's own cards.
 *
 * The law: the placement owns the bar only while the pad is on the board (`commandBarController.placementOwnsBar`),
 * and the player's own reversible surface over a placement is a hold of theirs (`ScreenShadowContext.lateral`) — B
 * is one press back to the cells, and nothing was asked of the server meanwhile.
 */
const context = (page: Page) => page.locator('.con-cmdbar__context');
// (The raw text: the bar's CSS upper-cases what is painted, the copy is what is asserted.)
const labels = async (page: Page) => (await page.locator('.con-cmdbar .con-cmdbar__label').allTextContents()).map((text) => text.trim());
const shadowFindings = (page: Page) =>
  page.evaluate(() => (window as unknown as {__conScreenShadow?: () => {findings: Array<unknown>}}).__conScreenShadow?.().findings.length ?? -1);

test.describe('a workspace of the player\'s own over a live placement', () => {
  test('the hand opened from the wheel while a cell is picked: the bar is the hand\'s, nothing is filed, B is back at the cells', async ({page, request}) => {
    test.setTimeout(240_000);
    const lines: Array<string> = [];
    page.on('console', (message) => {
      if (message.text().startsWith('[screen-shadow]')) {
        lines.push(message.text());
      }
    });
    await bootFixtureSeats(page, request, 'parliament-skyscrapers-enact', {landing: 'prompt'});
    await settle(page);
    // The enactment owes the viewer a tile: the plate stands on the board, A opens the cells.
    await expect(page.locator('.con-mandatory'), 'the placement is announced by its plate').toHaveCount(1);
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-board--placing'), 'the cells are live').toHaveCount(1);
    await expect(context(page)).toHaveText('Размещение тайла');
    await expect.poll(() => labels(page), {message: 'the placement speaks its own verbs', timeout: 10_000}).toContain('Выбрать клетку');

    // RT — the wheel keeps working while a cell is picked — and its «Рука».
    await press(page, 'Period', 400);
    await press(page, 'Enter', 900);
    await expect(page.locator('.con-hand'), 'the hand is open over the cells').toHaveCount(1);
    // THE BAR SAYS WHAT THE PAD DOES: the hand's own verbs, never a cell — and B names the way back.
    await expect(context(page), 'the bar is the hand\'s').toHaveText('Рука');
    await expect.poll(() => labels(page), {message: 'B is the way back to the cells', timeout: 10_000}).toContain('На поле');
    await expect.poll(() => labels(page), {message: 'no verb of the placement over an open hand', timeout: 10_000}).not.toContain('Выбрать клетку');

    // The shadow confirms a finding in three passes — a look at one's own hand is nobody's defect.
    await cinematicBeat(page, 5_000, 'the screen shadow\'s confirmation window (three 1 Hz passes) with a margin');
    expect(lines, 'no [screen-shadow] line').toEqual([]);
    expect(await shadowFindings(page), 'no finding in the shadow\'s own log').toBe(0);

    // B: one level back — the cells again, with the placement's own bar; the question never left.
    await press(page, 'Escape', 900);
    await expect(page.locator('.con-hand')).toHaveCount(0);
    await expect(page.locator('.con-board--placing'), 'the placement stood through it').toHaveCount(1);
    await expect(context(page)).toHaveText('Размещение тайла');
    await expect.poll(() => labels(page), {message: 'the cells speak again', timeout: 10_000}).toContain('Выбрать клетку');
  });
});
