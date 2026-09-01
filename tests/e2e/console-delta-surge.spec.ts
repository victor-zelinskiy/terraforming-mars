import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * DELTA SURGE (DP07) — the ordered MULTI-REWARD traversal, live.
 *
 * The honest route: four tag cards + Delta Surge itself played over the API
 * (its immediate ocean answered over the API too), then ONE five-step advance
 * 0 → 5 committed through the UI. With the modifier in the tableau the move
 * pays EVERY crossed stage:
 *
 *  · PRE-SELECT: the Decision Rail holds TWO standing reward-choice decisions
 *    (stages 1 and 2), first-open seated; answering one hands the cursor on;
 *    the commit is gated until both are made (the CTA routes to the first
 *    open choice). The preview names the modifier's promise.
 *
 *  · THE SEQUENCE: after the commit the marker walks the cells IN ORDER —
 *    the traversal strip's done-count grows 0 → 4 monotonically, and the
 *    VIEWER's marker is never painted on the destination before the sequence
 *    reaches it (the visual cursor, not the server position).
 *
 *  · THE STOP: the crossed rewards pay per cell; the landing stage 5 deals
 *    its four cards ONCE and waits for the pick; the picks reach the hand,
 *    the result reads PER STAGE, and the server totals match every crossed
 *    reward (steel choice + heat production + M€ production + Ti production).
 *
 * Screenshots → `screenshots/delta-surge/`.
 */

const OUT = path.resolve('screenshots', 'delta-surge');

const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research'];
const ALL_CARDS = [...TAG_CARDS, 'Delta Surge'];

const CFG = soloGameConfig({
  players: [{name: 'SurgeProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.43,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Settle every intermediate prompt (a card's own ocean placement included)
 *  until the action menu stands. */
async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 30; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    if (prompt.type === 'space') {
      model = await sendPlayerInput(request, id,
        {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 22)},
  } as never);
}

async function serverState(request: APIRequestContext, id: string): Promise<Wire> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const p = model.thisPlayer ?? {};
  return {
    position: p.deltaProject?.position ?? 0,
    hand: (model.cardsInHand ?? []).length,
    steel: p.steel ?? 0,
    plants: p.plants ?? 0,
    heatProduction: p.heatProduction ?? 0,
    energyProduction: p.energyProduction ?? 0,
    megaCreditProduction: p.megacreditProduction ?? 0,
    titaniumProduction: p.titaniumProduction ?? 0,
  };
}

