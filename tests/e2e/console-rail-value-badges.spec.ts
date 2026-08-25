import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig} from './consoleStart';

/**
 * THE RAIL VALUE BADGES — the passive information layer on the left rail:
 * MC-rate coins on the payment resources (steel / titanium / Helion heat) and
 * VP-coefficient shields on scoring tags (none in a fresh game — asserted).
 *
 * Contracts pinned per profile (fhd / tv-4k / deck-handheld):
 *  - the figures are the LIVE payment rates (2 / 3 / 1 with Helion);
 *  - a badge is PINNED to its icon: inside its own row's box, never over the
 *    value column, and its text never clips out of the badge plate;
 *  - the layer is zero-layout: all six rows keep ONE height, the icon column
 *    keeps one axis (the rail-contract invariants survive the badges);
 *  - a fresh game shows NO VP shields (no scoring card is in play).
 *
 * Helion is forced (customCorporationsList + corporation) — the heat coin is
 * the one standing grant a solo boot can guarantee deterministically.
 */

const OUT = path.resolve('screenshots', 'rail-value-badges');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: '', htmlClass: undefined},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv', htmlClass: /con-profile-tv/},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld', htmlClass: /con-profile-handheld/},
] as const;

type Box = {x: number, y: number, w: number, h: number, r: number, b: number};

type BadgeAudit = {
  key: string,
  text: string,
  wide: boolean,
  badge: Box,
  textBox: Box,
  row: Box,
  valueLeft: number,
};

type RailBadgesAudit = {
  badges: ReadonlyArray<BadgeAudit>,
  rowHeights: ReadonlyArray<number>,
  iconXs: ReadonlyArray<number>,
  vpBadgeCount: number,
};

async function readBadges(page: Page): Promise<RailBadgesAudit> {
  return await page.evaluate(() => {
    const box = (el: Element): Box => {
      const b = el.getBoundingClientRect();
      return {x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom};
    };
    type Box = {x: number, y: number, w: number, h: number, r: number, b: number};
    const badges: Array<{key: string, text: string, wide: boolean, badge: Box, textBox: Box, row: Box, valueLeft: number}> = [];
    for (const el of document.querySelectorAll('.con-res__row [data-mc-badge]')) {
      const row = el.closest('.con-res__row');
      const value = row?.querySelector('.con-res__value');
      const text = el.querySelector('.con-valbadge__text');
      if (row === null || row === undefined || value === null || value === undefined || text === null) {
        continue;
      }
      // The value column is a RESERVED right-aligned box (4 digits wide), so
      // its left edge is mostly empty air on the narrow handheld rail — the
      // honest «clear of the number» boundary is the glyph INK, not the box.
      const inkRange = document.createRange();
      inkRange.selectNodeContents(value);
      badges.push({
        key: el.getAttribute('data-mc-badge') ?? '',
        text: (text.textContent ?? '').trim(),
        wide: el.classList.contains('con-valbadge--wide'),
        badge: box(el),
        textBox: box(text),
        row: box(row),
        valueLeft: inkRange.getBoundingClientRect().left,
      });
    }
    const rows = [...document.querySelectorAll('.con-res__row')];
    return {
      badges,
      rowHeights: rows.map((r) => r.getBoundingClientRect().height),
      iconXs: rows.map((r) => r.querySelector('.con-res__icon')?.getBoundingClientRect().left ?? -1),
      vpBadgeCount: document.querySelectorAll('[data-tag-vp]').length,
    };
  });
}

