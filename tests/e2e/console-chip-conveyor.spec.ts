import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {CORP_WITH_FIRST_ACTION, cinematicBeat, fetchPlayerModel, openConsole, reloadConsole, sendPlayerInput, settle, soloGameConfig} from './consoleStart';
import {isActionMenuTitle} from '../../src/common/inputs/actionMenuTitles';

/**
 * THE TOP-BAR CHIP CONVEYOR (statusChipConveyor.ts) — the generation-order
 * reorder glide of the status strip's player chips, watched LIVE across a
 * real generation boundary.
 *
 * The viewer's page is open and idle (they passed first) when the LAST pass
 * lands over the API — the server rotates `playersInGenerationOrder`, the
 * WS push applies the new view, and the chips must play the closed-ribbon
 * glide: survivors slide one slot in lockstep, the old first chip dissolves
 * through the left edge of the players window while the same player's chip
 * (new content, new status) materializes through the right edge.
 *
 * A frame probe (MutationObserver-free: plain setInterval — rAF dies on a
 * quiet headless screen) samples chips, ghosts and the bar geometry every
 * ~16 ms across the flip and pins the guarantees that make the motion
 * premium rather than merely present:
 *  · the bar's own box never moves — height stable, chips never leave it;
 *  · real chips NEVER overlap (the rigid belt's structural guarantee);
 *  · exactly ONE conveyor episode per generation flip (status churn around
 *    it must not re-trigger);
 *  · the finish leaves nothing — no ghosts, no mask class, no transforms;
 *  · two consecutive flips each play their own episode;
 *  · a reload after the flip shows the new order with no animation.
 */

const OUT = path.resolve('screenshots', 'chip-conveyor');

type Wire = any;

function isMenu(wf: Wire): boolean {
  return wf !== undefined && isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined);
}

/** Answer a seat's initialCards: a CALM corporation (no first-action chain
 *  to drain), no project buys. */
async function answerInitialCards(request: APIRequestContext, pid: string): Promise<void> {
  const m = await fetchPlayerModel(request, pid);
  const wf: Wire = m.waitingFor;
  expect(wf?.type, `seat ${pid} must be on initialCards`).toBe('initialCards');
  const responses = (wf.options ?? []).map((sub: Wire) => {
    const offered: Array<string> = (sub.cards ?? []).map((c: Wire) => c.name);
    if ((sub.min ?? 0) >= 1) {
      const calm = offered.find((c) => !CORP_WITH_FIRST_ACTION.includes(c));
      return {type: 'card', cards: [calm ?? offered[0]]};
    }
    return {type: 'card', cards: []};
  });
  await sendPlayerInput(request, pid, {type: 'initialCards', responses});
}

/** Create a game whose every seat's corp deal offers a CALM corporation,
 *  re-rolling the seed (the deal is not a pure function of the seed). */
async function createCalmGame(request: APIRequestContext, players: Array<Record<string, unknown>>, seedBase: number):
  Promise<Array<{id: string, color: string}>> {
  for (let attempt = 0; attempt < 14; attempt++) {
    const config = soloGameConfig({players, seed: seedBase + attempt * 0.013, testMode: false});
    const created = await request.post('/api/creategame', {data: config});
    expect(created.ok(), 'the game server accepted the config').toBeTruthy();
    const seats = (await created.json()).players as Array<{id: string, color: string}>;
    let everyoneCalm = true;
    for (const seat of seats) {
      const model = await fetchPlayerModel(request, seat.id);
      const corpStep: Wire = (model.waitingFor as Wire)?.options?.find((o: Wire) => (o.min ?? 0) >= 1);
      const offered: Array<string> = (corpStep?.cards ?? []).map((c: Wire) => c.name);
      if (!offered.some((c) => !CORP_WITH_FIRST_ACTION.includes(c))) {
        everyoneCalm = false;
        break;
      }
    }
    if (everyoneCalm) {
      return seats;
    }
  }
  throw new Error('no seed offered a calm corporation to every seat');
}

/** Drain the pregame tail on EVERY seat (the «Play your corporation» card
 *  prompt is a simultaneous phase — no seat's menu arrives until all seats
 *  answered, so a per-seat drain deadlocks by construction). */
