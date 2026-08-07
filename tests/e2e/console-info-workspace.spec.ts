import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig} from './consoleStart';

/**
 * THE INFORMATION WORKSPACE (Y) — layout / context / dedup probe.
 *
 * The workspace iteration turned the Y information panel from a centered
 * modal into a .con-main child filling everything RIGHT of the left resource
 * rail, with the rail as the mode's live SUMMARY half (its player context
 * follows the inspected player). This spec drives a real human+MarsBot game
 * and asserts the load-bearing contracts:
 *
 *  1. GEOMETRY — the workspace fills the area right of the rail between the
 *     two bars (left edge = rail + gap; top/bottom/right = .con-main's box),
 *     and the rail stays visible (not covered, not dimmed away).
 *  2. CONTEXT SYNC — LB/RB switch the inspected player in BOTH surfaces at
 *     once: the rail's numbers become the inspected seat's, the panel swaps
 *     its dossier (human columns ↔ bot grid). Rapid presses coalesce.
 *  3. DEDUP — the human dossier repeats NO rail summary: no resource grid,
 *     no tag matrix, no TR/VP totals in the header.
 *  4. RESTORE — closing returns the rail to the viewer's own seat.
 *
 * Also the screenshot source for the workspace gallery
 * (screenshots/info-workspace/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'info-workspace');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  deviceScaleFactor: number;
  profileQuery: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=handheld'},
];

/** Deterministic base+corpEra game, human + MarsBot. `testMode` gives 500 of
 *  every resource, so the viewer's own rail reads a distinct value from the
 *  bot's — that difference is what the context-sync assertions key on. */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'InfoTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  automa: {difficulty: 'normal'},
});

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/**
 * Press B until the fullscreen viewer is gone. The close is a CHOREOGRAPHED
 * flight (the card returns into its table slot while the stage veil fades),
 * and input is deliberately swallowed for its duration — under a loaded
 * 3-worker 4K run a single press can land inside that window and be
 * absorbed. Adaptive, like every other walk in this spec.
 */
async function closeZoom(page: Page): Promise<void> {
  const plate = page.locator('.con-zoom__prov');
  for (let i = 0; i < 5 && await plate.count() > 0; i++) {
    await key(page, 'Escape', 900);
  }
  await expect(plate).toHaveCount(0);
}

const railMc = (page: Page) => page.locator('.con-res__row--megacredits .con-res__value');

