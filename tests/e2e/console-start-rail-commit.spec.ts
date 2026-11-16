import {test, expect} from './consoleTest';
import {
  deploymentActive, fillPicks, openConsole, press, settle, soloGameConfig, stepKind,
  stepSubject, summaryVisible, visibleSurfaces, waitPressable, waitStepDealSettled,
} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

/**
 * THE STATUS RAIL'S FOCUS COMMIT — the prelude → projects regression.
 *
 * The defect this pins: on the stage hop the next step's card entries and the
 * default focus index land THREE DIRECTOR PHASES before the new surface may
 * paint, and the rail (a sibling of the step pane — no pane hold covers it)
 * used to publish the first project's name in that very frame, fade it out
 * under the deal hold, and bring the same name back after the deal:
 * «появилось → исчезло → появилось». The fix is a lifecycle, not a delay:
 * `startRailCommitted` (deal not holding + transition settled) gates the ONE
 * source every card-specific rail node derives from, and the hold lands with
 * `transition: none` so not even one commit frame can paint through it.
 *
 * The probe therefore watches LIFECYCLE EVENTS, never a timing budget: a
 * WITNESS armed BEFORE the advance press records (held, name, opacity,
 * deal-holds) off the product's own writes and a frame tick (`armWitness` —
 * `settled`, because «nothing readable while the deal holds» and «one publish»
 * are claims about what ONE painted state carries and in what ORDER), and the
 * assertions are about the ORDER of those samples.
 */

test.describe.configure({mode: 'serial'});

type RailState = {
  held: boolean,
  name: string,
  opacity: number,
  dealHolds: number,
  missing?: boolean,
};
type RailSample = RailState & {t: number};

/** The rail as the page holds it NOW — in the page, self-contained (the witness's reader). */
function readRail(): RailState {
  const inner = document.querySelector<HTMLElement>('.con-start__status-inner');
  if (inner === null) {
    return {held: true, name: '', opacity: 0, dealHolds: 0, missing: true};
  }
  const name = (inner.querySelector<HTMLElement>('.con-start__status-name, .con-cardavail__name')?.textContent ?? '').trim();
  return {
    held: inner.classList.contains('con-start__status-inner--held'),
    name,
    opacity: parseFloat(getComputedStyle(inner).opacity),
    dealHolds: document.querySelectorAll('.con-start__frame .con-deal-hold').length,
  };
}

/** A sample the PLAYER can read: painted text at readable strength. */
function visibleName(s: RailSample): string {
  return s.name !== '' && s.opacity > 0.05 ? s.name : '';
}

