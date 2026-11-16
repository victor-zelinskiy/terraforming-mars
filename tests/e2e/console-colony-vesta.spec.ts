import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, bootSeededGame, press, settle, soloGameConfig, walkFocusUntil} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';
import {armLeakWitness, strandedReports, PARLIAMENT_PRESETS} from './parliamentDrive';
import {seedIdentity} from './campaignFixtures';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';

/**
 * THE TURMOIL REDUX VESTA on the console (docs/claude/turmoil-redux-colonies.md § Vesta).
 *
 * The ADDITION tile pays «N mechs, asteroids OR fighters onto any card» — the
 * first colony whose card benefit spans SEVERAL kinds — and REFUSES a player
 * with no card that can hold any of them, at EVERY position. Three journeys:
 *
 *  1. THE READING (no holder). The grid tile draws the three-icon unit joined
 *     by «или» on its trade cell and a hard ✕ with the server's refusal; the
 *     dossier (X) states the verdict, the three printed rules, the lore, and
 *     seven instrument cells each carrying the same three-icon unit inside
 *     its own box; the stage (A) carries the refusal; the lobby row's
 *     expansion chip reads «Кризис: Возвращение» (the owner's 2026-09-29
 *     rename), never «Кризис Redux».
 *  2. THE TRADE (fixture `vesta-trade`: two holders of DIFFERENT kinds). The
 *     target step lists both cards with their OWN icons; the player picks the
 *     asteroid holder; the chip flies as an ASTEROID — the chosen card's kind,
 *     never the first of the tile's list — and lands on the standing card; the
 *     server holds 2 asteroids on it and nothing on the fighter card.
 *  3. THE CELLS at 4K: the three-icon unit stays inside every cell's box on the
 *     TV profile too (the `__xcell-glyph--multi` box opens for the row).
 * Evidence → screenshots/vesta/.
 */

const OUT = path.resolve('screenshots', 'vesta');
const VESTA = 'Vesta';
const REASON_RU = 'Ни одна ваша карта не примет мехи, астероиды или истребители с этой торговли';
const EXPANSION_RU = 'Кризис: Возвращение';
const TARGET = 'Asteroid Hollowing';
const OTHER = 'Security Fleet';

