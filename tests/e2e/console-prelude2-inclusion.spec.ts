import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {createGameWithCards, fetchPlayerModel, press, reloadConsole, settle, soloGameConfig} from './consoleStart';
import {campaignBase, seedIdentity} from './campaignFixtures';
import {CardName} from '../../src/common/cards/CardName';

/**
 * PRELUDE 2 — THE FULL INCLUSION (docs/claude/prompts/prelude2-pc05-spire-and-full-inclusion.md, stage II, ledger GX).
 * The expansion is in the premium scope WHOLE: the creator offers it, the deck meter counts it, the test mode's picker
 * deals it, MarsBot plays it.
 *
 *   A · the creator: the plate «Пролог 2» right after «Пролог», ON by default (the owner, 2026-11-06), its chip «требует Пролог»; with Prelude
 *       off the launch is flagged by name; with the bot seated no conflict; the choice persists; the deck fits (tv4k + deck).
 *   B · the deck meter: the plate's own contribution chips, the preludes total grows when it is switched on.
 *   C · the test mode's picker: the module «Пролог 2», a gated card marked and refused, a corporation, a prelude and a
 *       project picked → the launch → on the table.
 *   D · a bot table created through the creator with Prelude 2 (the test mode deals the whole deck): the deal carries
 *       Prelude 2 cards (the CLASS — the creator's deal is not seeded), the bot is seated and its corporation never a
 *       twin of the human's; F · a reload keeps the option.
 *   E · a Redux table with Prelude 2: Corridors of Power is never dealt (TRP0 is).
 *
 * Frames: `screenshots/prelude2-inclusion/`.
 */

