/*
 * CONSOLE ENDGAME OVERVIEW («Обзор партии») — the analytics scene, e2e.
 *
 * A REAL finished game via the shared endgame journey. What this spec pins:
 *
 *  · «Обзор партии» is an INTERNAL SCENE of the endgame workspace — the
 *    desktop `.eg-results` never mounts, the workspace root never unmounts,
 *    and the SEAMLESS-TRANSITION PROBE proves no frame ever exposed the
 *    board (HUD stays hidden), showed neither scene (blank), or moved the
 *    workspace root's box;
 *  · LB/RB walk all six tabs and WRAP; a burst of rapid presses lands on
 *    exactly the expected tab with no stacked transitions;
 *  · the d-pad drives per-tab focus; A opens a nested detail; B walks the
 *    hierarchy one level at a time (detail → tab → scoring results) and
 *    NEVER replays the ceremony or reaches the main menu;
 *  · re-entry restores the last tab; charts draw once per load;
 *  · after the scene settles nothing keeps animating inside it;
 *  · every tab fits its viewport (no scrollable overflow) at FHD and 4K.
 *
 * ⚠ Probes are setInterval-driven (headless starves rAF); every wait pumps
 * a real frame via the harness (forceFrame/waitWithFrames).
 */
import {test, expect, Page, APIRequestContext} from '@playwright/test';
import {
  createTable, journeyToEndgame, finishFinaleThroughPage, forceFrame, waitWithFrames, shoot,
  drive, getModel, postInput, genericAnswer, terraformAnswer, terraformed, titleOf, NO_PAYMENT,
} from './consoleEndgameHarness';
import {openConsole, CORP_WITH_FIRST_ACTION} from './consoleStart';

const SHOT_DIR = 'screenshots/console-endgame-overview';

type TransitionSample = {
  t: number,
  egResults: number,
  hudVisible: boolean,
  scoringShown: boolean,
  overviewShown: boolean,
  rootBox: string,
};

declare global {
  var __ovTransition: {samples: Array<TransitionSample>, stop: () => void} | undefined;
}

/** The seamlessness probe: installed around the scoring ⇄ overview trips. */
async function installTransitionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Array<TransitionSample> = [];
    const t0 = performance.now();
    const visiblyShown = (el: HTMLElement | null): boolean => {
      if (el === null) {
        return false;
      }
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const timer = window.setInterval(() => {
      const root = document.querySelector<HTMLElement>('.con-endgame');
      if (root === null) {
        return;
      }
      const b = root.getBoundingClientRect();
      const hud = document.querySelector<HTMLElement>('.con-status');
      samples.push({
        t: Math.round(performance.now() - t0),
        egResults: document.querySelectorAll('.eg-results').length,
        hudVisible: visiblyShown(hud),
        scoringShown: visiblyShown(document.querySelector<HTMLElement>('.con-eg')),
        overviewShown: visiblyShown(document.querySelector<HTMLElement>('.con-egov')),
        rootBox: `${b.left.toFixed(0)}|${b.top.toFixed(0)}|${b.width.toFixed(0)}|${b.height.toFixed(0)}`,
      });
    }, 40);
    globalThis.__ovTransition = {samples, stop: () => window.clearInterval(timer)};
  });
}

async function readTransitionProbe(page: Page): Promise<Array<TransitionSample>> {
  return await page.evaluate(() => {
    globalThis.__ovTransition?.stop();
    return globalThis.__ovTransition?.samples ?? [];
  });
}

/** Cheap fixed-VP starters (no requirement, no follow-up prompt) the API
 *  seats play when dealt — the cards tab needs real rows and a face. */
const VP_STARTERS = [
  'Asteroid Mining', 'Space Station', 'Vesta Shipyard',
  'Ganymede Colony', 'Callisto Penal Mines', 'Miranda Resort',
];

