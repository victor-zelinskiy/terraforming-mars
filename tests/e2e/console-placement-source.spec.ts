import {test, expect, APIRequestContext, Page} from '@playwright/test';
import {bootSeededGame} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * WHO IS PLACING THIS TILE — the board's placement-context panel, over the real
 * DOM.
 *
 * `createMarsSelectSpace` has derived `placementContext.source` from the placing
 * card since the marker existed, and the panel showed none of it: a tile that
 * arrives from a triggered effect had no attribution on screen at all — only a
 * generic «Выберите место на поле».
 *
 * The panel is ~17rem wide and its consequences preview is variable-height, so
 * the source costs ONE LINE (the shared dock in chip layout) and no more. L3
 * opens the real card fullscreen — the SAME verb it carries on every other
 * surface in the shell (it replaced «next available cell», a jump that
 * duplicated the d-pad over a board whose legal cells are highlighted).
 */

const OUT = path.resolve('screenshots', 'placement-source');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Placer', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false,
    clonedGamedId: undefined, undoOption: false, showTimers: false, fastModeOption: false,
    showOtherPlayersVP: false, testMode: true, aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard', solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false, modularMA: false, draftVariant: false,
    initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: [], customPreludes: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4, automa: undefined,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}
async function key(page: Page, code: string, settle = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

async function focusStdProject(page: Page, title: RegExp): Promise<boolean> {
  const focusedName = () =>
    page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
  await page.waitForTimeout(900);
  const walk = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft',
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown'];
  for (let i = 0; i <= walk.length; i++) {
    if (title.test(await focusedName())) {
      return true;
    }
    if (i < walk.length) {
      await key(page, walk[i], 500);
    }
  }
  return false;
}

/**
 * Drive a REAL standard-project placement. When `asCard` is set the prompt's
 * source marker is re-labelled to a card on the way in — the spaces, previews
 * and cursor stay real, only the marker changes.
 *
 * It must be decided BEFORE the placement opens: once the board is placing, the
 * client stops polling (the prompt is already in hand), so a mid-placement
 * re-label never reaches it.
 */
async function driveToPlacement(page: Page, request: APIRequestContext, asCard: boolean): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  const playerId = model.players[0].id;

  // A CARD-driven placement depends on the shuffle, so the probe drives a
  // REAL standard-project placement and then re-labels its source through
  // the interceptor — the spaces, the previews and the cursor stay real,
  // only the marker changes (the same harness the discard / Pluto probes use).
  const relabel = async (route: import('@playwright/test').Route): Promise<void> => {
    const response = await route.fetch();
    const body = await response.json();
    if (asCard && body.waitingFor?.type === 'space') {
      body.waitingFor.placementContext = {
        cancellable: false,
        source: {kind: 'card', card: 'Lunar Beam'},
      };
    }
    await route.fulfill({response, json: body});
  };
  // BOTH channels: a standard project's placement prompt arrives in the
  // response to the input POST, not on the next poll — patching only the poll
  // left the panel showing the project it really came from.
  await page.route('**/api/player*', relabel);
  await page.route('**/player/input*', relabel);

  // The pregame is SETUP — the subject is the placement panel. The shared
  // driver ANSWERS it over `player/input` and opens the console on a live
  // board; what stood here was a key rotation steered by RU screen text (the
  // anti-pattern `consoleStart.ts` exists to delete) that also had to guess
  // its way out of the bought-cards payment afterwards.
  await bootSeededGame(page, request, playerId);

  const rootText = () => page.locator('.con-root').innerText().catch(() => '');
  // LT wheel → Standard Projects → «Озеленение» → the board opens placing.
  await key(page, 'Comma', 1200);
  await key(page, 'Enter', 1500);
  const panel = page.locator('.con-context');
  expect(await focusStdProject(page, /озеленение/i), 'never focused «Озеленение»').toBeTruthy();
  await key(page, 'Enter', 1600);
  if (/ОПЛАТА/.test(await rootText())) {
    await key(page, 'KeyX', 2600);
  }
  expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'never reached a board placement').toBeTruthy();
}

test.describe('console placement panel · the source', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  /*
   * ONE run, deliberately. The drive spends the player's whole turn getting to
   * a placement, so a second test in the same file lands on a board where
   * «Стандартные проекты» reads «Сейчас недоступно» — a driver artefact, not a
   * finding. The NON-card path (a standard project naming its own kind) is
   * covered by `promptSource.spec.ts`; what only the real DOM can prove is the
   * chip in the live panel, its cost in pixels, and the L3 verb.
   */
  test('the panel names who is placing, in one line, and L3 reads the card', async ({page, request}) => {
    test.setTimeout(300_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await driveToPlacement(page, request, true);
    const panel = page.locator('.con-context');
    await shoot(page, '1-placement-card-source');

    // 1 · WHO is placing — the shared dock in CHIP layout.
    const chip = panel.locator('.con-src');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveClass(/con-src--chip/);
    // The re-labelled marker lands on the first POLL after the placement opens,
    // not in the input response that opened it — so give it a poll or two.
    await expect(chip.locator('.con-src__plate-name'))
      .toContainText(/Луч с Луны|Лунный луч|Lunar Beam/i, {timeout: 25_000});

    // 2 · …and it costs ONE LINE. The consequences preview is this panel's job;
    //     the source may not push it off screen.
    const chipBox = await chip.boundingBox();
    expect(chipBox).not.toBeNull();
    expect(chipBox!.height, 'the source is a line, not a dock').toBeLessThan(48);
    // The facts the panel exists for are still there, below it.
    await expect(panel).toContainText(/ВЫ ПОЛУЧИТЕ|Клетка поля/i);

    // 3 · L3 reads the card — and the jump it replaced is GONE from the bar.
    await expect(panel.locator('.con-context__source-hint')).toHaveCount(1);
    const bar = page.locator('.con-cmdbar, .con-commands').first();
    await expect(bar).toContainText(/ИСТОЧНИК/i);
    await expect(bar).not.toContainText(/СЛЕДУЮЩАЯ/i);

    // 4 · …and the placement survives the round trip.
    await key(page, 'KeyC', 1800); // L3
    await shoot(page, '2-placement-source-fullscreen');
    await expect(page.locator('.con-zoom')).toHaveCount(1);
    await key(page, 'Escape', 1600);
    await expect(page.locator('.con-zoom')).toHaveCount(0);
    expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'the placement survives the viewer').toBeTruthy();
  });
});
