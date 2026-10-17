import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, press, settle, waitForBoardHome} from './consoleStart';

/**
 * TR65 STRATEGIC SHIFT («Смена стратегии») — «discard any number of cards WITH A REQUIREMENT, then +1 M€ and +1 card
 * each»: Public Plans' multi pick of the hand × the discard skin × the play's own embedded draw.
 *
 *  A. the pick is the hand album in DISCARD mode showing only the candidates («Показано 4 из 7»); LT shows the rest
 *     with the reason; A marks, R3 marks all, the running summary reads +N M€ · +N cards; RT at zero is the REFUSAL
 *     in words (PL-259), with a pick it is «Сбросить» with the count; the composer's row reads both payouts
 *  B. ONE POST — the discard addressed to this card's own discard; the server: −4 cards +4 cards, −2 +4 M€; the draw
 *     stands EMBEDDED in the hand workspace (never a standalone band), nothing is asked twice
 *  C. no candidate at all — the composer names the skip BEFORE the press; the play asks nothing
 *  E. the event lies in the table's events pile (the counter +1 after the play)
 *  — a single candidate keeps the multi album (A marks, RT with the count)
 */
const CARD = 'Strategic Shift';
const ELIGIBLE = ['Lichen', 'Fish', 'Birds', 'Fusion Power'];
const INELIGIBLE = ['Research', 'Tardigrades', 'Acquired Company'];
const PLAY = '.con-composer--play';
const ALBUM = '.con-hand[data-flow="picking"]';
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, cardsInHandNbr: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
  waitingFor?: {discardPrompt?: unknown, options?: Array<{discardPrompt?: unknown}>},
};

