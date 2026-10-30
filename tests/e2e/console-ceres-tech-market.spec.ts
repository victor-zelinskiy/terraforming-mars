import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, cinematicBeat, crumbText, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P68 «ТЕХНОРЫНОК ЦЕРЕРЫ» — THE FIRST PRELUDE 2 CARD WITH AN ACTION, and the witness of three classes that had none for
 * a CARD's action (docs/claude/prompts/prelude2-p68-ceres-tech-market.md §3):
 *   · the HAND ALBUM as a STEP of a card's action — the discard skin, the running sum off the server's rate;
 *   · the DISCARD SCENE out of an action's batch — the picked cards leave the hand for the pile;
 *   · THE PAYOUT OF A DISCARD IS ONE WAVE FOR ANY SOURCE (ledger CS) — one «2» token per card, born on the printed
 *     «2x [M€]» of the card standing in the hero slot, the M€ row ticking on each touchdown, AFTER the cards have left.
 *
 *   One fixture, one turn (`ceres-tech-market`: blue on the move — P68 + Research, Tardigrades, Ants in the hand, two
 *   colonies, 20 M€, 2 titanium, Olympus Conference on the table):
 *   (1) the PLAY: «ПОЧЕМУ» reads ONE term (colonies 2 → +4), titanium in the payment, ONE POST, the card on the table;
 *   (2) blue's second action: «ДЕЙСТВИЯ КАРТ» › P68 › the album in the discard skin («+4» for two), RT back into the
 *       composer, A → ONE POST addressed to the card's discard → the scene → the wave → the flow leaves; the server: two
 *       cards gone, +4 M€.
 *
 * Fixture: tests/e2e/fixtures/generate.ts § P68 (the dry run proves both answers). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Ceres Tech Market';
const CARD_RU = 'Технорынок Цереры';
const THROWN = ['Research', 'Tardigrades'] as const;
const KEPT = 'Ants';
const OUT = path.resolve('screenshots', 'p68');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PLAY = '.con-composer--play';
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';
/** The hand album standing over the card-actions stage as the action's discard pick (the client pick bridge). */
const ALBUM = '.con-hand.con-hand--discard';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {megacredits: number, titanium: number, tableau: Array<{name: string, resources?: number}>},
  waitingFor?: {type?: string},
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

type Probe = {
  ticks: number,
  /** The rail's M€ digits, each change with its time since the arm. */
  mc: Array<{t: number, v: string}>,
  /** The discard scene: first seen / last seen, and the most proxies standing at once. */
  discardFrom: number,
  discardTo: number,
  proxiesMax: number,
  /** Every crumb the card-actions workspace showed (root › subject › stage). */
  crumbs: Array<string>,
  stranded: boolean,
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const p: Probe = {ticks: 0, mc: [], discardFrom: -1, discardTo: -1, proxiesMax: 0, crumbs: [], stranded: false};
    (window as unknown as {__p68: Probe}).__p68 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = (tick: boolean) => {
      if (tick) {
        p.ticks++;
      }
      const t = Date.now() - t0;
      // The counter's own digits (the delta chip «+2» rides inside the value box — read only the leading number).
      const mc = /^\d+/.exec(text(document.querySelector('.con-res__row--megacredits .con-res__value')))?.[0] ?? '';
      if (p.mc.length === 0 || p.mc[p.mc.length - 1].v !== mc) {
        p.mc.push({t, v: mc});
      }
      if (document.querySelector('.con-discard') !== null) {
        p.discardFrom = p.discardFrom < 0 ? t : p.discardFrom;
        p.discardTo = t;
        p.proxiesMax = Math.max(p.proxiesMax, document.querySelectorAll('.con-discard-proxy').length);
      }
      const head = document.querySelector('.con-cardactions .con-wshead');
      if (head !== null) {
        const crumb = text(head);
        if (crumb !== '' && !p.crumbs.includes(crumb) && p.crumbs.length < 12) {
          p.crumbs.push(crumb);
        }
      }
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 30);
  });
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p68: Probe}).__p68);

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
  Number((await page.locator(`${PLAY} .con-payrow[data-pay-unit="${unit}"] .con-payrow__used`).innerText()).replace(/\D+/g, '') || 'NaN');

