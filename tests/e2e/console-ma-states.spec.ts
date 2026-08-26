import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootIntoGame, fetchPlayerModel, press, sendPlayerInput, soloGameConfig,
  waitForBoardHome,
} from './consoleStart';
import {isActionMenuTitle} from '../../src/common/inputs/actionMenuTitles';

/**
 * THE MILESTONES/AWARDS WORKSPACE — the browse STATE MATRIX, staged honestly
 * on a human + MarsBot table (true solo disables MA by the rules' own
 * carve-out) and photographed at the TV profile.
 *
 * The matrix this drives (the UX iteration's own Definition of Done):
 *  1. an AVAILABLE milestone out of focus — still unmissable;
 *  2. an available milestone IN focus — focus and availability both read;
 *  3. focus on a BLOCKED item beside an available one — the available one
 *     keeps the game-significance;
 *  4. the fresh board — nothing available yet;
 *  5. a milestone already TAKEN (by the viewer, after the in-workspace
 *     ceremony);
 *  6. award leadership (the race cassette) and the funded/sponsor state;
 *  7. LB/RB category switch (both directions, no flicker);
 *  8. detail stage: available / blocked / committing / ceremony beats.
 *
 * Staging is API-first (the page never races its own seat: actions are sent
 * while the page is parked, then a reload reseeds — the trophy-gallery spec's
 * own idiom), and the claim itself is driven THROUGH the workspace UI.
 */

const OUT = path.resolve('screenshots', 'ma-states');

type Wire = any;

const NO_PAY: Readonly<Record<string, number>> = {
  heat: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
  floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
  auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The bottom command bar's visible labels (uppercase — compare in one case). */
async function barText(page: Page): Promise<string> {
  return (await page.locator('.con-cmdbar').innerText().catch(() => '')).replace(/\s+/g, ' ').toUpperCase();
}

/** Await THIS seat's live action menu (the bot's turns resolve in between). */
async function awaitMyMenu(request: APIRequestContext, pid: string, maxMs = 90_000): Promise<Wire> {
  const started = Date.now();
  let last: Wire;
  while (Date.now() - started < maxMs) {
    const m = await fetchPlayerModel(request, pid);
    last = m.waitingFor;
    if (last !== undefined && isActionMenuTitle(typeof last.title === 'string' ? last.title : undefined)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`action menu never arrived — last: ${JSON.stringify(last?.title ?? last?.type)}`);
}

/** Answer an action's follow-ups (placement / payment / draws) until the
 *  seat is back on its menu or the turn has moved on. */
async function settleFollowUps(request: APIRequestContext, pid: string, maxRounds = 12): Promise<void> {
  for (let i = 0; i < maxRounds; i++) {
    const m = await fetchPlayerModel(request, pid);
    const wf: Wire = m.waitingFor;
    if (wf === undefined || isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined)) {
      return;
    }
    if (wf.type === 'space') {
      await sendPlayerInput(request, pid, {type: 'space', spaceId: wf.spaces[0]});
    } else if (wf.type === 'payment') {
      await sendPlayerInput(request, pid, {type: 'payment', payment: {...NO_PAY, megacredits: wf.amount ?? 0}});
    } else if (wf.type === 'card') {
      const take = (wf.cards ?? []).slice(0, wf.min ?? 0).map((c: Wire) => c.name);
      await sendPlayerInput(request, pid, {type: 'card', cards: take});
    } else if (wf.type === 'option') {
      await sendPlayerInput(request, pid, {type: 'option'});
    } else if (wf.type === 'or') {
      await sendPlayerInput(request, pid, {type: 'or', index: 0, response: {type: 'option'}});
    } else {
      throw new Error(`unexpected follow-up: ${wf.type}`);
    }
  }
}

/** The top-level menu branch whose serialized form carries `needle`. */
function menuIndex(menu: Wire, needle: string): number {
  const idx = (menu.options ?? []).findIndex((o: Wire) => JSON.stringify(o).includes(needle));
  expect(idx, `the action menu must offer ${needle}`).toBeGreaterThanOrEqual(0);
  return idx;
}

/** One standard project ('Greenery' / 'City') with its placement solved. */
async function stdProject(request: APIRequestContext, pid: string, card: string): Promise<void> {
  const menu = await awaitMyMenu(request, pid);
  const i = menuIndex(menu, '"Standard projects"');
  const model: Wire = (menu.options[i].cards ?? []).find((c: Wire) => c.name === card);
  expect(model, `the standard projects menu must list ${card}`).toBeDefined();
  await sendPlayerInput(request, pid, {type: 'or', index: i, response: {
    type: 'projectCard', card, payment: {...NO_PAY, megacredits: model.calculatedCost ?? 0},
  }});
  await settleFollowUps(request, pid);
}

/** Fund the FIRST offered award over the API (the sponsor/funded state). */
async function fundFirstAward(request: APIRequestContext, pid: string): Promise<string> {
  const menu = await awaitMyMenu(request, pid);
  const i = menuIndex(menu, 'Fund an award');
  const inner: Array<Wire> = menu.options[i].options ?? [];
  expect(inner.length, 'at least one award must be fundable').toBeGreaterThan(0);
  const name = String(inner[0].title ?? '').replace(/\s*\(.*$/, '');
  await sendPlayerInput(request, pid, {type: 'or', index: i, response: {type: 'or', index: 0, response: {type: 'option'}}});
  await settleFollowUps(request, pid);
  return name;
}

/** Drain transient chrome (toasts / zoom / bot review) into a quiet window. */
async function waitQuiet(page: Page, quietMs = 1600, maxMs = 16_000): Promise<void> {
  const started = Date.now();
  let quietSince = Date.now();
  while (Date.now() - started < maxMs) {
    const noise = await page.locator('.con-notice, dialog.con-zoom[open], .con-botreview').count();
    if (noise > 0) {
      await press(page, 'Escape', 500);
      quietSince = Date.now();
      continue;
    }
    if (Date.now() - quietSince >= quietMs) {
      return;
    }
    await page.waitForTimeout(250);
  }
}

/** The rendered card list: name + state classes, in grid order. */
async function cardStates(page: Page): Promise<Array<{name: string, go: boolean, taken: boolean, focused: boolean}>> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.con-ma__card')).map((c) => ({
      name: (c.querySelector('.con-ma__name')?.textContent ?? '').trim(),
      go: c.classList.contains('con-ma__card--go'),
      taken: c.classList.contains('con-ma__card--taken'),
      focused: c.classList.contains('con-ma__card--focused'),
    }));
  });
}

