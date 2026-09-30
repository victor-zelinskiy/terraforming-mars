import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, waitForBoardHome} from './consoleStart';

/**
 * THE BLOCKER CHIP RIDES THE CARD — «плашка недоступности раздувается на
 * время анимации карты» (the hand ⇄ album episodes).
 *
 * The resting slot's `.con-hand__chip` counter-zooms by the card zoom
 * (`0.99 / var(--con-hand-zoom)`, 1.2 on TV) so it reads at one screen size
 * at every density. Its flying twin (`.con-deal-proxy__chip` on the reveal
 * BODY) rode a `--reveal-chip-zoom` var that NOTHING ever set: the chip fell
 * back to zoom 1 inside a natural-size card and rendered up to ~3× too big
 * for the whole flight on a TV showcase page, snapping back at the handoff.
 * The fix stamps `--con-hand-zoom` per body from the pair's album-side rect
 * (`revealChipHandZoom`), so the chip is one composition with the card.
 *
 * What only a live screen can answer — and what this probe measures at REAL
 * intermediate frames, not endpoints:
 *   1. mid-flight, the chip-to-card width ratio is CONSTANT (no per-frame
 *      resizing, no coordinate-space jump);
 *   2. that ratio EQUALS the resting slot's chip-to-card ratio (the handoff
 *      cannot pop) — in the OPEN and the CLOSE direction both;
 *   3. exactly ONE chip exists per card at any sampled frame (no double
 *      render between the slot and the body).
 *
 * Sampler rules (tests.md): armed BEFORE the press, MutationObserver +
 * setInterval — NEVER rAF (headless Chromium stops driving rAF exactly when
 * the screen goes quiet); the liveness floor is set where only a DEAD
 * sampler fails it, and the real numbers ride the failure message.
 *
 * «Breathing Filters» (7% oxygen at a 0% table) is forced into the deal and
 * bought, so the hand ALWAYS holds a rules-blocked card wearing the chip.
 */

const OUT = path.resolve('screenshots', 'hand-chip-scale');
const CARD = 'Breathing Filters';

const PRESETS = [
  {tag: 'tv-4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'handheld', width: 1280, height: 800, query: ''},
] as const;

type Sample = {bodyW: number, chipW: number, chipH: number, chips: number};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Arm the page-side flight sampler (interval + observer, never rAF). */
async function armSampler(page: Page): Promise<void> {
  await page.evaluate((card) => {
    const w = window as unknown as {__chipSamples?: Array<Sample>, __chipTimer?: number, __chipMiss?: unknown};
    w.__chipSamples = [];
    // WHY a tick recorded nothing — so «0 samples» names its cause instead of reading as a dead sampler.
    const miss: {ticks: number, noBody: number, noChip: number, turning: number, tiny: number, cosMax?: number} =
      {ticks: 0, noBody: 0, noChip: 0, turning: 0, tiny: 0};
    w.__chipMiss = miss;
    const take = () => {
      miss.ticks++;
      const body = document.querySelector<HTMLElement>(`[data-hand-dock-card="${card}"][data-reveal-card]`);
      if (body === null) {
        miss.noBody++;
        return;
      }
      const chip = body.querySelector<HTMLElement>('.con-deal-proxy__chip');
      if (chip === null) {
        miss.noChip++;
        return;
      }
      // THE FLIP GATE: the episode turns the card in 3D (`rotationY` on
      // `.con-deal-proxy__flip`), and a rotated face's bounding-rect width
      // honestly shrinks by cos(θ) — that is the turn, not a chip resize.
      // The ratio claim holds for FRONT-FLAT frames only; the flight keeps
      // moving and scaling well after the turn settles, so flat frames are
      // still genuinely intermediate (mid-travel, mid-scale).
      const flip = body.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        const t = getComputedStyle(flip).transform;
        if (t.startsWith('matrix3d(')) {
          // The ANGLE, never the raw m11: a rotateY under a scale puts scale·cosθ in m11 and −scale·sinθ in m13
          // (the first column), so cosθ = m11 / |(m11, m13)|. Read raw, a flip layer that also carries a scale
          // (the TV profile's proxy does) never looked flat — every 4K sample was rejected as «turning».
          const m = t.slice('matrix3d('.length, -1).split(',').map((v) => Number.parseFloat(v));
          const cos = m[0] / Math.hypot(m[0], m[2]);
          miss.cosMax = Math.max(miss.cosMax ?? -1, Math.round(cos * 1000) / 1000);
          if (!(cos > 0.98)) {
            miss.turning++;
            return; // turning or back-facing — width is foreshortened
          }
        }
      }
      const b = body.getBoundingClientRect();
      const c = chip.getBoundingClientRect();
      if (b.width < 4 || c.width < 2) {
        miss.tiny++;
        return;
      }
      // Double-render witness: VISIBLE chips naming this card. The slot's own
      // chip stays MOUNTED under the hold (`.con-hand--transit` hides it with
      // opacity), so the honest count is painted representations, not DOM
      // nodes — `checkVisibility({checkOpacity})` walks the ancestors.
      const chips = Array.from(document.querySelectorAll<HTMLElement>(
        `[data-zoom-slot="${card}"] .con-hand__chip, [data-hand-dock-card="${card}"] .con-deal-proxy__chip`))
        .filter((el) => el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})).length;
      w.__chipSamples!.push({bodyW: b.width, chipW: c.width, chipH: c.height, chips});
    };
    const mo = new MutationObserver(take);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true});
    w.__chipTimer = window.setInterval(take, 16);
  }, CARD);
}

