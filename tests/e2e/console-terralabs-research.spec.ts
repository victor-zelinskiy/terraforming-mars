import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, cinematicBeat, createGameWithCards, fetchPlayerModel, fillPicks, openConsole, pickCards, playStartQueue,
  press, pressUntil, sendPlayerInput, settle, soloGameConfig, submitSummary, summaryVisible, waitForBoardHome, walkToSummary,
} from './consoleStart';

/**
 * R14 · TERRALABS RESEARCH — the second classic Turmoil corporation adapted in place. Its printed 1 M€ REPLACES the
 * buy-to-hand price, «including the starting hand». The server already prices every flow from `player.cardCost`
 * (pinned in `tests/cards/turmoil/TerralabsResearch.spec.ts`); this stand reads the SCREENS:
 *
 *  A · the start scene — TerraLabs picked, three projects: the quick chip «Проекты 3 × 1», the summary's
 *      «Проекты: 3 × 1», both hinting WHO set the price; the first frame of the game: the rail's rating one step
 *      below the start, M€ = 14 − 3, three cards in hand (the server's numbers, never a constant);
 *  B · the research buy between generations — the wallet «2 × 1 = −2», its «× 1» naming TerraLabs; the server
 *      charges 2;
 *  C · the same buy after a draft — the same wallet, the same hint.
 *
 * The TV profile only (the card / feature spec rule); FUNCTIONAL class.
 */

const OUT = path.resolve('screenshots', 'terralabs', 'tv');
const PRESET = {viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'};
const TERRALABS = 'TerraLabs Research';

type Wire = {
  game: {phase: string, generation: number},
  thisPlayer: {megacredits: number, terraformRating: number, cardsInHandNbr: number, cardCost: number, cardCostSources?: Array<string>, needsToResearch?: boolean},
  waitingFor?: {type: string, buyMode?: boolean, draftPrompt?: unknown, cards?: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The price hint a purchase surface carries on its «× N» — '' when none stands. */
async function priceHints(page: Page, scope: string): Promise<Array<string>> {
  return page.locator(`${scope} [data-purchase-price]`).evaluateAll((els) =>
    els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => el.getAttribute('data-hint') ?? ''));
}

async function passOnUi(page: Page): Promise<void> {
  await page.keyboard.down('Comma');
  await cinematicBeat(page, 550, 'the held LT opens the basic wheel (its own entrance)');
  await page.keyboard.press('ArrowDown');
  await cinematicBeat(page, 450, 'the slot step reads before the release');
  await page.keyboard.up('Comma');
  await expect(page.locator('.con-confirm'), 'the pass asks on its plate').toBeVisible({timeout: 10_000});
  await press(page, 'Enter', 300);
}

/** Pick `count` cards of the purchase row (A on the focused card, → to the next). */
async function pickPurchase(page: Page, count: number): Promise<void> {
  const picked = () => page.locator('.con-draftws__stage--buy .con-cards__slot--picked').count();
  for (let n = 1; n <= count; n++) {
    for (let i = 0; i < 6 && await picked() < n; i++) {
      await press(page, 'Enter', 900);
    }
    if (n < count) {
      await press(page, 'ArrowRight', 600);
    }
  }
  expect(await picked(), `${count} card(s) picked for purchase`).toBe(count);
}

/** The wallet plate reads «N × 1 = −N» and its «× 1» names TerraLabs. */
async function expectWallet(page: Page, count: number): Promise<void> {
  const wallet = page.locator('[data-draft-wallet]');
  await expect(wallet, 'the wallet closes the reading row').toBeVisible();
  // The numbers are `ConsoleFlipValue`s: a flip in flight keeps the LEAVING digit in the DOM — read the arriving one.
  const calc = await wallet.locator('.con-dread__wallet-calc').first().evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.con-flipval__card--out').forEach((out) => out.remove());
    return (copy.textContent ?? '').replace(/\s+/g, ' ');
  });
  expect(calc, 'the wallet multiplies by the server\'s 1 M€, never a 3').toMatch(new RegExp(`${count}\\s*×\\s*1\\b`));
  expect(calc).toMatch(new RegExp(`−\\s*${count}\\b`));
  const hint = await wallet.locator('[data-purchase-price]').getAttribute('data-hint');
  expect(hint ?? '', 'the «× 1» names who set the price').toContain(TERRALABS);
  expect(hint ?? '').toMatch(/\b1 M€/);
}

/** RT commits the buy — press-verify-retry against the server's research flag. */
async function commitPurchase(page: Page, request: APIRequestContext, playerId: string): Promise<void> {
  let committed = false;
  for (const deadline = Date.now() + 90_000; !committed && Date.now() < deadline;) {
    // Press into the stage that commits, never blindly — an RT before the buy stage is painted is swallowed.
    await expect(page.locator('.con-draftws__stage--buy'), 'the buy stage stands before RT').toBeVisible({timeout: 20_000});
    await press(page, 'Period', 1400);
    const m = await wireOf(request, playerId);
    committed = m.thisPlayer.needsToResearch === false || m.game.phase === 'action';
  }
  expect(committed, 'RT committed the purchase — the server cleared needsToResearch').toBeTruthy();
}

