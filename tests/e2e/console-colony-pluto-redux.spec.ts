import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, cinematicBeat, press, settle, soloGameConfig} from './consoleStart';
import {seedIdentity} from './campaignFixtures';

/**
 * THE TURMOIL REDUX PLUTO on the console (docs/claude/turmoil-redux-colonies.md).
 *
 * The replacement tile pays DATA at the low track positions and CARDS at the
 * top two, and REFUSES a player with no card that can hold data — a rule of
 * the colony about the player, published by the server
 * (`PublicPlayerModel.colonyTradeBlocks` + the trade prompt's
 * `disabledColonies`). This journey asserts that every surface speaks that
 * one server reason and never guesses another («not enough resources» was
 * what the client ladder would have said on its own):
 *   · the grid TILE: a hard ✕ with the refusal, the DATA glyph at the marker,
 *     Pluto's own art under the Redux name;
 *   · the DOSSIER (X): the verdict as information, «+1 → на выбранную
 *     карту» with the honest «ресурс пропадёт» line, five data cells + two
 *     card cells on the instrument, the base tile's lore;
 *   · the trade STAGE (A): the refusal with its reason;
 *   · the lobby row's expansion chip reads «Кризис: Возвращение», never the key.
 * Evidence → screenshots/pluto-redux/.
 */

const OUT = path.resolve('screenshots', 'pluto-redux');
const REASON_RU = 'Ни одна ваша карта не примет данные с этой торговли';

