import {test, expect, APIRequestContext, Page} from './consoleTest';
import {bootIntoGame, cinematicBeat, openQuickWheel, press, pressUntil, settle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';
import type {ObservedSample} from './observeCore';

/**
 * THE PLANET DOES NOT MOVE WHEN A SECTION HANDS THE SCREEN BACK.
 *
 * The board is `v-show`n, so every section round trip (hand / colonies /
 * hydro) takes its stage to 0×0 and back, and the fit engine's
 * ResizeObserver sees two resizes. Answering those with a re-derivation is
 * how «планета немного сдвигается» after closing the hand shipped: the
 * board's own framing was already correct and already on screen, and a
 * re-derivation that lands ~800ms later GLIDES, because the planet's
 * transform transition is permanent (see docs/claude/console/planet-focus.md).
 * Traced on the device: 997→902px wide over two round trips, oscillating,
 * never converging.
 *
 * What this guards, in the terms the fit engine itself uses:
 *  1. a hand round trip leaves `--board-scale` / `--con-board-dx` /
 *     `--con-board-dy` and the live `.board-cont` rect BYTE-IDENTICAL, and
 *     the planet does not travel a pixel at any frame in between;
 *  2. a REAL frame change (a window resize) still re-fits — the guard must
 *     not be satisfiable by an engine that simply stopped working.
 *
 * The trace is a RECORDING on purpose: `planet-focus.md` is explicit that
 * this class of bug is diagnosed with a frame trace and not by reading code,
 * and a Playwright poll is far too coarse to see a 300ms glide.
 */

function newGameConfig() {
  return {
    players: [{name: 'JumpProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

/** What the board's framing looks like in one recorded state. */
type Frame = {
  scale: string,
  dx: string,
  dy: string,
  stage: string,
  cont: string,
  tf: string,
  cls: string,
};

/** A recorded frame with its time (ms since the trip's first sample, on the PAGE's clock). */
type Sample = Frame & {t: number};

/**
 * THE FRAMING TRACE — RECORDED (FLAKE ZERO, `armWitness`, armed before the
 * trip). `docs/claude/console/planet-focus.md` is explicit that this class of
 * bug is diagnosed with a fine-grained trace and not by reading code — a
 * Playwright poll (~60ms/round trip) is far too coarse to see a 300ms glide
 * start, and coarse sampling is what made the previous three fixes here
 * guesses.
 *
 * The recording samples in the very task the product writes the framing (a
 * MutationObserver over the document — the fit writes its custom properties
 * and the board's classes) AND once per animation frame (a glide is a CSS
 * transition: it moves no DOM, but it paints frames). Its earlier forms each
 * slept through what they were there to see: an rAF sampler stopped sampling
 * on a quiet screen (≤5 live frames per round trip at 4K — the «no live
 * frames captured» flake), and a 16 ms `setInterval` is starved for hundreds
 * of ms at a time on a 2-core software raster. Only a CHANGED framing is
 * kept, so a still planet is a short record.
 */
async function armFramingTrace(page: Page, key: string) {
  return armWitness<Frame>(page, key, () => {
    const r = (el: Element | null) => {
      if (el === null) {
        return 'none';
      }
      const b = el.getBoundingClientRect();
      return `${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}x${b.height.toFixed(1)}`;
    };
    const board = document.querySelector('.con-board');
    const stage = document.querySelector('.con-board__stage');
    const cont = document.querySelector('.con-board__stage > .board-cont');
    const cs = stage === null ? undefined : getComputedStyle(stage);
    return {
      scale: getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim(),
      dx: (cs?.getPropertyValue('--con-board-dx') ?? '').trim(),
      dy: (cs?.getPropertyValue('--con-board-dy') ?? '').trim(),
      stage: r(stage),
      cont: r(cont),
      tf: cont === null ? 'none' : getComputedStyle(cont).transform,
      cls: board === null ? 'unmounted' : board.className,
    };
  });
}

/** The recording as a trace: every recorded state with its time since the first one. */
function traceOf(samples: ReadonlyArray<ObservedSample<Frame>>): Array<Sample> {
  const t0 = samples[0]?.t ?? 0;
  return samples.map((s) => ({...s.v, t: Math.round(s.t - t0)}));
}

/** The fit engine's declared state and the framing it publishes — ONE read («settled|scale|dx|dy|rect»). */
async function framingKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector('.con-board');
    const stage = document.querySelector('.con-board__stage');
    const cont = document.querySelector('.con-board__stage > .board-cont');
    const b = cont?.getBoundingClientRect();
    const cs = stage === null ? undefined : getComputedStyle(stage);
    return [
      root?.getAttribute('data-framing') ?? 'missing',
      getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim(),
      (cs?.getPropertyValue('--con-board-dx') ?? '').trim(),
      (cs?.getPropertyValue('--con-board-dy') ?? '').trim(),
      b === undefined ? 'none' : `${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}`,
    ].join('|');
  });
}

/**
 * Wait until the board is genuinely AT REST — the fit engine DECLARES it
 * (`data-framing="settled"`: the normal overview framing with NO scheduled
 * work left — no fit frame, no calibration pass, no late-verification rung
 * pending; `ConsoleBoardSection.framingState`) AND the framing values plus
 * the painted rect hold still across frames (`readSettled`: after `settle`,
 * three equal reads a frame apart, never a read mid-glide). A resize
 * legitimately re-converges (and each corrective pass glides 300ms), so a
 * fixed timeout either starts a "must not move" trip mid-glide or hard-codes
 * the convergence's length. A read at rest that still says «busy» (a late
 * rung waiting on its timer) is read again.
 */
async function waitForFramingRest(page: Page, timeoutMs = 45_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const left = Math.max(1_000, deadline - Date.now());
    const now = await readSettled(page, () => framingKey(page), {equal: 3, timeoutMs: left, message: 'the board framing'});
    if (now.startsWith('settled|')) {
      return now;
    }
    if (Date.now() >= deadline) {
      throw new Error(`board never came to rest within ${timeoutMs}ms (last=${now})`);
    }
  }
}

/** The fit engine's live `--board-scale`. */
async function boardScale(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim());
}