test.describe('R14 Terralabs Research · tv4k', () => {
  test.use({viewport: PRESET.viewport});

  test('A — the start scene prices the hand at 1 M€ and names TerraLabs; the first frame reads the server\'s rating and money', async ({page, request}) => {
    test.setTimeout(600_000);
    // NOT testMode: its stock override would hide the 14 − N the scene promises. The corporation list goes on top of
    // the deck and a solo seat draws two — TerraLabs and a calm second.
    const config = soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true},
      testMode: false,
      customCorporationsList: [TERRALABS, 'CrediCor'],
      startingCorporations: 2,
    });
    const playerId = await createGameWithCards(request, [TERRALABS], {config});
    await openConsole(page, playerId, PRESET.query);

    let quickHint = '';
    let quickText = '';
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await pickCards(p, [TERRALABS], 10);
          await shoot(p, 'a-01-corporation');
        } else if (kind === 'project') {
          const picked = await fillPicks(p, 3, 24);
          expect(picked.length, 'three projects picked').toBe(3);
          await settle(p, {timeoutMs: 15_000});
          quickText = (await p.locator('.con-start__status-quick-part').first().innerText()).replace(/\s+/g, ' ');
          quickHint = (await priceHints(p, '.con-start__status-quick'))[0] ?? '';
          await shoot(p, 'a-02-projects');
        }
      },
    });
    expect(quickText, 'the projects chip multiplies by 1').toMatch(/3\s*×\s*1\b/);
    expect(quickHint, 'the chip\'s hint names TerraLabs').toContain(TERRALABS);

    if (await summaryVisible(page)) {
      const line = page.locator('.con-start__hudprev-money [data-purchase-price]').first();
      await expect(line, 'the summary\'s projects line').toBeVisible();
      expect((await line.innerText()).replace(/\s+/g, ' ')).toMatch(/3\s*×\s*1\b/);
      expect(await line.getAttribute('data-hint') ?? '').toContain(TERRALABS);
      const remaining = await page.locator('.con-start__money-line--total b').first().innerText();
      expect(remaining.replace(/\D+/g, ''), 'ИТОГО = 14 − 3').toBe('11');
      await shoot(page, 'a-03-summary');
      await submitSummary(page);
    }
    await playStartQueue(page);
    await waitForBoardHome(page, 70);

    const m = await wireOf(request, playerId);
    expect(m.thisPlayer.cardCost, 'the server\'s price').toBe(1);
    expect(m.thisPlayer.cardCostSources ?? []).toEqual([TERRALABS]);
    expect(m.thisPlayer.megacredits, '14 − 3 × 1').toBe(11);
    expect(m.thisPlayer.cardsInHandNbr, 'three cards in hand').toBe(3);
    expect(m.thisPlayer.terraformRating, 'the solo start (14) one step down').toBe(13);
    await expect(page.locator('.con-score__value--tr').first(), 'the rail reads the server\'s rating').toHaveText(String(m.thisPlayer.terraformRating));
    await shoot(page, 'a-04-first-frame');
  });

  test('B — the research buy between generations: «2 × 1 = −2», the hint names TerraLabs, the server charges 2', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId} = await bootFixtureSeats(page, request, 'terralabs-research', {query: PRESET.query});
    await settle(page);
    await passOnUi(page);
    await expect(page.locator('.con-draftws__stage--buy .con-cards__slot'), 'the purchase row stands in the workspace').toHaveCount(4, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    await pickPurchase(page, 2);
    await expectWallet(page, 2);
    await shoot(page, 'b-01-research-wallet');
    const before = (await wireOf(request, playerId)).thisPlayer.megacredits;
    await commitPurchase(page, request, playerId);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.megacredits, {timeout: 20_000})
      .toBe(before - 2);
  });

  test('C — the buy after a draft: the same wallet, the same hint', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'terralabs-research-draft', {query: PRESET.query});
    const rival = seats[1];
    await settle(page);
    await passOnUi(page);
    await expect(page.locator('.con-draftws__stage--pick .con-cards__slot').first(), 'the draft rose in the workspace').toBeVisible({timeout: 60_000});
    for (let round = 0; round < 24; round++) {
      const mine = await wireOf(request, playerId);
      if (mine.game.phase === 'research' && mine.waitingFor?.buyMode === true) {
        break;
      }
      const theirs = await wireOf(request, rival);
      if (theirs.waitingFor?.type === 'card' && theirs.waitingFor.draftPrompt !== undefined && (theirs.waitingFor.cards?.length ?? 0) > 0) {
        await sendPlayerInput(request, rival, {type: 'card', cards: [theirs.waitingFor.cards![0].name]} as never);
      }
      if (mine.waitingFor?.type === 'card' && mine.waitingFor.draftPrompt !== undefined) {
        await pressUntil(page, 'Enter', async () =>
          await page.locator('.con-draftws__stage--pick .con-cards__slot--picked').count() > 0 ||
          await page.locator('.con-draftws__stage--wait').isVisible() ||
          await page.locator('.con-draftws__stage--buy').isVisible(), {settleMs: 900});
      }
      await cinematicBeat(page, 700, 'the rival answers and the packet passes');
    }
    await expect(page.locator('.con-draftws__stage--buy .con-cards__slot'), 'the buy stage after the picks').toHaveCount(4, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    await pickPurchase(page, 1);
    await expectWallet(page, 1);
    await shoot(page, 'c-01-draft-wallet');
    const before = (await wireOf(request, playerId)).thisPlayer.megacredits;
    await commitPurchase(page, request, playerId);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.megacredits, {timeout: 20_000})
      .toBe(before - 1);
  });
});