/** Walk the 2-column grid focus onto the card at `target` index. */
async function focusCardAt(page: Page, target: number): Promise<void> {
  for (let hop = 0; hop < 12; hop++) {
    const states = await cardStates(page);
    const cur = states.findIndex((s) => s.focused);
    if (cur === target || cur < 0) {
      return;
    }
    const curRow = Math.floor(cur / 2);
    const tgtRow = Math.floor(target / 2);
    if (curRow !== tgtRow) {
      await press(page, curRow < tgtRow ? 'ArrowDown' : 'ArrowUp', 320);
    } else {
      await press(page, cur % 2 < target % 2 ? 'ArrowRight' : 'ArrowLeft', 320);
    }
  }
}

test.describe.configure({mode: 'serial'});

test.describe('console MA workspace · browse state matrix (4K TV)', () => {
  test.use({
    viewport: {width: 3840, height: 2160},
    deviceScaleFactor: 1,
    screen: {width: 3840, height: 2160},
  });

  test('fresh → staged availability → claim → taken; awards race states', async ({page, request}) => {
    test.setTimeout(600_000);

    // ── 1 · a human + MarsBot table (MA legal; testMode affords anything) ──
    const pid = await bootIntoGame(page, request, {
      config: soloGameConfig({
        players: [{name: 'MaStates', color: 'red', beginner: false, handicap: 0, first: true}],
        seed: 0.42,
        automa: {difficulty: 'normal'},
      }),
      buy: 0,
      query: '&consoleProfile=tv',
    });
    await waitQuiet(page);

    // ── 2 · the FRESH matrix: nothing available yet (scenario 4) ───────────
    await press(page, 'KeyQ', 1500);
    await page.waitForSelector('.con-ma', {timeout: 8_000});
    await shoot(page, '10-milestones-fresh');
    await press(page, 'KeyE', 1500); // LB/RB round trip (scenario 8)
    await shoot(page, '11-awards-fresh');
    await press(page, 'KeyQ', 1200);
    await press(page, 'Escape', 1200);

    // ── 3 · stage over the API while the page is parked on the board ───────
    //   3 greeneries → the greenery milestone is met; fund the first award.
    await stdProject(request, pid, 'Greenery');
    await stdProject(request, pid, 'Greenery');
    await stdProject(request, pid, 'Greenery');
    const funded = await fundFirstAward(request, pid);
    await awaitMyMenu(request, pid); // the bot's turn resolves; my menu is live
    await page.reload();
    await waitForBoardHome(page);
    await waitQuiet(page);

    // ── 4 · the AVAILABILITY matrix (scenarios 1–3) ────────────────────────
    await press(page, 'KeyQ', 1500);
    await page.waitForSelector('.con-ma', {timeout: 8_000});
    let states = await cardStates(page);
    const goIdx = states.findIndex((s) => s.go && !s.taken);
    expect(goIdx, 'a claimable milestone must exist after 3 greeneries').toBeGreaterThanOrEqual(0);

    // Focus AWAY from the available card → it must still be unmissable:
    // the activation optics live on the EMBLEM (never the focus ring), so
    // they survive the focus being anywhere else.
    const awayIdx = states.findIndex((s, i) => i !== goIdx && !s.taken);
    await focusCardAt(page, awayIdx);
    const goCard = page.locator('.con-ma__card--go:not(.con-ma__card--focused)');
    expect(await goCard.count(), 'the available tile is not the focused one').toBe(1);
    expect(await goCard.locator('.con-ma__actring').evaluate((el) => Number(getComputedStyle(el).opacity)),
      'the gold-white activation rim burns without focus').toBeGreaterThan(0.9);
    expect((await goCard.locator('.con-ma__avail').innerText()).trim().length,
      'the «ДОСТУПНО» word stands without focus').toBeGreaterThan(0);
    expect(await barText(page), 'a non-actionable focus advertises the reading verb')
      .toContain('ОСМОТРЕТЬ');
    await shoot(page, '20-milestones-avail-unfocused');

    // Focus ON the available card → focus and availability must coexist:
    // the cyan ring joins the mint wash + activation light, replacing nothing.
    await focusCardAt(page, goIdx);
    const goFocused = page.locator('.con-ma__card--go.con-ma__card--focused');
    expect(await goFocused.count(), 'focus and availability share one tile').toBe(1);
    expect(await goFocused.locator('.con-ma__actring').evaluate((el) => Number(getComputedStyle(el).opacity)),
      'focus must not eat the availability light').toBeGreaterThan(0.9);
    expect(await goFocused.evaluate((el) => getComputedStyle(el).boxShadow !== 'none'),
      'the cyan focus ring stands beside the state').toBeTruthy();
    expect(await barText(page), 'an available milestone advertises the intent verb')
      .toContain('ЗАЯВИТЬ');
    await shoot(page, '21-milestones-avail-focused');

    // Mouse parity (the console shell IS the desktop shell): a click focuses
    // a tile, a second click on the focused tile descends — the controller's
    // own two-step, through the same doors.
    await page.locator('.con-ma__card').nth(awayIdx).click();
    await page.waitForTimeout(400);
    expect((await cardStates(page))[awayIdx]?.focused, 'a click focuses the tile').toBe(true);
    await page.locator('.con-ma__card').nth(awayIdx).click();
    await page.waitForTimeout(1200);
    expect(await page.locator('.con-mafocus').count(), 'a click on the focused tile descends').toBe(1);
    await press(page, 'Escape', 1200);
    await focusCardAt(page, goIdx);

    // ── 5 · the AWARDS race states (funded + leadership; scenario 6/7) ─────
    await press(page, 'KeyE', 1500);
    // The sibling identity: the awards root carries its own kind scope, and
    // every award tile speaks the RACE cassette, never the milestone metric.
    expect(await page.locator('.con-ma.con-ma--awards').count(), 'the awards identity scope').toBe(1);
    const awardTiles = await page.locator('.con-ma__card').count();
    expect(await page.locator('.con-ma__card .con-ma__race').count(),
      'every award tile carries the race cassette').toBe(awardTiles);
    expect(await page.locator('.con-ma__card .con-ma__metric').count(),
      'no award tile carries the milestone metric').toBe(0);
    // A live race is CROWNED (lead / tie / behind all render the leader tier).
    const liveRaces = await page.locator('.con-ma__race--lead, .con-ma__race--tie, .con-ma__race--behind').count();
    expect(await page.locator('.con-ma__crown').count(),
      'every live race wears the crown on its leader tier').toBe(liveRaces);
    // The funded award mounts the sponsor's cube in the emblem socket.
    expect(await page.locator('.con-ma__card--taken .con-ma__gem').count(),
      'the funded award wears the sponsor socket').toBe(1);
    // The header tray arms the NEXT slot while funding is genuinely offered.
    expect(await page.locator('.con-ma__slot--next').count(),
      'the tray arms the next slot on a live funding offer').toBe(1);
    await shoot(page, '30-awards-staged');
    const awardStates = await cardStates(page);
    const fundedIdx = awardStates.findIndex((s) => s.taken);
    if (fundedIdx >= 0) {
      await focusCardAt(page, fundedIdx);
      expect(await barText(page), 'a funded award offers the reading verb, never a false intent')
        .toContain('ОСМОТРЕТЬ');
      await shoot(page, '31-awards-funded-focused');
    }
    console.log('[ma-states] funded award:', funded, JSON.stringify(awardStates));
    await press(page, 'KeyQ', 1500);

    // ── 6 · detail stages: blocked, then available → commit → ceremony ─────
    states = await cardStates(page);
    const blockedIdx = states.findIndex((s) => !s.go && !s.taken);
    if (blockedIdx >= 0) {
      await focusCardAt(page, blockedIdx);
      await press(page, 'Enter', 1500);
      await page.waitForSelector('.con-mafocus', {timeout: 6_000});
      await shoot(page, '40-detail-blocked');
      await press(page, 'Escape', 1300);
    }

    const claimIdx = (await cardStates(page)).findIndex((s) => s.go && !s.taken);
    await focusCardAt(page, claimIdx);
    await press(page, 'Enter', 1500);
    await page.waitForSelector('.con-mafocus', {timeout: 6_000});
    await shoot(page, '41-detail-available');

    await page.keyboard.press('Enter'); // the commit (past the 400ms ARM)
    await page.waitForTimeout(250);
    await shoot(page, '42-committing');

    // The ceremony is GSAP-driven: pump BeginFrame while it plays.
    await page.waitForSelector('.con-mafocus__cere', {timeout: 15_000});
    await shoot(page, '43-ceremony');
    for (let i = 0; i < 60 && await page.locator('.con-ma').count() > 0; i++) {
      await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
      await page.waitForTimeout(280);
    }
    expect(await page.locator('.con-ma').count(), 'the workspace closes after its ceremony').toBe(0);

    // ── 7 · the TAKEN-BY-ME state (scenario 5) ─────────────────────────────
    await waitQuiet(page);
    await press(page, 'KeyQ', 1500);
    await page.waitForSelector('.con-ma', {timeout: 8_000});
    const after = await cardStates(page);
    const mineIdx = after.findIndex((s) => s.taken);
    expect(mineIdx, 'the claimed milestone must render as taken').toBeGreaterThanOrEqual(0);
    // The taken tile recomposes to the settled trophy: the owner seal takes
    // the status column, and no availability language survives on it.
    expect(await page.locator('.con-ma__card--taken .con-ma__seal').count(),
      'the taken milestone carries the owner seal').toBe(1);
    expect(await page.locator('.con-ma__card--taken .con-ma__avail').count(),
      'no availability word on a settled trophy').toBe(0);
    await shoot(page, '50-milestones-taken');
    await focusCardAt(page, mineIdx);
    await press(page, 'Enter', 1500);
    if (await page.locator('.con-mafocus').count() > 0) {
      await shoot(page, '51-detail-taken-mine');
      await press(page, 'Escape', 1000);
    }
    await press(page, 'Escape', 800);
  });
});