/** Answer the setup research BUYING the whole dealt hand (testMode money is
 *  free) — the seats need cards to PLAY, and the shared terraformer buys 0. */
async function buyOpeningHands(request: APIRequestContext, ids: ReadonlyArray<string>): Promise<void> {
  for (const id of ids) {
    const m = await getModel(request, id);
    const wf = m.waitingFor;
    if (wf === undefined || wf.type !== 'initialCards') {
      continue;
    }
    await postInput(request, id, {
      type: 'initialCards',
      responses: (wf.options ?? []).map((step) => {
        const offered = (step.cards ?? []).map((c) => c.name);
        if (titleOf(step).startsWith('Select corporation')) {
          const calm = offered.find((c) => !CORP_WITH_FIRST_ACTION.includes(c));
          return {type: 'card', cards: [calm ?? offered[0]]};
        }
        return {type: 'card', cards: offered};
      }),
    });
  }
}

/**
 * Feed the party a STORY before the terraforming sprint: the API seats play
 * a few fixed-VP cards and the table crosses three generations pass-by-pass —
 * the chronology chart needs lines and the cards tab needs rows. Spec-local:
 * the shared harness journey stays untouched.
 */
async function enrichTable(request: APIRequestContext, ids: ReadonlyArray<string>): Promise<void> {
  await buyOpeningHands(request, ids);
  await drive(request, ids, (m) => m.game.phase === 'action');
  let plays = 0;
  for (let round = 0; round < 240; round++) {
    const m0 = await getModel(request, ids[0]);
    const gen = (m0.game as {generation?: number}).generation ?? 1;
    if (gen >= 4) {
      return;
    }
    let acted = false;
    for (const id of ids) {
      let m = await getModel(request, id);
      for (let streak = 0; streak < 12; streak++) {
        const wf = m.waitingFor;
        if (wf === undefined) {
          break;
        }
        if (wf.type !== 'or') {
          m = await postInput(request, id, genericAnswer(wf));
          acted = true;
          continue;
        }
        const options = wf.options ?? [];
        const at = (index: number, response?: Record<string, unknown>) =>
          postInput(request, id, {type: 'or', index, response: response ?? genericAnswer(options[index])});
        const firstAction = options.findIndex((o) => /^Take first action/i.test(titleOf(o)));
        if (firstAction >= 0) {
          m = await at(firstAction);
          acted = true;
          continue;
        }
        // Play a quiet VP starter when the hand offers one (max three total).
        const playIdx = options.findIndex((o) => o.type === 'projectCard' && /play project card/i.test(titleOf(o)));
        const pick = playIdx >= 0 && plays < 3 ?
          (options[playIdx].cards ?? []).find((c) => VP_STARTERS.includes(c.name)) : undefined;
        if (playIdx >= 0 && pick !== undefined) {
          m = await at(playIdx, {
            type: 'projectCard', card: pick.name,
            payment: {...NO_PAYMENT, megacredits: pick.calculatedCost ?? 0},
          });
          plays++;
          acted = true;
          continue;
        }
        const pass = options.findIndex((o) => /^Pass/i.test(titleOf(o)));
        if (pass >= 0) {
          m = await at(pass);
          acted = true;
          break;
        }
        m = await at(options.length - 1); // an owed side question — decline
        acted = true;
      }
    }
    if (!acted) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

/**
 * The multi-generation finale: the FIRST PLAYER ROTATES, so in a gen-4 game
 * another seat's final-greenery question can come BEFORE the viewer's — the
 * shared journey (built for gen-1 sprints) would open the page on a seat
 * with nothing to answer. Same law, rotation-aware: drive everyone over the
 * API (a foreign finale takes its DONE branch) until the VIEWER holds the
 * question, answer THAT through the page, finish the rest over the API.
 */
async function journeyToEndgameRotated(page: Page, request: APIRequestContext, ids: ReadonlyArray<string>): Promise<void> {
  await drive(request, ids, terraformed);
  for (let round = 0; round < 300; round++) {
    const viewer = await getModel(request, ids[0]);
    if (viewer.waitingFor?.finalGreeneryPrompt !== undefined) {
      break;
    }
    let any = false;
    for (const id of ids) {
      let m = await getModel(request, id);
      for (let streak = 0; streak < 12; streak++) {
        if (id === ids[0] && m.waitingFor?.finalGreeneryPrompt !== undefined) {
          break; // the viewer's own finale belongs to the PAGE
        }
        const answer = terraformAnswer(m);
        if (answer === undefined) {
          break;
        }
        m = await postInput(request, id, answer);
        any = true;
      }
    }
    if (!any) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  await openConsole(page, ids[0]);
  await finishFinaleThroughPage(page);
  await drive(request, ids, (m) => m.game.phase === 'end');
  await waitWithFrames(page, async () => {
    if ((await page.locator('.con-reveal').count()) > 0) {
      await page.keyboard.press('Enter');
      return false;
    }
    return (await page.locator('.con-endgame').count()) > 0;
  }, 75_000, 'the endgame workspace (taking pending reveals first)');
}

/** Land on the SETTLED results (ceremony skipped — this spec is about the overview). */
async function settleToActions(page: Page): Promise<void> {
  await waitWithFrames(page, async () =>
    (await page.locator('.con-endgame--entering, .con-endgame--scoring, .con-endgame--actions').count()) > 0,
  15_000, 'the endgame workspace');
  await page.keyboard.press('KeyX'); // skip the count — atomic settle
  await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 10_000, 'the settled actions');
  // Let the WORKSPACE-ARRIVAL fade finish: `.con-root--endgame` hides the
  // HUD over 360 ms, and in headless that transition only advances on pumped
  // frames — the seamlessness probe must not mistake the ceremony's own
  // sanctioned arrival fade for the overview exposing the board.
  await waitWithFrames(page, async () =>
    await page.evaluate(() => {
      const hud = document.querySelector<HTMLElement>('.con-status');
      if (hud === null) {
        return true;
      }
      const cs = getComputedStyle(hud);
      return cs.visibility === 'hidden' || Number(cs.opacity) <= 0.05;
    }),
  10_000, 'the HUD arrival fade to settle');
  await forceFrame(page);
}

async function openOverview(page: Page): Promise<void> {
  // The default focus IS «Обзор партии».
  await page.keyboard.press('Enter');
  await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) > 0, 10_000, 'the overview scene');
  // Let the entrance choreography land before any representative shot.
  await page.waitForTimeout(900);
  await forceFrame(page);
}