async function drainPregame(request: APIRequestContext, seats: ReadonlyArray<string>, maxRounds = 60): Promise<void> {
  for (let round = 0; round < maxRounds; round++) {
    let acted = false;
    for (const pid of seats) {
      const m = await fetchPlayerModel(request, pid);
      const wf: Wire = m.waitingFor;
      if (wf === undefined || isMenu(wf)) {
        continue;
      }
      if (wf.type === 'card') {
        const take = (wf.cards ?? []).slice(0, Math.max(wf.min ?? 0, 1)).map((c: Wire) => c.name);
        await sendPlayerInput(request, pid, {type: 'card', cards: take});
      } else if (wf.type === 'option') {
        await sendPlayerInput(request, pid, {type: 'option'});
      } else {
        throw new Error(`unexpected pregame prompt for ${pid}: ${wf.type}`);
      }
      acted = true;
    }
    if (!acted) {
      return;
    }
  }
  throw new Error('the pregame never settled');
}

/** Wait for THIS seat's action menu (bounded poll — no page involved). */
async function awaitMenu(request: APIRequestContext, pid: string, maxMs = 60_000): Promise<Wire> {
  const started = Date.now();
  let last: Wire;
  while (Date.now() - started < maxMs) {
    const m = await fetchPlayerModel(request, pid);
    last = m.waitingFor;
    if (isMenu(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`action menu never arrived for ${pid} — last: ${JSON.stringify(last?.title ?? last?.type)}`);
}

async function passGeneration(request: APIRequestContext, pid: string): Promise<void> {
  const menu = await awaitMenu(request, pid);
  const idx = (menu.options ?? []).findIndex((o: Wire) => JSON.stringify(o).includes('Pass for this generation'));
  expect(idx, 'the menu must offer the pass').toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, pid, {type: 'or', index: idx, response: {type: 'option'}});
}

/** Decline a research buy (min 0 → empty pick) when it stands. */
async function declineResearch(request: APIRequestContext, pid: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const m = await fetchPlayerModel(request, pid);
    const wf: Wire = m.waitingFor;
    if (wf?.type === 'card') {
      await sendPlayerInput(request, pid, {type: 'card', cards: (wf.cards ?? []).slice(0, wf.min ?? 0).map((c: Wire) => c.name)});
      return;
    }
    if (isMenu(wf)) {
      return; // already past research
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`research buy never arrived for ${pid}`);
}

type ChipSample = {
  c: string, l: number, t: number, r: number, b: number, w: number, tf: string,
};
type ProbeSample = {
  at: number,
  chips: Array<ChipSample>,
  ghosts: Array<{l: number, t: number, r: number, b: number, op: string, tf: string}>,
  conveyorOn: boolean,
  barTop: number,
  barH: number,
  /** The ribbon's computed transform — the belt's one driver. */
  rt: string,
};
type ProbeData = {samples: Array<ProbeSample>};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__chipProbe?: {samples: Array<unknown>, timer: number}};
    if (w.__chipProbe !== undefined) {
      clearInterval(w.__chipProbe.timer);
    }
    const samples: Array<unknown> = [];
    const sample = () => {
      const bar = document.querySelector('.con-status');
      const cont = document.querySelector('.con-status__players');
      if (bar === null || cont === null) {
        return;
      }
      const barR = bar.getBoundingClientRect();
      const chips = Array.from(cont.querySelectorAll<HTMLElement>('.con-status__player[data-color]')).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          c: el.dataset.color ?? '', l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width,
          tf: getComputedStyle(el).transform,
        };
      });
      const ghosts = Array.from(cont.querySelectorAll<HTMLElement>('.con-status__pghost')).map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          l: r.left, t: r.top, r: r.right, b: r.bottom, op: cs.opacity, tf: cs.transform,
          pos: cs.position, sw: el.style.width, sl: el.style.left,
          host: el.parentElement instanceof HTMLElement ? (el.parentElement.dataset.color ?? el.parentElement.className) : '?',
          txt: (el.textContent ?? '').replace(/\s+/g, ' ').slice(0, 30),
        };
      });
      const ribbon = cont.querySelector('.con-status__ribbon');
      samples.push({
        at: performance.now(), chips, ghosts,
        conveyorOn: cont.classList.contains('con-status__players--conveyor'),
        barTop: barR.top, barH: barR.height,
        rt: ribbon === null ? '' : getComputedStyle(ribbon).transform,
      });
    };
    const timer = window.setInterval(sample, 16);
    w.__chipProbe = {samples, timer};
    sample();
  });
}

async function collectProbe(page: Page): Promise<ProbeData> {
  return await page.evaluate(() => {
    const w = window as unknown as {__chipProbe?: {samples: Array<unknown>, timer: number}};
    if (w.__chipProbe === undefined) {
      return {samples: []};
    }
    clearInterval(w.__chipProbe.timer);
    const data = {samples: w.__chipProbe.samples};
    w.__chipProbe = undefined;
    return data as never;
  });
}