const OUT = path.resolve('screenshots', 'prelude2-inclusion');
const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
// A second profile ONLY for A's budget claim: nine plates in the expansions deck must fit the handheld's stage too.
const DECK = {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'} as const;

const P2_CORPS: ReadonlyArray<string> = [
  CardName.NIRGAL_ENTERPRISES, CardName.PALLADIN_SHIPPING, CardName.SAGITTA_FRONTIER_SERVICES, CardName.ECOTEC, CardName.SPIRE,
];
/** The set (the 54 names pinned by `tests/cards/prelude2/Prelude2Manifest.spec.ts`) — the deal's CLASS reads it. */
const P2_CARDS: ReadonlySet<string> = new Set<string>([
  CardName.ISHTAR_EXPEDITION, CardName.SUMMIT_LOGISTICS, CardName.CERES_TECH_MARKET, CardName.RED_APPEASEMENT,
  CardName.L1_TRADE_TERMINAL, CardName.CLOUD_TOURISM, CardName.GHG_SHIPMENT, CardName.SPONSORING_NATION,
  CardName.COLONIAL_REPRESENTATION, CardName.ENVOYS_FROM_VENUS, CardName.COLONIAL_ENVOYS, CardName.SPECIAL_PERMIT,
  CardName.FLOATING_REFINERY, CardName.FRONTIER_TOWN, CardName.JOVIAN_ENVOYS, CardName.MICROGRAVITY_NUTRITION,
  CardName.SOIL_STUDIES, CardName.STRATOSPHERIC_EXPEDITION, CardName.UNEXPECTED_APPLICATION, CardName.VENUS_ALLIES,
  CardName.VENUS_ORBITAL_SURVEY, CardName.VENUS_SHUTTLES, CardName.VENUS_TRADE_HUB, CardName.WG_PROJECT,
  CardName.APPLIED_SCIENCE, CardName.ATMOSPHERIC_ENHANCERS, CardName.BOARD_OF_DIRECTORS, CardName.COLONY_TRADE_HUB,
  CardName.CORRIDORS_OF_POWER, CardName.EARLY_COLONIZATION, CardName.FLOATING_TRADE_HUB, CardName.FOCUSED_ORGANIZATION,
  CardName.HIGH_CIRCLES, CardName.INDUSTRIAL_COMPLEX, CardName.MAIN_BELT_ASTEROIDS, CardName.NOBEL_PRIZE,
  CardName.OLD_MINING_COLONY, CardName.PLANETARY_ALLIANCE, CardName.PRESERVATION_PROGRAM, CardName.PROJECT_EDEN,
  CardName.RECESSION, CardName.RISE_TO_POWER, CardName.SOIL_BACTERIA, CardName.SPACE_LANES,
  CardName.SUITABLE_INFRASTRUCTURE, CardName.TERRAFORMING_DEAL, CardName.VENUS_CONTRACT, CardName.VENUS_L1_SHADE,
  CardName.WORLD_GOVERNMENT_ADVISOR, ...P2_CORPS,
]);

type Settings = Record<string, unknown>;

async function shoot(page: Page, profile: string, name: string): Promise<void> {
  const dir = path.join(OUT, profile);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** Seed the creator's saved setup ONCE (the creator's own save must win on a later visit). */
async function seedSettings(page: Page, settings: Settings): Promise<void> {
  await page.addInitScript((s) => {
    if (window.localStorage.getItem('tm_last_game_settings') === null) {
      window.localStorage.setItem('tm_last_game_settings', JSON.stringify(s));
    }
  }, settings);
}

async function toCreator(page: Page, query: string): Promise<void> {
  await page.goto(`${campaignBase()}/?x=1${query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  for (let i = 0; i < 12 && await page.locator('.cm-item--cursor').getAttribute('data-menu-item') !== 'create'; i++) {
    await press(page, 'ArrowDown', 120);
  }
  await expect(page.locator('.cm-item--cursor')).toHaveAttribute('data-menu-item', 'create');
  await press(page, 'Enter', 300);
  await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
  await press(page, 'Enter', 600);
  await page.waitForSelector('.cm-crew', {timeout: 30_000});
}

/** RB until the deck whose body matches `body` stands. */
async function toDeck(page: Page, body: string): Promise<void> {
  for (let i = 0; i < 6 && await page.locator(body).count() === 0; i++) {
    await press(page, 'KeyE', 400);
  }
  await page.waitForSelector(body, {timeout: 15_000});
}

/** The expansions deck's cursor onto the plate `id` — walked by GEOMETRY (the grid's columns differ by profile). */
async function cursorToExpansion(page: Page, id: string): Promise<void> {
  const plate = page.locator(`.cm-exp[data-exp="${id}"]`);
  for (let i = 0; i < 16; i++) {
    const step = await page.evaluate((target) => {
      const want = document.querySelector(`.cm-exp[data-exp="${target}"]`)?.getBoundingClientRect();
      const at = document.querySelector('.cm-exp--cursor')?.getBoundingClientRect();
      if (want === undefined || at === undefined) {
        return 'none';
      }
      if (Math.abs(want.top - at.top) < 4 && Math.abs(want.left - at.left) < 4) {
        return 'here';
      }
      if (want.top > at.bottom - 4) {
        return 'ArrowDown';
      }
      if (want.bottom < at.top + 4) {
        return 'ArrowUp';
      }
      return want.left > at.left ? 'ArrowRight' : 'ArrowLeft';
    }, id);
    if (step === 'here' || step === 'none') {
      break;
    }
    await press(page, step, 180);
  }
  await expect(plate, `the cursor on «${id}»`).toHaveClass(/cm-exp--cursor/);
}

const plateOn = (page: Page, id: string) => page.locator(`.cm-exp[data-exp="${id}"]`).evaluate((el) => el.classList.contains('cm-exp--on'));

async function setExpansion(page: Page, id: string, on: boolean): Promise<void> {
  if (await plateOn(page, id) === on) {
    return;
  }
  await cursorToExpansion(page, id);
  await press(page, 'Enter', 500);
  await expect.poll(() => plateOn(page, id), {message: `«${id}» ${on ? 'on' : 'off'}`, timeout: 10_000}).toBe(on);
}

/** The deck body fits its scroll area — nine plates, never a scroll target. */
async function deckFits(page: Page): Promise<{fits: boolean, why: string}> {
  return page.evaluate(() => {
    const viewport = document.querySelector('.cm-create__deck .con-scroll-area__viewport') ?? document.querySelector('.cm-create__deck');
    if (viewport === null) {
      return {fits: false, why: 'no deck'};
    }
    const el = viewport as HTMLElement;
    return {fits: el.scrollHeight <= el.clientHeight + 1, why: `${el.scrollHeight} > ${el.clientHeight}`};
  });
}

/** X → the launch plate → A; the creation's request body. */
async function launch(page: Page): Promise<Record<string, unknown>> {
  await press(page, 'KeyX', 800);
  await expect(page.locator('.cm-overlay--launch'), 'the launch plate').toBeVisible({timeout: 15_000});
  const created = page.waitForRequest((r) => r.url().includes('/api/creategame') && r.method() === 'POST', {timeout: 60_000});
  await press(page, 'Enter', 400);
  return (await created).postDataJSON() as Record<string, unknown>;
}

/** The game the launch opened — the player id off the page's URL. */
async function launchedPlayer(page: Page): Promise<string> {
  await page.waitForURL(/[?&]id=p/, {timeout: 60_000});
  const id = new URL(page.url()).searchParams.get('id');
  expect(id, 'the launch opened a player view').toBeTruthy();
  return id!;
}

type Wire = {
  dealtCorporationCards?: Array<{name: string}>, dealtPreludeCards?: Array<{name: string}>, dealtProjectCards?: Array<{name: string}>,
  game: {gameOptions: {expansions: Record<string, boolean>}, automa?: {corporation?: {original: string}}},
};
const wireOf = async (request: APIRequestContext, id: string) => await fetchPlayerModel(request, id) as unknown as Wire;

for (const profile of [TV, DECK]) {
  test.describe(`Prelude 2 · the full inclusion · the creator · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test(`A · the plate after «Пролог», ON by default, its chip, the named block, no bot conflict, persisted, the deck fits (${profile.id})`, async ({page}) => {
      test.setTimeout(300_000);
      await seedIdentity(page, 'Alice');
      await seedSettings(page, {gameMode: 'marsbot', players: [{name: 'Alice', color: 'blue'}], rules: {randomMilestonesAwards: false, randomBoardTiles: false}});
      await toCreator(page, profile.query);
      await toDeck(page, '.cm-expansions');
      await settle(page, {timeoutMs: 15_000}).catch(() => undefined);
      const ids = await page.locator('.cm-exp[data-exp]').evaluateAll((els) => els.map((e) => e.getAttribute('data-exp')));
      expect(ids.indexOf('prelude2'), 'the plate stands right after Prelude').toBe(ids.indexOf('prelude') + 1);
      expect(await plateOn(page, 'prelude2'), 'ON by default (the owner, 2026-11-06)').toBe(true);
      await expect(page.locator('.cm-exp[data-exp="prelude2"] [data-exp-needs="prelude"]'), 'its chip names Prelude').toHaveCount(1);
      await expect(page.locator('.cm-exp[data-exp="prelude2"] .cm-exp__name')).toHaveText('Пролог 2');
      const fit = await deckFits(page);
      expect(fit.fits, `nine plates fit the deck (${fit.why})`).toBe(true);
      await shoot(page, profile.id, 'a-01-expansions-default');

      if (profile.id === 'tv4k') {
        // ON with the bot seated: no conflict. Prelude off: the chip unmet, the deck flagged.
        await setExpansion(page, 'prelude', true);
        await setExpansion(page, 'prelude2', true);
        await expect(page.locator('.cm-exp[data-exp="prelude2"]'), 'no MarsBot conflict').not.toHaveClass(/cm-exp--conflict/);
        await setExpansion(page, 'prelude', false);
        await expect(page.locator('.cm-exp[data-exp="prelude2"] [data-exp-needs="prelude"]')).toHaveAttribute('data-exp-needs-met', 'no');
        await expect(page.locator('.cm-tabs__tab--flagged'), 'the expansions deck is flagged').toHaveCount(1);
        await shoot(page, profile.id, 'a-02-prelude-off-blocked');
        await setExpansion(page, 'prelude', true);
        await expect(page.locator('.cm-tabs__tab--flagged')).toHaveCount(0);
        await shoot(page, profile.id, 'a-03-on');
        // Persisted: the setup is saved with the launch, and the next visit reads it back.
        const body = await launch(page);
        expect((body.expansions as Record<string, boolean>).prelude2, 'the creation sends Prelude 2').toBe(true);
        expect(body.automa, 'with MarsBot').toBeTruthy();
        await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('tm_last_game_settings') ?? '{}').selectedExpansions?.prelude2),
          {message: 'the setup is saved with Prelude 2', timeout: 30_000}).toBe(true);
        await toCreator(page, profile.query);
        await toDeck(page, '.cm-expansions');
        expect(await plateOn(page, 'prelude2'), 'remembered').toBe(true);
      }
    });
  });
}

