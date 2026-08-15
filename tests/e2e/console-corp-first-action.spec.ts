import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig} from './consoleStart';

/**
 * Console-native · the corporation's MANDATORY FIRST ACTION — the Game Start
 * Workspace's own final conditional stage.
 *
 * Drives a real solo game (Tharsis Republic forced via customCorporationsList)
 * to the player's first turn, where the `corporationInitialAction` prompt must
 * now be served INSIDE the start flow: the workspace's «ПЕРВОЕ ДЕЙСТВИЕ» stage
 * — the corporation card on its source seat, the briefing beside it, ONE clear
 * CTA — and NOT by the retired standalone confirm modal, and NOT behind a
 * mandatory announce plate (the workspace itself is the presentation).
 *
 * Asserts: the stage panel (mandatory framing + the printed ask + the honest
 * placement follow-up note), the seated corporation card, the continuous
 * breadcrumb, the ABSENCE of the modal/announce, that A submits the option
 * (the workspace yields to the city placement), and the COMPLETION BARRIER:
 * the workspace never paints again while the placement's own chain (the
 * commit flight, the follow-ups) is still running — it returns exactly once.
 */

const OUT_DIR = path.resolve('screenshots', 'console-corp-first-action');

/**
 * A deterministic solo game whose only dealable corp is Tharsis Republic:
 * exactly ONE dealable corporation, so the wizard's corp step is forced to the
 * subject — a corporation whose first action ("Place a city tile") exercises
 * the stage's ask + the placement follow-up + the completion barrier.
 *
 * PRELUDES ARE ON, and projects are bought, ON PURPOSE: that is the flow's
 * WIDEST journey composition (КОРПОРАЦИЯ + ПРОЕКТЫ + ПРОЛОГИ + ПЕРВОЕ
 * ДЕЙСТВИЕ + ГОТОВО), which is the only shape in which the rail's fixed
 * geometry reserve can clip its last stage — the reported «ГОТОВО обрезан».
 * A no-prelude game fits in any reserve and would have watched that bug ship.
 * It also puts the stage where it belongs in the order: after the preludes.
 */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'FirstActionTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  startingCorporations: 1,
  customCorporationsList: ['Tharsis Republic'],
  expansions: {corpera: true, prelude: true},
  customPreludes: ['Donation', 'Loan', 'Martian Industries', 'Metals Company'],
  startingPreludes: 4,
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

