import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * HAND REVEAL probe — the dock ↔ hand-overlay physical transition
 * (handRevealDirector.ts). Drives a real game and verifies the episode
 * contracts live:
 *  - mid-open: proxies fly while BOTH ends are held (one card — one
 *    visible representation);
 *  - settled open: proxies gone, slots released, dock pack lifted;
 *  - `B` mid-open: the same timeline reverses back to the dock;
 *  - reopen mid-close: the gather reverses back to the open hand;
 *  - reduced motion: no proxies, instant states;
 *  - handheld + tv profiles boot the same choreography.
 * Screenshots to screenshots/hand-reveal/ for the motion review.
 */

const OUT = path.resolve('screenshots', 'hand-reveal');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'RevealTester', color: 'red', beginner: false, handicap: 0, first: true}],
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

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function bootGame(page: Page, request: any, buyProjects: number, profileQuery = ''): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1${profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  const walk: Array<string> = ['Enter', 'Period', 'Enter', 'ArrowRight', 'Enter', 'Period'];
  for (let i = 0; i < buyProjects; i++) {
    walk.push('Enter', 'ArrowRight');
  }
  walk.push('Period', 'Period', 'Period');
  for (const code of walk) {
    await key(page, code, code === 'Period' ? 1600 : 1000);
  }
  await page.waitForTimeout(3000);
  const live = page.locator('.con-handdock--live');
  const placement = page.locator('.con-context__task-kicker');
  const wizard = page.locator('.con-start__frame');
  const quick = page.locator('.con-quick');
  const handSec = page.locator('.con-hand');
  const composer = page.locator('.con-composer');
  const banner = page.locator('.con-banner');
  const finishers = ['ArrowRight', 'Enter', 'Period'];
  const dirs = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 36 && (await live.count() === 0 || await placement.count() > 0); i++) {
      if (await quick.count() > 0) {
        await key(page, 'Escape', 1100);
      } else if (await composer.count() > 0) {
        await key(page, 'KeyX', 1600); // the play composer confirms on X
      } else if (await handSec.count() > 0) {
        await key(page, await banner.count() > 0 ? 'Escape' : 'Enter', 1400);
      } else if (await wizard.count() > 0) {
        await key(page, finishers[i % finishers.length], 900);
      } else if (await placement.count() > 0) {
        await key(page, dirs[i % dirs.length], 700);
        await key(page, 'Enter', 1500);
      } else {
        await key(page, 'Enter', 1500);
      }
    }
    await page.waitForTimeout(2500);
    if (await live.count() === 1 && await placement.count() === 0) {
      break;
    }
  }
  await expect(live).toHaveCount(1);
  await page.waitForTimeout(1000);
}

/** Wait for the first reveal proxy (spawn is a couple frames after A). */
async function expectProxies(page: Page): Promise<void> {
  await expect(page.locator('.con-handreveal-layer .con-deal-proxy').first()).toBeVisible({timeout: 2000});
}

/** Fire RT-wheel → A («КАРТЫ») WITHOUT the per-key settle — the reveal
 *  starts on the A frame and we want to observe it mid-flight. */
async function openHandFast(page: Page): Promise<void> {
  await page.keyboard.press('Period');
  await page.waitForTimeout(350); // the wheel opens
  await page.keyboard.press('Enter');
}

