import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig, playCardFromHand, waitForBoardHome} from './consoleStart';

/**
 * THE RAIL PROTECTION MARKS in the real shell: play «Protected Habitats» and
 * the plants row must gain the printed shield — pinned to the icon's own
 * corner, clear of the MC coin, costing the row not one pixel.
 *
 * Asserted per profile (fhd / tv-4k / deck-handheld):
 *  - no shield exists before the card is played, one exists after;
 *  - it sits INSIDE its row, over the icon's upper-left corner, and never
 *    overlaps the value-coin's box (the two information layers share an icon);
 *  - the row heights and the icon column are pixel-identical before/after —
 *    the mark is an absolute pin, not a layout participant;
 *  - the mark carries a real accessible sentence, not just a glyph.
 */

const OUT = path.resolve('screenshots', 'rail-protection');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

type Box = {x: number, y: number, w: number, h: number, r: number, b: number};

type RailShot = {
  shields: number,
  rowHeights: ReadonlyArray<number>,
  iconXs: ReadonlyArray<number>,
  plants?: {
    kind: string,
    label: string,
    shield: Box,
    icon: Box,
    row: Box,
    coin?: Box,
  },
};

async function readRail(page: Page): Promise<RailShot> {
  return await page.evaluate(() => {
    const box = (el: Element): Box => {
      const b = el.getBoundingClientRect();
      return {x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom};
    };
    type Box = {x: number, y: number, w: number, h: number, r: number, b: number};
    const rows = [...document.querySelectorAll('.con-res__row')];
    const shot: {
      shields: number,
      rowHeights: Array<number>,
      iconXs: Array<number>,
      plants?: {kind: string, label: string, shield: Box, icon: Box, row: Box, coin?: Box},
    } = {
      shields: document.querySelectorAll('.con-shieldmark').length,
      rowHeights: rows.map((r) => r.getBoundingClientRect().height),
      iconXs: rows.map((r) => r.querySelector('.con-res__icon')?.getBoundingClientRect().left ?? -1),
    };
    const shield = document.querySelector('[data-protection="plants"]');
    const row = document.querySelector('.con-res__row--plants');
    const icon = row?.querySelector('.con-res__icon');
    if (shield !== null && row !== null && row !== undefined && icon !== null && icon !== undefined) {
      const coin = row.querySelector('[data-mc-badge]');
      shot.plants = {
        kind: shield.getAttribute('data-protection-kind') ?? '',
        label: shield.getAttribute('aria-label') ?? '',
        shield: box(shield),
        icon: box(icon),
        row: box(row),
        coin: coin === null ? undefined : box(coin),
      };
    }
    return shot;
  });
}