test('prelude → projects: no project name in the rail before the focus commit, then once and stable', async ({page, request}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({width: 1920, height: 1080});

  // Production-shaped deal (never testmode) + preludes ON — the transition
  // under test is the prelude step's RT advance into the project buy.
  const created = await request.post('/api/creategame', {
    data: soloGameConfig({testMode: false, expansions: {prelude: true}}),
  });
  expect(created.ok(), 'the game server accepted the config').toBeTruthy();
  const {players} = await created.json();
  await openConsole(page, players[0].id, '');

  // Walk to the PRELUDE step and stop there (same guarded walk as the
  // availability spec: press, look, and only RT if nothing moved).
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  for (let round = 0; round < 8; round++) {
    if (await summaryVisible(page) || await deploymentActive(page)) {
      break;
    }
    const kind = stepKind(await stepSubject(page));
    if (kind === 'prelude' || kind === 'project') {
      break;
    }
    await waitPressable(page);
    // The step names itself once its deal has let go of the subject — read it then (bounded: the walk reads what stands).
    await expect.poll(() => stepSubject(page), {timeout: 5_000}).not.toBe('').catch(() => undefined);
    const before = await stepSubject(page);
    await press(page, 'Enter', 800);
    if (await stepSubject(page) === before && !(await summaryVisible(page))) {
      await press(page, 'Period', 1500);
    }
    // Let the step actually change before looking again — a STATE (bounded), never a sleep.
    await expect.poll(async () => await stepSubject(page) !== before || await summaryVisible(page), {timeout: 3_000})
      .toBe(true).catch(() => { /* the next round reads what stands */ });
  }
  expect(stepKind(await stepSubject(page)),
    `the wizard stopped on the prelude step — showing ${JSON.stringify(await visibleSurfaces(page))}`).toBe('prelude');
  await waitPressable(page);
  // The prelude step's deal LANDED (the focused card standing, nothing still arriving) before its picks.
  await waitStepDealSettled(page);

  // Answer the prelude step (2 picks), then ARM THE PROBE and advance.
  const picked = await fillPicks(page, 2);
  expect(picked.length, `picked preludes: ${JSON.stringify(picked)}`).toBe(2);
  const rail = await armWitness<RailState>(page, 'start-rail-commit', readRail, {settled: true, max: 20_000});
  await press(page, 'Period', 300); // RT: the transition under test begins

  // Wait for the ARRIVAL, by state: project step + the rail's hold released.
  const released = page.locator('.con-start__status-inner:not(.con-start__status-inner--held)');
  await expect.poll(async () => stepKind(await stepSubject(page)) === 'project' && await released.count() > 0,
    {timeout: 60_000}).toBe(true).catch(() => { /* the two claims below name what never arrived */ });
  await expect.poll(async () => stepKind(await stepSubject(page)), {message: 'the projects step arrived'}).toBe('project');
  await expect(released, 'the rail released its hold (focus commit)').toHaveCount(1, {timeout: 20_000});
  // The record runs into the post-commit STEADY state: the rail itself holding still (two equal reads a frame apart,
  // its fade over) — never a guessed beat.
  await settle(page, {timeoutMs: 20_000}).catch(() => { /* the start is a phase-long scene — the read still waits for rest */ });
  await readSettled(page, () => page.evaluate(readRail), {settle: false, message: 'the committed rail at rest'});

  const samples: Array<RailSample> = (await rail.stop()).map((s) => ({...s.v, t: s.t}));
  // The floor is where only a DEAD recorder fails — it records DISTINCT states, never frames (numbers in the message).
  expect(samples.length, `probe liveness — ${samples.length} samples`).toBeGreaterThan(0);

  // Split at the first HELD sample: everything before it is the prelude
  // step's own (legitimately visible) rail; the lifecycle under test begins
  // when the transition takes the hold.
  const heldAt = samples.findIndex((s) => s.held);
  expect(heldAt, 'the advance press took the rail hold').toBeGreaterThanOrEqual(0);
  const run = samples.slice(heldAt);

  const finalName = visibleName(run[run.length - 1]);
  expect(finalName, 'the committed rail names the focused project').not.toBe('');

  // 1. NOTHING readable while the deal still holds cards — the exact frame
  //    class the old fade leaked through.
  const leaked = run.filter((s) => visibleName(s) !== '' && s.dealHolds > 0);
  expect(leaked, `no card name may paint over held slots — leaked: ${JSON.stringify(leaked.slice(0, 4))}`).toHaveLength(0);

  // 2. ONE off→on edge: once a name is readable it stays readable — the
  //    forbidden sequences (A → empty → A, A → B → A, early flash then
  //    reappearance) all need a second edge.
  let edges = 0;
  for (let i = 1; i < run.length; i++) {
    if (visibleName(run[i - 1]) === '' && visibleName(run[i]) !== '') {
      edges++;
    }
  }
  expect(edges, `exactly one publish — series: ${JSON.stringify(run.map((s) => visibleName(s) === '' ? '·' : visibleName(s)).slice(-30))}`).toBe(1);

  // 3. ATOMIC payload: every readable sample carries the SAME final name —
  //    a different card's name (stale focus, default index) never painted.
  const names = new Set(run.map(visibleName).filter((n) => n !== ''));
  expect([...names], 'one committed card, never a predecessor').toEqual([finalName]);
});
