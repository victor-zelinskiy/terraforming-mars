import {expect, test} from '@playwright/test';
import {
  createCampaign, devCommit, launchMission, campaignModelAs,
} from './campaignFixtures';
import {
  journeyToEndgame, waitWithFrames, forceFrame, shoot,
} from './consoleEndgameHarness';

/*
 * CAMPAIGN FINALE — the mandatory CHAMPION ceremony inside the endgame
 * workspace (docs/CAMPAIGN_MODE_ARCHITECTURE.md §7.7).
 *
 * A REAL final mission, never a fixture: missions 1–3 are committed over the
 * dev fast-forward (ONE corporation per seat, so mission 4's deployment is
 * the base corporation alone — no merges for the generic API driver to
 * navigate), mission 4 is LAUNCHED and actually played to Phase.END through
 * the shared endgame harness. The ceremony under test therefore fires from
 * the real completion signal of the real scoring sequence — Title Points
 * included as the ordinary «Титулы» category.
 *
 * Pinned here:
 *  · the champion phase arrives ONLY after the full ordinary sequence;
 *  · the ceremony is MANDATORY — X/B/A/dpad land on nothing, no stale hints;
 *  · the row layout NEVER re-flows under the ceremony (decorative layer only);
 *  · the settled campaign state (× header, plate, keel, «Хроника кампании»
 *    focus) — and that A actually opens the campaign map scene;
 *  · a reload lands SETTLED (no uninvited replay);
 *  · «Повторить подсчёт» replays the full act, champion beat included.
 */

const SHOT_DIR = 'screenshots/console-campaign-endgame';

test.describe('campaign finale — the champion ceremony', () => {
  test('final mission: mandatory champion ceremony, settled state, reload, replay', async ({page, request}) => {
    test.setTimeout(600_000);

    // ── the campaign, fast-forwarded to its finale ─────────────────────────
    const {id} = await createCampaign(request, {testMode: true});
    await devCommit(request, id, [0, 1], {lineages: {0: ['Ecoline'], 1: ['Helion']}});
    await devCommit(request, id, [0, 1]);
    await devCommit(request, id, [0, 1]);
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId, 'launch must hand the creator her mission seat').toBeTruthy();
    const bruno = await campaignModelAs(request, id, 'Bruno');
    const brunoId = bruno.missions[3]?.yourPlayerId;
    expect(brunoId, 'the second seat must be addressable').toBeTruthy();

    // ── play mission 4 to Phase.END (the viewer on the page) ───────────────
    await journeyToEndgame(page, request, [aliceId!, brunoId!]);

    // ── the champion phase arrives from the REAL scoring-completion signal ─
    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--champion').count()) > 0,
    150_000, 'the champion phase (after the full scoring sequence)');
    await shoot(page, SHOT_DIR, '2p-champion-enter');

    // The results layout is FROZEN under the ceremony — decorative layer only.
    const rectsNow = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('.con-eg__row')).map((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
      }));
    const rowsBefore = await rectsNow();
    expect(rowsBefore.length).toBe(2);

    // MANDATORY: skip (X), collapse (B), confirm (A) and navigation all land
    // on nothing — mashing cannot fast-forward, collapse or break the act.
    for (const key of ['KeyX', 'Escape', 'Enter', 'ArrowDown', 'Enter', 'KeyX']) {
      await page.keyboard.press(key);
      await forceFrame(page);
    }
    expect(await page.locator('.con-eg__actions').count(),
      'input during the champion ceremony must not fast-forward it').toBe(0);
    await expect(page.locator('.con-endgame'), 'B must not collapse the mandatory scene').toBeVisible();

    // The plate transformation: «ПОБЕДИТЕЛЬ» → «ЧЕМПИОН КАМПАНИИ» + 4 pips.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__champline').count()) > 0,
    30_000, 'the champion plate');
    await shoot(page, SHOT_DIR, '2p-champion-plate');
    await expect(page.locator('.con-eg__champline').first()).toContainText(/Чемпион кампании/i);
    expect(await page.locator('.con-eg__champline-pip').count()).toBe(4);

    // Control returns ATOMICALLY at the settle; the layout never moved.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    60_000, 'the settled actions after the ceremony');
    expect(await rectsNow(), 'the results layout re-flowed under the ceremony').toEqual(rowsBefore);

    // The settled CAMPAIGN state: header, plate, keel — and the logical next
    // focus is the campaign map door («Хроника кампании», the list's head).
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    expect(await page.locator('.con-eg__champline').count()).toBeGreaterThan(0);
    expect(await page.locator('.con-eg__champ-keel').count()).toBeGreaterThan(0);
    await expect(page.locator('.con-eg__action--focused')).toContainText(/Хроника кампании/i);
    await shoot(page, SHOT_DIR, '2p-champion-settled');

    // A opens the already-implemented campaign map (chronicle state) as an
    // internal scene; B returns to the results.
    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg-campaign-scene .cmap').count()) > 0,
    30_000, 'the campaign map scene');
    await shoot(page, SHOT_DIR, '2p-chronicle');
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg-campaign-scene').count()) === 0,
    15_000, 'back to the settled results');

    // ── reload lands SETTLED — the ceremony never replays uninvited ────────
    await page.reload();
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    90_000, 'the settled state after reload');
    let sawChampionPhase = false;
    for (let i = 0; i < 20; i++) {
      if ((await page.locator('.con-endgame--champion').count()) > 0) {
        sawChampionPhase = true;
        break;
      }
      await forceFrame(page);
      await page.waitForTimeout(140);
    }
    expect(sawChampionPhase, 'a reload must land settled, never replay the ceremony').toBe(false);
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    expect(await page.locator('.con-eg__champline').count()).toBeGreaterThan(0);
    await shoot(page, SHOT_DIR, '2p-reload-settled');

    // ── «Повторить подсчёт» replays the FULL act, champion beat included ───
    for (let i = 0; i < 8; i++) {
      const txt = await page.locator('.con-eg__action--focused').innerText().catch(() => '');
      if (/Повторить подсчёт/i.test(txt)) {
        break;
      }
      await page.keyboard.press('ArrowRight');
      await forceFrame(page);
    }
    await expect(page.locator('.con-eg__action--focused')).toContainText(/Повторить подсчёт/i);
    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) === 0,
    15_000, 'the replay start (actions yield to the count)');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--champion').count()) > 0,
    150_000, 'the replayed champion phase');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    60_000, 'the replayed ceremony settles');
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    await shoot(page, SHOT_DIR, '2p-replay-settled');
  });
});