test.describe('hand reveal · standard 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('open: proxies fly while both ends are held; settle releases everything', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request, 3);
    const dockBacks = await page.locator('.con-handdock__card').count();
    expect(dockBacks).toBeGreaterThan(0);

    await openHandFast(page);
    await expectProxies(page); // mid-flight — the episode is airborne
    // ONE visible representation: proxies exist, slots held, dock lifted.
    await expect(page.locator('.con-hand--transit')).toHaveCount(1);
    await expect(page.locator('.con-handdock--lifted')).toHaveCount(1);
    await shoot(page, '01-mid-open');

    await page.waitForTimeout(2100); // settle (open ≈ lift 140 + flight 600 + spread + handoff)
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    await expect(page.locator('.con-handdock--lifted')).toHaveCount(1); // cards live in the hand
    const slots = await page.locator('.con-hand__slot').count();
    expect(slots).toBeGreaterThan(0);
    await shoot(page, '02-open-settled');

    // ── close: the gather back into the dock ────────────────────────
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100); // mid-gather
    await expectProxies(page);
    await shoot(page, '03-mid-close');
    await page.waitForTimeout(1700);
    await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    await expect(page.locator('.con-handdock--lifted')).toHaveCount(0);
    await expect(page.locator('.con-board')).toBeVisible();
    expect(await page.locator('.con-handdock__card').count()).toBe(dockBacks);
    await shoot(page, '04-docked-again');
  });

  test('B mid-open reverses the SAME flight back to the dock', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request, 2);

    for (const holdMs of [80, 400]) { // build-window cancel and ~50% of the open
      await openHandFast(page);
      await page.waitForTimeout(holdMs);
      await page.keyboard.press('Escape'); // reverse from current progress
      await page.waitForTimeout(120);
      if (holdMs === 400) {
        // Still ONE representation while reversing (the 80ms case cancels
        // from ~0 progress — its proxies may already be handing off).
        await expectProxies(page);
        await shoot(page, '05-mid-reverse');
      }
      await page.waitForTimeout(1900);
      // Back home: board + full dock pack, nothing stuck.
      await expect(page.locator('.con-board')).toBeVisible();
      await expect(page.locator('.con-handdock--lifted')).toHaveCount(0);
      await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
      expect(await page.locator('.con-handdock__card').count()).toBeGreaterThan(0);
    }
    await shoot(page, '06-after-reversals');
  });

  test('reopen mid-close reverses the gather back to the open hand', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request, 3);

    await openHandFast(page);
    await page.waitForTimeout(2200); // fully open
    await page.keyboard.press('Escape'); // gather begins
    await page.waitForTimeout(130);
    // Reopen mid-close: the dock click is the entry (RT needs the wheel).
    await page.mouse.click(960, 1035);
    await page.waitForTimeout(120);
    await expectProxies(page);
    await shoot(page, '07-mid-reopen');
    await page.waitForTimeout(2000);
    // Landed OPEN again: hand section up, slots visible, no proxies.
    await expect(page.locator('.con-hand')).toHaveCount(1);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    await shoot(page, '08-reopened');
  });
});

test.describe('hand reveal · reduced motion', () => {
  test.use({
    viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080}, reducedMotion: 'reduce',
  });

  test('no proxies — instant, connected states', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request, 2);
    await openHandFast(page);
    await page.waitForTimeout(250);
    await expect(page.locator('.con-hand')).toHaveCount(1);
    await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handdock--lifted')).toHaveCount(1);
    await shoot(page, '09-reduced-open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(page.locator('.con-board')).toBeVisible();
    await expect(page.locator('.con-handdock--lifted')).toHaveCount(0);
  });
});

test.describe('hand reveal · deck handheld', () => {
  test.use({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, screen: {width: 1280, height: 800}});

  test('handheld: the same episode plays and settles', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request, 3);
    await openHandFast(page);
    await expectProxies(page);
    await shoot(page, '10-handheld-mid-open');
    await page.waitForTimeout(2000);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    await shoot(page, '11-handheld-open');
  });
});

test.describe('hand reveal · tv 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('tv profile: the same episode plays and settles', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootGame(page, request, 2, '&consoleProfile=tv');
    await openHandFast(page);
    await expectProxies(page);
    await shoot(page, '12-tv-mid-open');
    await page.waitForTimeout(2000);
    await expect(page.locator('.con-hand--transit')).toHaveCount(0);
    await expect(page.locator('.con-handreveal-layer .con-deal-proxy')).toHaveCount(0);
    await shoot(page, '13-tv-open');
  });
});
