import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, focusCard, openActionFocus, openCardActions, press, settle} from './consoleStart';

/**
 * CHOOSING A VARIANT MOVES NOTHING THE PLAYER IS LOOKING AT (the owner's 4K report of 2026-10-14: «after choosing an
 * option the workspace jumps — the components twitch; the ✓ can be half hidden»).
 *
 * Measured before the fix: the action composer's formula grew its «Вы получите» side and the «◈ Выберите вариант» line
 * left, the centred column re-centred — the tiles slid 126 px down under the cursor that had just pressed them; the
 * play composer gained its «Выбор перед розыгрышем» section and everything above it slid 122 px up while the commit
 * rail slid down 121; the seal rode the tile's edge and the scroller cut it (24 px at 4K).
 *
 * Against a real server, on both profiles:
 *  A. the ACTION composer (Atmo Collectors): A on a tile — the formula's «Вы получите» slot stands from the first frame
 *     and is filled in place, the hint leaves its own lane: the plate, the formula, the tiles and the commit rail do not
 *     move (layout ≤ 2 px); the seal stands wholly inside the scroller.
 *  B. the PLAY composer (Influential Discovery): A on a tile — the column's top stays (the work scroll does not move),
 *     the new section grows DOWNWARD and the commit rail SLIDES to its new place (several positions sampled — never one
 *     cut); the seal stands wholly inside the scroller.
 */
const OUT = path.resolve('screenshots', 'variant-settle');
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

type Probe = {frames: Array<Record<string, number | null>>, stop: boolean};

/** Arm a sampler over named blocks — the FIRST sample is synchronous (the press patches before the next tick). */
async function arm(page: Page, named: Record<string, string>): Promise<void> {
  await page.evaluate((sel) => {
    const probe: Probe = {frames: [], stop: false};
    (window as unknown as {__variantSettle: Probe}).__variantSettle = probe;
    const sample = () => {
      const f: Record<string, number | null> = {};
      for (const [k, s] of Object.entries(sel)) {
        const el = document.querySelector(s);
        f[k] = el === null ? null : Math.round(el.getBoundingClientRect().top);
      }
      probe.frames.push(f);
    };
    sample();
    // An interval, never rAF: a measurement probe may not depend on the frame loop for its liveness (rule § A MEASUREMENT
    // PROBE MAY NOT DEPEND ON rAF) — 16 ms still reads every step of a 240 ms slide.
    const iv = window.setInterval(() => {
      if (probe.stop) {
        window.clearInterval(iv);
        return;
      }
      sample();
    }, 16);
  }, named);
}

/**
 * Wait until the press's consequences have SETTLED — a state, never a duration: the probe's last 12 samples (≈ 200 ms at
 * the 16 ms interval) are identical in every block, after at least 20 samples were taken.
 */
async function settled(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const frames = (window as unknown as {__variantSettle: Probe}).__variantSettle.frames;
    if (frames.length < 20) {
      return false;
    }
    const tail = frames.slice(-12).map((f) => JSON.stringify(f));
    return tail.every((f) => f === tail[0]);
  }), {timeout: 15_000, intervals: [120], message: 'the layout settles after the press'}).toBe(true);
}

async function read(page: Page): Promise<Array<Record<string, number | null>>> {
  return await page.evaluate(() => {
    const p = (window as unknown as {__variantSettle: Probe}).__variantSettle;
    p.stop = true;
    return p.frames;
  });
}

/** The seal's visible share inside the nearest scroller (100 = whole). */
async function sealVisible(page: Page, root: string): Promise<number> {
  return await page.evaluate((r) => {
    const seal = document.querySelector<HTMLElement>(`${r} .con-vchoice__seal--on`);
    const vp = seal?.closest('.con-scroll-area__viewport');
    if (seal === null || seal === undefined || vp === null || vp === undefined) {
      return -1;
    }
    const s = seal.getBoundingClientRect();
    const c = vp.getBoundingClientRect();
    const w = Math.max(0, Math.min(s.right, c.right) - Math.max(s.left, c.left));
    const h = Math.max(0, Math.min(s.bottom, c.bottom) - Math.max(s.top, c.top));
    return Math.round(100 * w * h / Math.max(1, s.width * s.height));
  }, root);
}

const focusedTile = (page: Page, root: string) => page.evaluate((r) => Number(document.querySelector(`${r} .con-vchoice__opt--focused`)?.getAttribute('data-vchoice-index') ?? -1), root);
const distinct = (frames: Array<Record<string, number | null>>, k: string) => new Set(frames.map((f) => f[k]).filter((v) => v !== null)).size;

