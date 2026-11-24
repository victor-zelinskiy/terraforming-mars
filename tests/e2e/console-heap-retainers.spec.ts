import {test, expect, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import {answerPrompt, cinematicBeat, fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, soloGameConfig} from './consoleStart';
import {detachedCensus, retainersOf} from './heapRetainers';

/**
 * WHO KEEPS A DETACHED TREE ALIVE — the retainers of what the soak's census names (FREEZE ZERO, stage 6 — time;
 * docs/claude/console/freeze-zero/PLAN.md § 8).
 *
 * The soak (`console-autopilot.spec.ts`, `TM_E2E_AUTOPILOT_IDLE_MIN`) reads, generation by generation, the trees that
 * are detached from the document and still held by a script — and it named two that GROW with use: the hand
 * (`div.con-hand`, a tree a visit) and the fullscreen card viewer (`dialog.card-zoom-dialog`). The census says WHAT is
 * kept; this says BY WHOM: the seat's hand is opened, a card inspected, both closed — several times — and the page's
 * heap is read (a snapshot, after a collection of garbage): for every detached tree's root the shortest chain of
 * strong references from the collector's roots, printed link by link (`heapRetainers.ts`).
 *
 * A measurement: it asserts nothing of the product and files what it read (`heap-retainers.txt`, the same on stdout).
 *
 * OPT-IN: `TM_E2E_HEAP_RETAINERS=1 npx playwright test tests/e2e/console-heap-retainers.spec.ts` ·
 * `TM_E2E_HEAP_RETAINERS_VISITS` (default 4).
 */
const ENABLED = process.env.TM_E2E_HEAP_RETAINERS === '1';
const VISITS = Number(process.env.TM_E2E_HEAP_RETAINERS_VISITS ?? 4);

type Wire = {
  game: {phase: string, generation: number},
  waitingFor?: {type: string, promptId?: number, buyMode?: boolean, cards?: Array<{name: string}>, options?: Array<{type: string, warnings?: Array<string>}>},
};

/** The seat is played `n` generations over the API (every research bought whole, every turn passed) — a hand worth opening. */
async function playGenerationsOverApi(request: APIRequestContext, viewer: string, n: number): Promise<void> {
  for (let round = 0; round < n * 40 + 40; round++) {
    const model = await fetchPlayerModel(request, viewer) as unknown as Wire;
    const wf = model.waitingFor;
    const menu = wf?.type === 'or' && (wf.options ?? []).some((o) => o.type === 'option' && o.warnings?.includes('pass') === true);
    if (model.game.phase === 'end' || (model.game.generation > n && menu)) {
      return;
    }
    if (wf === undefined) {
      await expect.poll(async () => {
        const next = await fetchPlayerModel(request, viewer) as unknown as Wire;
        return next.waitingFor !== undefined || next.game.phase === 'end';
      }, {timeout: 120_000, message: 'the table comes back to the seat'}).toBe(true);
      continue;
    }
    if (menu) {
      const pass = (wf.options ?? []).findIndex((o) => o.type === 'option' && o.warnings?.includes('pass') === true);
      await sendPlayerInput(request, viewer, {type: 'or', index: pass, response: {type: 'option'}, promptId: wf.promptId} as never);
      continue;
    }
    if (wf.type === 'card' && wf.buyMode === true) {
      const whole = await request.post(`/player/input?id=${viewer}`, {data: {type: 'card', cards: (wf.cards ?? []).map((c) => c.name), promptId: wf.promptId}});
      if (whole.ok()) {
        continue;
      }
    }
    await sendPlayerInput(request, viewer, {...answerPrompt(wf as never, {}), promptId: wf.promptId} as never);
  }
  throw new Error(`the seat did not reach generation ${n + 1} over the API`);
}

test.describe('WHO KEEPS A DETACHED TREE ALIVE', () => {
  test.skip(!ENABLED, 'opt-in: TM_E2E_HEAP_RETAINERS=1 (a measurement — it is read, not asserted)');

  test('the hand and the card viewer, opened and closed: the retainers of every tree left detached', async ({page, request}) => {
    test.setTimeout(20 * 60_000);
    const created = await request.post('/api/creategame', {data: soloGameConfig({
      expansions: {promo: true, venus: true, colonies: true, prelude: true, turmoilRedux: true}, board: 'tharsis', seed: 0.4242, testMode: false, draftVariant: false,
      automa: {difficulty: 'normal', secondShift: false, extraCorporations: false},
    })});
    expect(created.ok(), `create-game refused the table: ${created.status()}`).toBeTruthy();
    const {players} = await created.json() as {players: Array<{id: string, name: string}>};
    const viewer = (players.find((p) => !/marsbot/i.test(p.name)) ?? players[0]).id;
    await seedGameOverApi(request, viewer, {buy: 4});
    await playGenerationsOverApi(request, viewer, 3);
    await openConsole(page, viewer);
    await cinematicBeat(page, 6_000, 'the turn settles — its arrival is not a visit of the hand');

    const tap = async (key: string): Promise<void> => {
      await page.keyboard.press(key);
      await cinematicBeat(page, 1_500, 'the surface the press opened or closed comes to rest');
    };
    for (let visit = 0; visit < VISITS; visit++) {
      await tap('Period'); // the action wheel
      await tap('Enter'); //  its centre: the hand
      await tap('KeyX'); //   the focused card, inspected: the fullscreen viewer
      await tap('Escape'); // the viewer closes
      await tap('Escape'); // the hand closes
      await tap('Escape'); // (a wheel left open, if the centre was not the hand)
    }
    await cinematicBeat(page, 4_000, 'every leave has played out — what is detached now is kept');

    const cdp = await page.context().newCDPSession(page);
    // THE SNAPSHOT FIRST, THE CENSUS AFTER: the census pins every node it reports in the session's own agent, and a
    // node pinned by the instrument reads as kept. (Its first run read exactly that: the viewer's dialog «held» by
    // `blink::InspectorDOMAgent`.)
    const retainers = await retainersOf(cdp, /card-zoom-dialog|^<div class="con-hand[ "]|^<div class="con-composer[ "]|^<div class="con-cardactions[ "]|con-played-hero__proxy|^<div class="con-info[ "]|^<div class="con-stdp[ "]/);
    const census = await detachedCensus(cdp);
    const report = [`THE CENSUS after ${VISITS} visit(s): ${census.roots} tree(s), ${census.nodes} node(s): ${census.top}`, ...retainers];
    const text = report.join('\n');
    console.log(`[heap-retainers]\n${text}`);
    fs.writeFileSync(test.info().outputPath('heap-retainers.txt'), text);
    await cdp.detach();
    expect(page.isClosed(), 'the page survived the reading').toBe(false);
  });
});