type UnionMetrics = {
  n: number, scale: number,
  unionW: number, unionH: number, stageW: number, stageH: number,
  natW: number, natH: number, dx: number, dy: number,
  edges: string,
};

/**
 * Re-run the fit engine's OWN union-bbox measurement (`CONTENT_SELECTOR` in
 * ConsoleBoardSection) from the page: the natural box it would derive, and
 * how far the content centre sits from the stage centre. `dx`/`dy` are the
 * engine's own convergence test — reading them from outside is how this spec
 * can assert "the convergence finished" without reaching into the component.
 * `edges` names the elements defining each extreme, so a future drift says
 * WHAT moved instead of only that something did.
 */
async function unionMetrics(page: Page): Promise<UnionMetrics> {
  return page.evaluate(() => {
    const SEL = [
      '.board-space[data_space_id]', '.arc-scale__rail', '.arc-scale__edge',
      '.arc-scale__digit', '.arc-scale__identity', '.arc-marker',
      '[data-arc-marker]', '.scale-event',
    ].join(', ');
    const stage = document.querySelector('.con-board__stage');
    const empty = {
      n: 0, scale: 0, unionW: 0, unionH: 0, stageW: 0, stageH: 0,
      natW: 0, natH: 0, dx: 0, dy: 0, edges: 'no stage',
    };
    if (stage === null) {
      return empty;
    }
    const sr = stage.getBoundingClientRect();
    let L = Infinity; let T = Infinity; let R = -Infinity; let B = -Infinity;
    let lEl = ''; let tEl = ''; let rEl = ''; let bEl = '';
    let n = 0;
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 2).join('.')}${el.getAttribute('data_space_id') ?? ''}`;
    for (const el of Array.from(stage.querySelectorAll(SEL))) {
      const b = el.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) {
        continue;
      }
      n++;
      if (b.left < L) {
        L = b.left; lEl = name(el);
      }
      if (b.top < T) {
        T = b.top; tEl = name(el);
      }
      if (b.right > R) {
        R = b.right; rEl = name(el);
      }
      if (b.bottom > B) {
        B = b.bottom; bEl = name(el);
      }
    }
    if (n === 0) {
      return empty;
    }
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-scale')) || 1;
    return {
      n,
      scale: Number(scale.toFixed(4)),
      unionW: Number((R - L).toFixed(1)),
      unionH: Number((B - T).toFixed(1)),
      stageW: Number(sr.width.toFixed(1)),
      stageH: Number(sr.height.toFixed(1)),
      natW: Number(((R - L) / scale).toFixed(1)),
      natH: Number(((B - T) / scale).toFixed(1)),
      dx: Number(((sr.left + sr.width / 2) - (L + R) / 2).toFixed(1)),
      dy: Number(((sr.top + sr.height / 2) - (T + B) / 2).toFixed(1)),
      edges: `L:${lEl} R:${rEl} T:${tEl} B:${bEl}`,
    };
  });
}

/** Print only the frames where SOMETHING changed — the discontinuities. */
function print(label: string, rows: ReadonlyArray<Sample>): void {
  console.log(`\n──── ${label} ────`);
  let prev: Sample | undefined;
  let shown = 0;
  for (const s of rows) {
    const changed = prev === undefined || prev.scale !== s.scale || prev.dx !== s.dx ||
      prev.dy !== s.dy || prev.cont !== s.cont || prev.stage !== s.stage || prev.cls !== s.cls;
    if (changed) {
      shown++;
      console.log(`  t=${String(s.t).padStart(6)}ms scale=${s.scale.padEnd(7)} dx=${s.dx.padEnd(9)} dy=${s.dy.padEnd(9)}`);
      console.log(`            stage=[${s.stage}] cont=[${s.cont}]`);
      if (prev === undefined || prev.cls !== s.cls) {
        console.log(`            cls="${s.cls}"`);
      }
    }
    prev = s;
  }
  console.log(`  (${rows.length} frames traced, ${shown} discontinuities)`);
}

/**
 * Boot a solo game and land on the board home.
 *
 * ⚠️ THE WALK IS SETUP, NEVER THE SUBJECT — so it goes through the SHARED
 * driver (`consoleStart.bootIntoGame`, API path), not a hand-rolled key script.
 * This file used to carry its own: a fixed cadence of A / RT presses that
 * decided the wizard was over by counting `.con-start__frame` nodes and matching
 * RU screen text. All four tests here failed on it — «boot stuck — mounted:
 * [.con-start__frame .con-handdock]», i.e. still inside the wizard after five
 * minutes — while the product's framing (the actual subject) was never
 * exercised at all. That is precisely the failure mode `consoleStart.ts` exists
 * to delete, and the API path also turns a ~5-minute walk into seconds.
 */
async function bootGame(page: Page, request: APIRequestContext, buy: number, profileQuery = ''): Promise<void> {
  await bootIntoGame(page, request, {config: newGameConfig(), buy, query: profileQuery});
}

/**
 * RT wheel → A («КАРТЫ»), then let the reveal episode settle. Every press is
 * act → verify ITS effect → retry only without one: a stray surface is closed
 * until none stands, the wheel is opened by the shared driver, and the centre
 * press is repeated only while the wheel still stands (on a quick wheel the
 * press IS the activation — the wheel leaving is its effect).
 */
async function openHand(page: Page): Promise<void> {
  const hand = page.locator('.con-hand');
  const wheel = page.locator('.con-quick');
  const stray = page.locator('.con-zoom, .con-quick, .con-composer');
  expect(await pressUntil(page, 'Escape', async () => await stray.count() === 0, {settleMs: 900}),
    'a stray viewer / wheel / composer must close before the hand is opened').toBe(true);
  await openQuickWheel(page);
  expect(await pressUntil(page, 'Enter', async () => await hand.count() > 0 || await wheel.count() === 0, {settleMs: 2600}),
    'A on the wheel\'s centre slot must open the hand').toBe(true);
  await expect(hand).toHaveCount(1);
  // The reveal episode is over when the hand drops its transit hold — then the console is quiet.
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 20_000});
  await settle(page);
}

const PROFILES = [
  {tag: 'desktop', query: '', viewport: {width: 1440, height: 1000}},
  // The real target platform (memory: LG OLED 42C34LA) — the fit engine's
  // px thresholds only mean something at the scale it actually runs at.
  {tag: 'tv-4k', query: '', viewport: {width: 3840, height: 2160}},
];

for (const profile of PROFILES) {
  test.describe(`planet framing across a hand round trip — ${profile.tag}`, () => {
    test.use({viewport: profile.viewport});
    test.setTimeout(300_000);

    /** One board → hand → board trip; returns every LIVE recorded state of it. */
    async function roundTrip(page: Page, label: string): Promise<Array<Sample>> {
      // Armed at rest: its first sample IS the "at rest" baseline.
      const trace = await armFramingTrace(page, `planet-trace:${profile.tag}:${label}`);
      await openHand(page);
      await press(page, 'Escape');
      await expect(page.locator('.con-hand'), `${label}: B must hand the screen back to the board`)
        .toHaveCount(0, {timeout: 20_000});
      // The gather flight (500ms) + its fade, then everything a re-derivation
      // could arm — the fit's own 300ms glide, the late verification's rungs:
      // the trip is over when the engine DECLARES its framing settled with no
      // work left and the framing holds still. If the planet is going to
      // move, it has moved — and the recording saw every state of it.
      await waitForFramingRest(page);
      const rows = traceOf(await trace.stop());
      print(`${profile.tag} · ${label}`, rows);
      // The window in which the board is HIDDEN carries no framing — a 0×0
      // stage is not a frame anyone can see.
      return rows.filter((s) => !s.stage.startsWith('0.0,0.0 0.0x0.0') && s.cont !== 'none');
    }

    /** Every live recorded state must show the SAME framing the trip started from. */
    function expectStill(live: ReadonlyArray<Sample>, label: string): void {
      // The recorder's own liveness only (FLAKE ZERO, recipe item 8): a recording keeps a state when it CHANGES, so a
      // still planet is ONE live state — «more than five» counted frames, i.e. the machine's speed.
      expect(live.length, `${label}: no live frames captured`).toBeGreaterThan(0);
      const rest = live[0];
      const moved = live.filter((s) =>
        s.scale !== rest.scale || s.dx !== rest.dx || s.dy !== rest.dy || s.cont !== rest.cont);
      const detail = moved.length === 0 ? '' :
        ` first mover at t=${moved[0].t}ms: scale ${rest.scale}→${moved[0].scale}` +
        ` dx ${rest.dx}→${moved[0].dx} dy ${rest.dy}→${moved[0].dy}` +
        ` cont [${rest.cont}]→[${moved[0].cont}]`;
      expect(moved.length,
        `${label}: the planet moved on ${moved.length}/${live.length} frames —` +
        ' a section handing the screen back is not a geometry change.' + detail).toBe(0);
    }

    /**
     * The other half of the same defect: the convergence has to FINISH.
     *
     * The fit engine derives the board's natural box by measuring what the
     * stage actually renders, so a convergence that runs while the board is
     * still composing (deal cinematic, arcs travelling to their values) is
     * measuring a board that no longer exists — and the old pass budget then
     * froze whatever it happened to end on. Traced at 4K before the fix: the
     * boot stopped at `scale 3.5052` with the content 371px right and 200px
     * above the stage centre, and NOTHING re-derived it until a section round
     * trip did — which is what the player saw as the planet shifting. The
     * budget is now a runaway guard and a bounded ladder re-measures once the
     * board is quiet, so the board is centred in its own stage, and stays.
     */
    test('the boot converges on a centred board, and stays there', async ({page, request}) => {
      await bootGame(page, request, 3, profile.query);
      await waitForFramingRest(page);
      const settled = await readSettled(page, () => unionMetrics(page), {message: 'the board\'s union box at rest'});
      console.log(`\n──── ${profile.tag} · settled ────\n            ${JSON.stringify(settled)}`);

      // CENTRED: the fit engine's own convergence test, applied from outside.
      // Its epsilon is 2px, so anything beyond a few px means it stopped early.
      expect(Math.abs(settled.dx),
        `the board is ${settled.dx.toFixed(1)}px off the stage centre horizontally — ` +
        'the convergence did not finish').toBeLessThan(6);
      expect(Math.abs(settled.dy),
        `the board is ${settled.dy.toFixed(1)}px off the stage centre vertically — ` +
        'the convergence did not finish').toBeLessThan(6);
      // FILLING it: the whole point of the self-calibration is that no dead
      // margin is left around the planet on the axis that binds.
      const fill = Math.max(settled.unionW / settled.stageW, settled.unionH / settled.stageH);
      expect(fill, `the board fills only ${(fill * 100).toFixed(1)}% of its stage on the binding axis`)
        .toBeGreaterThan(0.97);

      // …and STAYS. A convergence that is still creeping would show up here —
      // a NEGATIVE claim, so it needs its window; both ends are read at rest.
      await cinematicBeat(page, 8000, 'the window a still-creeping convergence would need to show itself');
      const later = await readSettled(page, () => unionMetrics(page), {message: 'the board\'s union box, later'});
      expect(later.scale, 'the framing kept moving after it reported rest').toBe(settled.scale);
      expect(Math.abs(later.dx - settled.dx)).toBeLessThan(1);
      expect(Math.abs(later.dy - settled.dy)).toBeLessThan(1);
    });

    test('a hand round trip does not re-frame the planet', async ({page, request}) => {
      await bootGame(page, request, 3, profile.query);
      await waitForFramingRest(page);
      const atRest = await readSettled(page, () => unionMetrics(page), {message: 'the board\'s union box at rest'});
      console.log(`\n──── ${profile.tag} · union at rest ────\n            ${JSON.stringify(atRest)}`);

      // THREE trips: the defect oscillated rather than converged, so a single
      // trip could pass by luck on the half of the cycle that happened to
      // land back where it started.
      for (const pass of [1, 2, 3]) {
        expectStill(await roundTrip(page, `pass ${pass} · board → hand → board`), `pass ${pass}`);
      }

      // ── …and the engine is still ALIVE ────────────────────────────────
      // A guard that only asserts "nothing moved" is satisfied by a fit
      // engine that stopped working. A REAL frame change must still re-fit.
      const before = await boardScale(page);
      await page.setViewportSize({
        width: Math.round(profile.viewport.width * 0.8),
        height: Math.round(profile.viewport.height * 0.8),
      });
      // The re-fit CONVERGES (several bounded passes, each gliding 300ms) —
      // wait for the new frame to come to rest, don't guess how long it takes.
      // The engine takes the change a frame or two after the resize (its
      // ResizeObserver), and until then it still DECLARES the old framing
      // settled: the re-fit is asserted live first (a poll), then read at rest.
      await expect.poll(() => boardScale(page), {message: 'a real viewport change must still re-fit the board', timeout: 45_000})
        .not.toBe(before);
      await waitForFramingRest(page);
      const after = await boardScale(page);
      console.log(`\n──── ${profile.tag} · resize ────\n  --board-scale ${before} → ${after}`);
      expect(after, 'a real viewport change must still re-fit the board').not.toBe(before);

      // …and back. Resize-away-and-return is the one case that could leave a
      // STALE frame key matching a box the board no longer has — the guard
      // would then be passing on a board that simply refuses to re-fit.
      await page.setViewportSize(profile.viewport);
      await expect.poll(() => boardScale(page), {message: 'returning to the original viewport must re-fit again', timeout: 45_000})
        .not.toBe(after);
      await waitForFramingRest(page);
      const restored = await boardScale(page);
      console.log(`  --board-scale ${after} → ${restored} (restored)`);
      expect(restored, 'returning to the original viewport must re-fit again').not.toBe(after);

      // And the frame it came back to must be just as stable as the first.
      expectStill(await roundTrip(page, 'after resize · board → hand → board'), 'after resize');
    });
  });
}
