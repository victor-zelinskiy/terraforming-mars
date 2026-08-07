import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, fillPicks, pickCalmCorporation, soloGameConfig} from './consoleStart';

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
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, profileQuery: '&consoleProfile=auto'},
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
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** The rail + a margin of board context (chips / aux column live just outside). */
async function shootRail(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  const box = await page.locator('.con-res-host').boundingBox();
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
      const playerId = await bootIntoGame(page, request, {
        config: GAME_CONFIG,
        query: preset.profileQuery,
        onStep: async (p, kind) => {
          if (kind === 'corporation') {
            await pickCalmCorporation(p);
          } else if (kind === 'prelude') {
            // The prelude step has a MINIMUM of two picks: RT is refused
            // until they are made, so an unfilled step stalls the whole walk.
            await fillPicks(p, 2);
          }
        },
      });

      // The cap mounted with live numbers.
      const score = page.locator('.con-score');
      await expect(score).toBeVisible();
      await expect(page.locator('.con-score__value--tr')).toHaveText(/^\d+$/);
      await expect(page.locator('.con-score__cell--vp .con-score__value')).toHaveText(/^-?\d+$/);
      // The cap never overflows its rail horizontally.
      const railBox = await page.locator('.con-res').boundingBox();
      const capBox = await score.boundingBox();
      expect(capBox!.x).toBeGreaterThanOrEqual(railBox!.x - 1);
      expect(capBox!.x + capBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width + 1);

      await shoot(page, preset, '01-board');
      await shootRail(page, preset, '02-rail');

      // Live score delta chip (1080 only): the Asteroid standard project
      // raises TR by 1 — the cap's TR cell must fire the existing score chip.
      // Evidence-only (bounded, no assertions — the chip is transient).
      if (preset.id === 'standard-1080') {
        await key(page, 'Comma', 1000);        // LT wheel
        await key(page, 'Enter', 1400);        // centre slot = Standard Projects
        await key(page, 'ArrowDown', 400);
        await key(page, 'ArrowDown', 400);     // → Asteroid (raise temperature)
        await key(page, 'Enter', 900);         // open / confirm
        await key(page, 'Enter', 700);         // confirm dialog (if shown)
        await shootRail(page, preset, '04-rail-tr-chip');
        await page.waitForTimeout(2500);       // chip settles
        await key(page, 'Escape', 600);
      }

      // Masked own VP (the «Приватный счёт» display pref): eye-off in place of
      // the number, identical footprint. The pref is PER-GAME — keyed by the
      // viewer's participant id (playerId), the same key bindPrivateScoreGame reads.
      await page.evaluate((id) => localStorage.setItem('tm.privateScoreDisplay.' + id, '1'), playerId);
      await page.reload();
      await page.waitForSelector('.con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await page.waitForTimeout(3000);
      await expect(page.locator('.con-score .vp-private')).toBeVisible();
      expect(await page.locator('.con-score__cell--vp .con-score__value').count()).toBe(0);
      await expect(page.locator('.con-score__value--tr')).toHaveText(/^\d+$/);
      await shootRail(page, preset, '03-rail-vp-masked');
      await page.evaluate((id) => localStorage.removeItem('tm.privateScoreDisplay.' + id), playerId);
    });
  });
}
