import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, fetchPlayerModel, openBotBoardDetail, openBotScreenHub, press, pressUntil, pressUntilVisible, sendPlayerInputSynced, settle,
} from './consoleStart';
import {campaignBase, seedIdentity} from './campaignFixtures';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * MarsBot × «Случайные цели и награды» — the framework of docs/claude/marsbot-dynamic-ma-framework.md, played on a real
 * game (stage 6: «каждая новая механика сыграна e2e на настоящей партии, а не заявлена»).
 *
 *  1. THE CREATOR. A solo setup with the bot and the «random milestones and awards» box ON: no conflict stands in the
 *     way, the creation sends the random set, and the created game deals the bot a GENERATED mat with its briefing.
 *  2. THE ROUND (fixture `marsbot-random-set` — Tharsis, a given random set with Dataminer): before the pass — the mat
 *     with a threshold MARK on the cell each single-track milestone needs (a kant, never a glow), the token cells and
 *     the token count, the set's briefing in «Экран бота», a milestone row with the bot's rule in words; the pass —
 *     the bot CLAIMS a milestone by its cell, FUNDS an award by its cell, and B14 «Корпоративная конкуренция · набор
 *     партии» helps the funded award, named in the turn review; after — B14's face in the bonus piles reads THIS
 *     game's awards, and the claimed milestone's mark is gone.
 *  3. ARES HOUSE RULE 4 (fixture `marsbot-random-set-ares-finale`): the finale — the bot's final greenery covers the
 *     hazard it can pay for.
 * Evidence → screenshots/marsbot-random-set/.
 */

const OUT = path.resolve('screenshots', 'marsbot-random-set');
const PROFILE = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const NAME = 'Alice';
const SET_AWARDS = ['Scientist', 'Highlander', 'Banker', 'Thermalist', 'Miner'];
const HAZARD = '08';

type Threshold = {trackIndex: number, cell: number, milestone: string};
type View = {
  game: {
    phase: string,
    milestones: Array<{name: string}>,
    awards: Array<{name: string}>,
    spaces: Array<{id: string, tileType?: number, color?: string}>,
    automa?: {
      tracks: Array<{layout: Array<string | null>, position: number}>,
      thresholds?: Array<Threshold>,
      tokens?: Record<string, number>,
      briefing?: Array<{message: string}>,
      maRules?: Array<{kind: string, name: string}>,
    },
  },
  players: Array<{color: string, isMarsBot?: boolean}>,
  waitingFor?: {type?: string},
};

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

/** Claims / fundings off the server's own model — who took what. */
const claimsOf = async (request: APIRequestContext, playerId: string) => {
  const model = await fetchPlayerModel(request, playerId) as unknown as {
    game: {milestones: Array<{name: string, color?: string}>, awards: Array<{name: string, color?: string}>},
  };
  return {
    milestones: model.game.milestones.filter((m) => m.color !== undefined).map((m) => `${m.name}:${m.color}`),
    awards: model.game.awards.filter((a) => a.color !== undefined).map((a) => `${a.name}:${a.color}`),
  };
};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Info mode with the BOT seat on stage (LB/RB walk the seats). */
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

