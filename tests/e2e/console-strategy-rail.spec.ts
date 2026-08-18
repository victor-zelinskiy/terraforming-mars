import {expect, test, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig} from './consoleStart';

/**
 * P30 — the right STRATEGY RAIL (Milestones/Awards premium HUD).
 *
 * The composition invariant this spec exists for: the right rail is the LEFT
 * resource rail's geometric twin (same seam token → same rendered width), the
 * old wide context panel is GONE from the idle board home (no hidden spacer —
 * the board section really owns the freed band), and the LB/RB doors still
 * open their workspaces. Geometry is asserted at BOTH 1080p and 4K TV — a fit
 * claim asserted at one resolution is a claim about one resolution.
 *
 * The game is a MarsBot duo (a TRUE solo disables milestones/awards by rule —
 * `Game.allAwardsFunded()` is true at one seat, and the rail would be a
 * legal-but-degenerate render).
 */

async function railBoxes(page: Page) {
  const left = await page.locator('.con-res').boundingBox();
  const right = await page.locator('.con-strat').boundingBox();
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  return {left: left!, right: right!};
}

async function bootHome(page: Page, request: Parameters<typeof bootIntoGame>[1], query = '') {
  await bootIntoGame(page, request, {
    config: soloGameConfig({automa: {difficulty: 'normal'}}),
    query,
  });
  await page.waitForSelector('.con-strat', {timeout: 30_000});
  await page.waitForTimeout(800);
}

/**
 * THE ROUNDING IS SIMULATED, NOT BUDGETED FOR.
 *
 * Chromium lays HUD-sized text out with SUBPIXEL glyph advances on a Windows
 * dev box, and with advances ROUNDED UP TO WHOLE PIXELS on the Linux CI runner
 * (FreeType, below the size at which subpixel positioning turns on). Measured
 * on this very line, same commit, same string: «ДОСТИЖЕНИЯ» inks 95.41 px
 * locally and 100.41 px on the runner at 13.2 px — +0.5 px per glyph — while
 * the SAME string at 34 px (the TV profile) costs nothing extra. That is how
 * this rail shipped an ellipsis only the FHD shard ever saw: a head tuned
 * until the longest name just fits has no margin at all where it runs.
 *
 * A FLAT ALLOWANCE CANNOT EXPRESS THAT, and the first version of this guard
 * proved it: «keep one pixel per glyph spare» is right on the dev box and
 * double-counts on the runner, where the pixel per glyph has ALREADY been
 * spent — it failed a layout that was, by its own ellipsis check, whole.
 *
 * So the guard reconstructs the worst case from the platform's OWN advances:
 * sum ⌈advance⌉ + tracking, glyph by glyph. On Windows that predicts the
 * runner (verified: the model computes ~100.4 px for the line the runner
 * measured at 100.41); on Linux ⌈⌉ of an already-whole advance is the identity,
 * so the demand degrades exactly to «it fits». The reconstruction is clamped to
 * the LAID-OUT ink, so it cannot come out narrower than the line actually in
 * front of it whichever convention the measuring API reports. One number, both
 * platforms, no `process.platform` anywhere.
 */
/**
 * On top of the reconstructed worst case, because ⌈advance⌉ is a model of ONE
 * platform difference and rasterisation has others (the per-glyph advances the
 * canvas reports track the laid-out line to within a pixel, not exactly). Two
 * per cent, and never less than 2 px — at the handheld rem two per cent is
 * 1.5 px, which is thinner than the error it is there to absorb.
 */
const RASTER_COMFORT = 0.02;

/**
 * How far the per-glyph model may sit from the laid-out line, per glyph. It is
 * exactly the rounding under study: the two may disagree by a whole pixel on
 * every glyph and still describe the same line. Anything past that is the model
 * measuring something else.
 */
const MODEL_TOLERANCE = 1;

type HeadFit = {
  text: string, chars: number, font: string,
  /** What the title inks HERE, laid out by this platform. */
  ink: number,
  /** The same string with every glyph advance ceiled — the widest it can ever lay out. */
  worst: number,
  /** The model's own reproduction of `ink`, unceiled: the fidelity check. */
  modelled: number,
  /** The room the key cap and the slot tray actually leave beside them. */
  avail: number,
  /** `worst` plus the rasterisation comfort — what `avail` has to clear. */
  need: number,
};

