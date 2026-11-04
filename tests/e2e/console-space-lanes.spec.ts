import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, fetchPlayerModel, focusCard, focusInfoZone, playCardFromHand, press, pressUntil, settle, waitForBoardHome,
  walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P62 SPACE LANES — the hand (ledger GA): the series' first STANDING DISCOUNT, 2 M€ off PER planet tag (Jovian · Earth ·
 * Venus · Mars — the fork counts Mars, the P85 precedent). Nothing new on the client by construction: the ONE price
 * function (`Player.getCardCostBreakdown`) reads the declaration, the forecast reads the breakdown — this stand PROVES the
 * road. The fixture `space-lanes-table` (Mining Guild, P62 on the table, 30 M€) holds Earth Office (1 → 0) · Tharsis
 * Alliance (Mars, 8 → 6) · Saturn Surfing (Jovian + Earth, 13 → 9) · Power Plant (4, no planet tag).
 *   (B) the composer's payment head «ЦЕНА N → N−d» + «−d» for every planet card, nothing for Power Plant; NO «Сработает» row
 *       (a discount is no reaction) while R3 still opens the layer, whose «Скидки и оплата» group names P62 ONCE (two tags
 *       = ONE row «−4» of one source); A plays Saturn Surfing for 9 — the price leaves the M€ row; Earth Office is the FREE
 *       composition with its tail and costs nothing on the server — its head «1 → 0 · −1» and its R3 row «−1 из 2» say
 *       the SAME saving (GB: the 0-floor's share is the fact; the offer is named as the cap);
 *   (C) the effects explorer of the table: P62 in the discounts family with «Сэкономлено 5» (4 + 1 — the facts, never 6);
 *   (D) mid-game: WG Project deals P62 — +3 titanium inside the hand's outcome zone.
 * The rules are pinned by `tests/cards/prelude2/SpaceLanes.spec.ts`; the start's road by `console-space-lanes-start`.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p62', PRESET.id);
const CARD = 'Space Lanes';
const CARD_RU = 'Космические маршруты';

type Wire = {
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
  thisPlayer: {megacredits: number, titanium: number, tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

function writeText(name: string, text: string): void {
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, name), `${text}\n`);
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

const composer = (page: Page) => page.locator('.con-composer--play');
const head = (page: Page) => page.locator('.con-composer--play .con-pay__head');
const layer = (page: Page) => page.locator('.con-composer__fxlayer');

/** Open the hand workspace and descend into `card`'s play composer. */
async function openComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/** Leave the composer and the hand — back to the board home. */
async function leaveComposer(page: Page): Promise<void> {
  expect(await pressUntil(page, 'Escape', async () => await composer(page).count() === 0, {tries: 4, settleMs: 900}),
    'B must fold the composer').toBeTruthy();
  expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 900}),
    'B must leave the hand').toBeTruthy();
  await settle(page);
}

/** The payment head as painted: the printed «was», the price, the saved tail ('' where absent). */
async function headOf(page: Page): Promise<{base: string, price: string, saved: string}> {
  const text = async (sel: string) => (await head(page).locator(sel).count()) === 0 ? '' : ((await head(page).locator(sel).first().textContent()) ?? '').trim();
  return {base: await text('[data-pay-base]'), price: await text('.con-pay__price-value'), saved: await text('[data-pay-saved]')};
}

/** R3 → the layer: the discounts group's tiles, each its text. B (R3) back. */
async function discountTiles(page: Page): Promise<Array<string>> {
  expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100}),
    'R3 opens the «Эффекты» layer for a discount-only forecast').toBeTruthy();
  await settle(page);
  const tiles = await layer(page).locator('[data-forecast-item="discount"], [data-forecast-item="other-discount"]')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
  await expect(layer(page).locator('[data-forecast-group="discounts"]'), 'the «Скидки и оплата» group').toHaveCount(1);
  return tiles;
}
async function closeLayer(page: Page): Promise<void> {
  await press(page, 'KeyV', 900);
  await expect(layer(page)).toHaveCount(0, {timeout: 10_000});
}

