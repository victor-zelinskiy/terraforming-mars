import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame} from './consoleStart';

/**
 * The IN-GAME SYSTEM overlay (`.con-sys--menu`) and the settings console it
 * opens — the two surfaces the Menu button reaches, which now share ONE
 * premium chassis (`.con-sys`: same card, crumb head and foot bar).
 *
 * What it guards:
 *  · the two surfaces really are the same chassis (same card class, same head);
 *  · the exit confirmation is a STAGE of the menu — the crumb GAINS a tail and
 *    the frame does not move, instead of a second dialog arriving;
 *  · «Диагностика» deep-links into the settings console's minor category
 *    rather than rendering a second, hand-built readout;
 *  · the in-game context drops the shell switch and gains ЭТА ПАРТИЯ;
 *  · B walks back exactly one logical level each time.
 *
 * The overlay is Menu-button-owned, so this drives it through the keyboard
 * route (`KeyM` → consoleSystemMenuBridge) — the same route a desktop-fallback
 * player uses.
 */

const OUT = path.resolve('screenshots', 'console-system-menu');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'SysMenuTester', color: 'red', beginner: false, handicap: 0, first: true}],
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

/**
 * ACT → VERIFY → RETRY: the board home settles asynchronously, so a Menu press
 * can land while something else still owns input and simply do nothing.
 */
async function openSystemMenu(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await key(page, 'KeyM', 500);
    if (await page.locator('.con-sys--menu').count() > 0) {
      return;
    }
  }
  expect(await page.locator('.con-sys--menu').count(), 'the system overlay never opened').toBeGreaterThan(0);
}

test.describe('the in-game system overlay + its settings console', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('one chassis: the menu, its exit stage, and the settings it deep-links into', async ({page, request}) => {
    test.setTimeout(240_000);
    // The pregame is SETUP for this spec — the subject is an overlay reached
    // from the board home — so the shared driver ANSWERS it over the API and
    // the console opens on a running game (`buy: 2` = a real hand).
    await bootIntoGame(page, request, {config: newGameConfig(), buy: 2});

    // ── The menu itself ──────────────────────────────────────────────
    await openSystemMenu(page);
    await expect(page.locator('.con-sys__crumb-root')).toHaveText('Система');
    // Nothing has been entered yet, so the crumb has no tail.
    await expect(page.locator('.con-sys__crumb-stage')).toHaveCount(0);
    await expect(page.locator('.con-sysact__plate')).toHaveCount(5);
    // Every plate carries a static sub — a fixed-shape list, never a value.
    await expect(page.locator('.con-sysact__sub').first()).not.toBeEmpty();
    await shoot(page, '01-system-menu');

    const card = page.locator('.con-sys__card');
    const menuBox = await card.boundingBox();

    // ── The exit confirmation is a STAGE, not a second dialog ────────
    await page.locator('.con-sysact__plate', {hasText: 'В главное меню'}).click();
    await page.waitForTimeout(450);
    await expect(page.locator('.con-sys__crumb-root')).toHaveText('Система');
    await expect(page.locator('.con-sys__crumb-stage')).toHaveText('Выйти');
    // The frame did not move — the same card gained a tail and swapped verbs.
    expect((await card.boundingBox())?.x).toBe(menuBox?.x);
    await expect(page.locator('.con-sys__hint--danger')).toHaveCount(1);
    await shoot(page, '02-exit-stage');
    // B is one logical level: back to the plate list.
    await key(page, 'Escape', 500);
    await expect(page.locator('.con-sysact__plate')).toHaveCount(5);

    // ── «Диагностика» deep-links into the settings console ───────────
    await page.locator('.con-sysact__plate', {hasText: 'Диагностика'}).click();
    await page.waitForTimeout(500);
    // The SAME chassis — a settings surface, opened on its minor category. The
    // swap is INSTANT: exactly ONE `.con-sys` exists at any moment, never two
    // cards crossfading over two stacked backdrops.
    await expect(page.locator('.con-sys')).toHaveCount(1);
    await expect(page.locator('.con-sys--settings')).toHaveCount(1);
    await expect(page.locator('.con-sys__crumb-root')).toHaveText('Настройки');
    await expect(page.locator('.con-set__tab', {hasText: 'Диагностика'})).toHaveClass(/con-set__tab--current/);
    // ONE readout, not a second hand-built panel: the connection group is here.
    await expect(page.locator('.con-set__group').filter({hasText: 'Связь'})).toHaveCount(1);
    await shoot(page, '03-diagnostics-deeplink');
    await key(page, 'Escape', 500);
    await expect(page.locator('.con-sys')).toHaveCount(1);
    await expect(page.locator('.con-sys--menu')).toHaveCount(1);

    // ── «Настройки»: the in-game shape of the settings console ───────
    await page.locator('.con-sysact__plate', {hasText: 'Настройки'}).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.con-set__tab', {hasText: 'Интерфейс'})).toHaveClass(/con-set__tab--current/);
    // In-game drops the shell switch (swapping shells mid-game is jarring)…
    await expect(page.locator('.con-set__row', {hasText: 'Оболочка'})).toHaveCount(0);
    // …and gains the per-game category with the private-score mask.
    await page.locator('.con-set__tab', {hasText: 'Партия'}).click();
    await page.waitForTimeout(400);
    await expect(page.locator('.con-set__row', {hasText: 'Приватный счёт'})).toHaveCount(1);
    // The HIGHLIGHT must follow the pane — exactly one tab is current, and it
    // is this one. (A strip that marks a category the pane is not showing is
    // worse than no strip at all.)
    await expect(page.locator('.con-set__tab--current')).toHaveCount(1);
    await expect(page.locator('.con-set__tab', {hasText: 'Партия'})).toHaveClass(/con-set__tab--current/);
    await shoot(page, '04-settings-in-game');

    // ── B walks back one level at a time, and the game is still there ─
    await key(page, 'Escape', 500);
    await expect(page.locator('.con-sys--menu')).toHaveCount(1);
    await key(page, 'Escape', 600);
    await expect(page.locator('.con-sys')).toHaveCount(0);
    await expect(page.locator('.con-root')).toHaveCount(1);
    await shoot(page, '05-back-to-board');
  });
});
