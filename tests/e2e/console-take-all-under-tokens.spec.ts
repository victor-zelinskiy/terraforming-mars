import {test, expect, APIRequestContext, Page} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, settle, walkFocusUntil,
} from './consoleStart';

/**
 * THE TOKENS KEEP THEIR FRAME — «Взять всё» pressed while an action's rail half still flies does not take the
 * workspace out from under its own tokens.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, the zero bar — the fourth hundred of whole games, game 1289, 2026-11-25).
 * «Точная организация»: spend a resource, discard a card, draw a card, gain a resource — ONE press. The price lands on
 * the card's printed icon and the gain is born on it while the drawn card already stands in the stage, and B on a
 * drawn batch is «Взять всё»: licensed to release the workspace's claim at once. The claim was the only thing that
 * kept the frame under the tokens — the guarded conclusion asked about a nested step, an owed step, the claim, a
 * prompt, and never about the surface — so the workspace folded with a price still landing on it: `[transfer] a frame
 * left with tokens on its surface — «card-actions»`, a token ending over nothing.
 *
 * The law now: the conclusion's table carries the row «tokens stand on its surface» (`surfaceKeepsItsFrame` —
 * reactive, bounded by `surfaceClear`'s own ceiling): the frame leaves when the last token is absorbed.
 *
 * Fixture `focused-organization-stocked`. The press of the subject is RAW — it goes out the moment the bar offers the
 * verb, in the middle of the motion, exactly as a fast hand does (the quiet-waiting `press` would wait the tokens
 * out and prove nothing). «Done» is the SERVER's word and the stack's.
 */
const CARD = 'Focused Organization';
const CARD_RU = 'ТОЧНАЯ ОРГАНИЗАЦИЯ';
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';
const INNER = `${STAGE} [data-wild-inner]`;
const ALBUM = '.con-hand.con-hand--discard';
const THROWN = 'Space Elevator';

type Wire = {thisPlayer: {plants: number, heat: number, cardsInHandNbr: number}, cardsInHand?: Array<{name: string}>};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const bar = (page: Page): Promise<string> => page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const frames = (page: Page): Promise<string> =>
  page.evaluate(() => (window as unknown as {__conReady: () => {wsFrames?: Array<string>}}).__conReady().wsFrames?.join('>') ?? '');

/** Walk the composer's cursor onto the row matching `selector` (↓ then ↑ — the list does not wrap). */
async function toRow(page: Page, selector: string): Promise<void> {
  for (let i = 0; i < 12 && await page.locator(`${selector}.con-composer__row--focused`).count() === 0; i++) {
    await press(page, i < 6 ? 'ArrowDown' : 'ArrowUp', 250);
  }
  await expect(page.locator(`${selector}.con-composer__row--focused`), `the cursor stands on ${selector}`).toHaveCount(1);
}

