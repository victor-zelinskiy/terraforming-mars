import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P75 «ПОСТАВКА ПАРНИКОВЫХ ГАЗОВ» — THE FIRST CARD IN SCOPE WITH A KELVINISTS REQUIREMENT, and the witness of the class
 * «A CLASSIC PARTY ON THE PREMIUM FACE — ONE TRANSLATION POINT» (docs/claude/prompts/prelude2-p75-ghg-shipment.md, ledger CW):
 * the hand's reason, the card's plate and its text name ONE party — the GREENS (rulebook p.13, `normalizeReduxParty`) —
 * and the floater term of the counted chip wears the printed floater.
 *
 *   A · `ghg-shipment-locked` (the Greens' resolution up for the vote, Unity in power, blue with no delegate): the verdict
 *       refuses the play, the reason wears the GREENS' emblem and «0/2»; the card's own plate wears that emblem too —
 *       never the text label «Kelvinists»; X opens the face over the hand; A sends nothing.
 *   B · `ghg-shipment` (the Greens rule; Dirigibles 3 + Floating Habs 2 floaters; Manutech; 20 M€, 1 titanium): the hand
 *       plate reads «+5»; the composer's «ПОЧЕМУ» is the floater glyph and 5 → +5; «Сработает» names Manutech's heat; RT
 *       pays the whole price with the one titanium; ONE POST; the event goes to its pile, the heat lands on its row, the
 *       corporation's answer flies from its printed effect; the flow LEAVES; the server: +6 heat, +1 heat production,
 *       +1 M€ production (the Greens answer the heat step), +1 M€ (Manutech answers that step), no titanium.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P75 (the dry run there proves the numbers). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'GHG Shipment';
const CARD_RU = 'Поставка парниковых газов';
const MANUTECH = 'Manutech';
const OUT = path.resolve('screenshots', 'p75');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';

type Wire = {
  thisPlayer: {
    megacredits: number, titanium: number, heat: number, heatProduction: number, megacreditProduction: number,
    tableau: Array<{name: string}>,
  },
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, PRESET.id, `story-${name}`);
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

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** RT → the wheel's centre (the hand) → the card focused. */
async function focusInHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
}

const usedOf = async (page: Page, unit: string): Promise<number> =>
  Number((await page.locator(`${COMPOSER} .con-payrow[data-pay-unit="${unit}"] .con-payrow__used`).innerText()).replace(/\D+/g, '') || 'NaN');

