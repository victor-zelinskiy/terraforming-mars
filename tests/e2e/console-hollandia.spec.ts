import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, commitFocusedSpace, fetchPlayerModel, openBotBoardDetail, openBotScreenHub, press, pressUntilVisible, settle, walkToSpace,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * HOLLANDIA on the console — the fifth fan map, the last map to get MarsBot (docs/AUTOMA_DATA_AUDIT.md §2j / §23), and
 * the map of the ASTEROID DEFLECTION ZONE: «while ALL your tiles are inside the zone, your plants cannot be removed».
 *
 *  1. THE ZONE, on the real board (fixture `hollandia-zone` — two seats, red already inside AND outside it). The
 *     twelve cells wear ONE violet ground (never the legacy yellow wash), a zone cell under a tile keeps the zone's
 *     kant over the tile's art, ONE marker names the rule, the legal candidates keep their type's face. The cell's
 *     dossier has the zone's own section: the rule, then every seat's standing. The viewer's first greenery inside the
 *     zone turns the shelter ON (the dossier says so before the press, the rail's plants wear the shield); the next
 *     one, on the neighbour outside the wedge, is WARNED about before the press and turns it OFF.
 *  2. MARSBOT (fixture `hollandia-marsbot`). The map has no milestone row of its own, so the set is drawn and the bot
 *     plays the generator's mat on the borrowed Tharsis base — the briefing in «Экран бота» says so; the bot's one tile
 *     stands inside the zone and the dossier reads it as sheltered, like any seat; the bot plays the round the player
 *     hands over and the next generation begins.
 * Evidence → screenshots/hollandia/.
 */

const OUT = path.resolve('screenshots', 'hollandia');
const PROFILE = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const ZONE = ['07', '12', '13', '18', '19', '20', '26', '27', '28', '35', '36', '37'];
const ZONE_CENTRE = '19';
const INSIDE = '26';
const OUTSIDE = '25';
const RED_INSIDE = '37';

type View = {
  game: {
    generation: number,
    gameOptions: {boardName: string},
    spaces: Array<{id: string, tileType?: number, color?: string}>,
    automa?: {briefing?: Array<{message: string}>, tracks: Array<unknown>},
  },
  thisPlayer: {megacredits: number, protectedResources?: Record<string, string>},
  players: Array<{color: string, isMarsBot?: boolean}>,
  waitingFor?: {type?: string},
};

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The board alone, at its painted size — what the zone looks like on the field. */
async function shootBoard(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.locator('.board-cont').first().screenshot({path: path.join(OUT, `${name}.png`)});
}

const dossier = async (page: Page): Promise<string> =>
  (await page.locator('.con-context').innerText().catch(() => '')).replace(/\s+/g, ' ');

/** What the field paints for the zone: every layer's cell, whether a tile covers it, and its decoded background. */
async function zoneLayers(page: Page): Promise<Array<{id: string, covered: boolean, bg: string, available: boolean}>> {
  return await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-deflection-zone]')).map((el) => {
    const cell = el.closest('[data_space_id]');
    return {
      id: cell?.getAttribute('data_space_id') ?? '?',
      covered: el.classList.contains('board-space-type-deflection-zone--covered'),
      bg: decodeURIComponent(getComputedStyle(el).backgroundImage),
      available: cell?.classList.contains('board-space--available') ?? false,
    };
  }));
}

/** L3 → the inspection on `id`, read once ITS zone section stands. */
async function inspectZoneCell(page: Page, id: string): Promise<string> {
  if (await page.locator('.con-board--inspecting').count() === 0) {
    await press(page, 'KeyC', 900);
  }
  await walkToSpace(page, id);
  const section = page.locator('.con-context [data-dossier-section="zone"]');
  await expect(section, `the zone's own section in the dossier of ${id}`).toHaveCount(1, {timeout: 20_000});
  await expect.poll(async () => await page.evaluate(() => document.querySelector('.con-context .con-cellp__hex--c')?.className ?? ''),
    {timeout: 20_000, message: `the portrait of ${id} stands`}).toMatch(/con-cellp__hex/);
  return (await section.innerText()).replace(/\s+/g, ' ');
}