function config() {
  return soloGameConfig({
    expansions: {colonies: true, turmoilRedux: true},
    // Solo deals FOUR — exactly this list; «Pluto» becomes the Redux tile.
    customColoniesList: ['Pluto', 'Luna', 'Europa', 'Callisto'],
    seed: 0.42,
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<{playerId: string, gameId: string}> {
  const created = await request.post('/api/creategame', {data: config()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {id: string, players: Array<{id: string, name: string}>};
  return {playerId: model.players[0].id, gameId: model.id};
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

test('Pluto Redux: the tile, the dossier and the stage name the refusal; the lobby chip is localized', async ({page, request}) => {
  test.setTimeout(420_000);
  const {playerId} = await createGame(request);
  // The server's own view: the Redux tile is seated, the base tile is not,
  // and the refusal is published on the viewer's model.
  const view = await (await request.get(`/api/player?id=${playerId}`)).json() as {
    game: {colonies: Array<{name: string, trackPosition: number, isActive: boolean}>},
    thisPlayer: {colonyTradeBlocks?: Array<{colony: string, reason: string}>, tableau: Array<{name: string}>},
  };
  console.log('── colonies ──', JSON.stringify(view.game.colonies));
  console.log('── colonyTradeBlocks ──', JSON.stringify(view.thisPlayer.colonyTradeBlocks));
  expect(view.game.colonies.map((c) => c.name)).toContain('Pluto Redux');
  expect(view.game.colonies.map((c) => c.name)).not.toContain('Pluto');

  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: 'Pluto Redux'});
  await settle(page);
  await openColonies(page);
  await focusTile(page, 'Pluto Redux');
  await cinematicBeat(page, 600, 'the grid settles on the focused tile');
  await shoot(page, '00-grid');

  const tile = await page.evaluate(() => {
    const el = document.querySelector('.con-coltile--focused[data-test="con-colony-Pluto Redux"]');
    const glyph = el?.querySelector('[data-colony-trade-source] .benefit-glyph');
    return {
      status: (el?.querySelector('.con-coltile__status')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      statusClass: el?.querySelector('.con-coltile__status')?.className ?? '',
      title: (el?.querySelector('.con-coltile__name, .con-coltile__title, header')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      tradeGlyphType: glyph?.getAttribute('data-bg-type') ?? '',
      tradeGlyphIcon: glyph?.querySelector('.benefit-glyph__icon')?.className ?? '',
      planetClass: el?.querySelector('.con-planet')?.className ?? '',
    };
  });
  console.log('── tile ──', JSON.stringify(tile));
  expect(tile.status, 'the tile names the server\'s refusal').toContain(REASON_RU);
  expect(tile.statusClass).toContain('con-coltile__status--blocked');
  expect(tile.tradeGlyphType, 'the trade cell draws the DATA income (ADD_RESOURCES_TO_CARD = 0) at the marker').toBe('0');
  expect(tile.tradeGlyphIcon).toContain('data');
  expect(tile.planetClass, 'the Redux tile wears Pluto\'s art').toContain('Pluto-Redux-background');

  // ── X → the dossier: the verdict names the refusal, the reward reads data → a card, lost. ──
  await page.keyboard.press('KeyX');
  await cinematicBeat(page, 2300, 'the dossier entrance + the late reveal wave');
  await shoot(page, '01-dossier');
  const dossier = await page.evaluate(() => ({
    crumb: (document.querySelector('.con-colonies .con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    verdict: (document.querySelector('.con-colinspect__act .con-colinspect__verdict')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    verdictClass: document.querySelector('.con-colinspect__act .con-colinspect__verdict')?.className ?? '',
    gains: Array.from(document.querySelectorAll('.con-colinspect__gain')).map((g) => (g.textContent ?? '').replace(/\s+/g, ' ').trim()),
    lost: (document.querySelector('.con-colinspect__lost')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    rules: Array.from(document.querySelectorAll('.con-colinspect__rules .con-colinspect__text')).map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim()),
    lore: (document.querySelector('.con-colinspect .card-zoom-lore__text')?.textContent ?? '').trim(),
    cells: Array.from(document.querySelectorAll('.con-colinspect .con-colfocus__xcell .benefit-glyph')).map((g) => g.getAttribute('data-bg-type')),
  }));
  console.log('── dossier ──', JSON.stringify(dossier, null, 2));
  expect(dossier.crumb).toMatch(/КОЛОНИИ.*ПЛУТОН.*ОСМОТР/i);
  expect(dossier.verdict, 'the dossier states the refusal as information').toContain(REASON_RU);
  expect(dossier.verdictClass).toContain('con-colinspect__verdict--no');
  expect(dossier.gains.join(' | '), 'the reward reads +1 data to the chosen card').toMatch(/\+1/);
  expect(dossier.lost.length, 'the lost line names the data that cannot land').toBeGreaterThan(3);
  expect(dossier.cells, 'the track: five data cells, two card cells').toEqual(['0', '0', '0', '0', '0', '3', '3']);
  expect(dossier.lore).toMatch(/Хароном/);

  // ── B → back; A → the stage carries the refusal with its reason. ──
  await press(page, 'Escape', 1600);
  expect(await page.locator('.con-colinspect').count(), 'B folded the dossier').toBe(0);
  await press(page, 'Enter', 2200);
  await shoot(page, '02-stage');
  const stage = await page.evaluate(() => ({
    up: document.querySelector('.con-colfocus') !== null,
    verdict: (document.querySelector('.con-colfocus__verdict')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    verdictClass: document.querySelector('.con-colfocus__verdict')?.className ?? '',
    bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  console.log('── stage ──', JSON.stringify(stage, null, 2));
  expect(stage.up, 'A entered the trade stage').toBe(true);
  expect(stage.verdict, 'the stage carries the refusal').toContain(REASON_RU);
  await press(page, 'Escape', 1200);

  // ── The lobby row's expansion chip is localized («Кризис: Возвращение»). ──
  await seedIdentity(page, 'ConsoleTester');
  await page.goto('/');
  await page.waitForSelector('.cm-menu__items', {timeout: 20_000});
  await page.click('.cm-item:has-text("Мои партии")');
  await page.waitForSelector('.cm-game', {timeout: 60_000});
  const alts = await page.evaluate(() => Array.from(document.querySelectorAll('.cm-game .cm-game__exp img')).map((i) => i.getAttribute('alt')));
  console.log('── lobby expansion chips (alt) ──', JSON.stringify(alts));
  expect(alts, 'the Turmoil Redux chip reads in Russian').toContain('Кризис: Возвращение');
  expect(alts, 'the old half-Latin name is gone').not.toContain('Кризис Redux');
  expect(alts).not.toContain('Turmoil Redux');
  await shoot(page, '03-lobby');
});