test.describe(`P75 GHG Shipment · the classic Kelvinists read as the Greens, the floater term wears its glyph · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · neither road open: the verdict, the reason AND the card\'s plate name the GREENS by their emblem; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'ghg-shipment-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    const reason = verdict.locator('.con-hand__reason').filter({has: page.locator('[data-reason-emblem]')});
    await expect(reason, 'one reason: the party').toHaveCount(1);
    await expect(reason.locator('[data-reason-emblem]'), 'the GREENS\' emblem — the table\'s party').toHaveAttribute('src', /greens/);
    await expect(reason, 'the standing: 0 of 2').toContainText('0/2');
    test.info().annotations.push({type: 'verdict', description: (await verdict.innerText()).replace(/\s+/g, ' ')});

    // THE PLATE (CW): the card's own face prints the Greens' emblem in the requirement socket — never the text label.
    const slot = page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"]`);
    await expect(slot.locator('.pcard-req__socket[data-req-party="Greens"]'), 'the plate wears the Greens\' emblem').toHaveCount(1);
    await expect(slot.locator('.pcard-req__label'), 'no text label «Kelvinists» on the plate').toHaveCount(0);
    await shoot(page, 'a-locked');

    // X — the face over the hand: the same emblem on the plate, the same party in the text.
    const zoom = page.locator('.con-zoom');
    for (let i = 0; i < 3 && await zoom.count() === 0; i++) {
      await press(page, 'KeyX', 1200);
    }
    await expect(zoom, 'X opens the viewer').toHaveCount(1, {timeout: 10_000});
    await settle(page);
    await expect(zoom.locator('.pcard-req__socket[data-req-party="Greens"]').first(), 'the viewer\'s plate: the Greens\' emblem').toBeVisible();
    await expect(zoom.locator('.pcard-req__label'), 'no text label on the viewer\'s plate').toHaveCount(0);
    const zoomText = (await zoom.innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'viewer', description: zoomText.slice(0, 900)});
    expect(zoomText, 'the text names the Greens').toContain('Зелёные');
    expect(zoomText, 'no Kelvinists anywhere on the face').not.toMatch(/Кельвинист|Kelvinist/);
    await shoot(page, 'a-viewer');
    await press(page, 'Escape', 1200);
    await expect(zoom, 'B closes the viewer').toHaveCount(0, {timeout: 10_000});

    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · the play: «ПОЧЕМУ» is the floater glyph, titanium pays the price, ONE POST, the heat lands, Manutech answers, the flow leaves', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'ghg-shipment', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect([before.thisPlayer.megacredits, before.thisPlayer.titanium], 'the fixture: 20 M€, 1 titanium').toEqual([20, 1]);

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'the Greens rule: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    const plate = page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`);
    await expect(plate, 'the hand plate: the server\'s count of floaters').toHaveAttribute('data-hand-count', '5');
    await shoot(page, 'a-open');

    // ── the composer: «ПОЧЕМУ» = the floater glyph and 5; «Сработает» names Manutech; titanium pays ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const why = page.locator(`${COMPOSER} [data-count-why]`);
    await expect(why, 'the «why» strip stands').toHaveCount(1);
    await expect(why, 'the count: 5 floaters').toHaveAttribute('data-count-why-total', '5');
    await expect(why.locator('.con-cwhy__kicker'), 'the strip is named «Расчёт» — a word, never the result again').toHaveText('Расчёт');
    await expect(why.locator('[data-count-glyph]'), 'the term wears a glyph, never the words').toHaveCount(1);
    expect(await why.locator('[data-count-glyph]').innerHTML(), 'the glyph is the printed floater').toMatch(/floater/);
    await expect(why.locator('[data-count-result]'), 'the result').toContainText('+5');
    const forecast = page.locator(`${COMPOSER} [data-forecast-row]`);
    await expect(forecast, 'the «Сработает» unit stands').toHaveCount(1);
    await expect(forecast.locator('[data-forecast-rail="stock:heat"]'), 'Manutech\'s heat names its rail row').toHaveCount(1);
    await expect(forecast.locator('[data-forecast-rail="production:megacredits"]'), 'the Greens\' M€ production names its plate').toHaveCount(1);
    // The CASCADE of a party's answer (CW): Manutech pays 1 M€ for the Greens' step — promised, as the server pays it.
    await expect(forecast.locator('[data-forecast-rail="stock:megacredits"]'), 'Manutech\'s M€ for the Greens\' step').toHaveCount(1);
    test.info().annotations.push({type: 'forecast', description: (await forecast.innerText()).replace(/\s+/g, ' ')});

    for (let i = 0; i < 2 && await usedOf(page, 'titanium') < 1; i++) {
      await press(page, 'Period', 500); // RT — fill the alternative source
    }
    expect(await usedOf(page, 'titanium'), 'titanium: the one').toBe(1);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    // ── A: ONE POST, the scene ──
    await armTransferWitness(page);
    const stopStory = await storyboard(page, 'play');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
    expect(posts[0], 'paid with titanium').toMatch(/"titanium":1/);
    expect(posts[0], 'no M€ paid').toMatch(/"megacredits":0/);
    await expect(page.locator('.con-ws'), 'the workspace leaves').toHaveCount(0, {timeout: 60_000});
    await settle(page, {timeoutMs: 40_000});
    await stopStory();
    await cinematicBeat(page, 700, 'the rail settles for the frame');
    await shoot(page, 'c-after-play');

    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'b-trail.txt'), transferTrail(witness) + '\n');
    const heatLandings = witness.landings.filter((e) => e.under === 'rail:heat');
    expect(heatLandings.length, `the heat landed on its row (trail:\n${transferTrail(witness)})`).toBeGreaterThan(0);
    const cardHeat = heatLandings.filter((l) => /^(recv:front|printed:.*heat)/.test(witness.births.find((b) => b.id === l.id)?.under ?? ''));
    expect(cardHeat.length, `the card's heat born on the landed event (trail:\n${transferTrail(witness)})`).toBeGreaterThan(0);
    const answer = witness.births.filter((b) => b.under.startsWith(`reactor:${MANUTECH}`));
    expect(answer.length, `Manutech's answer born on its printed effect (trail:\n${transferTrail(witness)})`).toBeGreaterThan(0);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    const after = await wireOf(request, id);
    expect(after.thisPlayer.heat - before.thisPlayer.heat, '5 from the card, 1 from Manutech').toBe(6);
    expect(after.thisPlayer.heatProduction - before.thisPlayer.heatProduction, '+1 heat production').toBe(1);
    expect(after.thisPlayer.megacreditProduction - before.thisPlayer.megacreditProduction, 'the Greens answer the heat step').toBe(1);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'Manutech answers the Greens\' M€ step; nothing paid in M€').toBe(1);
    expect(after.thisPlayer.titanium, 'the titanium paid').toBe(0);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the event on the table').toContain(CARD);

    // ── the journal names the card ──
    await press(page, 'KeyR', 1200);
    await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
    await settle(page);
    const journal = (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'journal', description: journal.slice(0, 900)});
    expect(journal, 'the journal names the card').toContain(CARD_RU);
    await shoot(page, 'f-journal');
    await press(page, 'KeyR', 1000);
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});