for (const preset of PRESETS) {
  test.describe(`information workspace · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: preset.deviceScaleFactor,
      screen: preset.viewport,
    });

    test('workspace layout, rail context sync, dedup', async ({page, request}) => {
      test.setTimeout(preset.viewport.width >= 3840 ? 480_000 : 300_000);

      // ── The pregame: the shared start driver (`consoleStart.ts`). The walk
      //    is SETUP, never the subject — this spec's claim is the Y workspace,
      //    so a start-flow change is adapted THERE, never here.
      //
      //    The local walk it replaces alternated A / RT blindly and then
      //    asserted `.con-start__frame` had a COUNT of 0 — a question the DOM
      //    cannot answer: the scene stays MOUNTED through its yield
      //    (`ConsoleShell.vue:2395`) and its panes are `v-show`
      //    (`ConsoleStartScene.vue:26`). `waitForBoardHome` reads what is
      //    PAINTED, and it lands on the same place the old follow-up loop was
      //    aiming for — a live, interactive board home.
      await bootIntoGame(page, request, {config: GAME_CONFIG, query: preset.profileQuery});

      // ── 1 · Open the workspace (retry through a lingering cinematic) ─
      const workspace = page.locator('.con-info');
      for (let i = 0; i < 4 && await workspace.count() === 0; i++) {
        await key(page, 'KeyY', 1100);
      }
      await expect(workspace).toHaveCount(1);
      const ownMc = (await railMc(page).textContent()) ?? '';
      expect(ownMc).not.toBe('');
      await shoot(page, preset, '01-workspace-self');

      // GEOMETRY: fills .con-main right of the rail (±4px tolerance).
      const main = await page.locator('.con-main').boundingBox();
      const rail = await page.locator('.con-res-host').boundingBox();
      const ws = await workspace.boundingBox();
      expect(main && rail && ws).toBeTruthy();
      if (main && rail && ws) {
        expect(Math.abs(ws.y - main.y)).toBeLessThanOrEqual(4);
        expect(Math.abs((ws.y + ws.height) - (main.y + main.height))).toBeLessThanOrEqual(4);
        expect(Math.abs((ws.x + ws.width) - (main.x + main.width))).toBeLessThanOrEqual(4);
        expect(ws.x).toBeGreaterThan(rail.x + rail.width - 2); // right of the rail
        expect(ws.x - (rail.x + rail.width)).toBeLessThanOrEqual(16 * preset.viewport.width / 1920 + 6); // …by the seam gap only
        // The rail is visible and NOT under the workspace.
        await expect(page.locator('.con-res')).toBeVisible();
      }

      // DEDUP: the human dossier carries no rail summary.
      await expect(workspace.locator('.con-info__res-grid')).toHaveCount(0);
      await expect(workspace.locator('.con-tagmx')).toHaveCount(0);
      await expect(workspace.locator('.con-info__cols')).toHaveCount(1);

      // ── 2 · RB → the MarsBot seat: BOTH surfaces switch ────────────
      await key(page, 'KeyE', 900);
      // The rail now reads the bot's M€ (never the human's testMode pile)…
      const botMc = await railMc(page).textContent();
      expect(botMc, 'rail M€ must switch to the inspected bot').not.toBe(ownMc);
      // …in the DEDICATED bot presentation: real economy (no production
      // chips — the Automa has none) + the printed tag tracks with progress
      // in place of the human tag matrix.
      await expect(page.locator('.con-res .con-res__prod')).toHaveCount(0);
      await expect(page.locator('.con-res .con-tagmx__grid')).toHaveCount(0);
      const trackRows = await page.locator('.con-res .con-tagmx__trackrow').count();
      expect(trackRows, 'the rail must list the bot tracks').toBeGreaterThanOrEqual(5);
      // …and the panel swapped to the bot dossier (grid, not columns) with
      // its own tracks/economy summaries GONE (the rail carries them now).
      await expect(workspace.locator('.con-info__grid')).toHaveCount(1);
      await expect(workspace.locator('.con-info__cols')).toHaveCount(0);
      await expect(workspace.locator('.con-bot__track-line')).toHaveCount(0);
      // The UNIFIED played-summary block renders for the bot too.
      await expect(workspace.locator('.con-info__block--played')).toHaveCount(1);
      await shoot(page, preset, '02-workspace-bot');

      // ── 2b · X on the bot seat: the SAME premium embedded table ────
      await key(page, 'KeyX', 900);
      const embeddedBot = page.locator('.con-info .con-played--embedded');
      await expect(embeddedBot).toHaveCount(1);
      // The honest provenance line (everything the bot flipped).
      await expect(embeddedBot.locator('.con-played__provenance')).toBeVisible();
      await shoot(page, preset, '02b-bot-played');
      await key(page, 'Escape', 800);
      await expect(page.locator('.con-info .con-played--embedded')).toHaveCount(0);
      await expect(workspace.locator('.con-info__grid')).toHaveCount(1);

      // ── 3 · Rapid LB/RB presses coalesce (2 seats: odd count = other) ─
      for (const code of ['KeyE', 'KeyQ', 'KeyE', 'KeyQ', 'KeyQ']) {
        await page.keyboard.press(code);
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(800);
      const settled = await railMc(page).textContent();
      expect(settled, 'rapid switching must settle on ONE coherent seat').not.toBe(null);
      // Panel and rail agree: bot grid ⇔ bot M€, human columns ⇔ own M€.
      const gridCount = await workspace.locator('.con-info__grid').count();
      if (gridCount > 0) {
        expect(settled).not.toBe(ownMc);
      } else {
        expect(settled).toBe(ownMc);
      }

      // ── 4 · Detail screens keep the workspace grammar ──────────────
      if (await workspace.locator('.con-info__grid').count() > 0) {
        await key(page, 'KeyQ', 700); // land on the human seat
      }
      // X → the embedded «Разыграно» for the human seat (real tableau, no
      // provenance line), B returns to the dashboard with its summary block.
      await key(page, 'KeyX', 900);
      await expect(page.locator('.con-info .con-played--embedded')).toHaveCount(1);
      await expect(page.locator('.con-info .con-played__provenance')).toHaveCount(0);
      await shoot(page, preset, '03-played-human');

      // ── 4b · SMART OPEN: the корпорация zone holds ONE card → A goes
      // straight to fullscreen, carrying the PROVENANCE plate. ───────
      await key(page, 'Enter', 1200);
      const plate = page.locator('.con-zoom__prov');
      await expect(plate).toHaveCount(1);
      // (the kicker is uppercased by CSS — the DOM text stays sentence case)
      await expect(plate.locator('.con-zoom__prov-kicker')).toHaveText('Разыграно');
      await expect(plate.locator('.con-zoom__prov-cat')).toHaveText('Корпорация');
      // A lone card in its zone shows no «N / M» (that would be noise).
      await expect(plate.locator('.con-zoom__prov-ord')).toHaveCount(0);
      await shoot(page, preset, '03a-zoom-provenance');
      // The card returns onto a table that is STILL on stage (the played
      // surface is no longer parked while the fullscreen is up) — it never
      // lands in a void, and the embedded table survives the return.
      await expect(page.locator('.con-info .con-played--embedded')).toBeVisible();
      await closeZoom(page);
      await expect(page.locator('.con-info .con-played--embedded')).toHaveCount(1);

      await key(page, 'Escape', 800);
      await expect(workspace.locator('.con-info__cols')).toHaveCount(1);
      await expect(workspace.locator('.con-info__block--played')).toHaveCount(1);
      // A → the VP breakdown detail, B back.
      await key(page, 'Enter', 700);
      await expect(workspace.locator('.con-info__detail')).toHaveCount(1);
      await shoot(page, preset, '03b-vp-detail');
      await key(page, 'Escape', 700);
      await expect(workspace.locator('.con-info__cols')).toHaveCount(1);

      // ── 5 · Close: the rail atomically returns to the OWN seat ─────
      await key(page, 'KeyY', 800);
      await expect(page.locator('.con-info')).toHaveCount(0);
      await expect(railMc(page)).toHaveText(ownMc);
      // The HUMAN presentation is fully back: six resource rows with
      // production chips, the tag matrix, no bot track rows.
      await expect(page.locator('.con-res .con-res__prod')).toHaveCount(6);
      await expect(page.locator('.con-res .con-tagmx__grid')).toHaveCount(1);
      await expect(page.locator('.con-res .con-tagmx__trackrow')).toHaveCount(0);
      await shoot(page, preset, '04-closed-restored');

      // ── 6 · The board-home «Разыграно» (X): the SAME table serves the
      // bot seat with the LOCALIZED name («Бот», never a raw MarsBot). ──
      await key(page, 'KeyX', 1000);
      await expect(page.locator('.con-played')).toHaveCount(1);
      await key(page, 'KeyE', 800); // cycle to the bot seat
      await expect(page.locator('.con-played__seat-name')).toHaveText('Бот');
      await expect(page.locator('.con-played__provenance')).toBeVisible();
      await shoot(page, preset, '05-standalone-bot');
      await key(page, 'Escape', 800);
      await expect(page.locator('.con-played')).toHaveCount(0);

      // ── 7 · Reduced motion: the mode still switches cleanly ────────
      if (preset.id === 'standard-1080') {
        await page.emulateMedia({reducedMotion: 'reduce'});
        await key(page, 'KeyY', 700);
        await expect(page.locator('.con-info')).toHaveCount(1);
        await key(page, 'KeyE', 500);
        await expect(railMc(page)).not.toHaveText(ownMc);
        await key(page, 'KeyY', 600);
        await expect(page.locator('.con-info')).toHaveCount(0);
        await expect(railMc(page)).toHaveText(ownMc);
        await page.emulateMedia({reducedMotion: 'no-preference'});
      }
    });
  });
}
