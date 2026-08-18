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
 * THE PLATFORM ADVANCE ALLOWANCE — why this spec measures HEADROOM, not «does
 * it fit right here».
 *
 * Chromium lays HUD-sized text out with SUBPIXEL glyph advances on a Windows
 * dev box, and with advances ROUNDED UP TO WHOLE PIXELS on the Linux CI runner
 * (FreeType, below the size at which subpixel positioning turns on). Measured
 * on this very line: «ДОСТИЖЕНИЯ» inks 98.0 px at 13.2 px locally and ~103.5 px
 * on the runner — about +0.55 px per glyph, +5.6 % on a ten-letter word. The
 * same string at 34 px (the TV profile) costs nothing extra, which is why the
 * rail could ship an ellipsis that ONLY the FHD runner ever saw.
 *
 * A head tuned until the longest name just fits therefore has no margin at all
 * where it actually runs. So the assertion is «would this still fit if every
 * glyph advance rounded up», and the guard is a MEASURED column, never
 * arithmetic mirroring the LESS.
 *
 * The allowance is the WORST CASE of that rounding, not the observed average:
 * ceiling every advance costs at most one whole pixel per glyph (the run above
 * happened to cost .55). Sizing the head to the average is how a margin gets
 * spent before it is needed — the string that rounds badly is a different
 * string, or the same one at another rem.
 */
const ADVANCE_ROUNDING_PX = 1;

type HeadFit = {text: string, chars: number, ink: number, avail: number, slack: number, need: number};

/**
 * Per zone head: how wide the name INKS, how wide its column really is, and the
 * margin between them. The column is measured on a CLONE of the real head at
 * the real width — a string no head can hold shrinks the flex item to exactly
 * the room the key cap and the slot tray leave beside it. (The live title is a
 * `flex: 0 1 auto` item, so while it fits, its own box IS its ink and reports
 * nothing about the space it has.)
 */
async function headFits(page: Page): Promise<Array<HeadFit>> {
  return page.evaluate((penalty) => {
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
      // The INK, not the box: the title is a block that fills its column, so
      // its own rect can never report an overflow the ellipsis hid.
      const range = document.createRange();
      range.selectNodeContents(title);
      const rects = [...range.getClientRects()];
      const ink = rects.length === 0 ? 0 : Math.max(...rects.map((x) => x.width));
      title.textContent = 'Ш'.repeat(200);
      const avail = title.getBoundingClientRect().width;
      clone.remove();

      const chars = [...text].length;
      const r2 = (v: number) => Math.round(v * 100) / 100;
      return {text, chars, ink: r2(ink), avail: r2(avail),
        slack: r2(avail - ink), need: r2(chars * penalty)};
    });
  }, ADVANCE_ROUNDING_PX);
}

/**
 * The zone titles are whole AND keep the margin that makes them whole
 * everywhere. Both halves are asserted at every profile — a fit claim proved
 * at one resolution is a claim about one resolution, and one proved on one
 * platform is a claim about one platform.
 */
async function expectTitlesFit(page: Page, where: string) {
  const fits = await headFits(page);
  console.log(`[strat head · ${where}] ` + fits.map((f) =>
    `«${f.text}» ink ${f.ink} · column ${f.avail} · slack ${f.slack} (need ${f.need})`).join(' | '));
  expect(fits.length, 'both zone heads were measured').toBe(2);

  const deficits = await page.evaluate(() =>
    [...document.querySelectorAll('.con-strat__title')].map((t) => t.scrollWidth - t.clientWidth));
  for (const d of deficits) {
    expect(d, `zone title fully visible (no ellipsis) — ${where}`).toBeLessThanOrEqual(1);
  }
  for (const f of fits) {
    expect(f.slack, `«${f.text}» keeps its cross-platform margin — ${where}`)
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
