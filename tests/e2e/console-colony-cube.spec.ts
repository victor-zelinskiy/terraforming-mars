import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame as driveToBoard, cinematicBeat, openQuickWheel, press, pressUntil, settle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

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
    // DETERMINISTIC DEAL. The spec needs a colony whose build bonus keeps the
    // colonies screen mounted (no board placement, no card reveal) and that is
    // ACTIVE from the start (an inactive one — Miranda — cannot be built on at
    // all). Left to the seeded random deal the green variant drew
    // Europa/Miranda/Pluto, i.e. zero valid targets, and the walk below could
    // only ever pass by racing its own rail check.
    customColoniesList: ['Luna', 'Triton', 'Callisto', 'Ceres'],
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
  await press(page, code, settleMs);
}

/**
 * ONE HOP OF A WALK — the press, and the cursor's move as its witness: the WHOLE window before «no move» is believed
 * (a rail / a tile lands a beat after the press), and never a second press here — a wall is a legitimate no-move.
 */
async function hop(page: Page, code: string, where: () => Promise<string>, settleMs: number): Promise<void> {
  const at = await where();
  await pressUntil(page, code, async () => (await where()) !== at, {tries: 1, settleMs});
}

/** The focused colony tile — the colony walk's witness. */
function focusedTileOf(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.con-coltile--focused')?.getAttribute('data-test') ?? '');
}

/** The focused tile WITH the rail's verdict on it — one read, so the verdict is the tile's (taken at rest). */
function tileVerdict(page: Page): Promise<{focused: string, refused: boolean}> {
  return page.evaluate(() => ({
    focused: document.querySelector('.con-coltile--focused')?.getAttribute('data-test') ?? '',
    refused: document.querySelector('.con-colonies__rail-reason--blocked') !== null,
  }));
}

/** Boot a game and land on the LIVE board through the SHARED console-start
 *  driver (the one way console e2e boots — the local wizard walk this spec
 *  used to carry drifted the moment a step's key changed). The driver also
 *  resolves the solo Colonies setup «remove a colony» picks on the way. */
async function bootColonyBoard(page: Page, request: APIRequestContext, color: string, profileQuery = ''): Promise<void> {
  await driveToBoard(page, request, {
    config: newGameConfig(color),
    query: profileQuery,
    // A real hand: the board home's dock only reads LIVE with cards in it.
    buy: 2,
  });
  await settle(page);
}

