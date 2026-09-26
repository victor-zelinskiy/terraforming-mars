import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, focusCard, playCardFromHand, press, pressUntil, settle} from './consoleStart';
import {strandedReports} from './parliamentDrive';

/**
 * URBAN DEVELOPMENT (Turmoil Redux, RX30) — the ONE e2e of the new mechanic: a
 * law that answers A CARD BEING PLAYED. One journey, one profile (the owner's
 * budget — one e2e per new mechanic):
 *
 *   the law stands, the viewer holds a MINE (4 M€, a Building tag, no question
 *   of its own). BEFORE the decision the play's own confirmation states the
 *   law's answer — «+1 карта», titled by «Городское развитие», with Mars
 *   First's emblem where a card's graphic would stand. The player confirms;
 *   the Mine is played, a card really arrives (the hand keeps its size — one
 *   out, one in — and holds a name it did not hold before), and the reveal
 *   names the law that sent it.
 *
 * The promise and the payout are read from the SAME screen the player uses,
 * against the server's own hand.
 *
 * Screens under screenshots/parliament-urban/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-urban');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const URBAN_ID = 'RDX_MARS_URBAN_DEVELOPMENT';
const BUILDING_CARD = 'Mine';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Wire = {thisPlayer: {color: string, tableau?: Array<{name: string}>}, cardsInHand?: Array<{name: string}>};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const handOf = (wire: Wire): Array<string> => (wire.cardsInHand ?? []).map((c) => c.name);

const composer = (page: Page) => page.locator('.con-composer--play');
const layer = (page: Page) => page.locator('.con-composer__fxlayer');

/** Open the hand workspace and descend into `card`'s play composer (the forecast e2e's own route). */
async function openComposerFor(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, Math.max(24, slots * 3)), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

