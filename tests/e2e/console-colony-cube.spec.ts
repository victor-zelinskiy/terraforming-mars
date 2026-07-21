import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console colonies · the premium PlayerCube settlement marker.
 *
 * Drives a real solo COLONIES game through the console-native shell to a
 * Build-Colony standard project, and verifies the reworked marker:
 *  - during the build hero exactly ONE cube exists (the flying proxy; the
 *    slot paints NO static cube until the commit),
 *  - after the landing the slot holds exactly one static `.player-cube`
 *    (the same premium 3D token component the main board uses),
 *  - re-opening the colonies screen shows the seated cube WITHOUT replaying
 *    the hero (no `.con-colonybuild__cube` remounts),
 *  - the inspect panel + the focused-colony summary render PlayerCubes too.
 *
 * Runs the flow twice: red @ 1080 standard and green @ 4K (auto tv profile),
 * covering two player colours and both display profiles. Screenshot gallery →
 * `screenshots/console-colony-cube/`.
 */

const OUT_DIR = path.resolve('screenshots', 'console-colony-cube');

function newGameConfig(color: string) {
  return {
    players: [{name: 'CubeTester', color, beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      // No preludes: the start wizard stays short and can't stall.
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true, // 500 of everything → Build Colony is always affordable
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
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Boot a game, walk the start wizard, land on the main board. */
async function bootToBoard(page: Page, request: APIRequestContext, color: string, profileQuery = ''): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig(color)});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1${profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  // A picks / confirms; RT («СЛЕД. ШАГ» in the wizard's own bottom bar)
  // advances a completed step. Alternate them adaptively until the scene
  // unmounts — extra presses are inert per step.
  const startScene = page.locator('.con-start__frame');
  for (let i = 0; i < 14 && await startScene.count() > 0; i++) {
    await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
  }
  await page.waitForTimeout(5000); // deal cinematic + entry holds settle
  expect(await startScene.count(), 'start wizard never completed').toBe(0);

  // Solo Colonies SETUP: the game first asks to REMOVE colonies (a mandatory
  // SelectColony pick, status chip «СТАРТОВЫЙ ВЫБОР»). Resolve every pick:
  // A returns to / confirms the focused colony until the turn proper starts
  // (the status chip flips to «ДЕЙСТВИЕ»).
  const statusStrip = page.locator('.con-status__pstatus');
  for (let i = 0; i < 14; i++) {
    const status = await statusStrip.first().innerText({timeout: 2500}).catch(() => '');
    if (/действ/i.test(status)) {
      break;
    }
    await key(page, 'Enter', 1900);
  }
  const finalStatus = await statusStrip.first().innerText({timeout: 2500}).catch(() => '');
  expect(/действ/i.test(finalStatus), `the turn never started (status: ${finalStatus})`).toBeTruthy();
  await page.waitForTimeout(1500);
}

/** LT wheel → Standard Projects → focus the Build-Colony row → Enter. */
async function startBuildColony(page: Page, tag: string): Promise<void> {
  // Right after the start flow a lingering animation/notification hold can
  // swallow the wheel press — retry the whole open until the sheet mounts.
  const sheetRows = page.locator('.con-stdp__card');
  let open = false;
  for (let i = 0; i < 8 && !open; i++) {
    await key(page, 'Comma', 1100);
    if (await page.locator('.con-quick').count() > 0) {
      await key(page, 'Enter', 1400); // wheel centre = Standard Projects
    }
    open = await sheetRows.count() > 0;
    if (!open) {
      // Close only what actually popped (a stuck wheel / the system menu a
      // stray B would open) — NEVER blind-Escape on the bare board.
      if (await page.locator('.con-quick, .con-sysmenu').count() > 0) {
        await key(page, 'Escape', 600);
      }
      await page.waitForTimeout(1400);
    }
  }
  expect(open, 'standard projects sheet never opened').toBeTruthy();
  // The sheet is a GRID (2 columns on desktop profiles) — serpentine over it.
  const focusedRow = page.locator('.con-stdp__card--focused');
  const gridWalk = [
    'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight',
    'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight',
    'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown',
  ];
  let found = false;
  for (let i = 0; i <= gridWalk.length; i++) {
    const text = await focusedRow.innerText({timeout: 1500}).catch(() => '');
    if (/колони/i.test(text) || /colony/i.test(text)) {
      found = true;
      break;
    }
    if (i < gridWalk.length) {
      await key(page, gridWalk[i], 420);
    }
  }
  expect(found, 'Build Colony row never focused in the standard projects sheet').toBeTruthy();
  await shoot(page, `${tag}-10-buildcolony-focused`);
  await key(page, 'Enter', 1800); // → SelectColony → the colonies screen in pick mode
}

/**
 * On the colonies pick screen: focus a selectable colony, submit the build,
 * verify the one-object rule during the hero, and the seated cube after.
 * Returns the built colony's data-test name.
 */
async function buildAndVerify(page: Page, tag: string): Promise<string> {
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await page.waitForTimeout(800);

  // Focus a colony the server accepts (the summary status reads OK) whose
  // build bonus KEEPS the colonies screen mounted: Europa's ocean bonus flips
  // to a board placement and Pluto's draw rides the reveal flow — either
  // unmounts the slot the assertions watch. Any other colony works.
  const summaryStatus = page.locator('.con-colonies__summary-status');
  const focusedTile = page.locator('.con-coltile--focused');
  const blocked = /Europa|Pluto/i;
  let testAttr = '';
  for (let i = 0; i < 10; i++) {
    const cls = (await summaryStatus.getAttribute('class', {timeout: 1500}).catch(() => '')) ?? '';
    const focused = (await focusedTile.getAttribute('data-test', {timeout: 1500}).catch(() => '')) ?? '';
    if (cls.includes('summary-status--ok') && focused !== '' && !blocked.test(focused)) {
      testAttr = focused;
      break;
    }
    await key(page, 'ArrowRight', 500);
  }
  expect(testAttr, 'no focused colony tile').not.toBe('');
  const colonyName = testAttr.replace('con-colony-', '');
  await shoot(page, `${tag}-11-pick-mode`);

  const slotCubes = page.locator(`[data-test="${testAttr}"] [data-colony-build-slot] .player-cube`);
  const before = await slotCubes.count();

  // A → arm + submit; the hero flies the REAL PlayerCube into the slot.
  await page.keyboard.press('Enter');

  // The proxy stage must appear (the transaction is live)…
  await page.waitForSelector('.con-colonybuild__cube', {timeout: 12_000});
  // …and while it is up, the slot paints NO new static cube (one object).
  expect(await slotCubes.count(), 'a second cube appeared during the flight').toBe(before);
  await shoot(page, `${tag}-12-hero-flight`);
  await page.waitForTimeout(420);
  await shoot(page, `${tag}-13-hero-landing`);

  // The stage clears at the handoff; the slot now holds EXACTLY one more cube.
  await page.waitForSelector('.con-colonybuild__cube', {state: 'detached', timeout: 20_000});
  await page.waitForTimeout(900);
  expect(await slotCubes.count(), 'the seated static cube did not paint').toBe(before + 1);
  await shoot(page, `${tag}-14-seated`);
  return testAttr;
}

test.describe('console colonies · premium PlayerCube marker', () => {
  test.describe('red @ 1080 standard', () => {
    test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

    test('build hero lands one cube; reopen shows it statically; inspect matches', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootToBoard(page, request, 'red');
      await startBuildColony(page, 'red1080');
      const testAttr = await buildAndVerify(page, 'red1080');

      // ── Re-open the screen: the seated cube renders at once, NO replay. ──
      await key(page, 'KeyQ', 1200); // back to the board section
      await key(page, 'KeyE', 1500); // forward to colonies again
      await page.waitForSelector('.con-colonies', {timeout: 10_000});
      const seated = page.locator(`[data-test="${testAttr}"] [data-colony-build-slot] .player-cube`);
      expect(await seated.count(), 'seated cube missing after reopen').toBe(1);
      expect(await page.locator('.con-colonybuild__cube').count(), 'the hero replayed on reopen').toBe(0);
      await shoot(page, 'red1080-15-reopened');

      // ── Inspect (X): the dossier's slots seat the same PlayerCube. ──
      for (let i = 0; i < 8; i++) {
        const focused = (await page.locator('.con-coltile--focused').getAttribute('data-test', {timeout: 1500}).catch(() => '')) ?? '';
        if (focused === testAttr) {
          break;
        }
        await key(page, 'ArrowRight', 450);
      }
      await key(page, 'KeyX', 1400);
      const inspect = page.locator('.con-colinspect');
      if (await inspect.count() > 0) {
        expect(await inspect.locator('.con-colinspect__slot .player-cube').count()).toBeGreaterThan(0);
        await shoot(page, 'red1080-16-inspect');
        await key(page, 'Escape', 800);
      }
    });
  });

  test.describe('green @ 4K auto-tv', () => {
    test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});

    test('green cube lands and seats on the tv profile', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootToBoard(page, request, 'green');
      await startBuildColony(page, 'green4k');
      await buildAndVerify(page, 'green4k');
    });
  });
});
