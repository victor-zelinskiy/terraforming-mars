import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, fillPicks, press} from './consoleStart';

/**
 * TV display-profile screenshot matrix (TV-3).
 *
 * Boots a real solo game through the public create-game API, opens the
 * console-native shell at every display preset and captures the reference
 * screens the TV profile is calibrated against. NOT a pass/fail visual
 * assertion suite — it produces the `screenshots/tv-profile/<preset>/`
 * gallery used for couch-readability review, and only asserts that each
 * surface actually mounted (so a broken profile can't silently produce an
 * empty gallery).
 *
 * Presets mirror the test matrix:
 *  - tv-4k        3840×2160 @ dpr1 (OS 100%)  → auto `tv`, scale 2
 *  - tv-os200     1920×1080 @ dpr2 (OS 200%)  → auto `tv` (physical 4K), scale 1
 *  - tv-1080      1920×1080 @ dpr1 + manual  → `tv`, scale 1 (1080p TV output)
 *  - deck         1280×800  @ dpr1            → auto `handheld` (regression)
 *  - standard     1920×1080 @ dpr1            → auto `standard` (baseline)
 */

const OUT_ROOT = path.resolve('screenshots', 'tv-profile');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  deviceScaleFactor: number;
  /** Extra query for the console pages ('' = plain auto). */
  profileQuery: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, profileQuery: ''},
  {id: 'tv-os200', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 2, profileQuery: ''},
  {id: 'tv-1080', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, profileQuery: ''},
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=auto'},
];

/** Full NewGameConfig — a deterministic solo base+corpEra+prelude game. */
function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'TVTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true, // 1 corp / fewer cards → the start wizard is traversable
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

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

for (const preset of PRESETS) {
  test.describe(`tv-profile screens · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: preset.deviceScaleFactor,
      screen: preset.viewport,
    });

    test(`captures the console screens`, async ({page, request}) => {
      // ONE BUDGET FOR EVERY PRESET, because the assumption behind the split
      // was measured wrong. It gave 4K-class presets 420 s and everything else
      // 180 s, on the theory that resolution dominates the wall clock. It does
      // not: the START WALK does. One CI run, same machine — tv-4k 155 s,
      // tv-os200 137 s, standard-1080 112 s, tv-1080 109 s… and deck-handheld,
      // the SMALLEST viewport, 200 s. 175 of those 200 seconds were the
      // driver's own fixed settle waits (1533 leaf steps against 767 on the
      // green retry): a pregame that needs twice the rounds — one more prelude
      // that places a tile, one mandatory announce — costs twice the wall time
      // at every resolution. This is a LOAD-and-game-state allowance, so it is
      // sized on the walk, not on the pixels.
      test.setTimeout(420_000);

      // ── 1 · The console-native pre-game shell ──────────────────────
      await page.goto(`/?console=1${preset.profileQuery}`);
      await page.waitForTimeout(1600); // fonts + entry animations settle
      await shoot(page, preset, '01-main-menu');

      // ── 2 · A real solo game via the public API ────────────────────
      const created = await request.post('/api/creategame', {data: newGameConfig()});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};
      const playerId = model.players[0].id;

      await page.goto(`/player?id=${playerId}&console=1${preset.profileQuery}`);
      // The console shell (or its start scene) must mount — this is also the
      // "profile didn't break the shell" smoke assertion per preset. The P10
      // loading curtain covers the boot; wait it OUT, then let the card-deal
      // cinematic settle before shooting.
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await page.waitForTimeout(3500); // deal cinematic settles
      await shoot(page, preset, '02-start-scene');

      // ── 2b · Fullscreen card viewer (X on the focused corp) — the TV-fit
      // + rules-panel acceptance shot, taken HERE because the start scene
      // is deterministic (no wizard walk required).
      await key(page, 'KeyX', 4200); // open flight + settle + leaders
      await shoot(page, preset, '09-card-zoom');
      // CLOSE IT FOR REAL before anything else drives the wizard: an open
      // fullscreen viewer owns the pad, so every later press is swallowed and
      // the walk stalls on a start scene that is perfectly healthy. Bounded
      // press-verify-retry, never a fixed sleep (the close is a return flight
      // and takes visibly longer at 4K).
      const zoom = page.locator('dialog.con-zoom[open]');
      for (let tries = 0; tries < 3 && await zoom.count() > 0; tries++) {
        await page.keyboard.press('Escape');
        await zoom.waitFor({state: 'detached', timeout: 6000}).catch(() => { /* dropped — retry */ });
      }
      await expect(zoom, 'the card viewer closed before the walk').toHaveCount(0, {timeout: 8000});

      // ── 3 · Drive the start flow through the SHARED driver ─────────────
      // This used to be two blind press loops — up to 24 rounds of
      // «Enter(1300) + KeyE(900) + ArrowRight(400)» plus 8 × 2600ms, i.e. ~80
      // SECONDS OF SLEEPING PER PRESET whether or not anything was still
      // happening, and 5 presets of that is most of this file's 10.8-minute
      // runtime. `bootToBoard` reads the live step and waits on the surfaces'
      // own signals instead, so it takes exactly as long as the game does. The
      // gallery is unchanged: the shots above are taken BEFORE the walk (the
      // start scene is the deterministic moment), and this one after it.
      // The wizard's default hook only answers the CORPORATION step; this game
      // deals preludes and projects too, and an unsatisfied step greys out RT
      // («СЛЕД. ШАГ»), so the walk would sit on «Выберите ещё 2» forever.
      await bootToBoard(page, {
        onStep: async (p, kind) => {
          if (kind === 'corporation') {
            await press(p, 'Enter', 600);
          } else if (kind === 'prelude' || kind === 'project') {
            await fillPicks(p, 2);
          }
        },
      });
      await shoot(page, preset, '03-after-start');

      // ── 4 · The main board + HUD ───────────────────────────────────
      const board = page.locator('.con-board');
      if (await board.count() > 0) {
        await shoot(page, preset, '04-board');
      }

      // ── 5 · Hand section (RB = next section) ───────────────────────
      await key(page, 'KeyE', 1200);
      await shoot(page, preset, '05-hand');
      await key(page, 'KeyQ', 800); // back to the board

      // ── 6 · The Information workspace (Y) ──────────────────────────
      // (Stale before the rework: this shot pressed LT — the standard-
      // projects wheel — and captured it under the info-mode name.)
      await key(page, 'KeyY', 1000);
      await shoot(page, preset, '06-info-mode');
      await key(page, 'KeyY', 600);

      // ── 7 · RT quick wheel ─────────────────────────────────────────
      await key(page, 'Period', 1000);
      await shoot(page, preset, '07-rt-wheel');
      await key(page, 'Escape', 600);

      // ── 8 · Journal (R = view) ─────────────────────────────────────
      await key(page, 'KeyR', 1200);
      await shoot(page, preset, '08-journal');
      await key(page, 'Escape', 600);
    });
  });
}
