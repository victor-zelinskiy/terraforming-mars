import {expect, Page, test} from '@playwright/test';
import {createGameWithCards, soloGameConfig} from './consoleStart';
import {createCampaign, launchMission, seedIdentity} from './campaignFixtures';

/**
 * SCENE TRANSITION LIFECYCLE — the readiness-gated curtain of every screen
 * boundary (menu ⇄ game ⇄ campaign).
 *
 * What is pinned here, per the director's contract:
 *  1. The destination is COMPOSED before it is shown: at the frame the
 *     curtain starts its reveal dissolve, the destination's root (and, for a
 *     new game, the start workspace) already exists — never a bare star
 *     texture the scene then pops onto.
 *  2. The anti-flash text policy: a fast load shows NO status text at all;
 *     once text is shown (a slow load) it stays readable — the reveal may not
 *     start under the minimum dwell.
 *  3. The exit funnel: leaving a game goes UNDER the curtain (no raw
 *     teardown), and a campaign mission's exit lands on ITS campaign map,
 *     not the generic menu.
 *
 * The probe is a MutationObserver armed BEFORE the first navigation (an
 * after-the-fact query cannot testify about the reveal frame), sampling in
 * the same mutation batch — per the testing rules, never rAF.
 */

type SceneSnapshot = {
  conRoot: boolean;
  startFrame: boolean;
  menu: boolean;
  campaignMap: boolean;
};

type SceneProbe = {
  sawCurtain: boolean;
  footShownAt: number;
  revealStartAt: number;
  curtainRemovedAt: number;
  atRevealStart: SceneSnapshot | null;
};

async function armTransitionProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = {
      sawCurtain: false,
      footShownAt: 0,
      revealStartAt: 0,
      curtainRemovedAt: 0,
      atRevealStart: null as unknown,
    };
    (window as unknown as {__sceneProbe: unknown}).__sceneProbe = probe;
    const snapshot = () => ({
      conRoot: document.querySelector('.con-root') !== null,
      startFrame: document.querySelector('.con-start__frame') !== null,
      menu: document.querySelector('.cm-menu') !== null,
      campaignMap: document.querySelector('.cmap__card') !== null,
    });
    const check = () => {
      const load = document.querySelector('.con-load');
      if (load !== null) {
        probe.sawCurtain = true;
        if (probe.footShownAt === 0 && load.querySelector('.con-load__foot--shown') !== null) {
          probe.footShownAt = performance.now();
        }
        if (probe.revealStartAt === 0 && load.classList.contains('con-load-fade-leave-active')) {
          probe.revealStartAt = performance.now();
          probe.atRevealStart = snapshot();
        }
      } else if (probe.sawCurtain && probe.curtainRemovedAt === 0) {
        probe.curtainRemovedAt = performance.now();
        if (probe.atRevealStart === null) {
          // The leave class lasts one fade — if a mutation batch skipped it,
          // the removal frame is the (later, stricter) witness.
          probe.atRevealStart = snapshot();
          probe.revealStartAt = probe.curtainRemovedAt;
        }
      }
    };
    const mo = new MutationObserver(check);
    const start = () => {
      mo.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
      });
      check();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  });
}

function readProbe(page: Page): Promise<SceneProbe> {
  return page.evaluate(() => (window as unknown as {__sceneProbe: SceneProbe}).__sceneProbe);
}

/** The dwell the director guarantees once status text was shown (base ms,
 *  minus slack for timer/paint jitter). */
const MIN_TEXT_DWELL_OBSERVED_MS = 950;

/**
 * Leave the game through the system overlay (KeyM → the «To main menu» plate
 * → its confirm card) — the console's one exit door; the desktop corner
 * button is display:none in console mode.
 */
async function exitViaSystemMenu(page: Page): Promise<void> {
  // A single KeyM can land in a busy boot beat — retry the press, but only
  // while the overlay is NOT up (a second press would toggle it closed).
  await expect(async () => {
    if (!(await page.locator('.con-sys--menu').isVisible())) {
      await page.keyboard.press('KeyM');
    }
    await expect(page.locator('.con-sys--menu')).toBeVisible({timeout: 1500});
  }).toPass({timeout: 20_000});
  await page.click('.con-sysact__plate--exit');
  await page.waitForSelector('.con-sysconfirm', {timeout: 5_000});
  await page.keyboard.press('Enter');
}

