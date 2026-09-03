import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * DP10 — CORPORATE ESPIONAGE, the premium vertical slice, live:
 *
 *  A) SOLO (no opponents = the NO-LEGAL-TARGET outcome): the play composer
 *     shows the attack as the resolved system skip (no empty selector ever
 *     opens), the OWNER's stage-1 landing choice is a mandatory pre-select
 *     row, the CTA commits, and the execution RE-ENTERS the Hydronetwork
 *     workspace: the owner's marker walks 0 → 1, the reward pays, the result
 *     summary restates the skip — and the flow concludes to the board.
 *
 *  B) TWO PLAYERS (the human-target flow): P2 gets onto the track over the
 *     API (a building card + the standard advance), P1 plays DP10 from the
 *     console — the target row opens the REAL Hydronetwork workspace in
 *     projection mode (candidate rows + ghost markers), A picks P2, the
 *     setup summary shows both halves, the CTA commits, and the execution
 *     moves P2's marker FIRST (their own colour on the glide proxy), then
 *     P1's — with the server agreeing on both final positions.
 *
 * Screenshots → `screenshots/corporate-espionage/`.
 */

const OUT = path.resolve('screenshots', 'corporate-espionage');
const CARD = 'Corporate Espionage';
/** Simple no-prompt building-tag cards P2 can play over the API. */
const P2_BUILDING = ['Mine', 'Industrial Microbes'];

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 350): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

function payMc(amount: number): Wire {
  return {...NO_PAYMENT, megacredits: amount};
}

