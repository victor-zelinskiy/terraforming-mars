import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE INFORMATION WORKSPACE (Y) — layout / context / dedup probe.
 *
 * The workspace iteration turned the Y information panel from a centered
 * modal into a .con-main child filling everything RIGHT of the left resource
 * rail, with the rail as the mode's live SUMMARY half (its player context
 * follows the inspected player). This spec drives a real human+MarsBot game
 * and asserts the load-bearing contracts:
 *
 *  1. GEOMETRY — the workspace fills the area right of the rail between the
 *     two bars (left edge = rail + gap; top/bottom/right = .con-main's box),
 *     and the rail stays visible (not covered, not dimmed away).
 *  2. CONTEXT SYNC — LB/RB switch the inspected player in BOTH surfaces at
 *     once: the rail's numbers become the inspected seat's, the panel swaps
 *     its dossier (human columns ↔ bot grid). Rapid presses coalesce.
 *  3. DEDUP — the human dossier repeats NO rail summary: no resource grid,
 *     no tag matrix, no TR/VP totals in the header.
 *  4. RESTORE — closing returns the rail to the viewer's own seat.
 *
 * Also the screenshot source for the workspace gallery
 * (screenshots/info-workspace/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'info-workspace');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  deviceScaleFactor: number;
  profileQuery: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=handheld'},
];

/** Full NewGameConfig — deterministic base+corpEra game, human + MarsBot. */
function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'InfoTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true, // 500 of every resource → the own rail reads a distinct value
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

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  return model.players[0].id;
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** Walk the start wizard adaptively until the in-game shell owns the screen. */
async function enterGame(page: Page, playerId: string, profileQuery: string): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1${profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500); // deal cinematic settles
  const startScene = page.locator('.con-start__frame');
  for (let i = 0; i < 16 && await startScene.count() > 0; i++) {
    await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
  }
  await expect(startScene).toHaveCount(0);
  // The start follow-ups (the research payment is a FALLBACK-scope surface
  // where Y is owned by the DOM engine) — confirm through them until the
  // in-game action phase owns the shell.
  for (let i = 0; i < 12; i++) {
    const status = (await page.locator('.con-status').textContent().catch(() => '')) ?? '';
    if (/ДЕЙСТВИЕ/i.test(status)) {
      break;
    }
    await key(page, 'Enter', 1300);
  }
  await page.waitForTimeout(2500); // start ceremony / hand intake settles
}

const railMc = (page: Page) => page.locator('.con-res__row--megacredits .con-res__value');

for (const preset of PRESETS) {
  test.describe(`information workspace · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: preset.deviceScaleFactor,
      screen: preset.viewport,
    });

    test('workspace layout, rail context sync, dedup', async ({page, request}) => {
      test.setTimeout(preset.viewport.width >= 3840 ? 420_000 : 240_000);
      const playerId = await createGame(request);
      await enterGame(page, playerId, preset.profileQuery);

      // ── 1 · Open the workspace (retry through a lingering cinematic) ─
      const workspace = page.locator('.con-info');
      for (let i = 0; i < 4 && await workspace.count() === 0; i++) {
        await key(page, 'KeyY', 1100);
      }
      await expect(workspace).toHaveCount(1);
      const ownMc = (await railMc(page).textContent()) ?? '';
      expect(ownMc).not.toBe('');
      await shoot(page, preset, '01-workspace-self');

      // GEOMETRY: fills .con-main right of the rail (±4px tolerance).
      const main = await page.locator('.con-main').boundingBox();
      const rail = await page.locator('.con-res-host').boundingBox();
      const ws = await workspace.boundingBox();
      expect(main && rail && ws).toBeTruthy();
      if (main && rail && ws) {
        expect(Math.abs(ws.y - main.y)).toBeLessThanOrEqual(4);
        expect(Math.abs((ws.y + ws.height) - (main.y + main.height))).toBeLessThanOrEqual(4);
        expect(Math.abs((ws.x + ws.width) - (main.x + main.width))).toBeLessThanOrEqual(4);
        expect(ws.x).toBeGreaterThan(rail.x + rail.width - 2); // right of the rail
        expect(ws.x - (rail.x + rail.width)).toBeLessThanOrEqual(16 * preset.viewport.width / 1920 + 6); // …by the seam gap only
        // The rail is visible and NOT under the workspace.
        await expect(page.locator('.con-res')).toBeVisible();
      }

      // DEDUP: the human dossier carries no rail summary.
      await expect(workspace.locator('.con-info__res-grid')).toHaveCount(0);
      await expect(workspace.locator('.con-tagmx')).toHaveCount(0);
      await expect(workspace.locator('.con-info__cols')).toHaveCount(1);

      // ── 2 · RB → the MarsBot seat: BOTH surfaces switch ────────────
      await key(page, 'KeyE', 900);
      // The rail now reads the bot's M€ (never the human's testMode pile)…
      const botMc = await railMc(page).textContent();
      expect(botMc, 'rail M€ must switch to the inspected bot').not.toBe(ownMc);
      // …and the panel swapped to the bot dossier (grid, not columns).
      await expect(workspace.locator('.con-info__grid')).toHaveCount(1);
      await expect(workspace.locator('.con-info__cols')).toHaveCount(0);
      await shoot(page, preset, '02-workspace-bot');

      // ── 3 · Rapid LB/RB presses coalesce (2 seats: odd count = other) ─
      for (const code of ['KeyE', 'KeyQ', 'KeyE', 'KeyQ', 'KeyQ']) {
        await page.keyboard.press(code);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(800);
      const settled = await railMc(page).textContent();
      expect(settled, 'rapid switching must settle on ONE coherent seat').not.toBe(null);
      // Panel and rail agree: bot grid ⇔ bot M€, human columns ⇔ own M€.
      const gridCount = await workspace.locator('.con-info__grid').count();
      if (gridCount > 0) {
        expect(settled).not.toBe(ownMc);
      } else {
        expect(settled).toBe(ownMc);
      }

      // ── 4 · A detail screen keeps the workspace grammar (A → VP, B back) ─
      if (await workspace.locator('.con-info__grid').count() > 0) {
        await key(page, 'KeyQ', 700); // land on the human seat (VP visible)
      }
      await key(page, 'Enter', 700);
      await expect(workspace.locator('.con-info__detail')).toHaveCount(1);
      await shoot(page, preset, '03-vp-detail');
      await key(page, 'Escape', 700);
      await expect(workspace.locator('.con-info__cols')).toHaveCount(1);

      // ── 5 · Close: the rail atomically returns to the OWN seat ─────
      await key(page, 'KeyY', 800);
      await expect(page.locator('.con-info')).toHaveCount(0);
      await expect(railMc(page)).toHaveText(ownMc);
      await shoot(page, preset, '04-closed-restored');

      // ── 6 · Reduced motion: the mode still switches cleanly ────────
      if (preset.id === 'standard-1080') {
        await page.emulateMedia({reducedMotion: 'reduce'});
        await key(page, 'KeyY', 700);
        await expect(page.locator('.con-info')).toHaveCount(1);
        await key(page, 'KeyE', 500);
        await expect(railMc(page)).not.toHaveText(ownMc);
        await key(page, 'KeyY', 600);
        await expect(page.locator('.con-info')).toHaveCount(0);
        await expect(railMc(page)).toHaveText(ownMc);
        await page.emulateMedia({reducedMotion: 'no-preference'});
      }
    });
  });
}
