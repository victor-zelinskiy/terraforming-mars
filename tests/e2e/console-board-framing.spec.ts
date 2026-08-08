import {test, expect, Page} from '@playwright/test';

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
 * The trace is per-rAF on purpose: `planet-focus.md` is explicit that this
 * class of bug is diagnosed with a frame trace and not by reading code, and
 * a Playwright poll is far too coarse to see a 300ms glide.
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

type Sample = {
  t: number,
  scale: string,
  dx: string,
  dy: string,
  stage: string,
  cont: string,
  tf: string,
  cls: string,
};

/**
 * A PER-FRAME in-page recorder. `docs/claude/console/planet-focus.md` is
 * explicit that this class of bug is diagnosed with an rAF trace and not by
 * reading code — a Playwright poll (~60ms/round trip) is far too coarse to
 * see a 300ms glide start, and coarse sampling is what made the previous
 * three fixes here guesses.
 */
async function startTrace(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__planetTrace?: Array<unknown>, __planetStop?: () => void};
    w.__planetTrace = [];
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
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
      w.__planetTrace!.push({
        t: Math.round(performance.now() - t0),
        scale: getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim(),
        dx: (cs?.getPropertyValue('--con-board-dx') ?? '').trim(),
        dy: (cs?.getPropertyValue('--con-board-dy') ?? '').trim(),
        stage: r(stage),
        cont: r(cont),
        tf: cont === null ? 'none' : getComputedStyle(cont).transform,
        cls: board === null ? 'unmounted' : board.className,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    w.__planetStop = () => cancelAnimationFrame(raf);
  });
}

async function readTrace(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => {
    const w = window as unknown as {__planetTrace?: Array<Sample>, __planetStop?: () => void};
    w.__planetStop?.();
    return w.__planetTrace ?? [];
  });
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

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Boot a solo game and land on the board home (from console-hand-workspace). */
async function bootGame(page: Page, request: any, buyProjects: number, profileQuery = ''): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1${profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  const launch = page.getByText('НАЧАТЬ ПАРТИЮ').first();
  // 1 · CORPORATION. Press A until the step's OWN counter says the pick took,
  // never once blindly: a single Enter that lands before the scene is armed
  // leaves «Выбрано 0 из 1» and the rest of the walk has no way back — which
  // is exactly how this boot stalled in the wizard.
  const frameText = async () => (await page.locator('.con-start__frame').first()
    .innerText().catch(() => '')).replace(/\s+/g, ' ').toUpperCase();
  for (let i = 0; i < 10; i++) {
    if (/ВЫБРАНО 1 ИЗ 1/.test(await frameText())) {
      break;
    }
    await key(page, 'Enter', 900);
  }
  await key(page, 'Period', 1700);
  await page.getByText('стартовые карты для покупки').first().waitFor({timeout: 12_000}).catch(() => {});
  for (let i = 0; i < buyProjects; i++) {
    await key(page, 'Enter', 700);
    await key(page, 'ArrowRight', 260);
  }
  await key(page, 'Period', 1700);
  for (let i = 0; i < 4 && await launch.count() === 0; i++) {
    await key(page, 'Period', 1300);
  }
  if (await launch.count() > 0) {
    await key(page, 'Enter', 2400);
  }
  await page.waitForTimeout(3000);
  const live = page.locator('.con-handdock--live');
  const placement = page.locator('.con-context__task-kicker');
  const wizard = page.locator('.con-start__frame');
  const quick = page.locator('.con-quick');
  const handSec = page.locator('.con-hand');
  const composer = page.locator('.con-composer');
  const finishers = ['ArrowRight', 'Enter', 'KeyE'];
  const dirs = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 36 && (await live.count() === 0 || await placement.count() > 0); i++) {
      if (await page.locator('.con-zoom').count() > 0) {
        await key(page, 'Escape', 1100);
      } else if (await quick.count() > 0) {
        await key(page, 'Escape', 1100);
      } else if (await composer.count() > 0) {
        const corpFirst = await page.locator('.con-composer--corpfirst').count() > 0;
        await key(page, corpFirst ? 'Enter' : 'Escape', 1600);
      } else if (await handSec.count() > 0) {
        await key(page, 'Escape', 1400);
      } else if (await wizard.count() > 0) {
        await key(page, finishers[i % finishers.length], 900);
      } else if (await placement.count() > 0) {
        await key(page, 'Enter', 1200);
        if (await placement.count() > 0) {
          await key(page, dirs[i % dirs.length], 600);
          await key(page, 'Enter', 1400);
        }
      } else {
        await key(page, 'Enter', 1500);
      }
    }
    await page.waitForTimeout(2500);
    if (await live.count() === 1 && await placement.count() === 0) {
      break;
    }
  }
  if (await live.count() === 0) {
    // The self-healing walk is shared with console-hand-workspace and is
    // inherently timing-sensitive; say WHAT it was looking at rather than
    // just "0 elements", or every boot flake costs a full re-run to read.
    const fs = await import('node:fs');
    const p = await import('node:path');
    fs.mkdirSync(p.resolve('screenshots', 'console-board-framing'), {recursive: true});
    await page.screenshot({path: p.resolve('screenshots', 'console-board-framing', 'boot-stuck.png')});
    const surfaces = await page.evaluate(() => [
      '.con-start__frame', '.con-load', '.con-hand', '.con-composer', '.con-quick',
      '.con-zoom', '.con-mandatory', '.con-task-host', '.con-sheet', '.con-reveal',
      '.con-context__task-kicker', '.con-handdock', '.con-stranded', '.con-banner',
    ].filter((s) => document.querySelector(s) !== null).join(' '));
    const banner = await page.locator('.con-banner').first().innerText().catch(() => '');
    console.log(`  !! boot stuck — mounted: [${surfaces}] banner="${banner.trim()}"`);
  }
  await expect(live).toHaveCount(1);
  for (let i = 0; i < 8 && await page.locator('.con-mandatory').count() > 0; i++) {
    await key(page, 'Enter', 1400);
    if (await placement.count() > 0) {
      await key(page, 'Enter', 1400);
    }
  }
  await page.waitForTimeout(1000);
}

