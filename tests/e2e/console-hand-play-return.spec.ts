/*
 * THE HAND COMES HOME BEHIND THE PLAY — «карты летят непонятно откуда рывком».
 *
 * The premium GATHER (grid → dock) is a flight FROM WHERE THE PLAYER LAST SAW
 * THE CARDS, so it belongs to the endings the player asks for: B out of the
 * album, «свернуть» from it. A PLAY does not end there — its descent parks the
 * shelf the moment the composer opens, and the hand is not on screen again.
 *
 * Left to the fold, the pack's bodies came back as a flight measured off that
 * PARKED grid: they materialized over the board a beat AFTER the workspace had
 * already dissolved and darted into the tray from nowhere.
 *
 * What this probe pins, at the rendered surface:
 *
 *   A. THE PACK IS ALREADY HOME WHEN THE WORKSPACE GOES. On the last frame the
 *      hand workspace is on screen, every body already sits at the berth it
 *      will settle on — so the fold moves nothing.
 *   B. NOTHING TRAVELS. From the descent onward no body is ever in continuous
 *      long-distance motion: a SEAT is one frame of displacement, a 340 ms
 *      album→dock tween is twenty of them.
 *
 * …while the player-asked ending keeps its flight: part C opens the hand and
 * presses B, and the bodies must cross the screen over many frames.
 */
import {expect, test, Page} from '@playwright/test';
import {bootIntoGame, focusCard, handCount, press, soloGameConfig} from './consoleStart';

/** A cheap, choice-free green card — the play must not raise a follow-up. */
const CARD = 'Acquired Company';

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'HandReturn', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  // CrediCor: no first action, no on-pick choices — the post-start board is
  // idle and the hand play is immediately reachable.
  customCorporationsList: ['CrediCor'],
  customProjectCards: [CARD],
});

/* THE ONE METRIC, read both ways: how far a body CONTINUOUSLY TRAVELS.
   A per-frame step threshold cannot express this — the sampler is faster than
   the paint-locked flight clock, so a real 480 ms gather advances only a few px
   per sample. Distance can: a SEAT is a single teleport (excluded — that is the
   point of it) and everything else is measured, so the pack's own small moves
   (the tray rise ~1 rem, the compact→rest pose ride) stay far below a flight
   that crosses the screen. */
const JUMP_PX = 150; // a step this big is a re-seat, never a tween frame
const STILL_PX = 1; // below this the body is standing
/** What the pack's OWN small moves may cost (tray rise + compact→rest ride).
 *  Measured 8–21 px; a gather that degraded into a tween would be hundreds. */
const MAX_LOCAL_TRAVEL_PX = 60;
/** What crossing the screen from the album costs, at the very least. */
const MIN_FLIGHT_TRAVEL_PX = 300;

type BodySample = {n: string, cx: number, cy: number};
type Frame = {
  t: number,
  /** The hand workspace is on screen. */
  hand: boolean,
  /** The play composer owns the workspace stage (the shelf is parked). */
  stage: boolean,
  /** Bodies owned by a reveal EPISODE right now (a real gather flight). */
  flying: number,
  bodies: Array<BodySample>,
};

async function installWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__hpr?: {timer: number, frames: Array<Frame>}};
    if (w.__hpr !== undefined) {
      window.clearInterval(w.__hpr.timer);
    }
    const state = {timer: 0, frames: [] as Array<Frame>};
    const t0 = performance.now();
    const scan = () => {
      if (state.frames.length >= 4000) {
        return;
      }
      const bodies: Array<BodySample> = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-handbody'))) {
        const n = el.getAttribute('data-hand-dock-card') ?? '';
        const r = el.getBoundingClientRect();
        if (n === '' || r.width < 4) {
          continue;
        }
        bodies.push({n, cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2)});
      }
      state.frames.push({
        t: Math.round(performance.now() - t0),
        hand: document.querySelector('.con-hand__frame') !== null,
        stage: document.querySelector('.con-hand__stage .con-composer--play') !== null,
        flying: document.querySelectorAll('.con-handreveal-layer [data-reveal-card]').length,
        bodies,
      });
    };
    state.timer = window.setInterval(scan, 16) as unknown as number;
    w.__hpr = state as never;
    scan();
  });
}

