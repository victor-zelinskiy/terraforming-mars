import {test, expect, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import {answerPrompt, cinematicBeat, fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, soloGameConfig} from './consoleStart';
import {ReactiveCensus, detachedCensus, reactiveCensus} from './heapRetainers';

/**
 * WHICH COMPUTEDS STAY ALIVE WITH USE — the reactive census of a tour of the console's screens (FREEZE ZERO, stage 6 —
 * time; docs/claude/console/freeze-zero/PLAN.md § 8, the leak class of Vue 3.6).
 *
 * THE CLASS. In Vue 3.6 a computed evaluated by plain script — a press handler, a timer, a late callback: no effect
 * running and no effect scope — links itself into its dependencies' subscriber lists and nothing ever releases it
 * (`ComputedRefImpl.get value`: the reader is linked when there is one, a stopped scope unlinks, and with NEITHER the
 * getter just returns). Every dependency that outlives the component then keeps the computed, its closure, the
 * component and its tree. The fullscreen card viewer kept a whole dialog a visit that way.
 *
 * THE MEASURE. The same tour of screens is walked from the board home several times — it opens and closes surfaces
 * and answers nothing, so the game does not move. After the warm-up tours the heap is read (`reactiveCensus`): every
 * computed alive, and of them those that hold dependencies with no subscriber of their own, by where the getter was
 * written. Then the tour is walked again, `TOURS` times, and the heap is read once more. A getter whose count GREW is
 * a computed a visit leaves behind — the worklist, by bundle position (`#script:line:column`; `symbolize` it off the
 * build's maps).
 *
 * A measurement: it asserts nothing of the product and files what it read (`reactive-census.txt`, the same on stdout).
 *
 * OPT-IN: `TM_E2E_REACTIVE_CENSUS=1 npx playwright test tests/e2e/console-reactive-census.spec.ts` ·
 * `TM_E2E_REACTIVE_CENSUS_TOURS` (default 4).
 */
const ENABLED = process.env.TM_E2E_REACTIVE_CENSUS === '1';
const TOURS = Number(process.env.TM_E2E_REACTIVE_CENSUS_TOURS ?? 4);

type Wire = {
  game: {phase: string, generation: number},
  waitingFor?: {type: string, promptId?: number, buyMode?: boolean, cards?: Array<{name: string}>, options?: Array<{type: string, warnings?: Array<string>}>},
};

/** The seat is played `n` generations over the API (every research bought whole, every turn passed) — a table worth touring. */
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

/**
 * THE TOUR — every stop a surface opened from the board home and closed again; nothing on it answers the server
 * (a wheel's centre and its four directions open workspaces; A is pressed on a wheel only).
 */
const TOUR: ReadonlyArray<{stop: string, keys: ReadonlyArray<string>}> = [
  {stop: 'the action wheel\'s centre (the hand) + a card inspected', keys: ['Period', 'Enter', 'KeyX', 'Escape', 'ArrowRight', 'ArrowLeft']},
  {stop: 'the action wheel · right', keys: ['Period', 'ArrowRight', 'ArrowDown', 'ArrowUp']},
  {stop: 'the action wheel · left', keys: ['Period', 'ArrowLeft', 'ArrowDown', 'ArrowUp']},
  {stop: 'the action wheel · up', keys: ['Period', 'ArrowUp', 'ArrowRight', 'ArrowLeft']},
  {stop: 'the action wheel · down', keys: ['Period', 'ArrowDown', 'ArrowRight', 'ArrowLeft']},
  {stop: 'the basic wheel\'s centre (standard projects)', keys: ['Comma', 'Enter', 'ArrowDown', 'ArrowUp']},
  {stop: 'the basic wheel · right', keys: ['Comma', 'ArrowRight', 'ArrowDown', 'ArrowUp']},
  {stop: 'the basic wheel · left', keys: ['Comma', 'ArrowLeft', 'ArrowDown', 'ArrowUp']},
  {stop: 'the basic wheel · up', keys: ['Comma', 'ArrowUp', 'ArrowRight', 'ArrowLeft']},
  {stop: 'the basic wheel · down', keys: ['Comma', 'ArrowDown', 'ArrowRight', 'ArrowLeft']},
  {stop: 'the information screen', keys: ['KeyY', 'KeyE', 'KeyE', 'KeyQ']},
  {stop: 'the journal', keys: ['KeyR', 'ArrowDown', 'ArrowUp']},
  {stop: 'the played cards', keys: ['KeyX', 'ArrowRight', 'KeyX', 'Escape']},
];

function grew(before: Map<string, number>, after: Map<string, number>): Array<string> {
  return [...after]
    .map(([where, n]) => ({where, n, was: before.get(where) ?? 0}))
    .filter((row) => row.n > row.was)
    .sort((a, b) => (b.n - b.was) - (a.n - a.was))
    .map((row) => `  +${row.n - row.was}  (${row.was} → ${row.n})  ${row.where}`);
}

test.describe('WHICH COMPUTEDS STAY ALIVE WITH USE', () => {
  test.skip(!ENABLED, 'opt-in: TM_E2E_REACTIVE_CENSUS=1 (a measurement — it is read, not asserted)');

  test('a tour of the console\'s screens, walked again and again: the computeds a visit leaves behind', async ({page, request}) => {
    test.setTimeout(40 * 60_000);
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
    await cinematicBeat(page, 6_000, 'the turn settles — its arrival is no stop of the tour');

    const bar = async (): Promise<string> => ((await page.locator('.con-cmdbar').textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const tap = async (key: string): Promise<void> => {
      await page.keyboard.press(key);
      await cinematicBeat(page, 1_200, 'the surface the press opened, moved or closed comes to rest');
    };
    const stops: Array<string> = [];
    const tour = async (record: boolean): Promise<void> => {
      for (const {stop, keys} of TOUR) {
        for (const key of keys) {
          await tap(key);
        }
        if (record) {
          stops.push(`  ${stop}: «${(await bar()).slice(0, 90)}»`);
        }
        // HOME AGAIN: B until the board home's bar stands (a stop is closed by as many B as it is deep).
        for (let back = 0; back < 5 && !/Базовые/.test(await bar()); back++) {
          await tap('Escape');
        }
      }
      await cinematicBeat(page, 3_000, 'every leave of the tour has played out');
    };

    const cdp = await page.context().newCDPSession(page);
    const read = async (): Promise<ReactiveCensus> => reactiveCensus(cdp);
    await tour(true); //  the first tour mounts what is mounted once
    await tour(false); // …and the second brings every cache to its level
    const before = await read();
    for (let n = 0; n < TOURS; n++) {
      await tour(false);
    }
    const after = await read();
    const detached = await detachedCensus(cdp);

    const report = [
      `THE REACTIVE CENSUS — ${TOURS} tour(s) of ${TOUR.length} stop(s) between the two readings`,
      `computeds ${before.computeds} → ${after.computeds} (${after.computeds - before.computeds >= 0 ? '+' : ''}${after.computeds - before.computeds}) · effects ${before.effects} → ${after.effects} (${after.effects - before.effects >= 0 ? '+' : ''}${after.effects - before.effects})`,
      `unwatched computeds holding dependencies: ${[...before.unwatched.values()].reduce((a, b) => a + b, 0)} → ${[...after.unwatched.values()].reduce((a, b) => a + b, 0)} in ${after.unwatched.size} getter(s)`,
      `detached trees at the end: ${detached.roots} tree(s), ${detached.nodes} node(s): ${detached.top}`,
      'WHERE THE TOUR STOOD (the bar at each stop of the first tour):',
      ...stops,
      'THE GETTERS WHOSE UNWATCHED COMPUTEDS GREW (a visit leaves them behind):',
      ...grew(before.unwatched, after.unwatched),
      'THE GETTERS WHOSE COMPUTEDS GREW AT ALL:',
      ...grew(before.byGetter, after.byGetter),
      'EVERY GETTER WITH AN UNWATCHED COMPUTED HOLDING DEPENDENCIES AT THE END (the standing ones — one per mounted owner is no leak):',
      ...[...after.unwatched].sort((a, b) => b[1] - a[1]).map(([where, n]) => `  ${n}  ${where}`),
    ];
    const text = report.join('\n');
    console.log(`[reactive-census]\n${text}`);
    fs.writeFileSync(test.info().outputPath('reactive-census.txt'), text);
    await cdp.detach();
    expect(page.isClosed(), 'the page survived the reading').toBe(false);
  });
});
