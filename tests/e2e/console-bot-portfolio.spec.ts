import {expect, test} from './consoleTest';
import {bootSeededGame, openBotScreenHub, press, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * THE BOT'S PORTFOLIO (docs/claude/prompts/marsbot-portfolio-dividends.md) —
 * a game whose bot HOLDS two corporations besides its primary (the campaign
 * passes them as `automa.portfolio`; a solo config does the same, which is
 * how this spec reaches the surface without a campaign):
 *
 *  · the bot screen's corporation plate shows the primary's face, then the
 *    two HOLDINGS as smaller faces, each with its live dividend «+N ПО» and
 *    the dividend's own name;
 *  · the bot seat's score carries the «Дивиденды» medallion from generation 1
 *    (the owner's D3 — the number grows in plain sight, an honest 0 included).
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

    test('the bot screen shows the holdings with their live dividend, and the score its own category', async ({page, request}) => {
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

      // THE SCORE (the summary the seat opens on) — the dividends medallion stands from the first generation.
      await expect(page.locator('[data-dossier-medal="dividends"]'),
        'the bot\'s score carries its dividends category while it holds a corporation').toHaveCount(1);

      // THE BOT SCREEN — the primary, then the two holdings with their dividend.
      await openBotScreenHub(page);
      const portfolio = page.locator('[data-bot-portfolio]');
      await expect(portfolio, 'the portfolio stands on the corporation plate').toBeVisible();
      await expect(portfolio.locator('[data-holding]')).toHaveCount(2);
      for (const id of ['C02', 'C10']) {
        const holding = portfolio.locator(`[data-holding="${id}"]`);
        await expect(holding.locator('.pcard'), `${id}: its face`).toBeVisible();
        await expect(holding.locator('[data-dividend-vp]'), `${id}: its live dividend`).toHaveText(/^\+\d+/);
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
    });
  });
}