type Miss = {ticks: number, noBody: number, noChip: number, turning: number, tiny: number, cosMax?: number};

const readMiss = (page: Page): Promise<Miss> =>
  page.evaluate(() => ((window as unknown as {__chipMiss?: Miss}).__chipMiss ?? {ticks: 0, noBody: 0, noChip: 0, turning: 0, tiny: 0}));

/**
 * A PROBE'S FLOOR MAY ONLY CATCH A DEAD SAMPLER (tests.md). The ratio is judged on FRONT-FLAT frames only, and how
 * many of those a run gets is the harness's business: on a loaded 4K runner the page paints every 100–200 ms, the
 * flat tail of the flight falls between two paints, and «≥ 3 samples» failed a flight whose every frame was sampled
 * mid-turn (measured: 28 body ticks, all turning, cos ≤ 0.98). So the floor asserts what IS a defect — the sampler
 * ran, the flight's body was on screen, it carried its chip — and the ratio claims run on whatever flat frames exist.
 */
function expectFlightSampled(label: string, samples: ReadonlyArray<Sample>, miss: Miss): void {
  const why = `${samples.length} flat samples, misses ${JSON.stringify(miss)}`;
  expect(miss.ticks, `${label}: the sampler ran (${why})`).toBeGreaterThanOrEqual(3);
  expect(miss.ticks - miss.noBody, `${label}: the flight's body was on screen (${why})`).toBeGreaterThan(0);
  expect(miss.noChip, `${label}: the flying body carries its chip (${why})`).toBe(0);
  if (samples.length === 0) {
    console.log(`[chip-scale] ${label}: every sampled frame was mid-turn — the ratio has no flat frame to be judged on (${why})`);
  }
}

/**
 * THE FLIGHT IS OVER when its body has been on screen and has LEFT (the handoff) — a fixed 2.4 s / 2.2 s stood in
 * for that, and on a loaded 4K runner the samples were read mid-flight, before the flat tail they are judged on
 * (measured: 0 flat samples at the read, `cosMax: 1` arriving after it).
 */
async function awaitFlightEnd(page: Page, label: string): Promise<void> {
  await expect.poll(() => page.evaluate((card) => {
    const miss = (window as unknown as {__chipMiss?: {ticks: number, noBody: number}}).__chipMiss;
    const seen = miss !== undefined && miss.ticks - miss.noBody > 0;
    return seen && document.querySelector(`[data-hand-dock-card="${card}"][data-reveal-card]`) === null;
  }, CARD), {timeout: 30_000, message: `${label}: the flight's body came and went`}).toBe(true);
}

async function readSamples(page: Page): Promise<Array<Sample>> {
  return await page.evaluate(() => {
    const w = window as unknown as {__chipSamples?: Array<Sample>, __chipTimer?: number};
    if (w.__chipTimer !== undefined) {
      window.clearInterval(w.__chipTimer);
    }
    return w.__chipSamples ?? [];
  });
}

/** The settled album slot's own chip-to-card ratio — the reference. The
 *  denominator is the CARD FACE (`.pcard`), the same box the flying body's
 *  rect is (a body is exactly the card at natural size × scale); the slot
 *  wrapper carries ring/padding room and would skew the reference. */
async function restingRatio(page: Page): Promise<{ratio: number, slotW: number, chipW: number} | undefined> {
  return await page.evaluate((card) => {
    const slot = document.querySelector<HTMLElement>(`[data-zoom-slot="${card}"]`);
    const face = slot?.querySelector<HTMLElement>('.pcard, .card-container');
    const chip = slot?.querySelector<HTMLElement>('.con-hand__chip');
    if (face === null || face === undefined || chip === null || chip === undefined) {
      return undefined;
    }
    const s = face.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    return s.width < 4 ? undefined : {ratio: c.width / s.width, slotW: s.width, chipW: c.width};
  }, CARD);
}

