import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig} from './consoleStart';

/**
 * CONVERT PLANTS NAMES ITSELF — over the real DOM.
 *
 * The basic action «потратить 8 растений» opens a board placement, and its
 * context panel showed no source at all. The marker existed all along
 * (`ConvertPlants` sets `cancellablePlacement(...)`) — but the placement is a
 * NESTED branch of the action-menu `OrOptions`, and `ServerModel.getWaitingFor`
 * decorates the TOP-LEVEL prompt only, so it never reached the client. The same
 * trap `discardPrompt` already paid for; the marker now rides
 * `SelectSpace.toModel()` and survives any depth.
 *
 * This probe drives the REAL basic action — no interception — so it proves the
 * whole chain: server marker → nested serialization → chip → L3.
 */

const OUT = path.resolve('screenshots', 'convert-plants-source');

/** testMode grants 500 of every resource, so the 8 plants are already there. */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'Gardener', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}
async function key(page: Page, code: string, settle = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console placement panel · convert plants', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the basic action names itself as the source, and L3 opens it', async ({page, request}) => {
    test.setTimeout(300_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    // ── The pregame: the shared start driver (`consoleStart.ts`). The walk is
    //    SETUP, never the subject — this spec's claim is the placement panel's
    //    SOURCE chip, so a start-flow change is adapted THERE, never here.
    //
    //    What used to stand here was a blind A/RT alternation plus a RU-text
    //    rescue for the leftover buy step, and it decided the wizard was over
    //    by COUNTING `.con-start__frame` nodes — a question the DOM cannot
    //    answer: the scene stays MOUNTED through its yield
    //    (`ConsoleShell.vue:2395`) and its panes are `v-show`
    //    (`ConsoleStartScene.vue:26`). The driver submits the buy properly, so
    //    the rescue has nothing left to rescue.
    await bootIntoGame(page, request, {config: GAME_CONFIG});

    // LT wheel → «КОНВЕРТАЦИЯ РАСТЕНИЙ» is the LEFT slot of the basic actions.
    // The wheel is PRESS→RELEASE: the direction ARMS the slot on key-down and
    // FIRES it on key-up, so the arrow alone activates it. (An extra Enter
    // afterwards lands on the placement that just opened and commits the tile
    // at whatever cell is selected — which is how this probe first "lost" the
    // whole placement step.)
    await key(page, 'Comma', 1400);
    await shoot(page, '1-basic-actions');
    await key(page, 'ArrowLeft', 2600);
    await shoot(page, '2-convert-plants-placement');

    const panel = page.locator('.con-context');
    expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'never reached the board placement').toBeTruthy();

    // THE FIX: the nested marker arrives, so the panel names the basic action.
    const chip = panel.locator('.con-src');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveClass(/con-src--chip/);
    // The CARD's own name («Конвертировать растения»), not the wheel's label
    // for the same action («Потратить растения») — the chip names the object
    // L3 will open, so the two must agree with the card, not with the menu.
    await expect(chip.locator('.con-src__plate-name')).toContainText(/Конвертировать растения|Convert Plants/i);
    // The dossier IDENTITY: the object title («ОЗЕЛЕНЕНИЕ») + the structural
    // conversion formula (8 🌱 → 1 tile) instead of the old sentence headline.
    await expect(panel.locator('.con-context__title')).toContainText(/Озеленение|Greenery/i);
    await expect(panel.locator('.con-context__formula')).toHaveCount(1);
    await expect(panel.locator('.con-context__formula .con-context__f-num').first()).toHaveText(/^\d+$/);
    // The L3 verb lives in the COMMAND BAR ONLY — the panel's old hint line
    // is gone with the CTA (zero controller prompts inside the panel).
    // ⚠️ STRUCTURAL: «Нельзя разместить здесь» sits in the always-mounted
    // (collapsed) refusal well, so a text match for the CTA phrase hits the
    // REFUSAL and fails on a panel that has no CTA at all.
    await expect(panel.locator('.con-context__source-hint')).toHaveCount(0);
    await expect(panel.locator('.con-inspector__placement')).toHaveCount(0);
    await expect(page.locator('.con-cmdbar, .con-commands').first()).toContainText(/ИСТОЧНИК/i);

    // …and the marker's OTHER half arrives with it: this placement is genuinely
    // cancellable (the plants are spent only once a cell is chosen). The cancel
    // lives in the COMMAND BAR only — the panel used to legend it a second time
    // and that duplicate is gone, so assert on the bar and on the panel's
    // silence.
    await expect(page.locator('.con-cmdbar, .con-commands').first()).toContainText(/Отменить размещение/i);
    await expect(panel).not.toContainText(/Отменить размещение/i);

    // L3 opens the real standard-action card; the placement survives.
    await key(page, 'KeyC', 1800);
    await shoot(page, '3-convert-plants-source-fullscreen');
    await expect(page.locator('.con-zoom')).toHaveCount(1);
    await key(page, 'Escape', 1600);
    await expect(page.locator('.con-zoom')).toHaveCount(0);
    expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'the placement survives the viewer').toBeTruthy();
  });
});