/** RT wheel → A («КАРТЫ»), then let the reveal episode settle. */
async function openHand(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand').count() === 0; i++) {
    if (await page.locator('.con-zoom, .con-quick, .con-composer').count() > 0) {
      await key(page, 'Escape', 900);
      continue;
    }
    await key(page, 'Period', 700);
    await key(page, 'Enter', 2600);
    if (await page.locator('.con-quick').count() > 0) {
      await key(page, 'Escape', 700);
    }
  }
  await expect(page.locator('.con-hand')).toHaveCount(1);
  await page.waitForTimeout(600);
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

    /**
 * Wait until the board is genuinely AT REST — framing values AND the painted
 * rect unchanged for a stretch. A resize legitimately re-converges (and each
 * corrective pass glides 300ms), so a fixed timeout either starts a
 * "must not move" trip mid-glide or hard-codes the convergence's length.
 */
    async function waitForFramingRest(page: Page, timeoutMs = 45_000): Promise<void> {
      const read = () => page.evaluate(() => {
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
      const deadline = Date.now() + timeoutMs;
      let last = await read();
      let stableSince = Date.now();
      while (Date.now() < deadline) {
        await page.waitForTimeout(120);
        const now = await read();
        if (now !== last) {
          last = now;
          stableSince = Date.now();
        } else if (now.startsWith('settled|') && Date.now() - stableSince >= 900) {
          return;
        }
      }
      throw new Error(`board never came to rest within ${timeoutMs}ms (last=${last})`);
    }

    /** One board → hand → board trip; returns every LIVE frame of it. */
    async function roundTrip(page: Page, label: string): Promise<Array<Sample>> {
      await startTrace(page);
      await page.waitForTimeout(400); // a few frames of "at rest" baseline
      await openHand(page);
      await page.waitForTimeout(700);
      await page.keyboard.press('Escape');
      // The gather flight (500ms) + its fade, then well past anything a
      // re-derivation could arm: the fit's own glide is 300ms and the late
      // verification 1500ms. If the planet is going to move, it has moved.
      await page.waitForTimeout(4000);
      const rows = await readTrace(page);
      print(`${profile.tag} · ${label}`, rows);
      // The window in which the board is HIDDEN carries no framing — a 0×0
      // stage is not a frame anyone can see.
      return rows.filter((s) => !s.stage.startsWith('0.0,0.0 0.0x0.0') && s.cont !== 'none');
    }

    /** Every live frame must show the SAME framing the trip started from. */
    function expectStill(live: ReadonlyArray<Sample>, label: string): void {
      expect(live.length, `${label}: no live frames captured`).toBeGreaterThan(5);
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
      const settled = await unionMetrics(page);
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

      // …and STAYS. A convergence that is still creeping would show up here.
      await page.waitForTimeout(8000);
      const later = await unionMetrics(page);
      expect(later.scale, 'the framing kept moving after it reported rest').toBe(settled.scale);
      expect(Math.abs(later.dx - settled.dx)).toBeLessThan(1);
      expect(Math.abs(later.dy - settled.dy)).toBeLessThan(1);
    });

    test('a hand round trip does not re-frame the planet', async ({page, request}) => {
      await bootGame(page, request, 3, profile.query);
      await waitForFramingRest(page);
      console.log(`\n──── ${profile.tag} · union at rest ────\n            ${JSON.stringify(await unionMetrics(page))}`);

      // THREE trips: the defect oscillated rather than converged, so a single
      // trip could pass by luck on the half of the cycle that happened to
      // land back where it started.
      for (const pass of [1, 2, 3]) {
        expectStill(await roundTrip(page, `pass ${pass} · board → hand → board`), `pass ${pass}`);
      }

      // ── …and the engine is still ALIVE ────────────────────────────────
      // A guard that only asserts "nothing moved" is satisfied by a fit
      // engine that stopped working. A REAL frame change must still re-fit.
      const before = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim());
      await page.setViewportSize({
        width: Math.round(profile.viewport.width * 0.8),
        height: Math.round(profile.viewport.height * 0.8),
      });
      // The re-fit CONVERGES (several bounded passes, each gliding 300ms) —
      // wait for the new frame to come to rest, don't guess how long it takes.
      await waitForFramingRest(page);
      const after = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim());
      console.log(`\n──── ${profile.tag} · resize ────\n  --board-scale ${before} → ${after}`);
      expect(after, 'a real viewport change must still re-fit the board').not.toBe(before);

      // …and back. Resize-away-and-return is the one case that could leave a
      // STALE frame key matching a box the board no longer has — the guard
      // would then be passing on a board that simply refuses to re-fit.
      await page.setViewportSize(profile.viewport);
      await waitForFramingRest(page);
      const restored = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim());
      console.log(`  --board-scale ${after} → ${restored} (restored)`);
      expect(restored, 'returning to the original viewport must re-fit again').not.toBe(after);

      // And the frame it came back to must be just as stable as the first.
      expectStill(await roundTrip(page, 'after resize · board → hand → board'), 'after resize');
    });
  });
}