function config() {
  return soloGameConfig({
    expansions: {colonies: true, turmoilRedux: true},
    // Solo deals FOUR — exactly this list; Vesta is an ADDITION (no base twin, no Venus Next needed).
    customColoniesList: [VESTA, 'Luna', 'Europa', 'Callisto'],
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type ServerView = {
  game: {colonies: Array<{name: string, trackPosition: number, isActive: boolean}>},
  thisPlayer: {colonyTradeBlocks?: Array<{colony: string, reason: string}>, tableau: Array<{name: string, resources?: number}>},
};

const serverView = async (request: APIRequestContext, playerId: string): Promise<ServerView> =>
  await (await request.get(`/api/player?id=${playerId}`)).json() as ServerView;

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: config()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  await expect.poll(() => colonies.count(), {message: 'colonies section did not open'}).toBeGreaterThan(0);
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
  await expect.poll(() => focused.count(), {message: `could not focus ${target}`}).toBeGreaterThan(0);
}

/**
 * The kinds a glyph draws, in DOM order (the bare icon classes the guard pins), and the joints between them —
 * the WORD «или» in the reading register (the dossier's rule line, «ВЫ ПОЛУЧИТЕ»), a drawn HYPHEN in the
 * compact one (a track cell, a tile's trade cell: the word's width goes to the icons). Read page-side in every probe.
 */
type Unit = {kinds: Array<string>, ors: number, dashes: number, multi: boolean};
const KINDS = ['mech', 'asteroid', 'fighter'];
/** The compact unit (a track cell, a tile's trade cell). */
const COMPACT_UNIT: Unit = {kinds: KINDS, ors: 0, dashes: 2, multi: true};

type CellFit = {index: number, type: string, unit: Unit, qty: string, cut: {x: number, y: number}, inside: boolean, cellW: number, unitW: number, iconPx: number};

/**
 * Every instrument cell under `scope` (the dossier's by default, the trade stage's with `.con-colfocus`): its
 * unit, its box, whether the unit and the quantity lie INSIDE the cell, and `iconPx` — the SMALLEST drawn
 * sprite of its unit (min of each icon box's two sides: the sprite is `background-size: contain`).
 */
async function instrumentCells(page: Page, scope = '.con-colinspect'): Promise<Array<CellFit>> {
  return page.evaluate(({kinds, scope}) => {
    const within = (inner: DOMRect, outer: DOMRect, tol = 1) =>
      inner.left >= outer.left - tol && inner.right <= outer.right + tol && inner.top >= outer.top - tol && inner.bottom <= outer.bottom + tol;
    return Array.from(document.querySelectorAll<HTMLElement>(`${scope} .con-colfocus__xcell`)).map((cell, index) => {
      const box = cell.getBoundingClientRect();
      const glyphBox = cell.querySelector<HTMLElement>('.con-colfocus__xcell-glyph');
      const glyph = glyphBox?.querySelector('.benefit-glyph') ?? null;
      const qty = cell.querySelector<HTMLElement>('.con-colfocus__xcell-qty');
      const icons = Array.from(glyphBox?.querySelectorAll<HTMLElement>('.benefit-glyph__icon') ?? []);
      const parts = [glyphBox, qty, ...icons].filter((el): el is HTMLElement => el !== null);
      // A sprite inside the CELL can still be clipped by its own glyph box (`overflow: hidden`).
      const glyphRect = glyphBox?.getBoundingClientRect();
      return {
        index,
        type: glyph?.getAttribute('data-bg-type') ?? '',
        unit: {
          kinds: Array.from(glyph?.querySelectorAll('.benefit-glyph__icon') ?? []).map((i) => kinds.find((k) => i.classList.contains(k)) ?? '?'),
          ors: glyph?.querySelectorAll('.benefit-glyph__or').length ?? 0,
          dashes: glyph?.querySelectorAll('.benefit-glyph__dash').length ?? 0,
          multi: glyph?.classList.contains('benefit-glyph--multi') ?? false,
        },
        qty: (qty?.textContent ?? '').trim(),
        cut: {x: cell.scrollWidth - cell.clientWidth, y: cell.scrollHeight - cell.clientHeight},
        inside: parts.every((el) => within(el.getBoundingClientRect(), box)) &&
          glyphRect !== undefined && icons.every((el) => within(el.getBoundingClientRect(), glyphRect)),
        // DIAGNOSTIC: the cell's box against the unit's row (what a cut is made of).
        cellW: Math.round(box.width * 10) / 10,
        unitW: Math.round((glyph?.getBoundingClientRect().width ?? 0) * 10) / 10,
        iconPx: Math.round(Math.min(...icons.map((i) => {
          const r = i.getBoundingClientRect();
          return Math.min(r.width, r.height);
        })) * 10) / 10,
      };
    });
  }, {kinds: KINDS, scope});
}

/**
 * THE CELLS READ: every cell draws the compact unit, inside its own box, and every sprite of it is at least
 * `minIconPx` — the floor that makes three kinds legible (the 14 px row shipped was «вообще не читабельные»,
 * owner 2026-09-29). (The marker rail's groove deliberately overhangs each cell sideways by .35rem to read as
 * ONE continuous rail — `__xcell-rail::before` — so the WIDTH is judged by the content parts, never by the
 * cell's scroll box.)
 */
function expectReadableCells(cells: ReadonlyArray<CellFit>, minIconPx: number, where: string): void {
  expect(cells.length, `${where}: seven track cells`).toBe(7);
  for (const cell of cells) {
    const at = `${where} cell ${cell.index + 1}`;
    expect(cell.unit, `${at} draws the three-kind unit joined by hyphens`).toEqual(COMPACT_UNIT);
    expect(cell.cut.y, `${at} is not cut (height)`).toBeLessThanOrEqual(1);
    expect(cell.inside, `${at}: the unit, its every sprite and the quantity lie inside the cell's box`).toBe(true);
    expect(cell.unitW, `${at}: the three-kind row is narrower than the cell`).toBeLessThan(cell.cellW);
    expect(cell.iconPx, `${at}: every sprite reads (≥ ${minIconPx} px; the cell is ${cell.cellW} px)`).toBeGreaterThanOrEqual(minIconPx);
  }
}

/** The tile's trade cell: its unit, its smallest sprite, a one-kind sibling tile's sprite, and whether the label keeps its word. */
type TileRead = {visible: boolean, unit: Unit, iconPx: number, siblingIconPx: number, label: {client: number, scroll: number}, cut: {x: number, y: number}};
async function readTile(page: Page): Promise<TileRead> {
  return page.evaluate((kinds) => {
    const el = document.querySelector<HTMLElement>('[data-test="con-colony-Vesta"]');
    const cell = el?.querySelector<HTMLElement>('.con-coltile__cell--trade') ?? null;
    const glyph = el?.querySelector('[data-colony-trade-source] .benefit-glyph');
    const side = (i: Element) => {
      const r = i.getBoundingClientRect();
      return Math.min(r.width, r.height);
    };
    const icons = Array.from(glyph?.querySelectorAll('.benefit-glyph__icon') ?? []);
    // A ONE-kind sibling's trade icon — what «readable on this tile» means (Europa / Luna / Callisto).
    const siblings = Array.from(document.querySelectorAll('[data-test^="con-colony-"]:not([data-test="con-colony-Vesta"]) .con-coltile__cell--trade .benefit-glyph__icon'));
    const label = el?.querySelector<HTMLElement>('.con-coltile__cell--trade .con-coltile__cell-label');
    const valueRect = el?.querySelector('.con-coltile__cell--trade .con-coltile__cell-value')?.getBoundingClientRect();
    const within = (inner: DOMRect, outer: DOMRect, tol = 1) =>
      inner.left >= outer.left - tol && inner.right <= outer.right + tol && inner.top >= outer.top - tol && inner.bottom <= outer.bottom + tol;
    return {
      visible: valueRect !== undefined && cell !== null && icons.every((i) => within(i.getBoundingClientRect(), valueRect) && within(i.getBoundingClientRect(), cell.getBoundingClientRect())),
      unit: {
        kinds: icons.map((i) => kinds.find((k) => i.classList.contains(k)) ?? '?'),
        ors: glyph?.querySelectorAll('.benefit-glyph__or').length ?? 0,
        dashes: glyph?.querySelectorAll('.benefit-glyph__dash').length ?? 0,
        multi: glyph?.classList.contains('benefit-glyph--multi') ?? false,
      },
      iconPx: Math.round(Math.min(...icons.map(side)) * 10) / 10,
      siblingIconPx: Math.round(Math.max(0, ...siblings.map(side)) * 10) / 10,
      label: {client: label?.clientWidth ?? 0, scroll: label?.scrollWidth ?? 0},
      cut: cell === null ? {x: -1, y: -1} : {x: cell.scrollWidth - cell.clientWidth, y: cell.scrollHeight - cell.clientHeight},
    };
  }, KINDS);
}

async function focusedRowText(page: Page): Promise<string> {
  return page.evaluate(() => (document.querySelector('.con-colfocus__steprow--focused')?.textContent ?? '').toUpperCase());
}

async function focusTargetRow(page: Page): Promise<void> {
  for (let i = 0; i < 10 && !(await focusedRowText(page)).includes('ЦЕЛЬ'); i++) {
    await press(page, 'ArrowDown', 350);
  }
  await expect.poll(() => focusedRowText(page), {message: 'the target decision row must take focus'}).toContain('ЦЕЛЬ');
}

const focusedCandidate = (page: Page): Promise<string> => page.evaluate(() =>
  document.querySelector('.con-ptsel__slot--focused .pcard')?.closest('[data-ptsel-cell]')?.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');

/** The focused candidate's reading: the kinds its rail / tag icons wear, and the rail's text (`| tag`). */
async function focusedReading(page: Page): Promise<{kinds: Array<string>, rail: string}> {
  return page.evaluate((kinds) => {
    const tag = document.querySelector('.con-ptsel__cell[data-focused="1"] .con-ptsel__tag');
    const icons = [
      ...Array.from(document.querySelectorAll('.con-ptsel__rail .con-ptsel__imp-icon')),
      ...Array.from(tag?.querySelectorAll('.con-ptsel__tag-icon') ?? []),
    ];
    return {
      kinds: kinds.filter((k) => icons.some((i) => i.classList.contains('card-resource-' + k))),
      rail: `${document.querySelector('.con-ptsel__rail')?.textContent ?? ''} | ${tag?.textContent ?? ''}`.replace(/\s+/g, ' ').trim(),
    };
  }, KINDS);
}

/** One observation of the trade's flight: which kinds the flying chips wear, the workspace, the stranded guard. */
type Sighting = {colonies: boolean, chipKinds: string, stranded: boolean};
/** One observation of the landing's stage: the card land, its leave, the landed cell. */
type Landing = {cardland: boolean, leaving: boolean, landed: boolean};

/**
 * The trade's whole life, RECORDED off the product's own writes from before the confirm (`armWitness` — never a
 * timer that a loaded runner starves): the chips' kinds and the stranded guard as «did it ever happen» (the default —
 * a transient is caught in the task that wrote it), and the landing against the card's stand as a COEXISTENCE claim
 * («landed while the card stood») — `settled`, the state a task LEAVES, never the instant between two of its writes.
 */
async function armProbe(page: Page) {
  const sightings = await armWitness<Sighting, Array<string>>(page, 'vesta-trade-sightings', (kinds) => ({
    colonies: document.querySelector('.con-colonies') !== null,
    chipKinds: Array.from(document.querySelectorAll('.con-transfer__chip--cardres .con-transfer__icon'))
      .map((i) => kinds.find((k) => i.classList.contains('card-resource-' + k)) ?? '?').join(','),
    stranded: document.querySelector('.con-stranded') !== null,
  }), {args: KINDS});
  const landing = await armWitness<Landing>(page, 'vesta-trade-landing', () => ({
    cardland: document.querySelector('.con-colfocus__cardland') !== null,
    leaving: document.querySelector('.con-colfocus__cardland--leaving') !== null,
    landed: document.querySelector('.con-colfocus__landcell--landed') !== null,
  }), {settled: true});
  return {sightings, landing};
}

test.describe('Vesta at 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the reading: the tile, the dossier and the stage name the refusal and draw the three-kind unit; the lobby chip reads «Кризис: Возвращение»', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await createGame(request);
    const view = await serverView(request, playerId);
    console.log('── colonies ──', JSON.stringify(view.game.colonies));
    console.log('── colonyTradeBlocks ──', JSON.stringify(view.thisPlayer.colonyTradeBlocks));
    const names = view.game.colonies.map((c) => c.name);
    expect(names, 'the Redux addition is seated').toContain(VESTA);
    const vesta = view.game.colonies.find((c) => c.name === VESTA);
    expect(vesta?.isActive, '«Vesta starts active»').toBe(true);
    // The seat holds no mech / asteroid / fighter card at the start (the deal is unreproducible, so this is read, not assumed).
    const holder = view.thisPlayer.colonyTradeBlocks?.find((b) => b.colony === VESTA);
    expect(holder, 'a fresh seat with no holder is refused BY NAME on the server model').toBeDefined();

    await bootSeededGame(page, request, playerId, {buy: 2, keepColony: VESTA});
    await settle(page);
    await openColonies(page);
    await focusTile(page, VESTA);
    // The grid settles on the focused tile: its reading AT REST (two equal reads a frame apart, after `settle`).
    const tile = await readSettled(page, () => page.evaluate(() => {
      const el = document.querySelector(`.con-coltile--focused[data-test="con-colony-Vesta"]`);
      const glyph = el?.querySelector('[data-colony-trade-source] .benefit-glyph');
      return {
        status: (el?.querySelector('.con-coltile__status')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        statusClass: el?.querySelector('.con-coltile__status')?.className ?? '',
        tradeGlyphType: glyph?.getAttribute('data-bg-type') ?? '',
        planetClass: el?.querySelector('.con-planet')?.className ?? '',
      };
    }), {message: 'the focused tile'});
    const tileCell = await readSettled(page, () => readTile(page), {message: 'the tile\'s trade cell'});
    await shoot(page, '00-grid');
    console.log('── tile ──', JSON.stringify({...tile, ...tileCell}));
    expect(tile.status, 'the tile names the server\'s refusal').toContain(REASON_RU);
    expect(tile.statusClass).toContain('con-coltile__status--blocked');
    expect(tile.tradeGlyphType, 'the trade cell draws a card-resource income').toBe(String(ColonyBenefit.ADD_RESOURCES_TO_CARD));
    expect(tile.planetClass, 'the tile wears Vesta\'s art').toContain('Vesta-background');
    expect(tileCell.unit, 'ONE unit: mech - asteroid - fighter, joined by two HYPHENS (the compact register)').toEqual(COMPACT_UNIT);
    expect(tileCell.visible, 'all three sprites stand inside the trade cell — none clipped').toBe(true);
    expect(tileCell.siblingIconPx, 'a one-kind sibling tile draws its trade icon').toBeGreaterThan(0);
    expect(tileCell.iconPx, 'each of the three sprites reads at ≥ ¾ of a one-kind tile\'s icon').toBeGreaterThanOrEqual(0.72 * tileCell.siblingIconPx);
    // The cell's own contract: the VALUE never yields, the label does, by an ellipsis in its own box. Three
    // readable sprites cost the label its last letters («ТОРГОВ…»); a stub («Т.», the 16-px-and-«или» row)
    // is the defect. Keeping the whole word would take the sprites down to ~19 px.
    expect(tileCell.label.client, '«ТОРГОВАТЬ» keeps most of its word beside the unit (never a stub like «Т.»)').toBeGreaterThanOrEqual(0.7 * tileCell.label.scroll);
    expect(tileCell.cut.x, 'the trade cell is not cut (width)').toBeLessThanOrEqual(1);
    expect(tileCell.cut.y, 'the trade cell is not cut (height)').toBeLessThanOrEqual(1);

    // ── X → the dossier: the verdict, the three printed rules, the lore, the seven cells. ──
    await press(page, 'KeyX', 2300);
    await expect.poll(() => page.locator('.con-colinspect').count(), {message: 'X opened the dossier'}).toBe(1);
    // The entrance + the late reveal wave: every reading below is taken AT REST.
    const dossier = await readSettled(page, () => page.evaluate((kinds) => {
      const tradeGlyph = document.querySelector('.con-colinspect__group--trade .benefit-glyph');
      return {
        crumb: (document.querySelector('.con-colonies .con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        verdict: (document.querySelector('.con-colinspect__act .con-colinspect__verdict')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        verdictClass: document.querySelector('.con-colinspect__act .con-colinspect__verdict')?.className ?? '',
        rules: Array.from(document.querySelectorAll('.con-colinspect__rules .con-colinspect__text')).map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim()),
        // Every sprite of the rule line stands INSIDE the panel's glyph column (a 32 px column
        // once showed only the middle icon — the DOM had all three).
        tradeUnitVisible: (() => {
          const column = document.querySelector('.con-colinspect__group--trade .con-colinspect__glyph')?.getBoundingClientRect();
          const icons = Array.from(tradeGlyph?.querySelectorAll('.benefit-glyph__icon') ?? []).map((i) => i.getBoundingClientRect());
          return column !== undefined && icons.length === 3 && icons.every((r) =>
            r.width > 0 && r.left >= column.left - 1 && r.right <= column.right + 1 && r.top >= column.top - 1 && r.bottom <= column.bottom + 1);
        })(),
        tradeUnit: {
          kinds: Array.from(tradeGlyph?.querySelectorAll('.benefit-glyph__icon') ?? []).map((i) => kinds.find((k) => i.classList.contains(k)) ?? '?'),
          ors: tradeGlyph?.querySelectorAll('.benefit-glyph__or').length ?? 0,
          dashes: tradeGlyph?.querySelectorAll('.benefit-glyph__dash').length ?? 0,
          multi: tradeGlyph?.classList.contains('benefit-glyph--multi') ?? false,
        },
        lore: (document.querySelector('.con-colinspect .card-zoom-lore__text')?.textContent ?? '').trim(),
        gains: Array.from(document.querySelectorAll('.con-colinspect__gain')).map((g) => (g.textContent ?? '').replace(/\s+/g, ' ').trim()),
        gainOrs: document.querySelectorAll('.con-colinspect__gain .con-colinspect__gain-or').length,
        lost: (document.querySelector('.con-colinspect__lost')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      };
    }, KINDS), {message: 'the dossier'});
    const cells = await readSettled(page, () => instrumentCells(page), {message: 'the dossier\'s cells'});
    await shoot(page, '01-dossier');
    console.log('── dossier ──', JSON.stringify(dossier, null, 2));
    console.log('── cells ──', JSON.stringify(cells));
    expect(dossier.crumb).toMatch(/КОЛОНИИ.*ВЕСТА.*ОСМОТР/i);
    expect(dossier.verdict, 'the dossier states the refusal as information').toContain(REASON_RU);
    expect(dossier.verdictClass).toContain('con-colinspect__verdict--no');
    expect(dossier.rules, 'the three PRINTED rules, one sentence each').toEqual([
      'Получите 5 стали',
      'Добавьте X мехов, астероидов или истребителей на любую карту',
      'Получите 1 сталь',
    ]);
    expect(dossier.tradeUnit, 'TRADE INCOME draws the three-kind unit in the compact register (the track\'s own grammar)').toEqual(COMPACT_UNIT);
    expect(dossier.tradeUnitVisible, 'all three sprites of the rule line stand inside the glyph column — not only in the DOM').toBe(true);
    expect(dossier.lore).toMatch(/Веста/);
    expect(dossier.gains.join(' | '), 'the reward reads +1 (the 2nd cell) as one unit').toMatch(/\+1/);
    expect(dossier.gainOrs, 'the «you receive» line names the unit with its operators, never one icon').toBe(2);
    expect(dossier.lost.length, 'the lost line names the unit that cannot land').toBeGreaterThan(3);
    expect(cells.map((c) => c.type), 'every cell is a card-resource income').toEqual(Array(7).fill(String(ColonyBenefit.ADD_RESOURCES_TO_CARD)));
    expect(cells.map((c) => c.qty), 'the printed track').toEqual(['', '1', '1', '1', '2', '2', '3']);
    // The dossier's cells are the NARROWEST host (≈ 86 px at 1080): three fluid sprites of ≈ 23 px.
    expectReadableCells(cells, 20, 'dossier');

    // ── B → back; A → the stage carries the refusal with its reason. ──
    await press(page, 'Escape', 1600);
    await expect.poll(() => page.locator('.con-colinspect').count(), {message: 'B folded the dossier'}).toBe(0);
    await press(page, 'Enter', 2200);
    const stageVerdict = () => page.evaluate(() => (document.querySelector('.con-colfocus__verdict')?.textContent ?? '').replace(/\s+/g, ' ').trim());
    await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'A entered the trade stage'}).toBeGreaterThan(0);
    await expect.poll(stageVerdict, {message: 'the stage carries the refusal'}).toContain(REASON_RU);
    await shoot(page, '02-stage');
    console.log('── stage ──', JSON.stringify({verdict: await stageVerdict()}));
    await press(page, 'Escape', 1200);

    // ── The lobby row's expansion chip reads the NEW Russian name. ──
    await seedIdentity(page, 'ConsoleTester');
    await page.goto('/');
    await page.waitForSelector('.cm-menu__items', {timeout: 20_000});
    await page.click('.cm-item:has-text("Мои партии")');
    await page.waitForSelector('.cm-game', {timeout: 60_000});
    const lobbyAlts = () => page.evaluate(() => Array.from(document.querySelectorAll('.cm-game .cm-game__exp img')).map((i) => i.getAttribute('alt')));
    await expect.poll(lobbyAlts, {message: 'the Turmoil Redux chip reads «Кризис: Возвращение»'}).toContain(EXPANSION_RU);
    const alts = await lobbyAlts();
    console.log('── lobby expansion chips (alt) ──', JSON.stringify(alts));
    expect(alts).not.toContain('Кризис Redux');
    expect(alts).not.toContain('Turmoil Redux');
    await shoot(page, '03-lobby');
  });

  test('the trade: the picked card decides the kind — the chip flies as an ASTEROID, lands on the standing card, and the server holds it', async ({page, request}) => {
    test.setTimeout(540_000);
    const t0 = Date.now();
    const lap = (label: string) => console.log(`[t+${Math.round((Date.now() - t0) / 1000)}s] ${label}`);
    const playerId = await bootFixture(page, request, 'vesta-trade', {keepColony: VESTA});
    await settle(page);
    await armLeakWitness(page);
    const before = await serverView(request, playerId);
    expect((before.thisPlayer.colonyTradeBlocks ?? []).map((b) => b.colony), 'two holders: no refusal').not.toContain(VESTA);
    expect(before.thisPlayer.tableau.find((c) => c.name === TARGET)?.resources ?? 0).toBe(0);
    lap('booted');

    await openColonies(page);
    await focusTile(page, VESTA);
    await press(page, 'Enter', 2000);
    await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the trade stage did not open'}).toBeGreaterThan(0);
    await shoot(page, '10-trade-review');

    // The stage's track is the WIDE host: each sprite takes the footprint a single icon has on this track (40 px).
    const stageCells = await readSettled(page, () => instrumentCells(page, '.con-colfocus'), {message: 'the stage\'s cells'});
    console.log('── stage cells ──', JSON.stringify(stageCells));
    expectReadableCells(stageCells, 36, 'stage');

    // The reward reads the three-kind unit; no single icon stands for it.
    const reviewRead = () => page.evaluate((kinds) => {
      const total = document.querySelector('.con-colfocus__rrow--big .con-colfocus__rglyph');
      return {
        icons: Array.from(total?.querySelectorAll('i') ?? []).map((i) => kinds.find((k) => i.classList.contains('card-resource-' + k)) ?? '?'),
        ors: total?.querySelectorAll('.con-colfocus__ror').length ?? 0,
      };
    }, KINDS);
    await expect.poll(async () => (await reviewRead()).icons, {message: 'the total names the unit as mech · asteroid · fighter'}).toEqual(KINDS);
    await expect.poll(async () => (await reviewRead()).ors).toBe(2);
    console.log('── review ──', JSON.stringify(await reviewRead()));

    // The target decision: descend, walk onto the asteroid holder, choose.
    await focusTargetRow(page);
    await press(page, 'Enter', 1200);
    await expect.poll(() => page.locator('.con-colfocus__targetstage').count(), {message: 'the embedded target step stands'}).toBeGreaterThan(0);
    const candidatesRead = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-ptsel-cell] [data-zoom-slot]')).map((el) => el.getAttribute('data-zoom-slot')));
    await expect.poll(candidatesRead, {message: 'both holders are candidates — the holders of ANY kind'}).toEqual(expect.arrayContaining([TARGET, OTHER]));
    console.log('── candidates ──', JSON.stringify(await candidatesRead()));
    // The cursor WALKS onto the holder (act → verify, turning round at a wall) — never a blind series of presses.
    await walkFocusUntil(page, async () => (await focusedCandidate(page)) === TARGET, () => focusedCandidate(page), 6, 450);
    await expect.poll(() => focusedCandidate(page), {message: 'the cursor reached the asteroid holder'}).toBe(TARGET);
    // Each candidate's reading names ITS OWN kind — the selector's status rail («ПОЛОСТИ В АСТЕРОИДАХ → [icon] Ресурсы на
    // этой карте 0 → 2») wears the asteroid for this card. The colony's target step draws no PL-219 tag under its cards
    // (PL-058), so the rail keeps the count; where a host draws the tag, the count is the TAG's (TR56 П4) — read both.
    // The rail republishes a beat after the cursor: polled.
    await expect.poll(async () => (await focusedReading(page)).kinds, {message: 'the asteroid holder reads asteroids, never mechs or fighters'}).toEqual(['asteroid']);
    await expect.poll(async () => (await focusedReading(page)).rail).toMatch(/0\s*→\s*2/);
    console.log('── focused candidate reading ──', JSON.stringify(await focusedReading(page)));
    await shoot(page, '11-target-step');
    await press(page, 'Enter', 1000);
    await expect.poll(() => page.locator('.con-colfocus__targetstage').count(), {message: 'the pick returns to the review'}).toBe(0);
    const pickedRows = () => page.evaluate((kinds) => Array.from(document.querySelectorAll('.con-colfocus__rcard')).map((r) => ({
      text: (r.textContent ?? '').replace(/\s+/g, ' ').trim(),
      kind: kinds.find((k) => r.querySelector('i')?.classList.contains('card-resource-' + k)) ?? '?',
    })), KINDS);
    await expect.poll(async () => (await pickedRows()).length, {message: 'one chosen card'}).toBe(1);
    await expect.poll(async () => (await pickedRows())[0]?.text ?? '', {message: 'the row shows the chosen card with its before → after'}).toMatch(/0\s*→\s*2/);
    await expect.poll(async () => (await pickedRows())[0]?.kind ?? '', {message: 'the destination row wears the CARD\'s kind'}).toBe('asteroid');
    console.log('── picked ──', JSON.stringify({rows: await pickedRows()}));
    await shoot(page, '12-picked');
    lap('target picked');

    const probe = await armProbe(page);
    await press(page, 'KeyX', 300); // confirm the trade
    lap('confirmed');

    await expect.poll(async () => page.locator('.con-colonies').count(), {timeout: 90_000, message: 'the finished trade leaves for the board'}).toBe(0);
    lap('workspace gone');
    await settle(page);
    await shoot(page, '13-after');

    const sightings = await probe.sightings.stop();
    const landings = await probe.landing.stop();
    const firstLanded = landings.findIndex((s) => s.v.landed);
    const chipKinds = [...new Set(sightings.flatMap((s) => s.v.chipKinds === '' ? [] : s.v.chipKinds.split(',')))];
    const summary = {
      sightings: sightings.length, landings: landings.length, firstLanded,
      landedOnStanding: firstLanded >= 0 && landings[firstLanded].v.cardland && !landings[firstLanded].v.leaving,
      chipKinds,
      stranded: sightings.filter((s) => s.v.stranded).length,
    };
    console.log('── vesta trade summary ──', JSON.stringify(summary, null, 1));
    const t0Page = Math.min(sightings[0]?.t ?? 0, landings[0]?.t ?? 0);
    console.log('── trace (changes only) ──\n' + [
      ...sightings.map((s) => ({t: s.t, line: `col:${+s.v.colonies} chips:[${s.v.chipKinds}] str:${+s.v.stranded}`})),
      ...landings.map((s) => ({t: s.t, line: `land:${+s.v.cardland}${s.v.leaving ? 'L' : ''} landed:${+s.v.landed}`})),
    ].sort((a, b) => a.t - b.t).map((s) => `${s.t - t0Page} ${s.line}`).join('\n'));

    // A DEAD recorder fails these floors — a count of recorded states is a count of changes, never of frames.
    expect(summary.sightings, 'the flight recorder was alive').toBeGreaterThan(0);
    expect(summary.landings, 'the landing recorder was alive').toBeGreaterThan(0);
    expect(summary.chipKinds, 'the chip flew as the CHOSEN card\'s own kind — the asteroid, never the mech (the first of the list) nor the fighter').toEqual(['asteroid']);
    expect(firstLanded, 'a chip physically landed on the presented card').toBeGreaterThanOrEqual(0);
    expect(summary.landedOnStanding, 'the chip landed while the card stood (not leaving, not gone)').toBe(true);
    expect(summary.stranded, 'the stranded-prompt guard never fired').toBe(0);
    expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);

    // The server: 2 asteroids on the chosen card, nothing on the fighter card, the marker reset.
    const after = await serverView(request, playerId);
    console.log('── server tableau ──', JSON.stringify(after.thisPlayer.tableau.map((c) => [c.name, c.resources ?? 0])));
    expect(after.thisPlayer.tableau.find((c) => c.name === TARGET)?.resources, 'the asteroid card holds the two units').toBe(2);
    expect(after.thisPlayer.tableau.find((c) => c.name === OTHER)?.resources ?? 0, 'the fighter card received nothing').toBe(0);
    expect(after.game.colonies.find((c) => c.name === VESTA)?.trackPosition, 'the marker returned to the built-colony count').toBe(0);
  });
});