for (const profile of PROFILES) {
  test.describe(`rail protection · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('Protected Habitats pins a shield to the plants icon, at zero layout cost', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootIntoGame(page, request, {
        config: soloGameConfig(),
        cards: ['Protected Habitats'],
        query: profile.query,
      });
      await page.waitForSelector('.con-res__row--plants', {timeout: 15_000});
      await page.waitForTimeout(600);

      const before = await readRail(page);
      expect(before.shields, 'no shield before the card is played').toBe(0);

      const played = await playCardFromHand(page, 'Protected Habitats');
      expect(played, 'Protected Habitats must reach the tableau').toBe(true);
      await waitForBoardHome(page, 40);
      await page.waitForSelector('[data-protection="plants"]', {timeout: 20_000});
      await page.waitForTimeout(900); // the mark's own settle finishes
      await shoot(page, `${profile.tag}-protected`);

      const after = await readRail(page);
      const plants = after.plants;
      expect(plants, 'the plants row carries the mark').toBeDefined();
      if (plants === undefined) {
        return;
      }
      console.log(`[RAILPROT:${profile.tag}] kind=${plants.kind} ` +
        `shield=${plants.shield.w.toFixed(1)}×${plants.shield.h.toFixed(1)} ` +
        `rows=${after.rowHeights.map((h) => h.toFixed(1)).join(',')} label="${plants.label}"`);

      // ── The verdict and its sentence ──
      expect(plants.kind, 'a full protection').toBe('full');
      expect(plants.label.length, 'the mark states the rule, not just a glyph').toBeGreaterThan(10);

      // ── Pinned to the icon's upper-left corner, inside its own row ──
      expect(plants.shield.y, 'inside the row (top)').toBeGreaterThanOrEqual(plants.row.y - 1);
      expect(plants.shield.b, 'inside the row (bottom)').toBeLessThanOrEqual(plants.row.b + 1);
      const iconCx = plants.icon.x + plants.icon.w / 2;
      const iconCy = plants.icon.y + plants.icon.h / 2;
      expect(plants.shield.x, 'left of the icon centre').toBeLessThan(iconCx);
      expect(plants.shield.y, 'above the icon centre').toBeLessThan(iconCy);

      // ── The two information layers never collide ──
      if (plants.coin !== undefined) {
        const overlaps = plants.shield.r > plants.coin.x && plants.shield.b > plants.coin.y &&
          plants.coin.r > plants.shield.x && plants.coin.b > plants.shield.y;
        expect(overlaps, 'the shield and the MC coin occupy opposite corners').toBe(false);
      }

      // ── Zero layout cost: identical rows and icon column before/after ──
      expect(after.rowHeights.length).toBe(before.rowHeights.length);
      after.rowHeights.forEach((h, i) => {
        expect(Math.abs(h - before.rowHeights[i]), `row[${i}] height unchanged`).toBeLessThanOrEqual(1);
      });
      after.iconXs.forEach((x, i) => {
        expect(Math.abs(x - before.iconXs[i]), `icon[${i}] column unchanged`).toBeLessThanOrEqual(1);
      });
    });
  });
}

/**
 * THE THREE MATERIALS, side by side. `half` (Botanical Experience) and
 * `partial` (a chip aggregating a shielded and an unshielded holder) cannot
 * both be reached in one dealt solo game, and their whole point is that they
 * must NOT look like full protection — so the model route is stubbed with a
 * state that carries all three at once and the rail is judged on what it
 * paints. Read-only by construction: the rail submits nothing, and the stub
 * only ever ADDS protection fields to the server's own answer.
 */
test.describe('rail protection · the three materials (fhd)', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('full, half and partial each paint their own material', async ({page, request}) => {
    test.setTimeout(420_000);
    await page.route('**/api/player**', async (route) => {
      const response = await route.fetch();
      const model = await response.json();
      const seat = model.thisPlayer;
      if (seat !== undefined && seat !== null) {
        seat.protectedResources = {...seat.protectedResources, plants: 'half', steel: 'on'};
        seat.protectedProduction = {...seat.protectedProduction, steel: 'on'};
        seat.protectedCardResources = {};
        seat.tableau = [
          ...seat.tableau,
          {name: 'Pets', resources: 4, protectedResources: true},
          {name: 'Birds', resources: 3},
        ];
      }
      await route.fulfill({response, json: model});
    });

    // `realtime=0` keeps the poll the only update channel, so every applied
    // view came through the stub (a WS push would carry the raw model).
    await bootIntoGame(page, request, {config: soloGameConfig(), query: '&realtime=0'});
    await page.waitForSelector('[data-protection="plants"]', {timeout: 25_000});
    await page.waitForTimeout(900);
    await shoot(page, 'fhd-materials');

    const marks = await page.evaluate(() => {
      const read = (sel: string) => {
        const el = document.querySelector(sel);
        if (el === null) {
          return undefined;
        }
        return {
          kind: el.getAttribute('data-protection-kind') ?? '',
          label: el.getAttribute('aria-label') ?? '',
          hasHalfGlyph: el.querySelector('.con-shieldmark__half') !== null,
          hasCheck: el.querySelector('.con-shieldmark__check') !== null,
          hasPartialFill: el.querySelector('.con-shieldmark__fill') !== null,
          bodyFill: getComputedStyle(el.querySelector('.con-shieldmark__body') as Element).fill,
        };
      };
      return {
        plants: read('[data-protection="plants"]'),
        steel: read('[data-protection="steel"]'),
        steelProduction: read('[data-protection-production="steel"]'),
        animals: read('.con-res-aux__cell [data-protection]'),
      };
    });
    console.log(`[RAILPROT:materials] ${JSON.stringify(marks)}`);

    expect(marks.plants?.kind, 'Botanical Experience reads half').toBe('half');
    expect(marks.plants?.hasHalfGlyph, 'the half mark prints ½').toBe(true);
    expect(marks.plants?.hasCheck, 'the half mark prints no check').toBe(false);
    expect(marks.plants?.label, 'the label states the halved RULE')
      .toContain('вдвое');

    expect(marks.steel?.kind).toBe('full');
    expect(marks.steel?.hasCheck).toBe(true);
    expect(marks.steelProduction?.kind, 'the production chip carries its own mark').toBe('full');

    expect(marks.animals?.kind, 'a mixed animal chip reads partial').toBe('partial');
    // The partial mark is a shield filled only to its waist — a LEVEL, not a
    // recoloured copy of the full one (which is what a glance actually reads).
    expect(marks.animals?.hasPartialFill, 'partial paints a fill level').toBe(true);
    expect(marks.animals?.hasCheck, 'partial never prints the full check').toBe(false);
    expect(marks.steel?.hasPartialFill, 'a full mark has no fill level').toBe(false);
    expect(marks.animals?.label).toContain('4');
    expect(marks.animals?.label).toContain('7');
    // …and its RULE line is scoped to the shielded part, never «cannot be
    // removed» flat — that would be false of the rest of the chip.
    expect(marks.animals?.label).toContain('защищённую часть');

    // The three materials must differ where it counts: the partial shield is
    // HOLLOW (graphite body), full and half are solid gold.
    expect(marks.animals?.bodyFill, 'partial is hollow').not.toBe(marks.steel?.bodyFill);
    expect(marks.plants?.bodyFill, 'half stays gold, never the hollow body')
      .not.toBe(marks.animals?.bodyFill);
  });
});
