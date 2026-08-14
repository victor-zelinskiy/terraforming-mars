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
 * watches that order frame by frame, because the whole difference is WHEN:
 *
 *   workspace up  → the reserved cell is still EMPTY;
 *   workspace gone → a proxy flies → and only then does the tile appear.
 */
import {expect, test, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'auto-tile');

/** Base, no requirement, `city: {space: GANYMEDE_COLONY}` — the whole play is
 *  the tile, and it lands on a slot nobody picks. */
const TILE_CARD = 'Ganymede Colony';
/** The reserved slot's own id (`SpaceName.GANYMEDE_COLONY`). */
const TILE_SPACE = '01';
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

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** Boot + drive the start wizard, buying the probe's cards into the hand. */
async function openAtBoard(page: Page, request: APIRequestContext): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await page.waitForTimeout(3000);

  const buy = [TILE_CARD, ...FILLER];
  let lastFocused = '';
  let stalls = 0;
  for (let i = 0; i < 220 && await page.locator('.con-start__frame').count() > 0; i++) {
    const s = await page.evaluate(() => ({
      active: (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase(),
      focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
      picked: Array.from(document.querySelectorAll('.con-cards__slot--picked'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getAttribute('data-zoom-slot') ?? ''),
      ceremony: document.querySelector('.con-start--ceremony') !== null,
    }));
    if (s.ceremony) {
      break;
    }
    const walk = async () => {
      stalls = s.focused === lastFocused ? stalls + 1 : 0;
      await key(page, stalls >= 1 ? 'ArrowDown' : 'ArrowRight', 240);
      lastFocused = s.focused;
    };
    if (s.active.includes('КОРПОРАЦ')) {
      if (s.picked.includes('CrediCor')) {
        await key(page, 'Period', 1100);
      } else if (s.focused === 'CrediCor') {
        await key(page, 'Enter', 600);
      } else {
        await walk();
      }
      continue;
    }
    if (s.active.includes('ПРОЕКТ')) {
      const missing = buy.filter((c) => !s.picked.includes(c));
      if (missing.length === 0) {
        await key(page, 'Period', 1100);
      } else if (missing.includes(s.focused)) {
        await key(page, 'Enter', 420);
        lastFocused = '';
      } else {
        await walk();
      }
      continue;
    }
    await key(page, 'Enter', 1200);
  }
  // The deployment plays the corporation on its own; press A through it.
  for (let i = 0; i < 120 && await page.locator('.con-start').count() > 0; i++) {
    if (await page.locator('.con-start__slot-a').count() > 0) {
      await key(page, 'Enter', 700);
    } else {
      await page.waitForTimeout(300);
    }
  }
  await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 60_000});
  await page.waitForTimeout(3500);
}

test.describe('an auto-placed tile lands on a board the player can see', () => {
  test.setTimeout(300_000);

  test('a reserved-slot city waits for the workspace to leave, then FLIES in', async ({page, request}) => {
    await openAtBoard(page, request);

    // ── into the hand workspace, onto the card, one level deeper. ──
    for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
      await key(page, 'Period', 800);
      await key(page, 'Enter', 1100);
    }
    await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
    await page.waitForTimeout(800);
    const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${TILE_CARD}"]`).count();
    let lastSelected = '';
    for (let i = 0; i < 60 && await onTarget() === 0; i++) {
      const selected = await page.evaluate(() =>
        document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
      await key(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
      lastSelected = selected;
    }
    expect(await onTarget(), `hand cursor never reached ${TILE_CARD}`).toBeGreaterThan(0);
    await key(page, 'Enter', 600);
    await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
    await page.waitForTimeout(1200);

    // The reserved slot is empty before the play — the baseline every
    // assertion below is measured against.
    // ⚠️ The tile's own element carries `board-space board-space-tile--<type>`
    // — there is no bare `.board-space-tile` class to match on (the child is
    // the tile only when it has a TYPE suffix), and `--placement-cleared` is
    // exactly how a held tile keeps reading as an empty cell.
    const tiled = async () => (await page.evaluate((id) => {
      const el = document.querySelector(`.board-space[data_space_id="${id}"] [class*="board-space-tile--"]`);
      return el !== null && !el.className.includes('board-space-tile--placement-cleared');
    }, TILE_SPACE));
    expect(await tiled(), 'the reserved slot starts empty').toBeFalsy();

    // ── CONFIRM, and watch the ORDER of the three events. ──
    await page.keyboard.press('Enter');
    const log = {
      /** Frames where the tile was already on the board while the workspace
       *  still covered it — the bug: the placement happened off screen. */
      tiledUnderWorkspace: 0,
      /** A landing proxy was airborne (the flight actually ran). */
      sawProxy: false,
      /** The workspace had left by the time the proxy flew. */
      proxyOverBoard: false,
      tiled: false,
      trace: [] as Array<string>,
    };
    for (let i = 0; i < 160; i++) {
      const s = await page.evaluate((id) => {
        const tile = document.querySelector(`.board-space[data_space_id="${id}"] [class*="board-space-tile--"]`);
        return {
          hand: document.querySelector('.con-hand') !== null,
          // The remote/own landing proxy on the shared placement layer.
          proxy: document.querySelector('.con-tileplace__tile--remote') !== null,
          tiled: tile !== null && !tile.className.includes('board-space-tile--placement-cleared'),
          boardShown: (() => {
            const board = document.querySelector('.con-board');
            return board !== null && (board as HTMLElement).offsetParent !== null;
          })(),
        };
      }, TILE_SPACE);
      log.trace.push(`${i} h:${s.hand ? 1 : 0} b:${s.boardShown ? 1 : 0} p:${s.proxy ? 1 : 0} t:${s.tiled ? 1 : 0}`);
      if (s.tiled && s.hand) {
        log.tiledUnderWorkspace++;
      }
      if (s.proxy) {
        log.sawProxy = true;
        if (!s.hand) {
          log.proxyOverBoard = true;
          await shoot(page, 'tile-flight-over-board');
        }
      }
      if (s.tiled) {
        log.tiled = true;
        if (!s.hand) {
          break;
        }
      }
      await page.waitForTimeout(150);
    }
    console.log(`[auto tile trace]\n${log.trace.join('\n')}`);

    expect(log.tiled, 'the city must end up on the board').toBeTruthy();
    // THE POINT OF THE WHOLE CHANGE: the placement is never spent behind the
    // workspace. While that screen is up the reserved cell still reads empty.
    expect(log.tiledUnderWorkspace, 'the tile must not appear while the workspace covers the board').toBe(0);
    expect(log.sawProxy, 'the landing FLEW — a tile that places itself is still placed').toBeTruthy();
    expect(log.proxyOverBoard, 'and it flew over a board the player could see').toBeTruthy();
    await page.waitForTimeout(600);
    await shoot(page, 'tile-landed');
  });
});
