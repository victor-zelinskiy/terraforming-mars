import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig, press} from './consoleStart';

/**
 * HYDRO NETWORKS · the VERTICAL-COMPOSITION contract (iteration: «Гидросеть
 * значительно лучше использует вертикальное пространство»).
 *
 * Guards the geometry the rework bought:
 *  - the track stops carry real physical presence (width/height floors);
 *  - the focused stop grows into the hero cell AND drops a connector stem
 *    toward the dossier (track → detail is one construction);
 *  - the dossier panel spans the widened stage floor (width floor) and its
 *    CTA zone seats the panel's BOTTOM edge (margin-top:auto — grown height
 *    reads as composed air, never a void between rows and action);
 *  - the section's right edge rides the VISUAL-STAGE inset (the track is
 *    visual matter), strictly past the old content-safe line.
 *
 * Screenshots → `screenshots/hydro-geometry/`.
 */

const OUT = path.resolve('screenshots', 'hydro-geometry');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`hydro vertical composition · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('track presence + dossier composition', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootIntoGame(page, request, {
        config: soloGameConfig({expansions: {deltaProject: true}}),
        query: profile.query,
      });

      // RT wheel → left = Hydronetwork.
      await press(page, 'Period', 1100);
      await press(page, 'ArrowLeft', 1500);
      await page.waitForSelector('.con-hydro', {timeout: 8_000});
      await page.waitForTimeout(700);
      await shoot(page, `${profile.tag}-01-hydro-browse`);

      const geo = await page.evaluate(() => {
        const r = (el: Element) => {
          const b = el.getBoundingClientRect();
          return {x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom};
        };
        const root = document.querySelector('.con-hydro');
        const stop = document.querySelector('.con-hydro__stop:not(.con-hydro__stop--focused)');
        const focused = document.querySelector('.con-hydro__stop--focused');
        const panel = document.querySelector('.con-hydro__panel');
        const body = document.querySelector('.con-hydro__panelbody');
        const cta = document.querySelector('.con-hydro__ctazone');
        const rail = document.querySelector('.con-hydro__rail');
        if (root === null || stop === null || panel === null || rail === null) {
          throw new Error('hydro chrome not mounted');
        }
        const stemColor = focused !== null ?
          getComputedStyle(focused, '::after').backgroundImage : '';
        return {
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
          root: r(root), stop: r(stop), focused: focused !== null ? r(focused) : undefined,
          panel: r(panel), body: body !== null ? r(body) : undefined,
          cta: cta !== null ? r(cta) : undefined,
          rail: r(rail),
          stem: stemColor.includes('gradient'),
        };
      });
      const rem = geo.rem;

      // Track presence: the stop floors (base 5.2 × 10.4rem; the profile
      // ladders may only grow them).
      expect(geo.stop.w).toBeGreaterThanOrEqual(5.1 * rem);
      expect(geo.stop.h).toBeGreaterThanOrEqual(10.3 * rem);
      // The hero stop is magnified AND carries the connector stem.
      expect(geo.focused, 'a focused stop exists').toBeTruthy();
      expect(geo.focused!.w).toBeGreaterThan(geo.stop.w * 1.5);
      expect(geo.stem, 'track → detail connector stem').toBe(true);

      // The dossier panel spans the widened floor (min(70rem, 100%) base,
      // 88rem TV) and the CTA seats its bottom edge.
      expect(geo.panel.w).toBeGreaterThanOrEqual(Math.min(69 * rem, geo.root.w * 0.9));
      if (geo.cta !== undefined) {
        const gap = geo.panel.b - geo.cta.b;
        expect(gap, 'CTA zone seats the panel bottom (margin-top:auto)').toBeLessThanOrEqual(1.4 * rem);
      }

      // VISUAL-STAGE inset: the track's right edge clears the old
      // content-safe boundary (one inset, the stage one).
      const insets = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;left:0;top:0;width:var(--con-hud-pad-x);height:1px;visibility:hidden';
        const root = document.querySelector('.con-root');
        if (root === null) {
          throw new Error('no con-root');
        }
        root.appendChild(probe);
        const contentSafe = probe.getBoundingClientRect().width;
        probe.style.width = 'var(--con-stage-x)';
        const stage = probe.getBoundingClientRect().width;
        probe.remove();
        return {contentSafe, stage};
      });
      expect(insets.stage).toBeLessThan(insets.contentSafe);
      expect(geo.root.r).toBeGreaterThan(profile.width - 1); // welded to the edge
      expect(geo.rail.r).toBeGreaterThan(profile.width - insets.contentSafe - 1);

      // Walk to the farthest stop: geometry stays sane, the stem follows.
      await press(page, 'ArrowRight', 400);
      await press(page, 'ArrowRight', 400);
      await shoot(page, `${profile.tag}-02-hydro-step3`);
      const after = await page.evaluate(() => {
        const p = document.querySelector('.con-hydro__panel');
        const f = document.querySelector('.con-hydro__stop--focused');
        if (p === null || f === null) {
          throw new Error('hydro browse lost');
        }
        const pb = p.getBoundingClientRect();
        return {panelTop: pb.top, panelW: pb.width, stem: getComputedStyle(f, '::after').backgroundImage.includes('gradient')};
      });
      // The panel frame does not move on a step (top-anchored contract).
      expect(Math.abs(after.panelTop - geo.panel.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.panelW - geo.panel.w)).toBeLessThanOrEqual(1);
      expect(after.stem).toBe(true);

      await press(page, 'Escape', 800);
    });
  });
}
