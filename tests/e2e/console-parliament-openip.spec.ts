import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openCardActions, press, pressUntil, settle, takeRevealCards, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * OPEN IP TRADE (Turmoil Redux, RX24) — the ONE e2e of the new mechanic: the
 * FIRST resolution with an ACTION, and the action as ONE FLOW through the
 * action workspace — a member of the party-action family, opened from
 * «Действия карт», its stages going IN TURN:
 *
 *   · the LAW stands in the action menu as a source beside the cards (its
 *     party's seal, its own kicker, its printed action row);
 *   · A opens the law's stage: the law's FACE is the hero, and the SELECTION
 *     is the REAL HAND standing as a step of the same stage («ДЕЙСТВИЯ КАРТ ›
 *     ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ › ВЫБОР»); two cards picked read
 *     «2 → +6 M€ · +2 карты» in the pick's own running summary;
 *   · RT commits: the picked cards feed the TRADE TERMINAL (the patent sale's
 *     own scene, at the law's rate), the +6 M€ chip is born at the terminal
 *     (VISIBLE) and lands on the M€ cell of the rail (VISIBLE), and the
 *     counter ticks at its touchdown — never before;
 *   · the DRAW follows the chip: the two cards come off the HUD pile into
 *     the same stage's OUTCOME zone only AFTER the terminal has retracted
 *     («› ДОБОР КАРТ»), are taken into the hand, and the flow LEAVES;
 *   · the server agrees: hand −2 +2, M€ +6, the action spent; the menu lists
 *     the law's tile as ACTIVATED.
 *
 * The probe samples on a clock of its own (`setInterval`, never rAF) and every
 * sample carries what it saw: the order of the stages is asserted over the
 * samples, the visibility of the source and the target at every beat too.
 *
 * Fixture `parliament-openip-enacted` (the law enacted, red opening
 * generation 2 with a hand to pick from). Screens under screenshots/parliament-openip/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-openip');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const LAW = 'RDX_SCIENTISTS_OPEN_IP_TRADE';

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
  phase: string,
  handStep: boolean,
  saleHero: boolean,
  terminalVisible: boolean,
  saleProxies: number,
  chips: Array<Chip>,
  slit: Rect | undefined,
  cell: Rect | undefined,
  cellVisible: boolean,
  stock: string,
  deltas: number,
  reveal: boolean,
  beatProxies: number,
};
type Probe = {samples: Array<Sample>};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
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
    // — for an object the player can point at — nothing over its centre. The sale's stage is a `pointer-events: none`
    // layer, which the hit-test is blind to (it never answers such an element), so the terminal is judged by its paint
    // alone (`hitTest: false`).
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
      const pact = document.querySelector('.con-pact--resolution');
      const row = document.querySelector('.con-res__row--megacredits');
      const cell = row?.querySelector('.con-res__stockwrap') ?? null;
      const terminal = document.querySelector('.con-sale-hero__terminal');
      w.__openipProbe.samples.push({
        t: Math.round(performance.now()),
        phase: pact?.getAttribute('data-pact-phase') ?? '',
        handStep: visible(document.querySelector('.con-pact--resolution .con-pact__handzone--inline .con-hand')),
        saleHero: document.querySelector('.con-sale-hero') !== null,
        terminalVisible: visible(terminal, false),
        saleProxies: document.querySelectorAll('.con-sale-hero__proxy').length,
        chips,
        slit: rectOf(document.querySelector('.con-sale-hero__slit')),
        cell: rectOf(cell),
        cellVisible: visible(cell),
        // The digits alone: the delta chip's own «+6» rides inside the same node while it ticks.
        stock: (row?.querySelector('.con-res__digits')?.textContent?.trim() ?? '').replace(/[^0-9].*$/s, ''),
        deltas: row?.querySelectorAll('.delta-chip').length ?? 0,
        reveal: document.querySelector('.con-cardactions .con-pact__revealzone .con-reveal') !== null,
        beatProxies: document.querySelectorAll('.con-pact__fly .con-deal-proxy').length,
      });
      if (w.__openipProbe.samples.length > 9000) {
        w.__openipProbe.samples.splice(0, 1500);
      }
    };
    sample();
    setInterval(sample, 40);
  });
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

  test('the law\'s action is ONE flow: the pick on the real hand, the sale\'s chip on the rail, the draw after the chip, the tile spent', async ({page, request}) => {
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

    // ── ② THE SELECTION STEP: the law's face is the hero, the REAL hand stands beside it, the crumb names the stage.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-pact--resolution').count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the law\'s stage').toBeTruthy();
    const hand = page.locator('.con-pact--resolution .con-pact__handzone--inline .con-hand');
    await expect(hand, 'the hand stands as a step INSIDE the stage').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-pact--resolution .con-pact__hero--bill .pcard'), 'the law\'s face is the hero').toBeVisible();
    await settle(page, {timeoutMs: 15_000});
    let crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `one crumb: the menu, the law, the stage (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ');
    expect(crumb).toContain('ВЫБОР');
    // Nothing picked: the summary reads zero and the confirm is not lit.
    await expect(page.locator('.con-hand__salebar--select'), 'the running summary stands').toHaveCount(1);
    // Pick two cards: A on the focused card, one hop right, A again.
    await press(page, 'Enter', 400);
    await press(page, 'ArrowRight', 300);
    await press(page, 'Enter', 400);
    const picked = page.locator('.con-hand__salebar--select .con-hand__salebar-num').first();
    await expect(picked, 'two cards picked').toHaveText('2');
    await expect(page.locator('.con-hand__salebar--select .con-hand__salebar-item--gain').first(), 'the sum: +6 M€').toContainText('+6');
    await expect(page.locator('.con-hand__salebar--select [data-hand-sale-cards]'), 'the sum: +2 cards').toContainText('+2');
    await shoot(page, '02-selection-two-picked');

    // ── ③ RT COMMITS: the sale's scene takes the picked cards; the chip is born at the terminal and lands on the rail.
    expect(await pressUntil(page, 'Period', async () => await page.locator('.con-sale-hero').count() > 0, {tries: 3, settleMs: 700}),
      'RT commits into the terminal').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft, {timeout: 30_000,
      message: 'the action is spent at the commit'}).toBe(0);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.chips.some((c) => c.res === 'megacredits')), {timeout: 30_000,
      message: 'the payout chip flies'}).toBe(true);
    await shoot(page, '03-sale-chip');
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.megacredits, {timeout: 60_000,
      message: 'the server paid 3 M€ per card'}).toBe(before.thisPlayer.megacredits + 6);

    // ── ④ THE DRAW follows the chip: the cards come off the pile into the stage's zone, and the reveal presents there.
    const reveal = page.locator('.con-cardactions .con-pact__revealzone .con-reveal');
    await expect(reveal, 'the drawn cards present INSIDE the stage').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 20_000});
    crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `the crumb still names the law (${crumb})`).toContain('ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ');
    expect(crumb).toContain('ДОБОР');
    await expect(page.locator('.con-reveal:not(.con-reveal--embedded)'), 'never a standalone reveal').toHaveCount(0);
    await shoot(page, '04-draw-in-the-stage');

    // ── THE PROBE: the stages went IN TURN, and every beat had a VISIBLE source and target.
    const samples = (await readProbe(page)).samples;
    const firstHand = samples.find((s) => s.handStep);
    expect(firstHand, 'the hand step was on screen').toBeTruthy();
    const firstSale = samples.find((s) => s.saleHero);
    expect(firstSale, 'the sale scene played').toBeTruthy();
    expect(firstSale!.t, 'the sale came after the selection').toBeGreaterThan(firstHand!.t);
    const withProxies = samples.find((s) => s.saleProxies > 0 && s.handStep);
    expect(withProxies, 'the cards lifted off the hand while the hand was still on screen (the proxies stand over live slots)').toBeTruthy();
    const chipSamples = samples.filter((s) => s.chips.some((c) => c.res === 'megacredits'));
    expect(chipSamples.length, 'the M€ chip was sampled in flight').toBeGreaterThan(0);
    const born = chipSamples[0];
    expect(born.terminalVisible, 'the chip was born over a VISIBLE terminal').toBe(true);
    const bornChip = born.chips.find((c) => c.res === 'megacredits')!;
    expect(bornChip.amt, 'the chip carries the law\'s payout').toContain('6');
    expect(inside(bornChip, born.slit, 60), 'the chip is born at the terminal\'s slit').toBe(true);
    const landed = chipSamples[chipSamples.length - 1];
    const landedChip = landed.chips.find((c) => c.res === 'megacredits')!;
    expect(landed.cellVisible, 'the chip lands on a VISIBLE M€ cell').toBe(true);
    expect(inside(landedChip, landed.cell, 24), 'the chip ends on the M€ cell of the rail').toBe(true);
    // The counter ticks at the touchdown, never before: no sample with the chip in the air shows the new number.
    const target = String(before.thisPlayer.megacredits + 6);
    const early = chipSamples.filter((s) => s.stock === target && !inside(s.chips.find((c) => c.res === 'megacredits')!, s.cell, 24));
    expect(early, 'the counter never shows +6 while the chip is still flying').toEqual([]);
    expect(samples.some((s) => s.stock === target), 'the counter reads the paid number').toBe(true);
    // The draw waited for the chip: the pull off the pile (the beat proxies) and the reveal came after the sale ended.
    const lastSale = [...samples].reverse().find((s) => s.saleHero)!;
    const firstBeat = samples.find((s) => s.beatProxies > 0);
    const firstReveal = samples.find((s) => s.reveal)!;
    expect(firstReveal.t, 'the reveal presented after the terminal retracted').toBeGreaterThan(lastSale.t);
    if (firstBeat !== undefined) {
      expect(firstBeat.t, 'the pull off the pile started after the terminal retracted').toBeGreaterThan(lastSale.t);
    }
    expect(firstReveal.t, 'the reveal presented after the chip landed').toBeGreaterThan(landed.t);
    test.info().annotations.push({type: 'timing', description:
      `hand ${firstHand!.t} · sale ${firstSale!.t} · chip born ${born.t} · landed ${landed.t} · terminal gone ${lastSale.t} · pull ${firstBeat?.t ?? '—'} · reveal ${firstReveal.t}`});

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
