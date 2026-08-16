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

type Box = {top: number, bottom: number, left: number, right: number, height: number, width: number};

type FrameGeometry = {
  remPx: number;
  hudToken: string;
  hudPx: number;
  gapPx: number;
  padXPx: number;
  rootPadding: string;
  strip: Box;
  stripComputedHeight: string;
  bar: Box;
  barComputedHeight: string;
  main: Box;
  resRail: Box | undefined;
  resContent: Box | undefined;
  stratRail: Box | undefined;
  stratContent: Box | undefined;
  board: Box | undefined;
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
      return {top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width};
    };
    const root = document.querySelector('.con-root') as HTMLElement;
    const rootCs = getComputedStyle(root);
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const hudToken = rootCs.getPropertyValue('--con-hud-h').trim();
    const gapToken = rootCs.getPropertyValue('--con-hud-gap').trim();
    const toPx = (token: string) => token.endsWith('rem') ? parseFloat(token) * remPx : parseFloat(token);
    // --con-pad-x is vw/clamp-valued — resolve it through a probe element.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--con-pad-x,0px)';
    root.appendChild(probe);
    const padXPx = probe.getBoundingClientRect().width;
    probe.remove();
    const strip = document.querySelector('.con-status') as HTMLElement;
    const bar = document.querySelector('.con-footer .con-cmdbar') as HTMLElement;
    const dockCard = document.querySelector('.con-handdock__card');
    return {
      remPx,
      hudToken,
      hudPx: toPx(hudToken),
      gapPx: toPx(gapToken),
      padXPx,
      rootPadding: rootCs.padding,
      strip: rectOf('.con-status')!,
      stripComputedHeight: getComputedStyle(strip).height,
      bar: rectOf('.con-footer .con-cmdbar')!,
      barComputedHeight: getComputedStyle(bar).height,
      main: rectOf('.con-main')!,
      resRail: rectOf('.con-res'),
      /* CONTENT witness, not the plate: the instrument plates deliberately
         BLEED into the hull zone (adaptive pass) — what must stay on the
         safe line is the printed content (the TR tile). */
      resContent: rectOf('.con-res .con-score__icon'),
      stratRail: rectOf('.con-strat'),
      stratContent: rectOf('.con-strat__zone'),
      board: rectOf('.con-board'),
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

      // ── 7 · PERIMETER: the side rails are full-bleed hull members —
      // chassis at the physical edges, content at the safe inset. ──
      expect(g.resRail, 'left rail mounted').not.toBe(undefined);
      expect(Math.abs(g.resRail?.left ?? 99), 'left rail chassis starts at x=0')
        .toBeLessThanOrEqual(eps);
      expect(g.resContent?.left ?? 0, 'left rail content stays at the safe inset')
        .toBeGreaterThanOrEqual(g.padXPx - eps);
      expect(g.stratRail, 'right rail mounted').not.toBe(undefined);
      expect(Math.abs((g.stratRail?.right ?? 0) - vw), 'right rail chassis ends at the viewport edge')
        .toBeLessThanOrEqual(eps);
      expect(g.stratContent?.right ?? vw, 'right rail content stays at the safe inset')
        .toBeLessThanOrEqual(vw - g.padXPx + eps);

      // ── 8 · ONE seam rhythm: every rail↔stage joint is the same token. ──
      const seamLeft = (g.board?.left ?? 0) - (g.resRail?.right ?? 0);
      const seamRight = (g.stratRail?.left ?? vw) - (g.board?.right ?? vw);
      const seamTop = g.main.top - g.strip.bottom;
      expect(Math.abs(seamLeft - g.gapPx), `left seam ${seamLeft} == gap ${g.gapPx}`).toBeLessThanOrEqual(eps);
      expect(Math.abs(seamRight - g.gapPx), `right seam ${seamRight} == gap ${g.gapPx}`).toBeLessThanOrEqual(eps);
      expect(Math.abs(seamTop - g.gapPx), `top seam ${seamTop} == gap ${g.gapPx}`).toBeLessThanOrEqual(eps);

      // ── 9 · a WORKSPACE is a state of the scene: its stage welds to the
      // right edge, square (no modal card), content inside the safe inset. ──
      for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
        if (await page.locator('.con-zoom, .con-quick, .con-composer').count() > 0) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(700);
          continue;
        }
        await page.keyboard.press('Period');
        await page.waitForTimeout(700);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }
      await expect(page.locator('.con-hand__frame')).toHaveCount(1, {timeout: 15_000});
      const hand = await page.evaluate(() => {
        const el = document.querySelector('.con-hand__frame');
        if (el === null) {
          return undefined;
        }
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;left:0;top:0;height:1px;visibility:hidden;width:var(--con-stage-x)';
        document.querySelector('.con-root')?.appendChild(probe);
        const stageX = probe.getBoundingClientRect().width;
        probe.style.width = 'var(--con-hud-pad-x)';
        const contentSafe = probe.getBoundingClientRect().width;
        probe.remove();
        const verdict = document.querySelector('.con-hand__verdictbar');
        const verdictPad = verdict !== null ? parseFloat(getComputedStyle(verdict).paddingRight) : 0;
        const verdictClasses = verdict !== null ? verdict.className : '(none)';
        return {right: r.right, left: r.left, radius: cs.borderTopRightRadius, padRight: parseFloat(cs.paddingRight), stageX, contentSafe, verdictPad, verdictClasses};
      });
      console.log(`[HAND:${preset.id}] padRight=${hand?.padRight} stageX=${hand?.stageX} contentSafe=${hand?.contentSafe} verdictPad=${hand?.verdictPad} classes=${hand?.verdictClasses}`);
      expect(hand, 'the hand workspace frame is up').not.toBe(undefined);
      expect(Math.abs((hand?.right ?? 0) - vw), 'the workspace stage welds to the right viewport edge')
        .toBeLessThanOrEqual(eps);
      expect(hand?.radius, 'the stage is square — a scene state, not a modal card').toBe('0px');
      // TWO-LEVEL SAFE AREA: the gallery body rides the VISUAL-STAGE inset
      // (smaller than the content-safe line — that is the point), and the
      // verdict bar's TEXT claws the difference back to the content line.
      // (The bar only mounts once a card is focused — an empty hand has no
      // text on that line to protect, so the sum is asserted only then.)
      expect(hand?.padRight ?? 0, 'stage body rides the visual-stage inset')
        .toBeGreaterThanOrEqual((hand?.stageX ?? 0) - eps);
      if (hand !== undefined && hand.verdictClasses !== '(none)') {
        expect(hand.padRight + hand.verdictPad, 'verdict text sits on the content-safe line')
          .toBeGreaterThanOrEqual(hand.contentSafe - 1 - eps);
      }
      expect(Math.abs((hand?.left ?? 0) - ((g.resRail?.right ?? 0) + g.gapPx)),
        'the workspace keeps the same rail seam as the board').toBeLessThanOrEqual(1 + eps);
      fs.mkdirSync(path.join(OUT_ROOT, preset.id), {recursive: true});
      await page.screenshot({path: path.join(OUT_ROOT, preset.id, 'hand-workspace.png')});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);

      // ── 10 · ADAPTIVE SURFACES: the freed area becomes CONTENT, never
      // background. ──
      // The right STRATEGY RAIL: the top competition zone names itself
      // («ДОСТИЖЕНИЯ» — the actions wheel never returns to this rail), and
      // the medal is a first-class carrier sized for the widened member.
      const strat = await page.evaluate(() => {
        const title = document.querySelector('.con-strat__zone--milestones .con-strat__title');
        const medal = document.querySelector('.con-strat__zone--milestones .con-strat__medal');
        return {
          title: title?.textContent?.trim() ?? '',
          medalH: medal === null ? 0 : medal.getBoundingClientRect().height,
        };
      });
      expect(strat.title, 'the top zone is the MILESTONES competition, never actions')
        .toMatch(/^(ДОСТИЖЕНИЯ|MILESTONES)$/i);
      // The couch floor sits just under the profile token (tv 4.15rem /
      // base 3.9 — the polish pass folded the system line into the head
      // and gave its height to the medals).
      expect(strat.medalH, `the milestone medal is couch-first — ${strat.medalH}px`)
        .toBeGreaterThanOrEqual((preset.id === 'tv-4k' ? 4.0 : 3.8) * g.remPx);

      // The LEFT RAIL: the instrument plates own the hull zone the welded
      // chassis gained, while the icons stay on the safe content line.
      const rail = await page.evaluate(() => {
        const row = document.querySelector('.con-res__row');
        const icon = document.querySelector('.con-res__row .con-res__icon');
        if (row === null || icon === null) {
          return undefined;
        }
        return {rowLeft: row.getBoundingClientRect().left, iconLeft: icon.getBoundingClientRect().left};
      });
      expect(rail, 'the resource rows are mounted').not.toBe(undefined);
      // The bleed grammar, token-derived: the plate extends toward the
      // physical edge by exactly the edge pad the row compensates for
      // (margin −pad-x + padding +pad-x), so the icon line sits at least
      // --con-pad-x right of the plate's own left edge.
      expect((rail?.iconLeft ?? 0) - (rail?.rowLeft ?? 99), 'the instrument plate bleeds past the icon line by the edge pad')
        .toBeGreaterThanOrEqual(g.padXPx - eps);
      expect(rail?.iconLeft ?? 0, 'the resource icon stays on the safe content line')
        .toBeGreaterThanOrEqual(g.padXPx - eps);

      // STANDARD PROJECTS (LT wheel → БАЗОВЫЕ): the tile grid fills the
      // whole body and the art stage grows with its adaptive row.
      await page.keyboard.press('Comma');
      await page.waitForTimeout(900);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1600);
      await expect(page.locator('.con-stdp')).toHaveCount(1, {timeout: 12_000});
      const stdp = await page.evaluate(() => {
        const host = document.querySelector('.con-stdp__scroll-host');
        const grid = document.querySelector('.con-stdp__grid');
        const stage = document.querySelector('.con-stdp__stage');
        if (host === null || grid === null || stage === null) {
          return undefined;
        }
        const s = stage.getBoundingClientRect();
        return {
          hostH: host.getBoundingClientRect().height,
          gridH: grid.getBoundingClientRect().height,
          stageH: s.height,
          stageW: s.width,
        };
      });
      expect(stdp, 'the standard-projects grid is mounted').not.toBe(undefined);
      expect(stdp?.gridH ?? 0, 'the tile grid fills the body it was given')
        .toBeGreaterThanOrEqual((stdp?.hostH ?? 9999) - 3);
      expect(Math.abs((stdp?.stageW ?? 0) - (stdp?.stageH ?? 9)), 'the art stage keeps its square')
        .toBeLessThanOrEqual(2);
      expect(stdp?.stageH ?? 0, 'the artwork grew with the adaptive row')
        .toBeGreaterThanOrEqual((preset.id === 'tv-4k' ? 4.8 : 3.7) * g.remPx);
      await page.screenshot({path: path.join(OUT_ROOT, preset.id, 'stdp-adaptive.png')});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      // MILESTONES workspace (LB): the competition grid fills the body and
      // the artefact stage takes the height the filled rows hand out.
      await page.keyboard.press('KeyQ');
      await page.waitForTimeout(1800);
      await expect(page.locator('.con-ma')).toHaveCount(1, {timeout: 12_000});
      const ma = await page.evaluate(() => {
        const host = document.querySelector('.con-ma__scroll-host');
        const grid = document.querySelector('.con-ma__grid');
        const stage = document.querySelector('.con-ma__stage');
        if (host === null || grid === null || stage === null) {
          return undefined;
        }
        return {
          hostH: host.getBoundingClientRect().height,
          gridH: grid.getBoundingClientRect().height,
          stageH: stage.getBoundingClientRect().height,
        };
      });
      expect(ma, 'the milestones grid is mounted').not.toBe(undefined);
      expect(ma?.gridH ?? 0, 'the competition grid fills the body it was given')
        .toBeGreaterThanOrEqual((ma?.hostH ?? 9999) - 3);
      expect(ma?.stageH ?? 0, 'the artefact stage grew with the filled rows')
        .toBeGreaterThanOrEqual((preset.id === 'tv-4k' ? 6 : 4.8) * g.remPx);
      await page.screenshot({path: path.join(OUT_ROOT, preset.id, 'ma-adaptive.png')});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);

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
