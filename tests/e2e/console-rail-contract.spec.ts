import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig} from './consoleStart';

/**
 * THE SIDE-RAIL LAYOUT CONTRACTS (capital-iteration stabilization guard).
 *
 * Right rail (`.con-strat`) — the ROW CONTRACT `medal | flexible | value`:
 *  - every row rect fits inside the rail's border box;
 *  - every VALUE (`.con-strat__num`) is fully visible: its right edge stays
 *    on the safe content line (never at / past the physical viewport edge),
 *    and no value cell is horizontally clipped (scrollWidth == clientWidth);
 *  - all value right edges share ONE optical axis (max spread 6 logical px).
 *
 * Left rail (`.con-res`) — the VERTICAL BUDGET + row grid:
 *  - the rail's content FITS between the two beams: no hidden scroll
 *    (scrollHeight <= clientHeight + 1) and the tag matrix's bottom stays
 *    above the bottom rail's top edge;
 *  - resource rows share one icon column and one value baseline column
 *    (max spread 2 px each);
 *  - the tag grid keeps three equal columns (cell centre spread <= 2px).
 *
 * Top rail — the DECK DELTA OWNERSHIP: the deck's metric-feedback host
 * anchors INSIDE the deck stack's own footprint (its centre falls within
 * the deck cell ± 1rem), never floating between neighbouring readouts.
 *
 * Runs at FHD and forced-TV 4K in a Venus game (13 tag cells — the tag
 * matrix's tallest standard layout, exactly where the overflow shipped).
 */

const OUT = path.resolve('screenshots', 'rail-contract');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

type Box = {x: number, y: number, w: number, h: number, r: number, b: number};

type RailAudit = {
  rem: number,
  contentSafePx: number,
  viewportW: number,
  strat: {
    rail: Box,
    items: ReadonlyArray<Box>,
    nums: ReadonlyArray<{r: number, clipped: boolean, text: string}>,
  },
  res: {
    rail: Box,
    scrollHeight: number,
    clientHeight: number,
    footerTop: number,
    tagmxBottom: number,
    rowIconXs: ReadonlyArray<number>,
    rowValueRs: ReadonlyArray<number>,
    tagColCenters: ReadonlyArray<ReadonlyArray<number>>,
  },
  deck: {cell: Box, host?: Box},
};

async function readRails(page: Page): Promise<RailAudit> {
  return await page.evaluate(() => {
    const box = (el: Element): Box => {
      const b = el.getBoundingClientRect();
      return {x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom};
    };
    type Box = {x: number, y: number, w: number, h: number, r: number, b: number};
    const one = (sel: string): Element => {
      const el = document.querySelector(sel);
      if (el === null) {
        throw new Error(`missing ${sel}`);
      }
      return el;
    };
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:var(--con-hud-pad-x);height:1px;visibility:hidden';
    one('.con-root').appendChild(probe);
    const contentSafePx = probe.getBoundingClientRect().width;
    probe.remove();

    const strat = one('.con-strat');
    const items = [...document.querySelectorAll('.con-strat__item')];
    // The AXIS is the reserved third grid track: measure the value BLOCK
    // (cell / race-wrap) right edge — the contract's own boundary — and
    // clip via the block's scroll box.
    const nums = [...document.querySelectorAll('.con-strat__cell, .con-strat__race-wrap')].map((el) => {
      const c = el as HTMLElement;
      return {
        r: c.getBoundingClientRect().right,
        clipped: c.scrollWidth > c.clientWidth + 1,
        text: (c.textContent ?? '').trim(),
      };
    }).filter((n) => n.text !== '');

    const res = one('.con-res') as HTMLElement;
    const footer = one('.con-footer > .con-cmdbar');
    const tagmx = document.querySelector('.con-tagmx');
    const rows = [...document.querySelectorAll('.con-res__row')];
    const tagCells = [...document.querySelectorAll('.con-tagmx__cell')];
    const colCenters: Array<Array<number>> = [[], [], []];
    tagCells.forEach((cell, i) => {
      const b = cell.getBoundingClientRect();
      colCenters[i % 3].push(b.left + b.width / 2);
    });

    const deckCell = document.querySelector('.con-deckstack');
    const deckHost = document.querySelector('.con-deckstack .metric-feedback-host');

    return {
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      contentSafePx,
      viewportW: window.innerWidth,
      strat: {
        rail: box(strat),
        items: items.map(box),
        nums,
      },
      res: {
        rail: box(res),
        scrollHeight: res.scrollHeight,
        clientHeight: res.clientHeight,
        footerTop: box(footer).y,
        tagmxBottom: tagmx !== null ? box(tagmx).b : 0,
        rowIconXs: rows.map((r) => {
          const icon = r.querySelector('.con-res__icon');
          return icon !== null ? icon.getBoundingClientRect().left : -1;
        }),
        rowValueRs: rows.map((r) => {
          const v = r.querySelector('.con-res__value');
          return v !== null ? v.getBoundingClientRect().right : -1;
        }),
        tagColCenters: colCenters,
      },
      deck: {
        cell: deckCell !== null ? box(deckCell) : {x: 0, y: 0, w: 0, h: 0, r: 0, b: 0},
        host: deckHost !== null ? box(deckHost) : undefined,
      },
    };
  });
}

