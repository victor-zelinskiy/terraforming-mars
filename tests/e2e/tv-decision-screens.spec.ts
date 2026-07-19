import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * TV-4K DECISION-SCREEN capture (iteration 2b — the rejected surfaces).
 *
 * The `tv-profile-screens` matrix drove a prelude game whose start driver
 * STALLED in the prelude phase — so its "board" frames were actually the
 * start scene, and the decision surfaces the user flagged (basic-actions
 * wheel / standard projects / play-card confirm / card-actions) were never
 * rendered. This spec runs a NO-PRELUDE game so the start wizard hands over
 * to a REAL action-phase board home, then drives to each decision surface at
 * native 4K. It only asserts the shell mounted — the frames are the artefact.
 *
 * Colonies get their own capture (`04-colonies` from the colonies-enabled
 * run) — enabling colonies here would add a "remove a colony" setup prompt
 * that blocks the board.
 */

const OUT = path.resolve('screenshots', 'tv-decisions');

function cfg() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'TVTester', color: 'red', beginner: false, handicap: 0, first: true}],
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
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}
async function key(page: Page, code: string, settle = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}
async function toBoard(page: Page): Promise<void> {
  // Escape-ONLY back to the calm board home (KeyE/KeyQ change section and
  // can OPEN the played tableau — the driver must never do that).
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.con-quick, .con-stdp, .con-cardactions, .con-composer, .con-colonies, .con-hand, .con-played, .con-journal').count() === 0) {
      return;
    }
    await key(page, 'Escape', 400);
  }
}

test.describe('tv-4k decision screens', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});

  test('captures the decision surfaces', async ({page, request}) => {
    test.setTimeout(600_000);

    const created = await request.post('/api/creategame', {data: cfg()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    const id = model.players[0].id;

    await page.goto(`/player?id=${id}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
    await page.waitForTimeout(3500);

    // The start WIZARD, driven as a fixed choreography (corp → BUY a few
    // projects → summary → pay → begin) so the viewer reaches the action
    // turn WITH a hand (an empty hand → no play-card confirm to capture).
    // A(Enter) = pick/toggle/pay/begin; RB(KeyE) = «СЛЕД. ШАГ» advances a
    // wizard step (safe here; only dangerous on the board). ArrowRight walks
    // the buy grid so several distinct cards get selected.
    const startUp = async () => await page.locator('.con-start__frame, .con-task-host').count() > 0;
    if (await startUp()) {
      await key(page, 'Enter', 1100);            // step 1: pick the focused corp
      await key(page, 'KeyE', 1000);             // → step 2 (buy projects)
      for (let k = 0; k < 5; k++) {              // select ~5 distinct cards
        await key(page, 'Enter', 650);
        await key(page, 'ArrowRight', 450);
      }
      await key(page, 'KeyE', 1000);             // → step 3 (summary)
      await key(page, 'Enter', 1200);            // pay
    }
    // Pay for the bought cards («A ОПЛАТИТЬ» on the payment overlay — NOT a
    // `.con-start__frame`, so an unconditional burst is needed) + begin the
    // game / first action. toBoard cleans any overlay A opened on the board.
    for (let i = 0; i < 6; i++) {
      await key(page, 'Enter', 900);
    }
    await page.waitForTimeout(1500);
    await toBoard(page);

    const onBoard = await page.locator('.con-board').count() > 0;
    expect(onBoard, 'never reached the board home').toBeTruthy();
    await shoot(page, '00-board-home');

    // ── 1 · Hand → play-card confirm — FIRST (before the wheels perturb the
    //        section state). RT wheel → A centre «Карты» → hand. ──────────
    await key(page, 'Period', 1000);
    if (await page.locator('.con-quick').count() > 0) {
      await key(page, 'Enter', 1400); // A = centre «Карты» → hand
    }
    if (await page.locator('.con-hand').count() > 0) {
      await shoot(page, '04-hand');
      await key(page, 'Enter', 1600); // primary on the focused (playable-first) card
      if (await page.locator('.con-composer--play, .con-composer').count() > 0) {
        await shoot(page, '05-play-confirm');
        await key(page, 'Escape', 800);
      }
    }
    await toBoard(page);

    // ── 2 · LT basic-actions quick wheel (the overlap defect) ───────────
    await key(page, 'Comma', 1000);
    if (await page.locator('.con-quick').count() > 0) {
      await shoot(page, '01-basics-wheel');
      await key(page, 'Enter', 1200); // A = centre → Standard Projects
      if (await page.locator('.con-stdp').count() > 0) {
        await shoot(page, '02-standard-projects');
      }
    }
    await toBoard(page);

    // ── 3 · RT actions wheel → card-actions (ArrowUp = «Действия карт») ──
    await key(page, 'Period', 1000);
    if (await page.locator('.con-quick').count() > 0) {
      await shoot(page, '03-actions-wheel');
      await key(page, 'ArrowUp', 1200);
      if (await page.locator('.con-cardactions').count() > 0) {
        await shoot(page, '06-card-actions');
      }
    }
  });
});
