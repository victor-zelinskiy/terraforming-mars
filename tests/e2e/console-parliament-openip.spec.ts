import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openCardActions, press, pressUntil, settle, takeRevealCards, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * OPEN IP TRADE (Turmoil Redux, RX24) — the FIRST resolution with an ACTION, and since «один фреймворк» (С4) the
 * action is composed by THE card actions' composer, its stages IN TURN:
 *
 *   · the LAW stands in the action menu as a source beside the cards (its party's seal, its own kicker, its printed
 *     action row);
 *   · A opens the composer: the law's FACE is the hero («ДЕЙСТВИЯ КАРТ › ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ › НАСТРОЙКА»);
 *     the pick is the REAL HAND (a card from the hand is chosen in the hand — the album, the discard skin); two
 *     cards picked read «2 → +6 M€ · +2 карты» in the pick's own running summary, and the formula reads the TOTAL;
 *   · A on the commit row: the ACTION COMMIT — the +6 M€ token is born on the law's PRINTED face (VISIBLE) and lands on
 *     the M€ cell of the rail (VISIBLE), the counter ticking at its touchdown — never before;
 *   · the DRAW follows: the two cards land in the composer's own draw zone («› ДОБОР КАРТ»), never a standalone
 *     reveal, are taken into the hand, and the flow LEAVES;
 *   · the server agrees: hand −2 +2, M€ +6, the action spent; the menu lists the law's tile as ACTIVATED.
 *
 * The probe samples on a clock of its own (`setInterval`, never rAF) and every sample carries what it saw: the order
 * of the stages is asserted over the samples, the visibility of the source and the target at every beat too.
 *
 * Fixture `parliament-openip-enacted` (the law enacted, red opening generation 2 with a hand to pick from).
 * Screens under screenshots/parliament-openip/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-openip');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const LAW = 'RDX_SCIENTISTS_OPEN_IP_TRADE';
const STAGE = `.con-cardactions .con-composer[data-composer-source="law:${LAW}"]`;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Wire = {
  thisPlayer: {color: string, megacredits: number, cardsInHandNbr: number},
  game: {parliament?: {enacted?: {resolution: string}, viewer?: {resolutionAction?: {resolution: string, usesLeft: number, available: boolean, reason: string}}}},
  waitingFor?: {type?: string},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Rect = {x: number, y: number, w: number, h: number};
type Chip = {id: string, x: number, y: number, res: string, amt: string};
type Sample = {
  t: number,
  album: boolean,
  hero: Rect | undefined,
  heroVisible: boolean,
  chips: Array<Chip>,
  cell: Rect | undefined,
  cellVisible: boolean,
  stock: string,
  deltas: number,
  reveal: boolean,
};
type Probe = {samples: Array<Sample>};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate((stage) => {
    const w = window as unknown as {__openipProbe: Probe};
    w.__openipProbe = {samples: []};
    const rectOf = (el: Element | null): Rect | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width < 2 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    // VISIBLE: a non-zero rect, a non-zero EFFECTIVE opacity (an ancestor fades its children by fading itself), and
    // — for an object the player can point at — nothing over its centre.
    const visible = (el: Element | null, hitTest = true): boolean => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return false;
      }
      for (let a: Element | null = el; a !== null; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) {
          return false;
        }
      }
      if (!hitTest) {
        return true;
      }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && (el.contains(hit) || hit.contains(el));
    };
    const sample = () => {
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        const icon = el.querySelector<HTMLElement>('.con-transfer__icon');
        const res = icon === null ? 'megacredits' : (Array.from(icon.classList).find((c) => c.startsWith('resource_icon--')) ?? '').replace('resource_icon--', '');
        return {id: `${el.dataset.transferId ?? '?'}:${res}`, x: r.left + r.width / 2, y: r.top + r.height / 2, res, amt: el.textContent?.trim() ?? ''};
      });
      const row = document.querySelector('.con-res__row--megacredits');
      const cell = row?.querySelector('.con-res__stockwrap') ?? null;
      const hero = document.querySelector(`${stage} .con-composer__actlaw`);
      w.__openipProbe.samples.push({
        t: Math.round(performance.now()),
        album: visible(document.querySelector('.con-hand'), false),
        hero: rectOf(hero),
        heroVisible: visible(hero, false),
        chips,
        cell: rectOf(cell),
        cellVisible: visible(cell),
        // The digits alone: the delta chip's own «+6» rides inside the same node while it ticks.
        stock: (row?.querySelector('.con-res__digits')?.textContent?.trim() ?? '').replace(/[^0-9].*$/s, ''),
        deltas: row?.querySelectorAll('.delta-chip').length ?? 0,
        reveal: document.querySelector(`${stage} .con-composer__revealzone--draw .con-reveal`) !== null,
      });
      if (w.__openipProbe.samples.length > 9000) {
        w.__openipProbe.samples.splice(0, 1500);
      }
    };
    sample();
    setInterval(sample, 40);
  }, STAGE);
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__openipProbe: Probe}).__openipProbe);

