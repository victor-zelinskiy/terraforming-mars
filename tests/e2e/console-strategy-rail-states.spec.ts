import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, CORP_WITH_FIRST_ACTION, fetchPlayerModel, openConsole, press,
  seedGameOverApi, sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';
import {isActionMenuTitle} from '../../src/common/inputs/actionMenuTitles';

/**
 * The right STRATEGY RAIL — the trophy-gallery STATE MATRIX, staged honestly.
 *
 * A 3-seat human game driven over the ordinary `player/input` API (the same
 * endpoint the client posts — no state shortcut can drift from the rules):
 * standard-project cities/greeneries build real scores, an award is funded,
 * a milestone reaches its threshold, and the viewer claims it through the
 * real MA workspace so the rail's SEAL beat plays as the ceremony's
 * continuation. THREE seats on purpose: a duel has no ranked second place
 * (only 1st scores in a 2-player game), so the silver second line is only
 * honest — and only testable — with a third seat in the race.
 *
 * States pinned here (P31.2 — screenshots + structural asserts):
 *  1. STATE B — met but NOT actionable (a rival's turn): green ✓ + full
 *     meter + mint rim, NO «ДОСТУПНО», NO gold, and NO activation ceremony
 *     on a plain page load; the funded award (sponsor cube in the socket,
 *     no colour disc) with the crown / silver-second podium;
 *  2. the LIVE B→C flip — the rival passes while the page watches the
 *     board, the turn arrives, and the ACTIVATION phrase plays exactly
 *     once (frame sequence captured);
 *  3. STATE C — green facts + the gold-white rim + «ДОСТУПНО» replacing
 *     the meter in the fixed foot line;
 *  4. the claim seal riding the workspace's fold: the calm horizontal
 *     owner line (cube · ВЗЯТО · ✓) and a CLEAN emblem (no floating cube);
 *  5. a tie for FIRST: ONE crown, two cubes, ONE value, no silver second.
 *
 * And the FINISHED BODY (§ the case/spine geometry): the display case and
 * its spine terminate INSIDE the viewport — the glass never reads as
 * cropped by the screen edge.
 */

const OUT = path.resolve('screenshots', 'strategy-rail');

/** Loose wire shape — JSON off the HTTP response (the seeder's own idiom). */
type Wire = any;

const NO_PAY: Readonly<Record<string, number>> = {...NO_PAYMENT};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Answer another seat's `initialCards` (calm corp, no projects) — the
 *  minimal simultaneous-pregame answer for the rival seats. */
async function answerInitialCards(request: APIRequestContext, pid: string): Promise<void> {
  const model = await fetchPlayerModel(request, pid);
  const wf: Wire = model.waitingFor;
  expect(wf?.type, 'the rival seat must be on initialCards').toBe('initialCards');
  const responses = (wf.options ?? []).map((step: Wire) => {
    const offered: Array<string> = (step.cards ?? []).map((c: Wire) => c.name);
    if ((step.min ?? 0) >= 1) {
      // The corporation step — a CALM corp keeps the seat's turns pass-able.
      const calm = offered.find((c) => !CORP_WITH_FIRST_ACTION.includes(c));
      return {type: 'card', cards: [calm ?? offered[0]]};
    }
    return {type: 'card', cards: []};
  });
  await sendPlayerInput(request, pid, {type: 'initialCards', responses});
}

/**
 * Answer a rival seat's «Play your corporation» step. Without testMode the
 * fork adds this prompt to EVERY seat once all `initialCards` are answered
 * (testMode plays the corp implicitly) — the research phase cannot end while
 * any seat still holds it.
 */
async function answerCorpPlay(request: APIRequestContext, pid: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const m = await fetchPlayerModel(request, pid);
    const wf: Wire = m.waitingFor;
    if (wf?.type === 'card' && (wf.cards ?? []).length > 0) {
      await sendPlayerInput(request, pid, {type: 'card', cards: [wf.cards[0].name]});
      return;
    }
    if (wf !== undefined) {
      return; // something else already stands — the table drive owns it
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`the corporation-play step never arrived for ${pid}`);
}

/**
 * Create the 3-seat game, re-rolling the seed until EVERY seat's corp deal
 * offers a calm corporation. ⚠️ `testMode` is deliberately OFF: the server
 * FORCES `startingCorporations = 8` under it (Game.ts), and three seats then
 * want 24 corps out of the base+corpEra pool of ~12 — the third seat gets an
 * empty deal and no prompt at all. Without it the economy is honest (the
 * staging spends real TR income across four generations), and a 2-corp deal
 * can be first-action-hostile — hence the seed scan.
 */