async function leaveInspection(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator('.con-board--inspecting').count() > 0; i++) {
    await press(page, 'Escape', 900);
  }
  await settle(page);
}

/** LT wheel → Standard Projects → «Озеленение» → its cell prompt. */
async function startGreenery(page: Page, request: APIRequestContext, playerId: string): Promise<void> {
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/^\s*озеленение\s*$/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(/^\s*озеленение\s*$/i.test(await focusedName()), 'could not focus «Озеленение»').toBeTruthy();
  await press(page, 'Enter', 1800);
  if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
    await press(page, 'KeyX', 2200);
  }
  await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '',
    {timeout: 30_000, message: '«Озеленение» asks for its cell'}).toBe('space');
}

async function botOnStage(page: Page): Promise<void> {
  await pressUntilVisible(page, 'KeyY', '.con-info', {tries: 3, settleMs: 1200});
  const corpLine = page.locator('.con-info__corp--bot');
  for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
    await press(page, 'KeyE', 900);
  }
  await expect(corpLine, 'the bot seat is on stage').toHaveCount(1);
}

async function leaveInfo(page: Page): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-info').count() > 0; i++) {
    await press(page, 'Escape', 900);
  }
  await settle(page);
}

test.describe(`Hollandia (fan map) · ${PROFILE.id}`, () => {
  test.use({viewport: PROFILE.viewport, deviceScaleFactor: 1, screen: PROFILE.viewport});

  test('the Deflection Zone: one violet region, its dossier by seat, the shelter ON inside and OFF outside', async ({page, request}) => {
    test.setTimeout(480_000);
    const playerId = await bootFixture(page, request, 'hollandia-zone', {query: PROFILE.query});
    await settle(page);
    await armLeakWitness(page);
    const before = await view(request, playerId);
    expect(before.game.gameOptions.boardName).toBe('Hollandia');
    expect(before.thisPlayer.protectedResources?.plants, 'no tile yet — no shelter').toBe('off');
    await shoot(page, '00-board');
    await shootBoard(page, '00-board-field');

    // ── THE FIELD ──────────────────────────────────────────────────────────
    const board = await page.evaluate(() => ({
      captions: document.querySelector('#board_legend')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      markers: Array.from(document.querySelectorAll('.special-cell-marker')).map((m) =>
        Array.from(m.classList).find((c) => /^board-space-\d+$/.test(c)) ?? '?').filter((c) => !/^board-space-0[12]$/.test(c)).sort(),
    }));
    const layers = await zoneLayers(page);
    console.log('── the field ──', JSON.stringify(board), JSON.stringify(layers.map((l) => `${l.id}${l.covered ? '*' : ''}`)));
    expect(board.captions, 'no legacy SVG caption on this map').toBe('');
    expect(board.markers, 'ONE marker — the zone\'s, on its central cell').toEqual([`board-space-${ZONE_CENTRE}`]);
    expect(layers.map((l) => l.id).sort(), 'the twelve cells of the zone wear its layer').toEqual(ZONE);
    for (const layer of layers) {
      expect(layer.bg, `${layer.id}: the legacy yellow wash is gone`).not.toMatch(/255,\s*240,\s*140/);
      if (layer.covered) {
        expect(layer.bg, `${layer.id}: over a tile only the kant comes up`).toMatch(/fill='none'/);
      } else {
        expect(layer.bg, `${layer.id}: the zone's violet ground`).toMatch(/148,108,236/);
      }
    }
    expect(layers.filter((l) => l.covered).map((l) => l.id), 'red\'s greenery inside the zone wears the kant').toEqual([RED_INSIDE]);
    // The zone's ground is UNDER the printed bonus: on a zone cell that prints one, the bonus is painted on top.
    const bonusOnTop = await page.evaluate(() => {
      const cell = Array.from(document.querySelectorAll<HTMLElement>('[data_space_id]'))
        .find((el) => el.querySelector('[data-deflection-zone]') !== null && el.querySelector('.board-space-bonus') !== null);
      const icon = cell?.querySelector<HTMLElement>('.board-space-bonus');
      const ground = cell?.querySelector<HTMLElement>('[data-deflection-zone]');
      if (icon === null || icon === undefined || ground === null || ground === undefined) {
        return 'no zone cell with a bonus';
      }
      // DOM order is paint order here (both are painted layers of one cell): the ground must come first.
      return (ground.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ? 'bonus over ground' : 'ground over bonus';
    });
    expect(bonusOnTop, 'the printed bonus is never washed by the zone\'s colour').toBe('bonus over ground');

    // ── THE DOSSIER: the rule, then every seat ─────────────────────────────
    const centre = await inspectZoneCell(page, ZONE_CENTRE);
    console.log('── the zone section (19) ──', centre);
    expect(centre).toMatch(/Зона отклонения/i);
    // (The seat's name is a tracked-caps head — «ВЫ».)
    expect(centre, 'the viewer: no tile in the zone yet').toMatch(/Вы\s+Нет тайлов в зоне/i);
    // The marker's cell prints the rule ONCE — as the lore at the column's foot, never a second time in the section.
    expect(centre.match(/пока ВСЕ ваши тайлы/g)?.length ?? 0, 'the rule is not said twice in the section').toBe(0);
    expect(await dossier(page), 'the rule stands at the foot of the marker\'s cell').toMatch(/пока ВСЕ ваши тайлы/);
    expect(centre, 'red: inside AND outside').toMatch(/Тайлы вне зоны/);
    expect(await page.locator('.con-context [data-dossier-section="zone"] .con-context__grp').count(), 'a group per seat').toBe(2);
    expect(await page.evaluate(() => document.querySelector('.con-context .con-cellp__hex--c')?.className ?? ''),
      'the portrait wears the zone\'s ground').toMatch(/con-cellp__hex--deflection/);
    await settle(page);
    await shoot(page, '01-zone-dossier');
    // The occupied zone cell keeps the zone's section — the rule outlives the tile.
    const occupied = await inspectZoneCell(page, RED_INSIDE);
    expect(occupied).toMatch(/Тайлы вне зоны/);
    expect(occupied, 'off the marker\'s cell the section carries the rule\'s own sentence').toMatch(/пока ВСЕ ваши тайлы/);
    await leaveInspection(page);

    // ── INSIDE: the shelter turns ON ───────────────────────────────────────
    await startGreenery(page, request, playerId);
    const candidates = (await zoneLayers(page)).filter((l) => l.available);
    console.log('── zone candidates ──', candidates.length);
    expect(candidates.length, 'the zone\'s free cells are legal greenery cells').toBeGreaterThan(0);
    expect(candidates.filter((l) => !/148,108,236/.test(l.bg)), 'a candidate keeps the zone\'s ground').toEqual([]);
    await walkToSpace(page, INSIDE);
    await expect.poll(async () => await dossier(page), {timeout: 20_000, message: 'the placement says what it does to the shelter'})
      .toMatch(/Включает защиту от уничтожения растений/);
    await settle(page);
    await shoot(page, '10-inside-aimed');
    expect(await commitFocusedSpace(page), 'the greenery landed inside the zone').toBeTruthy();
    await expect.poll(async () => (await view(request, playerId)).thisPlayer.protectedResources?.plants,
      {timeout: 40_000, message: 'the server shelters the viewer\'s plants'}).toBe('on');
    await settle(page, {timeoutMs: 60_000});
    await expect(page.locator('.con-res [data-protection="plants"]'), 'the rail\'s plants wear the shield').toBeVisible({timeout: 20_000});
    expect((await zoneLayers(page)).filter((l) => l.covered).map((l) => l.id).sort(), 'the viewer\'s tile wears the kant too')
      .toEqual([INSIDE, RED_INSIDE].sort());
    await shoot(page, '11-inside-landed');
    await shootBoard(page, '11-inside-landed-field');
    const mine = await inspectZoneCell(page, ZONE_CENTRE);
    expect(mine, 'the viewer is sheltered now').toMatch(/Вы\s+Растения защищены/i);
    await leaveInspection(page);

    // ── OUTSIDE: warned before the press, the shelter turns OFF ────────────
    await startGreenery(page, request, playerId);
    await walkToSpace(page, OUTSIDE);
    await expect.poll(async () => await dossier(page), {timeout: 20_000, message: 'the dossier warns BEFORE the press'})
      .toMatch(/Отключает вашу защиту от уничтожения растений/);
    await settle(page);
    await shoot(page, '20-outside-aimed');
    expect(await commitFocusedSpace(page), 'the greenery landed outside the zone').toBeTruthy();
    await expect.poll(async () => (await view(request, playerId)).thisPlayer.protectedResources?.plants,
      {timeout: 40_000, message: 'the shelter is gone'}).toBe('off');
    await settle(page, {timeoutMs: 60_000});
    await expect(page.locator('.con-res [data-protection="plants"]'), 'the shield leaves the rail').toHaveCount(0, {timeout: 20_000});
    await shoot(page, '21-outside-landed');
    expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
  });

  test('MarsBot: the drawn set on a borrowed Tharsis board, the zone holds for the bot, the round is played', async ({page, request}) => {
    test.setTimeout(480_000);
    const playerId = await bootFixture(page, request, 'hollandia-marsbot', {query: PROFILE.query});
    await settle(page);
    await armLeakWitness(page);
    const start = await view(request, playerId);
    expect(start.game.gameOptions.boardName).toBe('Hollandia');
    expect(start.game.automa, 'MarsBot is seated').toBeTruthy();
    expect(start.game.automa!.tracks, 'the generated mat — seven tracks').toHaveLength(7);
    expect(start.game.automa!.briefing?.[0]?.message, 'the model names the borrowed board').toMatch(/Tharsis board/);

    // ── «Экран бота»: the briefing names the loan; «Планшет бота»: the mat ──
    await botOnStage(page);
    await openBotScreenHub(page);
    const briefing = page.locator('[data-bot-briefing]');
    await expect(briefing, 'the set\'s briefing stands in the bot screen').toHaveCount(1);
    expect((await briefing.innerText()).replace(/\s+/g, ' '), 'the briefing says whose board the bot plays').toMatch(/нет своего планшета бота/);
    await shoot(page, '30-bot-briefing');
    await openBotBoardDetail(page);
    await expect(page.locator('.mb-tracks')).toBeVisible();
    await shoot(page, '31-bot-mat');
    await leaveInfo(page);

    // ── the zone holds for the bot: its one tile is inside, and the dossier reads it as sheltered ──
    const section = await inspectZoneCell(page, ZONE_CENTRE);
    console.log('── the zone section (bot) ──', section);
    expect(section, 'the bot\'s standing is a seat\'s').toMatch(/Растения защищены/);
    expect(section, 'the viewer has no tile in the zone').toMatch(/Вы\s+Нет тайлов в зоне/i);
    await settle(page);
    await shoot(page, '32-zone-dossier-bot');
    await leaveInspection(page);

    // ── THE PASS (LT wheel → «Пас»): the bot plays the round on this map, the next generation begins ──
    await press(page, 'Comma', 1200);
    await press(page, 'ArrowDown', 900);
    await press(page, 'Enter', 1500);
    await expect.poll(async () => (await view(request, playerId)).game.generation,
      {timeout: 240_000, message: 'MarsBot plays its round on Hollandia and the generation ends'}).toBe(start.game.generation + 1);
    await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '', {timeout: 120_000, message: 'the next prompt stands'})
      .not.toBe('');
    await settle(page, {timeoutMs: 120_000, notifications: true});
    await shoot(page, '40-after-the-round');
    expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
  });
});