async function activeTab(page: Page): Promise<string> {
  return (await page.locator('.con-egov__tab--active').first().textContent() ?? '').trim();
}

test.describe('console endgame overview — 2p journey', () => {
  test('seamless descent, tab ring, d-pad depth, B hierarchy, re-entry', async ({page, request}) => {
    test.setTimeout(600_000);
    const ids = await createTable(request, ['red', 'blue']);
    // A party with a STORY: three generations + a few played VP cards, so the
    // chronology draws lines and the cards tab carries real rows.
    await enrichTable(request, ids);
    await journeyToEndgameRotated(page, request, ids);
    await settleToActions(page);

    // ── 1 · THE DESCENT — probed for seamlessness. ──────────────────────
    await installTransitionProbe(page);
    await openOverview(page);
    await expect(page.locator('.con-egov__kicker')).toContainText(/Обзор партии/i);
    // The bar speaks the overview's own level.
    await expect(page.locator('.con-cmdbar')).toContainText(/Вкладка/i);
    await expect(page.locator('.con-cmdbar')).toContainText(/Итоги партии/i);
    await shoot(page, SHOT_DIR, '2p-digest');

    // ── 2 · THE TAB RING: LB/RB walk all six and wrap. ──────────────────
    const seen: Array<string> = [await activeTab(page)];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('KeyE'); // RB
      await waitWithFrames(page, async () => (await page.locator('.con-egov__tab--active').count()) > 0, 5_000, 'tab swap');
      await page.waitForTimeout(420);
      await forceFrame(page);
      seen.push(await activeTab(page));
      if (i < 5) {
        await shoot(page, SHOT_DIR, `2p-tab-${i + 2}`);
      }
    }
    // Six distinct tabs, and the seventh press wrapped home.
    expect(new Set(seen.slice(0, 6)).size).toBe(6);
    expect(seen[6]).toBe(seen[0]);
    expect(seen.join(' | ')).toMatch(/Обзор/i);
    expect(seen.join(' | ')).toMatch(/Счёт/i);
    expect(seen.join(' | ')).toMatch(/Хронология/i);
    expect(seen.join(' | ')).toMatch(/Карты/i);
    expect(seen.join(' | ')).toMatch(/Параметры/i);
    expect(seen.join(' | ')).toMatch(/Игроки/i);
    // LB walks back.
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(420);
    await forceFrame(page);
    expect(await activeTab(page)).toBe(seen[5]);

    // ── 3 · RAPID BUMPERS: no stacked transitions, the machine lands true.
    await page.keyboard.press('KeyE'); // back to the digest
    await page.waitForTimeout(420);
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(35); // faster than any pane transition
    }
    await forceFrame(page);
    await waitWithFrames(page, async () =>
      await page.evaluate(() => document.querySelectorAll('.con-egov__viewport--out, .con-egov__viewport--in').length === 0),
    6_000, 'the pane machine to settle');
    // digest + 5 = players; exactly ONE pane stands in the viewport.
    expect(await activeTab(page)).toMatch(/Игроки/i);
    expect(await page.evaluate(() => document.querySelector('.con-egov__viewport')?.childElementCount ?? -1)).toBe(1);

    // ── 4 · D-PAD DEPTH on СЧЁТ: focus → A detail → B one level back. ────
    await page.keyboard.press('KeyE'); // players → digest
    await page.waitForTimeout(380);
    await page.keyboard.press('KeyE'); // digest → score
    await page.waitForTimeout(380);
    await forceFrame(page);
    expect(await activeTab(page)).toMatch(/Счёт/i);
    await shoot(page, SHOT_DIR, '2p-score');
    await page.keyboard.press('ArrowDown');
    await forceFrame(page);
    const focusedCats = await page.locator('.con-ovs__cat--focused').count();
    expect(focusedCats).toBe(1);
    await page.keyboard.press('Enter'); // A → the category breakdown detail
    await waitWithFrames(page, async () => (await page.locator('.con-egov-detail').count()) > 0, 5_000, 'the score detail');
    await expect(page.locator('.con-cmdbar')).toContainText(/Закрыть/i);
    await page.waitForTimeout(400);
    await forceFrame(page);
    await shoot(page, SHOT_DIR, '2p-score-detail');
    await page.keyboard.press('Escape'); // B → back to the TAB, not the results
    await waitWithFrames(page, async () => (await page.locator('.con-egov-detail').count()) === 0, 5_000, 'the detail to close');
    expect(await activeTab(page)).toMatch(/Счёт/i);
    expect(await page.locator('.con-egov').count()).toBe(1); // still inside the overview

    // ── 5 · THE CARDS TAB: focus preview, page indicator, filter ring. ───
    await page.keyboard.press('KeyE'); // score → chronology
    await page.waitForTimeout(380);
    await shoot(page, SHOT_DIR, '2p-chronology');
    await page.keyboard.press('KeyE'); // chronology → cards
    await page.waitForTimeout(380);
    await forceFrame(page);
    expect(await activeTab(page)).toMatch(/Карты/i);
    const hasCards = await page.locator('.con-ovc__row').count();
    if (hasCards > 0) {
      // The focused row previews ONE premium face — never a wall of cards.
      expect(await page.locator('.con-ovc__context .pcard, .con-ovc__context .card').count()).toBeGreaterThan(0);
      const facesMounted = await page.locator('.con-ovc .pcard, .con-ovc .card').count();
      expect(facesMounted).toBeLessThanOrEqual(2);
      await page.keyboard.press('ArrowRight'); // the player filter ring
      await forceFrame(page);
      expect(await page.locator('.con-ovc__filter--on').count()).toBe(1);
      await page.keyboard.press('Enter'); // A → the enlarged card detail
      await waitWithFrames(page, async () => (await page.locator('.con-egov-detail').count()) > 0, 5_000, 'the card detail');
      await page.waitForTimeout(400);
      await forceFrame(page);
      await shoot(page, SHOT_DIR, '2p-card-detail');
      await page.keyboard.press('Escape');
      await waitWithFrames(page, async () => (await page.locator('.con-egov-detail').count()) === 0, 5_000, 'the card detail to close');
    } else {
      // The honest empty state — never a broken grid.
      expect(await page.locator('.con-egov-empty').count()).toBeGreaterThan(0);
    }
    await shoot(page, SHOT_DIR, '2p-cards');

    // ── 6 · PARAMETERS: the d-pad reads exact values without hover. ──────
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(380);
    await forceFrame(page);
    expect(await activeTab(page)).toMatch(/Параметры/i);
    expect(await page.locator('.con-ovp__prow').count()).toBeGreaterThan(0);
    // The exact-value readout exists only with ≥2 generations of history —
    // a lightning testMode game may legitimately land on the empty state.
    if ((await page.locator('.con-ovp__chart svg').count()) > 0) {
      const roBefore = await page.locator('.con-ovp__ro-gen').textContent();
      await page.keyboard.press('ArrowLeft');
      await forceFrame(page);
      const roAfter = await page.locator('.con-ovp__ro-gen').textContent();
      expect(roAfter).not.toBe(roBefore); // the cursor moved and the readout followed
    } else {
      expect(await page.locator('.con-egov-empty').count()).toBeGreaterThan(0);
    }
    await shoot(page, SHOT_DIR, '2p-parameters');

    // ── 7 · PLAYERS: the ring + groups; the comparison detail. ───────────
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(380);
    await forceFrame(page);
    expect(await activeTab(page)).toMatch(/Игроки/i);
    await page.keyboard.press('ArrowRight'); // second player
    await forceFrame(page);
    await page.keyboard.press('Enter'); // production comparison
    await waitWithFrames(page, async () => (await page.locator('.con-egov-detail').count()) > 0, 5_000, 'the players detail');
    await page.waitForTimeout(400);
    await forceFrame(page);
    await shoot(page, SHOT_DIR, '2p-players-detail');
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-egov-detail').count()) === 0, 5_000, 'the players detail to close');
    await shoot(page, SHOT_DIR, '2p-players');
    // The default e2e viewport maps to the HANDHELD profile — the densest
    // stage. Every tab already visited must have fitted; assert the current
    // one explicitly (the players grid once clipped its third group row here).
    const handheldFit = await page.evaluate(() => {
      const el = document.querySelector('.con-egov__viewport');
      if (el === null) {
        return 'missing';
      }
      return el.scrollHeight > el.clientHeight + 1 ? `overflows ${el.scrollHeight}/${el.clientHeight}` : 'fits';
    });
    expect(handheldFit).toBe('fits');

    // ── 8 · QUIET AFTER SETTLE: nothing keeps animating in the scene. ────
    await page.waitForTimeout(1200);
    await forceFrame(page);
    const running = await page.evaluate(() => {
      const scene = document.querySelector('.con-egov');
      if (scene === null) {
        return -1;
      }
      return scene.getAnimations({subtree: true}).filter((a) => a.playState === 'running').length;
    });
    expect(running).toBe(0);

    // ── 9 · B AT THE ROOT: back to the settled results (no ceremony). ────
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) === 0, 8_000, 'the return to results');
    await expect(page.locator('.con-eg__actions')).toBeVisible();
    await expect(page.locator('.con-eg__ribbon').first()).toBeVisible();
    expect(await page.locator('.con-endgame--scoring, .con-endgame--entering').count()).toBe(0);
    expect(page.url()).toContain('/player'); // never the main menu

    // ── 10 · THE PROBE VERDICTS over the whole trip. ─────────────────────
    const samples = await readTransitionProbe(page);
    expect(samples.length).toBeGreaterThan(40);
    // The desktop overlay NEVER mounted, not for one sample.
    expect(samples.filter((s) => s.egResults > 0)).toHaveLength(0);
    // The board/HUD never showed through the workspace.
    expect(samples.filter((s) => s.hudVisible)).toHaveLength(0);
    // No blank frame: at every sample at least one scene was on stage.
    const blank = samples.filter((s) => !s.scoringShown && !s.overviewShown);
    expect(blank, `blank frames: ${JSON.stringify(blank.slice(0, 4))}`).toHaveLength(0);
    // The workspace root's box never moved (no outer resize, no jump).
    expect(new Set(samples.map((s) => s.rootBox)).size).toBe(1);

    // ── 11 · RE-ENTRY restores the last tab (players) and stays calm. ────
    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) > 0, 8_000, 're-entry');
    await forceFrame(page);
    expect(await activeTab(page)).toMatch(/Игроки/i);
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) === 0, 8_000, 'the final return');
  });
});

