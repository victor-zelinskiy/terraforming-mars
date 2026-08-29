import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * DELTA WORKS (DP06) — Configure → Payment → Resolve on its two screens.
 *
 * The composition editor is a SUBSTEP, never an inline expansion: Configure
 * states the price with the ⚡/🔩 pair, the compact draft and an honest
 * «Далее: состав оплаты»; the premium payment selector owns the working area
 * only on its own step (entered from the flow's confirm, ONLY while the
 * server model admits ≥2 valid mixes); the final confirm there runs the
 * ordinary server-authoritative Resolve. This probe drives a REAL game
 * (testMode stock, DP06 played over the API) and asserts:
 *
 *   · Configure carries NO payment panel, no scroll, and no dead LB/RB;
 *   · the family row shows both icons + the draft + the next-step tag;
 *   · the gateway CTA says «Продолжить к оплате», never the final verb;
 *   · the Payment substep dials the ONE draft (panel + right summary move
 *     together), B walks back with draft/selections intact;
 *   · a non-flexible family (titanium) resolves with NO extra step;
 *   · the final confirm commits the REAL trade / advance (server state).
 *
 * Screenshots → `screenshots/dp06-payment-mix/`.
 */

const CARD = 'Delta Works';
const OUT = path.resolve('screenshots', 'dp06-payment-mix');

