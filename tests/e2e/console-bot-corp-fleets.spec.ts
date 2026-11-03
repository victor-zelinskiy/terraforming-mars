import {expect, test, Page} from './consoleTest';
import {bootSeededGame, corporationsExcluding, openBotScreenHub, press, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * VEYNON DYNAMICS (CF2) — the fork's own bot card, «Mechs in the Hold» (docs/AUTOMA_DATA_AUDIT.md §20): mechs on the
 * corporation card assemble REAL trade fleets. At the start the bot owns one fleet (the table counts it) and holds the
 * starting mech plus its Jovian tag's — the face's capsule shows them; the bot screen names the fleets.
 */

const FLEETS_CONFIG = soloGameConfig({
  expansions: {colonies: true},
  automa: {difficulty: 'normal', corporation: 'CF2'},
  // The human's deal must NOT contain Veynon Dynamics (the collision rule would seat another bot corporation).
  customCorporationsList: corporationsExcluding('Veynon Dynamics'),
});

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that builds its trade fleets from mechs', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('one real fleet at the start, the mechs on the face', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: FLEETS_CONFIG});
    expect(created.ok(), 'the server accepted the automa config').toBeTruthy();
    const {players} = await created.json();
    await bootSeededGame(page, request, players[0].id, {query: '&consoleProfile=tv'});

    // ── Server truth: the bot's fleets are its player's, and the model says how many ──
    const model = await (await request.get(`/api/player?id=${players[0].id}`)).json();
    const bot = (model.players as Array<{color: string, isMarsBot?: boolean, fleetSize: number}>).find((p) => p.isMarsBot === true);
    expect(bot, 'the bot seat').toBeTruthy();
    expect(bot!.fleetSize, 'one fleet at the start').toBeGreaterThanOrEqual(1);
    expect(model.game.automa?.tradeFleets, 'the bot model counts the same fleets').toBe(bot!.fleetSize);

    // ── The corporation's face on the bot screen ──
    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/veynon/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'Jovian + Venus').toHaveCount(2);
    await expect(face.locator('.pcard__res'), 'the mech store').toBeVisible();
    await face.screenshot({path: 'screenshots/bot-corp-fleets-face.png'});
  });
});