async function createStagedGame(request: APIRequestContext): Promise<{p1: string, p2: string, p3: string}> {
  for (let attempt = 0; attempt < 14; attempt++) {
    const config = soloGameConfig({
      players: [
        {name: 'StratRed', color: 'red', beginner: false, handicap: 0, first: true},
        {name: 'StratBlue', color: 'blue', beginner: false, handicap: 0, first: false},
        {name: 'StratGreen', color: 'green', beginner: false, handicap: 0, first: false},
      ],
      seed: 0.31 + attempt * 0.013,
      testMode: false,
    });
    const created = await request.post('/api/creategame', {data: config});
    expect(created.ok(), 'the game server accepted the 3-seat config').toBeTruthy();
    const seats = (await created.json()).players as Array<{id: string, color: string}>;
    let everyoneCalm = true;
    for (const seat of seats) {
      const model = await fetchPlayerModel(request, seat.id);
      const corpStep: Wire = (model.waitingFor as Wire)?.options?.find((o: Wire) => (o.min ?? 0) >= 1);
      const offered: Array<string> = (corpStep?.cards ?? []).map((c: Wire) => c.name);
      if (!offered.some((c) => !CORP_WITH_FIRST_ACTION.includes(c))) {
        everyoneCalm = false;
        break;
      }
    }
    if (everyoneCalm) {
      return {
        p1: seats.find((s) => s.color === 'red')!.id,
        p2: seats.find((s) => s.color === 'blue')!.id,
        p3: seats.find((s) => s.color === 'green')!.id,
      };
    }
  }
  throw new Error('no seed offered a calm corporation to every seat');
}

/** One tick of the table driver: whatever seat is being asked something,
 *  answer it. Research buys are declined; a live MENU is handed to `onMenu`
 *  (return true to stop the whole drive). */
async function driveTable(
  request: APIRequestContext,
  seats: ReadonlyArray<string>,
  onMenu: (pid: string, money: number, actionsTaken: number, generation: number) => Promise<boolean>,
  maxRounds = 240,
): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    let acted = false;
    for (const pid of seats) {
      const m = await fetchPlayerModel(request, pid);
      const wf: Wire = m.waitingFor;
      if (wf === undefined) {
        continue;
      }
      const menu = isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined);
      if (!menu) {
        if (wf.type === 'card') {
          // The research round — decline the buy (min 0 keeps it free).
          await sendPlayerInput(request, pid, {type: 'card', cards: (wf.cards ?? []).slice(0, wf.min ?? 0).map((c: Wire) => c.name)});
        } else {
          await settleFollowUps(request, pid);
        }
        acted = true;
        continue;
      }
      if (await onMenu(pid, (m as Wire).thisPlayer?.megacredits ?? 0,
        (m as Wire).thisPlayer?.actionsTakenThisRound ?? 0,
        (m as Wire).game?.generation ?? 1)) {
        return;
      }
      acted = true;
    }
    if (!acted) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error('the table drive never reached its goal');
}

/**
 * Answer everything that is NOT an action menu, on every seat, until the
 * table is quiet. A generation turnover hands each seat a research buy,
 * and any driver that walks straight up to `awaitMyMenu` stalls on it
 * («action menu never arrived — last: "Select card(s) to buy"»).
 */
async function drainNonMenu(request: APIRequestContext, seats: ReadonlyArray<string>, maxRounds = 30): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    let acted = false;
    for (const pid of seats) {
      const m = await fetchPlayerModel(request, pid);
      const wf: Wire = m.waitingFor;
      if (wf === undefined || isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined)) {
        continue;
      }
      await settleFollowUps(request, pid);
      acted = true;
    }
    if (!acted) {
      return;
    }
  }
}

/**
 * Bring the turn round to `pid` WITH at least `money`: drain research,
 * pass every other seat that holds a menu, and let the generations turn
 * until the seat is both on the clock and able to pay. Waiting passively
 * cannot work — a table where everyone has passed only moves when its
 * prompts are answered.
 */
async function driveTurnTo(
  request: APIRequestContext,
  seats: ReadonlyArray<string>,
  pid: string,
  money = 0,
  maxRounds = 80,
): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    await drainNonMenu(request, seats);
    const mine = await fetchPlayerModel(request, pid);
    const wf: Wire = mine.waitingFor;
    if (wf !== undefined && isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined) &&
        ((mine as Wire).thisPlayer?.megacredits ?? 0) >= money) {
      return;
    }
    for (const other of seats) {
      if (other === pid) {
        continue;
      }
      const m = await fetchPlayerModel(request, other);
      const owf: Wire = m.waitingFor;
      if (owf !== undefined && isActionMenuTitle(typeof owf.title === 'string' ? owf.title : undefined)) {
        await passGeneration(request, other);
      }
    }
    // The seat itself may hold the clock but still be too poor — pass and
    // let the next generation's income arrive.
    if (wf !== undefined && isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined)) {
      await passGeneration(request, pid);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`the turn never came round to ${pid} with ${money} M€`);
}

/** Wait until THIS seat's action menu is live and return it. */
async function awaitMyMenu(request: APIRequestContext, pid: string, maxMs = 60_000): Promise<Wire> {
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
  throw new Error(`action menu never arrived for ${pid} — last: ${JSON.stringify(last?.title ?? last?.type)}`);
}

/** The top-level menu branch whose serialized form carries `needle`. */
function menuIndex(menu: Wire, needle: string): number {
  const idx = (menu.options ?? []).findIndex((o: Wire) => JSON.stringify(o).includes(needle));
  expect(idx, `the action menu must offer ${needle}`).toBeGreaterThanOrEqual(0);
  return idx;
}

/** Answer an action's follow-ups (placement / payment / draws) until the
 *  seat is back on its menu or the turn has passed on. */
async function settleFollowUps(request: APIRequestContext, pid: string, maxRounds = 10): Promise<void> {
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
      throw new Error(`unexpected follow-up for ${pid}: ${wf.type}`);
    }
  }
}

/** One standard project off the menu ('City' / 'Greenery'), placement solved.
 *  The branch is a `SelectStandardProjectToPlay` (a SelectCardToPlay), so the
 *  answer carries the card AND its M€ payment in one response. */
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