const CFG = soloGameConfig({
  players: [{name: 'MixProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true, colonies: true},
  customProjectCards: [CARD],
  // No first action, no payment quirks — the board home is reachable clean.
  customCorporationsList: ['ThorGate'],
  customColoniesList: ['Luna', 'Pluto', 'Triton', 'Callisto'],
  seed: 0.29,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Answer interstitial prompts until the action menu stands. */
async function toActionMenu(request: APIRequestContext, id: string, rounds = 12): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < rounds; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
}

/** Play DP06 out of the hand over the API (M€ only — testMode affords it). */
async function playDeltaWorks(request: APIRequestContext, id: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === CARD);
  expect(offered, `${CARD} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card: CARD, payment: payMc(offered.calculatedCost ?? 4)},
  } as never);
  const model = await fetchPlayerModel(request, id) as Wire;
  expect((model.thisPlayer?.tableau ?? []).some((c: Wire) => c.name === CARD),
    'Delta Works reached the tableau').toBeTruthy();
}

/** The live payment-panel numbers, read off the ONE shared chassis. */
async function readPanel(page: Page, scope: string): Promise<{
  present: boolean,
  units: Array<string>,
  used: Record<string, string>,
  paid: string,
  statusExact: boolean,
  sourceCard: string,
  steelPills: boolean,
}> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const rows = Array.from(root?.querySelectorAll('.con-payrow') ?? []);
    const used: Record<string, string> = {};
    const units: Array<string> = [];
    for (const row of rows) {
      const unit = row.getAttribute('data-pay-unit') ?? '';
      units.push(unit);
      used[unit] = (row.querySelector('.con-payrow__used') as HTMLElement | null)?.innerText.trim() ?? '';
    }
    return {
      present: root !== null,
      units,
      used,
      paid: (root?.querySelector('.con-paystatus__paid') as HTMLElement | null)?.innerText.trim() ?? '',
      statusExact: root?.querySelector('.con-paystatus--exact') !== null,
      sourceCard: (root?.querySelector('.con-pay__source-card') as HTMLElement | null)?.innerText.trim() ?? '',
      steelPills: root?.querySelector('.con-payrow[data-pay-unit="steel"] .con-payrow__pills') !== null,
    };
  }, scope);
}

/** The compact draft on the Configure price line / family row: [energy, steel]. */
async function readDraft(page: Page, scope: string): Promise<Array<string>> {
  return page.evaluate((sel) =>
    Array.from(document.querySelectorAll(`${sel} b`)).map((b) => (b as HTMLElement).innerText.trim()), scope);
}

/** The right «ОПЛАТА» summary rows of the colony focus stage. */
async function readOutcomePay(page: Page): Promise<Array<{icon: string, amount: string, pair: string}>> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.con-colfocus__rsec--pay .con-colfocus__rrow'));
    return rows.map((row) => ({
      icon: Array.from((row.querySelector('i') as HTMLElement | null)?.classList ?? [])
        .find((c) => c.startsWith('resource_icon--'))?.replace('resource_icon--', '') ?? '',
      amount: (row.querySelector('b') as HTMLElement | null)?.innerText.trim() ?? '',
      pair: (row.querySelector('em') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '',
    }));
  });
}

async function barText(page: Page): Promise<string> {
  return (await page.locator('.con-cmdbar').innerText()).replace(/\s+/g, ' ').toUpperCase();
}

/**
 * THE SHELL ANCHOR — the hydro work surface's own coordinates plus the
 * persistent context column's box. The whole point of the one-frame layout
 * contract is that these do NOT move between substates (preview → choice →
 * payment → result): the connector stem stays landed, the identity column
 * keeps its scale, the CTA column keeps its place.
 */
type HydroAnchor = {panel: {x: number, y: number, w: number, h: number}, ctx: {x: number, y: number, w: number}, stemGap: number};
async function hydroAnchor(page: Page): Promise<HydroAnchor> {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (el === null) {
        throw new Error('hydro shell chrome missing');
      }
      const b = el.getBoundingClientRect();
      return {x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom};
    };
    const panel = box(document.querySelector('.con-hydro__panel'));
    const ctx = box(document.querySelector('.con-hydro__ctx'));
    const focused = document.querySelector('.con-hydro__stop--focused');
    const stemGap = focused === null ? -1 : panel.y - focused.getBoundingClientRect().bottom;
    return {panel: {x: panel.x, y: panel.y, w: panel.w, h: panel.h}, ctx: {x: ctx.x, y: ctx.y, w: ctx.w}, stemGap};
  });
}

function expectSameAnchor(a: HydroAnchor, b: HydroAnchor, label: string): void {
  expect(Math.abs(b.panel.y - a.panel.y), `${label}: the surface top may not move`).toBeLessThanOrEqual(1);
  expect(Math.abs(b.panel.x - a.panel.x), `${label}: the surface left may not move`).toBeLessThanOrEqual(1);
  expect(Math.abs(b.panel.w - a.panel.w), `${label}: the surface width may not move`).toBeLessThanOrEqual(1);
  expect(Math.abs(b.panel.h - a.panel.h), `${label}: the surface height may not move`).toBeLessThanOrEqual(1);
  expect(Math.abs(b.ctx.x - a.ctx.x), `${label}: the context column may not move`).toBeLessThanOrEqual(1);
  expect(Math.abs(b.ctx.w - a.ctx.w), `${label}: the context column may not resize`).toBeLessThanOrEqual(1);
}

/** The viewer's live server numbers. */
async function serverState(request: APIRequestContext, id: string): Promise<{
  energy: number, steel: number, deltaPosition: number, lunaVisitor: boolean,
}> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const me = model.thisPlayer as Wire;
  const luna = (model.game?.colonies ?? []).find((c: Wire) => c.name === 'Luna');
  return {
    energy: me.energy,
    steel: me.steel,
    deltaPosition: me.deltaProject?.position ?? -1,
    lunaVisitor: luna?.visitor !== undefined && luna.visitor !== null,
  };
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`DP06 payment substep · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('Hydronetwork: Configure price line → Payment substep → Resolve', async ({page, request}) => {
      test.setTimeout(420_000);
      const id = await createGameWithCards(request, [CARD], {config: CFG, seed: 0.29});
      await seedGameOverApi(request, id, {cards: [CARD], corporation: 'ThorGate', keepColony: 'Luna'});
      await playDeltaWorks(request, id);
      await openConsole(page, id, profile.query);
      await waitForBoardHome(page, 25, {keepColony: 'Luna'});

      // RT wheel → left = Hydronetwork.
      await press(page, 'Period', 1100);
      await press(page, 'ArrowLeft', 1600);
      await page.waitForSelector('.con-hydro', {timeout: 10_000});
      await page.waitForSelector('.con-hydro__payline', {timeout: 10_000});
      await page.waitForTimeout(600);

      // ── CONFIGURE: no panel, no scroll pressure, the honest price line. ──
      expect(await page.locator('.con-hydro .con-pay').count(), 'no payment panel on Configure').toBe(0);
      const reqText = await page.locator('.con-hydro__reqline').innerText();
      expect(reqText, 'affordability must not live inside ТРЕБОВАНИЯ').not.toContain('У вас');
      const payline = await page.locator('.con-hydro__payline').innerText();
      expect(payline.toUpperCase()).toContain('ЭНЕРГИЯ И/ИЛИ СТАЛЬ');
      expect(payline.toUpperCase()).toContain('ДАЛЕЕ: СОСТАВ ОПЛАТЫ');
      expect(payline).toContain('Дельтовые сооружения');
      expect(await page.locator('.con-hydro__payline-price .resource_icon').count(), 'the ⚡/🔩 pair').toBe(2);
      const draft0 = await readDraft(page, '.con-hydro__payline-mix');
      expect(draft0).toEqual(['1', '0']); // energy-first default at cost 1
      const bar0 = await barText(page);
      expect(bar0).not.toContain('СОСТАВ ОПЛАТЫ'); // no dial hint on Configure
      // A hidden dial is the forbidden shape: RB on Configure changes nothing.
      await press(page, 'KeyE', 700);
      expect(await readDraft(page, '.con-hydro__payline-mix')).toEqual(['1', '0']);
      // THE SHELL ANCHOR at Configure — the reference every later substate is
      // measured against, plus the connector contract: the focused stop's stem
      // (0.85rem) physically reaches the surface's top edge.
      const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      const a0 = await hydroAnchor(page);
      expect(a0.stemGap, 'the stem gap is a touch, not a void').toBeGreaterThanOrEqual(0);
      expect(a0.stemGap).toBeLessThanOrEqual(0.9 * rem);
      await shoot(page, `${profile.tag}-hydro-01-configure`);

      // ── Stage 1 asks its reward CHOICE first (Configure's own pre-select);
      //    its confirm is the GATEWAY — «Продолжить к оплате», never the
      //    final reinforce, because several mixes exist. ──
      await press(page, 'Enter', 1200);
      await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
      expectSameAnchor(a0, await hydroAnchor(page), 'preview → reward choice');
      await press(page, 'Enter', 900); // pick the focused reward option
      const barChoice = await barText(page);
      expect(barChoice).toContain('ПРОДОЛЖИТЬ К ОПЛАТЕ');
      expect(barChoice).not.toContain('УКРЕПИТЬ ГИДРОСЕТЬ');
      await shoot(page, `${profile.tag}-hydro-01b-choice`);

      // ── CONFIGURE → PAYMENT (the gateway press) ──
      await press(page, 'Enter', 1200);
      await page.waitForSelector('.con-hydro__layer--payment .con-pay', {timeout: 8_000});
      expectSameAnchor(a0, await hydroAnchor(page), 'choice → payment');
      const step0 = await readPanel(page, '.con-hydro__layer--payment .con-pay');
      expect(step0.units).toEqual(['steel', 'energy']);
      expect(step0.steelPills).toBe(true);
      expect(step0.sourceCard).toBe('Дельтовые сооружения');
      expect(step0.statusExact).toBe(true);
      const barPay = await barText(page);
      expect(barPay).toContain('СОСТАВ ОПЛАТЫ');
      expect(barPay).toContain('УКРЕПИТЬ ГИДРОСЕТЬ');
      // The dial moves the ONE draft.
      await press(page, 'KeyE', 800);
      const step1 = await readPanel(page, '.con-hydro__layer--payment .con-pay');
      expect(step1.used.steel).toBe('1');
      expect(step1.used.energy).toBe('0');
      expect(step1.statusExact).toBe(true);
      await shoot(page, `${profile.tag}-hydro-02-payment`);

      // ── PAYMENT → CONFIGURE (B): the substep folds; the chosen reward and
      //    the dialed draft both survive the walk back. ──
      await press(page, 'Escape', 900);
      expect(await page.locator('.con-hydro__layer--payment').count(), 'B folded the substep').toBe(0);
      await page.waitForSelector('.con-hydro__payline', {timeout: 6_000});
      expectSameAnchor(a0, await hydroAnchor(page), 'payment → back to preview');
      expect(await page.locator('.con-hydro__gains-choice').count(), 'the reward pick survives B').toBe(0);
      expect(await readDraft(page, '.con-hydro__payline-mix'), 'the dialed draft survives B').toEqual(['0', '1']);
      await shoot(page, `${profile.tag}-hydro-03-back`);

      // ── RE-ENTER and RESOLVE: the reward step re-asks BY ITS OWN CONTRACT
      //    («no silently carried reward»); the payment draft, though, is the
      //    canonical one and comes back dialed. ──
      await press(page, 'Enter', 1200); // → the reward step (options again)
      await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
      await press(page, 'Enter', 900); // pick
      await press(page, 'Enter', 1200); // the gateway again
      await page.waitForSelector('.con-hydro__layer--payment .con-pay', {timeout: 8_000});
      expect((await readPanel(page, '.con-hydro__layer--payment .con-pay')).used.steel).toBe('1');
      await press(page, 'Enter', 2000);
      // The commit runs the ordinary movement pipeline; judge the SERVER.
      await expect.poll(async () => (await serverState(request, id)).deltaPosition,
        {timeout: 20_000, message: 'the marker advanced on the server'}).toBe(1);
      const after = await serverState(request, id);
      // Stage 1 pays its own reward (the picked option: +2 steel), so the
      // ledger reads 500 − 1 (the dialed steel share) + 2 = 501.
      expect(after.steel, 'the dialed steel was spent, the stage reward landed').toBe(501);
      expect(after.energy, 'no energy was spent for a steel-only mix').toBe(500);
      // THE RESULT stands in the SAME frame: the payoff may not re-seat the
      // surface the decision was made on (the old centred result layer sat
      // ~250px lower and tore the connector off).
      await page.waitForSelector('.con-hydro__layer--result', {timeout: 20_000});
      expectSameAnchor(a0, await hydroAnchor(page), 'commit → result');
      await shoot(page, `${profile.tag}-hydro-04-resolved`);
    });

    test('Colonies: compact Configure → mix substep → Resolve; titanium has no step', async ({page, request}) => {
      test.setTimeout(420_000);
      const id = await createGameWithCards(request, [CARD], {config: CFG, seed: 0.53});
      await seedGameOverApi(request, id, {cards: [CARD], corporation: 'ThorGate', keepColony: 'Luna'});
      await playDeltaWorks(request, id);
      await openConsole(page, id, profile.query);
      await waitForBoardHome(page, 25, {keepColony: 'Luna'});

      // RT wheel → right = the colonies section; A on the focused colony.
      const colonies = page.locator('.con-colonies');
      for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
        await press(page, 'Period', 1100);
        await press(page, 'ArrowRight', 1400);
      }
      expect(await colonies.count(), 'the colonies section opened').toBeGreaterThan(0);
      // Focus LUNA specifically — the resolve assertions read its visitor.
      const luna = page.locator('.con-coltile--focused[data-test="con-colony-Luna"]');
      for (let i = 0; i < 10 && await luna.count() === 0; i++) {
        await press(page, 'ArrowRight', 450);
      }
      for (let i = 0; i < 4 && await luna.count() === 0; i++) {
        await press(page, 'ArrowDown', 450);
        for (let j = 0; j < 5 && await luna.count() === 0; j++) {
          await press(page, 'ArrowLeft', 400);
        }
      }
      expect(await luna.count(), 'Luna focused').toBeGreaterThan(0);
      await press(page, 'Enter', 1600);
      await page.waitForSelector('.con-colfocus', {timeout: 10_000});
      await page.waitForSelector('.con-colfocus__payrow', {timeout: 10_000});
      await page.waitForTimeout(600);

      // ── CONFIGURE: compact list, both icons, draft, next-step tag, NO panel,
      //    NO scroll — every family row (M€ included) inside the scroll box. ──
      expect(await page.locator('.con-colfocus .con-pay').count(), 'no inline panel on Configure').toBe(0);
      const rowTitles = await page.locator('.con-colfocus__payrow-title').allInnerTexts();
      expect(rowTitles.find((t) => t.includes('энергия и/или сталь')),
        `the flexible family names both sources — got ${JSON.stringify(rowTitles)}`).toBeTruthy();
      const energyRow = page.locator('.con-colfocus__payrow').filter({hasText: 'энергия и/или сталь'});
      expect(await energyRow.locator('.con-colfocus__payrow-icon').count(), 'the ⚡/🔩 icon pair on the row').toBe(2);
      expect((await energyRow.locator('.con-colfocus__payrow-next').innerText()).toUpperCase())
        .toContain('ДАЛЕЕ: СОСТАВ ОПЛАТЫ');
      const scroll = await page.evaluate(() => {
        const box = document.querySelector('.con-colfocus__configscroll');
        const inner = box?.firstElementChild;
        return box === null || box === undefined ? undefined :
          {clientH: (box as HTMLElement).clientHeight, scrollH: (inner as HTMLElement | null)?.scrollHeight ?? (box as HTMLElement).scrollHeight};
      });
      expect(scroll, 'the config scroll box exists').toBeDefined();
      expect(scroll!.scrollH, 'Configure must not scroll because of DP06').toBeLessThanOrEqual(scroll!.clientH + 2);
      const bar0 = await barText(page);
      expect(bar0).toContain('ПРОДОЛЖИТЬ К ОПЛАТЕ');
      expect(bar0).not.toContain('СОСТАВ ОПЛАТЫ');
      // A hidden dial is the forbidden shape: RB on Configure changes nothing.
      await press(page, 'KeyE', 700);
      expect(await readDraft(page, '.con-colfocus__payrow-mix')).toEqual(['3', '0']);
      await shoot(page, `${profile.tag}-colony-01-configure`);

      // ── Switching to TITANIUM drops the flexible affordances at once. ──
      await press(page, 'ArrowDown', 600);
      await press(page, 'Enter', 900);
      const payTi = await readOutcomePay(page);
      expect(payTi.map((r) => r.icon)).toEqual(['titanium']);
      const barTi = await barText(page);
      expect(barTi).toContain('ПОДТВЕРДИТЬ ТОРГОВЛЮ'); // the direct final verb
      expect(barTi).not.toContain('ПРОДОЛЖИТЬ К ОПЛАТЕ');
      await shoot(page, `${profile.tag}-colony-02-titanium`);

      // ── Back to the flexible family: the gateway returns. ──
      await press(page, 'ArrowUp', 600);
      await press(page, 'Enter', 900);
      expect(await barText(page)).toContain('ПРОДОЛЖИТЬ К ОПЛАТЕ');
      expect((await readOutcomePay(page)).map((r) => r.icon)).toEqual(['energy']);

      // ── CONFIGURE → PAYMENT (X) ──
      await press(page, 'KeyX', 1200);
      await page.waitForSelector('.con-colfocus__mixstep .con-pay', {timeout: 8_000});
      expect(await page.locator('.con-colfocus__payrow').count(), 'the family list yielded the area').toBe(0);
      const barMix = await barText(page);
      expect(barMix).toContain('СОСТАВ ОПЛАТЫ');
      expect(barMix).toContain('ПОДТВЕРДИТЬ ТОРГОВЛЮ');
      // ONE dial press moves the panel AND the right summary together.
      await press(page, 'KeyE', 800);
      const panel1 = await readPanel(page, '.con-colfocus__mixstep .con-pay');
      expect(panel1.used.steel).toBe('1');
      expect(panel1.used.energy).toBe('2');
      const pay1 = await readOutcomePay(page);
      expect(pay1.map((r) => r.icon)).toEqual(['energy', 'steel']);
      expect(pay1.find((r) => r.icon === 'steel')?.pair).toBe('500 → 499');
      expect(pay1.find((r) => r.icon === 'energy')?.pair).toBe('500 → 498');
      await shoot(page, `${profile.tag}-colony-03-mix-step`);

      // ── PAYMENT → CONFIGURE (B): family, draft and summary survive. ──
      await press(page, 'Escape', 900);
      expect(await page.locator('.con-colfocus__mixstep').count(), 'B folded the substep').toBe(0);
      await page.waitForSelector('.con-colfocus__payrow', {timeout: 6_000});
      expect(await readDraft(page, '.con-colfocus__payrow-mix'), 'the dialed draft survives B').toEqual(['2', '1']);
      expect((await readOutcomePay(page)).map((r) => r.icon)).toEqual(['energy', 'steel']);
      await shoot(page, `${profile.tag}-colony-04-back`);

      // ── RE-ENTER and RESOLVE: the ordinary trade pipeline commits. ──
      await press(page, 'KeyX', 1200);
      await page.waitForSelector('.con-colfocus__mixstep .con-pay', {timeout: 8_000});
      await press(page, 'KeyX', 2000);
      await expect.poll(async () => (await serverState(request, id)).lunaVisitor,
        {timeout: 25_000, message: 'the trade committed on the server'}).toBe(true);
      const after = await serverState(request, id);
      expect(after.energy, 'the dialed energy share was spent').toBe(498);
      expect(after.steel, 'the dialed steel share was spent').toBe(499);
      await page.waitForTimeout(3000); // the payout scene settles
      await shoot(page, `${profile.tag}-colony-05-resolved`);
    });
  });
}
