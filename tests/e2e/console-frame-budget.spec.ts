import {test, expect, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import {answerPrompt, cinematicBeat, fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, soloGameConfig} from './consoleStart';
import {frameReading, installFrameEars, markFrameReading, PressReading} from './frameBudgetEars';

/**
 * THE FRAME BUDGET OF A PRESS — what the frame of each everyday press costs, and WHO made it cost that (FREEZE ZERO,
 * stage 6 — «frame budgets of the key scenes on the box»; docs/claude/console/freeze-zero/PLAN.md § 8).
 *
 * The whole games on the box named it (2026-11-24: 65 `[long-frame]` lines in 35 games of 70, 0.5 – 0.94 s each, «a
 * press waited in it», four fifths of every one a FORCED LAYOUT inside the press's own script — ↓ on the basic wheel,
 * A on the home's «Вернуться к заседанию», B on a confirm) — and could not say more: the product's line speaks only of
 * frames over half a second and names the key bridge's listener, never the read that forced the layout.
 *
 * This walks the everyday presses of the board home at the viewer's first turn, several times each, and for every
 * press reads from the page itself:
 *   · the longest animation frame the press made (the Long Animation Frames API — every frame over 50 ms), its script
 *     and the style / layout its scripts FORCED;
 *   · every layout-forcing read made in that window (the rect methods, the offset / client / scroll getters),
 *     how many and how long — and the slowest with their stacks (the first read after a write pays for the whole
 *     recalculation: its stack is who asked);
 *   · what was written onto the ROOTS in that window (a class flipped on `html`, `body`, the shell's root restyles the
 *     whole tree — R16).
 * It asserts nothing of a duration — a number of one machine is not a law (tests.md) — and files what it read
 * (`frame-budget.json`, one line per scene on stdout): the budget is read on a QUIET box, the stacks on any.
 *
 * THE MIDDLE OF A GAME (`TM_E2E_FRAME_BUDGET_GENERATIONS=<n>`): a press of the first turn is cheap — the same walk
 * read there on a loaded box made no frame over 118 ms — and the games named theirs ten minutes in: the cost is the
 * page's SIZE (the hand that grew, the board that filled). So the seat is first played `n` generations over the API —
 * every research bought whole, every turn passed, MarsBot filling the board — and the walk is read on that page.
 *
 * OPT-IN: `TM_E2E_FRAME_BUDGET=1 npx playwright test tests/e2e/console-frame-budget.spec.ts` · `TM_E2E_FRAME_BUDGET_REPEATS`
 * (default 4) · `TM_E2E_FRAME_BUDGET_GENERATIONS` (default 0 — the first turn).
 */
const ENABLED = process.env.TM_E2E_FRAME_BUDGET === '1';
const REPEATS = Number(process.env.TM_E2E_FRAME_BUDGET_REPEATS ?? 4);
const GENERATIONS = Number(process.env.TM_E2E_FRAME_BUDGET_GENERATIONS ?? 0);

type Wire = {
  game: {phase: string, generation: number},
  waitingFor?: {type: string, promptId?: number, buyMode?: boolean, cards?: Array<{name: string}>, options?: Array<{type: string, warnings?: Array<string>}>},
};

/**
 * PLAY THE SEAT `n` GENERATIONS OVER THE API, as another device of the seat would: a research is bought WHOLE (the hand
 * grows — refused for want of money, it is answered with the prompt's own minimum), a turn is passed, everything else
 * takes the drivers' own answer. Ends at the action menu of generation `n + 1`, or at the game's end.
 */
async function playGenerationsOverApi(request: APIRequestContext, viewer: string, n: number): Promise<{generation: number, hand: number}> {
  for (let round = 0; round < n * 40 + 40; round++) {
    const model = await fetchPlayerModel(request, viewer) as unknown as Wire & {cardsInHand?: Array<unknown>};
    const wf = model.waitingFor;
    const menu = wf?.type === 'or' && (wf.options ?? []).some((o) => o.type === 'option' && o.warnings?.includes('pass') === true);
    if (model.game.phase === 'end' || (model.game.generation > n && menu)) {
      return {generation: model.game.generation, hand: model.cardsInHand?.length ?? -1};
    }
    if (wf === undefined) {
      // (MarsBot's turn — the table comes back to the seat by itself.)
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

/** A scene: the presses that lead to it (not read), the press that IS it, and the presses that take the page home. */
type Scene = {name: string, lead: ReadonlyArray<string>, key: string, home: ReadonlyArray<string>};

const SCENES: ReadonlyArray<Scene> = [
  {name: 'LT — the basic wheel opens', lead: [], key: 'Comma', home: ['Escape']},
  {name: 'B — the basic wheel closes', lead: ['Comma'], key: 'Escape', home: []},
  {name: '↓ on the basic wheel — the pass confirm', lead: ['Comma'], key: 'ArrowDown', home: ['Escape', 'Escape']},
  {name: 'B — the pass confirm is cancelled', lead: ['Comma', 'ArrowDown'], key: 'Escape', home: ['Escape']},
  {name: 'RT — the action wheel opens', lead: [], key: 'Period', home: ['Escape']},
  {name: 'Y — the information screen opens', lead: [], key: 'KeyY', home: ['KeyY']},
  {name: 'Y — the information screen closes', lead: ['KeyY'], key: 'KeyY', home: []},
  {name: 'X — «Разыграно» opens', lead: [], key: 'KeyX', home: ['Escape']},
  {name: 'B — «Разыграно» closes', lead: ['KeyX'], key: 'Escape', home: []},
  {name: 'the journal opens', lead: [], key: 'KeyR', home: ['Escape']},
  {name: 'B — the journal closes', lead: ['KeyR'], key: 'Escape', home: []},
  {name: 'A on the basic wheel — the standard projects open', lead: ['Comma'], key: 'Enter', home: ['Escape', 'Escape']},
  {name: '→ on the board — the cursor moves a cell', lead: [], key: 'ArrowRight', home: []},
];

test.describe('THE FRAME BUDGET OF A PRESS', () => {
  test.skip(!ENABLED, 'opt-in: TM_E2E_FRAME_BUDGET=1 (a measurement — it is read, not asserted)');

  test('the everyday presses of the board home: the frame each makes, and who forced its layout', async ({page, request}) => {
    test.setTimeout(20 * 60_000);
    const created = await request.post('/api/creategame', {data: soloGameConfig({
      expansions: {promo: true, venus: true, colonies: true, prelude: true, turmoilRedux: true}, board: 'tharsis', seed: 0.4242, testMode: false, draftVariant: false,
      automa: {difficulty: 'normal', secondShift: false, extraCorporations: false},
    })});
    expect(created.ok(), `create-game refused the table: ${created.status()}`).toBeTruthy();
    const {players} = await created.json() as {players: Array<{id: string, name: string}>};
    const viewer = (players.find((p) => !/marsbot/i.test(p.name)) ?? players[0]).id;
    await seedGameOverApi(request, viewer, {buy: 4});
    if (GENERATIONS > 0) {
      const at = await playGenerationsOverApi(request, viewer, GENERATIONS);
      console.log(`[frame-budget] the page is read in generation ${at.generation}, ${at.hand} card(s) in hand`);
    }
    await openConsole(page, viewer);
    await cinematicBeat(page, 6_000, 'the first turn settles — its arrival is not a press of the board home');
    await installFrameEars(page);

    const tap = async (key: string): Promise<void> => {
      await page.keyboard.press(key);
      await cinematicBeat(page, 1_300, 'the scene the press opened comes to rest — its frames are what is read');
    };
    const table: Array<{scene: string, readings: Array<PressReading>}> = [];
    for (const scene of SCENES) {
      const readings: Array<PressReading> = [];
      for (let i = 0; i < REPEATS; i++) {
        for (const key of scene.lead) {
          await tap(key);
        }
        await markFrameReading(page);
        await tap(scene.key);
        readings.push(await frameReading(page));
        for (const key of scene.home) {
          await tap(key);
        }
      }
      table.push({scene: scene.name, readings});
      const sorted = (pick: (r: PressReading) => number): Array<number> => readings.map(pick).sort((a, b) => a - b);
      const mid = (values: Array<number>): number => values[Math.floor(values.length / 2)];
      const frames = sorted((r) => r.frameMs);
      const slowest = readings.flatMap((r) => r.slow).sort((a, b) => b.took - a.took)[0];
      console.log(`[frame-budget] ${scene.name}: frame ${mid(frames)} ms (max ${frames[frames.length - 1]}) · script ${mid(sorted((r) => r.scriptMs))} · forced layout ${mid(sorted((r) => r.forcedMs))} · ` +
        `reads ${mid(sorted((r) => r.reads))} in ${mid(sorted((r) => r.readMs))} ms · roots [${[...new Set(readings.flatMap((r) => r.roots))].join(' ¦ ')}] · bar «${readings[0]?.bar ?? ''}»` +
        (slowest !== undefined ? ` · slowest read ${slowest.name} ${slowest.took} ms on ${slowest.on} ← ${slowest.stack.slice(0, 5).join(' ← ')}` : ''));
    }
    fs.writeFileSync(test.info().outputPath('frame-budget.json'), JSON.stringify(table, null, 1));
    expect(page.isClosed(), 'the page survived the walk').toBe(false);
  });
});
