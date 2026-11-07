import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, fetchPlayerModel, openBotBoardDetail, openBotScreenHub, press, pressUntil, pressUntilVisible, settle} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * AMAZONIS PLANITIA + MarsBot on the console — phase 2 of the board's premium adaptation
 * (`docs/claude/amazonis-planitia-marsbot.md`): the first EXTENDED bot board, played on a real game (the owner's law —
 * «в премиум-скоупе = сыграно e2e на НАСТОЯЩЕЙ доске, а не заявлено»). Fixture `amazonis-planitia-marsbot`: a solo
 * table vs MarsBot on the official eleven-row map with Venus + Colonies, the building row already in the LATE RESERVE.
 *
 *  1. THE MAT («Планшет бота» on the TV): eight rows — seven of 25 cells, the Venus row of 16 — the reserve opening
 *     with an «advance» and ending on its TR, the building row's readout «20/24», and every cell still wide enough
 *     for its icon (25 columns where every other map has 19).
 *  2. THE CARD («Бонусные карты»): BF5 «Корпоративная конкуренция (Большая Амазония)» on the discard pile with the
 *     map's own helper lines.
 *  3. THE ROUND: blue passes — the bot plays its whole round on the extended board and the next generation begins;
 *     no prompt stranded.
 * Evidence → screenshots/amazonis-planitia-marsbot/.
 */

const OUT = path.resolve('screenshots', 'amazonis-planitia-marsbot');
const PROFILE = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type View = {
  game: {
    generation: number,
    gameOptions: {boardName: string},
    automa?: {
      tracks: Array<{layout: Array<string | null>, position: number, maxPosition: number}>,
      bonusDiscard?: Array<string>,
    },
  },
  waitingFor?: {type?: string},
};

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
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

test.describe(`Amazonis Planitia + MarsBot · ${PROFILE.id}`, () => {
  test.use({viewport: PROFILE.viewport, deviceScaleFactor: 1, screen: PROFILE.viewport});

  test('the extended mat on the TV, BF5 on the piles, the round played on the extended board', async ({page, request}) => {
    test.setTimeout(480_000);
    const playerId = await bootFixture(page, request, 'amazonis-planitia-marsbot', {query: PROFILE.query});
    await settle(page);
    await armLeakWitness(page);
    const start = await view(request, playerId);
    expect(start.game.gameOptions.boardName).toBe('amazonis planitia');
    expect(start.game.automa, 'MarsBot is seated').toBeTruthy();
    const tracks = start.game.automa!.tracks;
    expect(tracks, 'seven Martian rows + the Venus row').toHaveLength(8);
    for (let i = 0; i < 7; i++) {
      expect(tracks[i].maxPosition, `row ${i} is extended`).toBe(24);
      expect(tracks[i].layout, `row ${i} has 25 cells`).toHaveLength(25);
      expect(tracks[i].layout[19], `row ${i} opens its reserve with an advance`).toBe('advance');
    }
    expect(tracks[7].maxPosition, 'the Venus row runs to 15').toBe(15);
    expect(tracks[0].position, 'the building row stands in the reserve').toBe(20);

    // ── «Планшет бота»: the extended mat ──
    await botOnStage(page);
    await openBotBoardDetail(page);
    const mat = page.locator('.mb-tracks');
    await expect(mat).toBeVisible();
    const rows = mat.locator('.mb-track');
    await expect(rows).toHaveCount(8);
    await expect(rows.nth(0).locator('.mb-cell'), 'a Martian row paints 25 cells').toHaveCount(25);
    await expect(rows.nth(7).locator('.mb-cell'), 'the Venus row paints 16').toHaveCount(16);
    await expect(rows.nth(0).locator('.mb-cell').nth(19).locator('.mb-glyph--advance'), 'the reserve opens with «advance»').toHaveCount(1);
    await expect(rows.nth(0).locator('.mb-cell').nth(24).locator('.mb-glyph--tr'), 'the building row ends on +6 TR').toHaveText(/\+6/);
    await expect.poll(async () => (await rows.nth(0).locator('.mb-track__pos').innerText()).replace(/\s+/g, ''),
      {message: 'the building row reads 20 of 24'}).toMatch(/^20\/24$/);
    const widths = await rows.nth(0).locator('.mb-cell').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    const icons = await mat.locator('.mb-ico').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    console.log('── mat geometry ──', JSON.stringify({cellMin: Math.min(...widths), cellMax: Math.max(...widths), icon: Math.max(...icons), cells: widths.length}));
    expect(Math.min(...widths), 'a 25-column cell still holds its icon with air').toBeGreaterThanOrEqual(Math.max(...icons) + 6);
    await shoot(page, '31-bot-mat');
    await leaveInfo(page);

    // ── «Бонусные карты»: BF5's face on the discard pile ──
    await botOnStage(page);
    await openBotScreenHub(page);
    const bonusEntry = page.locator('[data-bot-entry="botBonus"]');
    await pressUntil(page, 'ArrowDown', async () => await bonusEntry.evaluate((el) => el.classList.contains('con-botscr__entry--focused')), {tries: 4, settleMs: 700});
    await expect(bonusEntry, 'the cursor on «Бонусные карты»').toHaveClass(/con-botscr__entry--focused/);
    await pressUntilVisible(page, 'Enter', '.con-botbonus', {tries: 3, settleMs: 1200});
    const piles = async () => (await page.locator('.con-botbonus').innerText()).replace(/\s+/g, ' ');
    await expect.poll(piles, {message: 'BF5 lies on the discard pile under its own name'}).toMatch(/Большая Амазония/);
    console.log('── bonus piles ──', (await piles()).slice(0, 600));
    await shoot(page, '32-bf5-face');
    await leaveInfo(page);

    // ── THE PASS (LT wheel → «Пас»): the bot plays the round on the extended board, the next generation begins ──
    await press(page, 'Comma', 1200);
    await press(page, 'ArrowDown', 900);
    await press(page, 'Enter', 1500);
    await expect.poll(async () => (await view(request, playerId)).game.generation,
      {timeout: 240_000, message: 'MarsBot plays its round on Amazonis Planitia and the generation ends'}).toBe(start.game.generation + 1);
    await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '', {timeout: 120_000, message: 'the next prompt stands'})
      .not.toBe('');
    await settle(page, {timeoutMs: 120_000, notifications: true});
    const after = await view(request, playerId);
    console.log('── after the round ──', JSON.stringify(after.game.automa!.tracks.map((t) => `${t.position}/${t.maxPosition}`)));
    expect(after.game.automa!.tracks[0].position, 'the building row did not leave the reserve').toBeGreaterThanOrEqual(20);
    await shoot(page, '40-after-the-round');
    expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
  });
});