for (const preset of PRESETS) {
  test.describe(`variant settle · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the action composer: A on a tile moves nothing — the formula's slot is filled in place (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const ROOT = '.con-cardactions__stagewrap .con-composer--stage';
      await bootFixtureSeats(page, request, 'variant-tiles', {query: preset.query});
      await settle(page);
      await openCardActions(page);
      const onAtmoSpend = () => page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('[data-action-card]'));
        const at = tiles.findIndex((e) => e.classList.contains('con-cardactions__tile--focused'));
        if (at < 0) {
          return false;
        }
        const name = tiles[at].getAttribute('data-action-card');
        return name === 'Atmo Collectors' && tiles.slice(0, at).filter((e) => e.getAttribute('data-action-card') === name).length === 1;
      });
      const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
      for (let i = 0; i < 24 && !(await onAtmoSpend()); i++) {
        await press(page, moves[i % moves.length], 260);
      }
      expect(await onAtmoSpend(), 'the cursor reaches Atmo Collectors\' spend row').toBe(true);
      await openActionFocus(page);
      await settle(page);
      // The formula's «Вы получите» side stands BEFORE the choice — a reserved slot, no number in it.
      await expect(page.locator(`${ROOT} [data-hero-pending] .con-composer__hero-slot`), 'the reserved slot').toHaveCount(1);
      await expect(page.locator(`${ROOT} .con-composer__cta-hint`), 'the hint names the missing choice').toBeVisible();
      for (let i = 0; i < 4 && (await focusedTile(page, ROOT)) !== 2; i++) {
        await press(page, 'ArrowRight', 300);
      }
      expect(await focusedTile(page, ROOT)).toBe(2);
      await shoot(page, preset.id, 'a-01-before');
      await arm(page, {
        plate: `${ROOT} .con-composer__surface`,
        hero: `${ROOT} .con-composer__hero`,
        group: `${ROOT} .con-vchoice`,
        cta: `${ROOT} .con-composer__cta`,
      });
      await page.keyboard.press('Enter');
      await settled(page);
      const frames = await read(page);
      const first = frames[0];
      const last = frames[frames.length - 1];
      for (const k of ['plate', 'hero', 'group', 'cta']) {
        expect(Math.abs((last[k] ?? 0) - (first[k] ?? 0)), `${k} stands still (${first[k]} → ${last[k]})`).toBeLessThanOrEqual(2);
      }
      await expect(page.locator(`${ROOT} [data-hero-pending]`), 'the slot is filled').toHaveCount(0);
      await expect(page.locator(`${ROOT} .con-composer__hero`), 'by the chosen outcome').toContainText(/6\s*→\s*10/);
      await expect(page.locator(`${ROOT} .con-composer__cta-hint`), 'the hint left its lane').toHaveCount(0);
      expect(await sealVisible(page, ROOT), 'the seal stands wholly inside the scroller').toBe(100);
      await shoot(page, preset.id, 'a-02-after');
    });

    test(`B · the play composer: the column's top stays, the new section grows down, the rail SLIDES (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const ROOT = '.con-composer--play';
      await bootFixtureSeats(page, request, 'influential-discovery', {query: preset.query});
      await settle(page);
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
      await page.locator('.con-hand [data-zoom-slot="Influential Discovery"]').waitFor({timeout: 12_000});
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await settle(page);
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, 'Influential Discovery', slots * 2 + 6)).toBe(true);
      for (let i = 0; i < 3 && await page.locator(ROOT).count() === 0; i++) {
        await press(page, 'Enter', 900);
      }
      await expect(page.locator(ROOT)).toHaveCount(1);
      await settle(page);
      for (let i = 0; i < 6 && (await focusedTile(page, ROOT)) < 0; i++) {
        await press(page, 'ArrowUp', 300);
      }
      expect(await focusedTile(page, ROOT), 'the cursor stands on a tile').toBeGreaterThanOrEqual(0);
      await shoot(page, preset.id, 'b-01-before');
      await arm(page, {
        scroll: `${ROOT} .con-composer__playright > .con-composer__scroll`,
        group: `${ROOT} .con-vchoice`,
        cta: `${ROOT} .con-composer__cta`,
      });
      await page.keyboard.press('Enter');
      await settled(page);
      const frames = await read(page);
      const first = frames[0];
      const last = frames[frames.length - 1];
      expect(Math.abs((last.scroll ?? 0) - (first.scroll ?? 0)), `the work column's top stays (${first.scroll} → ${last.scroll})`).toBeLessThanOrEqual(2);
      expect(Math.abs((last.group ?? 0) - (first.group ?? 0)), `the tiles stay (${first.group} → ${last.group})`).toBeLessThanOrEqual(2);
      const ctaMoved = Math.abs((last.cta ?? 0) - (first.cta ?? 0));
      if (ctaMoved > 2) {
        // A CUT is two positions, before and after; a slide passes through at least one in between. The floor is set where
        // only a cut fails — a loaded 4K runner starves the frame loop, so the count of intermediate samples is the
        // machine's, not the product's (measured 1–5).
        const lo = Math.min(first.cta ?? 0, last.cta ?? 0);
        const hi = Math.max(first.cta ?? 0, last.cta ?? 0);
        const between = frames.filter((f) => f.cta !== null && (f.cta as number) > lo + 1 && (f.cta as number) < hi - 1).length;
        expect(between, `the commit rail SLIDES its ${ctaMoved} px (positions ${distinct(frames, 'cta')}) — never one cut`).toBeGreaterThanOrEqual(1);
      }
      expect(await sealVisible(page, ROOT), 'the seal stands wholly inside the scroller').toBe(100);
      await shoot(page, preset.id, 'b-02-after');
    });
  });
}
