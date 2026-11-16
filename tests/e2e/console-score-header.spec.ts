import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, fetchPlayerModel, press, pressUntil, reloadConsole, settle, soloGameConfig} from './consoleStart';
import {readSettled} from './settledRead';

/**
 * Console score header (.con-score — TR + VP above the resource rows):
 * screenshot evidence across the display profiles + a smoke assertion that
 * the cap mounts with live numbers (and masks the VP behind the eye-off when
 * the local «Приватный счёт» pref is on). Gallery goes to
 * `screenshots/score-header/<preset>/`.
 */

const OUT_ROOT = path.resolve('screenshots', 'score-header');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  deviceScaleFactor: number;
  profileQuery: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, profileQuery: ''},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, deviceScaleFactor: 1, profileQuery: ''},
  {id: 'compact-720', viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, profileQuery: ''},
];

/** Deterministic solo base + corpEra + PRELUDE game (the prelude step is what
 *  makes this wizard three steps long — see the boot's `onStep`). */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'ScoreTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {prelude: true},
  seed: 0.42,
});

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await press(page, code, settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Box = {x: number, y: number, width: number, height: number};

/** The rail host's box, read AT REST — the clip of every rail shot (a mid-scene shot reuses one read before it). */
async function railHostBox(page: Page): Promise<Box | null> {
  return readSettled(page, () => page.locator('.con-res-host').boundingBox(), {message: 'the rail host'});
}

/** The rail + a margin of board context (chips / aux column live just outside). */
async function shootRail(page: Page, preset: Preset, name: string, box: Box | null): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  if (box === null) {
    return;
  }
  const pad = 24;
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(preset.viewport.width - Math.max(0, box.x - pad), box.width + pad * 4),
      height: Math.min(preset.viewport.height - Math.max(0, box.y - pad), box.height + pad * 2),
    },
  });
}

for (const preset of PRESETS) {
  test.describe(`console score header · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: preset.deviceScaleFactor,
      screen: preset.viewport,
    });

    test('captures the TR/VP score cap', async ({page, request}) => {
      test.setTimeout(preset.viewport.width * preset.deviceScaleFactor >= 3840 ? 480_000 : 300_000);

      // ── The pregame: the shared start driver (`consoleStart.ts`). The walk
      //    is SETUP, never the subject — this spec's claim is the TR/VP cap on
      //    the rail, so a start-flow change is adapted THERE, never here.
      //
      //    What used to stand here was a local `bootIntoGame` that read the
      //    RU command-bar text to decide its next key and then asked whether
      //    the wizard was over by COUNTING `.con-start__frame` nodes — the
      //    question the DOM cannot answer, since the scene stays MOUNTED
      //    through its yield (`ConsoleShell.vue:2395`) and its panes are
      //    `v-show` (`ConsoleStartScene.vue:26`).
      const playerId = await bootIntoGame(page, request, {config: GAME_CONFIG, query: preset.profileQuery});

      // The cap mounted with live numbers.
      const score = page.locator('.con-score');
      await expect(score).toBeVisible();
      await expect(page.locator('.con-score__value--tr')).toHaveText(/^\d+$/);
      await expect(page.locator('.con-score__cell--vp .con-score__value')).toHaveText(/^-?\d+$/);
      // The cap never overflows its rail horizontally — both boxes read at rest.
      const {railBox, capBox} = await readSettled(page, async () => ({
        railBox: await page.locator('.con-res').boundingBox(),
        capBox: await score.boundingBox(),
      }), {message: 'the rail and its score cap'});
      expect(capBox!.x).toBeGreaterThanOrEqual(railBox!.x - 1);
      expect(capBox!.x + capBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width + 1);

      await shoot(page, preset, '01-board');
      const hostBox = await railHostBox(page);
      await shootRail(page, preset, '02-rail', hostBox);

      // Live score delta chip (1080 only): the Asteroid standard project
      // raises TR by 1 — the cap's TR cell must fire the existing score chip.
      // Evidence-only (bounded, no assertions — the chip is transient). Each press still waits for ITS effect and is
      // pressed again only without one (act → verify → retry): a swallowed key no longer desyncs the walk.
      if (preset.id === 'tv-4k') {
        const trOf = async () => ((await fetchPlayerModel(request, playerId)).thisPlayer as {terraformRating: number}).terraformRating;
        const trBefore = await trOf();
        const focusedProject = () => page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
        await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 1000}); // LT wheel
        await pressUntil(page, 'Enter', async () => await page.locator('.con-stdp').count() > 0, {tries: 3, settleMs: 1400}); // centre slot = Standard Projects
        await pressUntil(page, 'ArrowDown', async () => /астероид|asteroid/i.test(await focusedProject()), {tries: 4, settleMs: 400}); // → Asteroid (raise temperature)
        await pressUntil(page, 'Enter', async () => await trOf() > trBefore, {tries: 2, settleMs: 1600}); // open / confirm (+ the confirm dialog, if shown)
        await shootRail(page, preset, '04-rail-tr-chip', hostBox);
        await settle(page, {timeoutMs: 20_000}); // the chip settles
        await key(page, 'Escape', 600);
      }

      // Masked own VP (the «Приватный счёт» display pref): eye-off in place of
      // the number, identical footprint. The pref is PER-GAME — keyed by the
      // viewer's participant id (playerId), the same key bindPrivateScoreGame reads.
      await page.evaluate((id) => localStorage.setItem('tm.privateScoreDisplay.' + id, '1'), playerId);
      await reloadConsole(page);
      await page.waitForSelector('.con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await settle(page, {timeoutMs: 30_000});
      await expect(page.locator('.con-score .vp-private')).toBeVisible();
      await expect.poll(() => page.locator('.con-score__cell--vp .con-score__value').count()).toBe(0);
      await expect(page.locator('.con-score__value--tr')).toHaveText(/^\d+$/);
      await shootRail(page, preset, '03-rail-vp-masked', await railHostBox(page));
      await page.evaluate((id) => localStorage.removeItem('tm.privateScoreDisplay.' + id), playerId);
    });
  });
}
