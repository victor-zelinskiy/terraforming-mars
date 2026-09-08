import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, fillPicks, pickCards, soloGameConfig} from './consoleStart';

/**
 * Console-native · VITOR'S FREE AWARD SPONSORSHIP is a SCENE STEP of the
 * start workspace — never a screen standing on top of it.
 *
 * The reported violation: the corporation's first action («fund an award for
 * free») opened the awards surface as a LATERAL overlay over the still-painted
 * start workspace — the MA screen titled itself «НАГРАДЫ» while the start's
 * own «… › КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ» head bled through underneath, the
 * breadcrumb restarted, and the nesting was stated nowhere.
 *
 * The contract now (frameSteps: {awards: 'scene'} on the start row):
 *  1. A on «ВЫПОЛНИТЬ ПЕРВОЕ ДЕЙСТВИЕ» opens the awards as a HOSTED step —
 *     the tiles keep the exact full-scene composition of the standalone
 *     screen, and the START stops painting (no bleed-through, ever);
 *  2. the header is the STACK's — «СТАРТ ПАРТИИ › VITOR › НАГРАДЫ», deepening
 *     to «› <award> › СПОНСОРСТВО» on the descend: the nesting lives in the
 *     header and only the tail advances;
 *  3. the command bar offers NO category bumper (a mandatory step is not a
 *     dashboard stroll) and B = «СВЕРНУТЬ» (the whole flow parks; the
 *     board-home restore card is the way back, at full depth);
 *  4. the funding commit plays the ceremony INSIDE the workspace, the step
 *     closes on the ceremony's own completion, and the START comes back to
 *     finish its first-action leave — one flow, one thread of screens.
 */

const OUT_DIR = path.resolve('screenshots', 'console-vitor-award-step');

/**
 * Human + MarsBot: awards are DISABLED in true solo (the rules' own 1-player
 * carve-out — Vitor's initialAction returns early there and this flow never
 * exists), so the bot provides the second seat. Vitor is NAMED at boot: the
 * customCorporationsList only guarantees the corp is IN the eight-card
 * testMode deal.
 */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'VitorTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  startingCorporations: 1,
  customCorporationsList: ['Vitor'],
  expansions: {corpera: true, prelude: true},
  customPreludes: ['Acquired Space Agency', 'Metals Company', 'Donation', 'Loan'],
  startingPreludes: 4,
  automa: {difficulty: 'normal'},
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** The start workspace is PAINTED (mounted-and-hidden is the yield pose). */
async function startPainted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-start');
    return el !== null &&
      (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
  }).catch(() => false);
}

/** The one workspace header's text, whitespace-collapsed, uppercased. */
async function maCrumbText(page: Page): Promise<string> {
  return (await page.locator('.con-ma__wshead').innerText().catch(() => ''))
    .replace(/\s+/g, ' ').toUpperCase();
}

async function barText(page: Page): Promise<string> {
  return (await page.locator('.con-cmdbar').innerText().catch(() => ''))
    .replace(/\s+/g, ' ').toUpperCase();
}

