import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ELYSIUM + MarsBot, end to end in the console-native shell.
 *
 * The unit suites prove the RULES; this proves the map is actually reachable
 * and playable through the real create route, the real transport and the real
 * console surfaces: the game is created on Elysium with the bot seated, the
 * shell mounts, the player hands the round over and MarsBot plays it out on
 * the ELYSIUM mat — whose fingerprint is the cross-track POWER tag on building
 * space 4 (neither Tharsis nor Hellas prints anything there).
 */

const OUT = path.join('screenshots', 'elysium-marsbot');

type BotTrack = {layout: Array<string | null>, position: number, tags: Array<string>};
type PlayerView = {
  game: {
    gameOptions: {boardName: string},
    milestones: Array<{name: string}>,
    awards: Array<{name: string}>,
    automa?: {tracks: Array<BotTrack>, corporation?: {id: string}},
  },
};

function newGameConfig(board: string, automa: object | undefined) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: true, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Elysian', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board,
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
    ...(automa === undefined ? {} : {automa}),
  };
}

async function key(page: Page, code: string, settleMs = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

function create(request: APIRequestContext, board: string, automa: object | undefined) {
  return request.post('/api/creategame', {data: newGameConfig(board, automa)});
}

async function playerView(request: APIRequestContext, playerId: string): Promise<PlayerView> {
  const res = await request.get(`/api/player?id=${playerId}`);
  expect(res.ok(), `player view failed: ${res.status()}`).toBeTruthy();
  return await res.json() as PlayerView;
}

test.describe('ELYSIUM + MarsBot — the real product', () => {
  test('the create route accepts Elysium with the bot, and still rejects a board without a profile', async ({request}) => {
    const bot = {difficulty: 'normal'};
    const ok = await create(request, 'elysium', bot);
    expect(ok.ok(), `Elysium + MarsBot was rejected: ${ok.status()} ${await ok.text()}`).toBeTruthy();

    // …and the guard still speaks: a board with no MarsBot profile is refused,
    // and the reason now names the three that have one.
    const bad = await create(request, 'amazonis p.', bot);
    expect(bad.ok()).toBeFalsy();
    const reason = await bad.text();
    expect(reason).toContain('MarsBot covers');
    expect(reason).toContain('elysium');
  });

  test('a game runs: the shell mounts, the bot plays the round, and its mat is the ELYSIUM one', async ({page, request}) => {
    test.setTimeout(180_000);

    const created = await create(request, 'elysium', {difficulty: 'normal'});
    expect(created.ok(), `create failed: ${created.status()} ${await created.text()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const playerId = model.players[0].id;

    await page.goto(`/player?id=${playerId}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
    await page.waitForTimeout(3500);
    await shoot(page, '01-start');

    // Walk the start wizard out. Its LENGTH is not reproducible — the corp is
    // dealt at random and its first action may draw cards that each need their
    // own A — so this is a deadline-bounded adaptive loop, not a key sequence:
    // A commits a single-pick step, RT advances a multi-pick one.
    const startScene = page.locator('.con-start__frame');
    const walkUntil = Date.now() + 75_000;
    for (let i = 0; Date.now() < walkUntil && await startScene.count() > 0; i++) {
      await key(page, i % 4 === 3 ? 'Period' : 'Enter', 800);
    }
    expect(await startScene.count(), 'the start wizard finished').toBe(0);
    await page.waitForTimeout(2500);
    await shoot(page, '02-board');

    // ── The MAP reached the game, and the MAT is Elysium's ──────────────────
    // The server's view is what the console renders; the client owns no board.
    const view = await playerView(request, playerId);
    expect(view.game.gameOptions.boardName).toBe('elysium');
    expect(view.game.automa, 'MarsBot is seated').toBeTruthy();
    const tracks = view.game.automa!.tracks;
    expect(tracks.length, '7 map tracks + the Venus track').toBe(8);
    expect(tracks[0].layout[4], 'building 4 is Elysium’s cross-track power tag').toBe('tag_4');
    expect(tracks[0].layout[5], 'and Hellas’ tr2 is not there').toBeFalsy();
    expect(tracks[3].tags, 'Jovian rides the science track').toEqual(['jovian', 'science']);
    expect(tracks[4].tags, 'Power stands alone').toEqual(['power']);

    // The Elysium milestone / award rows are the ones in play.
    expect(view.game.milestones.map((m) => m.name))
      .toEqual(['Generalist', 'Specialist', 'Ecologist', 'Tycoon10', 'Legend', 'Hoverlord']);
    expect(view.game.awards.map((a) => a.name))
      .toEqual(['Celebrity', 'Industrialist', 'Desert Settler', 'Estate Dealer', 'Benefactor', 'Venuphile']);

    // ── The bot PLAYS ──────────────────────────────────────────────────────
    // Hand the round over (LT wheel → «Пас») so MarsBot plays it out, then
    // wait for its markers to move. The mat is the evidence: a track that
    // advanced is a printed cell that resolved.
    const before = tracks.map((t) => t.position);
    await key(page, 'Comma', 900); // LT → the basic-actions wheel
    await key(page, 'ArrowDown', 500); // «Пас»
    await key(page, 'Enter', 1500);

    let after = before;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      after = (await playerView(request, playerId)).game.automa!.tracks.map((t) => t.position);
      if (after.some((p, i) => p > before[i])) {
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(after.some((p, i) => p > before[i]),
      `MarsBot never advanced a track on Elysium: ${JSON.stringify(before)} → ${JSON.stringify(after)}`)
      .toBeTruthy();
    await shoot(page, '03-after-bot-round');
  });
});
