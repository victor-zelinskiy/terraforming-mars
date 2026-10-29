import {Locator, Page, expect, test} from './consoleTest';
import {bootFixture, bootSeededGame, fetchPlayerModel, openBotScreenHub, openInfoPlayedTable, press, soloGameConfig, visibleSurfaces} from './consoleStart';

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


type WireTerm = {label: string, count: number, threshold?: number, each: number, vp: number};
type WireDividend = {corporation: string, vp: number, terms: ReadonlyArray<WireTerm>};

/** The bot's dividend row of one held corporation, off the server's own model (the bot's breakdown is open). */
function dividendRowOf(model: unknown, corp: string): WireDividend {
  const players = (model as {players: ReadonlyArray<{isMarsBot?: boolean, victoryPointsBreakdown: {automa?: {detailsDividends?: ReadonlyArray<WireDividend>}}}>}).players;
  const row = players.find((p) => p.isMarsBot === true)?.victoryPointsBreakdown.automa?.detailsDividends?.find((d) => d.corporation === corp);
  expect(row, `the server reports ${corp}'s dividend`).toBeDefined();
  return row!;
}

/**
 * THE LIVE LEDGER (the owner, 2026-10-27; the goal as ONE scale of three tiers, 2026-10-28): the inspected
 * holding's «ДИВИДЕНДЫ» box is ONE composition — the mechanic (its name, its printed rule, the formula's live
 * terms), the goal's scale (each tier's threshold and prize, reached or not, ONE line for what the next tier
 * needs) and the total WITH the goal — and every number in it is the server's row of that corporation. The box
 * stands whole inside the rules panel. Returns the row's goal terms.
 */
async function expectLedgerReadsServer(page: Page, rules: Locator, model: unknown, corp: string): Promise<ReadonlyArray<WireTerm>> {
  const row = dividendRowOf(model, corp);
  const goalTerms = row.terms.filter((t) => t.label === 'Goal' || t.label === 'Second goal' || t.label === 'Third goal');
  expect(goalTerms.length, 'the row carries its three goal tiers').toBe(3);
  const formulaTerms = row.terms.filter((t) => !goalTerms.includes(t));
  const box = rules.locator(`[data-rules-group="botcorp:${corp}:dividend"]`);
  await expect(box, 'the dividend LEADS — the one thing a holding does').toHaveCount(1);
  await expect(rules.locator('section').first()).toHaveAttribute('data-rules-group', `botcorp:${corp}:dividend`);
  await expect(box.locator('.con-zoom-rules__text'), 'the ledger draws the whole box — no printed rows beside it').toHaveCount(0);
  const ledger = box.locator('[data-dividend-ledger]');
  await expect(ledger).toBeVisible();
  // The mechanic: the name, the printed rule without the goal line, one row per live term with the VP it pays.
  const formula = ledger.locator('[data-dividend-formula]');
  await expect(formula.locator('[data-dividend-name]')).not.toHaveText('');
  await expect(formula, 'when it pays').toContainText(/в конце партии/i);
  await expect(formula, 'the printed goal line yields to the goal scale').not.toContainText(/Цели: от \d+/);
  const termVps = await formula.locator('[data-dividend-term]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-term-vp'))));
  expect(termVps, 'one row per live term, each with the VP the server pays it').toEqual(formulaTerms.map((t) => t.vp));
  // The goal: ONE scale, three tiers under it, ONE line for the next tier.
  await expect(ledger.locator('[data-dividend-goal-scale]'), 'one scale, not a plate per goal').toHaveCount(1);
  await expect(ledger.locator('[data-dividend-count]')).toHaveText(String(goalTerms[0].count));
  for (const [i, term] of goalTerms.entries()) {
    const tier = ledger.locator(`[data-dividend-goal="${i + 1}"]`);
    await expect(tier.locator('[data-goal-at]'), `tier ${i + 1}: its threshold`).toHaveText(`от ${term.threshold}`);
    await expect(tier.locator('[data-goal-vp]'), `tier ${i + 1}: its prize`).toHaveText(`+${term.each} ПО`);
    await expect(tier, `tier ${i + 1}: reached or not`).toHaveAttribute('data-goal-reached', String(term.vp > 0));
  }
  const next = goalTerms.find((t) => t.vp === 0);
  await expect(ledger.locator('[data-goal-state]'), 'one line: what the next tier needs').toHaveText(
    next === undefined ? 'Все цели взяты' : `Ещё ${next.threshold! - next.count} до +${next.each} ПО`);
  // The total.
  const goalsVp = goalTerms.reduce((sum, t) => sum + t.vp, 0);
  await expect(ledger.locator('[data-dividend-vp]'), 'the total WITH the goals').toHaveText(String(row.vp));
  await expect(ledger.locator('[data-dividend-total]')).toContainText(`формула ${row.vp - goalsVp} + цели ${goalsVp}`);
  // Read whole: inside the rules panel, nothing of it cut.
  const inside = await page.evaluate((sel) => {
    const panel = document.querySelector('.con-zoom-rules');
    const el = document.querySelector(sel);
    if (panel === null || el === null) {
      return false;
    }
    const p = panel.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return b.left >= p.left - 1 && b.right <= p.right + 1 && b.bottom <= p.bottom + 1;
  }, `[data-rules-group="botcorp:${corp}:dividend"] [data-dividend-ledger]`);
  expect(inside, 'the ledger stands inside the rules panel').toBe(true);
  return goalTerms;
}