/** A nested or-branch (fund an award / claim a milestone) by needles. */
async function nestedOption(request: APIRequestContext, pid: string, outer: string, inner: string): Promise<void> {
  const menu = await awaitMyMenu(request, pid);
  const i = menuIndex(menu, outer);
  const j = ((menu.options[i].options ?? []) as Array<Wire>)
    .findIndex((o: Wire) => JSON.stringify(o).includes(inner));
  expect(j, `${outer} must offer ${inner}`).toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, pid, {type: 'or', index: i, response: {type: 'or', index: j, response: {type: 'option'}}});
  await settleFollowUps(request, pid);
}

async function passGeneration(request: APIRequestContext, pid: string): Promise<void> {
  const menu = await awaitMyMenu(request, pid);
  const i = menuIndex(menu, 'Pass for this generation');
  await sendPlayerInput(request, pid, {type: 'or', index: i, response: {type: 'option'}});
}

/**
 * Clear TRANSIENT chrome before a screenshot / a keyed flow: a toast card
 * (B closes it — and a stray driver press on its A-CTA can even open the
 * fullscreen viewer over the board). Escape is the console B: it consumes a
 * visible toast first and closes a zoom; on a clean board home it is a
 * no-op. Bounded and structural — never a fixed blind script.
 */
async function clearTransientChrome(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const zoom = await page.locator('dialog.con-zoom[open]').count();
    const toast = await page.locator('.con-notice').count();
    if (zoom === 0 && toast === 0) {
      return;
    }
    await press(page, 'Escape', 700);
  }
}

/**
 * A REFERENCE frame needs a QUIET window, not just an instant with no toast:
 * the shell's own late arrivals (the foreground watchdog's one self-heal
 * card, a queued notification) race any single cleanup pass. Consume noise
 * as it appears and return only after `quietMs` of silence.
 */