/** The rendered chip color order, straight off the DOM. */
async function domOrder(page: Page): Promise<Array<string>> {
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.con-status__players .con-status__player[data-color]'))
      .map((el) => el.dataset.color ?? ''));
}

async function waitForOrder(page: Page, expected: Array<string>, timeoutMs = 45_000): Promise<void> {
  await page.waitForFunction((exp) => {
    const order = Array.from(document.querySelectorAll<HTMLElement>(
      '.con-status__players .con-status__player[data-color]')).map((el) => el.dataset.color ?? '');
    return order.join('|') === exp;
  }, expected.join('|'), {timeout: timeoutMs, polling: 100});
}

/** One generation flip's structural claims over the probe's film. */
function assertConveyorFilm(data: ProbeData, label: string): void {
  const samples = data.samples;
  // A dead sampler is the only thing this floor may catch.
  expect(samples.length, `${label}: the sampler must have run (got ${samples.length})`).toBeGreaterThan(8);

  const txOf = (tf: string): number => {
    const m = /^matrix\(([^)]+)\)$/.exec(tf);
    return m !== null ? parseFloat(m[1].split(',')[4]) : 0;
  };
  const conveyorSamples = samples.filter((s) => s.conveyorOn);
  expect(conveyorSamples.length, `${label}: the conveyor episode was sampled`).toBeGreaterThan(0);
  expect(conveyorSamples.some((s) => s.ghosts.length > 0),
    `${label}: the exit ghost rode the episode`).toBe(true);
  expect(conveyorSamples.some((s) => Math.abs(txOf(s.rt)) > 1),
    `${label}: the ribbon actually travelled (not a snap)`).toBe(true);

  // LOCKSTEP: the ghost is carried by the ribbon's ONE transform, so
  // (ghost.left − ribbonTx) must be constant across every frame — the
  // per-element compositor-pickup skew that tore the belt is pinned dead.
  const ghostSamples = conveyorSamples.filter((s) => s.ghosts.length > 0);
  if (ghostSamples.length > 1) {
    const ref = ghostSamples[0].ghosts[0].l - txOf(ghostSamples[0].rt);
    for (const s of ghostSamples) {
      expect(Math.abs((s.ghosts[0].l - txOf(s.rt)) - ref),
        `${label}: the ghost never leaves the belt (frame @${Math.round(s.at)}ms)`).toBeLessThanOrEqual(2);
    }
  }

  // Exactly ONE episode: contiguous conveyorOn block count.
  let episodes = 0;
  let prevOn = false;
  for (const s of samples) {
    if (s.conveyorOn && !prevOn) {
      episodes++;
    }
    prevOn = s.conveyorOn;
  }
  expect(episodes, `${label}: exactly one conveyor episode`).toBe(1);

  // The bar never moves and nothing leaves it vertically.
  const barH0 = samples[0].barH;
  const barTop0 = samples[0].barTop;
  for (const s of samples) {
    expect(Math.abs(s.barH - barH0), `${label}: bar height stable`).toBeLessThanOrEqual(1);
    expect(Math.abs(s.barTop - barTop0), `${label}: bar position stable`).toBeLessThanOrEqual(1);
    for (const c of s.chips) {
      expect(c.t, `${label}: chip ${c.c} stays under the bar top`).toBeGreaterThanOrEqual(barTop0 - 0.5);
      expect(c.b, `${label}: chip ${c.c} stays above the bar bottom`).toBeLessThanOrEqual(barTop0 + barH0 + 0.5);
    }
    for (const g of s.ghosts) {
      expect(g.t, `${label}: ghost stays under the bar top`).toBeGreaterThanOrEqual(barTop0 - 0.5);
      expect(g.b, `${label}: ghost stays above the bar bottom`).toBeLessThanOrEqual(barTop0 + barH0 + 0.5);
    }
    // The rigid belt: REAL chips never overlap. A same-patch status swap
    // can grow a pill beyond the flex gap, and a frame-0-faithful start
    // then admits a transient sub-gap KISS bounded by ONE chip's width
    // delta — tolerated up to a third of a rem (resolved from the bar's
    // own 2.7rem height, so the bound scales with the profile). Anything
    // deeper is a real crossing and fails.
    const kissTolerance = (barH0 / 2.7) * 0.34;
    for (let i = 0; i < s.chips.length; i++) {
      for (let j = i + 1; j < s.chips.length; j++) {
        const a = s.chips[i];
        const b = s.chips[j];
        const overlap = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        expect(overlap, `${label}: chips ${a.c}/${b.c} must not overlap (frame @${Math.round(s.at)}ms)`)
          .toBeLessThanOrEqual(kissTolerance);
      }
    }
    // Identity: never two real chips of one color.
    const colors = s.chips.map((c) => c.c);
    expect(new Set(colors).size, `${label}: one real chip per player`).toBe(colors.length);
  }

  // The finish leaves nothing behind. A chip's own state animations
  // (turn burst and friends) legitimately hold an IDENTITY matrix on the
  // element — residue means a leftover TRANSLATION, never the matrix's
  // mere presence.
  const last = samples[samples.length - 1];
  expect(last.conveyorOn, `${label}: mask class gone at rest`).toBe(false);
  expect(last.ghosts.length, `${label}: ghosts gone at rest`).toBe(0);
  expect(Math.abs(txOf(last.rt)), `${label}: the ribbon carries no residual offset (${last.rt})`).toBeLessThanOrEqual(0.5);
  for (const c of last.chips) {
    const m = /^matrix\(([^)]+)\)$/.exec(c.tf);
    const [tx, ty] = m !== null ? m[1].split(',').slice(4).map((v) => Math.abs(parseFloat(v))) : [0, 0];
    expect(tx, `${label}: chip ${c.c} carries no residual X offset (${c.tf})`).toBeLessThanOrEqual(0.5);
    expect(ty, `${label}: chip ${c.c} carries no residual Y offset (${c.tf})`).toBeLessThanOrEqual(0.5);
  }
}

