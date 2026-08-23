import {test, expect} from '@playwright/test';
import {
  createGameWithCards, fetchPlayerModel, openConsole, seedGameOverApi, soloGameConfig,
} from './consoleStart';

/**
 * «ФОРА» + A CORP WITH A MANDATORY FIRST ACTION — the NESTED case.
 *
 * The official texts compose: «as your first action» and «immediately take 2
 * actions» resolve to the same press, so the server serves the corp's
 * mandatory move AS bonus action #1. The workspace must present it that way —
 * an ITEM of the bonus window, never a chapter of its own:
 *
 *  1. the first-action briefing stands INSIDE «Фора»'s flow: the crumb stays
 *     «СТАРТ ПАРТИИ › ФОРА › ПЕРВОЕ ДЕЙСТВИЕ», the panel wears both the
 *     MANDATORY chip and the window's «БОНУСНОЕ ДЕЙСТВИЕ 1/2» counter;
 *  2. the journey rail stays on «Бонусные действия» — no separate
 *     «Первое действие» chapter exists for a stage the player reaches as
 *     the window's own item (the remaining prelude legitimately WAITS);
 *  3. the claimable GAINS (the ordering choice) ride this prompt too: the
 *     player may take the steel / M€ before the mandatory action, and a claim
 *     costs no action.
 */

const HEAD_START = 'Head Start';
const OTHER_PRELUDE = 'Allied Bank';

test.describe('console — nested first action inside the bonus window', () => {
  test.setTimeout(180_000);

  test('the corp\'s mandatory move is bonus action 1, with the gains claimable on it', async ({page, request}) => {
    const playerId = await createGameWithCards(request, [], {
      config: soloGameConfig({
        expansions: {corpera: true, promo: true, prelude: true},
        customPreludes: [HEAD_START, OTHER_PRELUDE],
        // Inventrix: a mandatory first action (draw 3) with no board work —
        // the nested stage's cleanest representative.
        customCorporationsList: ['Inventrix'],
      }),
    });
    await seedGameOverApi(request, playerId, {
      corporation: 'Inventrix',
      preludes: [HEAD_START, OTHER_PRELUDE],
      first: HEAD_START,
      buy: 3,
      until: 'startRelease',
    });

    // The WIRE: one prompt, BOTH markers — the structural signature of nesting.
    const seeded = await fetchPlayerModel(request, playerId);
    const wf = seeded.waitingFor as {
      startGamePrompt?: {kind?: string},
      bonusActionPrompt?: {remaining?: number, gains?: Array<unknown>},
    } | undefined;
    expect(wf?.startGamePrompt?.kind).toBe('corporationInitialAction');
    expect(wf?.bonusActionPrompt?.remaining).toBe(2);
    expect(wf?.bonusActionPrompt?.gains?.length).toBe(2);

    await openConsole(page, playerId, '&consoleProfile=tv');

    // ── 1. THE NESTED BRIEFING ──────────────────────────────────────────────
    await expect(page.locator('.con-start__firstact')).toBeVisible({timeout: 40_000});
    await expect(page.locator('.con-start__firstact-bonusctx'), 'the window\'s 1/2 chip').toHaveCount(1);
    await expect(page.locator('.con-start__firstact-bonusctx')).toContainText('1/2');
    const crumb = (await page.locator('.con-wshead').textContent()) ?? '';
    expect(crumb, 'the crumb keeps the WINDOW as the subject').toMatch(/Фора/);
    expect(crumb).toMatch(/Первое действие/i);

    // ── 2. THE RAIL STAYS ON THE BONUS CHAPTER ──────────────────────────────
    const rail = await page.locator('.con-jrail__item').allTextContents();
    expect(rail.join(' | ')).toMatch(/Бонусные действия/);
    expect(rail.join(' | '), 'no separate first-action chapter for a nested stage')
      .not.toMatch(/Первое действие/);

    // ── 3. THE GAINS ARE CLAIMABLE ON THE CORP PROMPT ───────────────────────
    await expect(page.locator('.con-start__gainrow')).toHaveCount(2);
    await page.keyboard.press('ArrowDown'); // → the steel row
    await page.keyboard.press('Enter');
    await expect(page.locator('.con-start__gainrow'), 'the claimed row is gone').toHaveCount(1, {timeout: 20_000});
    const afterClaim = await fetchPlayerModel(request, playerId);
    expect((afterClaim.thisPlayer as {steel?: number}).steel, 'the steel arrived (testMode base 500)').toBe(502);
    expect((afterClaim.thisPlayer as {bonusActions?: number}).bonusActions, 'no action was spent').toBe(2);
    // …and the mandatory action still stands, 1/2 unchanged.
    await expect(page.locator('.con-start__firstact-bonusctx')).toContainText('1/2');
  });
});
