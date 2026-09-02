import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fetchPlayerModel, openCardActions, openConsole, sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * DP11 — MODULAR FLOODGATES, the premium vertical slice, live (2 players):
 *
 *  Gen 1 (API): P1 plays the card and takes variant A — 1 steel lands ON the
 *  card (never the player board). Both pass; the between-generations buys are
 *  declined.
 *
 *  Gen 2 (console): P1 drives the WHOLE deploy from the UI — ДЕЙСТВИЯ КАРТ →
 *  the composer offers BOTH variants → variant B selected → the target
 *  pre-select hands the screen to the REAL Hydronetwork workspace
 *  (blockade-pick layer: candidate rows + the cursor's GHOST GATE on the
 *  cell in front of the focused marker) → A picks P2 → back in the SAME
 *  composer with the filled summary → the CTA commits → the EXECUTION
 *  surface re-enters the Hydronetwork (the fresh ACTIVE gate standing in
 *  front of P2's marker + the receipt) → «Готово» → board. The server agrees:
 *  1 steel left the card, P2 carries the blockade status, and P2's manual
 *  advance is withheld while DP08-style reads stay legal.
 *
 *  The VICTIM's console (a second page) receives exactly one hostile
 *  notification carrying the worded blockade band.
 *
 * Screenshots → `screenshots/modular-floodgates/`.
 */

const OUT = path.resolve('screenshots', 'modular-floodgates');
const CARD = 'Modular Floodgates';

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
    graphene: 0, kuiperAsteroids: 0, floodgateSteel: 0, corruption: 0,
  };
}

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

async function answerInitialCards(request: APIRequestContext, id: string, buys: ReadonlyArray<string>): Promise<void> {
  const model = await waitPrompt(request, id, (p) => p?.type === 'initialCards', 'initial cards');
  const wf = model.waitingFor as Wire;
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

async function onMenu(request: APIRequestContext, id: string, pick: (menu: Wire) => Wire): Promise<void> {
  const model = await waitPrompt(request, id, isActionMenu, 'action menu');
  await sendPlayerInput(request, id, pick(model.waitingFor as Wire) as never);
}

function menuIndex(menu: Wire, match: (o: Wire) => boolean, label: string): number {
  const at = (menu.options ?? []).findIndex(match);
  expect(at, `${label} is offered (got: ${(menu.options ?? []).map((o: Wire) => titleOf(o)).join(' | ')})`).toBeGreaterThanOrEqual(0);
  return at;
}

async function floodgatesState(request: APIRequestContext, id: string): Promise<{stored: number, steel: number, blockade: Wire | undefined, position: number}> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const p = model.thisPlayer ?? {};
  const card = ((p.tableau ?? []) as Array<Wire>).find((c) => c.name === CARD);
  return {
    stored: Number(card?.resources ?? 0),
    steel: Number(p.steel ?? 0),
    blockade: p.deltaProject?.blockade as Wire | undefined,
    position: Number(p.deltaProject?.position ?? 0),
  };
}

