import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, soloGameConfig, press} from './consoleStart';

/**
 * STANDARD PROJECTS · the STABLE-GEOMETRY contract (the anti-jumping-grid
 * regression guard).
 *
 * The workspace foot (`.con-stdp__foot`) is a FIXED-height instrument
 * (`--con-ws-foot-h`): focus navigation changes what the status line SAYS —
 * name, `current → resulting` chips, «› ДАЛЕЕ: …», a blocker — never the box.
 * Before the contract the foot carried `min-height` and grew with the focused
 * row's chips; the scroll host above re-shared its `1fr` rows and the WHOLE
 * grid visibly jumped on every cursor step (worst between «Продажа патентов»
 * — no chips — and any project with a projection row).
 *
 * The guard walks the cursor across every row (down the columns and back up)
 * and asserts, at every step, against the FIRST observation:
 *  - the workspace body rect (`.con-stdp__stagewrap`) does not move;
 *  - every project card rect is byte-stable (allowing 1px rounding);
 *  - every art-stage (icon plate) rect is byte-stable;
 *  - the foot's own rect (y + height) is byte-stable.
 *
 * Geometry claims are per-resolution claims (console-ui rule): the walk runs
 * at FHD and at the forced-TV 4K profile.
 */

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

type Box = {x: number, y: number, w: number, h: number};
type StdpGeometry = {
  body: Box,
  foot: Box,
  gridRight: number,
  cards: ReadonlyArray<Box>,
  stages: ReadonlyArray<Box>,
  /**
   * The SETTLE probe: the same positions UNROUNDED. A layout that has stopped
   * moving reproduces its floats exactly; an ease still running practically
   * never does. Comparing the rounded boxes (what the walk asserts) is too weak
   * for the baseline — the entry's tail eases sub-pixel-per-frame near the end,
   * so two reads 250ms apart can round equal while the grid is still travelling
   * several px, and the baseline is then captured mid-ease.
   */
  raw: ReadonlyArray<number>,
};

/** One evaluate → one geometry object (never N boundingBox round-trips). */
async function readGeometry(page: Page): Promise<StdpGeometry> {
  return await page.evaluate(() => {
    const r = (el: Element): {x: number, y: number, w: number, h: number} => {
      const b = el.getBoundingClientRect();
      return {x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height)};
    };
    const body = document.querySelector('.con-stdp__stagewrap');
    const foot = document.querySelector('.con-stdp__foot');
    const grid = document.querySelector('.con-stdp__grid');
    if (body === null || foot === null || grid === null) {
      throw new Error('stdp chrome not mounted');
    }
    const cards = [...document.querySelectorAll('.con-stdp__card')];
    return {
      body: r(body),
      foot: r(foot),
      gridRight: r(grid).x + r(grid).w,
      cards: cards.map(r),
      stages: [...document.querySelectorAll('.con-stdp__stage')].map(r),
      raw: [
        body.getBoundingClientRect().top,
        ...cards.flatMap((c) => {
          const b = c.getBoundingClientRect();
          return [b.top, b.left];
        }),
      ],
    };
  });
}

const EPS = 1; // sub-pixel rounding only

/**
 * Headless Chromium drives rAF off the COMPOSITOR, so an idle page does not
 * FINISH the entrance tween — it FREEZES it mid-flight, which is
 * indistinguishable from «settled» to any sampler. The first keypress is a
 * BeginFrame, the tween then lands its remaining px, and the focus walk gets
 * indicted for the entrance's last frames (measured: 4px on the first step at
 * 4K, 0px on every step after it). A tiny screenshot IS a BeginFrame — pumping
 * them is what actually ends the entrance.
 */
async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

