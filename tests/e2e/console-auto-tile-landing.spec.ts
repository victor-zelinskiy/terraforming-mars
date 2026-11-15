/*
 * A TILE THAT PLACES ITSELF STILL HAS TO BE SEEN LANDING.
 *
 * Some cards put their tile on a RESERVED SLOT off Mars — Ganymede Colony,
 * Phobos Space Haven, Stratopolis: no `SelectSpace`, no player choice, the
 * server just places it. The console already has the landing flight for a tile
 * the viewer did not place by hand (`consoleRemotePlacement`, own profile), but
 * it fired the instant the response committed — while the play workspace was
 * still on screen and the board section behind it was `display: none`. Two
 * consequences, one bug: the flight could not even measure its hex (a zero
 * rect degrades to an instant reveal), so by the time the workspace folded the
 * city was simply THERE. The placement never happened as far as the player was
 * concerned.
 *
 * The landing now WAITS for a board the player can actually see, holding its
 * tile hidden meanwhile (the cell keeps reading as untouched). This probe
 * RECORDS that order from before the confirm (FLAKE ZERO — `armWitness`,
 * `settled`: an ORDER claim is judged on the states a task leaves, never on
 * the gap between two writes of one task), because the whole difference is
 * WHEN:
 *
 *   workspace up  → the reserved cell is still EMPTY;
 *   workspace gone → a proxy flies → and only then does the tile appear.
 */
import {expect, test, Page, APIRequestContext} from './consoleTest';
import {bootSeededGame, openHandPlayComposer, press, settle} from './consoleStart';
import {armWitness} from './witness';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'auto-tile');

/** Base, no requirement, `city: {space: GANYMEDE_COLONY}` — the whole play is
 *  the tile, and it lands on a slot nobody picks. */
const TILE_CARD = 'Ganymede Colony';
/** The reserved slot's own id (`SpaceName.GANYMEDE_COLONY`). */
const TILE_SPACE = 'c01';
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan'];

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'AutoTile', color: 'red', beginner: false, handicap: 0, first: true}],
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
    startingCorporations: 1,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: ['CrediCor'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    customProjectCards: [TILE_CARD, ...FILLER],
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
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** What the landing probe observes in one state of the page — the reserved cell, the play workspace, the proxy. */
type LandingState = {
  /** The hand workspace (the play's own surface) still stands. */
  hand: boolean,
  /** The remote/own landing proxy on the shared placement layer. */
  proxy: boolean,
  /** The reserved cell reads TILED (a held tile keeps reading as an empty cell). */
  tiled: boolean,
  /** The board section is laid out (not `display: none`). */
  boardShown: boolean,
};

/**
 * The reader of {@link LandingState} — in the page, self-contained (the cell id comes through `args`).
 * ⚠️ The tile's own element carries `board-space board-space-tile--<type>` — there is no bare `.board-space-tile`
 * class to match on (the child is the tile only when it has a TYPE suffix), and `--placement-cleared` is exactly how
 * a held tile keeps reading as an empty cell.
 */
function readLanding(id: string): LandingState {
  const tile = document.querySelector(`.board-space[data_space_id="${id}"] [class*="board-space-tile--"]`);
  const board = document.querySelector('.con-board');
  return {
    hand: document.querySelector('.con-hand') !== null,
    proxy: document.querySelector('.con-tileplace__tile--remote') !== null,
    tiled: tile !== null && !tile.className.includes('board-space-tile--placement-cleared'),
    boardShown: board !== null && (board as HTMLElement).offsetParent !== null,
  };
}

/** The phase of the story a state belongs to — the order claim's alphabet. The tile outranks the proxy: a proxy still
 *  painted over a cell that already reads tiled is the landing's last frame, not a flight. */
function phaseOf(s: LandingState): string {
  if (s.hand) {
    return s.tiled ? 'workspace+tile' : 'workspace';
  }
  if (s.tiled) {
    return 'landed';
  }
  return s.proxy ? 'flight' : 'board';
}

/** Boot into the game with the probe's cards in the hand — the pregame ANSWERED over the API (setup, never the
 *  subject), the console opened on the board home. */
async function openAtBoard(page: Page, request: APIRequestContext): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await bootSeededGame(page, request, model.players[0].id, {cards: [TILE_CARD, ...FILLER], corporation: 'CrediCor'});
  await settle(page);
}

test.describe('an auto-placed tile lands on a board the player can see', () => {
  test.setTimeout(300_000);

  test('a reserved-slot city waits for the workspace to leave, then FLIES in', async ({page, request}) => {
    await openAtBoard(page, request);

    // ── into the hand workspace, onto the card, one level deeper (act → verify on the composer standing). ──
    await openHandPlayComposer(page, TILE_CARD);
    await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
    // The sheet's entrance at rest before the baseline is read and the confirm goes out.
    await settle(page);

    // The reserved slot is empty before the play — the baseline every
    // assertion below is measured against.
    await expect.poll(() => page.evaluate(readLanding, TILE_SPACE).then((s) => s.tiled),
      {message: 'the reserved slot starts empty', timeout: 5_000}).toBe(false);

    // ── CONFIRM, and RECORD the ORDER of the three events from before the press. ──
    const landing = await armWitness<LandingState, string>(page, 'auto-tile-landing', readLanding, {args: TILE_SPACE, settled: true});
    await press(page, 'Enter', 400);
    // The flight over the board is screenshotted when the record first shows it (diagnostic only — the claims below
    // are judged on the record); the story ends with the tile on a board the workspace no longer covers.
    const overBoard = await landing.waitFor((s) => !s.hand && (s.proxy || s.tiled), {timeoutMs: 40_000,
      message: 'the workspace never left the board with the landing on its way'}).catch(() => undefined);
    if (overBoard?.v.proxy === true) {
      await shoot(page, 'tile-flight-over-board');
    }
    await landing.waitFor((s) => s.tiled && !s.hand, {timeoutMs: 40_000, message: 'the city must end up on the board'})
      .catch(() => undefined);
    const samples = await landing.stop();
    const t0 = samples[0]?.t ?? 0;
    console.log(`[auto tile trace]\n${samples.map((s) =>
      `${s.t - t0} h:${s.v.hand ? 1 : 0} b:${s.v.boardShown ? 1 : 0} p:${s.v.proxy ? 1 : 0} t:${s.v.tiled ? 1 : 0}`).join('\n')}`);
    const ever = (pred: (s: LandingState) => boolean) => samples.some((s) => pred(s.v));
    const story = samples.map((s) => phaseOf(s.v)).filter((k, i, all) => i === 0 || all[i - 1] !== k);

    expect(ever((s) => s.tiled), 'the city must end up on the board').toBeTruthy();
    // THE POINT OF THE WHOLE CHANGE: the placement is never spent behind the
    // workspace. While that screen is up the reserved cell still reads empty.
    expect(ever((s) => s.tiled && s.hand), 'the tile must not appear while the workspace covers the board').toBe(false);
    expect(ever((s) => s.proxy), 'the landing FLEW — a tile that places itself is still placed').toBeTruthy();
    expect(ever((s) => s.proxy && !s.hand), 'and it flew over a board the player could see').toBeTruthy();
    // …and in THIS order: the workspace with the cell empty, then the flight over the board, then the tile.
    expect(await landing.happenedInOrder((s) => phaseOf(s), ['workspace', 'flight', 'landed']),
      `workspace up (cell empty) → workspace gone, a proxy flies → the tile appears — the story was: ${story.join(' → ')}`).toBe(true);
    await settle(page);
    await shoot(page, 'tile-landed');
  });
});