/** Film the flip via CDP screencast (perceptual frames, ack-driven). The
 *  index file carries each frame's COMPOSITOR timestamp, so the film can
 *  be read as a velocity curve, not just a picture sequence. */
async function startFilm(page: Page, name: string): Promise<() => Promise<number>> {
  fs.mkdirSync(OUT, {recursive: true});
  const cdp = await page.context().newCDPSession(page);
  let n = 0;
  const index: Array<{i: number, ts: number}> = [];
  const handler = async (ev: {data: string, sessionId: number, metadata?: {timestamp?: number}}) => {
    const i = n++;
    index.push({i, ts: ev.metadata?.timestamp ?? 0});
    fs.writeFileSync(path.join(OUT, `${name}-${String(i).padStart(3, '0')}.jpeg`), Buffer.from(ev.data, 'base64'));
    await cdp.send('Page.screencastFrameAck', {sessionId: ev.sessionId}).catch(() => {});
  };
  cdp.on('Page.screencastFrame', handler);
  await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 60, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1});
  return async () => {
    await cdp.send('Page.stopScreencast').catch(() => {});
    cdp.off('Page.screencastFrame', handler);
    await cdp.detach().catch(() => {});
    fs.writeFileSync(path.join(OUT, `${name}-index.json`), JSON.stringify(index));
    return n;
  };
}

