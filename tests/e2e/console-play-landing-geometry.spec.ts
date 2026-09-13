import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, cinematicBeat, createGameWithCards, fillPicks, focusCard, openConsole, pickCards, playStartQueue,
  press, readiness, settle, submitSummary, walkToSummary,
} from './consoleStart';

/**
 * THE PLAY LANDING — geometry + tempo witness, for BOTH doors a card is
 * played through: the hand workspace (the embedded «РАЗЫГРАНО» receiving
 * stage) and the Game Start Workspace's queue (the compact played dock).
 *
 * The player reported two things about the landing: the flying card's END
 * position does not match the static card's, and the handoff between the two
 * representations JERKS. Both are boundary facts — a few frames around the
 * moment the proxy stops and the real card is revealed — so this spec records
 * the whole episode IN-PAGE at ~8 ms (a MutationObserver + a setInterval, never
 * rAF — headless Chromium stops rAF on a quiet screen) and measures:
 *
 *   · the LAST fully-opaque proxy frame's card box vs the FIRST painted real
 *     card box (dx / dy / dw / dh — the geometry mismatch, in px);
 *   · proxy motion AFTER the reveal (a corrective glide over an already
 *     painted card = the «jerk»), and the HOVER before the flight (dead time);
 *   · GAP frames (no card visible) and TWIN frames (proxy + real card both
 *     painted at partial opacity — a crossfade window);
 *   · whether the two faces are the SAME picture (the `.pcard` class
 *     signature — a tier swap at the handoff is a flash);
 *   · the TEMPO: press → landing → reveal → proxy gone → workspace folded →
 *     next input accepted (holds empty, no request, no transport gate).
 *
 * Hand plays run at FHD, the 4K TV profile and the Deck viewport; the start
 * queue at FHD.
 */

/** Recordings + frame records; `PROBE_OUT=<suffix>` files a BEFORE/AFTER run apart. */
const OUT_DIR = path.resolve('screenshots', `play-landing-geometry${process.env.PROBE_OUT !== undefined ? `-${process.env.PROBE_OUT}` : ''}`);

type Rect = {x: number, y: number, w: number, h: number} | null;

type Frame = {
  t: number,
  seq: number,
  gameAge: number,
  req: boolean,
  holding: boolean,
  holds: string,
  proxy: Rect,
  proxyOp: number,
  proxyCard: Rect,
  proxyCls: string,
  front: Rect,
  frontKey: string,
  faceCard: Rect,
  faceCls: string,
  stageUp: boolean,
  hand: boolean,
  composer: boolean,
  pulse: boolean,
};

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: ''},
] as const;

/** Blue → blue → event: empty family, occupied family, the face-down pile. */
const PLAYS: ReadonlyArray<{card: string, kind: 'active' | 'event'}> = [
  {card: 'Earth Office', kind: 'active'},
  {card: 'Rover Construction', kind: 'active'},
  {card: 'Special Design', kind: 'event'},
];

function rectStr(r: Rect): string {
  return r === null ? '-' : `${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.w.toFixed(1)}×${r.h.toFixed(1)}`;
}

function delta(a: Rect, b: Rect): {dx: number, dy: number, dw: number, dh: number} | undefined {
  if (a === null || b === null) {
    return undefined;
  }
  return {dx: b.x - a.x, dy: b.y - a.y, dw: b.w - a.w, dh: b.h - a.h};
}

function magnitude(a: Rect, b: Rect): number {
  const d = delta(a, b);
  return d === undefined ? 0 : Math.max(Math.abs(d.dx), Math.abs(d.dy), Math.abs(d.dw), Math.abs(d.dh));
}

/**
 * Arm the in-page recorder (window.__lg). Samples at 8 ms + on every mutation.
 * `mode` picks the destination: the hand's receiving stage front anchor, or
 * the start dock's ARMED top slot (tracked as an ELEMENT — it is persistent,
 * so it stays the landing place after it loses the armed attribute).
 */