/** Information → the bot seat → its «Разыграно» table → A: the inspect opens on the front holding. */
async function inspectBotHolding(page: Page): Promise<Locator> {
  await press(page, 'KeyY', 1200);
  await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
  const botLine = page.locator('.con-info__corp--bot');
  for (let i = 0; i < 4 && await botLine.count() === 0; i++) {
    await press(page, 'KeyE', 900);
  }
  await expect(botLine, 'the bot seat is on stage').toHaveCount(1);
  await openInfoPlayedTable(page);
  await expect(page.locator('.con-played__botcorp.con-played__slot--front'), 'the newest holding in front').toHaveAttribute('data-bot-corp', 'C10');
  await press(page, 'Enter', 1600);
  await expect(page.locator('.con-zoom .card-zoom-stage .pcard')).toBeVisible();
  const rules = page.locator('.con-zoom-rules');
  await expect(rules).toBeVisible();
  return rules;
}

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
      await expectLedgerReadsServer(page, rules, await fetchPlayerModel(request, players[0].id), 'C10');
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

    test('the goal tiers REACHED: the scale reads the paid tiers by material, the line the next one, the total carries them', async ({page, request}) => {
      test.setTimeout(240_000);
      const viewer = await bootFixture(page, request, 'bot-portfolio-dividends', {query: profile.query});
      const rules = await inspectBotHolding(page);
      const model = await fetchPlayerModel(request, viewer);

      // Tharsis Republic — goal «Окраинные парки» (its greeneries on the rim), 5 over tiers of 3 / 5 / 6: two paid,
      // the last one greenery short. The goal is the box's OWN operand, apart from the cities its formula counts.
      const tharsis = await expectLedgerReadsServer(page, rules, model, 'C10');
      expect(tharsis.map((t) => t.vp > 0), 'the fixture reaches two of Tharsis\'s three tiers').toEqual([true, true, false]);
      await expect(rules.locator('[data-dividend-goal-name]'), 'the goal plate names the goal').toHaveText('Цель «Окраинные парки»');
      await expect(rules.locator('.con-divledger__notch--reached'), 'a paid tier is a solid notch').toHaveCount(2);
      await page.screenshot({path: `screenshots/bot-portfolio-dividends-reached-${profile.id}.png`, fullPage: false});

      // ← → Ecoline — goal «Заболоченные земли» (its oceans touching two or more oceans), 4 over tiers of 4 / 5 / 6:
      // the first paid, the second one short.
      await press(page, 'ArrowLeft', 900);
      const ecoline = await expectLedgerReadsServer(page, rules, model, 'C02');
      expect(ecoline.map((t) => t.vp > 0), 'the fixture reaches only Ecoline\'s first tier').toEqual([true, false, false]);
      await page.screenshot({path: `screenshots/bot-portfolio-dividends-partial-${profile.id}.png`, fullPage: false});
    });
  });
}