test.describe('Vesta at 4K', () => {
  const preset = PARLIAMENT_PRESETS.find((p) => p.id === 'tv-4k')!;
  test.use({viewport: preset.viewport, deviceScaleFactor: 1});

  test('the three-kind unit stays inside every cell\'s box on the TV profile — the tile and the dossier', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'vesta-trade', {keepColony: VESTA, query: preset.query});
    await settle(page);
    await openColonies(page);
    await focusTile(page, VESTA);
    const tile = await readSettled(page, () => readTile(page), {message: 'the tv tile\'s trade cell'});
    await shoot(page, '20-tv-tile');
    console.log('── tv tile ──', JSON.stringify(tile));
    expect(tile.unit).toEqual(COMPACT_UNIT);
    expect(tile.visible, 'all three sprites stand inside the trade cell — none clipped').toBe(true);
    expect(tile.iconPx, 'each of the three sprites reads at ≥ ¾ of a one-kind tile\'s icon').toBeGreaterThanOrEqual(0.72 * tile.siblingIconPx);
    expect(tile.cut.x, 'the tile\'s trade cell is not cut (width)').toBeLessThanOrEqual(1);
    expect(tile.cut.y, 'the tile\'s trade cell is not cut (height)').toBeLessThanOrEqual(1);

    await press(page, 'KeyX', 2300);
    await expect.poll(() => page.locator('.con-colinspect').count(), {message: 'X opened the dossier'}).toBe(1);
    // The entrance + the late reveal wave: the cells AT REST.
    const cells = await readSettled(page, () => instrumentCells(page), {message: 'the tv dossier\'s cells'});
    await shoot(page, '21-tv-dossier');
    console.log('── tv cells ──', JSON.stringify(cells));
    // The TV profile doubles the rem: the narrowest host's sprites double with it.
    expectReadableCells(cells, 40, 'tv dossier');
    await press(page, 'Escape', 1600);
  });
});
