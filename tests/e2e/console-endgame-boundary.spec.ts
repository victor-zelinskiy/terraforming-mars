/*
 * THE END OF THE GAME IS A HARD BOUNDARY — and the post-game is READ-ONLY,
 * not read-nothing.
 *
 * Two halves of one report, on one real finished game (never a fixture):
 *
 * ① THE SEAL. Phase.END arrives from the POLL, so whatever the player had
 *    open at that instant is still open one frame later — and the scoring
 *    scene is one of the LOWEST layers in the shell (11480). The quick wheel
 *    (11500) and the hand pack (11645) therefore kept painting OVER the
 *    finale, and because the workspace consumes the whole pad while it
 *    stands, neither could be dismissed any more: an open action wheel was a
 *    lid welded over the final scoring. This spec ENTERS the endgame with the
 *    wheel open and a full hand, and demands a clean screen.
 *
 * ② THE FREE ROAM. Past «Свернуть» the scene is hidden BY THE PLAYER to read
 *    the final board — and a hidden surface that keeps eating the pad is not
 *    a workspace, it is a lock: the whole inspection used to be a static
 *    board with one live button. Journal, «Разыграно» and Information must
 *    all open and close, and B at the board-home ROOT — one calm step below
 *    everything — brings the results back.
 *
 * ⚠ Headless Chromium starves rAF on a quiet screen: every wait pumps a tiny
 * screenshot (a real BeginFrame), or the GSAP ceremony never advances.
 */
import {test, expect, Page} from '@playwright/test';
import {
  createTable, drive, forceFrame, waitWithFrames, shoot, terraformed, finishFinaleThroughPage,
} from './consoleEndgameHarness';
import {openConsole} from './consoleStart';

const SHOT_DIR = 'screenshots/console-endgame-boundary';

/** Open the RT action wheel from the board home, insisting through the poll. */
async function openActionWheel(page: Page): Promise<void> {
  await waitWithFrames(page, async () => {
    if ((await page.locator('.con-quick').count()) > 0) {
      return true;
    }
    await page.keyboard.press('Period'); // RT — the action-category wheel
    return false;
  }, 20_000, 'the RT action wheel');
}

/** Press `code`, then settle a beat with real frames (nothing here is instant). */
async function press(page: Page, code: string, settleMs = 700): Promise<void> {
  await page.keyboard.press(code);
  await forceFrame(page);
  await page.waitForTimeout(settleMs);
  await forceFrame(page);
}

test.describe('console endgame — the boundary seal and the read-only free roam', () => {
  test.setTimeout(600_000);

  test('an open wheel + a live hand do not survive Phase.END; the collapsed results roam read-only', async ({page, request}) => {
    const ids = await createTable(request, ['red', 'blue']);

    // ── to the finale, the viewer's own question answered through the page ──
    await drive(request, ids, terraformed);
    await drive(request, ids, (m) => m.waitingFor?.finalGreeneryPrompt !== undefined && m.game.phase !== 'end');
    await openConsole(page, ids[0]);
    await finishFinaleThroughPage(page);

    // ── the SETUP for the bug: the viewer is promptless on the board home,
    //    the other seat has not finished, and the player opens the wheel and
    //    goes to make tea. Phase.END will arrive underneath it. ──────────────
    await openActionWheel(page);
    await expect(page.locator('.con-quick'), 'the wheel is open BEFORE the game ends').toBeVisible();
    const handBefore = await page.locator('[data-hand-dock-card]').count();
    await shoot(page, SHOT_DIR, '01-wheel-open-before-end');

    await drive(request, ids, (m) => m.game.phase === 'end');
    await waitWithFrames(page, async () => {
      if ((await page.locator('.con-reveal').count()) > 0) {
        await page.keyboard.press('Enter'); // no silent loss: take pending draws first
        return false;
      }
      return (await page.locator('.con-endgame').count()) > 0;
    }, 90_000, 'the endgame workspace (taking pending reveals first)');
    await forceFrame(page);
    await shoot(page, SHOT_DIR, '02-endgame-entered');

    // ── ① THE SEAL ────────────────────────────────────────────────────────
    await expect(page.locator('.con-quick'), 'the action wheel left with the live game')
      .toHaveCount(0, {timeout: 15_000});
    // The dock's CHASSIS was always hidden at Phase.END; the BODIES are a
    // separate fixed layer and were not — a full hand painted over the count.
    expect(handBefore, 'the probe needs a real hand to have been on screen').toBeGreaterThan(0);
    await expect(page.locator('[data-hand-dock-card]'), 'the hand pack left with the dock')
      .toHaveCount(0, {timeout: 15_000});
    // …and nothing else from the live game is standing over the scene.
    await expect(page.locator('.con-journal, .con-played, .con-info, .con-zoom, .con-confirm'),
      'no live-game surface survived the boundary').toHaveCount(0);

    // The scene is USABLE — which is the whole point of the report: X skips
    // the count and lands on the settled action list.
    await press(page, 'KeyX', 1500);
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__action').count()) > 0, 30_000, 'the settled action list');
    await shoot(page, SHOT_DIR, '03-settled');

    // ── ② THE FREE ROAM ───────────────────────────────────────────────────
    await press(page, 'Escape', 1200); // B = «Свернуть»
    await expect(page.locator('.con-endgame'), 'the scene is hidden, its frame alive').toBeHidden();
    await expect(page.locator('.con-board'), 'the final board is on show').toBeVisible();
    await shoot(page, SHOT_DIR, '04-collapsed');

    // The JOURNAL — the fullest read of what happened.
    await press(page, 'KeyR');
    await expect(page.locator('.con-journal'), 'the journal opens in the post-game').toBeVisible({timeout: 10_000});
    await shoot(page, SHOT_DIR, '05-journal');
    await press(page, 'Escape');
    await expect(page.locator('.con-journal'), 'and closes one level back').toHaveCount(0, {timeout: 10_000});

    // «РАЗЫГРАНО» — every player's final tableau.
    await press(page, 'KeyX');
    await expect(page.locator('.con-played'), '«Разыграно» opens in the post-game').toBeVisible({timeout: 10_000});
    await press(page, 'Escape');
    await expect(page.locator('.con-played'), 'and closes one level back').toHaveCount(0, {timeout: 10_000});

    // INFORMATION — the per-seat dossier. During the COUNT it is deliberately
    // unreachable (it would pre-reveal the totals); past the result it is the
    // main instrument of the inspection.
    await press(page, 'KeyY');
    await expect(page.locator('.con-info'), 'Information opens in the post-game').toBeVisible({timeout: 10_000});
    await shoot(page, SHOT_DIR, '06-information');
    await press(page, 'KeyY');
    await expect(page.locator('.con-info'), 'and Y closes it again').toHaveCount(0, {timeout: 10_000});

    // The board's own inspection mode is a LEVEL of its own — B leaves it
    // before it means «back to the results».
    await press(page, 'KeyC'); // L3
    await press(page, 'Escape');
    await expect(page.locator('.con-endgame'), 'leaving inspection is not leaving the post-game').toBeHidden();

    // …and at the ROOT, with nothing shallower left to close, B is the road
    // back to the results.
    await press(page, 'Escape', 1500);
    await expect(page.locator('.con-endgame'), 'B at the board-home root restores the results').toBeVisible({timeout: 10_000});
    // It comes back SETTLED — the collapse parked the state, it never replayed
    // the ceremony (the action list is the settled terminal phase).
    expect(await page.locator('.con-eg__action').count(),
      'the results return settled, action list intact').toBeGreaterThan(0);
    await shoot(page, SHOT_DIR, '07-back-to-results');
  });
});