function watchPage(page: Page): {posts: Array<string>, errors: Array<string>} {
  const out = {posts: [] as Array<string>, errors: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  page.on('pageerror', (e) => out.errors.push(e.message));
  return out;
}

/** RT → «КАРТЫ» → the card → A: the play composer, nothing sent. */
async function openPlayComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `the cursor reaches «${CARD}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY)).toHaveCount(1);
  await settle(page);
}

const rowText = (page: Page) => page.evaluate((play) => (document.querySelector(`${play} .con-composer__row--focused`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), PLAY);
const bar = (page: Page) => page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const picked = (page: Page) => page.locator(`${ALBUM} .con-hand__slot--select-picked`);
const bodyText = (page: Page) => page.evaluate(() => (document.body.textContent ?? '').replace(/\s+/g, ' '));

/** The composer's discard row → A → the album in pick mode. */
async function openDiscardPick(page: Page): Promise<void> {
  for (let i = 0; i < 8 && !/карт/i.test(await rowText(page)); i++) {
    await press(page, 'ArrowDown', 300);
  }
  expect(await rowText(page), 'the cursor stands on the discard row').toMatch(/карт/i);
  for (let i = 0; i < 3 && await page.locator(ALBUM).count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(page.locator(ALBUM), 'the hand album opens in pick mode').toBeVisible({timeout: 15_000});
  await settle(page);
}

async function walkToPlayRow(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${PLAY} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 300);
  }
  await expect(page.locator(`${PLAY} .con-composer__cta--focused`), 'the cursor reaches the play row').toHaveCount(1);
}

for (const preset of PRESETS) {
  test.describe(`Strategic Shift · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A+B · the discard album of the candidates, both payouts, the refusal at zero; ONE POST, the embedded draw, the event on the table (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'strategic-shift', {query: preset.query});
      await settle(page);
      const before = await fetchPlayerModel(request, playerId) as unknown as Wire;
      const handBefore = before.thisPlayer.cardsInHandNbr;
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture').toEqual(expect.arrayContaining([CARD, ...ELIGIBLE, ...INELIGIBLE]));
      await openPlayComposer(page);
      await openDiscardPick(page);

      // ── A · THE CANDIDATES: only the cards with a requirement stand on the album; the card itself never does.
      await expect(page.locator(ALBUM), 'the discard skin').toHaveClass(/con-hand--discard/);
      await expect(page.locator(`${ALBUM} [data-zoom-slot="${CARD}"]`), 'the card being played is not shown').toHaveCount(0);
      for (const name of ELIGIBLE) {
        await expect(page.locator(`${ALBUM} [data-zoom-slot="${name}"]`), `«${name}» (a requirement) stands`).toHaveCount(1);
      }
      for (const name of INELIGIBLE) {
        await expect(page.locator(`${ALBUM} [data-zoom-slot="${name}"]`), `«${name}» (no requirement) is filtered out`).toHaveCount(0);
      }
      await expect(page.locator('.con-hand__shown'), 'the honest count of the filter').toHaveText(/Показано 4 из 7/);
      // LT — «all cards»: the rest come back DISABLED, each with its reason.
      await press(page, 'Comma', 900);
      await expect(page.locator(`${ALBUM} [data-zoom-slot="${INELIGIBLE[0]}"]`)).toHaveCount(1);
      await expect(page.locator(`${ALBUM} [data-zoom-slot="${INELIGIBLE[0]}"]`)).toHaveClass(/con-hand__slot--select-disabled/);
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, INELIGIBLE[0], slots * 2 + 6)).toBe(true);
      expect(await bodyText(page), 'the reason is said').toMatch(/Без требования/);
      await press(page, 'Comma', 900); // back to «only suitable»
      await expect(page.locator(`${ALBUM} [data-zoom-slot="${INELIGIBLE[0]}"]`)).toHaveCount(0);

      // THE REFUSAL AT ZERO (PL-259): RT reads the refusal in words, no badge; the summary reads zero.
      expect(await bar(page), 'RT at zero is the refusal').toMatch(/RT\s*Не сбрасывать/);
      expect(await bar(page)).not.toMatch(/Сбросить\s*0/);
      // A marks one; R3 marks all four; the running summary reads +4 M€ AND +4 cards.
      expect(await focusCard(page, 'Lichen', slots * 2 + 6)).toBe(true);
      await press(page, 'Enter', 700);
      await expect(picked(page)).toHaveCount(1);
      expect(await bar(page), 'with a pick RT is the verb with its count').toMatch(/RT\s*Сбросить/);
      await press(page, 'KeyV', 700); // R3 — select all
      await expect(picked(page)).toHaveCount(4);
      await expect(page.locator('.con-hand__salebar--select .con-hand__salebar-item--gain').first()).toContainText('+4');
      await expect(page.locator('[data-hand-sale-cards]'), 'the second payout, in cards').toContainText('+4');
      expect(await page.locator('.con-cards__pickband--discard').count(), 'every pick wears the DISCARD band').toBe(4);
      // RT confirms the set into the composer: the row names the cards and BOTH payouts.
      await press(page, 'Period', 1200);
      await expect(page.locator(`${PLAY}:visible`), 'the composer returns with the answer').toHaveCount(1, {timeout: 15_000});
      await settle(page);
      const row = await page.evaluate((play) => Array.from(document.querySelectorAll(`${play} .con-composer__row`)).map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), PLAY);
      expect(row, 'the row reads the M€ payout').toMatch(/\+4/);
      await expect(page.locator(`${PLAY} [data-impact-draw]`), 'the row reads the cards payout').toContainText('+4');
      expect(seen.posts, 'nothing sent before the play\'s own A').toEqual([]);

      // ── B · ONE POST, addressed; the server's whole answer; the draw embedded in the workspace.
      await walkToPlayRow(page);
      const cost = before.cardsInHand?.find((c) => c.name === CARD)?.calculatedCost ?? 2;
      for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
        await press(page, 'Enter', 400);
        await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(seen.posts.length, 'A sent exactly one request').toBe(1);
      const body = JSON.parse(seen.posts[0]) as {responses?: Array<{type: string, cards?: Array<string>, for?: {role: string, source?: {card?: string}}}>};
      const answer = (body.responses ?? []).find((r) => r.type === 'card');
      expect(answer?.cards?.slice().sort(), 'the batch carries the four picked cards').toEqual([...ELIGIBLE].sort());
      expect(answer?.for, 'the answer is ADDRESSED to the card\'s own discard').toMatchObject({role: 'discard', source: {card: CARD}});
      // The drawn cards stand EMBEDDED in the hand workspace (TR57) — never the standalone band over the board.
      const embedded = page.locator('.con-hand .con-reveal--embedded');
      await expect(embedded, 'the draw stands inside the workspace').toHaveCount(1, {timeout: 40_000});
      expect(await page.locator('.con-reveal:not(.con-reveal--embedded)').count(), 'no standalone reveal').toBe(0);
      await expect.poll(async () => ((await fetchPlayerModel(request, playerId)) as unknown as Wire).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000, message: 'the card is on the table'}).toBe(true);
      const after = await fetchPlayerModel(request, playerId) as unknown as Wire;
      expect(after.cardsInHand?.map((c) => c.name), 'the four left the hand').not.toEqual(expect.arrayContaining(ELIGIBLE));
      expect(after.thisPlayer.cardsInHandNbr, 'the hand: −the card −4 +4').toBe(handBefore - 1 - 4 + 4);
      expect(after.thisPlayer.megacredits, 'M€: −the price +4').toBe(before.thisPlayer.megacredits - cost + 4);
      const wf = after.waitingFor;
      const discardStanding = wf?.discardPrompt !== undefined || (wf?.options ?? []).some((o) => o.discardPrompt !== undefined);
      expect(discardStanding, 'no discard prompt stands after the batch').toBe(false);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(seen.errors, 'no page errors').toEqual([]);

      // ── E · the event lies on the table's events pile.
      await press(page, 'KeyX', 1200);
      await expect(page.locator('.con-played:not(.con-played--embedded)')).toHaveCount(1);
      await expect(page.locator('.con-played__family--event .con-played__caption-count')).toHaveText('1');
      await press(page, 'Escape', 800);
    });

    test(`C · no candidate: the composer names the skip BEFORE the press, the play asks nothing (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'strategic-shift-none', {query: preset.query});
      await settle(page);
      const before = await fetchPlayerModel(request, playerId) as unknown as Wire;
      await openPlayComposer(page);
      const text = await page.evaluate((play) => (document.querySelector(play)?.textContent ?? '').replace(/\s+/g, ' '), PLAY);
      expect(text, 'the named skip').toMatch(/Нечего сбросить: в руке нет карт с требованием/);
      expect(text, 'no discard row').not.toMatch(/Выбрать карты в руке/);
      await walkToPlayRow(page);
      for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
        await press(page, 'Enter', 400);
        await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(seen.posts.length).toBe(1);
      await expect.poll(async () => ((await fetchPlayerModel(request, playerId)) as unknown as Wire).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000}).toBe(true);
      const after = await fetchPlayerModel(request, playerId) as unknown as Wire;
      expect(after.thisPlayer.cardsInHandNbr).toBe(before.thisPlayer.cardsInHandNbr - 1);
      expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits - 2);
      expect(after.waitingFor?.discardPrompt, 'nothing asked').toBeUndefined();
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      expect(seen.errors).toEqual([]);
    });
  });
}

test.describe('Strategic Shift · a single candidate', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('one card with a requirement keeps the MULTI album — A marks it, R3 stands, RT carries the count', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'strategic-shift-one', {query: '&consoleProfile=auto'});
    await settle(page);
    await openPlayComposer(page);
    await openDiscardPick(page);
    await expect(page.locator(`${ALBUM} [data-zoom-slot="Lichen"]`)).toHaveCount(1);
    await expect(page.locator(`${ALBUM} .con-hand__slot[data-zoom-slot]`)).toHaveCount(1);
    expect(await bar(page)).toMatch(/R3\s*Выбрать все/i);
    expect(await bar(page)).toMatch(/RT\s*Не сбрасывать/);
    await press(page, 'Enter', 700);
    await expect(picked(page)).toHaveCount(1);
    expect(await bar(page)).toMatch(/RT\s*Сбросить/);
    await press(page, 'Period', 1200);
    await expect(page.locator(`${PLAY}:visible`)).toHaveCount(1, {timeout: 15_000});
    await expect(page.locator(`${PLAY} [data-impact-draw]`)).toContainText('+1');
  });
});
