import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, cinematicBeat, press, settle} from './consoleStart';
import {PARLIAMENT_PRESETS} from './parliamentDrive';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';

/**
 * THE COMPOSITE INCOME ON EVERY CELL (the 2026-09-28 report, item 3): the
 * Redux Venus pays «+1 Venus step AND the marker's part», so every track cell
 * — on the tile and on the dossier's instrument — carries the fixed Venus
 * step on its own line above the marker's part, and a LOSE_RESOURCES position
 * reads as a LOSS («−4», never «4»). Measured on the 1080 and the 4K profiles:
 * every cell's content stays INSIDE its own box (the fixed line, the glyph and
 * the quantity within the cell; no vertical scroll cut). Evidence → screenshots/venus-cells/.
 */

const OUT = path.resolve('screenshots', 'venus-cells');
const VENUS = 'Venus Redux';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

type CellFit = {
  widest: {cls: string, right: number, bottom: number};
  index: number;
  fixed: string;
  reward: string;
  qty: string;
  levy: boolean;
  /** Overflow of the cell's content past its own box (positive = cut), px. */
  cut: {x: number, y: number};
  /** The fixed line and the quantity lie inside the cell's box. */
  inside: boolean;
};

async function instrumentCells(page: Page): Promise<Array<CellFit>> {
  return page.evaluate(() => {
    const within = (inner: DOMRect, outer: DOMRect, tol = 1) =>
      inner.left >= outer.left - tol && inner.right <= outer.right + tol && inner.top >= outer.top - tol && inner.bottom <= outer.bottom + tol;
    return Array.from(document.querySelectorAll<HTMLElement>('.con-colinspect .con-colfocus__xcell')).map((cell, index) => {
      const box = cell.getBoundingClientRect();
      const fixed = cell.querySelector<HTMLElement>('[data-colony-track-fixed]');
      const qty = cell.querySelector<HTMLElement>('.con-colfocus__xcell-qty');
      const glyph = cell.querySelector<HTMLElement>('.con-colfocus__xcell-glyph');
      const parts = [fixed, glyph, qty].filter((el): el is HTMLElement => el !== null);
      // DIAGNOSTIC: the descendant reaching farthest past the cell's right / bottom edge (what a scroll cut is made of).
      let widest = {cls: '', right: -1e9, bottom: -1e9};
      cell.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          return;
        }
        const right = r.right - box.right;
        const bottom = r.bottom - box.bottom;
        if (right > widest.right) {
          widest = {cls: el.className.toString().slice(0, 60), right: Math.round(right * 10) / 10, bottom: Math.round(bottom * 10) / 10};
        }
      });
      return {
        widest,
        index,
        fixed: fixed?.querySelector('.benefit-glyph')?.getAttribute('data-bg-type') ?? '',
        reward: cell.querySelector('.con-colfocus__xcell-glyph .benefit-glyph')?.getAttribute('data-bg-type') ?? '',
        qty: (qty?.textContent ?? '').trim(),
        levy: qty?.classList.contains('con-colfocus__xcell-qty--levy') ?? false,
        cut: {x: cell.scrollWidth - cell.clientWidth, y: cell.scrollHeight - cell.clientHeight},
        inside: parts.every((el) => within(el.getBoundingClientRect(), box)),
      };
    });
  });
}

for (const preset of PARLIAMENT_PRESETS.filter((p) => p.id !== 'deck-handheld')) {
  test.describe(`the composite income on every cell (${preset.id})`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1});

    test('the tile and the dossier draw the fixed Venus step on every cell, the levy signed, nothing cut', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixture(page, request, 'venus-trade', {keepColony: VENUS, query: preset.query});
      await settle(page);
      await openColonies(page);
      await focusTile(page, VENUS);
      await shoot(page, `${preset.id}-tile`);

      const tile = await page.evaluate((name) => {
        const el = document.querySelector<HTMLElement>(`[data-test="con-colony-${name}"]`);
        const cell = el?.querySelector<HTMLElement>('.con-coltile__cell--trade') ?? null;
        return {
          fixed: el?.querySelector('[data-colony-trade-fixed] .benefit-glyph')?.getAttribute('data-bg-type') ?? '',
          cut: cell === null ? {x: -1, y: -1} : {x: cell.scrollWidth - cell.clientWidth, y: cell.scrollHeight - cell.clientHeight},
        };
      }, VENUS);
      console.log(`── tile (${preset.id}) ──`, JSON.stringify(tile));
      expect(tile.fixed, 'the tile draws the fixed Venus step').toBe(String(ColonyBenefit.INCREASE_VENUS_SCALE));
      expect(tile.cut.x, 'the tile\'s trade cell is not cut (width)').toBeLessThanOrEqual(1);
      expect(tile.cut.y, 'the tile\'s trade cell is not cut (height)').toBeLessThanOrEqual(1);

      await page.keyboard.press('KeyX');
      await cinematicBeat(page, 2300, 'the dossier entrance + the late reveal wave');
      await shoot(page, `${preset.id}-dossier`);
      const cells = await instrumentCells(page);
      console.log(`── cells (${preset.id}) ──`, JSON.stringify(cells));
      expect(cells.length, 'seven track cells').toBe(7);
      for (const cell of cells) {
        expect(cell.fixed, `cell ${cell.index + 1} carries the fixed Venus step`).toBe(String(ColonyBenefit.INCREASE_VENUS_SCALE));
        // (The marker rail's groove deliberately overhangs each cell sideways by .35rem to read as ONE
        // continuous rail — `__xcell-rail::before` — so the WIDTH is judged by the content parts below,
        // never by the cell's scroll box.)
        expect(cell.cut.y, `cell ${cell.index + 1} is not cut (height)`).toBeLessThanOrEqual(1);
        expect(cell.inside, `cell ${cell.index + 1}: the fixed line, the glyph and the quantity stand inside the cell`).toBe(true);
      }
      expect(cells[0].reward, 'the 1st position is a levy').toBe(String(ColonyBenefit.LOSE_RESOURCES));
      expect(cells[0].qty, 'the levy reads as a LOSS').toBe('−4');
      expect(cells[0].levy, 'the levy wears its own register').toBe(true);
      expect(cells[1].qty, 'the empty 2nd position prints no number').toBe('');
    });
  });
}
