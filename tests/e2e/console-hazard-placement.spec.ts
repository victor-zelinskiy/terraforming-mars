import {test, expect, Page} from '@playwright/test';
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

test.describe('console placement panel · Ares hazard adjacency', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the panel names the forced production reduction next to a hazard', async ({page, request}) => {
    test.setTimeout(240_000);

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const playerId = model.players[0].id;

    await page.goto(`/player?id=${playerId}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
    await page.waitForTimeout(3500);

    // Walk the start wizard: A picks the focused card, RB advances a step
    // (corp → buy projects → start). Adaptive: keep going until the start
    // scene is gone — extra presses are inert once a step completes.
    const startScene = page.locator('.con-start__frame');
    for (let i = 0; i < 14 && await startScene.count() > 0; i++) {
      await key(page, i % 2 === 0 ? 'Enter' : 'KeyE', 1100);
    }
    await page.waitForTimeout(2500);
    await shoot(page, '01-after-start');
    expect(await startScene.count(), 'start wizard never completed').toBe(0);

    // LT wheel → Standard Projects (the center slot) → the projects sheet.
    await key(page, 'Comma', 1200);
    await shoot(page, '02-lt-wheel');
    await key(page, 'Enter', 1500);
    await shoot(page, '03-std-projects');

    // The sheet is a 2-column grid; the focus starts on «Продажа патентов».
    // Two steps down lands on «Озеленение» — a greenery places a tile with no
    // adjacency restriction yet (no tiles of ours), so every legal land cell
    // is reachable, hazard neighbours included.
    const panel = page.locator('.con-context');
    await key(page, 'ArrowDown', 500);
    await key(page, 'ArrowDown', 500);
    await shoot(page, '04-greenery-focused');
    await key(page, 'Enter', 2200);
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
      if (text.includes('роизводств')) {
        found = text;
        break;
      }
      await key(page, walk[i % walk.length], 420);
    }

    await shoot(page, '06-hazard-adjacent-panel');
    expect(found, 'no hazard-adjacent cell surfaced a production penalty').not.toBe('');
    // The penalty reads as a COST, and names WHY (the adjacent hazard).
    expect(found).toContain('Снизить производство');
    expect(found).toContain('ЦЕНА');
    expect(found).toContain('опасная зона');
  });
});