test.describe(`Urban Development · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the law promises the card before the play and delivers it after — named on both sides', async ({page, request}) => {
    test.setTimeout(600_000);

    const {playerId} = await bootFixtureSeats(page, request, 'parliament-urban-enacted', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    expect(handOf(before), 'the viewer holds the Mine').toContain(BUILDING_CARD);

    // ── ⓪ THE EFFECTS LIST names the law and DRAWS its rule — Information →
    // the effects zone → the explorer's Parliament strip (the heat spec's route).
    const infoRoot = page.locator('.con-info');
    for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
      if (i > 0) {
        await press(page, 'Enter', 700);
        await press(page, 'Escape', 500);
      }
      await press(page, 'KeyY', 1100);
    }
    await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
    const effectsFocused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
    for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
      if (await effectsFocused() > 0) {
        break;
      }
      await press(page, move, 300);
    }
    expect(await effectsFocused(), 'the effects zone takes the focus').toBeGreaterThan(0);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
    const strip = page.locator('.con-pfx');
    await expect(strip, 'the Parliament strip stands in the explorer').toHaveCount(1, {timeout: 10_000});
    const lawRow = strip.locator('.con-pfx__item').first();
    await expect(lawRow, 'the LAW leads the strip').toHaveClass(/con-pfx__item--resolution/);
    await expect(lawRow).toHaveAttribute('data-resolution', URBAN_ID);
    await expect(lawRow.locator('.con-pfx__why b'), 'titled by the card').toHaveText(/Городское развитие|Urban Development/i);
    // The rule is DRAWN, not left as a blank — the formula carries the card's own graphic.
    const formula = lawRow.locator('.con-pfx__formula');
    await expect(formula, 'the law states its rule in graphics').toHaveCount(1);
    // The icons are CSS sprites, so «drawn» is read as «it has painted descendants with a box».
    const painted = await formula.evaluate((el) => Array.from(el.querySelectorAll('*'))
      .filter((n) => {
        const r = (n as HTMLElement).getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      }).length);
    expect(painted, 'the formula is drawn, not an empty space').toBeGreaterThan(2);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '00-effects-strip');
    for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await expect(page.locator('.con-info, .con-efx')).toHaveCount(0, {timeout: 10_000});

    // ── ① THE PROMISE: the play's own confirmation carries the law's reaction.
    await openComposerFor(page, BUILDING_CARD);
    await expect(composer(page).locator('[data-forecast-row]'), 'the play states a reaction at all').toHaveCount(1);
    await shoot(page, '01-play-confirmation');

    // ── ② …and R3 NAMES it: «Городское развитие», «+1 карта», under «Вы получите».
    expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100}),
      'R3 must open the «Эффекты» layer').toBeTruthy();
    // The tiles are SIBLINGS of their group header, never its children.
    const lawTile = layer(page).locator('.con-efx__tile--fx')
      .filter({has: page.locator('.con-efx__tile-src', {hasText: /Городское развитие|Urban Development/i})});
    await expect(lawTile, 'ONE tile of the law').toHaveCount(1);
    await expect(lawTile, 'under «Вы получите» — an exact gain of the viewer\'s').toHaveClass(/con-efx__tile--fx-receive/);
    await expect(lawTile.locator('.con-efx__party-emblem'), 'Mars First\'s emblem where a card\'s graphic would stand').toHaveCount(1);
    await expect(lawTile, 'one card').toContainText('1');
    await shoot(page, '02-forecast-law');

    // Back out of the layer; the play itself is the next beat.
    expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() === 0, {tries: 3, settleMs: 1100}),
      'R3 closes the layer').toBeTruthy();
    for (let i = 0; i < 6 && await page.locator('.con-composer--play, .con-hand').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await settle(page, {timeoutMs: 30_000});

    // ── ③ THE PAYOUT: the Mine is played and a card really arrives.
    expect(await playCardFromHand(page, BUILDING_CARD), 'the Mine must be played').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau?.some((c) => c.name === BUILDING_CARD) === true,
      {timeout: 60_000, message: 'the Mine reaches the tableau'}).toBe(true);
    await expect.poll(async () => handOf(await wireOf(request, playerId)).includes(BUILDING_CARD),
      {timeout: 60_000, message: 'and leaves the hand'}).toBe(false);

    const after = await wireOf(request, playerId);
    // ONE OUT, ONE IN: the hand keeps its size and holds a card it did not hold.
    expect(handOf(after).length, 'the played card was replaced by the law\'s').toBe(handOf(before).length);
    const arrived = handOf(after).filter((name) => !handOf(before).includes(name));
    expect(arrived.length, `a card the hand did not hold arrived (${arrived.join(', ')})`).toBeGreaterThanOrEqual(1);

    // ── ④ …and the presentation NAMES the law that sent it. ONE card takes the
    // fullscreen route («ИСТОЧНИК · Городское развитие» on the viewer bar), a
    // batch the reveal's own source chip — either is the same statement.
    const named = page.locator('.con-zoom__swap--static .con-zoom__swap-name, .con-reveal__source-chip-name');
    await expect.poll(async () => await named.count() > 0 ? (await named.first().textContent() ?? '').trim() : '',
      {timeout: 60_000, message: 'the arriving card names «Городское развитие»'}).toMatch(/Городское развитие|Urban Development/i);
    await shoot(page, '03-reveal-names-the-law');

    // The law is the one on the table — no other resolution could have drawn it.
    const law = await page.evaluate(async () => {
      const id = new URLSearchParams(location.search).get('id') ?? '';
      const model = await (await fetch(`/api/player?id=${id}`)).json() as
        {game?: {parliament?: {enacted?: {resolution?: string}}}};
      return model.game?.parliament?.enacted?.resolution ?? '';
    });
    expect(law, 'the enacted law is Urban Development').toBe(URBAN_ID);

    for (let i = 0; i < 8 && await page.locator('.con-reveal, dialog.con-zoom[open]').count() > 0; i++) {
      await press(page, 'Enter', 700);
    }
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
