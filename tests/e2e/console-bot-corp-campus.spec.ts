import {expect, test, Page} from './consoleTest';
import {bootSeededGame, corporationsExcluding, openBotScreenHub, press, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * FERRUS ACADEMY (CF1) — the fork's own bot card, «the Campus» (docs/AUTOMA_DATA_AUDIT.md §20). At the table's
 * setup the bot founds its Academy (a city) and reserves the adjacent free land with its cubes. This probe reads
 * both off the SERVER's model at the first action phase, then the corporation's own face on the bot screen.
 */

const CAMPUS_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'CF1'},
  // The human's deal must NOT contain Ferrus Academy (the collision rule would seat another bot corporation).
  customCorporationsList: corporationsExcluding('Ferrus Academy'),
});

type Space = {id: string, color?: string, tileType?: number};

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that founds a Campus', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the Academy city and its Campus cubes stand at the start; the face names the Campus', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: CAMPUS_CONFIG});
    expect(created.ok(), 'the server accepted the automa config').toBeTruthy();
    const {players} = await created.json();
    await bootSeededGame(page, request, players[0].id, {query: '&consoleProfile=tv'});

    // ── Server truth: one bot city, and its cubes (a bot colour on a cell with no tile) around it ──
    const model = await (await request.get(`/api/player?id=${players[0].id}`)).json();
    const bot = (model.players as Array<{color: string, isMarsBot?: boolean}>).find((p) => p.isMarsBot === true);
    expect(bot, 'the bot seat').toBeTruthy();
    const spaces: Array<Space> = model.game.spaces;
    const cubes = spaces.filter((s) => s.color === bot!.color && s.tileType === undefined);
    const tiles = spaces.filter((s) => s.color === bot!.color && s.tileType !== undefined);
    expect(tiles.length, 'the Academy city is on the board').toBeGreaterThanOrEqual(1);
    expect(cubes.length, `the Campus cubes: ${JSON.stringify(cubes.map((s) => s.id))}`).toBeGreaterThanOrEqual(1);
    await page.screenshot({path: 'screenshots/bot-corp-campus-board.png', fullPage: false});

    // ── The corporation's face on the bot screen ──
    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/ferrus/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'science + city').toHaveCount(2);
    await face.screenshot({path: 'screenshots/bot-corp-campus-face.png'});
  });
});