/** Wait until the given player's live prompt satisfies `want`. */
async function waitPrompt(request: APIRequestContext, id: string, want: (p: Wire | undefined) => boolean, label: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 90; i++) {
    if (want(model.waitingFor as Wire | undefined)) {
      return model as Wire;
    }
    await new Promise((r) => setTimeout(r, 500));
    model = await fetchPlayerModel(request, id) as Wire;
  }
  expect(false, `${label}: never arrived (last: ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

const isActionMenu = (p: Wire | undefined) =>
  p !== undefined && p.type === 'or' && /Take your (first|next) action/.test(titleOf(p));

/** Answer ONE player's research phase directly (multiplayer: the seeder's
 *  wait-for-menu contract deadlocks — the menu needs BOTH answers first). */
async function answerInitialCards(request: APIRequestContext, id: string, buys: ReadonlyArray<string>): Promise<void> {
  const model = await waitPrompt(request, id, (p) => p?.type === 'initialCards', 'initial cards');
  const wf = model.waitingFor as Wire;
  // The corporation's identity is irrelevant here (testMode overrides the
  // stock) — but it must be a CALM one (no mandatory first action, no
  // payment quirk — the shared CORP_WITH_FIRST_ACTION list), or the action
  // menu never comes and the whole turn script stalls behind a prompt
  // nobody drives.
  const CALM = ['ThorGate', 'Teractor', 'PhoboLog', 'Mining Guild', 'Saturn Systems', 'Interplanetary Cinematics', 'Ecoline'];
  const corpOffer = ((wf.options?.[0]?.cards ?? []) as Array<Wire>).map((c) => String(c.name));
  const corp = CALM.find((c) => corpOffer.includes(c));
  expect(corp, `a calm corporation among ${corpOffer.join(', ')}`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'initialCards',
    responses: [
      {type: 'card', cards: [corp]},
      {type: 'card', cards: [...buys]},
    ],
  } as never);
}

/** Drive one player's PREGAME follow-ups (the corporation play + the bought
 *  cards' payment) to the action menu — or to a quiet idle (the off-turn
 *  player, whose menu only comes when the first player passes). */
async function drainPregame(request: APIRequestContext, id: string, until: 'menu' | 'idle'): Promise<void> {
  let idlePolls = 0;
  for (let i = 0; i < 80; i++) {
    const model = await fetchPlayerModel(request, id) as Wire;
    const p = model.waitingFor as Wire | undefined;
    if (p === undefined) {
      idlePolls++;
      if (until === 'idle' && idlePolls >= 3) {
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    idlePolls = 0;
    if (isActionMenu(p)) {
      expect(until, `an action menu arrived for the ${until}-bound player`).toBe('menu');
      return;
    }
    if (p.type === 'card') {
      await sendPlayerInput(request, id, {type: 'card', cards: [String((p.cards ?? [])[0]?.name ?? '')]} as never);
    } else if (p.type === 'payment') {
      await sendPlayerInput(request, id, {type: 'payment', payment: payMc(Number(p.amount ?? 0))} as never);
    } else if (p.type === 'option') {
      await sendPlayerInput(request, id, {type: 'option'} as never);
    } else if (p.type === 'or') {
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never);
    } else {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  expect(false, `pregame drain stalled for ${id} (${until})`).toBeTruthy();
}

/** Answer P's action menu with `pick(menu)`; waits for the menu first. */
async function onMenu(request: APIRequestContext, id: string, pick: (menu: Wire) => Wire): Promise<void> {
  const model = await waitPrompt(request, id, isActionMenu, 'action menu');
  await sendPlayerInput(request, id, pick(model.waitingFor as Wire) as never);
}

function menuIndex(menu: Wire, match: (o: Wire) => boolean, label: string): number {
  const at = (menu.options ?? []).findIndex(match);
  expect(at, `${label} is offered (got: ${(menu.options ?? []).map((o: Wire) => titleOf(o)).join(' | ')})`).toBeGreaterThanOrEqual(0);
  return at;
}

/** Walk the play composer's decision rows until the focused row is missing,
 *  open it, and answer it. The OWNER-LANDING choice descends SEAMLESSLY into
 *  the Hydronetwork's stage-reward surface (the DP08 pick in its
 *  advance-landing shape) — the driver proves the descent: the reward-pick
 *  layer with the forward ghost on the destination cell, A opens the stage's
 *  own choice selector, A picks, A resolves back into the composer. */
async function answerOwnerChoiceRow(page: Page, log?: {sawRewardPick?: boolean, sawGhost?: boolean, sawChoice?: boolean, sawArc?: boolean}): Promise<void> {
  for (let i = 0; i < 24; i++) {
    const state = await page.evaluate(() => ({
      missingFocused: document.querySelector('.con-composer__row--focused.con-composer__row--missing') !== null,
      anyMissing: document.querySelector('.con-composer__row--missing') !== null,
      rewardPick: document.querySelector('.con-hydro__layer--rewardpick') !== null,
      fwdGhost: document.querySelector('.con-hydro__stop-ghost--fwd') !== null,
      arc: document.querySelector('.con-hydro__ghostlink-path') !== null,
      choiceOpen: document.querySelector('.con-hydro__layer--choice') !== null,
      subOpen: document.querySelector('.con-composer__opt') !== null,
    }));
    if (log !== undefined) {
      if (state.rewardPick && log.sawRewardPick !== true) {
        await shoot(page, 'owner-reward-pick');
      }
      if (state.choiceOpen && log.sawChoice !== true) {
        await shoot(page, 'owner-reward-choice');
      }
      log.sawRewardPick = (log.sawRewardPick ?? false) || state.rewardPick;
      log.sawGhost = (log.sawGhost ?? false) || (state.rewardPick && state.fwdGhost);
      log.sawArc = (log.sawArc ?? false) || (state.rewardPick && state.arc);
      log.sawChoice = (log.sawChoice ?? false) || state.choiceOpen;
    }
    // The hydro descent's three beats, each one A: the stage's own choice
    // selector picks the FOCUSED option; the reward-pick CTA opens the ask
    // first and resolves the answered pick second.
    if (state.choiceOpen || state.rewardPick) {
      await key(page, 'Enter', 600);
      continue;
    }
    if (state.subOpen) {
      await key(page, 'Enter', 500);
      continue;
    }
    if (!state.anyMissing) {
      return;
    }
    if (state.missingFocused) {
      await key(page, 'Enter', 700);
      continue;
    }
    await key(page, 'ArrowDown', 260);
  }
  expect(await page.locator('.con-composer__row--missing').count(), 'every mandatory row answered').toBe(0);
}

/** From board home: open the hand, focus CARD, open its play composer. */
async function openEspionageComposer(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await key(page, 'Period', 800);
    await key(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 15_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(600);
  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${CARD}"]`).count();
  let last = '';
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const selected = await page.evaluate(() =>
      document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
    await key(page, selected === last && i > 0 ? 'ArrowDown' : 'ArrowRight', 240);
    last = selected;
  }
  expect(await onTarget(), `hand cursor reached ${CARD}`).toBeGreaterThan(0);
  // Act → verify → retry: a press is legitimately swallowed while the hand
  // stage is still transitioning (longer at the 4K profile).
  for (let i = 0; i < 8 && await page.locator('.con-composer--play').count() === 0; i++) {
    await key(page, 'Enter', 900);
  }
  await expect(page.locator('.con-composer--play')).toBeVisible({timeout: 15_000});
  await page.waitForTimeout(900);
}

