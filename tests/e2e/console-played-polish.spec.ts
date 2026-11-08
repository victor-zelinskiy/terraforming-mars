import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, press, settle} from './consoleStart';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * «РАЗЫГРАНО» POLISH (P88's second half, the owner's frames of 2026-11-01 — docs/claude/prompts/
 * prelude2-p88-venus-orbital-survey.md, decisions 7–9):
 *
 *   (H) ◀ / ▶ walk the table's stacks IN ORDER — the tall «ПРОЛОГИ» (two preludes, spread) is never skipped; ▲ / ▼ do
 *       nothing on one row; an edge stays.
 *   (I) the lone EVENT opens the category scene — ONE proxy lifts off the pile and turns over (rotationY from ~180 to
 *       0), the pile wears its «out» ghost while the card is away; X → the viewer out of the scene's slot; B returns.
 *   (J) the category stands on the table's own material — square, no ring, no drop shadow, the table's ground (the
 *       Information workspace's embedded host is read by `console-info-workspace` § 7).
 *   (K) the floor UNFOLDS with the lift — visible before the first proxy touches down, never popped in after it.
 *   (L) no caption is cut in the middle of a word (scrollWidth ≤ clientWidth on every label).
 *   (M) a collapsed DRAFT never takes A while the table is open: A on «ПРОЛОГИ» opens the category; back on the board
 *       the plate returns and A restores the draft.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § «РАЗЫГРАНО» polish. Frames: `screenshots/played-polish/`.
 */

const TABLE = '.con-played:not(.con-played--embedded)';
const OUT = path.resolve('screenshots', 'played-polish');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const focusedZone = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.con-played__family--focused')?.dataset.playedCat ?? '');

async function openTable(page: Page): Promise<void> {
  for (let i = 0; i < 3 && await page.locator(TABLE).count() === 0; i++) {
    await press(page, 'KeyX', 1200);
  }
  await expect(page.locator(TABLE), 'the table stands').toHaveCount(1);
  await settle(page).catch(() => undefined);
}

/** Walk ◀ to the table's first stack (the left edge stays). */
async function toFirstStack(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const before = await focusedZone(page);
    await press(page, 'ArrowLeft', 300);
    if (await focusedZone(page) === before) {
      return;
    }
  }
}

async function focusStack(page: Page, stack: string): Promise<void> {
  await toFirstStack(page);
  for (let i = 0; i < 8 && await focusedZone(page) !== stack; i++) {
    await press(page, 'ArrowRight', 300);
  }
  expect(await focusedZone(page), `the cursor on the ${stack} stack`).toBe(stack);
}

/** The category floor's material, read off the computed style — and the table's ground beside it. */
const floorMaterial = (page: Page) => page.evaluate(() => {
  const panel = document.querySelector<HTMLElement>('.con-played-cat__panel');
  const table = document.querySelector<HTMLElement>('.con-played__panel');
  if (panel === null) {
    return undefined;
  }
  const cs = getComputedStyle(panel);
  const blurs = (cs.boxShadow.match(/\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g) ?? [])
    .map((m) => Number(m.trim().split(/\s+/)[3]?.replace('px', '') ?? 0));
  const outer = cs.boxShadow.split(/,(?![^(]*\))/).filter((s) => !s.includes('inset') && s.trim() !== 'none');
  return {
    radius: cs.borderTopLeftRadius,
    outerShadows: outer.length,
    maxBlur: Math.max(0, ...blurs),
    image: cs.backgroundImage,
    tableImage: table === null ? '' : getComputedStyle(table).backgroundImage,
  };
});