async function armRecorder(page: Page, mode: 'hand' | 'start'): Promise<void> {
  await page.evaluate((mode) => {
    const w = window as unknown as {__lg?: {frames: Array<unknown>, stop: () => void}, __conReady?: () => {
      input: {seq: number}, holds: Array<string>,
      transport?: {gameAge: number, requestInProgress: boolean, holding: boolean},
    }};
    w.__lg?.stop();
    const frames: Array<unknown> = [];
    const rect = (el: Element | null | undefined) => {
      if (el === null || el === undefined) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    let last = -1;
    let trackedTop: HTMLElement | null = null;
    // IN-PAGE MARKS for a `--trace on` run: the trace records page console
    // messages with timestamps beside its screencast frames, so the frames
    // around the landing can be pulled out by these marks afterwards.
    const marked = new Set<string>();
    const mark = (what: string) => {
      if (!marked.has(what)) {
        marked.add(what);
        console.log(`[probe-mark] ${what} t=${Math.round(performance.now())}`);
      }
    };
    // A VISIBLE PHASE BEACON for the video recording (fixed, out of flow —
    // it changes no layout the recorder measures): red = a proxy is in the
    // air, yellow = proxy + revealed card both painted (the handoff frames),
    // green = only the real card, black = neither. Frame-by-frame review of
    // the webm finds the boundary by colour.
    let beacon = document.getElementById('__lg-beacon');
    if (beacon === null) {
      beacon = document.createElement('div');
      beacon.id = '__lg-beacon';
      beacon.style.cssText = 'position:fixed;left:0;top:0;width:36px;height:36px;z-index:2147483647;pointer-events:none;background:#000';
      document.body.appendChild(beacon);
    }
    const sample = () => {
      const now = performance.now();
      if (now - last < 4) {
        return;
      }
      last = now;
      const ready = w.__conReady?.();
      const proxy = document.querySelector<HTMLElement>('.con-played-hero__proxy');
      let front: HTMLElement | null;
      if (mode === 'hand') {
        front = document.querySelector<HTMLElement>('.con-composer__playstage [data-recv-front]');
      } else {
        const armed = document.querySelector<HTMLElement>('.con-start__played [data-start-front]');
        if (armed !== null) {
          trackedTop = armed;
        }
        front = trackedTop !== null && trackedTop.isConnected ? trackedTop : null;
      }
      // The REAL card at the landing place: a face-up card's `.pcard`, or the
      // events pile's back (a face-down landing has no printed face) — and the
      // proxy's matching side (its back is what an event shows at the landing).
      const faceCard = front?.querySelector<HTMLElement>('.pcard, .con-card-back') ?? null;
      const proxyCard = faceCard !== null && faceCard.classList.contains('con-card-back') ?
        (proxy?.querySelector<HTMLElement>('.con-deal-proxy__back .con-card-back') ?? proxy?.querySelector<HTMLElement>('.pcard') ?? null) :
        (proxy?.querySelector<HTMLElement>('.pcard') ?? null);
      if (proxy !== null) {
        mark('proxy');
      }
      const revealedNow = (front?.getAttribute('data-played-key') ?? '') !== '';
      if (revealedNow) {
        mark('reveal');
      }
      if (proxy === null && marked.has('reveal')) {
        mark('proxy-gone');
      }
      const proxyShown = proxy !== null && Number(getComputedStyle(proxy).opacity) > 0.02;
      if (beacon !== null) {
        beacon.style.background = proxyShown && revealedNow ? '#ff0' : (proxyShown ? '#f00' : (revealedNow ? '#0f0' : '#000'));
      }
      frames.push({
        t: Math.round(now * 10) / 10,
        seq: ready?.input.seq ?? -1,
        gameAge: ready?.transport?.gameAge ?? -1,
        req: ready?.transport?.requestInProgress === true,
        holding: ready?.transport?.holding === true,
        holds: (ready?.holds ?? []).join('|'),
        proxy: rect(proxy),
        proxyOp: proxy === null ? 0 : Number(getComputedStyle(proxy).opacity),
        proxyCard: rect(proxyCard),
        proxyCls: proxyCard === null ? '' : proxyCard.className,
        front: rect(front),
        frontKey: front?.getAttribute('data-played-key') ?? '',
        faceCard: rect(faceCard),
        faceCls: faceCard === null ? '' : faceCard.className,
        stageUp: mode === 'hand' ? document.querySelector('.con-composer__playstage--up') !== null :
          document.querySelector('.con-start') !== null,
        hand: document.querySelector('.con-hand') !== null,
        composer: document.querySelector('.con-composer--play') !== null,
        pulse: document.querySelector('.con-recv__front--pulse') !== null,
      });
    };
    sample();
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    const iv = setInterval(sample, 8);
    w.__lg = {
      frames,
      stop: () => {
        mo.disconnect();
        clearInterval(iv);
        beacon?.remove();
      },
    };
  }, mode);
}

async function takeRecording(page: Page): Promise<Array<Frame>> {
  return page.evaluate(() => {
    const w = window as unknown as {__lg?: {frames: Array<Frame>, stop: () => void}};
    w.__lg?.stop();
    return w.__lg?.frames ?? [];
  });
}

type Report = {
  profile: string,
  card: string,
  kind: string,
  samples: number,
  /** Wall-clock ms of the press that started the episode (video alignment). */
  pressWall: number,
  tPress: number,
  tProxyFirst: number,
  /** Dead time between the lift and the flight (the proxy stands still). */
  hoverMs: number,
  tFlightStart: number,
  tLanded: number,
  tReveal: number,
  tProxyGone: number,
  tFold: number,
  tReady: number,
  /** Geometry at the boundary (px): last opaque proxy card box → real card box. */
  boundary: {dx: number, dy: number, dw: number, dh: number} | undefined,
  /** Where the proxy stood when it LANDED (before any correction) vs the real card. */
  landingError: {dx: number, dy: number, dw: number, dh: number} | undefined,
  /** Max proxy displacement AFTER the reveal (a correction over a painted card). */
  glideAfterReveal: number,
  /** The target moved while the card was in flight (px). */
  targetMoveInFlight: number,
  gapFrames: number,
  twinFrames: number,
  twinMs: number,
  pulseFrames: number,
  classMismatch: boolean,
  proxyCls: string,
  faceCls: string,
  /** The recorder's median sample gap over the flight — the page's cadence. */
  medianGapMs: number,
};

function analyse(frames: ReadonlyArray<Frame>, profile: string, card: string, kind: string, seq0: number, revealKey: string): Report {
  const t0 = frames[0]?.t ?? 0;
  const at = (i: number) => (i < 0 || i >= frames.length ? -1 : Math.round(frames[i].t - t0));
  const visible = (f: Frame) => f.proxy !== null && f.proxyOp > 0.02;
  const iProxyFirst = frames.findIndex(visible);
  // THE PRESS THAT ACTED: the last input echo before the hero appeared (a
  // swallowed earlier press is the driver's retry, not the episode's start).
  let iPress = frames.findIndex((f) => f.seq > seq0);
  for (let i = (iProxyFirst >= 0 ? iProxyFirst : frames.length) - 1; i > 0; i--) {
    if (frames[i].seq > frames[i - 1].seq) {
      iPress = i;
      break;
    }
  }
  let iProxyGone = -1;
  if (iProxyFirst >= 0) {
    for (let i = iProxyFirst; i < frames.length; i++) {
      if (!visible(frames[i])) {
        iProxyGone = i;
        break;
      }
    }
  }
  const end = iProxyGone === -1 ? frames.length : iProxyGone;
  const iReveal = frames.findIndex((f) => f.frontKey === revealKey && f.faceCard !== null);
  // Stationary runs of the proxy (≥ 3 samples within 0.6 px).
  const still = (i: number) => i + 2 < end &&
    magnitude(frames[i].proxy, frames[i + 1].proxy) <= 0.6 && magnitude(frames[i].proxy, frames[i + 2].proxy) <= 0.6;
  // HOVER: the first stationary run that starts ≥ 80 ms after the proxy appeared
  // and ends before the reveal — the card waits for its target.
  let hoverMs = 0;
  let iFlightStart = -1;
  if (iProxyFirst >= 0) {
    let i = iProxyFirst;
    while (i < end && frames[i].t - frames[iProxyFirst].t < 80) {
      i++;
    }
    let hoverFrom = -1;
    for (; i < end; i++) {
      if (still(i)) {
        if (hoverFrom === -1) {
          hoverFrom = i;
        }
      } else if (hoverFrom !== -1) {
        // the run ended: this is the flight start if a big move follows
        const moveAhead = frames.slice(i, Math.min(end, i + 20)).some((f) => magnitude(frames[hoverFrom].proxy, f.proxy) > 12);
        if (moveAhead) {
          // Only the time the PAGE WAS RUNNING counts: a sample gap over 50 ms
          // is a main-thread stall (a loaded 4K runner), during which nothing
          // could have flown — it is neither a wait nor a hover.
          let live = 0;
          for (let j = hoverFrom + 1; j <= i; j++) {
            const gap = frames[j].t - frames[j - 1].t;
            if (gap <= 50) {
              live += gap;
            }
          }
          hoverMs = Math.round(live);
          iFlightStart = i;
          break;
        }
        hoverFrom = -1;
      }
    }
  }
  // LANDED: the start of the LAST stationary run before the reveal (or before
  // the proxy went, when there is no reveal at all).
  let iLanded = -1;
  const landedLimit = iReveal >= 0 ? Math.min(iReveal, end) : end;
  for (let i = landedLimit - 1; i >= Math.max(0, iProxyFirst); i--) {
    if (still(i)) {
      iLanded = i;
    } else if (iLanded >= 0) {
      break;
    }
  }
  let glideAfterReveal = 0;
  if (iReveal >= 0) {
    const base = frames[iReveal].proxy;
    for (let i = iReveal; i < end; i++) {
      glideAfterReveal = Math.max(glideAfterReveal, magnitude(base, frames[i].proxy));
    }
  }
  let iOpaqueLast = -1;
  for (let i = end - 1; i >= Math.max(0, iProxyFirst); i--) {
    if (frames[i].proxy !== null && frames[i].proxyOp >= 0.98) {
      iOpaqueLast = i;
      break;
    }
  }
  const boundary = iOpaqueLast >= 0 && iReveal >= 0 ? delta(frames[iOpaqueLast].proxyCard, frames[iReveal].faceCard) : undefined;
  const landingError = iLanded >= 0 && iReveal >= 0 ? delta(frames[iLanded].proxyCard, frames[iReveal].faceCard) : undefined;
  let targetMoveInFlight = 0;
  if (iFlightStart >= 0 && iLanded > iFlightStart) {
    const base = frames[iFlightStart].front;
    for (let i = iFlightStart; i <= iLanded; i++) {
      targetMoveInFlight = Math.max(targetMoveInFlight, magnitude(base, frames[i].front));
    }
  }
  let gapFrames = 0;
  let twinFrames = 0;
  let twinMs = 0;
  let pulseFrames = 0;
  if (iProxyFirst >= 0) {
    for (let i = iProxyFirst; i < Math.min(frames.length, end + 40); i++) {
      const f = frames[i];
      const proxyShown = f.proxy !== null && f.proxyOp > 0.5;
      const realShown = f.frontKey === revealKey && f.faceCard !== null;
      if (!proxyShown && !realShown && f.stageUp) {
        gapFrames++;
      }
      if (f.proxy !== null && f.proxyOp > 0.05 && f.proxyOp < 0.95 && realShown) {
        twinFrames++;
        if (i + 1 < frames.length) {
          twinMs += frames[i + 1].t - f.t;
        }
      }
      if (f.pulse) {
        pulseFrames++;
      }
    }
  }
  const iFold = frames.findIndex((f, i) => i > Math.max(0, iPress) && !f.hand);
  let iReady = -1;
  const readyFrom = iFold >= 0 ? iFold : (iProxyGone >= 0 ? iProxyGone : -1);
  if (readyFrom >= 0) {
    for (let i = readyFrom; i < frames.length; i++) {
      const f = frames[i];
      if (f.holds === '' && !f.req && !f.holding) {
        let ok = true;
        for (let j = i; j < frames.length && frames[j].t - f.t < 300; j++) {
          if (frames[j].holds !== '' || frames[j].req || frames[j].holding) {
            ok = false;
            break;
          }
        }
        if (ok) {
          iReady = i;
          break;
        }
      }
    }
  }
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const proxyCls = iOpaqueLast >= 0 ? norm(frames[iOpaqueLast].proxyCls) : '';
  const faceCls = iReveal >= 0 ? norm(frames[iReveal].faceCls) : '';
  // A FACE-DOWN landing compares two card BACKS: the same sleeve art under
  // different positioning classes (`--flyer` on the proxy, the pile's own on
  // the slot) — the picture is the same; only a printed face can differ.
  const bothBacks = proxyCls.includes('con-card-back') && faceCls.includes('con-card-back');
  // The page's own cadence over the flight (a starved 4K frame stretches
  // every wait): the hover budget is expressed in frames, not ms.
  const gaps: Array<number> = [];
  for (let i = Math.max(1, iProxyFirst); i < end; i++) {
    gaps.push(frames[i].t - frames[i - 1].t);
  }
  gaps.sort((a, b) => a - b);
  const medianGapMs = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 8;
  return {
    profile, card, kind, samples: frames.length, pressWall: 0,
    tPress: at(iPress), tProxyFirst: at(iProxyFirst), hoverMs, tFlightStart: at(iFlightStart), tLanded: at(iLanded),
    tReveal: at(iReveal), tProxyGone: at(iProxyGone), tFold: at(iFold), tReady: at(iReady),
    boundary, landingError,
    glideAfterReveal: Math.round(glideAfterReveal * 10) / 10,
    targetMoveInFlight: Math.round(targetMoveInFlight * 10) / 10,
    gapFrames, twinFrames, twinMs: Math.round(twinMs), pulseFrames,
    classMismatch: !bothBacks && proxyCls !== '' && faceCls !== '' && proxyCls !== faceCls,
    proxyCls, faceCls,
    medianGapMs: Math.round(medianGapMs * 10) / 10,
  };
}

function printReport(r: Report, frames: ReadonlyArray<Frame>, revealKey: string): void {
  const fmt = (d: Report['boundary']) => (d === undefined ? '-' : `dx=${d.dx.toFixed(1)} dy=${d.dy.toFixed(1)} dw=${d.dw.toFixed(1)} dh=${d.dh.toFixed(1)}`);
  console.log(`[landing:${r.profile}:${r.card}] samples=${r.samples} press=${r.tPress} proxy=${r.tProxyFirst} hover=${r.hoverMs}ms flight=${r.tFlightStart}→${r.tLanded} ` +
    `reveal=${r.tReveal} proxyGone=${r.tProxyGone} fold=${r.tFold} ready=${r.tReady}`);
  console.log(`[landing:${r.profile}:${r.card}] landingError ${fmt(r.landingError)} | boundary ${fmt(r.boundary)} | glideAfterReveal=${r.glideAfterReveal}px ` +
    `targetMoveInFlight=${r.targetMoveInFlight}px gap=${r.gapFrames} twin=${r.twinFrames}(${r.twinMs}ms) pulse=${r.pulseFrames} classMismatch=${r.classMismatch} cadence=${r.medianGapMs}ms`);
  if (r.classMismatch) {
    console.log(`[landing:${r.profile}:${r.card}] proxy=«${r.proxyCls}» real=«${r.faceCls}»`);
  }
  const t0 = frames[0]?.t ?? 0;
  const iReveal = frames.findIndex((f) => f.frontKey === revealKey && f.faceCard !== null);
  const from = Math.max(0, iReveal - 10);
  const to = Math.min(frames.length, iReveal + 18);
  for (let i = from; i < to; i++) {
    const f = frames[i];
    console.log(`  ${String(Math.round(f.t - t0)).padStart(5)} prx=${f.proxy === null ? '-' : rectStr(f.proxyCard)} op=${f.proxyOp.toFixed(2)} ` +
      `| front=${rectStr(f.front)} key=${f.frontKey === '' ? '-' : '✓'} face=${rectStr(f.faceCard)} | holds=${f.holds}`);
  }
}

/** Descend into the play composer for `card` (hand screen → cursor → A). */
async function descendIntoPlay(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 700);
    await press(page, 'Enter', 1200);
  }
  await expect(page.locator('.con-hand')).toBeVisible({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 25_000}).catch(() => {});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, Math.max(20, slots * 3)), `hand cursor never reached ${card}`).toBeTruthy();
  await press(page, 'Enter', 700);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 10_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
  await settle(page, {timeoutMs: 20_000, quietMs: 400});
}