function ratioStats(samples: ReadonlyArray<Sample>) {
  const ratios = samples.map((s) => s.chipW / s.bodyW);
  const min = Math.min(...ratios);
  const max = Math.max(...ratios);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return {min, max, mean, n: ratios.length};
}

/** Bare presses on purpose (the flight must be sampled from its first frame) — but every step waits on STATE. */
async function openHandFast(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press('Period');
    // The wheel's OWN presence is the witness: a fixed 350 ms stood in for it, a loaded 4K runner was still
    // opening the wheel there, Enter landed on the board, and the spec reported a «dead sampler» with 0 samples.
    await page.locator('.con-quick').first().waitFor({state: 'visible', timeout: 3_000}).catch(() => undefined);
    await page.keyboard.press('Enter');
    for (let i = 0; i < 12; i++) {
      const started = await page.evaluate(() =>
        document.querySelectorAll('.con-hand, .con-handreveal-layer [data-reveal-card]').length > 0);
      if (started) {
        return true;
      }
      await page.waitForTimeout(100);
    }
  }
  return false;
}

for (const preset of PRESETS) {
  test.describe(`hand chip scale · ${preset.tag}`, () => {
    test.use({
      viewport: {width: preset.width, height: preset.height},
      deviceScaleFactor: 1,
      screen: {width: preset.width, height: preset.height},
    });

    test('the blocker chip keeps ONE chip-to-card ratio through open and close flights', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootIntoGame(page, request, {cards: [CARD], buy: 3, query: preset.query});
      await waitForBoardHome(page);

      // ── OPEN: sample the flight, then the settled slot. ──────────────
      await armSampler(page);
      expect(await openHandFast(page), 'the hand opened (the fast open: wheel → A)').toBe(true);
      await awaitFlightEnd(page, 'open');
      const openSamples = await readSamples(page);
      // The REFERENCE must be the card at REST: a focused slot carries the
      // album's focus scale (`--selected`, ~1.08 on TV) and would skew the
      // denominator by exactly that factor. Walk the cursor off the card.
      for (let i = 0; i < 4; i++) {
        const focusedHere = await page.evaluate((card) =>
          document.querySelector(`[data-zoom-slot="${card}"]`)?.classList.contains('con-hand__slot--selected') === true, CARD);
        if (!focusedHere) {
          break;
        }
        await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
        await page.waitForTimeout(400); // the 150ms focus transform settles
      }
      const rest = await restingRatio(page);
      await shoot(page, `${preset.tag}-open`);
      expect(rest, 'the settled album shows the blocked card with its chip').toBeDefined();
      expectFlightSampled('open', openSamples, await readMiss(page));
      if (openSamples.length > 0) {
        const open = ratioStats(openSamples);
        // 1. Constant ratio through the flight (one composition, no jumps).
        expect(open.max / open.min,
          `flight ratio must not drift: ${JSON.stringify(open)}`).toBeLessThan(1.1);
        // 2. …and it is the RESTING ratio — the handoff cannot pop.
        expect(Math.abs(open.mean - rest!.ratio) / rest!.ratio,
          `flight ${open.mean.toFixed(3)} vs resting ${rest!.ratio.toFixed(3)} (slot ${rest!.slotW.toFixed(0)}px)`).toBeLessThan(0.1);
        // 3. Never two representations of the chip at once.
        expect(Math.max(...openSamples.map((s) => s.chips)), 'one chip per card at every frame').toBeLessThanOrEqual(1);
      }

      // ── CLOSE: the same three claims in the gather direction. ────────
      await armSampler(page);
      await page.keyboard.press('Escape');
      await awaitFlightEnd(page, 'close');
      const closeSamples = await readSamples(page);
      await shoot(page, `${preset.tag}-closed`);
      expectFlightSampled('close', closeSamples, await readMiss(page));
      if (closeSamples.length > 0) {
        const close = ratioStats(closeSamples);
        expect(close.max / close.min,
          `close ratio must not drift: ${JSON.stringify(close)}`).toBeLessThan(1.1);
        expect(Math.abs(close.mean - rest!.ratio) / rest!.ratio,
          `close ${close.mean.toFixed(3)} vs resting ${rest!.ratio.toFixed(3)}`).toBeLessThan(0.1);
        expect(Math.max(...closeSamples.map((s) => s.chips))).toBeLessThanOrEqual(1);
      }
    });
  });
}