test.describe(`P62 Space Lanes · a standing discount per planet tag · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(B · C) the hand: the price head per planet tag, no «Сработает», R3 names P62 once; the play pays the discounted price; the explorer counts the saving', async ({page, request}) => {
    test.setTimeout(560_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'space-lanes-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const start = await wireOf(request, id);
    expect(start.thisPlayer.megacredits, 'the fixture: 30 M€').toBe(30);
    const report: Array<string> = [];

    // ── Tharsis Alliance (Mars): «8 → 6 · −2», ONE row of P62. ──
    await openComposer(page, 'Tharsis Alliance');
    let h = await headOf(page);
    report.push(`Tharsis Alliance head ${JSON.stringify(h)}`);
    expect(h, 'a Mars tag is a planet tag: 8 → 6 · −2').toEqual({base: '8', price: '6', saved: '−2'});
    await expect(composer(page).locator('[data-forecast-row]'), 'no «Сработает» row for a discount').toHaveCount(0);
    let tiles = await discountTiles(page);
    report.push(`Tharsis Alliance R3 ${JSON.stringify(tiles)}`);
    expect(tiles.length, `ONE discount row (${tiles.join(' | ')})`).toBe(1);
    expect(tiles[0], 'the row names P62').toContain(CARD_RU);
    await shoot(page, 'B-01-tharsis-layer');
    await closeLayer(page);
    await leaveComposer(page);

    // ── Power Plant: no planet tag — no tail. ──
    await openComposer(page, 'Power Plant');
    h = await headOf(page);
    report.push(`Power Plant head ${JSON.stringify(h)}`);
    expect(h, 'no planet tag: the printed price, no tail').toEqual({base: '', price: '4', saved: ''});
    await leaveComposer(page);

    // ── Saturn Surfing (Jovian + Earth): «13 → 9 · −4» — ONE row «−4» of one source; A plays it for 9. ──
    await openComposer(page, 'Saturn Surfing');
    h = await headOf(page);
    report.push(`Saturn Surfing head ${JSON.stringify(h)}`);
    expect(h, 'two planet tags: 13 → 9 · −4').toEqual({base: '13', price: '9', saved: '−4'});
    await expect(composer(page).locator('[data-forecast-row]'), 'no «Сработает» row for a discount').toHaveCount(0);
    tiles = await discountTiles(page);
    report.push(`Saturn Surfing R3 ${JSON.stringify(tiles)}`);
    expect(tiles.length, `two tags of one source = ONE row (${tiles.join(' | ')})`).toBe(1);
    expect(tiles[0], 'the row names P62').toContain(CARD_RU);
    await shoot(page, 'B-02-saturn-layer');
    await closeLayer(page);
    await shoot(page, 'B-03-saturn-composer');
    await armTransferWitness(page);
    const stop = await storyboard(page, 'hand-saturn');
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).thisPlayer.megacredits !== 30, {tries: 3, settleMs: 2500}),
      'A plays Saturn Surfing').toBeTruthy();
    await waitForBoardHome(page, 30);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    const afterSaturn = await wireOf(request, id);
    expect(afterSaturn.thisPlayer.megacredits, 'the server charged the discounted 9').toBe(21);
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('B-saturn-trail.txt', trail);
    // A hand play's M€ price is the rail row's delta chip, never a token (PL-163 — the row stands on the rail).
    expect(endsOverGlass(witness), `no end over glass or nothing (trail:
${trail})`).toEqual([]);

    // ── Earth Office (Earth, printed 1): the discount past the floor — the FREE composition WITH its tail. ──
    await openComposer(page, 'Earth Office');
    h = await headOf(page);
    report.push(`Earth Office head ${JSON.stringify(h)}`);
    await expect(composer(page).locator('.con-pay'), 'the FREE composition').toHaveClass(/con-pay--free/);
    expect(h, 'the price head: 1 → 0, the saving −1').toEqual({base: '1', price: '0', saved: '−1'});
    tiles = await discountTiles(page);
    report.push(`Earth Office R3 ${JSON.stringify(tiles)}`);
    expect(tiles.length, `ONE discount row (${tiles.join(' | ')})`).toBe(1);
    expect(tiles[0], 'the row names P62').toContain(CARD_RU);
    // GB — the row says what it REALLY takes off (−1, the head's own number) and names the offer it could not spend.
    const capped = layer(page).locator('[data-forecast-item="discount"]');
    await expect(capped.locator('.con-efx__meta-num'), 'the saving, never the offer').toHaveText('−1');
    await expect(capped.locator('[data-forecast-capped]'), 'the cap named: «из 2»').toHaveText(/из\s*2/);
    await shoot(page, 'B-04-earth-office-free');
    await closeLayer(page);
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === 'Earth Office'), {tries: 3, settleMs: 2500}),
      'A plays Earth Office').toBeTruthy();
    await waitForBoardHome(page, 30);
    expect((await wireOf(request, id)).thisPlayer.megacredits, 'a free play costs nothing').toBe(21);
    writeText('B-report.txt', report.join('\n'));

    // ── (C) the effects explorer: P62 in the discounts family, its saving counted. ──
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    for (let i = 0; i < 6 && await page.locator('.con-info').count() === 0; i++) {
      await press(page, 'KeyY', 1100);
    }
    await expect(page.locator('.con-info'), 'the Information workspace').toHaveCount(1);
    expect(await focusInfoZone(page, 'effects'), 'the ring reaches the effects zone').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}),
      'A on the effects zone opens the explorer').toBeTruthy();
    await settle(page);
    // The source's group (its plate names the card) is read where it stands — the state is the subject, not the cursor.
    const tileText = () => page.evaluate((name) => Array.from(document.querySelectorAll('.con-efx .con-efx__group'))
      .map((t) => (t.textContent ?? '').replace(/\s+/g, ' ')).find((t) => t.includes(name)) ?? '', CARD_RU);
    await expect.poll(tileText, {timeout: 20_000, message: 'P62 stands in the explorer'}).toContain(CARD_RU);
    const tile = await tileText();
    writeText('C-explorer-tile.txt', tile);
    // Saturn Surfing −4 + Earth Office −1 (the FACT — the offer was 2): 5, never 6.
    expect(tile, `the saving is counted (${tile})`).toMatch(/Сэкономлено/);
    expect(tile, `the saving is the facts' sum, 5 (${tile})`).toMatch(/(^|\D)5(\D|$)/);
    expect(tile, `never the offers' sum, 6 (${tile})`).not.toMatch(/(^|\D)6(\D|$)/);
    await shoot(page, 'C-explorer');
    expect(errors, 'no page error').toEqual([]);
  });

  test('(D) mid-game: WG Project deals P62 — +3 titanium inside the hand', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'space-lanes-wg', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    const posts: Array<string> = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(r.postData() ?? '');
      }
    });
    const pick = '.con-hand__outcome .con-deckpick--play';
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `focused ${CARD}`).toBeTruthy();
    await press(page, 'Enter', 400);
    await armTransferWitness(page);
    const stop = await storyboard(page, 'wg');
    const sent = posts.length;
    for (let attempt = 0; attempt < 3 && posts.length === sent; attempt++) {
      await press(page, 'Period', 300); // RT — the commit
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(sent).catch(() => undefined);
    }
    expect(posts.length, 'ONE POST').toBe(sent + 1);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.titanium - before.thisPlayer.titanium,
      {timeout: 40_000, message: '+3 titanium'}).toBe(3);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'D-after');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('D-trail.txt', trail);
    expect(witness.landings.some((l) => l.under === 'rail:titanium'), `the titanium landed on its row (trail:\n${trail})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
  });
});