async function waitToastQuiet(page: Page, quietMs = 1600, maxMs = 14_000): Promise<void> {
  const started = Date.now();
  let quietSince = Date.now();
  while (Date.now() - started < maxMs) {
    const noise = await page.locator('.con-notice, dialog.con-zoom[open]').count();
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

test.describe.configure({mode: 'serial'});

test.describe('console strategy rail · state matrix (4K TV)', () => {
  test.use({
    viewport: {width: 3840, height: 2160},
    deviceScaleFactor: 1,
    screen: {width: 3840, height: 2160},
  });

  test('B (met, waiting) → LIVE activation → C (claim now) → workspace claim seal → tie', async ({page, request}) => {
    test.setTimeout(600_000);

    const t0 = Date.now();
    const mark = (label: string) => console.log(`[states +${Math.round((Date.now() - t0) / 1000)}s] ${label}`);

    // ── 1 · a 3-seat human game (honest economy — no testMode) ────────────
    const {p1, p2, p3} = await createStagedGame(request);
    mark('game created');

    // ── 2 · pregames: every seat answers its deal; the corp-play step
    //   appears for ALL seats only once every deal is answered, so the
    //   rivals clear theirs first and the seeder then walks red through its
    //   own corp play to the live action menu.
    await answerInitialCards(request, p2);
    await answerInitialCards(request, p3);
    await answerInitialCards(request, p1);
    await answerCorpPlay(request, p2);
    await answerCorpPlay(request, p3);
    await seedGameOverApi(request, p1, {buy: 0});
    mark('pregame answered');

    // ── 3 · stage the matrix over the API (page not open — nothing races),
    //   paced by REAL income across generations (a calm corp starts at
    //   23–60 M€, so the driver builds when it can afford to and passes
    //   otherwise): red → 2 cities early, then — in ONE turn — the third
    //   city (Mayor 3/3) plus the Landlord funding; blue → city + greenery
    //   (podium second = 2); green idles.
    //   THE STOP IS BLUE'S MENU: the pair is only played in a generation
    //   whose turn order puts blue AFTER red (gen%3 ≠ 2 — blue-first gens
    //   defer it), so the funding hands the turn to a LIVE blue seat while
    //   red is met-but-not-offered (STATE B) and still unpassed. The page
    //   then watches blue pass — and red's arriving turn is the LIVE
    //   activation flip.
    const built = {redCities: 0, blueCity: 0, blueGreen: 0, funded: false};
    await driveTable(request, [p1, p2, p3], async (pid, money, actionsTaken, generation) => {
      if (pid === p1) {
        const blueDone = built.blueCity === 1 && built.blueGreen === 1;
        const blueActsBeforeRed = generation % 3 === 2; // blue-first generation
        // ≥41: the pair costs 25+8 and the CLAIM (8) must still be payable
        // on red's NEXT turn — same generation, no income in between.
        if (!built.funded && built.redCities === 2 && blueDone && money >= 41 &&
            actionsTaken === 0 && !blueActsBeforeRed) {
          await stdProject(request, p1, 'City'); // city #3 — Mayor met (action 1)
          built.redCities++;
          await nestedOption(request, p1, 'Fund an award', '"Landlord"'); // action 2 — the turn leaves red
          built.funded = true;
          return false; // the stop lands on BLUE's menu below
        }
        if (built.redCities < 2 && money >= 25) {
          await stdProject(request, p1, 'City');
          built.redCities++;
          return false;
        }
        await passGeneration(request, p1);
        return false;
      }
      if (pid === p2) {
        if (built.funded) {
          return true; // STOP: blue holds a live menu; red waits in STATE B
        }
        if (built.blueCity < 1 && money >= 25) {
          await stdProject(request, p2, 'City');
          built.blueCity++;
        } else if (built.blueGreen < 1 && money >= 23) {
          await stdProject(request, p2, 'Greenery');
          built.blueGreen++;
        } else {
          await passGeneration(request, p2);
        }
        return false;
      }
      await passGeneration(request, p3);
      return false;
    });
    mark('matrix staged (blue holds the turn; red is met-but-not-offered)');

    // ── 4 · open the console on the RED seat: the standing matrix ─────────
    await openConsole(page, p1, '&consoleProfile=tv');
    mark('console painted');
    // Fail FAST and by name if the shell lost its server (the connection
    // alert otherwise turns every later wait into a silent 600s burn).
    expect(await page.locator('.con-alert').count(),
      'the shell must be connected (no СБОЙ СИСТЕМЫ alert)').toBe(0);
    await waitForBoardHome(page, 25);
    await clearTransientChrome(page);
    mark('board home live');

    // THE FINISHED BODY: the case and its spine terminate INSIDE the
    // viewport (right border + terminators on screen — never a crop), and
    // the two rails stay footprint twins.
    const vw = page.viewportSize()!.width;
    const caseBox = await page.locator('.con-strat__case').boundingBox();
    const spineBox = await page.locator('.con-strat__spine').boundingBox();
    expect(caseBox, 'the display case must render').not.toBeNull();
    expect(spineBox, 'the spine must render').not.toBeNull();
    expect(caseBox!.x + caseBox!.width, 'the case ends inside the viewport').toBeLessThan(vw - 2);
    expect(spineBox!.x + spineBox!.width, 'the spine ends inside the viewport').toBeLessThan(vw - 1);
    expect(spineBox!.x, 'the case seats INTO the spine').toBeGreaterThan(caseBox!.x + caseBox!.width - 4);
    const leftRail = await page.locator('.con-res').boundingBox();
    const rightRail = await page.locator('.con-strat').boundingBox();
    expect(Math.abs(leftRail!.width - rightRail!.width), 'twin footprints').toBeLessThanOrEqual(2);

    // STATE B — Mayor is MET (green ✓, full meter, mint rim) but NOT
    // actionable (blue's turn): no gold light, no «ДОСТУПНО», the awards
    // door NOT armed — and NO activation ceremony on a plain page load.
    const mayor = page.locator('[data-ma-hud="milestones:Mayor"]');
    await expect(mayor, 'Mayor must be met-but-waiting').toHaveClass(/con-strat__item--ready/, {timeout: 20_000});
    await expect(mayor.locator('.con-strat__readymark')).toHaveCount(1);
    expect(await mayor.locator('.con-strat__avail').count(), 'no «ДОСТУПНО» while not actionable').toBe(0);
    const fillW = await mayor.locator('.con-strat__meter-fill').evaluate((el) => (el as HTMLElement).style.width);
    expect(fillW, 'State B keeps the FULL meter').toBe('100%');
    expect(await page.locator('.con-strat__item--activating').count(),
      'a page LOAD must never replay the activation ceremony').toBe(0);
    expect(await page.locator('.con-strat__zone--awards .con-strat__head--armed').count(),
      'the awards door must not look action-ready off-turn').toBe(0);
    expect(await page.locator('.con-strat__pip--next').count(),
      'no gold slot outline off-turn').toBe(0);
    // Landlord: funded — the sponsor CUBE in the emblem socket (no colour
    // disc), the crown + silver-second podium (3 players, single leader),
    // no roman numerals anywhere.
    const landlord = page.locator('[data-ma-hud="awards:Landlord"]');
    await expect(landlord.locator('.con-strat__medal .con-strat__gem'), 'the sponsor cube').toHaveCount(1);
    await expect(landlord.locator('.con-strat__unitbody--lead .con-strat__crown')).toHaveCount(1);
    await expect(landlord.locator('.con-strat__unitbody--lead .con-strat__num')).toHaveText('3');
    await expect(landlord.locator('.con-strat__unitbody--ii')).toHaveCount(1);
    expect(await page.locator('.con-strat__rank').count(), 'no roman numerals anywhere').toBe(0);
    await expect(page.locator('.con-strat__zone--awards .con-strat__pip--set')).toHaveCount(1);
    await expect(page.locator('.con-strat__zone--awards .con-strat__item--now')).toHaveCount(0);
    // THE CASSETTE AXES (±1 rendered px): both levels' cubes share one
    // horizontal centre; both scores share one right edge — the crown-cap
    // is an overlay and may not push the leader cube into a ladder.
    const axes = await landlord.evaluate((row) => {
      const units = Array.from(row.querySelectorAll('.con-strat__unitbody'));
      const cubes = units.map((u) => u.querySelector('.con-strat__cube')!.getBoundingClientRect());
      const nums = units.map((u) => u.querySelector('.con-strat__num')!.getBoundingClientRect());
      return {
        cubeCenters: cubes.map((r) => r.left + r.width / 2),
        numRights: nums.map((r) => r.right),
        medalW: (row.querySelector('.con-strat__medal') as HTMLElement).getBoundingClientRect().width,
      };
    });
    expect(axes.cubeCenters.length, 'two ranked levels stand').toBe(2);
    expect(Math.abs(axes.cubeCenters[0] - axes.cubeCenters[1]),
      'both levels\' cubes share ONE horizontal centre').toBeLessThanOrEqual(1);
    expect(Math.abs(axes.numRights[0] - axes.numRights[1]),
      'both scores share ONE right edge').toBeLessThanOrEqual(1);
    // The emblem kept its size: the dense TV medal token is 3.5rem = 140px
    // at the 4K UI scale — the cassette may never shrink it.
    expect(axes.medalW, 'the award emblem did not shrink').toBeGreaterThanOrEqual(135);
    // The foreground watchdog's one self-heal toast can arrive DURING the
    // asserts above — wait out a QUIET window before the reference frame.
    await waitToastQuiet(page);
    await shoot(page, 'tv4k-states-01-met-waiting');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-states-01-rail.png')});
    mark('state 01 shot (STATE B + funded podium)');

    // ── 5 · the LIVE B→C flip: blue (and green, if the order holds it)
    //   passes over the API while the page watches the board — red's turn
    //   arrives and the ACTIVATION phrase must play exactly once. ──────────
    // The PROBE is page-side (MutationObserver + interval — NEVER rAF: a
    // quiet headless screen starves rAF exactly when this fires): a 1.1s
    // one-shot class is far above its 60ms tick, while a CDP round-trip
    // loop at 4K can genuinely be too slow to promise a catch.
    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const log: Array<Record<string, unknown>> = [];
      w.__actLog = log;
      const snap = (why: string) => {
        const vis = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          return el !== null && el.checkVisibility({opacityProperty: true, visibilityProperty: true});
        };
        const diag = (w as {__stratDiag?: () => unknown}).__stratDiag;
        log.push({
          why, t: Date.now(),
          activating: document.querySelectorAll('.con-strat__item--activating').length,
          repulse: document.querySelectorAll('.con-strat__item--repulse').length,
          now: document.querySelectorAll('.con-strat__item--now').length,
          start: vis('.con-start'), reveal: vis('.con-reveal'), notice: vis('.con-notice'),
          diag: diag !== undefined ? diag() : null,
        });
      };
      snap('install');
      const probe = () => {
        if (document.querySelector('.con-strat__item--activating, .con-strat__item--repulse') !== null) {
          snap('hit');
        }
      };
      const root = document.querySelector('.con-strat');
      if (root !== null) {
        new MutationObserver(probe).observe(root, {attributes: true, subtree: true, attributeFilter: ['class']});
      }
      w.__actInt = setInterval(() => {
        probe();
        const nowUp = document.querySelector('.con-strat__item--now') !== null;
        if (nowUp && log.every((e) => e.why !== 'now-first-seen')) {
          snap('now-first-seen');
        }
      }, 60);
    });
    await passGeneration(request, p2);
    for (let i = 0; i < 12; i++) {
      const g = await fetchPlayerModel(request, p3);
      const wf: Wire = g.waitingFor;
      if (wf !== undefined && isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined)) {
        await passGeneration(request, p3);
        break;
      }
      const r = await fetchPlayerModel(request, p1);
      const rwf: Wire = r.waitingFor;
      if (rwf !== undefined) {
        break; // red's turn is already up — nothing stands between
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    mark('rivals passed — waiting for the live flip');
    const flipDeadline = Date.now() + 30_000;
    let sawPhrase = false;
    let reachedNow = false;
    while (Date.now() < flipDeadline) {
      const {hits, now} = await page.evaluate(() => {
        const w = window as unknown as {__actLog?: Array<{why: string}>};
        const log = w.__actLog ?? [];
        return {
          hits: log.filter((e) => e.why === 'hit').length,
          now: log.some((e) => e.why === 'now-first-seen'),
        };
      });
      if (hits > 0) {
        sawPhrase = true;
        break;
      }
      if (now) {
        reachedNow = true;
        // C arrived — give the phrase one more beat to register, then stop.
        await page.waitForTimeout(1400);
        const late = await page.evaluate(() =>
          ((window as unknown as {__actLog?: Array<{why: string}>}).__actLog ?? [])
            .some((e) => e.why === 'hit'));
        sawPhrase = late;
        break;
      }
      await page.waitForTimeout(150);
    }
    // The animation record: a burst of rail frames across the phrase
    // (element shots also force compositor frames — headless rAF stays fed).
    for (let f = 0; f < 6; f++) {
      await page.locator('.con-strat').screenshot({path: path.join(OUT, `tv4k-activation-f${f}.png`)});
      await page.waitForTimeout(150);
    }
    const actLog = await page.evaluate(() => {
      const w = window as unknown as {__actLog?: Array<unknown>, __stratDiag?: () => unknown};
      (w.__actLog ?? []).push({why: 'final', diag: w.__stratDiag !== undefined ? w.__stratDiag() : null});
      return JSON.stringify(w.__actLog ?? []);
    });
    expect(sawPhrase,
      `the live rising edge must play the activation phrase (reachedNow=${reachedNow}) — probe log: ${actLog}`)
      .toBe(true);
    mark('activation phrase caught');

    // STATE C — the section's loudest live object: green facts + the
    // gold-white rim + «ДОСТУПНО» replacing the meter in the fixed foot.
    await expect(mayor).toHaveClass(/con-strat__item--now/, {timeout: 10_000});
    await expect(mayor.locator('.con-strat__avail')).toHaveCount(1);
    expect((await mayor.locator('.con-strat__avail').innerText()).trim().length).toBeGreaterThan(0);
    expect(await mayor.locator('.con-strat__meter').count(), 'the word replaces the meter in C').toBe(0);
    await expect(page.locator('.con-strat__zone--milestones .con-strat__pip--next')).toHaveCount(1);
    await waitToastQuiet(page);
    await shoot(page, 'tv4k-states-02-claim-now');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-states-02-rail.png')});
    mark('state 02 shot (STATE C — claim now)');

    // ── 6 · CLAIM through the real workspace: the rail seals on the fold ──
    await clearTransientChrome(page); // a toast would swallow the Q press
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}); // wake the compositor (headless rAF)
    await press(page, 'KeyQ', 1400);
    await page.waitForSelector('.con-ma', {timeout: 12_000});
    // Home lands on the claimable item; verify structurally, walk if not.
    const goFocused = page.locator('.con-ma__card--focused.con-ma__card--go');
    for (let i = 0; i < 8 && await goFocused.count() === 0; i++) {
      await press(page, 'ArrowRight', 320);
    }
    expect(await goFocused.count(), 'a claimable milestone card must take the focus').toBeGreaterThan(0);
    await press(page, 'Enter', 1000);
    await page.waitForSelector('.con-mafocus', {timeout: 10_000});
    await page.waitForTimeout(700); // past the commit arm
    await page.keyboard.press('Enter');
    await page.waitForSelector('.con-mafocus__cere', {timeout: 20_000});
    // The ceremony timeline and the auto-close ride GSAP/rAF — and a quiet
    // headless screen STARVES rAF exactly here ([[e2e-forceframe-wakes-raf]]):
    // a passive waitForSelector never sends a frame, so the timeline freezes
    // mid-ceremony and the close never comes. PUMP BeginFrames while waiting.
    const maGone = async () => (await page.locator('.con-ma').count()) === 0;
    const closeDeadline = Date.now() + 45_000;
    while (Date.now() < closeDeadline && !(await maGone())) {
      await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
      await page.waitForTimeout(280);
    }
    expect(await maGone(), 'the MA workspace must auto-close after its ceremony').toBe(true);
    await page.waitForTimeout(500); // the uncover flush + the seal's first beat
    await shoot(page, 'tv4k-states-03-sealing');
    await page.waitForTimeout(1600); // the seal settles
    await waitToastQuiet(page);
    await expect(mayor).toHaveClass(/con-strat__item--taken/, {timeout: 12_000});
    // The calm horizontal owner line: cube (who) · ВЗЯТО · ✓ (done) — and
    // the emblem stays CLEAN (no floating owner cube), the word gone.
    const seal = mayor.locator('.con-strat__ownseal');
    await expect(seal, 'the owner seal fills the value zone').toHaveCount(1);
    await expect(mayor.locator('.con-strat__ownseal--mine'), 'my claim is white-rimmed').toHaveCount(1);
    await expect(mayor.locator('.con-strat__ownseal-cube')).toHaveCount(1);
    await expect(mayor.locator('.con-strat__ownseal-tick')).toHaveText('✓');
    expect((await seal.locator('.con-strat__ownseal-word').innerText()).trim().length,
      'the seal carries its word').toBeGreaterThan(0);
    expect(await mayor.locator('.con-strat__medal .con-strat__gem').count(),
      'the claimed emblem carries no floating cube').toBe(0);
    expect(await mayor.locator('.con-strat__avail').count(),
      'no availability word survives the claim').toBe(0);
    await expect(mayor.locator('.con-strat__cell'), 'no numbers return after the claim').toHaveCount(0);
    await expect(page.locator('.con-strat__zone--milestones .con-strat__pip--set')).toHaveCount(1);
    await shoot(page, 'tv4k-states-04-claimed');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-states-04-rail.png')});
    mark('state 04 shot (owner seal)');

    // ── 6 · a TIE for first: two chips at one value, the silver II gone ───
    // Drive the table (over the API — the open page just reloads after)
    // until blue can afford its third tile: Landlord red 3 = blue 3.
    await driveTable(request, [p1, p2, p3], async (pid, money) => {
      if (pid === p2 && money >= 25) {
        await stdProject(request, p2, 'City');
        return true;
      }
      await passGeneration(request, pid);
      return false;
    });
    await page.reload();
    await page.waitForSelector('.con-strat', {timeout: 45_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 90_000});
    await waitToastQuiet(page);
    const tied = page.locator('[data-ma-hud="awards:Landlord"] .con-strat__unitbody--lead');
    await expect(tied.locator('.con-strat__cube'), 'both co-leaders chip in').toHaveCount(2, {timeout: 20_000});
    await expect(tied.locator('.con-strat__crown'), 'ONE crown for the tied group').toHaveCount(1);
    await expect(tied.locator('.con-strat__arch'), 'the gold arch spans the tied group').toHaveCount(1);
    await expect(tied.locator('.con-strat__num'), 'one shared value').toHaveCount(1);
    await expect(page.locator('[data-ma-hud="awards:Landlord"] .con-strat__unitbody--ii'),
      'a tie for 1st awards no 2nd place — no silver second line').toHaveCount(0);
    // ZERO OVERLAP: the tied cubes' content boxes may not intersect (equals
    // stand whole, side by side) — and the crown centres over the GROUP.
    const tie = await tied.evaluate((unit) => {
      const boxes = Array.from(unit.querySelectorAll('.con-strat__cube'))
        .map((c) => c.getBoundingClientRect())
        .sort((a, b) => a.left - b.left);
      const crown = unit.querySelector('.con-strat__crown')!.getBoundingClientRect();
      return {
        gap: boxes[1].left - boxes[0].right,
        widths: boxes.map((b) => b.width),
        clusterCenter: (boxes[0].left + boxes[boxes.length - 1].right) / 2,
        crownCenter: crown.left + crown.width / 2,
      };
    });
    expect(tie.gap, 'tied cubes never overlap (content boxes apart)').toBeGreaterThan(0);
    expect(Math.abs(tie.widths[0] - tie.widths[1]), 'tied cubes stay equal').toBeLessThanOrEqual(0.5);
    expect(Math.abs(tie.crownCenter - tie.clusterCenter),
      'the shared crown centres over the whole group').toBeLessThanOrEqual(1.5);
    await shoot(page, 'tv4k-states-05-tie');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-states-05-rail.png')});
  });

  test('rewards COMPACT: the third sponsorship morphs the zone live; reload lands straight in compact', async ({page, request}) => {
    test.setTimeout(420_000);

    // A fresh 3-seat table; red funds TWO awards in its first turn
    // (8 + 14 = 22 — inside ANY calm corp's start), blue finishes the
    // limit later (20 ≤ the poorest calm corp's 23) — the ladder is the
    // server's own (8 → 14 → 20). Same pregame shape as the matrix test.
    const {p1, p2, p3} = await createStagedGame(request);
    await answerInitialCards(request, p2);
    await answerInitialCards(request, p3);
    await answerInitialCards(request, p1);
    await answerCorpPlay(request, p2);
    await answerCorpPlay(request, p3);
    await seedGameOverApi(request, p1, {buy: 0});
    await nestedOption(request, p1, 'Fund an award', '"Landlord"');
    await nestedOption(request, p1, 'Fund an award', '"Banker"');


    // The page opens on RED while it is BLUE's turn: the zone stands FULL
    // with two sponsor pips — and the page polls freely (it holds no menu),
    // so the third seal will arrive WATCHED.
    await openConsole(page, p1, '&consoleProfile=tv');
    await waitForBoardHome(page, 25);
    await expect(page.locator('.con-strat__zone--awards .con-strat__pip--set')).toHaveCount(2, {timeout: 20_000});
    expect(await page.locator('.con-strat__zone--awards.con-strat__zone--done').count(),
      'two sponsorships keep the zone FULL').toBe(0);

    // BLUE funds the third award over the API — the live third seal, the
    // read beat, then the FLIP into the compact pose, all on screen. Blue
    // is on the clock right after red's turn with its full start money, so
    // the funding needs no table driving (and driving it is HARMFUL: the
    // viewer's own turn is what delivers a fresh model to the page, and a
    // driver that passes red for it never lets that turn arrive).
    await nestedOption(request, p2, 'Fund an award', '"Thermalist"');
    await expect(page.locator('.con-strat__zone--awards.con-strat__zone--done'),
      'the third seal composes the compact pose').toHaveCount(1, {timeout: 45_000});
    await expect(page.locator('.con-strat__zone--awards .con-strat__item')).toHaveCount(3, {timeout: 10_000});
    // INDEPENDENT triggers: the milestones zone stays FULL.
    expect(await page.locator('.con-strat__zone--milestones.con-strat__zone--done').count(),
      'the milestones zone must not follow the awards compose').toBe(0);
    // Every sponsored emblem carries its PROVENANCE socket (red, red, blue
    // — «спонсированы разными игроками»), and a fresh sponsorship's empty
    // rank rail dissolves to the calm centred dash.
    await expect(page.locator('.con-strat__zone--awards .con-strat__medal .con-strat__gem')).toHaveCount(3);
    await expect(page.locator('.con-strat__zone--awards .con-strat__pip--set')).toHaveCount(3);

    await waitToastQuiet(page);
    await shoot(page, 'tv4k-compact-awards');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-compact-awards-rail.png')});

    // ── the compact GEOMETRY is measured on a RELOADED page ───────────────
    // A rail with real levels is needed (a freshly funded award's race is
    // empty), so a city is built over the API first — and the page is then
    // reloaded rather than waited on: a viewer only receives a fresh model
    // when the turn reaches it, and the reload is also the contract check
    // that compact seats itself with no beats.
    await driveTable(request, [p1, p2, p3], async (pid, money) => {
      if (pid === p1 && money >= 25) {
        await stdProject(request, p1, 'City');
        return true;
      }
      await passGeneration(request, pid);
      return false;
    });
    await drainNonMenu(request, [p1, p2, p3]);
    await page.reload();
    await page.waitForSelector('.con-strat', {timeout: 45_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 90_000});
    // RELOAD lands STRAIGHT in compact — no morph replay, no seal beat,
    // the same sockets (the seed-then-diff contract).
    await expect(page.locator('.con-strat__zone--awards.con-strat__zone--done')).toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-strat__zone--awards .con-strat__medal .con-strat__gem')).toHaveCount(3);
    expect(await page.locator('.con-strat__item--sealing').count(), 'no seal beat replays on reload').toBe(0);
    expect(await page.locator('.con-strat__zone--arriving').count(), 'no pose arrival replays on reload').toBe(0);

    // COMPACT CLEANLINESS: no vertical decoration inside the ranking zone
    // (the full pose's guide crossed the emblem's wing and the sponsor
    // socket at this density), exactly ONE horizontal divider between the
    // two places, and it lives strictly inside the ranking zone — while
    // the sponsor socket stays anchored to the EMBLEM wrapper.
    const rankedRow = page.locator('.con-strat__zone--awards .con-strat__item:has(.con-strat__unitbody--i)').first();
    await expect(rankedRow, 'the built city gives compact a live rank rail').toHaveCount(1, {timeout: 30_000});
    const clean = await rankedRow.evaluate((row) => {
      const px = (v: string) => (v.endsWith('px') ? Number.parseFloat(v) : Number.NaN);
      const cassette = row.querySelector('.con-strat__cassette') as HTMLElement;
      const medal = (row.querySelector('.con-strat__medal') as HTMLElement).getBoundingClientRect();
      const gem = (row.querySelector('.con-strat__gem') as HTMLElement).getBoundingClientRect();
      const lead = row.querySelector('.con-strat__unitbody--i') as HTMLElement | null;
      const second = row.querySelector('.con-strat__unitbody--ii, .con-strat__unitbody--chase') as HTMLElement | null;
      const leadBox = lead?.getBoundingClientRect();
      const dividerStyle = lead === null ? null : getComputedStyle(lead, '::after');
      return {
        guide: getComputedStyle(cassette, '::before').content,
        loneNotch: getComputedStyle(cassette, '::after').content,
        secondTread: second === null ? 'none' : getComputedStyle(second, '::after').content,
        dividerContent: dividerStyle?.content ?? 'none',
        // The divider's own left edge, derived from the level box + its
        // computed inset (a pseudo-element has no box of its own).
        dividerLeft: leadBox === undefined ? Number.NaN :
          leadBox.left + (px(dividerStyle?.left ?? '') || 0),
        rankLeft: leadBox?.left ?? Number.NaN,
        medalRight: medal.right,
        gemRight: gem.right,
        gemInsideMedalBand: gem.left >= medal.left && gem.left <= medal.right,
      };
    });
    // The socket is the TOP layer at its own centre: the ranking zone's
    // material may never wash over it (a translucent dark plate lying on
    // the cube reads as an unfinished glass contour).
    // NOTHING OF THE RAIL LIES ON A SOCKET. Measured on the rail's own
    // boxes — never `elementFromPoint`, which answers about the whole
    // page (a held, fully transparent app overlay tops every point and
    // says nothing about this defect). Two real overlaps are possible:
    // the ranking zone's material reaching left onto a socket, and a
    // NEIGHBOUR row's art — drawn larger than its medal box — reaching up
    // over the row above it.
    const socketClear = await page.locator('.con-strat__zone--awards').evaluate((zone) => {
      const rows = [...zone.querySelectorAll('.con-strat__item')];
      const boxes = rows.map((row) => ({
        gem: row.querySelector('.con-strat__gem')?.getBoundingClientRect(),
        art: row.querySelector('.con-strat__art')!.getBoundingClientRect(),
        cassette: row.querySelector('.con-strat__cassette')?.getBoundingClientRect(),
        // The rows' own paint order: an overhanging neighbour is harmless
        // as long as it is painted BELOW the row carrying the socket.
        z: Number.parseInt(getComputedStyle(row).zIndex, 10),
      }));
      const hits = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      let foreignArt = 0;
      boxes.forEach((self, i) => {
        if (self.gem === undefined) {
          return;
        }
        boxes.forEach((other, j) => {
          // A neighbour's art may only reach a socket from UNDERNEATH.
          if (i !== j && hits(self.gem!, other.art) && other.z > self.z) {
            foreignArt++;
          }
        });
      });
      const cassette = rows[0].querySelector('.con-strat__cassette') as HTMLElement;
      return {foreignArt, plate: getComputedStyle(cassette).backgroundImage};
    });
    expect(socketClear.foreignArt, 'no neighbour row\'s art reaches over a sponsor socket').toBe(0);
    // (The zone's BOX may span past a socket — it paints nothing there:
    // the plate is gone and the divider starts well to its right, both
    // asserted below. Geometry alone would be a false positive.)
    expect(socketClear.plate, 'the compact ranking zone carries no plate/wash').toBe('none');
    expect(clean.guide, 'the vertical guide is gone in compact').toBe('none');
    expect(clean.loneNotch, 'the lone-leader vertical notch is gone in compact').toBe('none');
    expect(clean.secondTread, 'only ONE divider survives (no per-level tread)').toBe('none');
    expect(clean.dividerContent, 'the single divider between the places renders').not.toBe('none');
    expect(clean.dividerLeft, 'the divider starts inside the ranking zone, past the emblem')
      .toBeGreaterThan(clean.medalRight);
    expect(clean.dividerLeft, 'the divider never reaches the sponsor socket').toBeGreaterThan(clean.gemRight);
    // (The zone's own BOX may start left of the emblem's right edge — it
    // is transparent there; what must clear the emblem is the only thing
    // it PAINTS, the divider, asserted above.)
    expect(clean.gemInsideMedalBand, 'the sponsor socket is anchored to the EMBLEM wrapper').toBe(true);

    await waitToastQuiet(page);
    await shoot(page, 'tv4k-compact-ranked');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-compact-ranked-rail.png')});
  });
});
