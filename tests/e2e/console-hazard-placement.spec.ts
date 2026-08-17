import {test, expect, Page} from '@playwright/test';
import {bootSeededGame, createGameWithCards} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console-native placement panel · Ares hazard adjacency.
 *
 * Drives a real solo ARES game through the console-native shell to a tile
 * placement and walks the board cursor onto a cell ADJACENT TO A HAZARD, then
 * asserts the right-hand «РАЗМЕЩЕНИЕ ТАЙЛА» panel names the hazard-adjacency
 * production penalty.
 *
 * The regression this guards: the panel used to render only the hover facts
 * (`boardCellInfo`), which describe the cell as it STANDS and never carry the
 * consequences of placing — so the forced «снизить производство» cost was
 * invisible on console while the desktop hover popover showed it.
 */

const OUT_DIR = path.resolve('screenshots', 'console-hazard');

/** A deterministic solo ARES game. */
function newGameConfig() {
  return {
    players: [{name: 'HazardTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      // No preludes: the start wizard stays short (corp → buy → start) and
      // can't stall on a prelude that needs a card in hand.
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
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/**
 * Walk the standard-projects sheet until the FOCUSED card names `title`
 * (mirrors console-planet-focus.spec — a blind "two downs" drifted onto
 * «Город» and poisoned the panel walk with the city's own production line).
 */
async function focusStdProject(page: Page, title: RegExp): Promise<boolean> {
  const focusedName = () =>
    page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
  // Let the sheet finish its enter transition before the first press —
  // early arrows were swallowed and the walk desynced from the grid.
  await page.waitForTimeout(900);
  const walk = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft',
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown'];
  for (let i = 0; i <= walk.length; i++) {
    if (title.test(await focusedName())) {
      return true;
    }
    if (i < walk.length) {
      await key(page, walk[i], 500);
    }
  }
  return false;
}

test.describe('console placement panel · Ares hazard adjacency', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the panel names the forced production reduction next to a hazard', async ({page, request}) => {
    test.setTimeout(240_000);

    // The pregame is SETUP — the subject is the placement panel beside a
    // hazard. The shared driver ANSWERS it over `player/input` and opens the
    // console on a live board, so nothing here has to guess its way past the
    // wizard's own follow-ups (the bought-cards payment, the first action).
    const playerId = await createGameWithCards(request, [], {config: newGameConfig()});
    await bootSeededGame(page, request, playerId);
    await shoot(page, '01-after-start');

    // LT wheel → Standard Projects (the center slot) → the projects sheet.
    await key(page, 'Comma', 1200);
    await shoot(page, '02-lt-wheel');
    await key(page, 'Enter', 1500);
    await shoot(page, '03-std-projects');

    // «Озеленение»: a greenery places a tile with no adjacency restriction
    // yet (no tiles of ours), so every legal land cell is reachable,
    // hazard neighbours included.
    const panel = page.locator('.con-context');
    expect(await focusStdProject(page, /озеленение/i), 'never focused «Озеленение»').toBeTruthy();
    await shoot(page, '04-greenery-focused');
    await key(page, 'Enter', 1600);
    // The project opens the shared payment panel — X is «ОПЛАТИТЬ».
    if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
      await key(page, 'KeyX', 2600);
    }
    await shoot(page, '05-placement-open');
    const placing = (await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА');
    expect(placing, 'never reached a board placement').toBeTruthy();

    // Walk the board cursor over the legal cells until one is adjacent to a
    // hazard — that cell's preview must name the production penalty.
    let found = '';
    const walk = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown',
      'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
    for (let i = 0; i < 48 && found === ''; i++) {
      const text = await panel.innerText();
      // Match the PENALTY itself, not any «производство» line: a greenery
      // preview legitimately mentions other players' production gains, and
      // the loose stem stopped the walk on the first such cell.
      if (text.includes('Снизить производство')) {
        found = text;
        break;
      }
      await key(page, walk[i % walk.length], 420);
    }

    await shoot(page, '06-hazard-adjacent-panel');
    expect(found, 'no hazard-adjacent cell surfaced a production penalty').not.toBe('');
    // The penalty reads as the CELL'S OWN EFFECT (the dossier's first
    // section — a forced loss never sits below the fold), and names WHY
    // (the adjacent hazard).
    expect(found).toContain('Снизить производство');
    expect(found).toContain('ЭФФЕКТ КЛЕТКИ');
    expect(found).toContain('опасных зон рядом');
  });
});