test.describe('console corp first action — the start workspace stage', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the mandatory first action is the start flow\'s own stage — no modal, one return from the placement', async ({page, request}) => {
    test.setTimeout(300_000);

    // ── The pregame, stopped with the corporationInitialAction prompt live
    //    (the API seed answers everything before it; the console then opens
    //    straight onto the workspace's standing first-action stage).
    await bootIntoGame(page, request, {
      config: GAME_CONFIG,
      // NAMED, never left to the seeder's default: `customCorporationsList`
      // only guarantees the corp is IN the deal, and testMode deals eight — so
      // the default «pick a CALM corporation» would deliberately step around
      // the one corp this spec exists to look at.
      corporation: 'Tharsis Republic',
      preludes: ['Donation', 'Loan'],
      buy: 2,
      until: 'startRelease',
    });

    // ── THE STAGE — the workspace serves the prompt itself, seamlessly.
    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    await page.waitForTimeout(1500); // the rise + panel entrance settle
    await shoot(page, '01-first-action-stage');

    // The RETIRED surfaces must never appear in the start flow: the standalone
    // confirm modal and the announce plate (the workspace IS the presentation).
    expect(await page.locator('.con-composer--corpfirst').count(),
      'the standalone first-action modal must never rise inside the start flow').toBe(0);
    expect(await page.locator('.con-mandatory').count(),
      'no announce plate — the stage presents the action itself').toBe(0);

    // The corporation card stands on the SOURCE SEAT (one physical card).
    expect(await page.locator('.con-start__embedsource [data-embed-source-slot] :is(.card-container, .pcard, [class*="plite"])').count())
      .toBeGreaterThan(0);

    // Mandatory framing + the printed ask (Tharsis: place a city tile).
    const kicker = (await stage.locator('.con-start__firstact-kicker').innerText()).toUpperCase();
    expect(kicker).toContain('ОБЯЗАТЕЛЬНО');
    const ask = await stage.locator('.con-start__firstact-ask').innerText();
    expect(ask.trim()).not.toBe('');
    expect(ask).toContain('тайл города');

    // The honest post-confirm follow-up note NAMES the tile + carries its
    // pictogram (the shared «ДАЛЕЕ» presenter — composer parity).
    const notes = await stage.locator('.con-start__firstact-next').allInnerTexts();
    expect(notes.join(' ')).toContain('тайл города');
    expect(await stage.locator('.con-start__firstact-next-tile').count()).toBeGreaterThan(0);

    // The continuous breadcrumb: the stage advanced ONLY the tail.
    const crumb = (await page.locator('.con-wshead').innerText()).toUpperCase();
    expect(crumb).toContain('ПЕРВОЕ ДЕЙСТВИЕ');

    // ── THE JOURNEY RAIL MUST NOT EAT ITS LAST STAGE. The rail's width is a
    //    fixed geometry reserve AND an `overflow: hidden` clip, so adding a
    //    conditional stage to the flow can silently push «ГОТОВО» out of the
    //    box (it did — the reported «финальный этап обрезан»). Assert the
    //    INVARIANT, never the reserve's number: every item is fully inside
    //    the rail, and the terminal one is present.
    const railFit = await page.evaluate(() => {
      const root = document.querySelector('.con-jrail');
      if (root === null) {
        return {ok: false, reason: 'no rail', overflowing: [] as Array<string>};
      }
      const box = root.getBoundingClientRect();
      const items = Array.from(document.querySelectorAll('.con-jrail__item'));
      const overflowing = items
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > box.right + 0.5 || r.left < box.left - 0.5);
        })
        .map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
      return {
        ok: items.length > 0,
        reason: '',
        overflowing,
        labels: items.map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
      };
    });
    expect(railFit.ok, railFit.reason).toBeTruthy();
    expect(railFit.overflowing, 'a journey stage is clipped out of the rail').toEqual([]);
    expect((railFit.labels ?? []).join(' ').toUpperCase(),
      'the terminal stage must be on the rail').toContain('ГОТОВО');

    // The ONE clear CTA.
    const cta = (await stage.locator('.con-start__firstact-cta-label').innerText()).toUpperCase();
    expect(cta).toContain('ВЫПОЛНИТЬ ПЕРВОЕ ДЕЙСТВИЕ');

    // ── A performs the action: the workspace yields to the city placement.
    await key(page, 'Enter', 1800);
    const placement = page.locator('.con-context__task-kicker');
    // ⚠️ EVERY `.con-context` read here is BOUNDED. The config leaves
    // Playwright's actionTimeout at its default 0 (unlimited), so an
    // `innerText()` against a panel that has UNMOUNTED auto-waits until the
    // TEST timeout kills it — this spec burned its whole 300 s exactly there:
    // the first Enter of the placement loop below landed on the seeded legal
    // cell, `.con-context` left with the placement, and the next read hung
    // forever. An absent panel must read as «not placing», never as a wait.
    let placing = false;
    for (let i = 0; i < 20 && !placing; i++) {
      placing = (await page.locator('.con-context').innerText({timeout: 2000}).catch(() => '')).includes('РАЗМЕЩЕНИЕ ТАЙЛА');
      if (!placing) {
        await page.waitForTimeout(600);
      }
    }
    await shoot(page, '02-city-placement');
    expect(placing, 'the city placement follow-up never opened').toBeTruthy();
    expect(await startPainted(page), 'the workspace yields to the board placement').toBeFalsy();

    // ── THE COMPLETION BARRIER — pick a legal cell, then SAMPLE the paint:
    //    the workspace must not reappear while the placement's chain (the
    //    tile's commit flight, the reward beat, any follow-up) is running —
    //    it returns exactly once, onto a settled frame.
    for (let i = 0; i < 24; i++) {
      await key(page, 'Enter', 500);
      // Bounded read (see the note above): once the placement resolves the
      // panel UNMOUNTS, and an unbounded innerText would hang the test here.
      if ((await page.locator('.con-context').innerText({timeout: 1500}).catch(() => '')).includes('РАЗМЕЩЕНИЕ ТАЙЛА') === false) {
        break;
      }
      await key(page, 'ArrowRight', 260);
    }
    let midChainFlash = false;
    let returned = false;
    for (let i = 0; i < 80 && !returned; i++) {
      const painted = await startPainted(page);
      const chainBusy = await page.evaluate(() =>
        document.querySelectorAll('.con-tileplace, .con-context__task-kicker').length > 0);
      if (painted && chainBusy) {
        midChainFlash = true;
      }
      // The workspace has genuinely returned once the chain is quiet — or it
      // released straight to the board (both are a settled end state).
      if ((painted && !chainBusy) ||
          await page.evaluate(() => document.querySelector('.con-start') === null)) {
        returned = true;
      }
      await page.waitForTimeout(250);
    }
    await shoot(page, '03-back-after-the-chain');
    expect(midChainFlash, 'the workspace flashed back MID-CHAIN (the completion barrier failed)').toBeFalsy();
    expect(returned, 'the workspace never came back after the placement chain').toBeTruthy();
  });
});