/**
 * Per zone head: what the name inks, the widest it could ever ink, and the
 * column it has to live in.
 *
 * The COLUMN is measured on a CLONE of the real head at the real width — a
 * string no head can hold shrinks the flex item to exactly the room the key cap
 * and the slot tray leave beside it. (The live title is a `flex: 0 1 auto`
 * item, so while it fits, its own box IS its ink and reports nothing about the
 * space it has — measuring that box is how an earlier probe «proved» a column
 * of 411 px.)
 */
async function headFits(page: Page): Promise<Array<HeadFit>> {
  return page.evaluate((comfort) => {
    return [...document.querySelectorAll('.con-strat__head')].map((head) => {
      const rect = head.getBoundingClientRect();
      const clone = head.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = '-20000px';
      clone.style.top = '0';
      // The real head may be content-box or border-box; pinning the clone to
      // border-box at the RENDERED width reproduces its content box either way.
      clone.style.boxSizing = 'border-box';
      clone.style.width = rect.width + 'px';
      clone.style.visibility = 'hidden';
      (head.parentElement as HTMLElement).appendChild(clone);

      const title = clone.querySelector('.con-strat__title') as HTMLElement;
      const text = (title.textContent ?? '').trim();
      const cs = getComputedStyle(title);
      // READ EVERY COMPUTED VALUE WHILE THE CLONE IS STILL IN THE DOCUMENT.
      // `getComputedStyle` hands back a LIVE declaration: once the node is
      // detached every property answers the empty string, and a face read after
      // the clean-up below silently became «» — the guard then failed on its own
      // sanity check instead of on the layout.
      const face = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '');
      // The INK, not the box: the title is a block that fills its column, so
      // its own rect can never report an overflow the ellipsis hid.
      const range = document.createRange();
      range.selectNodeContents(title);
      const rects = [...range.getClientRects()];
      const ink = rects.length === 0 ? 0 : Math.max(...rects.map((x) => x.width));

      // ── the worst case, glyph by glyph ──────────────────────────────────
      // What the line PAINTS, not what the DOM stores: this title is
      // `text-transform: uppercase`, and «Достижения» and «ДОСТИЖЕНИЯ» are not
      // the same width.
      const painted = cs.textTransform === 'uppercase' ? text.toUpperCase() :
        cs.textTransform === 'lowercase' ? text.toLowerCase() : text;
      const tracking = parseFloat(cs.letterSpacing) || 0;
      const ctx = (document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      let modelled = 0;
      let ceiled = 0;
      for (const ch of painted) {
        const advance = ctx.measureText(ch).width;
        modelled += advance + tracking;
        // The platform difference, reproduced: every advance snapped up to a
        // whole pixel. Tracking is a CSS length the engine adds on top and does
        // not round, so it stays outside the ceiling.
        ceiled += Math.ceil(advance) + tracking;
      }
      // …AND NEVER NARROWER THAN THE LINE IN FRONT OF US. Whether the canvas
      // reports this platform's advances already snapped (as the runner's
      // layout does) or still subpixel is an implementation detail of the
      // measuring API, not of the rail — and the guard must not depend on which
      // convention it got. Clamping to the LAID-OUT ink makes both readings
      // give the same budget: on a platform that already rounded, the ink IS
      // the worst case.
      const worst = Math.max(ceiled, ink);

      title.textContent = 'Ш'.repeat(200);
      const avail = title.getBoundingClientRect().width;
      clone.remove();

      const r2 = (v: number) => Math.round(v * 100) / 100;
      return {
        text, chars: [...painted].length, font: face,
        ink: r2(ink), worst: r2(worst), modelled: r2(modelled), avail: r2(avail),
        need: r2(worst + Math.max(worst * comfort, 2)),
      };
    });
  }, RASTER_COMFORT);
}

/**
 * The zone titles are whole AND stay whole wherever this runs. Asserted at
 * every profile: a fit claim proved at one resolution is a claim about one
 * resolution, and one proved on one platform is a claim about one platform.
 */