test.describe('Modular Floodgates (DP11) · fhd', () => {
  test.setTimeout(480_000);
  test.use({viewport: {width: 1920, height: 1080}});

  test('variant A stores steel ON the card; variant B deploys the blockade through the Hydronetwork; the victim is notified', async ({page, context, request}) => {
    // ── create until P1's deal offers DP11 ──
    let p1 = '';
    let p2 = '';
    for (let attempt = 0; attempt < 60 && p1 === ''; attempt++) {
      const cfg = soloGameConfig({
        players: [
          {name: 'Engineer', color: 'red', beginner: false, handicap: 0, first: true},
          {name: 'Rival', color: 'blue', beginner: false, handicap: 0, first: false},
        ],
        expansions: {deltaProject: true},
        customProjectCards: [CARD],
        customCorporationsList: ['ThorGate', 'CrediCor'],
        seed: 0.31 + attempt * 0.013,
      });
      const created = await request.post('/api/creategame', {data: cfg});
      expect(created.ok(), 'create-game accepted').toBeTruthy();
      const {players} = await created.json() as {players: Array<{id: string, name: string}>};
      const [a, b] = players;
      const pv = await (await request.get(`/api/player?id=${a.id}`)).json() as Wire;
      const deal = ((pv.waitingFor?.options ?? []) as Array<Wire>)
        .flatMap((o) => ((o.cards ?? []) as Array<Wire>).map((c) => String(c.name)));
      if (deal.includes(CARD)) {
        p1 = a.id;
        p2 = b.id;
      }
    }
    expect(p1, 'a deal offering DP11 to P1').not.toBe('');

    await answerInitialCards(request, p1, [CARD]);
    await answerInitialCards(request, p2, []);
    await Promise.all([
      drainPregame(request, p1, 'menu'),
      drainPregame(request, p2, 'idle'),
    ]);

    // ── Gen 1 over the API: play the card, take variant A, both pass. ──
    await onMenu(request, p1, (menu) => {
      const at = menuIndex(menu, (o) => titleOf(o) === 'Play project card', 'play project card');
      const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === CARD);
      expect(offered, `${CARD} is in hand`).toBeDefined();
      return {type: 'or', index: at, response: {type: 'projectCard', card: CARD, payment: payMc(offered.calculatedCost ?? 7)}};
    });
    // Variant A via the blue-action door — the lone live variant collapses,
    // so the pick IS the whole activation.
    await onMenu(request, p1, (menu) => {
      const at = menuIndex(menu, (o) => titleOf(o) === 'Perform an action from a played card', 'the blue-action door');
      return {type: 'or', index: at, response: {type: 'card', cards: [CARD]}};
    });
    const afterA = await floodgatesState(request, p1);
    expect(afterA.stored, 'variant A stored the steel ON the card').toBe(1);

    // P1's two actions (the play + the activation) hand the turn to P2 —
    // P2 passes, P1's menu returns, P1 passes, the generation ends.
    await onMenu(request, p2, (menu) =>
      ({type: 'or', index: menuIndex(menu, (o) => /Pass/.test(titleOf(o)), 'pass'), response: {type: 'option'}}));
    await onMenu(request, p1, (menu) =>
      ({type: 'or', index: menuIndex(menu, (o) => /Pass/.test(titleOf(o)), 'pass'), response: {type: 'option'}}));
    // The between-generations research buys — both decline.
    for (const id of [p2, p1]) {
      await waitPrompt(request, id, (p) => p?.type === 'card', 'research buy');
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never);
    }
    // Gen 2's first player is P2 — they pass, giving P1 the console turn.
    await onMenu(request, p2, (menu) =>
      ({type: 'or', index: menuIndex(menu, (o) => /Pass/.test(titleOf(o)), 'pass'), response: {type: 'option'}}));
    await waitPrompt(request, p1, isActionMenu, 'P1 on turn in gen 2');

    // ── The console drive: ДЕЙСТВИЯ КАРТ → variant B → the target pick. ──
    // The VICTIM's console opens FIRST and stays open in the background: a
    // notification is delivered to a LIVE view (history is deliberately not
    // replayed as toasts on a later mount).
    const victimPage = await context.newPage();
    await openConsole(victimPage, p2, '');
    await openConsole(page, p1, '');
    await waitForBoardHome(page, 40);
    await openCardActions(page);
    // The BROWSE GRID offers the two printed rows as two VARIANT TILES of the
    // one card («Вариант 1/2» + «или» join) — neither refused.
    const tiles = page.locator('.con-cardactions__tile');
    await expect(tiles, 'both variants stand as tiles').toHaveCount(2, {timeout: 10_000});
    expect(await page.locator('.con-cardactions__tile--rules').count(), 'no variant is rule-dead').toBe(0);
    await shoot(page, '01-two-variants');

    // Walk the grid until the DEPLOY variant (Option 2/2) is focused.
    const focusedVariant = () => page.evaluate(() =>
      (document.querySelector('.con-cardactions__detail-variant')?.textContent ?? '').replace(/\s+/g, ' ').trim());
    for (let i = 0; i < 8 && !(await focusedVariant()).includes('2 / 2'); i++) {
      await key(page, 'ArrowRight', 400);
    }
    expect(await focusedVariant(), 'the deploy variant is focused').toContain('2 / 2');

    // Open its composer — the target row is the mandatory pre-select.
    const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
    for (let i = 0; i < 4 && await stage.count() === 0; i++) {
      await key(page, 'Enter', 1200);
    }
    await expect(stage, 'the DP11 deploy composer').toHaveCount(1, {timeout: 8000});
    for (let i = 0; i < 10 && await page.locator('.con-hydro__layer--blockpick').count() === 0; i++) {
      const missingFocused = await page.locator('.con-composer__row--focused.con-composer__row--missing').count();
      if (missingFocused > 0) {
        await key(page, 'Enter', 1300);
      } else {
        await key(page, 'ArrowDown', 260);
      }
    }
    await page.waitForSelector('.con-hydro__layer--blockpick', {timeout: 10_000});
    // The projection surface: the candidate row + the cursor's GHOST GATE on
    // the cell in front of their marker — and NO movement grammar.
    await expect(page.locator('.con-hydro__esprow')).toHaveCount(1);
    await expect(page.locator('.con-hydro__gate--ghost')).toHaveCount(1);
    expect(await page.locator('.con-hydro__ghostlink-path').count(), 'no movement arc — nothing moves').toBe(0);
    await shoot(page, '02-target-pick');

    // A on the (focused) legal candidate returns the pick to the composer.
    await key(page, 'Enter', 1500);
    await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 10_000});
    await expect(stage, 'the composer came back').toHaveCount(1, {timeout: 8000});
    const summary = await page.evaluate(() => document.body.textContent ?? '');
    expect(summary, 'the summary names the blocked player').toContain('Rival');
    const before = await floodgatesState(request, p1);
    expect(before.stored, 'choosing spends nothing').toBe(1);
    await shoot(page, '03-configured');

    // ── COMMIT → the Hydronetwork EXECUTION surface with the ACTIVE gate. ──
    for (let i = 0; i < 6 && await page.locator('.con-hydro__layer--blockexec').count() === 0; i++) {
      await key(page, 'Enter', 1600);
    }
    await page.waitForSelector('.con-hydro__layer--blockexec', {timeout: 15_000});
    await expect(page.locator('.con-hydro__gate[data-hydro-gate="blue"]'), 'the standing gate carries the TARGET\'s identity')
      .toHaveCount(1, {timeout: 10_000});
    await shoot(page, '04-execution');

    const after = await floodgatesState(request, p1);
    expect(after.stored, 'exactly one module left the card').toBe(0);
    expect(after.steel, 'never the player board pool').toBe(before.steel);
    const victim = await fetchPlayerModel(request, p2) as Wire;
    expect(victim.thisPlayer?.deltaProject?.blockade?.by, 'the server-side status names the deployer').toBe('red');

    // «Готово» concludes the flow to the board.
    await key(page, 'Enter', 1500);
    await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 10_000});
    await shoot(page, '05-after');

    // ── The VICTIM's console (open since before the deploy): exactly one
    //    hostile band, worded. ──
    await victimPage.bringToFront();
    await expect(victimPage.locator('.con-notif__you--negative').first(), 'the victim\'s hostile band arrives')
      .toBeVisible({timeout: 45_000});
    const bandText = await victimPage.evaluate(() => document.querySelector('.con-notif')?.textContent ?? '');
    expect(bandText, 'the worded blockade loss').toMatch(/заблокировано|blocked/i);
    await shoot(victimPage, '06-victim-notification');
    await victimPage.close();

    // ── The blocked player's OWN advance is withheld — asserted on the
    //    TURN-INDEPENDENT projection (P2 already passed this generation, so
    //    no menu comes until the next one; the projection is exactly what
    //    must read 0 whatever the turn is). ──
    const blocked = await fetchPlayerModel(request, p2) as Wire;
    expect(blocked.thisPlayer?.potentialActions?.hydroAdvance, 'the blocked player\'s potential advance is 0').toBe(0);
    expect(blocked.thisPlayer?.canAdvanceDelta ?? false, 'no live advance either').toBe(false);
  });
});