const rowText = (page: Page, scope: string) => page.evaluate((s) =>
  (document.querySelector(`${s} .con-composer__row--focused`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), scope);

test.describe(`P68 Ceres Tech Market · the counted play, the discard action, the payout wave · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the play (one term, titanium, ONE POST) and the action of the same turn (the album, ONE POST, the scene, the wave)', async ({page, request}) => {
    test.setTimeout(480_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'ceres-tech-market', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect([before.thisPlayer.megacredits, before.thisPlayer.titanium], 'the fixture: 20 M€, 2 titanium').toEqual([20, 2]);
    expect(before.cardsInHand?.map((c) => c.name).sort(), 'the fixture\'s hand').toEqual([CARD, ...THROWN, KEPT].sort());

    // ── (1) THE PLAY ──
    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    const plate = page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`);
    await expect(plate, 'the hand plate: the server\'s count').toHaveAttribute('data-hand-count', '4');
    await shoot(page, 'a-hand');
    await press(page, 'Enter', 1200);
    await page.locator(PLAY).waitFor({timeout: 15_000});
    await settle(page);
    const why = page.locator(`${PLAY} [data-count-why]`);
    await expect(why, 'the «why» strip stands').toHaveCount(1);
    // ONE term: the single form — no summed parts, the count on the strip itself (PL-196 — the rate is in the head).
    await expect(why.locator('[data-count-term]'), 'ONE term — no summed parts').toHaveCount(0);
    await expect(why, 'the colonies: 2').toHaveAttribute('data-count-why-total', '2');
    await expect(why.locator('[data-count-glyph]'), 'the colony glyph').toHaveCount(1);
    await expect(why.locator('[data-count-result]'), 'the result').toContainText('+4');
    for (let i = 0; i < 3 && await usedOf(page, 'titanium') < 2; i++) {
      await press(page, 'Period', 500); // RT — fill the titanium
    }
    expect(await usedOf(page, 'titanium'), 'titanium: both').toBe(2);
    const forecast = await page.evaluate((s) => (document.querySelector(`${s} [data-forecast-row]`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), PLAY);
    test.info().annotations.push({type: 'forecast', description: forecast});
    // Olympus Conference answers the Science tag: an OWN chip «+1» (its science onto the card — no question asked).
    expect(forecast, '«Сработает»: the table answers the Science tag').toMatch(/Сработает.*\+1/);
    await expect(page.locator(`${PLAY} [data-forecast-row] [data-forecast-chip="own"]`), 'one own answer').toHaveCount(1);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'a-composer');

    const stopPlay = await storyboard(page, 'play');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'paid with titanium').toMatch(/"titanium":2/);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000, message: 'the card is on the table'}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
    await stopPlay();
    await waitForBoardHome(page, 30);
    const afterPlay = await wireOf(request, id);
    expect(afterPlay.thisPlayer.megacredits, '20 − 6 + 4').toBe(18);
    expect(afterPlay.thisPlayer.titanium, 'the titanium paid').toBe(0);
    expect(afterPlay.thisPlayer.tableau.find((c) => c.name === 'Olympus Conference')?.resources, 'Olympus Conference took its science').toBe(1);
    await shoot(page, 'b-played');

    // ── (2) THE ACTION ──
    await openCardActions(page);
    const focusedAction = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    expect(await walkFocusUntil(page, async () => await focusedAction() === CARD, focusedAction, 30), `never focused the «${CARD}» action`).toBeTruthy();
    await shoot(page, 'c-tile');
    await openActionFocus(page);
    await settle(page);
    // The discard row: the cursor on it, A opens the album in the discard skin.
    for (let i = 0; i < 6 && !/карт/i.test(await rowText(page, STAGE)); i++) {
      await press(page, 'ArrowUp', 300);
    }
    expect(await rowText(page, STAGE), 'the cursor stands on the discard row').toMatch(/карт/i);
    await shoot(page, 'c-stage');
    for (let i = 0; i < 3 && await page.locator(ALBUM).count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(page.locator(ALBUM), 'the hand album opens in the discard skin').toBeVisible({timeout: 15_000});
    await settle(page);
    test.info().annotations.push({type: 'album-crumb', description: await crumbText(page)});
    await expect(page.locator(ALBUM), 'the album names the operation\'s source').toContainText(CARD_RU);
    await expect(page.locator(`${ALBUM} [data-zoom-slot="${CARD}"]`), 'the card on the table is not in the hand').toHaveCount(0);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    for (const name of THROWN) {
      expect(await focusCard(page, name, slots * 2 + 6), `focused «${name}»`).toBe(true);
      await press(page, 'Enter', 700);
    }
    await expect(page.locator(`${ALBUM} .con-hand__slot--select-picked`)).toHaveCount(2);
    await expect(page.locator('.con-hand__salebar--select .con-hand__salebar-item--gain').first(), 'the running sum off the server\'s rate').toContainText('+4');
    await shoot(page, 'd-album');
    await press(page, 'Period', 1200); // RT — the set into the composer
    await expect(page.locator(`${STAGE}:visible`), 'the composer returns with the answer').toHaveCount(1, {timeout: 15_000});
    await settle(page);
    expect(posts.length, 'nothing sent before the action\'s own A').toBe(1);
    await shoot(page, 'e-answered');

    // A → ONE POST; the scene; the wave.
    for (let i = 0; i < 6 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 300);
    }
    await armProbe(page);
    await armTransferWitness(page);
    const stopAction = await storyboard(page, 'action');
    for (let attempt = 0; attempt < 3 && posts.length === 1; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(1).catch(() => undefined);
    }
    expect(posts.length, 'the action is ONE POST').toBe(2);
    const body = JSON.parse(posts[1]) as {type?: string, responses?: Array<{type: string, cards?: Array<string>, for?: {role: string, source?: {card?: string}}}>};
    test.info().annotations.push({type: 'action-post', description: posts[1].slice(0, 600)});
    const answer = (body.responses ?? []).find((r) => r.type === 'card' && (r.cards ?? []).length === 2);
    expect(answer?.cards?.slice().sort(), 'the batch carries the two picked cards').toEqual([...THROWN].sort());
    expect(answer?.for, 'the answer is ADDRESSED to the card\'s own discard').toMatchObject({role: 'discard', source: {card: CARD}});

    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 30_000, message: 'the server paid'}).toBe(22);
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await stopAction();
    await cinematicBeat(page, 600, 'the board settles for the frame');
    await shoot(page, 'f-after');

    const probe = await readProbe(page);
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'action-trail.txt'), transferTrail(witness) + '\n');
    test.info().annotations.push({type: 'probe', description: JSON.stringify(probe)});
    // The run's own record, printed before any verdict — a red names what it saw.
    console.log('[p68] probe', JSON.stringify(probe));
    console.log(`[p68] trail\n${transferTrail(witness)}`);
    expect(probe.ticks, 'the probe sampled').toBeGreaterThan(10);
    expect(probe.stranded, 'nothing stranded').toBe(false);
    expect(probe.discardFrom, 'the discard scene played').toBeGreaterThanOrEqual(0);
    expect(probe.proxiesMax, 'the two cards left the hand as a packet').toBe(2);
    const paid = witness.landings.filter((e) => e.under === 'rail:megacredits');
    expect(paid.length, `two tokens landed on the M€ row (trail:\n${transferTrail(witness)})`).toBe(2);
    const born = witness.births.filter((e) => e.value.includes('2'));
    expect(born.every((e) => e.under === 'hero'), `every token was born on the card in the hero slot (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    // The cause before the effect: the row moves only after the cards have left the hand.
    const firstMove = probe.mc.find((s, i) => i > 0 && s.v !== probe.mc[0].v);
    expect(firstMove, `the M€ row moved (${JSON.stringify(probe.mc)})`).not.toBeUndefined();
    expect(firstMove!.t, `the M€ row ticks after the discard scene (${JSON.stringify(probe)})`).toBeGreaterThanOrEqual(probe.discardTo - 100);
    expect(probe.mc.map((s) => s.v), 'the row ticks once per token: 18 → 20 → 22').toEqual(['18', '20', '22']);

    const after = await wireOf(request, id);
    expect(after.cardsInHand?.map((c) => c.name), 'only the kept card').toEqual([KEPT]);
    expect(after.thisPlayer.megacredits, '18 + 4').toBe(22);
    await waitForBoardHome(page, 30);
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});
