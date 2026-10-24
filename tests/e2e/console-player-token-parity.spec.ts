import {test, expect} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE PLAYER PIECES — the cube and the delegate figure stand in ONE palette
 * (docs/claude/console/parliament-delegate-figure.md, probes П1 / П2).
 *
 * The stand (`?cubePlayground`, its «Delegate figures» section) lays out
 * every player colour and the neutral steel as a FIGURE at the hall's three
 * sizes (18 · 24 · 28 logical px) with the CUBE of the same player beside the
 * 24 row, and the card's printed marks. Three claims:
 *   A. one palette — every figure paints the very `--pt-*` set its cube does
 *      (the resolved computed values, colour by colour, steel included);
 *   B. the size is the HEIGHT: a figure's box is 0.8 × its height, never under
 *      the 18-logical floor at the profile's scale;
 *   C. the storyboard: the section at 4K and the same frame at 25 % («the
 *      couch»), for the owner's eye — the silhouette and the colour must read.
 */

const OUT = path.resolve('screenshots', 'delegfig');

for (const preset of [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', scale: 2}] as const) {
  test.describe(`player token parity · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the delegate figure stands in its cube's RGB, sized by its height (${preset.id})`, async ({page}) => {
      test.setTimeout(120_000);
      await page.goto(`/?cubePlayground${preset.query}`);
      const stand = page.locator('[data-token-stand="figures"]');
      await expect(stand).toHaveCount(1, {timeout: 30_000});
      await stand.scrollIntoViewIfNeeded();

      // A — one palette, read from the RESOLVED styles of the pieces themselves.
      const pairs = await page.evaluate(() => {
        const vars = ['--pt-base', '--pt-top', '--pt-right', '--pt-edge-hi', '--pt-glow'];
        return Array.from(document.querySelectorAll<HTMLElement>('[data-token-row="24"] [data-token-pair]')).map((pair) => {
          const fig = pair.querySelector<HTMLElement>('.player-delegate');
          const cube = pair.querySelector<HTMLElement>('.player-cube');
          const read = (el: HTMLElement | null) => (el === null ? null : vars.map((v) => getComputedStyle(el).getPropertyValue(v).trim()));
          return {color: pair.getAttribute('data-token-pair'), figure: read(fig), cube: read(cube),
            token: fig?.getAttribute('data-player-token') ?? null, steel: fig?.classList.contains('player-delegate--steel') ?? false};
        });
      });
      expect(pairs.length, 'eight colours and the steel').toBe(9);
      for (const p of pairs) {
        expect(p.figure, `${p.color}: the figure paints`).not.toBeNull();
        expect(p.figure, `${p.color}: the figure's palette IS its cube's`).toEqual(p.cube);
        expect(p.figure?.[0], `${p.color}: a real colour`).toMatch(/^rgb\(/);
        expect(p.token).toBe(p.color);
        expect(p.steel, `${p.color}: steel only for the neutral`).toBe(p.color === 'neutral');
      }

      // B — the box: height = the row's logical size × the profile's scale (≥ the floor), width = 0.8 × height.
      const boxes = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-token-row] .player-delegate')).map((el) => {
        const r = el.getBoundingClientRect();
        return {row: Number(el.closest<HTMLElement>('[data-token-row]')?.getAttribute('data-token-row')), w: r.width, h: r.height};
      }));
      expect(boxes.length).toBe(27);
      const scale = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize) / 20);
      for (const b of boxes) {
        expect(b.h, `row ${b.row}: the figure's height`).toBeCloseTo(Math.round(b.row * scale), 0);
        expect(b.w / b.h, `row ${b.row}: a standee is 0.8 × its height`).toBeCloseTo(0.8, 1);
        expect(b.h, 'never under the floor').toBeGreaterThanOrEqual(18 * scale - 1);
      }

      // The printed marks are the SVG silhouette (never the old bust PNG).
      const prints = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-token-print]')).map((el) => getComputedStyle(el).backgroundImage));
      expect(prints.join(' ')).toContain('delegate.svg');
      expect(prints.join(' ')).toContain('delegate-neutral.svg');
      expect(prints.join(' ')).not.toContain('.png');

      // C — the storyboard: the section at full size and at the couch's distance.
      fs.mkdirSync(OUT, {recursive: true});
      const full = path.join(OUT, `figures-${preset.id}.png`);
      await stand.screenshot({path: full});
      await page.evaluate(() => document.documentElement.style.setProperty('zoom', '0.25'));
      await stand.screenshot({path: path.join(OUT, `figures-${preset.id}-couch25.png`)});
      await page.evaluate(() => document.documentElement.style.removeProperty('zoom'));
    });
  });
}
