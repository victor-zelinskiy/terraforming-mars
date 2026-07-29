import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * «РАЗЫГРАНО» → fullscreen → BACK: the table must stay on stage.
 *
 * The stage-suspend rule (`body.con-zoom-open`) used to park the played
 * table with `visibility: hidden` for the whole dialog lifetime. The class
 * drops in `onCardZoomClosed` — i.e. AFTER the close flight — so the card
 * physically returned into a VOID and the table popped in a frame later.
 * The table is no longer parked (the stage veil covers it instead), so:
 *
 *  1. while the fullscreen is open the table is still VISIBLE (dimmed under
 *     the veil, never `visibility: hidden`);
 *  2. its slot geometry is live throughout — the return flight always has a
 *     real rect to land in;
 *  3. the source slot itself is HELD empty while the card is away (no double
 *     image of the same card).
 */

const OUT_ROOT = path.resolve('screenshots', 'played-zoom-return');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'ZoomTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
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
    automa: {difficulty: 'normal'},
  };
}

async function key(page: Page, code: string, settleMs = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

async function enterGame(page: Page, request: APIRequestContext): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1&consoleProfile=auto`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  const startScene = page.locator('.con-start__frame');
  for (let i = 0; i < 16 && await startScene.count() > 0; i++) {
    await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
  }
  await expect(startScene).toHaveCount(0);
  for (let i = 0; i < 12; i++) {
    const status = (await page.locator('.con-status').textContent().catch(() => '')) ?? '';
    if (/ДЕЙСТВИЕ/i.test(status)) {
      break;
    }
    await key(page, 'Enter', 1300);
  }
  await page.waitForTimeout(2500);
}

test.describe('played table ⇄ fullscreen', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the table stays on stage while a card is inspected fullscreen', async ({page, request}) => {
    test.setTimeout(240_000);
    await enterGame(page, request);

    // Board home → «Разыграно» (X), then A on the corporation zone: it holds
    // exactly one card, so the smart shortcut opens the fullscreen directly.
    await key(page, 'KeyX', 1000);
    const table = page.locator('.con-played');
    await expect(table).toHaveCount(1);
    const slotBefore = await page.locator('.con-played__slot').first().boundingBox();
    expect(slotBefore, 'the table must have a real slot rect').toBeTruthy();

    await key(page, 'Enter', 1400);
    await expect(page.locator('.con-zoom__prov')).toHaveCount(1);

    // 1 · The table is NOT parked — it reads as a dimmed silhouette under
    // the stage veil (the return flight has something to land on).
    await expect(table).toBeVisible();
    expect(await table.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    // 2 · …and its slot geometry is live throughout.
    const slotDuring = await page.locator('.con-played__slot').first().boundingBox();
    expect(slotDuring?.width ?? 0).toBeGreaterThan(4);
    // 3 · The source slot itself is HELD empty (no double image).
    await expect(page.locator('.con-played .con-zoom-hold')).toHaveCount(1);
    await shoot(page, '01-fullscreen-over-table');

    // Back: the card returns into its own slot on a visible table.
    await key(page, 'Escape', 1400);
    await expect(page.locator('.con-zoom__prov')).toHaveCount(0);
    await expect(table).toBeVisible();
    await expect(page.locator('.con-played .con-zoom-hold')).toHaveCount(0);
    await shoot(page, '02-returned');
  });
});