test.describe('Prelude 2 · the full inclusion · the table · tv4k', () => {
  test.use({viewport: TV.viewport, deviceScaleFactor: 1, screen: TV.viewport});

  test('B · the deck meter: the plate prints its contribution, the preludes total grows when it is on', async ({page}) => {
    test.setTimeout(240_000);
    await seedIdentity(page, 'Alice');
    await seedSettings(page, {gameMode: 'marsbot', players: [{name: 'Alice', color: 'blue'}], selectedExpansions: {corpera: true, prelude: true, venus: true, colonies: true, prelude2: false}});
    await toCreator(page, TV.query);
    await toDeck(page, '.cm-expansions');
    const total = async (tile: string) => Number(await page.locator(`[data-deck-tile="${tile}"]`).first().getAttribute('data-deck-total') ?? '0');
    await expect.poll(() => total('preludes'), {message: 'the meter counted', timeout: 30_000}).toBeGreaterThan(0);
    const chips = async () => page.locator('[data-exp-chips="prelude2"] [data-exp-chip]').evaluateAll((els) =>
      Object.fromEntries(els.map((e) => [e.getAttribute('data-exp-chip'), Number(e.getAttribute('data-exp-chip-amount'))])));
    await expect.poll(async () => Object.keys(await chips()).length, {message: 'the OFF plate prints what it would add', timeout: 30_000}).toBeGreaterThan(0);
    const off = {preludes: await total('preludes'), projects: await total('projects'), chips: await chips()};
    await setExpansion(page, 'prelude2', true);
    await expect.poll(() => total('preludes'), {message: 'the preludes deck grows by Prelude 2', timeout: 30_000}).toBeGreaterThan(off.preludes);
    const on = {preludes: await total('preludes'), projects: await total('projects')};
    await shoot(page, TV.id, 'b-meter');
    fs.mkdirSync(path.join(OUT, TV.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, TV.id, 'b-meter.txt'), JSON.stringify({off, on}, null, 1));
    expect(on.projects, 'its gated projects join with Venus + Colonies on').toBeGreaterThan(off.projects);
  });

  test('C · the test mode\'s picker: the module «Пролог 2», a gated card refused by name, a corporation, a prelude and a project picked → on the table', async ({page, request}) => {
    test.setTimeout(360_000);
    await seedIdentity(page, 'admin');
    await seedSettings(page, {
      gameMode: 'marsbot', players: [{name: 'admin', color: 'blue'}],
      selectedExpansions: {corpera: true, prelude: true, prelude2: true, venus: true, colonies: false},
      rules: {testMode: true, randomMilestonesAwards: false, randomBoardTiles: false},
    });
    await toCreator(page, TV.query);
    await toDeck(page, '.cm-rules');
    const dev = page.locator('.cm-rule--sub');
    await expect(dev, 'the DEV row under the test mode').toHaveCount(1, {timeout: 15_000});
    for (let i = 0; i < 14 && !await dev.evaluate((el) => el.classList.contains('cm-row--cursor')); i++) {
      await press(page, 'ArrowDown', 150);
    }
    await press(page, 'Enter', 600);
    await page.waitForSelector('.cm-devcards', {timeout: 15_000});
    await press(page, 'Enter', 600); // «＋ Добавить карту» → the modules
    const module = page.locator('.cm-drow--module', {hasText: 'Пролог 2'});
    await expect(module, 'the module «Пролог 2»').toHaveCount(1, {timeout: 15_000});
    for (let i = 0; i < 20 && !await module.evaluate((el) => el.classList.contains('cm-drow--cursor')); i++) {
      await press(page, 'ArrowDown', 120);
    }
    await press(page, 'Enter', 600);
    const rowNamed = (name: string) => page.locator('.cm-drow', {has: page.locator('.cm-drow__name', {hasText: new RegExp(`^${name}$`)})});
    const pick = async (name: string) => {
      const row = rowNamed(name);
      await expect(row, name).toHaveCount(1, {timeout: 15_000});
      for (let i = 0; i < 70 && !await row.evaluate((el) => el.classList.contains('cm-drow--cursor')); i++) {
        await press(page, 'ArrowDown', 90);
      }
      await press(page, 'Enter', 400);
      return row;
    };
    // A GATED card (Colonies off): shown, marked, refused.
    const ceres = await pick('Технорынок Цереры');
    await expect(ceres, 'the gated card names its module').toHaveAttribute('data-dev-gate', 'colonies');
    await expect(ceres).not.toHaveClass(/cm-drow--chosen/);
    await shoot(page, TV.id, 'c-01-gated');
    for (let i = 0; i < 80; i++) {
      await press(page, 'ArrowUp', 60);
    }
    await expect(await pick('Spire')).toHaveClass(/cm-drow--chosen/);
    await expect(await pick('Нобелевская премия')).toHaveClass(/cm-drow--chosen/);
    await expect(await pick('Экспедиция Иштар')).toHaveClass(/cm-drow--chosen/);
    await shoot(page, TV.id, 'c-02-picked');
    for (let i = 0; i < 3 && await page.locator('.cm-devcards').count() > 0; i++) {
      await press(page, 'Escape', 500);
    }
    const body = await launch(page);
    expect(body.customCorporationsList, 'the corporation rides the creation').toEqual(expect.arrayContaining(['Spire']));
    expect(body.customPreludes).toEqual(expect.arrayContaining(['Nobel Prize']));
    expect(body.customProjectCards).toEqual(expect.arrayContaining(['Ishtar Expedition']));
    const id = await launchedPlayer(page);
    const wire = await wireOf(request, id);
    expect((wire.dealtCorporationCards ?? []).map((c) => c.name), 'Spire dealt').toContain('Spire');
    expect((wire.dealtPreludeCards ?? []).map((c) => c.name), 'Nobel Prize dealt').toContain('Nobel Prize');
    expect((wire.dealtProjectCards ?? []).map((c) => c.name), 'Ishtar Expedition dealt').toContain('Ishtar Expedition');
    expect(wire.game.gameOptions.expansions.prelude2, 'the table plays Prelude 2').toBe(true);
  });

  test('D · a bot table through the creator, the test mode dealing the whole deck: Prelude 2 cards in the deal, the bot seated; F · a reload keeps the option', async ({page, request}) => {
    test.setTimeout(300_000);
    await seedIdentity(page, 'admin');
    await seedSettings(page, {
      gameMode: 'marsbot', players: [{name: 'admin', color: 'blue'}],
      selectedExpansions: {corpera: true, prelude: true, prelude2: true, venus: true, colonies: true},
      rules: {testMode: true, randomMilestonesAwards: false, randomBoardTiles: false},
    });
    await toCreator(page, TV.query);
    const body = await launch(page);
    expect((body.expansions as Record<string, boolean>).prelude2).toBe(true);
    expect(body.automa, 'MarsBot is seated').toBeTruthy();
    const id = await launchedPlayer(page);
    const wire = await wireOf(request, id);
    const dealt = [...(wire.dealtCorporationCards ?? []), ...(wire.dealtPreludeCards ?? []), ...(wire.dealtProjectCards ?? [])].map((c) => c.name);
    const p2 = dealt.filter((name) => P2_CARDS.has(name));
    fs.mkdirSync(path.join(OUT, TV.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, TV.id, 'd-deal.txt'), `dealt ${dealt.length}\nprelude2 ${p2.join(', ')}`);
    // THE CLASS, never a card (the creator's deal is not seeded): 8 corporations + 10 preludes + 20 projects from decks
    // that hold the set — a Prelude 2 corporation, prelude or project among them (P(none) < 0.1 %).
    expect(wire.game.gameOptions.expansions.prelude2, 'the table plays Prelude 2').toBe(true);
    expect(p2.length, `a Prelude 2 card in the deal of ${dealt.length}`).toBeGreaterThan(0);
    // The bot's corporation is drawn AFTER the human's pick — the collision by `original` is pinned by the engine
    // specs (`AutomaPrelude2.spec`, each Prelude 2 corporation's MarsBot block), not by this deal.
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await shoot(page, TV.id, 'd-01-start');
    // F · a reload keeps the option.
    await reloadConsole(page);
    expect((await wireOf(request, id)).game.gameOptions.expansions.prelude2, 'the option survives a reload').toBe(true);
  });

  test('E · a Redux table with Prelude 2 and MarsBot: created, the Parliament standing, Corridors of Power never dealt', async ({request}) => {
    test.setTimeout(120_000);
    // The whole prelude deck dealt over seeded tables (the test mode: ten each) — the replaced classic is in none.
    for (const seed of [0.11, 0.37, 0.73]) {
      const id = await createGameWithCards(request, [], {config: soloGameConfig({
        automa: {difficulty: 'normal'}, testMode: true, seed,
        expansions: {corpera: true, prelude: true, prelude2: true, venus: true, colonies: true, turmoilRedux: true},
      })});
      const wire = await wireOf(request, id) as Wire & {game: {parliament?: unknown}};
      expect(wire.game.gameOptions.expansions.prelude2, `seed ${seed}: Prelude 2 on`).toBe(true);
      expect(wire.game.parliament, `seed ${seed}: the Parliament stands`).toBeTruthy();
      expect((wire.dealtPreludeCards ?? []).map((c) => c.name), `seed ${seed}: never the replaced classic`).not.toContain(CardName.CORRIDORS_OF_POWER);
    }
  });
});
