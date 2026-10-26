import {expect, test} from './consoleTest';
import {bootSeededGame, openBotScreenHub, openInfoPlayedTable, press, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * THE BOT'S PORTFOLIO (docs/claude/prompts/marsbot-portfolio-dividends.md) —
 * a game whose bot HOLDS two corporations besides its primary (the campaign
 * passes them as `automa.portfolio`; a solo config does the same, which is
 * how this spec reaches the surface without a campaign):
 *
 *  · in a campaign the bot reads as ONE MORE PLAYER (the owner, 2026-10-27):
 *    its holdings are further corporations — plain faces on the bot screen's
 *    corporation plate, the cascade of three on its «Разыграно» table (the
 *    newest in front), no score category of their own (their points stand in
 *    «Карты»);
 *  · the difference is told where the rules are read: the inspected holding's
 *    rules panel says it does not act while MarsBot holds it.
 *
 * The human is dealt corporations that collide with neither the primary
 * (Credicor) nor the holdings (Ecoline, Tharsis Republic): a collision would
 * legitimately drop a holding and the spec would measure another table.
 */

const PORTFOLIO_CONFIG = soloGameConfig({
  automa: {difficulty: 'hard', corporation: 'C01', portfolio: ['C02', 'C10']},
  customCorporationsList: ['Helion', 'Interplanetary Cinematics', 'Inventrix', 'Mining Guild'],
});

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console: the MarsBot portfolio (${profile.id})`, () => {
    test.use({viewport: profile.viewport});

    test('the holdings read as further corporations: the bot screen, «Разыграно», the score, the rules', async ({page, request}) => {
      test.setTimeout(360_000);
      const created = await request.post('/api/creategame', {data: PORTFOLIO_CONFIG});
      expect(created.ok(), 'the server accepted the portfolio config').toBeTruthy();
      const {players} = await created.json();
      await bootSeededGame(page, request, players[0].id, {query: profile.query});

      // Information workspace → the BOT seat.
      await press(page, 'KeyY', 1200);
      await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
      const botLine = page.locator('.con-info__corp--bot');
      for (let i = 0; i < 4 && await botLine.count() === 0; i++) {
        await press(page, 'KeyE', 900);
      }
      await expect(botLine, 'the bot seat is on stage').toHaveCount(1);

      // THE SCORE (the summary the seat opens on) — no category of their own: a player's corporations score as cards.
      await expect(page.locator('[data-dossier-medal="cards"]'), 'the cards medallion stands').toHaveCount(1);
      await expect(page.locator('[data-dossier-medal="dividends"]'), 'no medallion apart for the holdings').toHaveCount(0);

      // THE BOT SCREEN — the primary, then the two holdings as plain faces.
      await openBotScreenHub(page);
      const portfolio = page.locator('[data-bot-portfolio]');
      await expect(portfolio, 'the portfolio stands on the corporation plate').toBeVisible();
      await expect(portfolio.locator('[data-holding]')).toHaveCount(2);
      for (const id of ['C02', 'C10']) {
        const holding = portfolio.locator(`[data-holding="${id}"]`);
        await expect(holding.locator('.pcard'), `${id}: its face`).toBeVisible();
      }
      // Nothing of the plate may be cut: the holdings stand INSIDE the corporation plate.
      const fits = await page.evaluate(() => {
        const plate = document.querySelector('.con-botscr__plate--corp');
        const box = document.querySelector('[data-bot-portfolio]');
        if (plate === null || box === null) {
          return false;
        }
        const p = plate.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        return b.top >= p.top - 1 && b.bottom <= p.bottom + 1 && b.left >= p.left - 1 && b.right <= p.right + 1;
      });
      expect(fits, 'the portfolio fits inside its plate').toBe(true);
      await page.screenshot({path: `screenshots/bot-portfolio-${profile.id}.png`, fullPage: false});

      // «РАЗЫГРАНО» — the corporation zone is a cascade of the three, the newest holding in front.
      await press(page, 'KeyB', 900);
      await openInfoPlayedTable(page);
      const corps = page.locator('.con-played__botcorp');
      await expect(corps, 'three corporations on the bot\'s table').toHaveCount(3);
      expect(await corps.evaluateAll((els) => els.map((e) => e.getAttribute('data-bot-corp'))), 'in play order').toEqual(['C01', 'C02', 'C10']);
      await expect(page.locator('.con-played__botcorp.con-played__slot--front'), 'the newest in front').toHaveAttribute('data-bot-corp', 'C10');
      for (let i = 0; i < 3; i++) {
        await expect(corps.nth(i).locator('.pcard'), `corporation ${i + 1}: its face`).toBeAttached();
      }
      await page.screenshot({path: `screenshots/bot-portfolio-played-${profile.id}.png`, fullPage: false});

      // A → the inspect opens on the front holding; its rules tell what the table does not.
      await press(page, 'Enter', 1600);
      await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
      const rules = page.locator('.con-zoom-rules');
      await expect(rules).toBeVisible();
      await expect(rules, 'the holding\'s printed boxes are marked as not acting').toContainText('Не действует, пока корпорация — холдинг MarsBot');
      await expect(rules.locator('section').first(), 'its dividend LEADS — the one thing a holding does')
        .toContainText('в конце партии она приносит эти дивиденды');
      await page.screenshot({path: `screenshots/bot-portfolio-rules-${profile.id}.png`, fullPage: false});
    });
  });
}