async function expectTitlesFit(page: Page, where: string) {
  const fits = await headFits(page);
  console.log(`[strat head · ${where}] ` + fits.map((f) =>
    `«${f.text}» ${f.font} ink ${f.ink} → worst ${f.worst} · column ${f.avail} (need ${f.need})`)
    .join(' | '));
  expect(fits.length, 'both zone heads were measured').toBe(2);

  for (const f of fits) {
    // The face has to be the panel's own, or every width below is about a
    // typeface this rail never renders.
    expect(f.font, `the head was measured in the console face — ${where}`).toBe('Prototype');
    // The model reproduces the engine's own layout before it is trusted to
    // extrapolate from it.
    // It may legitimately differ by the rounding itself — up to a pixel per
    // glyph — but no further: this catches the model measuring a DIFFERENT
    // string (the uppercase transform), face or size, which is the way it
    // would silently stop guarding anything.
    expect(Math.abs(f.modelled - f.ink),
      `the advance model tracks the laid-out line («${f.text}», ${where})`)
      .toBeLessThanOrEqual(Math.max(2, f.chars * MODEL_TOLERANCE));
  }

  // ① This run's own truth: nothing is ellipsized HERE …
  const deficits = await page.evaluate(() =>
    [...document.querySelectorAll('.con-strat__title')].map((t) => t.scrollWidth - t.clientWidth));
  for (const d of deficits) {
    expect(d, `zone title fully visible (no ellipsis) — ${where}`).toBeLessThanOrEqual(1);
  }
  // ② … and it would still be whole on a platform that snaps every advance up.
  for (const f of fits) {
    expect(f.avail, `«${f.text}» survives whole-pixel glyph advances — ${where}`)
      .toBeGreaterThanOrEqual(f.need);
  }
}