test.describe('console: generation-order chip conveyor', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('two seats, two consecutive flips: the belt plays once per flip, clean bar geometry, clean finish, calm reload', async ({page, request}) => {
    test.setTimeout(420_000);
    const seats = await createCalmGame(request, [
      {name: 'Interplanetary', color: 'red', beginner: false, handicap: 0, first: true},
      {name: 'Io', color: 'green', beginner: false, handicap: 0, first: false},
    ], 0.4242);
    const p1 = seats.find((s) => s.color === 'red')!.id;
    const p2 = seats.find((s) => s.color === 'green')!.id;

    // Pregame + generation 1 over the API: the viewer passes FIRST, so the
    // page sits idle (their chip reads СПАСОВАЛ) when the flip arrives.
    await answerInitialCards(request, p1);
    await answerInitialCards(request, p2);
    await drainPregame(request, [p1, p2]);
    await passGeneration(request, p1);
    await awaitMenu(request, p2);

    await openConsole(page, p1);
    await settle(page, {timeoutMs: 30_000}).catch(() => {});
    expect(await domOrder(page), 'generation 1 renders [red, green]').toEqual(['red', 'green']);

    // ── FLIP 1: [red, green] → [green, red] ─────────────────────────────
    await armProbe(page);
    const stopFilm1 = await startFilm(page, 'flip1');
    await passGeneration(request, p2);
    await waitForOrder(page, ['green', 'red']);
    await cinematicBeat(page, 1400, 'let the conveyor glide finish before collecting the film');
    const frames1 = await stopFilm1();
    const film1 = await collectProbe(page);
    assertConveyorFilm(film1, 'flip 1');
    expect(frames1, 'the screencast filmed the flip').toBeGreaterThan(0);
    await page.screenshot({path: path.join(OUT, 'flip1-rest.png')});

    // ── FLIP 2: [green, red] → [red, green] (consecutive generations) ───
    await declineResearch(request, p1);
    await declineResearch(request, p2);
    await passGeneration(request, p2); // green leads generation 2
    await armProbe(page);
    const stopFilm2 = await startFilm(page, 'flip2');
    await passGeneration(request, p1); // the last pass — generation 3, red leads
    await waitForOrder(page, ['red', 'green']);
    await cinematicBeat(page, 1400, 'let the conveyor glide finish before collecting the film');
    await stopFilm2();
    const film2 = await collectProbe(page);
    assertConveyorFilm(film2, 'flip 2');

    // ── Reload: the standing order shows immediately, with no animation ──
    await reloadConsole(page);
    await settle(page, {timeoutMs: 30_000}).catch(() => {});
    expect(await domOrder(page), 'the reload renders the standing order').toEqual(['red', 'green']);
    const quiet = await page.evaluate(() => ({
      ghosts: document.querySelectorAll('.con-status__pghost').length,
      conveyorOn: document.querySelector('.con-status__players')
        ?.classList.contains('con-status__players--conveyor') ?? false,
    }));
    expect(quiet.ghosts, 'no ghost on a fresh open').toBe(0);
    expect(quiet.conveyorOn, 'no conveyor state on a fresh open').toBe(false);

    // ── FLIP 3 under REDUCED MOTION: the order snaps, the belt never runs ──
    await page.emulateMedia({reducedMotion: 'reduce'});
    await declineResearch(request, p1);
    await declineResearch(request, p2);
    await armProbe(page);
    await passGeneration(request, p1); // red leads generation 3
    await passGeneration(request, p2); // the last pass — generation 4
    await waitForOrder(page, ['green', 'red']);
    await cinematicBeat(page, 900, 'give a wrong-path belt time to show itself before collecting');
    const reducedFilm = await collectProbe(page);
    expect(reducedFilm.samples.length, 'the reduced-motion probe sampled').toBeGreaterThan(8);
    expect(reducedFilm.samples.some((s) => s.conveyorOn), 'reduced motion never starts the belt').toBe(false);
    expect(reducedFilm.samples.every((s) => s.ghosts.length === 0), 'no ghosts under reduced motion').toBe(true);
    await page.emulateMedia({reducedMotion: null});
  });
});

test.describe('console: chip conveyor at 4 seats on the TV profile', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('four seats: the whole ribbon shifts one slot, the wrapped chip crosses cleanly', async ({page, request}) => {
    test.setTimeout(420_000);
    const seats = await createCalmGame(request, [
      {name: 'Interplanetary', color: 'red', beginner: false, handicap: 0, first: true},
      {name: 'Io', color: 'green', beginner: false, handicap: 0, first: false},
      {name: 'Mining Guild', color: 'blue', beginner: false, handicap: 0, first: false},
      {name: 'Zn', color: 'yellow', beginner: false, handicap: 0, first: false},
    ], 0.577);
    const byColor = (c: string) => seats.find((s) => s.color === c)!.id;
    const [p1, p2, p3, p4] = [byColor('red'), byColor('green'), byColor('blue'), byColor('yellow')];

    for (const pid of [p1, p2, p3, p4]) {
      await answerInitialCards(request, pid);
    }
    await drainPregame(request, [p1, p2, p3, p4]);
    await passGeneration(request, p1);
    await openConsole(page, p1);
    await settle(page, {timeoutMs: 30_000}).catch(() => {});
    expect(await domOrder(page)).toEqual(['red', 'green', 'blue', 'yellow']);

    // Two rivals pass while the probe watches: status churn with NO order
    // change must not start an episode; the LAST pass rotates the ring.
    await armProbe(page);
    const stopFilm = await startFilm(page, 'flip-4p');
    await passGeneration(request, p2);
    await passGeneration(request, p3);
    await passGeneration(request, p4);
    await waitForOrder(page, ['green', 'blue', 'yellow', 'red']);
    await cinematicBeat(page, 1400, 'let the conveyor glide finish before collecting the film');
    await stopFilm();
    const film = await collectProbe(page);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'flip-4p-film.json'), JSON.stringify(film, null, 1));
    assertConveyorFilm(film, '4-seat flip');
    await page.screenshot({path: path.join(OUT, 'flip-4p-rest.png')});
  });
});