for (const profile of PROFILES) {
  test.describe(`rail value badges · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('rates are live, badges pin to their icons, zero layout cost', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootIntoGame(page, request, {
        config: soloGameConfig({customCorporationsList: ['Helion']}),
        corporation: 'Helion',
        query: profile.query,
      });
      if (profile.htmlClass !== undefined) {
        await expect(page.locator('html')).toHaveClass(profile.htmlClass);
      }
      await page.waitForSelector('.con-res__row', {timeout: 15_000});
      await page.waitForSelector('[data-mc-badge="steel"]', {timeout: 15_000});
      await page.waitForTimeout(600);
      await shoot(page, `${profile.tag}-board`);

      const a = await readBadges(page);
      console.log(`[RAILBADGE:${profile.tag}] ` +
        a.badges.map((b) => `${b.key}=«${b.text}» box=${b.badge.w.toFixed(1)}×${b.badge.h.toFixed(1)}`).join(' ') +
        ` rows=${a.rowHeights.map((h) => h.toFixed(1)).join(',')} vp=${a.vpBadgeCount}`);

      // ── The figures: live payment rates, Helion's heat included. ──
      const byKey = new Map(a.badges.map((b) => [b.key, b]));
      expect(byKey.get('steel')?.text, 'steel pays 2').toBe('2');
      expect(byKey.get('titanium')?.text, 'titanium pays 3').toBe('3');
      expect(byKey.get('heat')?.text, 'Helion heat pays 1').toBe('1');
      // Non-payment rows carry nothing (M€ is the unit itself; energy never).
      expect(byKey.has('megacredits'), 'no badge on the M€ row').toBe(false);
      expect(byKey.has('energy'), 'no badge on the energy row').toBe(false);
      expect(byKey.has('plants'), 'no badge on plants without the MLC grant').toBe(false);

      // ── Pinned geometry: inside the row, clear of the value column. ──
      for (const b of a.badges) {
        expect(b.badge.y, `${b.key} badge inside its row (top)`).toBeGreaterThanOrEqual(b.row.y - 1);
        expect(b.badge.b, `${b.key} badge inside its row (bottom)`).toBeLessThanOrEqual(b.row.b + 1);
        expect(b.badge.r, `${b.key} badge clear of the value ink`).toBeLessThanOrEqual(b.valueLeft - 1);
        // The figure never clips out of its plate (Linux CI rounds glyph
        // advances up — keep a 1.5px allowance, not a zero-width claim).
        expect(b.textBox.x, `${b.key} figure inside the plate (left)`).toBeGreaterThanOrEqual(b.badge.x - 1.5);
        expect(b.textBox.r, `${b.key} figure inside the plate (right)`).toBeLessThanOrEqual(b.badge.r + 1.5);
        expect(b.textBox.b, `${b.key} figure inside the plate (bottom)`).toBeLessThanOrEqual(b.badge.b + 1.5);
      }

      // ── Zero layout cost: one row height, one icon axis. ──
      expect(a.rowHeights.length).toBe(6);
      expect(Math.max(...a.rowHeights) - Math.min(...a.rowHeights), 'badges never grow a row')
        .toBeLessThanOrEqual(1);
      const icons = a.iconXs.filter((x) => x >= 0);
      expect(Math.max(...icons) - Math.min(...icons), 'one icon column').toBeLessThanOrEqual(2);

      // ── A fresh game scores no tag — no VP shield may exist yet. ──
      expect(a.vpBadgeCount, 'no VP badge without a scoring card').toBe(0);
    });
  });
}

/**
 * The two badge kinds a plain solo boot cannot show — the VP shield and the
 * card-bound aux coin — each have a CORPORATION that grants them from turn
 * one, which makes the visual deterministic without driving a card play.
 */
test.describe('rail value badges · deterministic corp scenarios (fhd)', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('Crescent Research Association: the Moon tag carries the «⅓» shield', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {moon: true},
        customCorporationsList: ['Crescent Research Association'],
      }),
      corporation: 'Crescent Research Association',
    });
    await page.waitForSelector('[data-tag-vp="moon"]', {timeout: 15_000});
    await page.waitForTimeout(400);
    await shoot(page, 'fhd-tag-vp-crescent');

    const audit = await page.evaluate(() => {
      const badge = document.querySelector('[data-tag-vp="moon"]');
      const cell = badge?.closest('.con-tagmx__cell');
      const num = cell?.querySelector('.con-tagmx__num');
      if (badge === null || badge === undefined || cell === null || cell === undefined || num === null || num === undefined) {
        return undefined;
      }
      const b = badge.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      const n = num.getBoundingClientRect();
      return {
        text: (badge.querySelector('.con-valbadge__text')?.textContent ?? '').trim(),
        inCellX: b.left >= c.left - 2 && b.right <= c.right + 2,
        inCellY: b.top >= c.top - 2 && b.bottom <= c.bottom + 2,
        clearOfCount: b.bottom <= n.top + 1,
        vpTotal: document.querySelectorAll('[data-tag-vp]').length,
      };
    });
    expect(audit, 'the moon VP shield renders').toBeDefined();
    expect(audit?.text, 'a third per moon tag').toBe('⅓');
    expect(audit?.inCellX, 'shield inside its cell (x)').toBe(true);
    expect(audit?.inCellY, 'shield inside its cell (y)').toBe(true);
    expect(audit?.clearOfCount, 'shield never covers the count').toBe(true);
    expect(audit?.vpTotal, 'exactly ONE scoring tag').toBe(1);
  });

  test('Carbon Nanosystems: the graphene aux chip carries the «4» coin', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {promo: true},
        customCorporationsList: ['Carbon Nanosystems'],
      }),
      corporation: 'Carbon Nanosystems',
    });
    await page.waitForSelector('.con-res-aux__cell [data-mc-badge]', {timeout: 15_000});
    await page.waitForTimeout(400);
    await shoot(page, 'fhd-aux-graphene');

    const audit = await page.evaluate(() => {
      const badge = document.querySelector('.con-res-aux__cell [data-mc-badge]');
      const cell = badge?.closest('.con-res-aux__cell');
      const value = cell?.querySelector('.con-res-aux__value');
      if (badge === null || badge === undefined || cell === null || cell === undefined || value === null || value === undefined) {
        return undefined;
      }
      const b = badge.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      const ink = document.createRange();
      ink.selectNodeContents(value);
      return {
        key: badge.getAttribute('data-mc-badge'),
        text: (badge.querySelector('.con-valbadge__text')?.textContent ?? '').trim(),
        label: badge.getAttribute('aria-label') ?? '',
        inCellY: b.top >= c.top - 3 && b.bottom <= c.bottom + 3,
        clearOfValue: b.right <= ink.getBoundingClientRect().left - 1,
      };
    });
    expect(audit, 'the graphene coin renders').toBeDefined();
    expect(audit?.key).toBe('graphene');
    expect(audit?.text, 'graphene pays 4').toBe('4');
    expect(audit?.label, 'the aria names the M€ meaning').toContain('M€');
    expect(audit?.inCellY, 'coin inside its chip (y)').toBe(true);
    expect(audit?.clearOfValue, 'coin clear of the chip count').toBe(true);
  });
});
