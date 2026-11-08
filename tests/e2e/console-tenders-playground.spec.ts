import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {press, settle} from './consoleStart';

/**
 * «ВИТРИНА ТЕНДЕРОВ» (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §17.4 / §18) — the Playground stand is the ACCEPTANCE surface
 * of the Committee's certificate, and the owner's frames of 2026-11-08 named the two defects the compact size must never
 * show again: the rule prose crammed into the small card, and a name that does not fit («ДОПОЛНИТЕЛЬНЫЙ ПРОЛОГ»,
 * «СУБСИДИЯ НА ИССЛЕДОВАНИЯ» cut at the edge). The ladder that sizes the name (`data-name-tier`) is CALIBRATED here,
 * never eyeballed: every dealt kind at the table size, in the real font at the TV profile.
 *
 *   A  every catalog contract at the table size: NO rule text, the ART WINDOW standing, the name whole (no clipped
 *      glyph, no overflow of the name box), the compensation stub inside the card, the card's own content inside its
 *      box; X opens the ONE fullscreen viewer on the reader size — the face still prints no prose, the RULE reads in the
 *      right column (the project card's rules panel) and the LORE in the left gutter (the face's third pass,
 *      2026-11-08); the simulated table stands with the real bidding scene (tv4k)
 */

/** The stand's frames — the face's acceptance pictures (the catalog, the table, the viewer). */
const OUT = path.resolve('screenshots', 'tenders-playground');

const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type FaceReport = {id: string, name: string, tier: string | null, problems: Array<string>};

async function auditCatalog(page: Page): Promise<Array<FaceReport>> {
  return page.evaluate(() => {
    const out: Array<FaceReport> = [];
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-tdpg-catalog] .con-tender.con-tender--table'));
    for (const card of cards) {
      const id = card.getAttribute('data-tender') ?? '?';
      const name = card.querySelector<HTMLElement>('.con-tender__name');
      const problems: Array<string> = [];
      // NO PROSE on the face: the reading plate carries the name, the meta line and the stub — nothing else.
      const plate = card.querySelector<HTMLElement>('.con-tender__plate');
      const parts = plate === null ? [] : Array.from(plate.children).map((el) => el.className);
      if (parts.join('|') !== 'con-tender__name|con-tender__meta|con-tender__coupon') {
        problems.push(`the reading plate prints more than the name · meta · stub (${parts.join(', ')})`);
      }
      const art = card.querySelector<HTMLElement>('.con-tender__art');
      if (art === null || art.getBoundingClientRect().height === 0) {
        problems.push('no art window');
      }
      if (name === null) {
        problems.push('no name');
      } else {
        // A word that cannot wrap overflows HORIZONTALLY — the one defect the ladder exists for. (The vertical
        // scrollHeight is not asked: a bold uppercase line at line-height 1.1 reports its glyphs' INK overhang as a 2 px
        // «overflow» with nothing clipped — the page's own content check below is what proves the name stays on it.)
        if (name.scrollWidth > name.clientWidth + 1) {
          problems.push(`the name overflows its box horizontally (${name.scrollWidth} > ${name.clientWidth})`);
        }
        const lines = Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight));
        if (lines > 3) {
          problems.push(`the name takes ${lines} lines`);
        }
      }
      if (card.scrollHeight > card.clientHeight + 1) {
        problems.push(`the page's content overflows its box (${card.scrollHeight} > ${card.clientHeight})`);
      }
      const stub = card.querySelector<HTMLElement>('.con-tender__coupon');
      const box = card.getBoundingClientRect();
      if (stub === null) {
        problems.push('no compensation stub');
      } else {
        const r = stub.getBoundingClientRect();
        if (r.bottom > box.bottom + 1 || r.right > box.right + 1 || r.height === 0) {
          problems.push(`the stub leaves the page (stub ${Math.round(r.bottom)} vs page ${Math.round(box.bottom)})`);
        }
      }
      const kicker = card.querySelector<HTMLElement>('.con-tender__kicker');
      if (kicker === null) {
        problems.push('no «ТЕНДЕР» kicker on the head');
      } else if (kicker.scrollWidth > kicker.clientWidth + 1) {
        problems.push('the «ТЕНДЕР» kicker is cut');
      }
      const meta = card.querySelector<HTMLElement>('.con-tender__meta');
      if (meta !== null && meta.scrollWidth > meta.clientWidth + 1) {
        problems.push(`the rank · window line overflows (${meta.scrollWidth} > ${meta.clientWidth})`);
      }
      out.push({id, name: name?.textContent?.trim() ?? '', tier: card.getAttribute('data-name-tier'), problems});
    }
    return out;
  });
}