function expectStable(now: StdpGeometry, base: StdpGeometry, step: string): void {
  const boxEq = (a: Box, b: Box, what: string) => {
    expect(Math.abs(a.x - b.x), `${what} x @ ${step}`).toBeLessThanOrEqual(EPS);
    expect(Math.abs(a.y - b.y), `${what} y @ ${step}`).toBeLessThanOrEqual(EPS);
    expect(Math.abs(a.w - b.w), `${what} w @ ${step}`).toBeLessThanOrEqual(EPS);
    expect(Math.abs(a.h - b.h), `${what} h @ ${step}`).toBeLessThanOrEqual(EPS);
  };
  boxEq(now.body, base.body, 'workspace body');
  boxEq(now.foot, base.foot, 'status rail');
  expect(now.cards.length, `card count @ ${step}`).toBe(base.cards.length);
  now.cards.forEach((c, i) => boxEq(c, base.cards[i], `card[${i}]`));
  now.stages.forEach((s, i) => boxEq(s, base.stages[i], `art stage[${i}]`));
}

for (const profile of PROFILES) {
  test.describe(`stdp stable geometry · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('focus walk moves nothing but the highlight', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootIntoGame(page, request, {
        config: soloGameConfig({expansions: {colonies: true}}),
        query: profile.query,
      });
      if (profile.tag === 'tv4k') {
        await expect(page.locator('html')).toHaveClass(/con-profile-tv/);
      }

      // LT wheel → centre = Standard projects.
      await press(page, 'Comma', 1100);
      await press(page, 'Enter', 1500);
      await page.waitForSelector('.con-stdp', {timeout: 8_000});
      // The entry motion's TAIL can outlive any fixed pause on a loaded 4K
      // run (measured: the grid still eases ~3px between 2.1s and 2.4s after
      // the open — with old and new edge tokens alike), and a baseline
      // captured mid-ease indicts the focus walk for the entry's last easing
      // frame. So the baseline waits for the SUB-PIXEL positions to repeat
      // TWICE — and the wait then asserts its own success, because a settle
      // probe that gave up looks exactly like one that succeeded.
      await page.waitForTimeout(600);
      await forceFrame(page);
      let base = await readGeometry(page);
      let agreed = 0;
      for (let i = 0; i < 24 && agreed < 2; i++) {
        await page.waitForTimeout(120);
        await forceFrame(page);
        await page.waitForTimeout(120);
        const now = await readGeometry(page);
        const same = now.raw.length === base.raw.length &&
          now.raw.every((v, j) => v === base.raw[j]);
        agreed = same ? agreed + 1 : 0;
        base = now;
      }
      expect(agreed, 'the entry motion never settled — the baseline would be mid-ease')
        .toBeGreaterThanOrEqual(2);
      expect(base.cards.length, 'the whole family renders').toBeGreaterThanOrEqual(6);
      // The stable-foot token in action: the rail is a fixed-height box.
      expect(base.foot.h).toBeGreaterThan(0);

      // Walk DOWN the grid (covers «Продажа патентов» → projects with chip
      // rows → back): every step re-reads the full geometry.
      const step = async (code: string, label: string): Promise<void> => {
        await press(page, code, 250);
        await forceFrame(page);
        await page.waitForTimeout(150);
        expectStable(await readGeometry(page), base, label);
      };
      const steps = base.cards.length + 2;
      for (let i = 0; i < steps; i++) {
        await step('ArrowDown', `down#${i + 1}`);
      }
      for (let i = 0; i < 3; i++) {
        await step('ArrowUp', `up#${i + 1}`);
      }
      await step('ArrowRight', 'right');
      await step('ArrowLeft', 'left');

      // TWO-LEVEL SAFE AREA: the grid (visual matter) reaches past the old
      // content-safe line — its right edge must clear viewport − content
      // inset (i.e. the gallery is NOT limited by the text inset any more),
      // while the foot text stays inside the content-safe line.
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
      const vw = profile.width;
      // Grid right edge sits on the stage line (± the grid's own tiny pad),
      // strictly PAST the content-safe line the old geometry stopped at.
      expect(base.gridRight).toBeGreaterThan(vw - insets.contentSafe - 1);
      expect(base.gridRight).toBeLessThanOrEqual(vw - insets.stage + 2);

      await press(page, 'Escape', 800);
    });
  });
}