test.describe('scene transition lifecycle', () => {
  test('a new game reveals INTO its start workspace, with the anti-flash text policy holding', async ({page, request}) => {
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig()});
    await armTransitionProbe(page);
    await page.goto(`/player?id=${playerId}&console=1`);
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 60_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});

    const probe = await readProbe(page);
    expect(probe.sawCurtain, 'the curtain must cover the boot').toBeTruthy();
    expect(probe.atRevealStart, 'the reveal frame must have been witnessed').not.toBeNull();
    // The whole point of the rework: at the FIRST visible frame the shell is
    // already standing and the start workspace is already composed — the
    // player never sees a bare atmosphere or a board a workspace pops over.
    expect(probe.atRevealStart!.conRoot, 'ConsoleShell must exist at the reveal').toBeTruthy();
    expect(probe.atRevealStart!.startFrame, 'the start workspace must be composed at the reveal').toBeTruthy();
    // Anti-flash: either the text never existed (fast load), or it was held
    // readable before the reveal began.
    if (probe.footShownAt !== 0) {
      expect(probe.revealStartAt - probe.footShownAt).toBeGreaterThanOrEqual(MIN_TEXT_DWELL_OBSERVED_MS);
    }
  });

  test('a slow boot fetch shows the readable status line, then reveals', async ({page, request}) => {
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig()});
    await page.route('**/api/player*', async (route) => {
      await new Promise((r) => setTimeout(r, 2600));
      await route.continue();
    });
    await armTransitionProbe(page);
    await page.goto(`/player?id=${playerId}&console=1`);
    // The wait is real → the status block must exist and carry copy.
    const foot = page.locator('.con-load__foot--shown');
    await expect(foot).toBeVisible({timeout: 10_000});
    await expect(page.locator('.con-load__status')).not.toHaveText('');
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 60_000});

    const probe = await readProbe(page);
    expect(probe.footShownAt, 'the status block must have been shown').toBeGreaterThan(0);
    expect(probe.revealStartAt - probe.footShownAt,
      'text that was shown must have been held readable').toBeGreaterThanOrEqual(MIN_TEXT_DWELL_OBSERVED_MS);
    expect(probe.atRevealStart!.conRoot).toBeTruthy();
  });

  test('exiting an ordinary game goes under the curtain and reveals a composed main menu', async ({page, request}) => {
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig()});
    await page.goto(`/player?id=${playerId}&console=1`);
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 60_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});

    // Arm the probe for the NEXT document (the exit reload) before leaving.
    await armTransitionProbe(page);
    await exitViaSystemMenu(page);
    await page.waitForURL((url) => !url.pathname.includes('player'), {timeout: 30_000});
    await page.waitForSelector('.cm-menu', {timeout: 30_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 30_000});

    const probe = await readProbe(page);
    expect(probe.sawCurtain, 'the exit must ride the curtain — never a raw teardown').toBeTruthy();
    expect(probe.atRevealStart!.menu, 'the menu must be composed at the reveal').toBeTruthy();
  });

  test('exiting a campaign mission lands on ITS campaign map, not the generic menu', async ({page, request}) => {
    const campaign = await createCampaign(request);
    const launched = await launchMission(request, campaign.id);
    expect(launched.yourPlayerId).toBeTruthy();

    await seedIdentity(page, 'Alice');
    await page.goto(`/player?id=${launched.yourPlayerId}&console=1`);
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 60_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});

    await armTransitionProbe(page);
    await exitViaSystemMenu(page);
    await page.waitForURL((url) => url.pathname.includes('campaign'), {timeout: 30_000});
    expect(new URL(page.url()).searchParams.get('id')).toBe(campaign.id);
    await page.waitForSelector('.cmap__card', {timeout: 30_000});
    await page.waitForSelector('.con-load', {state: 'detached', timeout: 30_000});

    const probe = await readProbe(page);
    expect(probe.sawCurtain).toBeTruthy();
    expect(probe.atRevealStart!.campaignMap, 'the campaign map must be composed at the reveal').toBeTruthy();
  });
});
