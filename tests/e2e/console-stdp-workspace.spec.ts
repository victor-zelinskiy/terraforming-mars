import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, press} from './consoleStart';

/**
 * THE STANDARD-PROJECTS WORKSPACE IS ONE FLOW (the North-Star migration).
 *
 * The acceptance contract this spec fences:
 *  · the workspace OWNS the whole action: «Колония» and «Продажа патентов»
 *    open as NESTED STEPS inside the very same panel (`.con-stdp .con-colonies`
 *    / `.con-stdp .con-hand`), never as lateral screens;
 *  · B before the commit returns to the SAME list — same focused row, same
 *    money (pay-on-commit: nothing is spent until the target commits);
 *  · a placement project yields to the board and a CANCELLED placement
 *    reopens the list on the very row the player left;
 *  · a TERMINAL project commits from the root with a short committed beat and
 *    closes the whole workspace by itself — no second confirm, and rapid
 *    double-presses cannot submit twice (input is absorbed by phase);
 *  · the focused row's guaranteed result reads in the SHARED chip language
 *    (`.action-effect-chip` — the same component every composer renders);
 *  · the hand-dock PACK is covered by the panel (z under the band), never
 *    painted over the workspace.
 */

const OUT = path.resolve('screenshots', 'stdp-workspace');

function newGameConfig() {
  return {
    players: [{name: 'StdpFlow', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
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
    customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
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

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  return model.players[0].id;
}

const focusedRow = async (page: Page) =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

/** The viewer's M€ as the workspace header's wallet reads it. */
const walletNow = async (page: Page) =>
  Number((await page.locator('.con-stdp__wallet-now b').textContent().catch(() => '')) ?? 'NaN');

/** Walk the 2-column grid until the focused row matches. */
async function focusRow(page: Page, re: RegExp): Promise<void> {
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !re.test(await focusedRow(page)); i++) {
    await press(page, walk[i % walk.length], 260);
  }
  expect(re.test(await focusedRow(page)), `could not focus ${re}`).toBeTruthy();
}

async function openStdProjects(page: Page): Promise<void> {
  await press(page, 'Comma', 1100);
  await press(page, 'Enter', 1400);
  await page.waitForSelector('.con-stdp', {timeout: 15_000});
}

test('the Standard-Projects workspace owns the whole flow (nested steps, B-returns, terminal beat)', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Pluto'});
  await page.waitForTimeout(1500);

  await openStdProjects(page);

  // ── BROWSE: the projected result reads in the SHARED chip language and the
  // HUD carries the quiet ghost ring for the affected dial. ──
  await focusRow(page, /астероид/i);
  await page.waitForTimeout(400);
  expect(await page.locator('.con-stdp .action-effect-chip').count(),
    'the focused row must project its result in ActionEffectChip language').toBeGreaterThan(0);
  expect(await page.locator('.con-status__param--ghost').count(),
    'the affected HUD readout must carry the pre-select ghost ring').toBe(1);
  // The pay-on-commit projects additionally name their NEXT STEP.
  await focusRow(page, /город/i);
  await page.waitForTimeout(300);
  expect(((await page.locator('.con-stdp__context-next').textContent().catch(() => '')) ?? '').length,
    'a target project must name its next step').toBeGreaterThan(0);
  await shoot(page, '01-browse-previews');

  // ── THE COLONY STEP: nested INSIDE the same panel; B cancels for free. ──
  const before = await walletNow(page);
  await focusRow(page, /колония/i);
  await press(page, 'Enter', 2200);
  await page.waitForSelector('.con-stdp .con-colonies', {timeout: 15_000});
  expect(await page.locator('.con-colonies').count(), 'the colony step must exist').toBe(1);
  expect(await page.locator('.con-stdp .con-colonies').count(),
    'the colony pick must stand INSIDE the std-projects workspace, never as a lateral screen').toBe(1);
  // The crumb is the HOST's: root stays, the tail advances.
  expect((await page.locator('.con-stdp .con-wshead__root').textContent()) ?? '')
    .toMatch(/стандартные проекты/i);
  await shoot(page, '02-colony-step');
  await press(page, 'Escape', 2600); // B = server-side cancel (pay-on-commit)
  await page.waitForSelector('.con-stdp .con-colonies', {state: 'detached', timeout: 15_000});
  expect(await page.locator('.con-stdp').count(), 'the workspace must survive the cancel').toBe(1);
  expect(await focusedRow(page), 'the cancel must return to the very row').toMatch(/колония/i);
  expect(await walletNow(page), 'a cancelled colony pick must spend NOTHING').toBe(before);
  await shoot(page, '03-colony-cancelled-back');

  // ── THE SALE STEP: the hand nested inside; B folds back with nothing sold. ──
  await focusRow(page, /продажа патентов/i);
  await press(page, 'Enter', 1800);
  await page.waitForSelector('.con-stdp .con-hand', {timeout: 15_000});
  await shoot(page, '04-sale-step');
  await press(page, 'Escape', 1200);
  await page.waitForSelector('.con-stdp .con-hand', {state: 'detached', timeout: 15_000});
  expect(await focusedRow(page), 'the fold must return to the sale row').toMatch(/продажа патентов/i);
  expect(await walletNow(page), 'a folded sale must gain NOTHING').toBe(before);

  // ── THE PLACEMENT STEP: the board serves it; a cancel REOPENS the list on
  // the very row the player left. ──
  await focusRow(page, /город/i);
  await press(page, 'Enter', 2600);
  await page.waitForSelector('.con-stdp', {state: 'detached', timeout: 15_000});
  await shoot(page, '05-city-placement');
  await press(page, 'Escape', 2600); // B = cancel placement (server restores the menu)
  await page.waitForSelector('.con-stdp', {timeout: 15_000});
  expect(await focusedRow(page), 'the cancelled placement must reopen on the same row').toMatch(/город/i);
  expect(await walletNow(page), 'a cancelled placement must spend NOTHING').toBe(before);
  await shoot(page, '06-city-cancelled-back');

  // ── THE DOCK PACK is COVERED by the panel (never painted over it). ──
  const packZ = await page.evaluate(() => {
    const pack = document.querySelector('.con-handdock__pack');
    return pack === null ? '' : getComputedStyle(pack).zIndex;
  });
  expect(Number(packZ), 'the dock pack must sit UNDER the band surfaces while the workspace is open')
    .toBeLessThan(11480);

  // ── THE TERMINAL COMMIT: one press, a committed beat, then the workspace
  // closes itself — and a rapid double-press cannot submit twice. ──
  await focusRow(page, /электростанция/i);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // absorbed by the executing phase
  await page.keyboard.press('Enter');
  await page.waitForSelector('.con-stdp__card--committed', {timeout: 10_000});
  await shoot(page, '07-terminal-commit-beat');
  await page.waitForSelector('.con-stdp', {state: 'detached', timeout: 10_000});
  await page.waitForTimeout(800);
  const railEnergyProd = await page.evaluate(() => {
    const cell = document.querySelector('[data-res-row="energy"] [data-res-production], .con-res [data-production="energy"]');
    return cell?.textContent ?? '';
  });
  void railEnergyProd; // informational — the authoritative check is the wallet:
  await openStdProjects(page);
  const after = await walletNow(page);
  expect(after, 'Power Plant (11 M€) must be paid exactly ONCE — a double-press must not double-submit')
    .toBe(before - 11);
  await shoot(page, '08-after-terminal');
});