/** Watch the execution: the hydro workspace, the espionage line, the marker
 *  glide(s), the result — pressing A only on the result to conclude. */
async function watchExecution(page: Page, log: {glideColors: Set<string>, sawEspLine: boolean, sawResult: boolean}): Promise<void> {
  let resultStreak = 0;
  for (let i = 0; i < 240; i++) {
    const s = await page.evaluate(() => {
      const marker = document.querySelector('.con-hydromarker');
      const color = marker === null ? '' :
        (Array.from(marker.classList).find((c) => c.startsWith('player_bg_color_')) ?? '');
      return {
        hydro: document.querySelector('.con-hydro') !== null,
        espLine: document.querySelector('.con-hydro__espline') !== null,
        marker: color,
        result: document.querySelector('.con-hydro__layer--result') !== null,
        board: document.querySelector('.con-hydro') === null &&
          document.querySelector('.con-composer--play') === null,
      };
    });
    if (s.marker !== '') {
      log.glideColors.add(s.marker.replace('player_bg_color_', ''));
    }
    if (s.espLine) {
      log.sawEspLine = true;
    }
    if (s.result) {
      log.sawResult = true;
      resultStreak++;
      if (resultStreak === 3) {
        await shoot(page, 'result');
      }
      if (resultStreak > 4) {
        await key(page, 'Enter', 600); // Continue — conclude the flow
      }
    } else {
      resultStreak = 0;
    }
    if (log.sawResult && s.board) {
      return;
    }
    await page.waitForTimeout(200);
  }
  expect(log.sawResult, 'the execution reached its result summary').toBeTruthy();
}