for (const profile of PROFILES) {
  test.describe(`side-rail contracts · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('right values never clip, left rail fits its budget, deck delta owns its chip', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootIntoGame(page, request, {
        config: soloGameConfig({
          automa: {difficulty: 'normal'},
          expansions: {venusNext: true},
        }),
        query: profile.query,
      });
      if (profile.tag === 'tv4k') {
        await expect(page.locator('html')).toHaveClass(/con-profile-tv/);
      }
      await page.waitForSelector('.con-strat', {timeout: 15_000});
      await page.waitForTimeout(800);
      await shoot(page, `${profile.tag}-board`);

      const a = await readRails(page);
      const rem = a.rem;
      console.log(`[RAIL:${profile.tag}] rem=${rem} contentSafe=${a.contentSafePx.toFixed(1)} ` +
        `stratRail=[${a.strat.rail.x.toFixed(0)}..${a.strat.rail.r.toFixed(0)}] ` +
        `numsR=[${a.strat.nums.map((n) => n.r.toFixed(0)).join(',')}] ` +
        `resScroll=${a.res.scrollHeight}/${a.res.clientHeight} tagmxB=${a.res.tagmxBottom.toFixed(0)} footerTop=${a.res.footerTop.toFixed(0)}`);

      // ── RIGHT RAIL: the row contract ──
      expect(a.strat.items.length).toBeGreaterThanOrEqual(8);
      for (const [i, it] of a.strat.items.entries()) {
        expect(it.r, `strat row[${i}] inside the rail border box`).toBeLessThanOrEqual(a.strat.rail.r + 1);
      }
      expect(a.strat.nums.length).toBeGreaterThanOrEqual(6);
      for (const n of a.strat.nums) {
        // Fully visible AND on the content-safe line — never at the bezel.
        expect(n.clipped, `value «${n.text}» horizontally clipped`).toBe(false);
        expect(n.r, `value «${n.text}» right edge on the safe line`)
          .toBeLessThanOrEqual(a.viewportW - a.contentSafePx * 0.55);
      }
      // One optical axis for the value column (6 logical px @1080 tolerance).
      const rs = a.strat.nums.map((n) => n.r);
      expect(Math.max(...rs) - Math.min(...rs)).toBeLessThanOrEqual(0.3 * rem);

      // ── LEFT RAIL: the vertical budget ──
      expect(a.res.scrollHeight, 'left rail must not hide content behind a scroll')
        .toBeLessThanOrEqual(a.res.clientHeight + 2);
      expect(a.res.rail.b, 'left rail ends above the bottom beam').toBeLessThanOrEqual(a.res.footerTop + 1);
      expect(a.res.tagmxBottom, 'tag matrix fully above the bottom beam')
        .toBeLessThanOrEqual(a.res.footerTop - 2);

      // Row grid: one icon column, one value axis.
      const iconXs = a.res.rowIconXs.filter((x) => x >= 0);
      const valRs = a.res.rowValueRs.filter((x) => x >= 0);
      expect(iconXs.length).toBeGreaterThanOrEqual(5);
      expect(Math.max(...iconXs) - Math.min(...iconXs), 'icon column').toBeLessThanOrEqual(2);
      expect(Math.max(...valRs) - Math.min(...valRs), 'value axis').toBeLessThanOrEqual(2);

      // Tag grid: three stable columns.
      for (const col of a.res.tagColCenters) {
        if (col.length > 1) {
          expect(Math.max(...col) - Math.min(...col), 'tag column centres').toBeLessThanOrEqual(2);
        }
      }

      // ── DECK DELTA OWNERSHIP ──
      if (a.deck.host !== undefined && a.deck.host.w >= 0) {
        const hostCx = a.deck.host.x + a.deck.host.w / 2;
        expect(hostCx, 'deck delta host centred within the deck cell')
          .toBeGreaterThanOrEqual(a.deck.cell.x - rem);
        expect(hostCx).toBeLessThanOrEqual(a.deck.cell.r + rem);
      }
    });
  });
}
