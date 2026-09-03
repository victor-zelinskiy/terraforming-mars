import {expect, test} from '@playwright/test';
import {openBotBoardDetail, bootToBoard, corporationsExcluding, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * POSEIDON (C33) — the first corporation whose Setup box puts something on the
 * SHARED table: the bot founds a colony before the first turn, and that very
 * colony pays its own effect («including during setup of this card»), so the
 * player meets a game that already has a bot colony out there AND a bot track
 * one step up.
 *
 * Both halves are open information the player reads on two different screens,
 * so the probe reads both: the colonies screen for the settlement, the bot mat
 * for the step it bought.
 */

const POSEIDON_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C33'},
  expansions: {colonies: true},
  // The human's own deal must NOT contain Poseidon: the collision rule (RB-B
  // Setup 1) would legitimately hand the bot a different corporation. The list
  // has to fill ALL EIGHT dealt slots — it is cards-on-top, not a restriction.
  customCorporationsList: corporationsExcluding('Poseidon'),
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: a MarsBot corporation that settles at setup', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the bot already holds a colony, and its mat already shows the step it bought', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: POSEIDON_CONFIG});
    expect(created.ok(), 'the server accepted the automa config').toBeTruthy();
    const {players} = await created.json();
    const id = players[0].id;

    // The SERVER's own answer first: one bot colony, one bought step. The
    // screens below are how the player sees it; this is what is true.
    await page.goto(`/player?id=${id}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});

    await bootToBoard(page);

    const model = await (await request.get(`/api/player?id=${id}`)).json();
    const stats = model.game?.automa?.corporation?.stats ?? {};
    expect(stats.poseidonBotColonies, 'the setup founded one').toBe(1);
    expect(stats.poseidonSteps, 'and that colony paid its own effect').toBe(1);

    // Information workspace → the BOT seat.
    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/poseidon/i);

    // The bot mat: exactly ONE track has moved, and it is the topmost.
    await openBotBoardDetail(page);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();
    const positions = await tracks.locator('.mb-track__pos').evaluateAll(
      (nodes) => nodes.map((n) => Number.parseInt(n.textContent ?? '0', 10)));
    expect(positions.filter((p) => p > 0).length,
      `exactly one track moved; saw ${JSON.stringify(positions)}`).toBe(1);
    expect(positions[0], 'and «topmost if tied» made it the first one').toBeGreaterThan(0);

    await page.screenshot({path: 'screenshots/bot-corp-colony-setup.png', fullPage: false});
  });
});