test.describe('console strategy rail — FHD', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the right rail is the left rail\'s twin; the dossier overlay is gone from idle', async ({page, request}) => {
    await bootHome(page, request);

    // WHAT THE RUN ACTUALLY SAW, before the first assertion truncates it.
    // Every fact below is asserted separately, so a bare `expect` failure on a
    // remote runner names one number and hides the eight that would say WHY —
    // and this spec's whole subject is a composition. Printed always: a green
    // run costs one line, a red one stops costing a re-run.
    console.log('[strategy rail FHD] ' + JSON.stringify(await page.evaluate(() => {
      const round = (sel: string) => {
        const el = document.querySelector(sel);
        if (el === null) {
          return null;
        }
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.x), w: Math.round(r.width)};
      };
      return {
        left: round('.con-res'), right: round('.con-strat'), board: round('.con-board'),
        inspectors: document.querySelectorAll('.con-inspector').length,
        pips: document.querySelectorAll('.con-strat__head .con-strat__pip').length,
        prices: document.querySelectorAll('.con-strat__price').length,
        milestones: document.querySelectorAll('.con-strat__zone--milestones .con-strat__item').length,
        awards: document.querySelectorAll('.con-strat__zone--awards .con-strat__item').length,
        titles: [...document.querySelectorAll('.con-strat__title')].map((t) => ({
          text: t.textContent, deficit: t.scrollWidth - t.clientWidth,
          font: getComputedStyle(t).fontFamily.split(',')[0], size: getComputedStyle(t).fontSize,
        })),
        // A face that has not landed lays out in the FALLBACK's metrics, which
        // is how a width claim passes on one OS and fails on another.
        prototype: document.fonts.check('700 1rem Prototype', 'ДОСТИЖЕНИЯ'),
      };
    })));

    const {left, right} = await railBoxes(page);
    // The SAME seam token → the same rendered width, to the pixel budget.
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1.5);
    // No hidden spacer: the old wide panel is unmounted on the idle home.
    expect(await page.locator('.con-inspector').count()).toBe(0);
    // The board section really spans between the two rails.
    const board = await page.locator('.con-board').boundingBox();
    expect(board).not.toBeNull();
    expect(board!.x).toBeGreaterThanOrEqual(left.x + left.width);
    expect(board!.x + board!.width).toBeLessThanOrEqual(right.x + 2);

    // Both zones stand with their medal stacks and door caps.
    expect(await page.locator('.con-strat__zone--milestones .con-strat__item').count()).toBeGreaterThan(0);
    expect(await page.locator('.con-strat__zone--awards .con-strat__item').count()).toBeGreaterThan(0);
    await expect(page.locator('.con-strat__head .gp-glyph').first()).toBeVisible();
    // ONE compact head line: the slot tray lives inside the door button;
    // the PRICE is deliberately absent from the standing HUD (it belongs to
    // the workspace where the claim/fund decision is made) — and the NAME
    // never ellipsizes to make room for the tray.
    expect(await page.locator('.con-strat__head .con-strat__pip').count()).toBe(6);
    expect(await page.locator('.con-strat__price').count()).toBe(0);
    await expectTitlesFit(page, 'FHD');

    await page.screenshot({path: 'screenshots/strategy-rail/fhd-home.png', fullPage: false});
  });

  test('LB / RB open the workspaces; closing restores the rail intact', async ({page, request}) => {
    await bootHome(page, request);

    await press(page, 'KeyQ', 1100); // LB → milestones workspace
    await expect(page.locator('.con-ma')).toBeVisible();
    await page.screenshot({path: 'screenshots/strategy-rail/fhd-ma-workspace.png'});
    await press(page, 'Escape', 1100);
    await expect(page.locator('.con-ma')).toHaveCount(0);

    await press(page, 'KeyE', 1100); // RB → awards workspace
    await expect(page.locator('.con-ma')).toBeVisible();
    await press(page, 'Escape', 1100);

    const {left, right} = await railBoxes(page);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1.5);
  });

  test('a board task raises the dossier OVERLAY without reflowing the board', async ({page, request}) => {
    await bootHome(page, request);
    const boardBefore = await page.locator('.con-board').boundingBox();

    // Enter board inspection (L3 = KeyC in the console key bridge) — the cell
    // dossier must rise as an OVERLAY (any dossier mode serves the claim).
    await press(page, 'KeyC', 900);
    const overlayUp = async () => (await page.locator('.con-inspector').count()) > 0;
    if (!(await overlayUp())) {
      // Fallback: scale inspection (R3 = KeyV) is a dossier mode too.
      await press(page, 'KeyV', 900);
    }
    expect(await overlayUp(), 'a dossier mode must raise the overlay').toBe(true);

    const overlay = await page.locator('.con-inspector').boundingBox();
    const boardAfter = await page.locator('.con-board').boundingBox();
    expect(overlay).not.toBeNull();
    // The overlay is pinned to the right edge…
    expect(overlay!.x + overlay!.width).toBeGreaterThan(boardAfter!.x + boardAfter!.width - 4);
    // …and the board box did NOT reflow underneath it.
    expect(Math.abs(boardAfter!.x - boardBefore!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(boardAfter!.width - boardBefore!.width)).toBeLessThanOrEqual(1);
  });
});

test.describe('console strategy rail — Deck handheld', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('the twin-rail geometry holds on the handheld profile; nothing clips', async ({page, request}) => {
    await bootHome(page, request);
    const {left, right} = await railBoxes(page);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1.5);
    const rail = await page.locator('.con-strat').boundingBox();
    const rows = await page.locator('.con-strat__item').all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const box = await row.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(rail!.y - 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(rail!.y + rail!.height + 1);
    }
    // The NARROWEST rail is where the head's furniture is most expensive: this
    // profile carried a 21 px ellipsis on «ДОСТИЖЕНИЯ» for as long as nothing
    // measured it here.
    await expectTitlesFit(page, 'Deck');
    await page.screenshot({path: 'screenshots/strategy-rail/deck-home.png'});
  });
});

test.describe('console strategy rail — 4K TV profile', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the twin-rail geometry holds on the TV profile', async ({page, request}) => {
    await bootHome(page, request, '&consoleProfile=tv');

    const {left, right} = await railBoxes(page);
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(2);
    expect(await page.locator('.con-inspector').count()).toBe(0);
    // Nothing overflows the rail: every medal row lies inside the rail box.
    const rows = await page.locator('.con-strat__item').all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const box = await row.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(right.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(right.x + right.width + 1);
    }
    // The couch title never ellipsizes — the TV rem is where «ДОСТИЖЕНИЯ»
    // actually ran out of line once.
    await expectTitlesFit(page, '4K TV');
    await page.screenshot({path: 'screenshots/strategy-rail/tv4k-home.png'});
  });
});