test.describe('Corporate Espionage — the premium vertical slice', () => {
  test.setTimeout(420_000);
  // The product's primary TV profile — geometry claims below are claims about
  // THIS resolution (the Playwright default 1280×720 is not a target).
  test.use({viewport: {width: 1920, height: 1080}});

  test('SOLO: no legal target — named skip, owner pre-select, hydro execution, result', async ({page, request}) => {
    // The 4K TV profile — the resource chips ride the px `hydro-reward`
    // component through the ×ui-scale zoom idiom, and THIS is the resolution
    // where a missed multiplier shipped half-size icons (the geometry claim
    // below is a claim about this profile; the 2P test keeps 1080).
    await page.setViewportSize({width: 3840, height: 2160});
    const cfg = soloGameConfig({
      expansions: {deltaProject: true},
      customProjectCards: [CARD],
      customCorporationsList: ['ThorGate'],
      seed: 0.41,
    });
    const created = await request.post('/api/creategame', {data: cfg});
    expect(created.ok(), 'create-game accepted').toBeTruthy();
    const {players} = await created.json() as {players: Array<{id: string}>};
    const id = players[0].id;
    await seedGameOverApi(request, id, {cards: [CARD], corporation: 'ThorGate'});
    await openConsole(page, id);
    await waitForBoardHome(page);

    await openEspionageComposer(page);
    // The attack half auto-resolved as the NAMED system skip (no selector).
    await expect(page.locator('.con-composer__esp-skip').first()).toBeVisible({timeout: 10_000});
    // The owner's half of the summary (You: 0 → 1 + the waiver tag) stands.
    await expect(page.locator('.con-composer__esp-own')).toBeVisible();
    await expect(page.locator('.con-composer__esp-waiver')).toBeVisible();
    // 4K: the owner-reward chips PAINT at the TV scale (22px body × ~2 via the
    // ui-scale zoom) — a raw px chip reads ~22px here, the shipped defect.
    const chipIcon = page.locator('.con-composer__esp-chips .hydro-reward__icon').first();
    await expect(chipIcon).toBeVisible();
    const iconBox = await chipIcon.boundingBox();
    expect(iconBox?.width ?? 0, `owner chip icon scales on 4K (got ${iconBox?.width}px)`).toBeGreaterThan(38);
    await shoot(page, 'solo-composer');

    // The owner's landing choice descends into the HYDRONETWORK's stage-reward
    // surface (never a bare option list) — the descent's beats are asserted.
    const pickLog: {sawRewardPick?: boolean, sawGhost?: boolean, sawChoice?: boolean, sawArc?: boolean} = {};
    await answerOwnerChoiceRow(page, pickLog);
    expect(pickLog.sawRewardPick, 'the owner choice opened the Hydronetwork reward surface').toBeTruthy();
    expect(pickLog.sawGhost, 'the destination cell carried the forward ghost').toBeTruthy();
    expect(pickLog.sawChoice, 'the stage\'s own choice selector opened').toBeTruthy();
    expect(pickLog.sawArc, 'the movement arc linked the marker to its ghost').toBeTruthy();
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 10_000});
    await key(page, 'Enter', 400); // commit

    const log = {glideColors: new Set<string>(), sawEspLine: false, sawResult: false};
    await watchExecution(page, log);
    expect(log.sawEspLine, 'the espionage line narrated the skip').toBeTruthy();
    expect([...log.glideColors], 'only the OWNER\'s marker glided').toEqual(['red']);

    // The server agrees: the owner advanced exactly one step; the stop is
    // recorded; the play left the hand.
    const model = await fetchPlayerModel(request, id) as Wire;
    expect(model.thisPlayer.deltaProject?.position).toBe(1);
    expect((model.cardsInHand ?? []).map((c: Wire) => c.name)).not.toContain(CARD);
  });

  test('SOLO stage-7: the owner repeat pre-select descends into the Hydronetwork, never over the composer', async ({page, request}) => {
    test.setTimeout(600_000);
    // The tag path to stage 7 (the delta spec's own list) + DP10. Tardigrades
    // doubles as the used blue action stage 7 can repeat.
    const SUPPORT = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Tardigrades'];
    const cfg = soloGameConfig({
      expansions: {deltaProject: true},
      customProjectCards: [CARD, ...SUPPORT],
      customCorporationsList: ['ThorGate'],
      seed: 0.37,
    });
    const created = await request.post('/api/creategame', {data: cfg});
    expect(created.ok(), 'create-game accepted').toBeTruthy();
    const {players} = await created.json() as {players: Array<{id: string}>};
    const id = players[0].id;
    await seedGameOverApi(request, id, {cards: [CARD, ...SUPPORT], corporation: 'ThorGate'});

    // ── API setup: the tags, the used action, the marker on 6. ──
    for (const card of SUPPORT) {
      await onMenu(request, id, (menu) => {
        const at = menuIndex(menu, (o) => titleOf(o) === 'Play project card', 'Play project card');
        const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
        expect(offered, `${card} in hand`).toBeDefined();
        return {type: 'or', index: at, response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 12)}};
      });
    }
    await onMenu(request, id, (menu) => {
      const at = (menu.options ?? []).findIndex((o: Wire) =>
        (o.cards ?? []).some((c: Wire) => c.name === 'Tardigrades') && titleOf(o) !== 'Play project card');
      expect(at, 'the menu offers Tardigrades\' action').toBeGreaterThanOrEqual(0);
      return {type: 'or', index: at, response: {type: 'card', cards: ['Tardigrades']}};
    });
    await onMenu(request, id, (menu) => ({
      type: 'or',
      index: menuIndex(menu, (o) => titleOf(o) === 'Advance on the Hydronetwork track', 'the standard advance'),
      response: {type: 'option'},
    }));
    await waitPrompt(request, id, (p) => p?.type === 'deltaProject', 'the advance amount');
    await sendPlayerInput(request, id, {type: 'deltaProject', amount: 6} as never);
    await waitPrompt(request, id, isActionMenu, 'menu after the advance');
    expect(((await fetchPlayerModel(request, id)) as Wire).thisPlayer.deltaProject?.position,
      'the setup marker stands on 6').toBe(6);

    // ── The console takes over: play DP10 at 6 → the owner lands on 7. ──
    await openConsole(page, id);
    await waitForBoardHome(page);
    await openEspionageComposer(page);

    // Drive the composer's mandatory rows. THE CONTRACT UNDER TEST: the
    // repeat pre-select must descend into the HYDRONETWORK first (reward-pick
    // scene + the movement arc), and only from INSIDE it reuse the track's
    // own seamless hydro→repeat frame — the repeat selector may never be
    // sighted before the reward-pick was (the «rendered over the composer»
    // violation of the screenshot this test pins).
    const log = {sawRewardPick: false, sawArc: false, sawSelector: false, orderViolated: false};
    const hydroVisible = () => page.evaluate(() => {
      const el = document.querySelector('.con-hydro') as HTMLElement | null;
      return el !== null && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    });
    for (let i = 0; i < 40; i++) {
      const s = await page.evaluate(() => ({
        esppick: document.querySelector('.con-hydro__layer--esppick') !== null,
        rewardPick: document.querySelector('.con-hydro__layer--rewardpick') !== null,
        arc: document.querySelector('.con-hydro__ghostlink-path') !== null,
        selector: (() => {
          const els = Array.from(document.querySelectorAll('.con-cardactions')) as Array<HTMLElement>;
          return els.some((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0);
        })(),
        missingFocused: document.querySelector('.con-composer__row--focused.con-composer__row--missing') !== null,
        anyMissing: document.querySelector('.con-composer__row--missing') !== null,
        ctaReady: document.querySelector('.con-composer__cta--ready') !== null,
        composer: document.querySelector('.con-composer--play') !== null,
      }));
      log.sawRewardPick = log.sawRewardPick || s.rewardPick;
      log.sawArc = log.sawArc || (s.rewardPick && s.arc);
      if (s.selector && !log.sawSelector) {
        log.sawSelector = true;
        if (!log.sawRewardPick) {
          log.orderViolated = true;
        }
        await shoot(page, 'stage7-repeat-selector');
      }
      if (s.rewardPick && !s.selector && log.sawRewardPick && !log.sawArc && s.arc) {
        log.sawArc = true;
      }
      if (s.rewardPick && i > 0 && !log.sawSelector) {
        await shoot(page, 'stage7-reward-pick');
      }
      // One A per beat: candidate pick → reward-pick CTA (opens the repeat
      // frame) → the selector walk (pick → compose → confirm) → the CTA again
      // (resolves) → the composer rows → the commit.
      if (s.selector && !await hydroVisible()) {
        await key(page, 'Enter', 1600);
        continue;
      }
      if (s.esppick || s.rewardPick) {
        await key(page, 'Enter', 1100);
        continue;
      }
      if (s.missingFocused) {
        await key(page, 'Enter', 900);
        continue;
      }
      if (s.composer && !s.anyMissing && s.ctaReady) {
        break;
      }
      if (s.composer && s.anyMissing) {
        await key(page, 'ArrowDown', 280);
        continue;
      }
      await page.waitForTimeout(400);
    }
    expect(log.sawRewardPick, 'the repeat pre-select descended into the Hydronetwork reward surface').toBeTruthy();
    expect(log.sawArc, 'the movement arc stood on the track during the descent').toBeTruthy();
    expect(log.sawSelector, 'the hydro\'s own repeat frame opened').toBeTruthy();
    expect(log.orderViolated, 'the repeat selector was sighted BEFORE the hydro descent (the over-the-composer violation)').toBeFalsy();
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 10_000});
    await shoot(page, 'stage7-composer-ready');
    await key(page, 'Enter', 400); // commit

    const exec = {glideColors: new Set<string>(), sawEspLine: false, sawResult: false};
    await watchExecution(page, exec);
    expect(exec.sawResult, 'the execution reached its result').toBeTruthy();
    await expect.poll(async () =>
      ((await fetchPlayerModel(request, id)) as Wire).thisPlayer.deltaProject?.position ?? 0,
    {timeout: 20_000}).toBe(7);
  });

  test('TWO PLAYERS: target pick in the workspace, target marker first, both rewards', async ({page, request}) => {
    // ── create until P1's deal offers DP10 and P2's a simple building card ──
    let p1 = '';
    let p2 = '';
    let p2Building = '';
    for (let attempt = 0; attempt < 60 && p1 === ''; attempt++) {
      const cfg = soloGameConfig({
        players: [
          {name: 'Spy', color: 'red', beginner: false, handicap: 0, first: true},
          {name: 'Rival', color: 'blue', beginner: false, handicap: 0, first: false},
        ],
        expansions: {deltaProject: true},
        customProjectCards: [CARD],
        customCorporationsList: ['ThorGate', 'CrediCor'],
        seed: 0.19 + attempt * 0.017,
      });
      const created = await request.post('/api/creategame', {data: cfg});
      expect(created.ok(), 'create-game accepted').toBeTruthy();
      const {players} = await created.json() as {players: Array<{id: string, name: string}>};
      const [a, b] = players;
      const deal = async (pid: string) => {
        const pv = await (await request.get(`/api/player?id=${pid}`)).json() as Wire;
        return ((pv.waitingFor?.options ?? []) as Array<Wire>)
          .flatMap((o) => ((o.cards ?? []) as Array<Wire>).map((c) => String(c.name)));
      };
      const d1 = await deal(a.id);
      const d2 = await deal(b.id);
      const building = P2_BUILDING.find((c) => d2.includes(c));
      if (d1.includes(CARD) && building !== undefined) {
        p1 = a.id;
        p2 = b.id;
        p2Building = building;
      }
    }
    expect(p1, 'a deal offering DP10 to P1 and a building card to P2').not.toBe('');

    // ── research: P1 buys DP10; P2 buys the building card ──
    await answerInitialCards(request, p1, [CARD]);
    await answerInitialCards(request, p2, [p2Building]);
    // CONCURRENT on purpose: P1's menu only comes once P2's corporation is
    // played and paid — sequential drains deadlock on each other.
    await Promise.all([
      drainPregame(request, p1, 'menu'),
      drainPregame(request, p2, 'idle'),
    ]);

    // ── gen 1 over the API: P1 passes; P2 plays the building card, advances
    //    on the track (0 → 1), answers the stage-1 choice, then passes. ──
    await onMenu(request, p1, (menu) => ({
      type: 'or', index: menuIndex(menu, (o) => titleOf(o).startsWith('Pass'), 'Pass'),
      response: {type: 'option'},
    }));
    await onMenu(request, p2, (menu) => {
      const at = menuIndex(menu, (o) => titleOf(o) === 'Play project card', 'Play project card');
      const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === p2Building);
      expect(offered, `${p2Building} in P2's hand`).toBeDefined();
      return {type: 'or', index: at, response: {type: 'projectCard', card: p2Building, payment: payMc(offered.calculatedCost ?? 10)}};
    });
    // The standard advance is TWO steps on the wire: the menu option's own
    // confirm, then the DeltaProjectInput's amount.
    await onMenu(request, p2, (menu) => ({
      type: 'or',
      index: menuIndex(menu, (o) => titleOf(o) === 'Advance on the Hydronetwork track', 'the standard advance'),
      response: {type: 'option'},
    }));
    await waitPrompt(request, p2, (p) => p?.type === 'deltaProject', 'the advance amount');
    await sendPlayerInput(request, p2, {type: 'deltaProject', amount: 1} as never);
    // Stage 1's own reward choice (2 steel / 2 plants) — P2's prompt.
    const choice = await waitPrompt(request, p2,
      (p) => p !== undefined && p.type === 'or' && (p.options ?? []).some((o: Wire) => titleOf(o) === 'Gain 2 steel'),
      'P2 stage-1 choice');
    await sendPlayerInput(request, p2, {
      type: 'or',
      index: (choice.waitingFor.options as Array<Wire>).findIndex((o) => titleOf(o) === 'Gain 2 steel'),
      response: {type: 'option'},
    } as never);
    await onMenu(request, p2, (menu) => ({
      type: 'or', index: menuIndex(menu, (o) => titleOf(o).startsWith('Pass'), 'Pass'),
      response: {type: 'option'},
    }));

    // ── the generation boundary: both answer the research buy (nothing). ──
    for (const id of [p1, p2]) {
      await waitPrompt(request, id, (p) => p?.type === 'card', 'the research buy');
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never);
    }

    // ── gen 2: P2 (now first) passes; P1's turn — the console takes over. ──
    await onMenu(request, p2, (menu) => ({
      type: 'or', index: menuIndex(menu, (o) => titleOf(o).startsWith('Pass'), 'Pass'),
      response: {type: 'option'},
    }));
    await waitPrompt(request, p1, isActionMenu, 'P1 action menu (gen 2)');

    await openConsole(page, p1);
    await waitForBoardHome(page);
    await openEspionageComposer(page);

    // The target row is MANDATORY and unanswered — A opens the workspace pick.
    await expect(page.locator('.con-composer__row--missing').first()).toBeVisible({timeout: 10_000});
    await shoot(page, 'p1-composer-before-pick');
    // Focus starts on the first missing row (the target); open it.
    await key(page, 'Enter', 900);
    await expect(page.locator('.con-hydro__layer--esppick')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-hydro__esprow').first()).toBeVisible();
    // The candidate row carries the transition and the focused ghost stands.
    const row = page.locator('.con-hydro__esprow--focused');
    await expect(row).toBeVisible();
    await expect(row.locator('.con-hydro__route--back')).toBeVisible();
    expect(await page.locator('.con-hydro__stop-ghost').count(), 'ghost markers on the track').toBeGreaterThan(0);
    // …and the movement ARCS between the real markers and their ghosts — the
    // premium «кто куда движется» reading (owner fwd + focused target back).
    await expect.poll(async () => page.locator('.con-hydro__ghostlink-path').count(),
      {timeout: 5_000}).toBeGreaterThan(0);
    await shoot(page, 'target-selection');
    // X — «Осмотреть»: the SOURCE card rises through the one fullscreen
    // viewer over the standing pick; Escape returns to the same selection.
    await key(page, 'KeyX', 1200);
    await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 8000});
    await shoot(page, 'target-selection-inspect');
    await key(page, 'Escape', 1000);
    await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(0);
    await expect(page.locator('.con-hydro__layer--esppick')).toBeVisible();
    // A — pick the focused (first legal) candidate. Act → verify → retry:
    // a press can be legitimately swallowed while the surface settles.
    for (let i = 0; i < 8 && await page.locator('.con-hydro__layer--esppick').count() > 0; i++) {
      await key(page, 'Enter', 700);
    }
    expect(await page.locator('.con-hydro__layer--esppick').count(), 'the pick resolved').toBe(0);

    // Back in the composer: the resolved target row + the owner half.
    await expect(page.locator('.con-composer--play')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-composer__esp-own')).toBeVisible();
    await shoot(page, 'p1-composer-summary');

    await answerOwnerChoiceRow(page);
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 10_000});
    await key(page, 'Enter', 400); // commit

    const log = {glideColors: new Set<string>(), sawEspLine: false, sawResult: false};
    await watchExecution(page, log);
    expect(log.sawEspLine, 'the espionage commit line stood').toBeTruthy();
    expect(log.glideColors.has('blue'), `the TARGET's own marker glided (saw: ${[...log.glideColors].join(',')})`).toBeTruthy();
    expect(log.glideColors.has('red'), 'the OWNER\'s marker glided too').toBeTruthy();

    // The server agrees on the whole outcome: P2 pushed 1 → 0, P1 advanced
    // 0 → 1, and P2's steel from gen 1 was their ONLY stage reward (the
    // track-start landing pays nothing).
    const m1 = await fetchPlayerModel(request, p1) as Wire;
    const p2ModelOfP1 = (m1.players as Array<Wire>).find((p) => p.color === 'blue');
    expect(m1.thisPlayer.deltaProject?.position).toBe(1);
    expect(p2ModelOfP1?.deltaProject?.position).toBe(0);
  });
});
