import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CORP_WITH_FIRST_ACTION, fetchPlayerModel, openConsole, press,
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
 * (only 1st scores in a 2-player game), so the silver «II» plaque is only
 * honest — and only testable — with a third seat in the race.
 *
 * States pinned here (screenshots + structural asserts):
 *  1. progress rows (current/required + meter), a READY+OFFERED milestone
 *     (mint rim, breathing), a funded award (sponsor seal + tray enamel),
 *     the I/II micro-podium, an unsponsored quiet award, the armed door;
 *  2. the claim seal riding the workspace's fold (owner seal «ВЗЯТО»);
 *  3. the claimed pose: owner seal in the value zone, never an empty right;
 *  4. a tie for FIRST: two chips at one value, the silver II gone (no
 *     false second place).
 *
 * And the FINISHED BODY (§ the case/spine geometry): the display case and
 * its spine terminate INSIDE the viewport — the glass never reads as
 * cropped by the screen edge.
 */

const OUT = path.resolve('screenshots', 'strategy-rail');

/** Loose wire shape — JSON off the HTTP response (the seeder's own idiom). */
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
  onMenu: (pid: string, money: number, actionsTaken: number) => Promise<boolean>,
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
        (m as Wire).thisPlayer?.actionsTakenThisRound ?? 0)) {
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

  test('progress → ready/offered → funded podium → workspace claim seal → tie', async ({page, request}) => {
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
    //   otherwise): red → 3 cities (Mayor 3/3) then fund Landlord;
    //   blue → city + greenery (podium II = 2); green idles.
    //   The drive STOPS on red's menu right after the funding — red then
    //   holds its second action, which the page will spend on the CLAIM.
    const built = {redCities: 0, blueCity: 0, blueGreen: 0};
    await driveTable(request, [p1, p2, p3], async (pid, money, actionsTaken) => {
      if (pid === p1) {
        const blueDone = built.blueCity === 1 && built.blueGreen === 1;
        // The FUND must land as the turn's FIRST action, so that red still
        // HOLDS action 2 when the page takes over (the claim is that press).
        // Funding as action 2 ends the turn and hands it to blue — the state
        // the whole stop exists for is then gone before the page opens.
        if (built.redCities === 3 && blueDone && money >= 16 && actionsTaken === 0) {
          await nestedOption(request, p1, 'Fund an award', '"Landlord"');
          return true; // red's menu holds action 2 — the page takes over
        }
        if (built.redCities < 3 && money >= 25 && !(built.redCities === 2 && blueDone && actionsTaken === 1)) {
          // (The guarded case: never spend action 2 on the LAST city when the
          // fund would then have to open the next turn as action 1 anyway —
          // keeps city #3 and the fund in one deterministic order.)
          await stdProject(request, p1, 'City');
          built.redCities++;
          return false;
        }
        await passGeneration(request, p1);
        return false;
      }
      if (pid === p2) {
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
    mark('matrix staged (red holds action 2 after the funding)');

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

    // Mayor: READY + OFFERED (the viewer's turn) — the emerald rim state.
    const mayor = page.locator('[data-ma-hud="milestones:Mayor"]');
    await expect(mayor, 'Mayor must be offered right now').toHaveClass(/con-strat__item--now/, {timeout: 20_000});
    await expect(mayor.locator('.con-strat__readymark')).toHaveCount(1);
    // Landlord: funded (sponsor seal + tray enamel) with a live I/II podium.
    const landlord = page.locator('[data-ma-hud="awards:Landlord"]');
    await expect(landlord.locator('.con-strat__gem'), 'the sponsor seal').toHaveCount(1);
    await expect(landlord.locator('.con-strat__rank--i')).toHaveText('I');
    await expect(landlord.locator('.con-strat__rank--ii')).toHaveText('II');
    await expect(landlord.locator('.con-strat__unitbody--lead .con-strat__num')).toHaveText('3');
    // The door-level availability: the awards head arms, its next slot pip
    // golds — and no award row pulses.
    await expect(page.locator('.con-strat__zone--awards .con-strat__head--armed')).toHaveCount(1);
    await expect(page.locator('.con-strat__zone--awards .con-strat__pip--set')).toHaveCount(1);
    await expect(page.locator('.con-strat__zone--awards .con-strat__pip--next')).toHaveCount(1);
    await expect(page.locator('.con-strat__zone--awards .con-strat__item--now')).toHaveCount(0);
    // The foreground watchdog's one self-heal toast can arrive DURING the
    // asserts above — wait out a QUIET window before the reference frame.
    await waitToastQuiet(page);
    await shoot(page, 'tv4k-states-01-home');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-states-01-rail.png')});
    mark('state 01 shot (ready/offered + funded podium)');

    // ── 5 · CLAIM through the real workspace: the rail seals on the fold ──
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
    await page.waitForSelector('.con-ma', {state: 'detached', timeout: 30_000});
    await page.waitForTimeout(500); // the uncover flush + the seal's first beat
    await shoot(page, 'tv4k-states-02-sealing');
    await page.waitForTimeout(1600); // the seal settles
    await waitToastQuiet(page);
    await expect(mayor).toHaveClass(/con-strat__item--taken/, {timeout: 12_000});
    const seal = mayor.locator('.con-strat__ownseal');
    await expect(seal, 'the owner seal fills the value zone').toHaveCount(1);
    await expect(mayor.locator('.con-strat__ownseal--mine'), 'my claim is white-rimmed').toHaveCount(1);
    expect((await seal.locator('.con-strat__ownseal-word').innerText()).trim().length,
      'the seal carries its word').toBeGreaterThan(0);
    await expect(mayor.locator('.con-strat__cell'), 'no numbers return after the claim').toHaveCount(0);
    await expect(page.locator('.con-strat__zone--milestones .con-strat__pip--set')).toHaveCount(1);
    await shoot(page, 'tv4k-states-03-claimed');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-states-03-rail.png')});
    mark('state 03 shot (owner seal)');

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
    await expect(tied.locator('.con-strat__num'), 'one shared value').toHaveCount(1);
    await expect(page.locator('[data-ma-hud="awards:Landlord"] .con-strat__rank--ii'),
      'a tie for 1st awards no 2nd place — the silver plaque must go').toHaveCount(0);
    await shoot(page, 'tv4k-states-04-tie');
    await page.locator('.con-strat').screenshot({path: path.join(OUT, 'tv4k-states-04-rail.png')});
  });
});
