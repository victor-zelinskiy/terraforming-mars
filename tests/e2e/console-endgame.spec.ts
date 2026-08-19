/*
 * CONSOLE FINAL SCORING — the post-game workspace, end to end.
 *
 * A REAL finished game (never a fixture) via the shared journey harness
 * (`consoleEndgameHarness`). The spec then watches the console shell:
 *
 *  · the natural end plays the CEREMONY (the page saw the live game);
 *  · THE STABILITY PROBES — the audit's three regressions, asserted
 *    numerically: the scene never dips transparent between phases (the
 *    settled-scene flash), the bar's box never re-solves during the count
 *    (the grid judder), the settled bar carries no micro-reveal shades
 *    (the barcode);
 *  · B = «Свернуть» PAUSES the ceremony and opens the final board; B
 *    returns and RESUMES from the same beat (never a restart, never main
 *    menu) — and the WHOLE HUD follows the SCREEN, not the stack: the
 *    strategy rail is replaced while the scene is up and lit again the
 *    moment the player is looking at the board, in both directions and at
 *    both the mid-count and the settled collapse;
 *  · the winner is the ROW ITSELF (ribbon + gold), no duplicate plate;
 *  · the default action focus is «Обзор партии» (never the replay);
 *  · a RELOAD into the ended game lands SETTLED — no uninvited replay;
 *  · «Обзор партии» descends into the CONSOLE-NATIVE overview scene of the
 *    SAME workspace (the desktop `.eg-results` never rises) and B returns
 *    without replaying the ceremony — the deep overview journey lives in
 *    console-endgame-overview.spec.ts;
 *  · «Повторить подсчёт» replays, X skips atomically.
 *
 * ⚠ Headless Chromium starves rAF on a quiet screen — every wait pumps a
 * tiny screenshot (a real BeginFrame), or the GSAP ceremony never advances.
 * Probes are setInterval-driven (never rAF) for the same reason.
 */
import {test, expect, Page} from '@playwright/test';
import {createTable, journeyToEndgame, forceFrame, waitWithFrames, shoot, getModel} from './consoleEndgameHarness';

const SHOT_DIR = 'screenshots/console-endgame';

type StabilitySample = {
  t: number,
  phase: string,
  opacity: string,
  display: string,
  transitioning: boolean,
  barBox: string,
  rowBox: string,
};

declare global {
  var __egStability: {samples: Array<StabilitySample>, stop: () => void} | undefined;
}

/** The audit probe, installed for the whole ceremony: opacity + boxes. */
async function installStabilityProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Array<StabilitySample> = [];
    const t0 = performance.now();
    const timer = window.setInterval(() => {
      const scene = document.querySelector<HTMLElement>('.con-endgame');
      if (scene === null) {
        return;
      }
      const cs = getComputedStyle(scene);
      // A live opacity CSSTransition = the deliberate con-layer fade (the
      // collapse/overview round trips) — the ONLY sanctioned transparency.
      // ⚠ It must be read from the ANIMATION OBJECT, not the classes: in
      // headless the animation timeline freezes between pumped frames, so
      // Vue's wall-clock fallback strips the classes while the transition
      // object still holds the element at its from-state. A keyframe RESTART
      // (the real flash bug) is a CSSAnimation and stays flagged.
      const fading = scene.getAnimations().some((a) =>
        (a as CSSTransition).transitionProperty === 'opacity');
      const bar = document.querySelector('.con-eg__bar');
      const row = document.querySelector('.con-eg__row');
      const box = (el: Element | null) => {
        if (el === null) {
          return '-';
        }
        const b = el.getBoundingClientRect();
        // WIDTH and LEFT must be immovable; top legitimately moves at the
        // FLIP (transform), height is density-fixed — record all four, the
        // assertions pick their axes.
        return `${b.left.toFixed(1)}|${b.width.toFixed(1)}|${b.height.toFixed(1)}`;
      };
      samples.push({
        t: Math.round(performance.now() - t0),
        phase: [...scene.classList].filter((c) => c.startsWith('con-endgame--')).join(','),
        opacity: cs.opacity,
        display: cs.display,
        transitioning: fading ||
          scene.classList.contains('con-layer-enter-active') ||
          scene.classList.contains('con-layer-leave-active'),
        barBox: box(bar),
        rowBox: box(row),
      });
    }, 45);
    globalThis.__egStability = {samples, stop: () => window.clearInterval(timer)};
  });
}