async function runHandLanding(page: Page, profile: string, play: {card: string, kind: string}): Promise<Report> {
  await descendIntoPlay(page, play.card);
  const before = await readiness(page);
  const seq0 = before?.input.seq ?? 0;
  await armRecorder(page, 'hand');
  // A · Разыграть — act → verify → retry: a press landing on a busy 4K frame
  // is deliberately consumed by the console, and a swallowed press used to
  // stand this whole test on the composer for its 30 s budget. The
  // recorder's clock starts at the press that ACTED (the last echo before the
  // hero appears), so a retry never inflates the tempo numbers.
  const started = page.locator('.con-composer--landing, .con-played-hero');
  let pressWall = 0;
  for (let i = 0; i < 4 && await started.count() === 0; i++) {
    pressWall = Date.now();
    await press(page, 'Enter', 0);
    await started.first().waitFor({state: 'attached', timeout: 1500}).catch(() => {});
  }
  await page.waitForFunction(() => {
    const w = window as unknown as {__conReady?: () => {holds: Array<string>, transport?: {requestInProgress: boolean, holding: boolean}}};
    const r = w.__conReady?.();
    return document.querySelector('.con-hand') === null && document.querySelector('.con-composer--play') === null &&
      r !== undefined && r.holds.length === 0 && r.transport?.requestInProgress !== true && r.transport?.holding !== true;
  }, undefined, {polling: 50, timeout: 30_000});
  await cinematicBeat(page, 600, 'the tail of the fold + the board settle — the recorder keeps sampling through it');
  const frames = await takeRecording(page);
  expect(frames.length, 'the in-page recorder ran').toBeGreaterThan(30);
  const report = analyse(frames, profile, play.card, play.kind, seq0, play.card);
  report.pressWall = pressWall;
  printReport(report, frames, play.card);
  fs.mkdirSync(OUT_DIR, {recursive: true});
  fs.writeFileSync(path.join(OUT_DIR, `${profile}-${play.card.replace(/\s+/g, '_')}.json`), JSON.stringify({report, frames}, null, 1));
  await settle(page, {timeoutMs: 20_000, quietMs: 400});
  return report;
}