async function readWatch(page: Page): Promise<Array<Frame>> {
  return page.evaluate(() => {
    const w = window as unknown as {__hpr: {timer: number, frames: Array<Frame>}};
    window.clearInterval(w.__hpr.timer);
    const out = w.__hpr.frames;
    w.__hpr.frames = [];
    w.__hpr.timer = window.setInterval(() => undefined, 60_000) as unknown as number;
    return out;
  });
}

/**
 * FORCE FRAMES. Headless Chromium drives rAF off the COMPOSITOR, so on a quiet
 * screen the animations under test starve — a tween does not finish, it FREEZES,
 * and to any sampler a frozen tween is indistinguishable from a settled one. A
 * probe that does not pump therefore passes «nothing travelled» for the very
 * reason it should have failed. A screenshot forces a BeginFrame.
 */
async function pump(page: Page, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => undefined);
  }
}

/** Pump frames until `done`, or the budget runs out. */
async function pumpUntil(page: Page, done: () => Promise<boolean>, maxMs: number): Promise<void> {
  const until = Date.now() + maxMs;
  while (Date.now() < until && !await done()) {
    await pump(page, 120);
  }
}

/**
 * The longest CONTINUOUS TRAVEL of `name`: the largest distance accumulated
 * over consecutive samples in which it kept moving, with single teleports
 * (> `JUMP_PX` in one sample) breaking the run rather than joining it.
 */
function travelOf(frames: ReadonlyArray<Frame>, name: string): {travel: number, samples: number, jumps: number} {
  let best = 0;
  let bestSamples = 0;
  let cur = 0;
  let curSamples = 0;
  let jumps = 0;
  let prev: BodySample | undefined;
  const close = () => {
    if (cur > best) {
      best = cur;
      bestSamples = curSamples;
    }
    cur = 0;
    curSamples = 0;
  };
  for (const f of frames) {
    const b = f.bodies.find((x) => x.n === name);
    if (b === undefined) {
      close();
      prev = undefined;
      continue;
    }
    if (prev !== undefined) {
      const d = Math.hypot(b.cx - prev.cx, b.cy - prev.cy);
      if (d > JUMP_PX) {
        jumps++;
        close();
      } else if (d > STILL_PX) {
        cur += d;
        curSamples++;
      } else {
        close();
      }
    }
    prev = b;
  }
  close();
  return {travel: Math.round(best), samples: bestSamples, jumps};
}

/**
 * How far `name` moved WHILE A REVEAL EPISODE WAS AIRBORNE — the gather's own
 * distance, and 0 by construction for a silent return (no episode, no airborne
 * frame). Semantic, so it needs no jump filter: during a flight every step IS a
 * tween step, however coarse the paint-locked clock makes it.
 */
function airborneTravel(frames: ReadonlyArray<Frame>, name: string): number {
  let total = 0;
  let prev: BodySample | undefined;
  for (const f of frames) {
    const b = f.bodies.find((x) => x.n === name);
    if (b !== undefined && prev !== undefined && f.flying > 0) {
      total += Math.hypot(b.cx - prev.cx, b.cy - prev.cy);
    }
    prev = b;
  }
  return Math.round(total);
}

/** The per-body evidence line every assertion in this file carries — a starved
 *  compositor and a missing flight look identical in a bare count. */
function travelReport(frames: ReadonlyArray<Frame>, names: ReadonlyArray<string>): string {
  return names.map((n) => {
    const t = travelOf(frames, n);
    return `${n}:${t.travel}px/${t.samples}s/${t.jumps}j/air${airborneTravel(frames, n)}px`;
  }).join(' ');
}

