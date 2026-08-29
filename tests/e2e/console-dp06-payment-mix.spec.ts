import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * DELTA WORKS (DP06) — the PAYMENT COMPOSITION on its two screens.
 *
 * The card lets steel substitute energy 1:1 in EXACTLY two payment contexts:
 * the standard Hydronetwork advance and the colony trade's energy family.
 * This probe drives a REAL game (testMode stock: 500 of everything, so both
 * mixes are honestly affordable) with the card PLAYED, and asserts the
 * premium composition contract on both screens:
 *
 *   · ONE canonical draft: the compact panel (steel row + auto energy row),
 *     the right «ОПЛАТА» summary and the family row all move on the SAME
 *     bumper press — no frame may show two different mixes;
 *   · the requirements row of the Hydronetwork names TAGS only — owning the
 *     resources that PAY is the payment panel's verdict, not a requirement;
 *   · the source badge names the CARD («Дельтовые сооружения»), never the
 *     module's internal name;
 *   · the family row's title admits steel («энергия и/или сталь») instead of
 *     passing the mix off as a pure energy payment;
 *   · switching to titanium/M€ clears the composition panel AND the summary's
 *     energy/steel deltas at once — no stale hint, no dead dial.
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
  units: Array<string>,
  used: Record<string, string>,
  remaining: Record<string, string>,
  paid: string,
  statusExact: boolean,
  sourceCard: string,
  steelPills: boolean,
}> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const rows = Array.from(root?.querySelectorAll('.con-payrow') ?? []);
    const used: Record<string, string> = {};
    const remaining: Record<string, string> = {};
    const units: Array<string> = [];
    for (const row of rows) {
      const unit = row.getAttribute('data-pay-unit') ?? '';
      units.push(unit);
      used[unit] = (row.querySelector('.con-payrow__used') as HTMLElement | null)?.innerText.trim() ?? '';
      remaining[unit] = (row.querySelector('.con-payrow__after') as HTMLElement | null)?.innerText.trim() ?? '';
    }
    return {
      units,
      used,
      remaining,
      paid: (root?.querySelector('.con-paystatus__paid') as HTMLElement | null)?.innerText.trim() ?? '',
      statusExact: root?.querySelector('.con-paystatus--exact') !== null,
      sourceCard: (root?.querySelector('.con-pay__source-card') as HTMLElement | null)?.innerText.trim() ?? '',
      steelPills: root?.querySelector('.con-payrow[data-pay-unit="steel"] .con-payrow__pills') !== null,
    };
  }, scope);
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

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`DP06 payment mix · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('Hydronetwork: the compact panel IS the composition, and the dial moves one draft', async ({page, request}) => {
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
      await page.waitForSelector('.con-hydro__pay .con-pay', {timeout: 10_000});
      await page.waitForTimeout(600);

      // The requirements row names TAGS only — affordability left it.
      const reqText = await page.locator('.con-hydro__reqline').innerText();
      expect(reqText, 'affordability must not live inside ТРЕБОВАНИЯ').not.toContain('У вас');

      // The composition: steel dialable (pills in place), energy auto,
      // the source badge naming the CARD.
      const before = await readPanel(page, '.con-hydro__pay .con-pay');
      expect(before.units).toEqual(['steel', 'energy']);
      expect(before.steelPills, 'the steel row carries the LB/RB pills').toBe(true);
      expect(before.sourceCard).toBe('Дельтовые сооружения');
      expect(before.statusExact, 'ОПЛАЧЕНО N/N — exact').toBe(true);
      expect(before.used.steel).toBe('0'); // energy-first default
      await shoot(page, `${profile.tag}-hydro-01-energy-first`);

      // ONE bumper press: +1 steel is −1 energy, in the same panel.
      const cost = Number(before.paid);
      expect(cost).toBeGreaterThanOrEqual(1);
      await press(page, 'KeyE', 900); // RB
      const after = await readPanel(page, '.con-hydro__pay .con-pay');
      expect(Number(after.used.steel)).toBe(1);
      expect(Number(after.used.energy)).toBe(cost - 1);
      expect(Number(after.remaining.steel)).toBe(499);
      expect(after.paid).toBe(before.paid); // the total never moves
      expect(after.statusExact).toBe(true);
      await shoot(page, `${profile.tag}-hydro-02-steel-dialed`);

      // …and back.
      await press(page, 'KeyQ', 900); // LB
      const reverted = await readPanel(page, '.con-hydro__pay .con-pay');
      expect(Number(reverted.used.steel)).toBe(0);
      expect(Number(reverted.used.energy)).toBe(cost);
    });

    test('Colonies: honest family row, live right summary, titanium clears both', async ({page, request}) => {
      test.setTimeout(420_000);
      const id = await createGameWithCards(request, [CARD], {config: CFG, seed: 0.53});
      await seedGameOverApi(request, id, {cards: [CARD], corporation: 'ThorGate', keepColony: 'Luna'});
      await playDeltaWorks(request, id);
      await openConsole(page, id, profile.query);
      await waitForBoardHome(page, 25, {keepColony: 'Luna'});

      // RT wheel → right = the colonies section; focus any tradeable colony.
      const colonies = page.locator('.con-colonies');
      for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
        await press(page, 'Period', 1100);
        await press(page, 'ArrowRight', 1400);
      }
      expect(await colonies.count(), 'the colonies section opened').toBeGreaterThan(0);
      await press(page, 'Enter', 1600); // A on the focused colony → the focus stage (trade intent)
      await page.waitForSelector('.con-colfocus', {timeout: 10_000});
      await page.waitForSelector('.con-colfocus__paymix .con-pay', {timeout: 10_000});
      await page.waitForTimeout(600);

      // The family row admits steel — never «Заплатить 3 энергии» over a mix.
      const rowTitles = await page.locator('.con-colfocus__payrow-title').allInnerTexts();
      const energyRow = rowTitles.find((t) => t.includes('энергия и/или сталь'));
      expect(energyRow, `the energy family names both sources — got ${JSON.stringify(rowTitles)}`).toBeTruthy();

      // Energy-first default: composition 3 energy + 0 steel, summary −3 ⚡.
      const panel0 = await readPanel(page, '.con-colfocus__paymix .con-pay');
      expect(panel0.units).toEqual(['steel', 'energy']);
      expect(panel0.sourceCard).toBe('Дельтовые сооружения');
      const cost = Number(panel0.paid);
      expect(cost).toBeGreaterThanOrEqual(1);
      expect(Number(panel0.used.energy)).toBe(cost);
      const pay0 = await readOutcomePay(page);
      expect(pay0.map((r) => r.icon)).toEqual(['energy']);
      expect(pay0[0].amount).toBe(`−${cost}`);
      expect(pay0[0].pair).toBe(`500 → ${500 - cost}`);
      await shoot(page, `${profile.tag}-colony-01-energy-first`);

      // ONE dial press: the panel AND the right summary move together.
      await press(page, 'KeyE', 900); // RB → +1 steel
      const panel1 = await readPanel(page, '.con-colfocus__paymix .con-pay');
      expect(Number(panel1.used.steel)).toBe(1);
      expect(Number(panel1.used.energy)).toBe(cost - 1);
      const pay1 = await readOutcomePay(page);
      expect(pay1.map((r) => r.icon)).toEqual(cost - 1 > 0 ? ['energy', 'steel'] : ['steel']);
      const steelRow = pay1.find((r) => r.icon === 'steel');
      expect(steelRow?.amount).toBe('−1');
      expect(steelRow?.pair).toBe('500 → 499');
      if (cost - 1 > 0) {
        const energySummary = pay1.find((r) => r.icon === 'energy');
        expect(energySummary?.amount).toBe(`−${cost - 1}`);
        expect(energySummary?.pair).toBe(`500 → ${500 - (cost - 1)}`);
      }
      // The bar advertises the dial while it works.
      const barText = (await page.locator('.con-cmdbar').innerText()).replace(/\s+/g, ' ');
      expect(barText.toUpperCase()).toContain('СОСТАВ ОПЛАТЫ');
      await shoot(page, `${profile.tag}-colony-02-mix-dialed`);

      // Switch to the titanium family: the composition panel folds, the
      // summary clears BOTH energy/steel deltas, the dial hint drops, and
      // the dial itself goes dead.
      await press(page, 'ArrowDown', 700);
      await press(page, 'Enter', 900);
      expect(await page.locator('.con-colfocus__paymix').count(), 'the mix panel folded').toBe(0);
      const payTi = await readOutcomePay(page);
      expect(payTi.map((r) => r.icon)).toEqual(['titanium']);
      const barTi = (await page.locator('.con-cmdbar').innerText()).replace(/\s+/g, ' ');
      expect(barTi.toUpperCase()).not.toContain('СОСТАВ ОПЛАТЫ');
      await press(page, 'KeyE', 700); // a dead dial must change nothing
      expect((await readOutcomePay(page)).map((r) => r.icon)).toEqual(['titanium']);
      await shoot(page, `${profile.tag}-colony-03-titanium`);

      // Back to the energy family: the draft survives (UI = payload policy),
      // and the summary returns to the SAME dialed mix.
      await press(page, 'ArrowUp', 700);
      await press(page, 'Enter', 900);
      await page.waitForSelector('.con-colfocus__paymix .con-pay', {timeout: 6_000});
      const panelBack = await readPanel(page, '.con-colfocus__paymix .con-pay');
      expect(Number(panelBack.used.steel)).toBe(1);
      const payBack = await readOutcomePay(page);
      expect(payBack.find((r) => r.icon === 'steel')?.amount).toBe('−1');
      await shoot(page, `${profile.tag}-colony-04-back-to-energy`);
    });
  });
}