test.describe('console Vitor · the free sponsorship is a start-workspace step', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('first action → hosted awards scene → collapse/restore → fund → ceremony → the start returns', async ({page, request}) => {
    test.setTimeout(480_000);

    // ⚠️ THE UI PATH, deliberately: the API seed opens the console with the
    // first-action prompt already standing, and that RESTORE entry of the
    // stage is a known pre-existing stable failure (the 2026-09-03 start
    // cluster — «стадия стоит, тело пустое»). The award step's subject is the
    // LIVE journey, which is the path the player actually takes.
    await bootIntoGame(page, request, {
      config: GAME_CONFIG,
      until: 'startRelease',
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, ['Vitor']), 'the corp deal held Vitor').toContain('Vitor');
        } else if (kind === 'prelude') {
          // The NO-DRAW pair, deterministically — drawing preludes change the
          // first-action entry timing (the entry-probe's own discipline).
          await pickCards(p, ['Acquired Space Agency', 'Metals Company']);
          await fillPicks(p, 2);
        }
        // projects: none.
      },
    });

    // ── The first-action stage stands (the WAIT pose has no CTA — wait for
    //    the actionable one: the bot may hold the table for a beat).
    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 120_000});
    const cta = stage.locator('.con-start__firstact-cta-label');
    await cta.waitFor({state: 'visible', timeout: 120_000});
    await page.waitForTimeout(1200); // the rise + panel entrance settle
    await shoot(page, '01-first-action-stage');

    // ── A performs the action → the awards arrive as a HOSTED SCENE STEP.
    await key(page, 'Enter', 1200);
    await page.waitForSelector('.con-ma', {timeout: 30_000});
    await page.waitForTimeout(900); // the entrance settles
    await shoot(page, '02-awards-step');

    // 1 · The START stops painting — the reported bleed-through (two headers
    //     over each other) is the forbidden state.
    expect(await startPainted(page),
      'the start workspace must hand the scene over — never paint under the step').toBeFalsy();
    expect(await page.evaluate(() => document.querySelector('.con-start') !== null),
      '…but it stays MOUNTED underneath (state, claims, the return beat)').toBeTruthy();

    // 2 · The header states the FLOW, not this screen's name: root =
    //     «СТАРТ ПАРТИИ», subject = the corporation, tail = «НАГРАДЫ».
    const crumb = await maCrumbText(page);
    expect(crumb, 'the crumb roots at the flow the player entered').toContain('СТАРТ ПАРТИИ');
    expect(crumb, 'the corporation stays the carried subject').toContain('VITOR');
    expect(crumb, 'the tail names the stage').toContain('НАГРАДЫ');
    // The free-sponsorship economics stay stated (the task surface's promise).
    expect(crumb, 'the price chip reads «БЕСПЛАТНО»').toContain('БЕСПЛАТНО');

    // 3 · The command bar: the intent verb + «СВЕРНУТЬ», and NO category
    //     bumper — a mandatory step is not a dashboard stroll.
    const bar = await barText(page);
    expect(bar).toContain('СПОНСИРОВАТЬ');
    expect(bar).toContain('СВЕРНУТЬ');
    expect(bar, 'the milestones bumper must not be offered inside the step').not.toContain('ДОСТИЖЕНИЯ');

    // ── «СВЕРНУТЬ» is a ROUND TRIP: the whole flow parks, the board-home
    //    restore card is the way back — at full depth, crumb intact.
    await key(page, 'Escape', 1400);
    expect(await page.locator('.con-ma').count(), 'the step parks with the flow').toBe(0);
    await page.waitForSelector('.con-mandatory', {timeout: 15_000});
    await shoot(page, '03-collapsed-restore-card');
    await key(page, 'Enter', 1600);
    await page.waitForSelector('.con-ma', {timeout: 15_000});
    const restored = await maCrumbText(page);
    expect(restored, 'the restore lands back INSIDE the flow').toContain('СТАРТ ПАРТИИ');
    expect(restored).toContain('НАГРАДЫ');
    expect(await startPainted(page), 'the start stays yielded under the restored step').toBeFalsy();

    // ── A = descend into the focused fundable award; the crumb only gains a
    //    tail (root and subject never restart).
    await key(page, 'Enter', 700);
    await page.waitForSelector('.con-mafocus', {timeout: 8_000});
    await page.waitForTimeout(1100); // the reveal waves + the commit arm
    const detailCrumb = await maCrumbText(page);
    expect(detailCrumb, 'the root survives the descend').toContain('СТАРТ ПАРТИИ');
    expect(detailCrumb, 'the tail deepens to the funding stage').toContain('СПОНСОРСТВО');
    await shoot(page, '04-detail');

    // ── A commits the free funding → the ceremony plays INSIDE the workspace,
    //    and the step closes on the ceremony's own completion.
    await key(page, 'Enter', 500);
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    await shoot(page, '05-ceremony');
    await page.waitForSelector('.con-ma', {state: 'detached', timeout: 45_000});

    // ── The START is revealed again and finishes its own leave: the first
    //    action is done, the deployment concludes — a settled end state is
    //    either the returned scene or the board home past it.
    let settled = false;
    let startCameBack = false;
    for (let i = 0; i < 120 && !settled; i++) {
      const painted = await startPainted(page);
      if (painted) {
        startCameBack = true;
      }
      const gone = await page.evaluate(() => document.querySelector('.con-start') === null);
      if (gone) {
        settled = true;
      }
      await page.waitForTimeout(300);
    }
    await shoot(page, '06-after-the-step');
    expect(startCameBack || settled,
      'the start must take the scene back (or conclude) after the step').toBeTruthy();
    expect(settled, 'the deployment must conclude — the first action is done').toBeTruthy();
  });
});