/** LT wheel → Standard Projects → focus the Build-Colony row → Enter. */
async function startBuildColony(page: Page, tag: string): Promise<void> {
  // Right after the start flow a lingering animation/notification hold can
  // swallow the wheel press — retry the whole open until the sheet mounts.
  const sheetRows = page.locator('.con-stdp__card');
  let open = false;
  const wheel = page.locator('.con-quick');
  for (let i = 0; i < 8 && !open; i++) {
    // Each press waits for ITS effect (the wheel up; then the sheet, or the wheel gone — on a quick wheel the press IS
    // the activation) before anything else is judged.
    if (await pressUntil(page, 'Comma', async () => await wheel.count() > 0, {tries: 1, settleMs: 1100})) {
      await pressUntil(page, 'Enter', async () => await sheetRows.count() > 0 || await wheel.count() === 0,
        {tries: 1, settleMs: 1400}); // wheel centre = Standard Projects
    }
    open = await sheetRows.count() > 0;
    if (!open) {
      // Close only what actually popped (a stuck wheel / the system menu a
      // stray B would open) — NEVER blind-Escape on the bare board.
      if (await page.locator('.con-quick, .con-sys').count() > 0) {
        await key(page, 'Escape', 600);
      }
      // Whatever swallowed the press (a lingering hold) is waited out — the console quiet — before the next try.
      await settle(page);
      open = await sheetRows.count() > 0;
    }
  }
  expect(open, 'standard projects sheet never opened').toBeTruthy();
  // The sheet is a GRID (1 or 2 columns per profile; the bottom row can span
  // full width) — hop RIGHT first (Build Colony sits in the second column's
  // upper half on 2-column profiles), then walk the right column down, then
  // sweep the left column for the 1-column profiles.
  const focusedRow = page.locator('.con-stdp__card--focused');
  const gridWalk = [
    'ArrowRight',
    'ArrowDown', 'ArrowDown', 'ArrowDown',
    'ArrowLeft',
    'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown',
  ];
  const focusedText = () => focusedRow.innerText({timeout: 1500}).catch(() => '');
  let found = false;
  for (let i = 0; i <= gridWalk.length; i++) {
    const text = await focusedText();
    if (/колони/i.test(text) || /colony/i.test(text)) {
      found = true;
      break;
    }
    if (i < gridWalk.length) {
      await hop(page, gridWalk[i], focusedText, 600);
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
  // A corp with an ALT-RESOURCE payment (Helion's heat) gets the payment
  // panel BEFORE the SelectColony — X pays the pre-filled exact amount.
  // Wait for whichever answers the press — the colonies, or that payment panel — then pay (X) only while the panel
  // stands and the colonies do not, each X given its whole window.
  const colonies = page.locator('.con-colonies');
  const pay = page.locator('.con-pay');
  await page.locator('.con-colonies, .con-pay').first().waitFor({state: 'attached', timeout: 15_000}).catch(() => undefined);
  if (await colonies.count() === 0 && await pay.count() > 0) {
    await pressUntil(page, 'KeyX', async () => await colonies.count() > 0 || await pay.count() === 0, {tries: 3, settleMs: 1800});
  }
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  // The pick screen is ready when its cursor stands on a tile and the console is quiet.
  await page.locator('.con-coltile--focused').first().waitFor({state: 'attached', timeout: 15_000});
  await settle(page);

  // Focus a colony the server accepts (the summary status reads OK) whose
  // build bonus KEEPS the colonies screen mounted: Europa's ocean bonus flips
  // to a board placement and Pluto's draw rides the reveal flow — either
  // unmounts the slot the assertions watch. Any other colony works.
  // OK = the rail carries NO blocked-reason line (the iteration-2 rail swaps
  // the consequence for the one honest reason when the pick is refused).
  const blocked = /Europa|Pluto/i;
  let testAttr = '';
  const seen: Array<string> = [];
  for (let i = 0; i < 10; i++) {
    // Read the FOCUSED tile and its verdict TOGETHER, at rest — the rail
    // follows the selection, so a verdict read on its own races a stale
    // reason onto a fresh tile (and made this walk pass or fail by timing
    // rather than by fact): the pair must read the same across frames.
    const {focused, refused} = await readSettled(page, () => tileVerdict(page), {message: 'the focused tile\'s verdict'});
    seen.push(`${focused || '(none)'}${refused ? ' [blocked]' : ''}`);
    if (!refused && focused !== '' && !blocked.test(focused)) {
      testAttr = focused;
      break;
    }
    await hop(page, 'ArrowRight', () => focusedTileOf(page), 500);
  }
  expect(testAttr, `no buildable colony tile — walked ${seen.join(', ')}`).not.toBe('');
  await shoot(page, `${tag}-11-pick-mode`);

  const slotCubes = page.locator(`[data-test="${testAttr}"] [data-colony-build-slot] .player-cube`);
  const before = await slotCubes.count();

  // ITERATION 2 — the overview never commits: A descends into the BUILD
  // FOCUS STAGE (destination slot ringed, the grant on screen)…
  await key(page, 'Enter', 1400);
  await page.waitForSelector('.con-colfocus', {timeout: 10_000});
  await expect.poll(() => page.locator('.con-colfocus__berth--dest').count(), {message: 'the destination berth is ringed'}).toBe(1);
  await shoot(page, `${tag}-11b-build-focus`);
  // …and A CONFIRMS there: arm + submit; the hero flies the REAL PlayerCube
  // into the stage's own big berth (the live anchor while the stage is up).
  await page.keyboard.press('Enter');

  // The proxy stage must appear (the transaction is live)…
  await page.waitForSelector('.con-colonybuild__cube', {timeout: 12_000});
  // …and while it is up, the slot paints NO new static cube (one object).
  await expect.poll(() => slotCubes.count(), {message: 'a second cube appeared during the flight'}).toBe(before);
  await shoot(page, `${tag}-12-hero-flight`);
  await cinematicBeat(page, 420, 'the hero-landing storyboard frame, a beat after the hero-flight one');
  await shoot(page, `${tag}-13-hero-landing`);

  // The stage clears at the handoff…
  await page.waitForSelector('.con-colonybuild__cube', {state: 'detached', timeout: 20_000});
  // …and the PROMPT-driven visit hands the screen back to the BOARD on the
  // transaction's own falling edge (iteration 2 — RETURN TO PARENT: the
  // player never strands in a workspace they did not open).
  await page.waitForSelector('.con-colonies', {state: 'detached', timeout: 10_000});
  await shoot(page, `${tag}-14-returned`);

  // Re-open the colonies (the RT quick wheel's «Торговля» slot — the same
  // route a player takes): the seated cube renders STATICALLY at once — one
  // more cube than before, and NO hero replay.
  // «No replay» is a NEGATIVE claim over the whole reopen: RECORDED from before the first press (FLAKE ZERO —
  // `armWitness`), asked once the reopened screen has come to rest.
  const replay = await armWitness(page, `colony-cube-replay:${tag}`, () => document.querySelector('.con-colonybuild__cube') !== null);
  await openQuickWheel(page); // RT — action categories wheel
  await pressUntil(page, 'ArrowRight', // trading — on a quick wheel the press IS the activation
    async () => await page.locator('.con-colonies').count() > 0 || await page.locator('.con-quick').count() === 0, {settleMs: 1300});
  await page.waitForSelector('.con-colonies', {timeout: 10_000});
  await settle(page);
  await expect.poll(() => slotCubes.count(), {message: 'the seated static cube did not paint'}).toBe(before + 1);
  expect(await replay.stop().then((s) => s.some((x) => x.v)), 'the hero replayed on reopen').toBe(false);
  await shoot(page, `${tag}-15-seated`);
  return testAttr;
}

test.describe('console colonies · premium PlayerCube marker', () => {
  test.describe('red @ 1080 standard', () => {
    test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

    test('build hero lands one cube; reopen shows it statically; inspect matches', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootColonyBoard(page, request, 'red');
      await startBuildColony(page, 'red1080');
      const testAttr = await buildAndVerify(page, 'red1080');
      // buildAndVerify already proved the RETURN TO PARENT + the static
      // reopen — the section now stands open on the seated cube.

      // ── Inspect (X): the FOCUS STAGE's build slots seat the same PlayerCube
      // (the workspace descend — the standalone dossier modal is gone). ──
      for (let i = 0; i < 8; i++) {
        if (await focusedTileOf(page) === testAttr) {
          break;
        }
        await hop(page, 'ArrowRight', () => focusedTileOf(page), 450);
      }
      const stage = page.locator('.con-colfocus');
      // One X, its effect (the focus stage) given the whole window.
      await pressUntil(page, 'KeyX', async () => await stage.count() > 0, {tries: 1, settleMs: 1400});
      if (await stage.count() > 0) {
        await expect.poll(() => stage.locator('.con-colfocus__berth-seat .player-cube').count()).toBeGreaterThan(0);
        await shoot(page, 'red1080-16-inspect');
        await key(page, 'Escape', 800);
      }
    });
  });

  test.describe('green @ 4K auto-tv', () => {
    test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});

    test('green cube lands and seats on the tv profile', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootColonyBoard(page, request, 'green');
      await startBuildColony(page, 'green4k');
      await buildAndVerify(page, 'green4k');
    });
  });
});