test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__openipProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__openipProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('openip-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('openip-probe', {path: file, contentType: 'application/json'});
  }
});

function inside(p: {x: number, y: number}, r: Rect | undefined, slack = 4): boolean {
  return r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}

/** In «ДЕЙСТВИЯ КАРТ»: steer the cursor onto the LAW's tile (geometry-steered, the focused tile as the witness). */
async function focusLawTile(page: Page): Promise<void> {
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-resolution') ?? '');
  await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'the law\'s tile is in the menu').toHaveCount(1);
  for (let i = 0; i < 16 && await focused() !== LAW; i++) {
    const dir = await page.evaluate((target) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile[data-action-resolution="${target}"]`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, LAW);
    await press(page, dir, 260);
  }
  if (await focused() !== LAW) {
    await walkFocusUntil(page, async () => await focused() === LAW, focused, 30);
  }
  expect(await focused(), 'never focused the law\'s tile').toBe(LAW);
}

test.describe(`Open IP Trade · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the law\'s action is ONE flow in the card composer: the pick in the hand, the commit\'s token on the rail, the draw after it, the tile spent', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-openip-enacted', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    expect(before.game.parliament?.enacted?.resolution, 'the law stands enacted').toBe(LAW);
    expect(before.game.parliament?.viewer?.resolutionAction, 'the server offers the action').toMatchObject({resolution: LAW, usesLeft: 1, available: true});
    expect(before.thisPlayer.cardsInHandNbr, 'a hand to pick from').toBeGreaterThanOrEqual(4);
    await armProbe(page);

    // ── ① THE SOURCE in the action menu: the law beside the cards, under its own kicker and name.
    await openCardActions(page);
    const tile = page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`);
    await expect(tile, 'the law is a source of «Действия карт»').toHaveCount(1);
    await expect(page.locator('.con-cardactions__plate', {hasText: /Открытая торговля патентами/i}), 'the plate names the law').toHaveCount(1);
    await expect(page.locator('.con-cardactions__plate', {hasText: /Действие резолюции/i}), 'the plate\'s kicker names the kind').toHaveCount(1);
    await focusLawTile(page);
    await settle(page, {timeoutMs: 10_000});
    await shoot(page, '01-action-menu-law');

    // ── ② THE COMPOSER: the law's face is the hero, the crumb names the law; A on the pick opens the REAL hand.
    expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the law\'s composer').toBeTruthy();
    await expect(page.locator(`${STAGE} .con-composer__actlaw .pcard`), 'the law\'s face is the hero').toBeVisible({timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    let crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `one crumb: the menu, the law (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand__salebar--select').count() > 0, {tries: 3, settleMs: 1100}),
      'A on the pick row opens the hand (a card from the hand is chosen in the hand)').toBeTruthy();
    await settle(page, {timeoutMs: 15_000});
    // Pick two cards: A on the focused card, one hop right, A again.
    await press(page, 'Enter', 400);
    await press(page, 'ArrowRight', 300);
    await press(page, 'Enter', 400);
    const picked = page.locator('.con-hand__salebar--select .con-hand__salebar-num').first();
    await expect(picked, 'two cards picked').toHaveText('2');
    await expect(page.locator('.con-hand__salebar--select .con-hand__salebar-item--gain').first(), 'the sum: +6 M€').toContainText('+6');
    await expect(page.locator('.con-hand__salebar--select [data-hand-sale-cards]'), 'the sum: +2 cards').toContainText('+2');
    await shoot(page, '02-selection-two-picked');
    // RT confirms the set: back on the composer, the commit row ready.
    expect(await pressUntil(page, 'Period', async () => await page.locator(`${STAGE} .con-composer__cta--ready`).count() > 0, {tries: 3, settleMs: 900}),
      'RT confirms the pick — the composer stands ready').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await shoot(page, '02b-composer-ready');

    // ── ③ A COMMITS: the ACTION COMMIT — the token is born on the law's face and lands on the rail.
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 0,
      {tries: 3, settleMs: 2500}), 'A commits the action').toBeTruthy();
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.chips.some((c) => c.res === 'megacredits')), {timeout: 30_000,
      message: 'the payout token flies'}).toBe(true);
    await shoot(page, '03-commit-token');
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.megacredits, {timeout: 60_000,
      message: 'the server paid 3 M€ per card'}).toBe(before.thisPlayer.megacredits + 6);

    // ── ④ THE DRAW follows: the cards land in the composer's own draw zone.
    const reveal = page.locator(`${STAGE} .con-composer__revealzone--draw .con-reveal`);
    await expect(reveal, 'the drawn cards present INSIDE the stage').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 20_000});
    crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `the crumb still names the law (${crumb})`).toContain('ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ');
    expect(crumb).toContain('ДОБОР');
    await expect(page.locator('.con-reveal:not(.con-reveal--embedded)'), 'never a standalone reveal').toHaveCount(0);
    await shoot(page, '04-draw-in-the-stage');

    // ── THE PROBE: the stages went IN TURN, and every beat had a VISIBLE source and target.
    const samples = (await readProbe(page)).samples;
    const firstAlbum = samples.find((s) => s.album);
    expect(firstAlbum, 'the hand was on screen for the pick').toBeTruthy();
    const chipSamples = samples.filter((s) => s.chips.some((c) => c.res === 'megacredits'));
    expect(chipSamples.length, 'the M€ token was sampled in flight').toBeGreaterThan(0);
    const born = chipSamples[0];
    expect(born.t, 'the commit came after the pick').toBeGreaterThan(firstAlbum!.t);
    expect(born.heroVisible, 'the token was born over a VISIBLE law face').toBe(true);
    const bornChip = born.chips.find((c) => c.res === 'megacredits')!;
    expect(bornChip.amt, 'the token carries the law\'s payout').toContain('6');
    expect(inside(bornChip, born.hero, 40), 'the token is born on the law\'s printed face').toBe(true);
    const landed = chipSamples[chipSamples.length - 1];
    const landedChip = landed.chips.find((c) => c.res === 'megacredits')!;
    expect(landed.cellVisible, 'the token lands on a VISIBLE M€ cell').toBe(true);
    expect(inside(landedChip, landed.cell, 24), 'the token ends on the M€ cell of the rail').toBe(true);
    // The counter ticks at the touchdown, never before: no sample with the token in the air shows the new number.
    const target = String(before.thisPlayer.megacredits + 6);
    const early = chipSamples.filter((s) => s.stock === target && !inside(s.chips.find((c) => c.res === 'megacredits')!, s.cell, 24));
    expect(early, 'the counter never shows +6 while the token is still flying').toEqual([]);
    expect(samples.some((s) => s.stock === target), 'the counter reads the paid number').toBe(true);
    const firstReveal = samples.find((s) => s.reveal)!;
    expect(firstReveal.t, 'the draw presented after the token was born').toBeGreaterThan(born.t);
    test.info().annotations.push({type: 'timing', description:
      `album ${firstAlbum!.t} · token born ${born.t} · landed ${landed.t} · reveal ${firstReveal.t}`});

    // ── ⑤ THE TAKE ends the flow: the workspace leaves, the hand is back where it was, the tile reads spent.
    await takeRevealCards(page);
    await waitForBoardHome(page, 40);
    await expect(page.locator('.con-cardactions'), 'a finished flow leaves the workspace').toHaveCount(0);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.cardsInHandNbr, 'discarded 2, drew 2').toBe(before.thisPlayer.cardsInHandNbr);
    expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits + 6);
    expect(after.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 0, available: false});
    await openCardActions(page);
    await expect(tile, 'a spent action leaves the default view').toHaveCount(0);
    expect(await pressUntil(page, 'Period', async () => await page.locator(`.con-cardactions__tile--activated[data-action-resolution="${LAW}"]`).count() > 0, {tries: 3, settleMs: 700}),
      'RT shows the activated actions: the law\'s tile is there, spent').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await shoot(page, '05-tile-spent');
  });
});
