import {test, expect} from '@playwright/test';
import {
  createGameWithCards, fetchPlayerModel, openConsole, seedGameOverApi, soloGameConfig,
} from './consoleStart';

/**
 * «ФОРА» + A CORP WITH A MANDATORY FIRST ACTION — the NESTED case.
 *
 * The official texts compose: «as your first action» and «immediately take 2
 * actions» resolve to the same press, so the server serves the corp's
 * mandatory move AS bonus action #1. The workspace presents that as ONE flow
 * whose source is «Фора» at all times:
 *
 *  1. the window opens on an OVERVIEW — seat = «Фора», the PLAN names both
 *     items (the mandatory move wears the corporation's chip), and the
 *     mandatory item is the CURRENT one;
 *  2. the journey rail stays on «Бонусные действия» — no separate
 *     «Первое действие» chapter exists for a stage the player reaches as
 *     the window's own item (the remaining prelude legitimately WAITS);
 *  3. the claimable GAINS (the ordering choice) ride this prompt too: the
 *     player claims the steel BEFORE the mandatory action, on the overview,
 *     and a claim costs no action;
 *  4. the mandatory move is an explicit SUB-STAGE: the player descends by A,
 *     the seat premium-swaps «Фора» → the corporation, the panel wears both
 *     the MANDATORY chip and the window's «1/2» counter, and B walks back
 *     up — seat back to «Фора», the claim intact.
 */

const HEAD_START = 'Head Start';
const OTHER_PRELUDE = 'Allied Bank';

test.describe('console — nested first action inside the bonus window', () => {
  test.setTimeout(180_000);

  test('the corp\'s mandatory move is bonus action 1: overview → claim → explicit sub-stage → back', async ({page, request}) => {
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
      bonusActionPrompt?: {remaining?: number, gains?: Array<{perCardInHand?: number}>},
    } | undefined;
    expect(wf?.startGamePrompt?.kind).toBe('corporationInitialAction');
    expect(wf?.bonusActionPrompt?.remaining).toBe(2);
    expect(wf?.bonusActionPrompt?.gains?.length).toBe(2);
    // The M€ gain carries its RATE — the client renders the formula from it.
    expect(wf?.bonusActionPrompt?.gains?.some((g) => g.perCardInHand === 2)).toBe(true);

    await openConsole(page, playerId, '&consoleProfile=tv');

    // ── 1. THE OVERVIEW — seat «Фора», the plan names both items ────────────
    await expect(page.locator('.con-start__bonusact'), 'the window opens on its overview')
      .toBeVisible({timeout: 40_000});
    await expect(page.locator('.con-start__bonusact-count')).toHaveText('1/2');
    await expect(page.locator('.con-start__embedsource .pcard__title').first())
      .toHaveText(/Фора/, {timeout: 15_000});
    const plan = page.locator('.con-start__planrow');
    await expect(plan, 'the plan has both items').toHaveCount(2);
    await expect(plan.nth(0), 'item 1 is the mandatory move, wearing the corp')
      .toContainText('Обязательное первое действие');
    await expect(plan.nth(0).locator('.con-start__planrow-corp')).toContainText('Inventrix');
    await expect(plan.nth(0)).toHaveClass(/--current/);
    const crumb = (await page.locator('.con-wshead').textContent()) ?? '';
    expect(crumb, 'the crumb keeps the WINDOW as the subject').toMatch(/Фора/);

    // ── 2. THE RAIL STAYS ON THE BONUS CHAPTER ──────────────────────────────
    const rail = await page.locator('.con-jrail__item').allTextContents();
    expect(rail.join(' | ')).toMatch(/Бонусные действия/);
    expect(rail.join(' | '), 'no separate first-action chapter for a nested stage')
      .not.toMatch(/Первое действие/);

    // ── 3. THE GAINS ARE CLAIMABLE ON THE CORP PROMPT — before the action ───
    await expect(page.locator('.con-start__gainrow')).toHaveCount(2);
    await expect(page.locator('.con-start__gainrow-formula'), 'the M€ row shows its rate')
      .toContainText('по 2');
    await page.keyboard.press('ArrowDown'); // → the steel row
    await page.keyboard.press('Enter');
    await expect(page.locator('.con-start__gainrow'), 'the claimed row is gone').toHaveCount(1, {timeout: 20_000});
    const afterClaim = await fetchPlayerModel(request, playerId);
    expect((afterClaim.thisPlayer as {steel?: number}).steel, 'the steel arrived (testMode base 500)').toBe(502);
    expect((afterClaim.thisPlayer as {bonusActions?: number}).bonusActions, 'no action was spent').toBe(2);

    // ── 4. A DESCENDS INTO THE SUB-STAGE — seat swaps to the corporation ────
    await page.keyboard.press('Enter'); // the claim reset the cursor to the CTA
    await expect(page.locator('.con-start__firstact'), 'the mandatory move is its own sub-stage')
      .toBeVisible({timeout: 25_000});
    await expect(page.locator('.con-start__firstact-bonusctx'), 'the window\'s 1/2 chip').toHaveCount(1);
    await expect(page.locator('.con-start__firstact-bonusctx')).toContainText('1/2');
    await expect(page.locator('.con-start__embedsource .pcard__title').first(),
      'the seat premium-swaps to the corporation').toHaveText(/Inventrix/i, {timeout: 15_000});
    const subCrumb = (await page.locator('.con-wshead').textContent()) ?? '';
    expect(subCrumb, 'the crumb still leads with the WINDOW\'s card').toMatch(/Фора/);
    expect(subCrumb).toMatch(/Первое действие/i);
    // The claim made on the overview is the SAME state — one row left here too.
    await expect(page.locator('.con-start__gainrow')).toHaveCount(1);

    // ── 5. B WALKS BACK UP — seat back to «Фора», nothing replayed ──────────
    await page.keyboard.press('Escape');
    await expect(page.locator('.con-start__bonusact')).toBeVisible({timeout: 25_000});
    await expect(page.locator('.con-start__embedsource .pcard__title').first())
      .toHaveText(/Фора/, {timeout: 15_000});
    await expect(page.locator('.con-start__gainrow'), 'the claim survived the round trip').toHaveCount(1);
    await expect(page.locator('.con-start__bonusact-count')).toHaveText('1/2');
  });
});