async function readStabilityProbe(page: Page): Promise<Array<StabilitySample>> {
  return await page.evaluate(() => {
    globalThis.__egStability?.stop();
    return globalThis.__egStability?.samples ?? [];
  });
}

test.describe('console endgame workspace — 2p, full journey', () => {
  test('ceremony plays stable; B parks and resumes; winner is the row; reload settles; overview round-trips', async ({page, request}) => {
    test.setTimeout(600_000);
    const ids = await createTable(request, ['red', 'blue']);

    // 1 · A real finished game, the viewer's finale answered through the page.
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[page-err]', msg.text().slice(0, 300));
      }
    });
    await journeyToEndgame(page, request, ids);
    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--entering, .con-endgame--scoring').count()) > 0,
    15_000, 'the ceremony to start');

    // The gameplay HUD has left; the command bar stays with the two verbs —
    // and NO duplicated «ФИНАЛЬНЫЙ ПОДСЧЁТ» context (the scene names itself).
    await expect(page.locator('.con-status')).toBeHidden();
    // …and the STRATEGY rail with it: the scene is the stage, so its zone is
    // taken (`.con-root--rail-replaced` → visibility, the box survives).
    await expect(page.locator('.con-strat')).toBeHidden();
    expect(await page.locator('.con-handdock:visible').count()).toBe(0);
    await expect(page.locator('.con-cmdbar')).toContainText(/Пропустить подсчёт/i);
    await expect(page.locator('.con-cmdbar')).toContainText(/Свернуть/i);
    await expect(page.locator('.con-cmdbar .con-cmdbar__context')).not.toContainText(/Финальный подсчёт/i);
    // All rows on screen at once, in seating order, bars growing; the result
    // is still untold (no places, no ribbon, no actions).
    expect(await page.locator('.con-eg__row').count()).toBe(2);
    expect(await page.locator('.con-eg__place-num').count()).toBe(0);
    expect(await page.locator('.con-eg__ribbon').count()).toBe(0);
    expect(await page.locator('.con-eg__actions').count()).toBe(0);
    await installStabilityProbe(page);
    await shoot(page, SHOT_DIR, '2p-ceremony-scoring');

    // 2 · B = «Свернуть» mid-count: the scene parks, the ceremony PAUSES,
    //     the final board + HUD come back, the bar names the road home.
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-endgame:visible').count()) === 0, 8_000, 'the collapse');
    await expect(page.locator('.con-status')).toBeVisible();
    // THE WHOLE HUD comes back — the trophy rail included. It is the one
    // member whose policy read the STACK rather than the screen, so a frame
    // that legitimately stays in the stack while its scene hides (v-show, the
    // ceremony must resume from the same beat) kept the gallery dark for the
    // entire post-game board inspection.
    await expect(page.locator('.con-strat')).toBeVisible();
    await expect(page.locator('.con-cmdbar')).toContainText(/Итоги партии/i);
    const phaseWhileParked = await page.locator('.con-endgame').getAttribute('class');
    await page.waitForTimeout(1600);
    await forceFrame(page);
    // Paused, not running in the background: the phase class has not moved on.
    expect(await page.locator('.con-endgame').getAttribute('class')).toBe(phaseWhileParked);
    expect(phaseWhileParked).not.toContain('con-endgame--actions');
    await shoot(page, SHOT_DIR, '2p-collapsed-board');

    // 3 · B again: back to the ceremony, resumed from the same beat — it
    //     then runs NATURALLY to the settled state (no skip on this pass).
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-endgame:visible').count()) > 0, 8_000, 'the return');
    await expect(page.locator('.con-strat')).toBeHidden(); // …and the rail yields again
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 120_000, 'the natural finish');
    await shoot(page, SHOT_DIR, '2p-settled');

    // 4 · THE STABILITY VERDICTS (the audit's three regressions).
    const samples = await readStabilityProbe(page);
    expect(samples.length).toBeGreaterThan(60);
    const visible = samples.filter((s) => s.display !== 'none' && !s.transitioning);
    // The settled-scene flash: NO transparent frame outside the layer
    // transitions — the finalize moment included.
    const dips = visible.filter((s) => Number(s.opacity) < 0.99);
    expect(dips, `opacity dips: ${JSON.stringify(dips.slice(0, 4))}`).toHaveLength(0);
    // The grid judder: the bar's LEFT|WIDTH|HEIGHT never re-solves — one
    // distinct box across the whole ceremony (the audit measured 36).
    const barBoxes = new Set(visible.filter((s) => s.barBox !== '-').map((s) => s.barBox));
    expect([...barBoxes], `bar boxes: ${[...barBoxes].join(' ')}`).toHaveLength(1);
    const rowBoxes = new Set(visible.filter((s) => s.rowBox !== '-').map((s) => s.rowBox));
    expect([...rowBoxes], `row boxes: ${[...rowBoxes].join(' ')}`).toHaveLength(1);
    // The barcode: the settled bar is ONE hue per category — no micro shades.
    expect(await page.locator('.con-eg__subseg--s1, .con-eg__subseg--s2').count()).toBe(0);
    expect(await page.locator('.con-eg__chip').count()).toBe(0);

    // 5 · The winner is the ROW: ribbon + places; NO duplicate plate exists.
    expect(await page.locator('.con-eg__ribbon').count()).toBeGreaterThan(0);
    expect(await page.locator('.con-eg__row--winner').count()).toBeGreaterThan(0);
    expect(await page.locator('.con-eg__place-num').count()).toBe(2);
    expect(await page.locator('.con-eg__wplate').count()).toBe(0);
    // Anchored values exist in both homes (wide → inside, narrow → below).
    expect(await page.locator('.con-eg__vlab--on').count()).toBeGreaterThan(0);

    // The displayed totals are the SERVER's own breakdown totals.
    const finalModel = await getModel(request, ids[0]);
    const serverTotals = finalModel.players
      .map((p) => p.victoryPointsBreakdown?.total ?? -1)
      .sort((a, b) => b - a);
    const shown = (await page.locator('.con-eg__total-num').allTextContents())
      .map((t) => Number(t.trim()))
      .sort((a, b) => b - a);
    expect(shown).toEqual(serverTotals);

    // 6 · The DEFAULT focus is the natural next step — «Обзор партии»,
    //     never the replay; the list drives from the pad.
    const focused = () => page.locator('.con-eg__action--focused .con-eg__action-label').first().textContent();
    expect(await focused()).toMatch(/Обзор партии/i);
    await page.keyboard.press('ArrowRight');
    await forceFrame(page);
    expect(await focused()).not.toMatch(/Обзор партии/i);
    await page.keyboard.press('ArrowLeft');
    await forceFrame(page);
    expect(await focused()).toMatch(/Обзор партии/i);

    // 7 · A descends into the CONSOLE-NATIVE overview — an internal scene of
    //     the SAME workspace. The desktop overlay must never rise, the
    //     workspace root never unmounts, and B returns to the settled
    //     results without replaying the ceremony.
    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) > 0, 15_000, 'the console overview');
    expect(await page.locator('.eg-results').count()).toBe(0); // desktop stays desktop-only
    await expect(page.locator('.con-endgame')).toBeVisible(); // the same root carries both scenes
    await expect(page.locator('.con-egov__kicker')).toContainText(/Обзор партии/i);
    await expect(page.locator('.con-status')).toBeHidden(); // the board never shows through
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) === 0, 10_000, 'the overview to close');
    await expect(page.locator('.con-endgame')).toBeVisible();
    await expect(page.locator('.con-eg__ribbon').first()).toBeVisible(); // state survived
    // …and coming back is a RETURN, never a second ceremony.
    expect(await page.locator('.con-endgame--scoring, .con-endgame--entering').count()).toBe(0);

    // 8 · B at the settled root: «Свернуть», never the main menu — and the
    //     road back restores the same settled state.
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-endgame:visible').count()) === 0, 8_000, 'the settled collapse');
    await expect(page.locator('.con-status')).toBeVisible();
    await expect(page.locator('.con-strat')).toBeVisible(); // the SETTLED collapse too
    expect(page.url()).toContain('/player'); // never navigated away
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-endgame:visible').count()) > 0, 8_000, 'the settled return');
    await expect(page.locator('.con-strat')).toBeHidden();
    await expect(page.locator('.con-eg__actions')).toBeVisible();
    await expect(page.locator('.con-eg__ribbon').first()).toBeVisible();

    // 9 · RELOAD into the ended game: the settled state, instantly — the
    //     ceremony must NOT replay uninvited.
    await journeyReload(page, ids[0]);
    expect(await page.locator('.con-endgame--scoring, .con-endgame--entering').count()).toBe(0);
    await expect(page.locator('.con-eg__actions')).toBeVisible();
    expect(await page.locator('.con-eg__ribbon').count()).toBeGreaterThan(0);

    // 10 · «Повторить подсчёт» replays on demand; X skips it ATOMICALLY.
    const labels = await page.locator('.con-eg__action-label').allTextContents();
    expect(labels.join(' | ')).toMatch(/Повторить подсчёт/i);
    expect(labels.join(' | ')).toMatch(/Обзор партии/i);
    expect(labels.join(' | ')).toMatch(/В главное меню/i);
    const replayIdx = labels.findIndex((l) => /Повторить подсчёт/i.test(l));
    for (let i = 0; i < replayIdx; i++) {
      await page.keyboard.press('ArrowRight');
      await forceFrame(page);
    }
    expect(await focused()).toMatch(/Повторить подсчёт/i);
    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--entering, .con-endgame--scoring').count()) > 0,
    10_000, 'the replay to start');
    await page.keyboard.press('KeyX');
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 8_000, 'the atomic skip');
    await page.keyboard.press('KeyX'); // a second skip must be a no-op
    await forceFrame(page);
    const shownAfterSkip = (await page.locator('.con-eg__total-num').allTextContents())
      .map((t) => Number(t.trim()))
      .sort((a, b) => b - a);
    expect(shownAfterSkip).toEqual(serverTotals);
    expect(await page.locator('.con-eg__subseg--s1, .con-eg__subseg--s2').count()).toBe(0);
    await shoot(page, SHOT_DIR, '2p-after-skip');
  });
});