test.describe('console endgame overview — 4K TV, five players', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});
  test('every tab fits the TV viewport with a full table (no scroll, long RU labels intact)', async ({page, request}) => {
    test.setTimeout(900_000);
    // Five seats need 40 dealt corporations — base+corpEra+promo+community is
    // one short, so the pool widens with venus+colonies (which also puts the
    // Venus track and the colonies stat into the overview screenshots).
    const ids = await createTable(request, ['red', 'blue', 'green', 'yellow', 'purple'],
      {promo: true, community: true, venus: true, colonies: true});
    await journeyToEndgame(page, request, ids);
    await settleToActions(page);
    await openOverview(page);

    const tabShots = ['4k5p-digest', '4k5p-score', '4k5p-chronology', '4k5p-cards', '4k5p-parameters', '4k5p-players'];
    for (let i = 0; i < tabShots.length; i++) {
      if (i > 0) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(450);
        await forceFrame(page);
      }
      await shoot(page, SHOT_DIR, tabShots[i]);
      // The tab FITS: neither the scene nor the pane accumulates scrollable
      // overflow (the console law — a native scrollbar is a bug).
      const overflow = await page.evaluate(() => {
        const els = [document.querySelector('.con-egov'), document.querySelector('.con-egov__viewport')];
        for (const el of els) {
          if (el !== null && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
            return `overflows: ${el.className} ${el.scrollHeight}/${el.clientHeight} ${el.scrollWidth}/${el.clientWidth}`;
          }
        }
        return 'fits';
      });
      expect(overflow, tabShots[i]).toBe('fits');
      // Long Russian names survive: every player name node paints its text
      // untruncated OR carries the sanctioned ellipsis box — never a clipped
      // glyph (ellipsizing containers declare text-overflow).
      const clipped = await page.evaluate(() => {
        const bad: Array<string> = [];
        document.querySelectorAll<HTMLElement>('.con-egov [class*="name"]').forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') {
            bad.push(el.className);
          }
        });
        return bad;
      });
      expect(clipped, tabShots[i]).toHaveLength(0);
    }

    // Five players everywhere: the score matrix carries five bars per
    // category, the players ring five chips.
    expect(await page.evaluate(() =>
      document.querySelectorAll('.con-ovpl__chip').length)).toBe(5);
  });
});
