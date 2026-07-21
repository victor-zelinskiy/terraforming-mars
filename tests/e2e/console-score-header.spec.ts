import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console score header (.con-score — TR + VP above the resource rows):
 * screenshot evidence across the display profiles + a smoke assertion that
 * the cap mounts with live numbers (and masks the VP behind the eye-off when
 * the local «Приватный счёт» pref is on). Gallery goes to
 * `screenshots/score-header/<preset>/`.
 */

const OUT_ROOT = path.resolve('screenshots', 'score-header');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  deviceScaleFactor: number;
  profileQuery: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, profileQuery: ''},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, profileQuery: ''},
  {id: 'compact-720', viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, profileQuery: ''},
];

/** Full NewGameConfig — deterministic solo base+corpEra+prelude game. */
function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'ScoreTester', color: 'red', beginner: false, handicap: 0, first: true}],
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
  };
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

/** The rail + a margin of board context (chips / aux column live just outside). */
async function shootRail(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  const box = await page.locator('.con-res-host').boundingBox();
  if (box === null) {
    return;
  }
  const pad = 24;
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(preset.viewport.width - Math.max(0, box.x - pad), box.width + pad * 4),
      height: Math.min(preset.viewport.height - Math.max(0, box.y - pad), box.height + pad * 2),
    },
  });
}

async function bootIntoGame(page: Page, preset: Preset, playerId: string): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1${preset.profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  // Walk the start wizard state-aware (extra presses are inert per step).
  for (let i = 0; i < 24; i++) {
    if (await page.locator('.con-start__frame').count() === 0) {
      break;
    }
    await key(page, 'Enter', 1300);
    await key(page, 'KeyE', 900);
    if (i % 2 === 1) {
      await key(page, 'ArrowRight', 400);
    }
  }
  await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) {
    if (await page.locator('.con-start__frame, .con-task-host').count() === 0) {
      break;
    }
    await key(page, 'Enter', 2600);
  }
  await page.waitForTimeout(2500);
}

for (const preset of PRESETS) {
  test.describe(`console score header · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: preset.deviceScaleFactor,
      screen: preset.viewport,
    });

    test('captures the TR/VP score cap', async ({page, request}) => {
      test.setTimeout(preset.viewport.width * preset.deviceScaleFactor >= 3840 ? 420_000 : 240_000);

      const created = await request.post('/api/creategame', {data: newGameConfig()});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};
      const playerId = model.players[0].id;

      await bootIntoGame(page, preset, playerId);

      // The cap mounted with live numbers.
      const score = page.locator('.con-score');
      await expect(score).toBeVisible();
      await expect(page.locator('.con-score__value--tr')).toHaveText(/^\d+$/);
      await expect(page.locator('.con-score__cell--vp .con-score__value')).toHaveText(/^-?\d+$/);
      // The cap never overflows its rail horizontally.
      const railBox = await page.locator('.con-res').boundingBox();
      const capBox = await score.boundingBox();
      expect(capBox!.x).toBeGreaterThanOrEqual(railBox!.x - 1);
      expect(capBox!.x + capBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width + 1);

      await shoot(page, preset, '01-board');
      await shootRail(page, preset, '02-rail');

      // Masked own VP (the local «Приватный счёт» display pref): eye-off in
      // place of the number, identical footprint.
      await page.evaluate(() => localStorage.setItem('tm.privateScoreDisplay.enabled', '1'));
      await page.reload();
      await page.waitForSelector('.con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await page.waitForTimeout(3000);
      await expect(page.locator('.con-score .vp-private')).toBeVisible();
      expect(await page.locator('.con-score__cell--vp .con-score__value').count()).toBe(0);
      await expect(page.locator('.con-score__value--tr')).toHaveText(/^\d+$/);
      await shootRail(page, preset, '03-rail-vp-masked');
      await page.evaluate(() => localStorage.setItem('tm.privateScoreDisplay.enabled', '0'));
    });
  });
}
