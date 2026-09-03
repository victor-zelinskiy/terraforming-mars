import {test, expect, Page} from '@playwright/test';
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
    const w = window as unknown as {__chipSamples?: Array<Sample>, __chipTimer?: number};
    w.__chipSamples = [];
    const take = () => {
      const body = document.querySelector<HTMLElement>(`[data-hand-dock-card="${card}"][data-reveal-card]`);
      if (body === null) {
        return;
      }
      const chip = body.querySelector<HTMLElement>('.con-deal-proxy__chip');
      if (chip === null) {
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
          const m11 = Number.parseFloat(t.slice('matrix3d('.length));
          if (!(m11 > 0.98)) {
            return; // turning or back-facing — width is foreshortened
          }
        }
      }
      const b = body.getBoundingClientRect();
      const c = chip.getBoundingClientRect();
      if (b.width < 4 || c.width < 2) {
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

async function openHandFast(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press('Period');
    await page.waitForTimeout(350); // the wheel opens
    await page.keyboard.press('Enter');
    for (let i = 0; i < 12; i++) {
      const started = await page.evaluate(() =>
        document.querySelectorAll('.con-hand, .con-handreveal-layer [data-reveal-card]').length > 0);
      if (started) {
        return;
      }
      await page.waitForTimeout(100);
    }
  }
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
      await openHandFast(page);
      await page.waitForTimeout(2400); // open ≈ lift + flight + spread + handoff
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
      expect(openSamples.length,
        `a dead sampler fails, a starved one does not — saw ${openSamples.length} samples`).toBeGreaterThanOrEqual(3);
      const open = ratioStats(openSamples);
      // 1. Constant ratio through the flight (one composition, no jumps).
      expect(open.max / open.min,
        `flight ratio must not drift: ${JSON.stringify(open)}`).toBeLessThan(1.1);
      // 2. …and it is the RESTING ratio — the handoff cannot pop.
      expect(Math.abs(open.mean - rest!.ratio) / rest!.ratio,
        `flight ${open.mean.toFixed(3)} vs resting ${rest!.ratio.toFixed(3)} (slot ${rest!.slotW.toFixed(0)}px)`).toBeLessThan(0.1);
      // 3. Never two representations of the chip at once.
      expect(Math.max(...openSamples.map((s) => s.chips)), 'one chip per card at every frame').toBeLessThanOrEqual(1);

      // ── CLOSE: the same three claims in the gather direction. ────────
      await armSampler(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(2200);
      const closeSamples = await readSamples(page);
      await shoot(page, `${preset.tag}-closed`);
      expect(closeSamples.length,
        `the close flight was sampled — saw ${closeSamples.length}`).toBeGreaterThanOrEqual(3);
      const close = ratioStats(closeSamples);
      expect(close.max / close.min,
        `close ratio must not drift: ${JSON.stringify(close)}`).toBeLessThan(1.1);
      expect(Math.abs(close.mean - rest!.ratio) / rest!.ratio,
        `close ${close.mean.toFixed(3)} vs resting ${rest!.ratio.toFixed(3)}`).toBeLessThan(0.1);
      expect(Math.max(...closeSamples.map((s) => s.chips))).toBeLessThanOrEqual(1);
    });
  });
}
