import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, bootSeededGame, createGameWithCards, playCardFromHand, press, soloGameConfig} from './consoleStart';

/**
 * THE PLACEMENT DOSSIER — the right-hand board panel, photographed.
 *
 * A VISUAL probe: it drives the four contrasting shapes of the same surface
 * (a plain legal cell · a cell whose neighbourhood taxes the placement · a
 * special-tile placement · an illegal cell) and shoots each one at 4K TV,
 * which is the profile the panel is designed for.
 *
 * Deliberately ASSERTION-LIGHT and selector-free about the panel's own
 * markup: it must run unchanged against the PREVIOUS build too, so a
 * before/after pair is the same drive photographed twice. What it does
 * assert is only that the drive arrived (a placement is live, the cursor
 * reached the cell the shot is named after) — a screenshot of the wrong
 * state is worse than no screenshot.
 *
 * Structural claims about the panel live in the unit specs
 * (`ConsoleContextPanel.spec.ts`, `placementDossier.spec.ts`) and in the two
 * source probes (`console-placement-source`, `console-hazard-placement`).
 */

const OUT = path.resolve('screenshots', process.env.DOSSIER_OUT ?? 'placement-dossier');

/** A deterministic solo ARES game — hazards are what taxes a placement. */
function aresConfig(overrides: Record<string, unknown> = {}) {
  return {
    players: [{name: 'Dossier', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: true, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
    ...overrides,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/**
 * A frame pump. Headless Chromium drives rAF off the compositor, so on a
 * quiet screen the APP's own settle chains starve — and a screenshot is what
 * forces a BeginFrame (see the tv-reading-matrix precedent).
 */
async function pump(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
}

async function key(page: Page, code: string, settle = 420): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
  await pump(page);
}

const panelOf = (page: Page) => page.locator('.con-context');

/**
 * The focused cell, and whether the placement ACCEPTS it — read off the
 * board, never off the panel's own copy: the new panel keeps the refusal in
 * an always-mounted (collapsed) well, so a text probe cannot tell the two
 * states apart, and the old one has no such marker at all. `--available` is
 * the same class `selectedCellLegal` itself reads.
 */
async function focusedCell(page: Page): Promise<{id: string, legal: boolean}> {
  // `.con-cell-sel` is the console board's own spotlight class
  // (`ConsoleBoardSection.SELECT_CLASS`) — the cursor, not the legacy
  // desktop `--selected` (which only exists after a pick is committed).
  return page.evaluate(() => {
    const el = document.querySelector('.con-cell-sel[data_space_id]');
    return {
      id: el?.getAttribute('data_space_id') ?? '',
      legal: el?.classList.contains('board-space--available') ?? false,
    };
  });
}

/**
 * Walk the board cursor until `hit` answers true. The walk pattern sweeps
 * rows rather than orbiting one neighbourhood (the hazard probe's lesson),
 * and every step pumps a frame.
 */
async function walkUntil(
  page: Page,
  hit: (text: string, cell: {id: string, legal: boolean}) => boolean,
  budget = 60): Promise<string> {
  const panel = panelOf(page);
  const walk = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown',
    'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < budget; i++) {
    const text = await panel.innerText().catch(() => '');
    if (text !== '' && hit(text, await focusedCell(page))) {
      return text;
    }
    await key(page, walk[i % walk.length], 380);
  }
  return '';
}

/** The placement panel is up (the kicker names a tile / marker placement). */
async function placementLive(page: Page): Promise<boolean> {
  const text = (await panelOf(page).innerText().catch(() => '')).toUpperCase();
  return text.includes('РАЗМЕЩЕНИЕ');
}

test.describe.configure({mode: 'serial'});

test.describe('console placement dossier · 4K TV', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});

  test('greenery: a plain cell, a taxed cell, and an illegal cell', async ({page, request}) => {
    test.setTimeout(420_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    const playerId = await createGameWithCards(request, [], {config: aresConfig()});
    await bootSeededGame(page, request, playerId, {query: '&consoleProfile=tv'});
    await page.waitForTimeout(1200);
    await shoot(page, '00-board-home');

    // LT wheel → «КОНВЕРТАЦИЯ РАСТЕНИЙ» is the LEFT slot. The wheel is
    // PRESS→RELEASE: the direction ARMS the slot and FIRES it on key-up, so
    // the arrow alone activates it (an extra Enter would commit the tile).
    await key(page, 'Comma', 1400);
    await key(page, 'ArrowLeft', 2800);
    expect(await placementLive(page), 'never reached the board placement').toBeTruthy();

    // ── 1 · A PLAIN legal cell: no toll, the ordinary result.
    const plain = await walkUntil(page, (text, cell) =>
      cell.legal && !text.includes('Снизить производство'));
    expect(plain, 'no plain legal cell surfaced').not.toBe('');
    await page.waitForTimeout(700); // the per-cell preview is fetched
    await pump(page);
    await shoot(page, '01-greenery-plain-cell');

    // ── 2 · A TAXED cell: the Ares hazard-adjacency production penalty. The
    //        match is the PENALTY, never any «производство» line (a greenery
    //        legitimately mentions other players' production gains).
    const taxed = await walkUntil(page, (text, cell) =>
      cell.legal && text.includes('Снизить производство'));
    expect(taxed, 'no hazard-adjacent cell surfaced a production penalty').not.toBe('');
    await page.waitForTimeout(700);
    await pump(page);
    await shoot(page, '02-greenery-hazard-penalty');

    // ── 3 · An ILLEGAL cell: R3 opens the whole board («ВСЕ КЛЕТКИ»), so the
    //        cursor can reach a cell the placement refuses.
    await key(page, 'KeyV', 1200); // R3 — inspect all cells
    const illegal = await walkUntil(page, (_text, cell) => cell.id !== '' && !cell.legal);
    expect(illegal, 'no illegal cell surfaced a refusal').not.toBe('');
    await page.waitForTimeout(700);
    await pump(page);
    await shoot(page, '03-greenery-illegal-cell');
  });

  test('a named SPECIAL tile names itself', async ({page, request}) => {
    test.setTimeout(420_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    // «Запретная зона» places a NAMED special tile on any ordinary land — no
    // requirement, so the drive is the play itself and nothing else.
    //
    // Deliberately NOT the Ares game above: the Ares module REPLACES this card
    // with its own variant (`Restricted Area:ares`), so asking for the base
    // name there searches 80 deals for a card that cannot be dealt.
    await bootIntoGame(page, request, {
      config: soloGameConfig({seed: 0.11}),
      cards: ['Restricted Area'],
      query: '&consoleProfile=tv',
    });
    await page.waitForTimeout(1200);

    expect(await playCardFromHand(page, 'Restricted Area'), 'never played the card').toBeTruthy();
    // The play's own landing scene runs before the board takes over.
    for (let i = 0; i < 12 && !(await placementLive(page)); i++) {
      await pump(page);
      await page.waitForTimeout(900);
    }
    // A composer still standing (a leftover confirm) yields to A.
    for (let i = 0; i < 3 && !(await placementLive(page)); i++) {
      await press(page, 'Enter', 1500);
      await pump(page);
    }
    expect(await placementLive(page), 'the special tile never reached the board').toBeTruthy();
    await walkUntil(page, (_text, cell) => cell.legal, 16);
    // ⚠️ LET THE PLANET SETTLE BEFORE SHOOTING. Planet focus zooms the board
    // on a CSS transition, and headless Chromium drives those off the
    // compositor — on a quiet screen the zoom simply stops half-way, and the
    // screenshot then shows a planet that is neither the old size nor the new
    // one (it read as a geometry regression until a second run disproved it).
    // Pumping frames is what finishes it.
    for (let i = 0; i < 8; i++) {
      await pump(page);
      await page.waitForTimeout(220);
    }
    await shoot(page, '04-special-tile');
  });
});
