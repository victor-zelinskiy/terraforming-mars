import {test, expect, Page} from '@playwright/test';
import {bootSeededGame, createGameWithCards, soloGameConfig} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE HUD FRAME — the two full-bleed horizontal rails of the console cockpit
 * (the top status strip + the bottom command bar).
 *
 * Pins the architectural contract of the frame rework:
 *  1. BOTH rails resolve their height from the ONE shared token
 *     (`--con-hud-h`) and are therefore strictly EQUAL — never two similar
 *     constants;
 *  2. FULL BLEED: the top rail starts at y=0 and spans the whole viewport
 *     width; the bottom rail ends exactly at the bottom edge — no outer
 *     margins, no root padding, no floating-card insets;
 *  3. the hand dock's plate is FLUSH with the bottom rail (one shared
 *     height — the bay socket no longer pokes above the frame; only the
 *     cards rise over it, as an overlay);
 *  4. the CENTRAL band really receives the freed height: `.con-main` spans
 *     exactly viewport − 2×(rail + gap), and both side rails stretch to it;
 *  5. the generation block reads the ordinary «ПКЛ. N» — the final
 *     generation may only ever recolour it (guarded at the unit level too);
 *  6. nothing overlaps: the board stage clears the dock's card tops, the
 *     rails clear the side panels.
 *
 * Parameterised over FHD (standard profile) and 4K (forced tv profile,
 * --con-ui-scale = 2) — a geometry claim asserted at one resolution is a
 * claim about one resolution.
 */

const OUT_ROOT = path.resolve('screenshots', 'hud-frame');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  /** Extra ?player query — '&consoleProfile=tv' forces the TV profile. */
  profileQuery: string;
  /** The html class the profile must land on (sanity that the preset took). */
  profileClass: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'fhd-standard', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto', profileClass: 'con-profile-standard'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv', profileClass: 'con-profile-tv'},
];

type FrameGeometry = {
  remPx: number;
  hudToken: string;
  hudPx: number;
  gapPx: number;
  rootPadding: string;
  strip: {top: number, bottom: number, left: number, right: number, height: number};
  stripComputedHeight: string;
  bar: {top: number, bottom: number, left: number, right: number, height: number};
  barComputedHeight: string;
  main: {top: number, bottom: number, height: number};
  resRail: {top: number, bottom: number, height: number} | undefined;
  stratRail: {top: number, bottom: number, height: number} | undefined;
  plateTop: number | undefined;
  dockCardTop: number | undefined;
  boardStageBottom: number | undefined;
  viewport: {width: number, height: number};
};

async function readFrameGeometry(page: Page): Promise<FrameGeometry> {
  return await page.evaluate(() => {
    const rectOf = (sel: string) => {
      const el = document.querySelector(sel);
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height};
    };
    const root = document.querySelector('.con-root') as HTMLElement;
    const rootCs = getComputedStyle(root);
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const hudToken = rootCs.getPropertyValue('--con-hud-h').trim();
    const gapToken = rootCs.getPropertyValue('--con-hud-gap').trim();
    const toPx = (token: string) => token.endsWith('rem') ? parseFloat(token) * remPx : parseFloat(token);
    const strip = document.querySelector('.con-status') as HTMLElement;
    const bar = document.querySelector('.con-footer .con-cmdbar') as HTMLElement;
    const dockCard = document.querySelector('.con-handdock__card');
    return {
      remPx,
      hudToken,
      hudPx: toPx(hudToken),
      gapPx: toPx(gapToken),
      rootPadding: rootCs.padding,
      strip: rectOf('.con-status')!,
      stripComputedHeight: getComputedStyle(strip).height,
      bar: rectOf('.con-footer .con-cmdbar')!,
      barComputedHeight: getComputedStyle(bar).height,
      main: rectOf('.con-main')!,
      resRail: rectOf('.con-res-host'),
      stratRail: rectOf('.con-strat'),
      plateTop: rectOf('.con-handdock__plate')?.top,
      dockCardTop: dockCard === null ? undefined : dockCard.getBoundingClientRect().top,
      boardStageBottom: rectOf('.con-board__stage')?.bottom,
      viewport: {width: window.innerWidth, height: window.innerHeight},
    };
  });
}