test.describe(`«РАЗЫГРАНО» polish · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('(H) ◀/▶ walk the stacks in order — «ПРОЛОГИ» is never skipped; ▲/▼ stay; (L) no caption cut mid-word', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'played-table-polish', {query: PRESET.query});
    await settle(page);
    await openTable(page);
    await toFirstStack(page);
    const walk = [await focusedZone(page)];
    for (let i = 0; i < 6; i++) {
      await press(page, 'ArrowRight', 300);
      const z = await focusedZone(page);
      if (z === walk[walk.length - 1]) {
        break;
      }
      walk.push(z);
    }
    expect(walk, 'every stack in layout order').toEqual(['corporation', 'prelude', 'active', 'automated', 'events']);
    await press(page, 'ArrowUp', 300);
    await press(page, 'ArrowDown', 300);
    expect(await focusedZone(page), '▲/▼ do nothing on one row').toBe('events');
    await shoot(page, 'h-walk-end');
    const cut = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.con-played__caption-label')]
      .filter((el) => el.scrollWidth > el.clientWidth + 0.5).map((el) => el.textContent ?? ''));
    expect(cut, 'no caption is cut by an ellipsis').toEqual([]);
  });

  test('(I) the lone event lifts off its pile and turns over; X opens the viewer from the scene; (J)(K) the floor', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'played-table-polish', {query: PRESET.query});
    await settle(page);
    await openTable(page);
    await focusStack(page, 'events');
    // Recorded BEFORE the press, off the product's own writes (tests.md ② — a 16 ms `setInterval` sampler armed for a
    // fixed 4 s slept through the floor's rise on a starved 4K software frame: 3 / 8 red at CPU ×4 with the product
    // right): the proxy's flip angle and the floor's opacity beside «has the card landed».
    await recordTransient(page, 'p88-flip', () => {
      const flip = document.querySelector<HTMLElement>('.con-played-cat__fly .con-deal-proxy__flip');
      if (flip === null) {
        return null;
      }
      const m = new DOMMatrixReadOnly(getComputedStyle(flip).transform === 'none' ? undefined : getComputedStyle(flip).transform);
      return Math.round(Math.acos(Math.max(-1, Math.min(1, m.m11))) * 180 / Math.PI);
    });
    await recordTransient(page, 'p88-floor', () => {
      const panel = document.querySelector<HTMLElement>('.con-played-cat__panel');
      return panel === null ? null :
        {opacity: Math.round(Number(getComputedStyle(panel).opacity) * 100) / 100, proxyLanded: document.querySelector('.con-played-cat--framed') !== null};
    });
    await press(page, 'Enter', 200);
    await expect(page.locator('.con-played-cat'), 'the category scene mounts — never a shortcut to the viewer').toHaveCount(1, {timeout: 8_000});
    expect(await page.locator('dialog.con-zoom[open]').count(), 'no fullscreen before the scene').toBe(0);
    await expect(page.locator('.con-played-cat--framed'), 'the card landed').toHaveCount(1, {timeout: 15_000});
    await settle(page).catch(() => undefined);
    const flips = (await readTransient<number | null>(page, 'p88-flip')).map((x) => x.v).filter((v): v is number => v !== null);
    expect(Math.max(0, ...flips), `the event starts face down (angles ${flips.join(',')})`).toBeGreaterThan(120);
    expect(flips[flips.length - 1] ?? 0, 'and lands face up').toBeLessThan(20);
    const floor = (await readTransient<{opacity: number, proxyLanded: boolean} | null>(page, 'p88-floor')).map((x) => x.v)
      .filter((v): v is {opacity: number, proxyLanded: boolean} => v !== null);
    expect(floor.some((f) => f.opacity > 0.05 && !f.proxyLanded),
      `the floor is up BEFORE the landing (a phrase, not a pop-in) — ${floor.map((f) => `${f.opacity}${f.proxyLanded ? 'L' : ''}`).join(' ')}`).toBe(true);
    await expect(page.locator('.con-played-cat__slot--single'), 'the single stage').toHaveCount(1);
    await expect(page.locator('.con-played__slot--events-out'), 'the pile wears its «out» ghost while the card is away').toHaveCount(1);
    const m = await floorMaterial(page);
    expect(m, 'the floor exists').toBeDefined();
    expect(m!.radius, 'square — the stage surface, never a rounded plate').toBe('0px');
    expect(m!.outerShadows, 'no drop shadow of its own').toBe(0);
    expect(m!.image, 'the table\'s own ground').toBe(m!.tableImage);
    await shoot(page, 'i-event-open');
    await press(page, 'KeyX', 1800);
    await expect(page.locator('dialog.con-zoom[open]'), 'X — the viewer out of the scene\'s slot').toHaveCount(1, {timeout: 10_000});
    await press(page, 'Escape', 1600);
    await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(0, {timeout: 10_000});
    // B right behind the viewer's close: the viewer's flight swallows the pad on purpose, and it must hand the pad
    // back the moment the card is home — CI 42223555435 lost this B in the gap before the dialog's queued `close`.
    // A red names what took the press (the echo's outcome and gate) and what still stood.
    const padState = () => page.evaluate(() => {
      const w = window as unknown as {__conInputEcho?: () => {lastPress?: unknown}, __conReady?: () => {absorbers?: unknown, holds?: unknown}};
      const ready = w.__conReady?.();
      return JSON.stringify({lastPress: w.__conInputEcho?.().lastPress, absorbers: ready?.absorbers, holds: ready?.holds,
        cat: document.querySelector('.con-played-cat')?.className, zoom: document.querySelector('.con-zoom')?.className});
    });
    await press(page, 'Escape', 1600);
    const afterB = await padState();
    try {
      await expect(page.locator('.con-played-cat'), 'B — back to the table').toHaveCount(0, {timeout: 15_000});
    } catch (e) {
      throw new Error(`B — back to the table: the category still stands (right after B: ${afterB} · now: ${await padState()})\n${String(e)}`);
    }
  });

  test('(I2) a B pressed in the very task the viewer lets go reaches the category beneath — the viewer\'s swallow ends with its flight', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'played-table-polish', {query: PRESET.query});
    await settle(page);
    await openTable(page);
    await focusStack(page, 'events');
    await press(page, 'Enter', 200);
    await expect(page.locator('.con-played-cat--framed'), 'the card landed').toHaveCount(1, {timeout: 15_000});
    await settle(page).catch(() => undefined);
    await press(page, 'KeyX', 1800);
    await expect(page.locator('dialog.con-zoom[open]'), 'X — the viewer').toHaveCount(1, {timeout: 10_000});
    // The worst moment for a second B, made DETERMINISTIC: in the very task the dialog lets go (its `open` falls), a B
    // goes to the console — the frame a player's quick double B lands in on a slow machine. The viewer's close used to
    // unwind only on the dialog's QUEUED `close` event, so that B died in the viewer as «consumed» (CI 42223555435).
    await page.evaluate(() => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog.con-zoom[open]');
      if (dialog === null) {
        return;
      }
      const observer = new MutationObserver(() => {
        if (!dialog.open) {
          observer.disconnect();
          window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape', key: 'Escape', bubbles: true}));
          window.dispatchEvent(new KeyboardEvent('keyup', {code: 'Escape', key: 'Escape', bubbles: true}));
          (window as unknown as {__p88SecondB?: number}).__p88SecondB = Date.now();
        }
      });
      observer.observe(dialog, {attributes: true, attributeFilter: ['open']});
    });
    await press(page, 'Escape', 1600);
    await expect.poll(() => page.evaluate(() => (window as unknown as {__p88SecondB?: number}).__p88SecondB !== undefined),
      {message: 'the second B went in as the dialog let go', timeout: 10_000}).toBe(true);
    await expect(page.locator('.con-played-cat'), 'that B took the category back to the table').toHaveCount(0, {timeout: 15_000});
  });

  test('(M) a collapsed draft never takes A while the table is open; the board gives it back', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'played-table-draft', {query: PRESET.query, landing: 'prompt'});
    await settle(page);
    // Collapse the draft (B) — the plate stands on the board.
    for (let i = 0; i < 3 && await page.locator('.con-mandatory').count() === 0; i++) {
      await press(page, 'Escape', 1200);
    }
    await expect(page.locator('.con-mandatory'), 'the collapsed draft\'s plate on the board').toHaveCount(1, {timeout: 15_000});
    await openTable(page);
    await expect(page.locator('.con-mandatory'), 'the plate belongs to the board — not over the table').toHaveCount(0);
    await focusStack(page, 'prelude');
    await press(page, 'Enter', 1500);
    await expect(page.locator('.con-played-cat'), 'A opened the CATEGORY').toHaveCount(1, {timeout: 10_000});
    expect(await page.locator('.con-draftws').count(), 'the draft did NOT come back').toBe(0);
    await shoot(page, 'm-category-over-collapsed-draft');
    await press(page, 'Escape', 1600);
    await expect(page.locator('.con-played-cat')).toHaveCount(0, {timeout: 15_000});
    await press(page, 'Escape', 1600);
    await expect(page.locator(TABLE)).toHaveCount(0, {timeout: 15_000});
    await expect(page.locator('.con-mandatory'), 'back on the board, the plate returns').toHaveCount(1, {timeout: 15_000});
    await press(page, 'Enter', 1500);
    await expect(page.locator('.con-draftws'), 'A on the board restores the draft').toHaveCount(1, {timeout: 15_000});
  });
});
