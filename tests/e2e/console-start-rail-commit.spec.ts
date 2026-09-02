import {test, expect, Page} from '@playwright/test';
import {
  deploymentActive, fillPicks, openConsole, press, soloGameConfig, stepKind,
  stepSubject, summaryVisible, visibleSurfaces, waitPressable,
} from './consoleStart';

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
 * MutationObserver + interval sampler armed BEFORE the advance press records
 * (held, name, opacity, deal-holds) per change, and the assertions are about
 * the ORDER of those samples. rAF is deliberately not used — headless
 * Chromium drives it off the compositor and it stops exactly when the screen
 * goes quiet (the window under test).
 */

test.describe.configure({mode: 'serial'});

type RailSample = {
  t: number,
  src: string,
  held: boolean,
  name: string,
  opacity: number,
  dealHolds: number,
};

declare global {
  interface Window {
    __railProbe?: {samples: Array<RailSample>, stop: () => void};
  }
}

/** Arm the rail probe (MutationObserver + setInterval — never rAF). */
async function armRailProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window;
    w.__railProbe?.stop();
    const samples: Array<RailSample & {missing?: boolean}> = [];
    const sample = (src: string) => {
      const inner = document.querySelector<HTMLElement>('.con-start__status-inner');
      if (inner === null) {
        samples.push({t: performance.now(), src, held: true, name: '', opacity: 0, dealHolds: 0, missing: true});
        return;
      }
      const name = (inner.querySelector<HTMLElement>('.con-start__status-name, .con-cardavail__name')?.textContent ?? '').trim();
      samples.push({
        t: performance.now(),
        src,
        held: inner.classList.contains('con-start__status-inner--held'),
        name,
        opacity: parseFloat(getComputedStyle(inner).opacity),
        dealHolds: document.querySelectorAll('.con-start__frame .con-deal-hold').length,
      });
    };
    const frame = document.querySelector('.con-start__frame');
    const mo = new MutationObserver(() => sample('mo'));
    if (frame !== null) {
      mo.observe(frame, {subtree: true, childList: true, attributes: true, characterData: true});
    }
    const iv = window.setInterval(() => sample('iv'), 40);
    w.__railProbe = {
      samples: samples as Array<RailSample>,
      stop: () => {
        mo.disconnect();
        window.clearInterval(iv);
      },
    };
    sample('arm');
  });
}

async function takeRailProbe(page: Page): Promise<Array<RailSample>> {
  return await page.evaluate(() => {
    const w = window as Window;
    w.__railProbe?.stop();
    return w.__railProbe?.samples ?? [];
  });
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
    await page.waitForTimeout(300);
    const before = await stepSubject(page);
    await press(page, 'Enter', 800);
    if (await stepSubject(page) === before && !(await summaryVisible(page))) {
      await press(page, 'Period', 1500);
    }
    for (let w = 0; w < 12 && await stepSubject(page) === before && !(await summaryVisible(page)); w++) {
      await page.waitForTimeout(250);
    }
  }
  expect(stepKind(await stepSubject(page)),
    `the wizard stopped on the prelude step — showing ${JSON.stringify(await visibleSurfaces(page))}`).toBe('prelude');
  await waitPressable(page);
  await page.waitForTimeout(400);

  // Answer the prelude step (2 picks), then ARM THE PROBE and advance.
  const picked = await fillPicks(page, 2);
  expect(picked.length, `picked preludes: ${JSON.stringify(picked)}`).toBe(2);
  await armRailProbe(page);
  await press(page, 'Period', 300); // RT: the transition under test begins

  // Wait for the ARRIVAL, by state: project step + the rail's hold released.
  const released = page.locator('.con-start__status-inner:not(.con-start__status-inner--held)');
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    if (stepKind(await stepSubject(page)) === 'project' && await released.count() > 0) {
      break;
    }
    await page.waitForTimeout(250);
  }
  expect(stepKind(await stepSubject(page)), 'the projects step arrived').toBe('project');
  await expect(released, 'the rail released its hold (focus commit)').toHaveCount(1, {timeout: 20_000});
  // A short settle so the probe records the post-commit steady state too.
  await page.waitForTimeout(800);

  const samples = await takeRailProbe(page);
  // The floor is where only a DEAD sampler fails (numbers in the message).
  expect(samples.length, `probe liveness — ${samples.length} samples`).toBeGreaterThan(5);

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