test.describe('the hand returns to the dock behind the play', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the pack is home before the workspace folds, and nothing travels', async ({page, request}) => {
    test.setTimeout(420_000);

    await bootIntoGame(page, request, {buy: 6, cards: [CARD], config: GAME_CONFIG});
    await page.waitForTimeout(2500);
    const held = await handCount(page);
    expect(held, 'the probe needs a real pack to send home').toBeGreaterThan(2);

    await installWatch(page);

    // ── the play, driven the way a player drives it ──────────────────────
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1800); // centre slot → the hand album
    await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 15_000});
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 25_000});
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    // The budget is the RING, never a constant: the subject is as likely to be
    // the last slot as the first (consoleStart's own `ringWalk` lesson).
    expect(await focusCard(page, CARD, Math.max(slots, 1) + 7), `cursor never reached ${CARD}`).toBe(true);

    await press(page, 'Enter', 900); // A → descend into the play composer
    await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
    await pump(page, 1200);
    await press(page, 'Enter', 300); // A → commit
    // The landing scene, the result beat and the fold — every frame FORCED, or
    // the very tween this spec must not see would simply never run.
    await pumpUntil(page, async () => await page.locator('.con-hand__frame').count() === 0, 60_000);
    expect(await page.locator('.con-hand__frame').count(), 'the workspace folded').toBe(0);
    await pump(page, 2500); // …and everything the fold set off settles

    const frames = await readWatch(page);
    expect(frames.length, 'the watch sampled the whole play').toBeGreaterThan(200);

    // The descent — from here the shelf is parked and the cards are off screen.
    const descent = frames.findIndex((f) => f.stage);
    expect(descent, 'the composer never opened').toBeGreaterThan(-1);
    const lastHand = frames.map((f) => f.hand).lastIndexOf(true);
    expect(lastHand, 'the workspace never folded').toBeGreaterThan(descent);

    const settled = frames[frames.length - 1];
    const atFold = frames[lastHand];
    expect(settled.bodies.length, 'the pack is standing in the dock at the end').toBeGreaterThan(1);

    // ── A · the pack is ALREADY HOME on the workspace's last frame ────────
    const strays: Array<string> = [];
    for (const end of settled.bodies) {
      const then = atFold.bodies.find((b) => b.n === end.n);
      if (then === undefined) {
        continue; // a body that only mounted after the fold — nothing to travel
      }
      const d = Math.round(Math.hypot(end.cx - then.cx, end.cy - then.cy));
      if (d > 90) {
        strays.push(`${end.n}: ${d}px (fold ${then.cx},${then.cy} → settled ${end.cx},${end.cy})`);
      }
    }
    expect(strays, 'every body was already on its berth when the workspace went').toEqual([]);

    // ── B · nothing TRAVELS between the descent and the settle ───────────
    const after = frames.slice(descent);
    expect(after.every((f) => f.flying === 0), 'no gather episode may run for a play ending').toBe(true);
    const names = settled.bodies.map((b) => b.n);
    const travellers = names.filter((n) => travelOf(after, n).travel > MAX_LOCAL_TRAVEL_PX);
    expect(travellers,
      `the pack came home seated, never flown — ${travelReport(after, names)}`,
    ).toEqual([]);
  });

  test('…and B out of the album still flies the premium gather', async ({page, request}) => {
    test.setTimeout(420_000);

    await bootIntoGame(page, request, {buy: 6, cards: [CARD], config: GAME_CONFIG});
    await page.waitForTimeout(2500);
    await installWatch(page);

    await press(page, 'Period', 600);
    await press(page, 'Enter', 1800);
    await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 15_000});
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 25_000});
    await pump(page, 600);
    await press(page, 'Escape', 60); // B — the gather the player asked for
    await pumpUntil(page, async () => await page.locator('.con-hand__frame').count() === 0, 30_000);
    expect(await page.locator('.con-hand__frame').count(), 'the hand closed').toBe(0);
    await pump(page, 1200);

    const frames = await readWatch(page);
    const settled = frames[frames.length - 1];
    expect(settled.bodies.length).toBeGreaterThan(1);
    expect(frames.some((f) => f.flying > 0), 'the close ran a real reveal episode').toBe(true);
    // At least one card must genuinely CROSS the screen over many frames —
    // that is the phrase the play ending deliberately does not play.
    const names = settled.bodies.map((b) => b.n);
    const airborne = frames.filter((f) => f.flying > 0).length;
    const flown = names.filter((n) => airborneTravel(frames, n) > MIN_FLIGHT_TRAVEL_PX);
    expect(flown.length,
      `the album→dock gather is a real flight (samples ${frames.length}, airborne ${airborne}) — ${travelReport(frames, names)}`,
    ).toBeGreaterThan(0);
  });
});
