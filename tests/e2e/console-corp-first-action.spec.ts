import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, fillPicks, soloGameConfig} from './consoleStart';

/**
 * Console-native · the corporation's MANDATORY FIRST ACTION modal.
 *
 * Drives a real solo game (Tharsis Republic forced via customCorporationsList)
 * through the console start wizard to the player's first turn, where the
 * `corporationInitialAction` prompt must now be served by the DEDICATED
 * confirm modal (ConsoleCorpFirstActionConfirm) — the play composer's
 * mandatory sibling — and NOT by the «Разыграно» table's retired action mode.
 *
 * Asserts: the mandatory framing (kicker + badge), the printed first-action
 * ask, the honest post-confirm follow-up note, the corporation card on the
 * left, the played table NOT mounted, and that A submits the OrOptions option
 * (the modal yields to the city-placement follow-up).
 */

const OUT_DIR = path.resolve('screenshots', 'console-corp-first-action');

/**
 * A deterministic solo game whose only dealable corp is Tharsis Republic:
 * exactly ONE dealable corporation, so the wizard's corp step is forced to the
 * subject — a corporation whose first action ("Place a city tile") exercises
 * the modal's ask + the placement follow-up note. No preludes, so the wizard
 * stays short (corp → buy → start).
 */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'FirstActionTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  startingCorporations: 1,
  customCorporationsList: ['Tharsis Republic'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

test.describe('console corp first-action modal', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the mandatory first action is served by the dedicated modal, not the played table', async ({page, request}) => {
    test.setTimeout(300_000);

    // ── The pregame: the shared start driver (`consoleStart.ts`), stopped at
    //    the START RELEASE — never driven on to the board home.
    //
    //    That distinction is this spec's whole setup: `waitForBoardHome`
    //    CONFIRMS a `--corpfirst` composer by design (it is one of the things
    //    standing between the deployment and a live dock), so booting all the
    //    way home would answer the very prompt this spec exists to look at.
    //
    //    What used to stand here was a hand-rolled key script that decided the
    //    wizard was over by COUNTING `.con-start__frame` nodes — a question the
    //    DOM cannot answer: the scene stays MOUNTED through its yield
    //    (`ConsoleShell.vue:2395`) and its panes are `v-show`
    //    (`ConsoleStartScene.vue:26`). The driver reads what is PAINTED.
    await bootIntoGame(page, request, {
      config: GAME_CONFIG,
      // The corp step offers exactly one card, and it is deliberately a
      // corporation WITH a first action — the subject, not something to dodge.
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await fillPicks(p, 1);
        }
      },
      until: 'startRelease',
    });

    // The player's first turn: the corporationInitialAction prompt must mount
    // the DEDICATED modal (presence is derived — no imperative open). It is an
    // INTERRUPTIVE mandatory decision (consoleMandatoryGate.ts scopes
    // corpFirstAction as always-gated), so the shell first shows the
    // announce card (ConsoleMandatoryAnnounce, `.con-mandatory`) instead of
    // auto-opening it — A opens it.
    const modal = page.locator('.con-composer--corpfirst');
    const announce = page.locator('.con-mandatory');
    for (let i = 0; i < 10 && await modal.count() === 0; i++) {
      if (await announce.count() > 0) {
        await key(page, 'Enter', 800);
      } else {
        await page.waitForTimeout(800);
      }
    }
    await modal.waitFor({state: 'visible', timeout: 60_000});
    await page.waitForTimeout(1500); // entry transition settles
    await shoot(page, '01-first-action-modal');

    // The retired serving surface must NOT be mounted.
    expect(await page.locator('.con-played').count(), 'the played table must not serve the first action anymore').toBe(0);

    // Mandatory framing: the kicker + the badge.
    const kicker = await page.locator('.con-composer__kicker--mandatory').innerText();
    expect(kicker).toContain('ОБЯЗАТЕЛЬНОЕ ДЕЙСТВИЕ КОРПОРАЦИИ');
    const badge = (await page.locator('.con-composer__paytag--mandatory').innerText()).toUpperCase();
    expect(badge).toContain('ОБЯЗАТЕЛЬНО');

    // The printed first-action ask is shown (Tharsis: place a city tile).
    const ask = await page.locator('.con-composer__corpfirst-ask').innerText();
    expect(ask.trim()).not.toBe('');
    expect(ask).toContain('тайл города');

    // The honest post-confirm follow-up note — and it NAMES the tile: Tharsis
    // Republic's free city is «разместите тайл города», not a mute "pick a spot".
    const notes = await page.locator('.con-composer--corpfirst .con-composer__next').allInnerTexts();
    expect(notes.join(' ')).toContain('тайл города');
    // The row carries the tile pictogram, so the shared «ДАЛЕЕ» presenter really ran.
    expect(await page.locator('.con-composer--corpfirst .con-composer__next-tile').count()).toBeGreaterThan(0);

    // The corporation card renders as the modal's artifact (premium face).
    expect(await page.locator('.con-composer--corpfirst .con-composer__playcard :is(.card-container, .pcard)').count()).toBeGreaterThan(0);

    // The CTA names the action; A submits the OrOptions option.
    const cta = await page.locator('.con-composer--corpfirst .con-composer__cta-label').innerText();
    expect(cta.toUpperCase()).toContain('ВЫПОЛНИТЬ ПЕРВОЕ ДЕЙСТВИЕ');
    await key(page, 'Enter', 2500);

    // The modal yields to the action's own follow-up — the city placement.
    await modal.waitFor({state: 'detached', timeout: 30_000});
    const panel = page.locator('.con-context');
    let placing = false;
    for (let i = 0; i < 20 && !placing; i++) {
      placing = (await panel.innerText().catch(() => '')).includes('РАЗМЕЩЕНИЕ ТАЙЛА');
      if (!placing) {
        await page.waitForTimeout(600);
      }
    }
    await shoot(page, '02-city-placement-follow-up');
    expect(placing, 'the city placement follow-up never opened').toBeTruthy();
  });
});