test.describe('campaign finale — five players at 4K TV scale', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});
  test('the champion ceremony reads at couch distance and never re-flows the dense table', async ({page, request}) => {
    test.setTimeout(600_000);

    // The fourth name rides the PLAYER_NAME_MAX_LENGTH cap (32 code points) —
    // the long-name readability case of the champion table.
    const names = ['Alice', 'Bruno', 'Клара', 'Дмитрий-Длинное-Имя-Экспедиции', 'Ева'];
    const colors = ['blue', 'red', 'green', 'yellow', 'purple'];
    const {id} = await createCampaign(request, {
      testMode: true,
      players: names.map((name, i) => ({name, color: colors[i], beginner: false, handicap: 0, first: i === 0})),
      // The wider corp pools (the testMode 8-corps-per-seat deal needs them
      // for a five-seat table — the createTable precedent).
      expansions: {
        corpera: true, promo: true, venus: false, colonies: false, prelude: false,
        prelude2: false, turmoil: false, community: true, ares: false, moon: false,
        pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
      },
    });
    const lineages = {0: ['Ecoline'], 1: ['Helion'], 2: ['CrediCor'], 3: ['Thorgate'], 4: ['Mining Guild']};
    await devCommit(request, id, [0, 1, 2, 3, 4], {lineages});
    await devCommit(request, id, [1, 0, 2, 3, 4]);
    await devCommit(request, id, [0, 1, 2, 3, 4]);
    await launchMission(request, id);
    const ids: Array<string> = [];
    for (const name of names) {
      const model = await campaignModelAs(request, id, name);
      const pid = model.missions[3]?.yourPlayerId;
      expect(pid, `no mission seat for ${name}`).toBeTruthy();
      ids.push(pid!);
    }

    await journeyToEndgame(page, request, ids);
    expect(await page.locator('.con-eg__row').count()).toBe(5);

    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--champion').count()) > 0,
    150_000, 'the champion phase (5p)');
    const rectsNow = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('.con-eg__row')).map((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
      }));
    const rowsBefore = await rectsNow();
    await shoot(page, SHOT_DIR, '5p-4k-champion-enter');

    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__champline').count()) > 0,
    30_000, 'the champion plate (5p)');
    await shoot(page, SHOT_DIR, '5p-4k-champion-plate');

    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    60_000, 'the settle (5p)');
    expect(await rectsNow(), 'the dense table re-flowed under the ceremony').toEqual(rowsBefore);
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    expect(await page.locator('.con-eg__champline-pip').count()).toBe(4);
    await shoot(page, SHOT_DIR, '5p-4k-settled');

    // Everything fits at TV scale — the workspace never scrolls.
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('.con-endgame');
      if (el === null) {
        return 'missing';
      }
      return el.scrollHeight > el.clientHeight + 1 ? 'scrolls' : 'fits';
    });
    expect(overflow).toBe('fits');
  });
});
