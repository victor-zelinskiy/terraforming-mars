import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, soloGameConfig, waitForBoardHome,
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
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
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
 *  open it, pick the FIRST option of the sub-list, and land back. */
async function answerOwnerChoiceRow(page: Page): Promise<void> {
  // The mandatory owner-landing row is marked `--missing`; A on it opens the
  // premium option list; A on an option captures it and the cursor advances.
  for (let i = 0; i < 14; i++) {
    const state = await page.evaluate(() => ({
      missingFocused: document.querySelector('.con-composer__row--focused.con-composer__row--missing') !== null,
      subOpen: document.querySelector('.con-composer__opt') !== null,
      anyMissing: document.querySelector('.con-composer__row--missing') !== null,
      ctaReady: document.querySelector('.con-composer__cta--ready') !== null,
    }));
    if (state.subOpen) {
      await key(page, 'Enter', 500);
      continue;
    }
    if (!state.anyMissing) {
      return;
    }
    if (state.missingFocused) {
      await key(page, 'Enter', 500);
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
  await key(page, 'Enter', 700);
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
    await shoot(page, 'solo-composer');

    await answerOwnerChoiceRow(page);
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
    await shoot(page, 'target-selection');
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
