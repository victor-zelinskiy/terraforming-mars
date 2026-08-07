import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig} from './consoleStart';

/**
 * «РАЗЫГРАНО» → fullscreen → BACK: the table must stay on stage.
 *
 * The stage-suspend rule (`body.con-zoom-open`) used to park the played
 * table with `visibility: hidden` for the whole dialog lifetime. The class
 * drops in `onCardZoomClosed` — i.e. AFTER the close flight — so the card
 * physically returned into a VOID and the table popped in a frame later.
 * The table is no longer parked (the stage veil covers it instead), so:
 *
 *  1. while the fullscreen is open the table is still VISIBLE (dimmed under
 *     the veil, never `visibility: hidden`);
 *  2. its slot geometry is live throughout — the return flight always has a
 *     real rect to land in;
 *  3. the source slot itself is HELD empty while the card is away (no double
 *     image of the same card).
 */

const OUT_ROOT = path.resolve('screenshots', 'played-zoom-return');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'ZoomTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  automa: {difficulty: 'normal'},
});

async function key(page: Page, code: string, settleMs = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

test.describe('played table ⇄ fullscreen', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the table stays on stage while a card is inspected fullscreen', async ({page, request}) => {
    // The pregame boot dominates this test's wall clock, and 300s left it no
    // margin: it timed out mid-run on a loaded machine with nothing wrong.
    // Matches the budget the other boot-heavy console specs settled on.
    test.setTimeout(480_000);

    // ── The pregame: the shared start driver (`consoleStart.ts`). The walk is
    //    SETUP, never the subject — this spec's claim is the played table
    //    surviving a fullscreen round trip, so a start-flow change is adapted
    //    THERE, never here. The local walk it replaces asked whether
    //    `.con-start__frame` had a COUNT of 0, which the DOM cannot answer:
    //    the scene stays MOUNTED through its yield (`ConsoleShell.vue:2395`)
    //    and its panes are `v-show` (`ConsoleStartScene.vue:26`).
    await bootIntoGame(page, request, {config: GAME_CONFIG, query: '&consoleProfile=auto'});

    // Board home → «Разыграно» (X), then A on the corporation zone: it holds
    // exactly one card, so the smart shortcut opens the fullscreen directly.
    await key(page, 'KeyX', 1000);
    const table = page.locator('.con-played');
    await expect(table).toHaveCount(1);
    const slotBefore = await page.locator('.con-played__slot').first().boundingBox();
    expect(slotBefore, 'the table must have a real slot rect').toBeTruthy();

    await key(page, 'Enter', 1400);
    await expect(page.locator('.con-zoom__prov')).toHaveCount(1);

    // 1 · The table is NOT parked — it reads as a dimmed silhouette under
    // the stage veil (the return flight has something to land on).
    await expect(table).toBeVisible();
    expect(await table.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    // 2 · …and its slot geometry is live throughout.
    const slotDuring = await page.locator('.con-played__slot').first().boundingBox();
    expect(slotDuring?.width ?? 0).toBeGreaterThan(4);
    // 3 · The source slot itself is HELD empty (no double image).
    await expect(page.locator('.con-played .con-zoom-hold')).toHaveCount(1);
    await shoot(page, '01-fullscreen-over-table');

    // Back: the card returns into its own slot on a visible table. The close
    // is a choreographed flight that deliberately swallows input while it
    // plays — press until the viewer is actually gone (adaptive, never a
    // fixed sleep).
    const plate = page.locator('.con-zoom__prov');
    for (let i = 0; i < 5 && await plate.count() > 0; i++) {
      await key(page, 'Escape', 900);
    }
    await expect(plate).toHaveCount(0);
    await expect(table).toBeVisible();
    await expect(page.locator('.con-played .con-zoom-hold')).toHaveCount(0);
    await shoot(page, '02-returned');
  });
});