test.describe('Delta Surge — the ordered multi-reward traversal · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('two rail choices → one commit → the marker walks every cell → the stage-5 stop → per-stage result', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.43});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of ALL_CARDS) {
      await playCard(request, id, card);
    }
    // Settle the LAST play's follow-ups too (Delta Surge's own ocean) — the
    // loop above only settles them on the way to the NEXT card's menu.
    await toActionMenu(request, id);
    await openConsole(page, id, '');
    await waitForBoardHome(page, 25);

    // ── Open the Hydronetwork; RT jumps to the farthest legal stage (5). ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900); // RT — «К дальнему»
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'the farthest legal stage is 5').toBe('5');

    // ── THE PLAN: the modifier's promise named; the route cells lit as
    //    PAYING stops; TWO standing reward-choice decisions on the rail. ──
    const plan = await page.evaluate(() => ({
      paidNote: document.querySelector('.con-hydro__routenote--paid') !== null,
      paidCells: document.querySelectorAll('.con-hydro__stop--route-paid').length,
      railRows: document.querySelectorAll('.con-hydro__pickrow').length,
      focusedRow: document.querySelectorAll('.con-hydro__summary--focused').length,
    }));
    expect(plan.paidNote, 'the preview names the modifier').toBe(true);
    expect(plan.paidCells, 'crossed cells 1..4 light as paying stops').toBe(4);
    expect(plan.railRows, 'two reward-choice decisions stand on the rail').toBe(2);
    expect(plan.focusedRow, 'the FIRST open decision holds the seat').toBe(1);
    await shoot(page, '01-plan');

    // ── Resolve choice №1 (steel), the cursor hands on; №2 (heat prod). ──
    await press(page, 'Enter', 900); // open the stage-1 choice step
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'Enter', 900); // pick option 0 (2 steel) → return to the rail
    const afterFirst = await page.evaluate(() => ({
      ticks: document.querySelectorAll('.con-hydro__pickrow .con-hydro__bonus-tick').length,
      choiceOpen: document.querySelector('.con-hydro__layer--choice') !== null,
    }));
    expect(afterFirst.choiceOpen, 'the selector returned to the rail').toBe(false);
    expect(afterFirst.ticks, 'choice №1 resolved').toBe(1);
    await press(page, 'Enter', 900); // the seat moved ON — open choice №2
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'ArrowRight', 450);
    await press(page, 'Enter', 900); // pick option 1 (+1 heat production)
    expect(await page.locator('.con-hydro__pickrow .con-hydro__bonus-tick').count(),
      'both choices resolved').toBe(2);
    await shoot(page, '02-choices-made');

    // ── ARM the sequence probes BEFORE the commit: the traversal strip's
    //    done-count must grow MONOTONICALLY (never a teleport), and the
    //    viewer's marker may never stand past the strip's own cursor. ──
    await page.evaluate(() => {
      const w = window as unknown as {
        __doneSeq?: Array<number>, __viewerCells?: Array<number>,
        __deals?: number, __probeStop?: () => void,
      };
      w.__doneSeq = [];
      w.__viewerCells = [];
      w.__deals = 0;
      const seenProxies = new WeakSet<Element>();
      const sample = () => {
        const done = document.querySelectorAll('.con-hydro__travchip--done').length;
        const seq = w.__doneSeq!;
        if (seq.length === 0 || seq[seq.length - 1] !== done) {
          seq.push(done);
        }
        const viewer = document.querySelector('.con-hydro__stop-marker--viewer');
        const cellAttr = viewer?.closest('[data-hydro-marker]')?.getAttribute('data-hydro-marker');
        if (cellAttr !== undefined && cellAttr !== null) {
          const cell = Number(cellAttr);
          const cells = w.__viewerCells!;
          if (cells.length === 0 || cells[cells.length - 1] !== cell) {
            cells.push(cell);
          }
        }
        document.querySelectorAll('.con-deal-proxy').forEach((el) => {
          if (!seenProxies.has(el)) {
            seenProxies.add(el);
            w.__deals = (w.__deals ?? 0) + 1;
          }
        });
      };
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      const iv = setInterval(sample, 80);
      w.__probeStop = () => {
        mo.disconnect();
        clearInterval(iv);
      };
    });

    // ── COMMIT: one press (all mandatory decisions made → the CTA). ──
    await press(page, 'Enter', 1500);
    // The stage-5 deck pick arrives only after the marker has walked the
    // whole path and every crossed reward has flown.
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 60_000});
    await page.waitForTimeout(900);
    await shoot(page, '03-stage5-stop');

    const walk = await page.evaluate(() => {
      const w = window as unknown as {__doneSeq?: Array<number>, __viewerCells?: Array<number>, __deals?: number};
      return {doneSeq: w.__doneSeq ?? [], viewerCells: w.__viewerCells ?? [], deals: w.__deals ?? 0};
    });
    // The strip's done-count grows one cell at a time — the ordered walk.
    expect(walk.doneSeq.length, `the walk was sampled (${walk.doneSeq.join(',')})`).toBeGreaterThan(2);
    for (let i = 1; i < walk.doneSeq.length; i++) {
      expect(walk.doneSeq[i], `monotone at ${i} (${walk.doneSeq.join(',')})`).toBeGreaterThanOrEqual(walk.doneSeq[i - 1]);
      expect(walk.doneSeq[i] - walk.doneSeq[i - 1], 'one cell at a time').toBeLessThanOrEqual(1);
    }
    expect(Math.max(...walk.doneSeq), 'all four crossed cells completed').toBeGreaterThanOrEqual(4);
    // The VIEWER's marker walked THROUGH the cells — it never appeared on the
    // destination before the sequence reached it.
    expect(walk.viewerCells.length, `viewer cells sampled (${walk.viewerCells.join(',')})`).toBeGreaterThan(1);
    for (let i = 1; i < walk.viewerCells.length; i++) {
      expect(walk.viewerCells[i], `the marker only ever moves FORWARD (${walk.viewerCells.join(',')})`)
        .toBeGreaterThanOrEqual(walk.viewerCells[i - 1]);
    }
    expect(walk.viewerCells[0], 'the walk began at the start, not the destination').toBeLessThan(5);
    expect(walk.deals, 'the stage-5 batch dealt (proxies flew)').toBeGreaterThan(0);

    // The crossed rewards are already on the server (response 1), and the
    // panel showed them per touchdown: steel choice + heat prod + M€ prod +
    // titanium prod. The marker stands on 5.
    const mid = await serverState(request, id);
    expect(mid.position).toBe(5);
    expect(mid.steel, 'stage 1: the chosen 2 steel').toBeGreaterThanOrEqual(2);
    expect(mid.heatProduction, 'stage 2: the chosen +1 heat production').toBeGreaterThanOrEqual(1);
    expect(mid.megaCreditProduction, 'stage 3: +2 M€ production').toBeGreaterThanOrEqual(2);
    expect(mid.titaniumProduction, 'stage 4: +1 titanium production').toBeGreaterThanOrEqual(1);

    // ── THE STOP: keep 2 of the 4 dealt cards; the traversal then finishes
    //    (stage 5 is the destination) and the result reads PER STAGE. ──
    const handBefore = mid.hand;
    await press(page, 'Enter', 600);
    for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
      await press(page, 'ArrowRight', 450);
      await press(page, 'Enter', 600);
    }
    expect(await page.locator('.con-cards__slot--picked').count(), 'two picks held').toBe(2);
    await press(page, 'Period', 2500); // RT — «Подтвердить»
    await expect.poll(async () => (await serverState(request, id)).hand,
      {timeout: 30_000, message: 'the two picks reached the hand'}).toBe(handBefore + 2);

    // The per-stage result: five rows (stages 1..5), each named.
    await page.waitForSelector('.con-hydro__result-stages', {timeout: 30_000});
    const result = await page.evaluate(() => ({
      rows: document.querySelectorAll('.con-hydro__result-stagerow').length,
      excl: document.querySelectorAll('.con-hydro__result-stagerow--excl').length,
    }));
    expect(result.rows, 'five stages, one row each').toBe(5);
    expect(result.excl, 'nothing excluded on this path').toBe(0);
    await page.evaluate(() => (window as unknown as {__probeStop?: () => void}).__probeStop?.());
    await shoot(page, '04-result');

    // ── THE TRACK'S OWN HISTORY — a crossing that PAID is not a miss. ──────
    //
    // The stop list held landings only, so under the modifier the track marked
    // every stage it had just paid the player for as «Прошёл мимо — без
    // награды»: the ↷ glyph on four consecutive cells the player had, in the
    // very same move, been given steel, heat production, M€ production and
    // titanium production for.
    // A finished flow LEAVES (it never folds back to its own browse layer), so
    // the track is re-opened the way the player would: the wheel, then the
    // Hydronetwork — the same route this spec used at the start.
    await press(page, 'Enter', 1600); // A — end the result, back to the board
    await waitForBoardHome(page, 25);
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro__stop', {timeout: 20_000});
    await page.waitForTimeout(900);
    // THE CURRENT TRACK-HISTORY CONTRACT (the cells carry only the player
    // markers; «who and what happened here» is READING and lives in the
    // focused stage's ROSTER — the per-cell ✓/⇢/↷ badges and the trail row
    // were tried on the rail and deliberately removed): walk the cursor onto
    // a stage the traversal PAID IN PASSING and read the roster's own
    // «crossed» status for the viewer.
    let sawCrossed = false;
    for (let i = 0; i < 8 && !sawCrossed; i++) {
      const s = await page.evaluate(() => ({
        selected: document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '',
        crossed: document.querySelector('.con-hydro__roster-row--viewer .con-hydro__roster-state--crossed') !== null,
      }));
      if (s.crossed && ['1', '2', '3', '4'].includes(s.selected)) {
        sawCrossed = true;
        break;
      }
      await press(page, s.selected === '1' ? 'ArrowRight' : 'ArrowLeft', 900);
    }
    expect(sawCrossed, 'a stage paid in passing reads «crossed» in the viewer\'s roster row').toBeTruthy();
    await shoot(page, '05-track-history');
  });
});
