import {expect, test} from './consoleTest';
import {bootFixture} from './consoleStart';

/**
 * POLDERTECH DUTCH (CF3) — the fork's own bot card, «the Polder» (docs/AUTOMA_DATA_AUDIT.md §20): land won from the
 * sea, bot greeneries on spaces RESERVED FOR OCEANS. The fixture `bot-polder` stands two of them on the board; this
 * probe reads them off the server's model and photographs each cell — a greenery on a blue cell must paint as a
 * greenery (the tile's art over the water), never as water and never as an empty cell.
 */

type Space = {id: string, spaceType: string, tileType?: number, color?: string};

test.describe('console: a MarsBot corporation that wins land from the sea', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('two polders stand on ocean spaces and paint as greeneries', async ({page, request}) => {
    test.setTimeout(240_000);
    const viewer = await bootFixture(page, request, 'bot-polder', {query: '&consoleProfile=tv'});
    const model = await (await request.get(`/api/player?id=${viewer}`)).json();
    const bot = (model.players as Array<{color: string, isMarsBot?: boolean}>).find((p) => p.isMarsBot === true);
    expect(bot, 'the bot seat').toBeTruthy();
    const spaces: Array<Space> = model.game.spaces;
    const polders = spaces.filter((s) => s.spaceType === 'ocean' && s.color === bot!.color && s.tileType !== undefined);
    expect(polders.length, `two polders on ocean spaces: ${JSON.stringify(polders)}`).toBe(2);
    for (const polder of polders) {
      const cell = page.locator(`[data_space_id="${polder.id}"]`).first();
      await expect(cell, `the polder cell ${polder.id}`).toBeVisible();
      await expect(cell.locator('> [class*="board-space-tile--greenery"]'), 'it paints the greenery tile').toHaveCount(1);
      await expect(cell.locator('> [class*="board-space-tile--ocean"]'), 'never the water').toHaveCount(0);
      await cell.screenshot({path: `screenshots/bot-corp-polder-${polder.id}.png`});
    }
    await page.screenshot({path: 'screenshots/bot-corp-polder-board.png', fullPage: false});
  });
});