// The recording is the deliverable: a per-test video (top-level — a
// describe-scoped `video` forces a new worker and Playwright refuses it).
test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});

for (const profile of PROFILES) {
  test.describe(`play landing geometry · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
    });

    test('hand workspace: empty family · occupied family · event', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootFixture(page, request, 'solo-actions', {query: profile.query});
      await settle(page, {timeoutMs: 30_000});
      const reports: Array<Report> = [];
      for (const play of PLAYS) {
        reports.push(await runHandLanding(page, profile.tag, play));
      }
      fs.mkdirSync(OUT_DIR, {recursive: true});
      fs.writeFileSync(path.join(OUT_DIR, `${profile.tag}-summary.json`), JSON.stringify(reports, null, 1));
      const video = page.video();
      await page.close();
      if (video !== null) {
        await video.saveAs(path.join(OUT_DIR, `${profile.tag}-plays.webm`));
      }
      for (const r of reports) {
        expect(r.tProxyFirst, `${r.card}: a proxy flew`).toBeGreaterThan(0);
        expect(r.tReveal, `${r.card}: the card docked`).toBeGreaterThan(0);
        expect(r.tReady, `${r.card}: control came back`).toBeGreaterThan(0);
        assertBoundary(r);
      }
    });
  });
}

/**
 * THE HANDOFF CONTRACT (docs/claude/console/workspace-band.md § Итерация 4):
 * the card lands where the real card paints (≤ 1 px on every axis, both at
 * the touchdown and at the last opaque proxy frame), nothing moves after the
 * reveal, no frame shows no card, no frame shows two half-cards (no
 * crossfade), and the two faces are the same picture. An EVENT lands on the
 * face-down pile: its geometry is asserted against the pile's back.
 */
function assertBoundary(r: Report): void {
  const tol = 1.0;
  const check = (d: Report['boundary'], what: string) => {
    expect(d, `${r.card}: ${what} measured`).toBeDefined();
    if (d !== undefined) {
      expect(Math.abs(d.dx), `${r.card}: ${what} dx`).toBeLessThanOrEqual(tol);
      expect(Math.abs(d.dy), `${r.card}: ${what} dy`).toBeLessThanOrEqual(tol);
      expect(Math.abs(d.dw), `${r.card}: ${what} dw`).toBeLessThanOrEqual(tol);
      expect(Math.abs(d.dh), `${r.card}: ${what} dh`).toBeLessThanOrEqual(tol);
    }
  };
  check(r.landingError, 'the touchdown vs the real card');
  check(r.boundary, 'the last opaque proxy vs the real card');
  expect(r.glideAfterReveal, `${r.card}: nothing moves after the reveal`).toBeLessThanOrEqual(tol);
  expect(r.gapFrames, `${r.card}: no frame without a card`).toBe(0);
  expect(r.twinFrames, `${r.card}: no crossfade window (two half-cards)`).toBe(0);
  expect(r.classMismatch, `${r.card}: the proxy and the real card are the same picture`).toBe(false);
  // No dead hover before the flight: the aim is taken during the round trip
  // and the arc takes over from the lift's tail, so the card never stands
  // still between the two — at most two painted frames (main-thread stalls
  // excluded from the measure; see `hoverMs`).
  expect(r.hoverMs, `${r.card}: no dead hover before the flight (cadence ${r.medianGapMs} ms)`)
    .toBeLessThanOrEqual(90);
}

/**
 * THE START QUEUE → THE COMPACT DOCK: the same hero transaction with the dock's
 * prepared top slot as the landing place. Driven through the real wizard (the
 * queue plays are UI presses — the API seed plays them server-side).
 */
test.describe('play landing geometry · start queue (fhd)', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('corporation + two preludes land on the dock', async ({page, request}) => {
    test.setTimeout(420_000);
    const config = {
      ...soloConfigForStart(),
    };
    const playerId = await createGameWithCards(request, [], {config});
    await openConsole(page, playerId);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, ['CrediCor'])).toContain('CrediCor');
        } else if (kind === 'prelude') {
          await pickCards(p, ['Loan', 'Metals Company']);
          await fillPicks(p, 2);
        }
      },
    });
    await submitSummary(page);
    await page.waitForSelector('.con-start__queue [data-queue-slot]', {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000, quietMs: 500});
    const reports: Array<Report> = [];
    for (let i = 0; i < 3; i++) {
      const queue = await page.evaluate(() => Array.from(document.querySelectorAll('.con-start__queue [data-queue-slot]'))
        .map((el) => el.getAttribute('data-queue-slot') ?? ''));
      if (queue.length === 0) {
        break;
      }
      const before = await readiness(page);
      const seq0 = before?.input.seq ?? 0;
      await armRecorder(page, 'start');
      const pressWall = Date.now();
      await playStartQueue(page, {plays: 1});
      await settle(page, {timeoutMs: 30_000, quietMs: 500});
      const frames = await takeRecording(page);
      const played = frames.map((f) => f.frontKey).find((k) => k !== '') ?? queue[0];
      const report = analyse(frames, 'start', played, 'start', seq0, played);
      report.pressWall = pressWall;
      printReport(report, frames, played);
      reports.push(report);
      fs.mkdirSync(OUT_DIR, {recursive: true});
      fs.writeFileSync(path.join(OUT_DIR, `start-${played.replace(/\s+/g, '_')}.json`), JSON.stringify({report, frames}, null, 1));
    }
    const video = page.video();
    await page.close();
    if (video !== null) {
      await video.saveAs(path.join(OUT_DIR, 'start-queue.webm'));
    }
    expect(reports.length, 'three queue plays were recorded').toBe(3);
    for (const r of reports) {
      expect(r.tProxyFirst, `${r.card}: a proxy flew`).toBeGreaterThan(0);
      expect(r.tReveal, `${r.card}: the card docked`).toBeGreaterThan(0);
      assertBoundary(r);
    }
  });
});

function soloConfigForStart(): Record<string, unknown> {
  return {
    players: [{name: 'StartLanding', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false,
    // No first action, no on-pick choices: the queue is corp + preludes, all
    // plain landings.
    customCorporationsList: ['CrediCor', 'Ecoline'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: ['Loan', 'Metals Company', 'Donation', 'Martian Industries'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    automa: {difficulty: 'normal'},
  };
}
