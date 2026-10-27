import {expect, test} from './consoleTest';
import {bootSeededGame, fetchPlayerModel, openBotScreenHub, openInfoPlayedTable, press, soloGameConfig, visibleSurfaces} from './consoleStart';

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
 *    rules panel says it does not act while MarsBot holds it, and its dividend reads LIVE (both goals and the total, the server's numbers); the primary has no dividend box.
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
      await expect(rules, 'the holding\'s printed boxes are marked as not acting').toContainText('Не действует, пока это дополнительная корпорация MarsBot');
      const dividendBox = rules.locator('section').first();
      await expect(dividendBox, 'its dividend LEADS — the one thing a holding does').toHaveAttribute('data-rules-group', 'botcorp:C10:dividend');
      await expect(dividendBox).toContainText('— ПО в конце партии');

      // THE LIVE LEDGER (the owner, 2026-10-27): both goals' thresholds and progress, and the total WITH the goals —
      // every number the server's own dividend row of this corporation.
      const model = await fetchPlayerModel(request, players[0].id);
      const bot = ((model as unknown as {players: unknown}).players as ReadonlyArray<{isMarsBot?: boolean, victoryPointsBreakdown: {automa?: {detailsDividends?: ReadonlyArray<{corporation: string, vp: number, terms: ReadonlyArray<{label: string, count: number, threshold?: number, each: number, vp: number}>}>}}}>)
        .find((p) => p.isMarsBot === true);
      const row = bot?.victoryPointsBreakdown.automa?.detailsDividends?.find((d) => d.corporation === 'C10');
      expect(row, 'the server reports the holding\'s dividend').toBeDefined();
      const goalTerms = row!.terms.filter((t) => t.label === 'Goal' || t.label === 'Second goal');
      expect(goalTerms.length, 'the row carries its two goals').toBe(2);
      const ledger = dividendBox.locator('[data-dividend-ledger]');
      await expect(ledger, 'the ledger stands under the printed rule').toBeVisible();
      await expect(dividendBox, 'the printed goal line yields to the live ledger').not.toContainText(/Цель: от \d+ — \+\d+ ПО; от/);
      await expect(ledger.locator('[data-dividend-count]')).toHaveText(String(goalTerms[0].count));
      for (const [i, term] of goalTerms.entries()) {
        const goal = ledger.locator(`[data-dividend-goal="${i + 1}"]`);
        await expect(goal.locator('[data-goal-at]'), `goal ${i + 1}: its threshold`).toHaveText(`от ${term.threshold}`);
        await expect(goal.locator('[data-goal-vp]'), `goal ${i + 1}: its prize`).toHaveText(`+${term.each} ПО`);
        const reached = term.vp > 0;
        await expect(goal, `goal ${i + 1}: reached or not`).toHaveAttribute('data-goal-reached', String(reached));
        await expect(goal.locator('[data-goal-state]')).toHaveText(reached ? 'Взята' : `Ещё ${term.threshold! - term.count}`);
      }
      const goalsVp = goalTerms.reduce((s, t) => s + t.vp, 0);
      await expect(ledger.locator('[data-dividend-vp]'), 'the total WITH the goals').toHaveText(String(row!.vp));
      await expect(ledger.locator('[data-dividend-total]')).toContainText(`формула ${row!.vp - goalsVp} + цели ${goalsVp}`);
      // The ledger is read whole: inside the rules panel, nothing of it cut.
      const inside = await page.evaluate(() => {
        const panel = document.querySelector('.con-zoom-rules');
        const box = document.querySelector('[data-dividend-ledger]');
        if (panel === null || box === null) {
          return false;
        }
        const p = panel.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        return b.left >= p.left - 1 && b.right <= p.right + 1 && b.bottom <= p.bottom + 1;
      });
      expect(inside, 'the ledger stands inside the rules panel').toBe(true);
      await page.screenshot({path: `screenshots/bot-portfolio-rules-${profile.id}.png`, fullPage: false});

      // ← twice → the PRIMARY: no dividend section at all (it never pays one).
      for (const id of ['C02', 'C01']) {
        await press(page, 'ArrowLeft', 900);
        await expect(rules.locator('section').first(), `${id} is on stage`).toHaveAttribute('data-rules-group', /^botcorp:/);
        if (id === 'C02') {
          await expect(rules.locator('[data-rules-group="botcorp:C02:dividend"] [data-dividend-ledger]'), 'the other holding reads its own ledger').toBeVisible();
        }
      }
      await expect(rules.locator('[data-rules-group="botcorp:C01:dividend"]'), 'the primary has no dividend box').toHaveCount(0);
      await expect(rules.locator('[data-dividend-ledger]')).toHaveCount(0);
      await expect(rules, 'the primary\'s boxes act').not.toContainText('Не действует');
    });
  });
}