async function toCreator(page: Page): Promise<void> {
  await page.goto(`${campaignBase()}/?x=1${PROFILE.query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  for (let i = 0; i < 12 && await page.locator('.cm-item--cursor').getAttribute('data-menu-item') !== 'create'; i++) {
    await press(page, 'ArrowDown', 120);
  }
  await expect(page.locator('.cm-item--cursor')).toHaveAttribute('data-menu-item', 'create');
  await press(page, 'Enter', 200);
  await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
  await expect(page.locator('.cm-mode__tile--cursor')).toHaveAttribute('data-mode', 'single');
  await press(page, 'Enter', 600);
  await page.waitForSelector('.cm-crew', {timeout: 30_000});
}

test.describe(`MarsBot × random milestones and awards · ${PROFILE.id}`, () => {
  test.use({viewport: PROFILE.viewport, deviceScaleFactor: 1, screen: PROFILE.viewport});

  test('the creator: the random set with the bot is no conflict, and the game deals a generated mat', async ({page, request}) => {
    test.setTimeout(300_000);
    await seedIdentity(page, NAME);
    await page.addInitScript((settings) => {
      window.localStorage.setItem('tm_last_game_settings', JSON.stringify(settings));
    }, {gameMode: 'marsbot', mapMode: 'specific', mapId: 'elysium', players: [{name: NAME, color: 'blue'}],
      rules: {randomMilestonesAwards: true, randomBoardTiles: false}});
    await toCreator(page);
    await expect(page.locator('.cm-row--conflict'), 'nothing in the creator is marked as a MarsBot conflict').toHaveCount(0);
    await press(page, 'KeyX', 800);
    await expect(page.locator('.cm-overlay--launch'), 'the launch plate opens — nothing blocks the creation').toBeVisible({timeout: 15_000});
    const created = page.waitForRequest((r) => r.url().includes('/api/creategame') && r.method() === 'POST', {timeout: 60_000});
    await press(page, 'Enter', 400);
    const req = await created;
    const body = req.postDataJSON() as {randomMA?: string, automa?: unknown, board?: string};
    expect(body.automa, 'the bot is seated').toBeTruthy();
    expect(body.randomMA, 'the creation sends the random set').not.toBe('No randomization');
    // Creating IS entering: the creator navigates to the new game — the seat's id rides that URL (the response body
    // is gone with the navigation).
    await page.waitForURL(/[?&]id=p[0-9a-f]+/, {timeout: 60_000});
    const humanId = new URL(page.url()).searchParams.get('id') ?? '';
    const model = await view(request, humanId);
    console.log('── created ──', JSON.stringify({milestones: model.game.milestones.map((m) => m.name), awards: model.game.awards.map((a) => a.name),
      briefing: model.game.automa?.briefing?.map((b) => b.message)}));
    expect(model.game.automa, 'MarsBot is seated').toBeTruthy();
    expect(model.game.automa!.maRules!.length, 'a generated rule line for every milestone and award of the set')
      .toBe(model.game.milestones.length + model.game.awards.length);
    expect(model.game.automa!.briefing, 'a random set carries its briefing').toBeTruthy();
  });

  test('the round: marks on the mat, the bot claims and funds by its cells, B14 helps — named, and its face reads this set', async ({page, request}) => {
    test.setTimeout(600_000);
    const playerId = await bootFixture(page, request, 'marsbot-random-set', {query: PROFILE.query});
    await settle(page);
    await armLeakWitness(page);
    const start = await view(request, playerId);
    const automa = start.game.automa!;
    expect(start.game.awards.map((a) => a.name)).toEqual(SET_AWARDS);
    const thresholds = automa.thresholds ?? [];
    expect(thresholds.some((t) => t.milestone === 'Rim Settler'), 'the met milestone wears its mark').toBe(true);
    const rim = thresholds.find((t) => t.milestone === 'Rim Settler')!;
    expect(automa.tracks[rim.trackIndex].position, 'the cube stands on the Rim Settler mark').toBe(rim.cell);

    // ── «Экран бота»: the set's briefing; «Планшет бота»: the marks, the token cells, the token count ──
    await botOnStage(page);
    await openBotScreenHub(page);
    const briefing = page.locator('[data-bot-briefing]');
    await expect(briefing, 'the set\'s briefing stands in the bot screen').toHaveCount(1);
    await expect(briefing.locator('.con-botscr__prose').first()).not.toBeEmpty();
    expect(await briefing.innerText(), 'no raw template').not.toMatch(/\$\{\d\}/);
    await shoot(page, '10-briefing');
    await openBotBoardDetail(page);
    const mat = page.locator('.mb-tracks');
    await expect(mat.locator('.mb-cell--threshold'), 'one mark per single-track milestone cell').toHaveCount(thresholds.length);
    const mark = mat.locator('.mb-cell--threshold[data-threshold*="Rim Settler"]');
    await expect(mark, 'Rim Settler\'s mark').toHaveCount(1);
    const kant = await mark.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(kant, 'the mark is an inset KANT').toMatch(/inset/);
    expect(kant, 'never an outer glow').not.toMatch(/\) 0px 0px [1-9]/);
    await expect(mat.locator('[data-token-cell="data"]').first(), 'the token cells wear their glyph').toBeVisible();
    await expect(page.locator('[data-bot-tokens="data"]'), 'the data-token count').toHaveCount(1);
    await shoot(page, '11-mat-marks');
    await leaveInfo(page);

    // ── the milestone row: the bot's rule in words, beside the player's metric ──
    await pressUntilVisible(page, 'KeyQ', '.con-ma', {tries: 3, settleMs: 1200});
    await pressUntilVisible(page, 'Enter', '.con-mafocus', {tries: 3, settleMs: 1200});
    const rule = page.locator('.con-mafocus [data-ma-bot-rule]');
    await expect(rule, 'the inspected milestone names the bot\'s rule').toHaveCount(1);
    expect((await rule.innerText()).trim().length).toBeGreaterThan(0);
    expect(await rule.innerText(), 'no raw template').not.toMatch(/\$\{\d\}/);
    await shoot(page, '12-milestone-bot-rule');
    for (let i = 0; i < 4 && await page.locator('.con-ma').count() > 0; i++) {
      await press(page, 'Escape', 900);
    }
    await settle(page);

    // ── THE PASS (LT wheel → «Пас»): the bot's round ──
    await press(page, 'Comma', 1200);
    await press(page, 'ArrowDown', 900);
    await press(page, 'Enter', 1500);
    const botColor = start.players.find((p) => p.isMarsBot === true)?.color ?? '';
    await expect.poll(async () => {
      const c = await claimsOf(request, playerId);
      return c.milestones.some((m) => m === `Rim Settler:${botColor}`) && c.awards.some((a) => a.endsWith(`:${botColor}`));
    }, {timeout: 180_000, message: 'MarsBot claims Rim Settler by its cell and funds an award by its cell'}).toBe(true);

    // The turn review(s) — on demand, from the JOURNAL: every bot-turn group of generation 1 opens its «Разбор хода»
    // with X; B14's helper is named in one of them. The bot's turns are PRESENTED first (their cards, the generation's
    // scene) — the review is read once the feed has told them, never over a story still playing.
    await settle(page, {timeoutMs: 120_000, notifications: true});
    let reviews = '';
    const review = page.locator('.con-bot-review');
    const botGroups = page.locator('.con-journal .journal-group--automa-turn');
    for (let turn = 0; turn < 6 && !reviews.includes('Усилил ближайшую награду'); turn++) {
      await pressUntilVisible(page, 'KeyR', '.con-journal', {tries: 3, settleMs: 1200});
      // The round was generation 1 — LT walks the journal back until the bot's turns stand.
      for (let i = 0; i < 3 && await botGroups.count() === 0; i++) {
        await press(page, 'Comma', 900);
      }
      const ids = await botGroups.evaluateAll((els) => els.map((el) => el.getAttribute('data-correlation-id') ?? ''));
      expect(ids.length, 'the journal lists the turns of the bot').toBeGreaterThan(0);
      if (turn >= ids.length) {
        break;
      }
      const target = ids[turn];
      const focusedId = async () => await page.locator('.con-journal__node--focused').getAttribute('data-correlation-id').catch(() => null);
      for (const key of ['ArrowDown', 'ArrowUp']) {
        for (let step = 0; step < 30 && await focusedId() !== target; step++) {
          const was = await focusedId();
          await press(page, key, 250);
          if (await focusedId() === was) {
            break; // a wall — turn around
          }
        }
      }
      expect(await focusedId(), `the cursor on the bot's turn ${turn + 1}`).toBe(target);
      await pressUntilVisible(page, 'KeyX', '.con-bot-review', {tries: 3, settleMs: 1200});
      await settle(page, {timeoutMs: 15_000});
      reviews += ' ' + (await review.innerText()).replace(/\s+/g, ' ');
      if (reviews.includes('Усилил ближайшую награду')) {
        await shoot(page, '20-turn-review-b14');
      }
      await pressUntil(page, 'Escape', async () => await review.count() === 0, {tries: 3, settleMs: 900});
      if (await page.locator('.con-journal').count() > 0) {
        await pressUntil(page, 'KeyR', async () => await page.locator('.con-journal').count() === 0, {tries: 3, settleMs: 900});
      }
    }
    console.log('── reviews ──', reviews.slice(0, 1200));
    expect(reviews, 'B14\'s helper is named in the turn review').toMatch(/Усилил ближайшую награду/);
    expect(reviews, 'no raw template').not.toMatch(/\$\{\d\}/);

    // The research of the next generation: buy nothing over the API, the page synced.
    await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '', {timeout: 120_000, message: 'the next prompt stands'})
      .not.toBe('');
    if ((await view(request, playerId)).waitingFor?.type === 'card') {
      await sendPlayerInputSynced(page, request, playerId, {type: 'card', cards: []});
    }
    await settle(page, {timeoutMs: 60_000});

    // ── after: B14's face in the bonus piles reads THIS game's awards; Rim Settler's mark is gone ──
    const after = await view(request, playerId);
    expect((after.game.automa?.thresholds ?? []).some((t) => t.milestone === 'Rim Settler'), 'a claimed milestone loses its mark').toBe(false);
    await botOnStage(page);
    await openBotScreenHub(page);
    const bonusEntry = page.locator('[data-bot-entry="botBonus"]');
    // The hub's two doors: «Планшет бота» first, «Бонусные карты» one step ↓ (`botScreenNavigate`).
    await pressUntil(page, 'ArrowDown', async () => await bonusEntry.evaluate((el) => el.classList.contains('con-botscr__entry--focused')), {tries: 4, settleMs: 700});
    await expect(bonusEntry, 'the cursor on «Бонусные карты»').toHaveClass(/con-botscr__entry--focused/);
    await pressUntilVisible(page, 'Enter', '.con-botbonus', {tries: 3, settleMs: 1200});
    const faceAwards = await page.locator('.con-botbonus [data-competition-award]').evaluateAll((els) => els.map((el) => el.getAttribute('data-competition-award')));
    console.log('── B14 face ──', JSON.stringify(faceAwards));
    expect(faceAwards.length, 'B14 lies in a pile with its rows').toBeGreaterThan(0);
    expect(faceAwards.every((a) => SET_AWARDS.includes(a ?? '')), 'every row names an award of THIS game').toBe(true);
    await shoot(page, '30-b14-face');
    await leaveInfo(page);
    await openBotDetailAgain(page);
    await expect(page.locator('.mb-tracks .mb-cell--threshold[data-threshold*="Rim Settler"]'), 'the claimed milestone\'s mark is gone').toHaveCount(0);
    await shoot(page, '31-mat-after');
    await leaveInfo(page);
    expect(await strandedReports(page)).toEqual([]);
  });

  test('Ares house rule 4: the bot\'s final greenery covers the hazard it can pay for', async ({page, request}) => {
    test.setTimeout(480_000);
    const playerId = await bootFixture(page, request, 'marsbot-random-set-ares-finale', {query: PROFILE.query});
    await settle(page);
    const start = await view(request, playerId);
    const before = start.game.spaces.find((s) => s.id === HAZARD);
    expect(before?.tileType, 'the hazard stands').toBeDefined();
    expect(before?.color, 'nobody owns the hazard').toBeUndefined();
    await shoot(page, '40-hazard');
    await press(page, 'Comma', 1200);
    await press(page, 'ArrowDown', 900);
    await press(page, 'Enter', 1500);
    const botColor = start.players.find((p) => p.isMarsBot === true)?.color ?? '';
    await expect.poll(async () => {
      const now = await view(request, playerId);
      return now.game.spaces.find((s) => s.id === HAZARD)?.color ?? '';
    }, {timeout: 240_000, message: 'the bot\'s final greenery lands on the hazard'}).toBe(botColor);
    await expect.poll(async () => (await view(request, playerId)).game.phase, {timeout: 120_000, message: 'the game ends'}).toBe('end');
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await shoot(page, '41-finale');
  });
});

/** Back into «Планшет бота» from the board. */
async function openBotDetailAgain(page: Page): Promise<void> {
  await botOnStage(page);
  await openBotBoardDetail(page);
}