/** Reload the viewer straight into the ended game. */
async function journeyReload(page: Page, id: string): Promise<void> {
  await page.goto(`/player?id=${id}&console=1`);
  await page.waitForSelector('.con-root', {timeout: 90_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});
  await waitWithFrames(page, async () => (await page.locator('.con-endgame').count()) > 0, 30_000, 'the workspace after reload');
  await forceFrame(page);
}

test.describe('console endgame workspace — 4K TV, four players', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});
  test('the ceremony reads at couch distance: all rows, micro-reveals, merge, ranking, winner', async ({page, request}) => {
    test.setTimeout(600_000);
    const ids = await createTable(request, ['red', 'blue', 'green', 'yellow'], {promo: true, community: true});
    await journeyToEndgame(page, request, ids);
    expect(await page.locator('.con-eg__row').count()).toBe(4);
    await shoot(page, SHOT_DIR, '4k-ceremony-enter');

    // Watch the count: the TR micro-reveal marks sub-steps in the caption and
    // grows sub-segments for EVERY row at once, SHADED while unmerged.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__subseg--on').count()) >= 4,
    30_000, 'the first synchronized reveal');
    await shoot(page, SHOT_DIR, '4k-ceremony-tr');

    // Let a few categories land, then the mid-count comparison shot.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__vlab--on').count()) >= 8,
    60_000, 'a few settled categories');
    await shoot(page, SHOT_DIR, '4k-ceremony-mid');

    // The ceremony settles on its own (no skip): ranking → winner → actions.
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 120_000, 'the natural finish');
    await shoot(page, SHOT_DIR, '4k-final');

    // Everything fits: the workspace never scrolls at TV scale.
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('.con-endgame');
      if (el === null) {
        return 'missing';
      }
      return el.scrollHeight > el.clientHeight + 1 ? 'scrolls' : 'fits';
    });
    expect(overflow).toBe('fits');

    // Four rows, four totals, ranked places 1..4, the winner ribbon on the
    // row — and the settled bar is category-clean (merged, no shades).
    expect(await page.locator('.con-eg__place-num').count()).toBe(4);
    expect(await page.locator('.con-eg__row--winner').count()).toBeGreaterThan(0);
    expect(await page.locator('.con-eg__subseg--s1, .con-eg__subseg--s2').count()).toBe(0);
    expect(await page.locator('.con-eg__vlab--on').count()).toBeGreaterThan(0);
  });
});