test.describe('the tokens keep their frame', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('«Точная организация»: «Взять всё» under the flying rail half — the workspace leaves after its last token, never under it', async ({page, request}) => {
    test.setTimeout(360_000);
    const said: Array<string> = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[transfer]') || text.includes('[workspace-conclusion]') || text.includes('vue-error')) {
        said.push(text.slice(0, 320));
      }
    });
    const posts: Array<string> = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(r.postData() ?? '');
      }
    });
    const id = await bootFixture(page, request, 'focused-organization-stocked', {query: '&consoleProfile=tv'});
    await settle(page);
    const before = await wireOf(request, id);

    // THE ACTION, ANSWERED: spend plants · discard a card · gain heat.
    await openCardActions(page);
    const focusedAction = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    expect(await walkFocusUntil(page, async () => await focusedAction() === CARD, focusedAction, 30), `never focused «${CARD}»`).toBeTruthy();
    await openActionFocus(page);
    await settle(page);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the card names the stage'}).toContain(CARD_RU);
    const spendRow = `${STAGE} [data-wild-row][data-wild-row-mode="spend"]`;
    const gainRow = `${STAGE} [data-wild-row][data-wild-row-mode="gain"]`;
    await toRow(page, spendRow);
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER), 'the spend lanes').toHaveCount(1);
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER), 'A chose plants and left').toHaveCount(0);
    await toRow(page, `${STAGE} .con-composer__row:not([data-wild-row])`);
    for (let i = 0; i < 3 && await page.locator(ALBUM).count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(page.locator(ALBUM), 'the album opens in the discard skin').toBeVisible({timeout: 15_000});
    await settle(page);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, THROWN, slots * 2 + 6), `focused «${THROWN}»`).toBe(true);
    await press(page, 'Enter', 900);
    await expect(page.locator(`${STAGE}:visible`), 'the composer returns with the answer').toHaveCount(1, {timeout: 15_000});
    await settle(page);
    await toRow(page, gainRow);
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER), 'the gain lanes').toHaveCount(1);
    for (let i = 0; i < 4 && (await page.locator(INNER).getAttribute('data-wild-focus-index')) !== '5'; i++) {
      await press(page, i === 0 ? 'ArrowDown' : 'ArrowRight', 250);
    }
    await press(page, 'Enter', 500);
    await expect(page.locator(`${gainRow} [data-wild-row-answer="standard"]`), 'the row reads «+1»').toContainText('+1');
    for (let i = 0; i < 8 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }

    // THE COMMIT — and the fast hand: B the moment the bar offers «Взять всё», the rail half still in the air.
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await page.keyboard.press('Enter');
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'ONE POST').toBe(1);
    await expect.poll(() => bar(page), {timeout: 40_000, intervals: [50], message: 'the drawn card stands: the bar offers «Взять всё»'}).toMatch(/Взять всё/);
    // (Act → verify → retry on the reveal's own `data-take`: a press goes only to a READY reveal, and a swallowed one
    // is the same reveal, still ready.)
    const reveal = () => page.evaluate(() => {
      const r = document.querySelector('.con-reveal');
      return r === null ? undefined : {take: r.getAttribute('data-take') ?? '', inAir: document.querySelectorAll('.con-transfer__chip').length};
    });
    let inAir = -1;
    for (const until = Date.now() + 40_000; Date.now() < until;) {
      const now = await reveal();
      if (now === undefined) {
        break;
      }
      if (now.take !== 'ready') {
        // (arriving / a take in flight — STATE, it changes by itself)
        await expect.poll(async () => (await reveal())?.take ?? 'gone', {timeout: 2_000, intervals: [50]}).not.toBe(now.take).catch(() => undefined);
        continue;
      }
      inAir = now.inAir;
      await page.keyboard.press('Escape');
      await expect.poll(async () => (await reveal())?.take ?? 'gone', {timeout: 3_000, intervals: [50]}).not.toBe('ready').catch(() => undefined);
    }
    expect(await reveal(), 'B took the batch').toBe(undefined);
    test.info().annotations.push({type: 'tokens-in-air-at-the-press', description: String(inAir)});

    // THE WORKSPACE LEAVES — a finished flow does — and it leaves AFTER its tokens: the fold's own witness is silent.
    await expect.poll(() => frames(page), {timeout: 40_000, message: 'the finished flow leaves the stack'}).toBe('');
    await settle(page, {timeoutMs: 40_000});
    expect(said.filter((line) => /a frame left with tokens|ended over|vue-error/.test(line)), 'no frame left under its own tokens').toEqual([]);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.heat, {timeout: 30_000, message: 'the server: heat 0 → 1'}).toBe(1);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.plants, 'plants paid').toBe(before.thisPlayer.plants - 1);
    expect(after.thisPlayer.cardsInHandNbr, 'discard 1, draw 1').toBe(before.thisPlayer.cardsInHandNbr);
    expect(after.cardsInHand?.some((c) => c.name === THROWN), 'the thrown card left the hand').toBe(false);
    expect(posts.length, 'still ONE POST').toBe(1);
  });
});