test.describe('the tenders playground — the certificate at the table size fits by construction', () => {
  test.use({viewport: PRESET.viewport});

  test('A · every dealt kind: no rule prose, the art window, the name whole, the stub on the card; X opens the viewer — rule right, lore left; the table stands (tv4k)', async ({page}) => {
    test.setTimeout(240_000);
    await page.goto(`/?tendersPlayground${PRESET.query}`);
    await expect(page.locator('.cm-stand')).toHaveCount(1, {timeout: 30_000});
    await expect(page.locator('[data-tenders-playground]')).toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 20_000});

    const catalog = page.locator('[data-tdpg-catalog] .con-tender.con-tender--table');
    const count = await catalog.count();
    expect(count, 'every dealt kind stands in the catalog (the legacy «Авантюра» does not)').toBeGreaterThanOrEqual(12);
    expect(await page.locator('[data-tdpg-catalog] [data-tdpg-id="gamble"]').count(), 'the undivided gamble is legacy — not in the catalog').toBe(0);
    for (const id of ['gamblePreludes', 'gambleProjects', 'gambleCorporations']) {
      expect(await page.locator(`[data-tdpg-catalog] [data-tdpg-id="${id}"]`).count(), `${id} is dealt`).toBe(1);
    }

    await page.locator('[data-tdpg-catalog]').screenshot({path: path.join(OUT, 'catalog.png')});
    await page.locator('[data-tdpg-sizes]').screenshot({path: path.join(OUT, 'sizes.png')});
    await page.locator('[data-tdpg-states]').screenshot({path: path.join(OUT, 'states.png')});
    const report = await auditCatalog(page);
    const red = report.filter((r) => r.problems.length > 0);
    expect(red, 'certificates with a defect at the table size:\n' + red.map((r) => `  ${r.id} «${r.name}» tier ${r.tier}: ${r.problems.join('; ')}`).join('\n')).toEqual([]);
    // The ladder is in use: the longest names took a tighter tier, the short ones the base.
    const tiers = new Set(report.map((r) => r.tier));
    expect(tiers.has('1'), 'a short name on the base tier').toBeTruthy();
    expect(tiers.has('2') || tiers.has('3'), 'a long name on a tighter tier').toBeTruthy();

    // The simulated table: the REAL bidding scene stands in the stand's frame with its dealt lots.
    await expect(page.locator('[data-tdpg-table] [data-bidding-stage]')).toHaveCount(1);
    await expect.poll(() => page.locator('[data-tdpg-table] [data-bidding-card]').count(), {message: 'the dealt lots lie on the table'}).toBeGreaterThan(0);
    await settle(page, {timeoutMs: 20_000});
    await page.locator('[data-tdpg-table]').screenshot({path: path.join(OUT, 'table.png')});

    // X — the ONE fullscreen viewer on the reader size: the face prints no prose, the rule reads in the right column and
    // the lore in the left gutter.
    await press(page, 'KeyX', 1200);
    const viewer = page.locator('dialog.con-zoom[open]');
    await expect(viewer).toHaveCount(1, {timeout: 15_000});
    // The card ON STAGE (the viewer also keeps an off-screen neighbour warm — never the subject here).
    const onStage = viewer.locator('.card-zoom-stage .card-zoom-card--tender .con-tender--reader');
    await expect(onStage).toHaveCount(1);
    await expect(onStage.locator('.con-tender__art')).toBeVisible();
    expect(await onStage.locator('.con-tender__plate > *').count(), 'the face prints no prose in the viewer either').toBe(3);
    await expect(viewer.locator('.card-zoom-side [data-rules-group="group:tender"]')).toBeVisible();
    await expect(viewer.locator('.card-zoom-side [data-rules-group="group:window"]')).toBeVisible();
    await expect(viewer.locator('.card-zoom-side [data-rules-group="group:buyout"]')).toBeVisible();
    await expect(viewer.locator('.card-zoom-lore')).toBeVisible();
    await settle(page, {timeoutMs: 20_000});
    await page.screenshot({path: path.join(OUT, 'viewer.png')});
    const readerName = onStage.locator('.con-tender__name');
    expect(await readerName.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'the reader\'s name holds its box').toBeTruthy();
    await press(page, 'Escape', 1000);
    await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(0, {timeout: 15_000});
  });
});
