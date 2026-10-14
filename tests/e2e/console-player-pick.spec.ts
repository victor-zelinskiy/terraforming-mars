import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, focusCard, press, settle} from './consoleStart';

/**
 * A PLAYER target pick of a play — Asteroid Mining Consortium («decrease ANY titanium production 1 step») on a
 * three-seat table: the composer's target row opens the LIST of players. The owner's TV photo of 2026-10-14: three
 * empty slabs (480 px tall at 4K, a third of the column wide) with a name and a «3 → 2» in the corner — the couch
 * profile's tile measure (`flex-basis: 12rem`, `max-width: 28rem`) had leaked into the stacked list, where a basis is a
 * HEIGHT. The list row is ONE reading line: the owner dot and the name on the left, the server's «before → after»
 * right-aligned, the seal at the end; every row spans the column and stands no taller than a line of its own.
 */
const CARD = 'Asteroid Mining Consortium';
const PLAY = '.con-composer--play';
const LIST = `${PLAY} .con-composer__sublist`;
const ROWS = `${LIST} .con-vchoice__opt`;
const OUT = path.resolve('screenshots', 'player-pick');
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto', rem: 20},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', rem: 40},
] as const;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

async function openPlayComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `the cursor reaches «${CARD}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY)).toHaveCount(1);
  await settle(page);
}

type Row = {top: number, height: number, width: number, focused: boolean, selected: boolean, name: string, chips: number, reading: string, headTop: number, bodyTop: number, bodyRight: number, right: number};

async function rows(page: Page): Promise<Array<Row>> {
  return await page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).map((o) => {
    const r = o.getBoundingClientRect();
    const head = o.querySelector('.con-vchoice__head')?.getBoundingClientRect();
    const body = o.querySelector('.con-vchoice__body')?.getBoundingClientRect();
    return {
      top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width), right: Math.round(r.right),
      focused: o.classList.contains('con-vchoice__opt--focused'),
      selected: o.classList.contains('con-vchoice__opt--selected'),
      name: (o.querySelector('.con-vchoice__title')?.textContent ?? '').trim(),
      // The reading: the shared effect chip, or the composer's own «3 → 2» impact line (a player row's production).
      chips: o.querySelectorAll('.action-effect-chip, .con-composer__opt-impact').length,
      reading: (o.querySelector('.con-vchoice__body')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      headTop: Math.round(head?.top ?? -1), bodyTop: Math.round(body?.top ?? -1), bodyRight: Math.round(body?.right ?? -1),
    };
  }), ROWS);
}

for (const preset of PRESETS) {
  test.describe(`player pick · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the target list: one reading line per player, the column's width, the seal on the pick (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'player-pick', {query: preset.query});
      await settle(page);
      await openPlayComposer(page);
      const rowText = () => page.evaluate((play) => (document.querySelector(`${play} .con-composer__row--focused`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), PLAY);
      for (let i = 0; i < 8 && !/игрок/i.test(await rowText()); i++) {
        await press(page, 'ArrowDown', 300);
      }
      expect(await rowText(), 'the cursor stands on the player row').toMatch(/игрок/i);
      for (let i = 0; i < 3 && await page.locator(LIST).count() === 0; i++) {
        await press(page, 'Enter', 1000);
      }
      await expect(page.locator(LIST), 'the player list opens').toBeVisible({timeout: 10_000});
      await settle(page);
      await shoot(page, preset.id, 'a-01-list');

      const rs = await rows(page);
      expect(rs.map((r) => r.name).length, 'three seats').toBe(3);
      const column = await page.locator(`${PLAY} .con-composer__scroll-body`).boundingBox();
      for (const r of rs) {
        expect(r.chips, `«${r.name}» reads its before → after`).toBeGreaterThanOrEqual(1);
        expect(r.reading, `«${r.name}»: the reading is a before → after`).toMatch(/\d+\s*→\s*\d+/);
        expect(r.height, `«${r.name}» is one reading line, not a slab (${r.height} px)`).toBeLessThanOrEqual(5 * preset.rem);
        expect(r.width, `«${r.name}» spans the column (${r.width} of ${column?.width})`).toBeGreaterThanOrEqual((column?.width ?? 0) * 0.85);
        expect(Math.abs(r.headTop - r.bodyTop), `«${r.name}»: the name and the reading share one line`).toBeLessThanOrEqual(preset.rem);
        expect(r.right - r.bodyRight, `«${r.name}»: the reading is right-aligned (its seal slot aside)`).toBeLessThanOrEqual(4 * preset.rem);
      }
      expect(rs.filter((r) => r.focused).length, 'ONE cursor').toBe(1);
      expect(rs.filter((r) => r.selected).length, 'nothing picked yet').toBe(0);

      // The cursor walks the rows; A picks ONE — the seal, and the composer takes the answer back.
      await press(page, 'ArrowDown', 350);
      const after = await rows(page);
      expect(after.findIndex((r) => r.focused), '↓ moves the cursor to the second seat').toBe(1);
      await shoot(page, preset.id, 'a-02-cursor');
      await press(page, 'Enter', 700);
      await settle(page);
      await expect(page.locator(LIST), 'the answer closes the list').toHaveCount(0, {timeout: 8_000});
      // A on the pick advances the cursor to the play row; the answered row stands above it, naming its answer.
      await expect(page.locator(`${PLAY} .con-composer__row`, {hasText: /player2/}), 'the row names its answer').toHaveCount(1);
      await shoot(page, preset.id, 'a-03-answered');
    });
  });
}
