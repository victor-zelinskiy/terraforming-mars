import {test, expect} from './consoleTest';
import {
  createGameWithCards, fetchPlayerModel, openActionFocus, openCardActions, openConsole, press, pressUntil, seedGameOverApi,
  settle, soloGameConfig,
} from './consoleStart';

/**
 * A CARD ACTION WHOSE ANSWER THE NETWORK LOST (the box's autopilot on `1bfeff8d9a`, game 2907 — a storm game).
 *
 * «Астероидный пояс»'s action was sent; the server MADE the move (an asteroid on the card, the action used for the
 * generation) and the answer was lost on the way back. The page said «cannot contact», unwound the press to the setup
 * and fetched the truth — and the composer stood confirmable over an action the server no longer offered: every
 * «Подтвердить» sent the same batch, fourteen 400s of «Card Main Belt Asteroids not found».
 *
 * THE CLAIM: availability is the server's word (invariant 2) — once the truth says the action is spent, the composer
 * folds back with the reason said, and no press sends the action again.
 */
const CARD = 'Main Belt Asteroids';

test.describe('console — a card action whose answer the network lost', () => {
  test.setTimeout(180_000);

  test('the composer folds when the truth no longer offers its action — never a second batch', async ({page, request}) => {
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {corpera: true, prelude: true, prelude2: true},
      customPreludes: [CARD, 'Allied Bank', 'Biolab', 'Donation'],
      startingPreludes: 2,
    })});
    await seedGameOverApi(request, playerId, {preludes: [CARD, 'Allied Bank']});
    const before = await fetchPlayerModel(request, playerId);
    const card = () => (before.thisPlayer as {tableau: Array<{name: string, resources?: number}>}).tableau.find((c) => c.name === CARD);
    expect(card(), 'the prelude is on the table').toBeDefined();

    // THE WEATHER: the first batch reaches the server, its answer does not reach the page.
    const posts: Array<number> = [];
    let lost = false;
    // (A one-step action rides `/player/input`, a composed one `/player/input-batch` — the field's was the batch.)
    await page.route(/\/player\/input(-batch)?(\?|$)/, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      if (!lost) {
        lost = true;
        posts.push(Date.now());
        await route.fetch().catch(() => undefined);
        await route.abort('failed');
        return;
      }
      posts.push(Date.now());
      await route.continue();
    });

    await openConsole(page, playerId);
    await openCardActions(page);
    await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'the action is offered').toHaveCount(1, {timeout: 20_000});
    for (let i = 0; i < 8 && await page.locator(`.con-cardactions__tile--focused[data-action-card="${CARD}"]`).count() === 0; i++) {
      await press(page, 'ArrowRight', 300);
    }
    await openActionFocus(page);
    await settle(page);
    // The commit row, then A — the one batch (act → verify → retry: A again only after a window in which nothing was sent).
    for (let i = 0; i < 8 && await page.locator('.con-cardactions__stagewrap .con-composer__cta--focused').count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    expect(await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 3_000}), 'the action was sent').toBe(true);

    // The server made the move.
    await expect.poll(async () => ((await fetchPlayerModel(request, playerId)).thisPlayer as {tableau: Array<{name: string, resources?: number}>})
      .tableau.find((c) => c.name === CARD)?.resources ?? 0, {timeout: 20_000, message: 'the asteroid landed on the server'}).toBeGreaterThan(0);
    // The page reads the alert and goes on, as a player does.
    await expect(page.locator('.con-alert'), 'the page says the network failed').toHaveCount(1, {timeout: 20_000});
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-alert')).toHaveCount(0, {timeout: 10_000});

    // THE CLAIM: the truth no longer offers the action — the composer folds, and the press that follows sends nothing.
    await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage'), 'the composer folded back').toHaveCount(0, {timeout: 20_000});
    for (let i = 0; i < 3; i++) {
      await press(page, 'Enter', 900);
    }
    await settle(page);
    expect(posts.length, 'one submit — the lost one; never the spent action again').toBe(1);
  });
});