for (const preset of PRESETS) {
  test.describe(`console HUD frame · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('one shared rail height, full-bleed edges, the centre gets the height', async ({page, request}) => {
      test.setTimeout(240_000);

      const playerId = await createGameWithCards(request, [], {config: soloGameConfig()});
      await bootSeededGame(page, request, playerId, {query: preset.profileQuery});
      await expect(page.locator('.con-status')).toHaveCount(1, {timeout: 45_000});
      await expect(page.locator('.con-footer .con-cmdbar')).toHaveCount(1);
      // The preset landed on the intended layout profile.
      await expect(page.locator('html')).toHaveClass(new RegExp(preset.profileClass));

      const g = await readFrameGeometry(page);
      const vw = g.viewport.width;
      const vh = g.viewport.height;
      // Sub-device-pixel slack: rect maths under a scaled rem base.
      const eps = 1;

      // ── 1 · ONE height token drives BOTH rails, strictly equal. ──
      expect(g.hudToken.endsWith('rem'), `--con-hud-h is a rem token (got «${g.hudToken}»)`).toBe(true);
      expect(g.stripComputedHeight, 'strip height == bar height (computed, same token)').toBe(g.barComputedHeight);
      expect(Math.abs(g.strip.height - g.hudPx)).toBeLessThanOrEqual(eps);
      expect(Math.abs(g.bar.height - g.hudPx)).toBeLessThanOrEqual(eps);

      // ── 2 · FULL BLEED: no outer margins, no root padding. ──
      expect(g.rootPadding, 'the root keeps no outer chrome').toBe('0px');
      expect(Math.abs(g.strip.top - 0), 'top rail starts at y=0').toBeLessThanOrEqual(eps);
      expect(Math.abs(g.strip.left - 0), 'top rail reaches the left edge').toBeLessThanOrEqual(eps);
      expect(Math.abs(g.strip.right - vw), 'top rail reaches the right edge').toBeLessThanOrEqual(eps);
      expect(Math.abs(g.bar.bottom - vh), 'bottom rail ends at the bottom edge').toBeLessThanOrEqual(eps);
      expect(Math.abs(g.bar.left - 0), 'bottom rail reaches the left edge').toBeLessThanOrEqual(eps);
      expect(Math.abs(g.bar.right - vw), 'bottom rail reaches the right edge').toBeLessThanOrEqual(eps);

      // ── 3 · the dock plate is FLUSH with the bottom rail. ──
      expect(g.plateTop, 'the dock plate is mounted').not.toBe(undefined);
      expect(Math.abs((g.plateTop ?? 0) - g.bar.top), 'plate top == bar top (one shared height)')
        .toBeLessThanOrEqual(eps);

      // ── 4 · the centre band really got the height. ──
      const expectedMain = vh - 2 * (g.hudPx + g.gapPx);
      expect(Math.abs(g.main.height - expectedMain), 'main == viewport − 2×(rail+gap) — no hidden spacers')
        .toBeLessThanOrEqual(2 * eps);
      // Both side rails stretch the full centre band.
      expect(g.resRail, 'left resource rail mounted').not.toBe(undefined);
      expect(Math.abs((g.resRail?.height ?? 0) - g.main.height)).toBeLessThanOrEqual(2 * eps);
      expect(g.stratRail, 'right strategy rail mounted').not.toBe(undefined);
      expect(Math.abs((g.stratRail?.height ?? 0) - g.main.height)).toBeLessThanOrEqual(2 * eps);

      // ── 5 · the generation block reads the ordinary «ПКЛ. N». ──
      const genLabel = (await page.locator('.con-status__gen-label').innerText()).trim();
      expect(genLabel.length).toBeGreaterThan(0);
      expect(genLabel, 'no final marker word in the generation label').not.toMatch(/ФИНАЛЬН|FINAL/i);
      const genValue = (await page.locator('.con-status__gen').innerText()).replace(/\D+/g, '');
      expect(Number(genValue)).toBeGreaterThanOrEqual(1);

      // ── 6 · no overlaps: the board stage clears the dock's card tops. ──
      if (g.boardStageBottom !== undefined && g.dockCardTop !== undefined) {
        expect(g.boardStageBottom, 'board stage bottom stays above the dock cards')
          .toBeLessThanOrEqual(g.dockCardTop + eps);
      }
      // The rails never eat into the side panels.
      expect((g.resRail?.top ?? 0)).toBeGreaterThanOrEqual(g.strip.bottom - eps);
      expect((g.resRail?.bottom ?? vh)).toBeLessThanOrEqual(g.bar.top + eps);

      const outDir = path.join(OUT_ROOT, preset.id);
      fs.mkdirSync(outDir, {recursive: true});
      await page.screenshot({path: path.join(outDir, 'board-home.png')});
      await page.locator('.con-status').screenshot({path: path.join(outDir, 'top-rail.png')});
      // The bottom rail + the dock socket (welded frame): clip the band from
      // the full page so the screenshot shows the true viewport edge.
      await page.screenshot({
        path: path.join(outDir, 'bottom-rail.png'),
        clip: {x: 0, y: vh - Math.ceil(g.hudPx) - 90, width: vw, height: Math.ceil(g.hudPx) + 90},
      });
    });
  });
}
