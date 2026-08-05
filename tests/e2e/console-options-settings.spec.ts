import {test, expect} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The SETTINGS CONSOLE (`.con-sys--settings`) as the MAIN MENU opens it — the
 * same component the in-game system menu's «Настройки» plate hosts, so what
 * this proves about the rail / stepper / detail strip holds in both places.
 *
 * What it guards, beyond "it renders":
 *  · the CATEGORY strip runs horizontally — the axis LB/RB moves along, with
 *    the two chips bracketing it — and switching category swaps the row list
 *    (the fix for "the settings no longer fit the screen"); no category scrolls;
 *  · the technical categories are the MINOR ones, past the hairline seam —
 *    «мелкие незначительные категории»;
 *  · the stepper steps a value BOTH ways and persists it, without the row
 *    resizing around a longer value (the layout-shift contract);
 *  · the DETAIL strip follows the cursor at a CONSTANT height — the property
 *    that let the rows shed their subtitles and halve in height;
 *  · PRIVATE SCORE is not here — it is per-game, offered only in-game.
 */

const OUT = path.resolve('screenshots', 'console-settings');

async function shoot(page: import('@playwright/test').Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

test.describe('the settings console — categories, stepper, detail strip', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('a horizontal category strip groups the settings; the stepper dials a value both ways', async ({page}) => {
    test.setTimeout(120_000);
    // Deterministic: default layout.
    await page.addInitScript(() => localStorage.removeItem('tm_gp_button_layout'));
    await page.goto('/?console=1&consoleProfile=auto');
    await page.waitForSelector('.cm-menu', {timeout: 45_000});
    await page.waitForTimeout(1200);

    // Open the settings console (click the menu item by its localized label).
    await page.locator('.cm-item', {hasText: 'Настройки'}).first().click();
    await page.waitForSelector('.con-sys--settings', {timeout: 10_000});
    await page.waitForTimeout(500);

    // The head names the surface; WHERE you are is the tab strip's job.
    // (the caps are `text-transform`, so the assertions read the source text)
    await expect(page.locator('.con-sys__crumb-root')).toHaveText('Настройки');
    await expect(page.locator('.con-sys__crumb-stage')).toHaveCount(0);

    // The tabs run HORIZONTALLY — the axis LB/RB moves along — and the chips
    // that drive them bracket the very strip they move through.
    const tabs = page.locator('.con-set__tab');
    await expect(tabs.filter({hasText: 'Интерфейс'})).toHaveCount(1);
    await expect(tabs.filter({hasText: 'Управление'})).toHaveCount(1);
    await expect(tabs.filter({hasText: 'Графика'})).toHaveCount(1);
    await expect(page.locator('.con-sys__tabs .con-set__tab--minor').filter({hasText: 'Диагностика'})).toHaveCount(1);
    await expect(page.locator('.con-sys__tabs-chip')).toHaveCount(2);
    // ONE strip, one line: every tab shares the row's vertical CENTRE (not its
    // top — the minor tabs are smaller and centred, so their top sits lower).
    const centres = await tabs.evaluateAll((els) => [...new Set(els.map((el) => {
      const r = el.getBoundingClientRect();
      return Math.round(r.top + r.height / 2);
    }))]);
    expect(centres, 'the tabs are on one row').toHaveLength(1);
    await expect(tabs.filter({hasText: 'Интерфейс'})).toHaveClass(/con-set__tab--current/);
    await shoot(page, '01-settings-interface');

    // Every category fits WITHOUT scrolling — the whole point of the strip (the
    // flat list had outgrown the screen). No overflow ⇒ no progress rail.
    await expect(page.locator('.con-set__scroll .con-scroll-area__rail')).toHaveCount(0);

    // Switching category swaps the pane; the row this spec was written around
    // (Раскладка кнопок) lives under «Управление».
    await expect(page.locator('.con-set__row', {hasText: 'Раскладка кнопок'})).toHaveCount(0);
    await tabs.filter({hasText: 'Управление'}).click();
    await page.waitForTimeout(400);
    await expect(tabs.filter({hasText: 'Управление'})).toHaveClass(/con-set__tab--current/);
    await expect(page.locator('.con-set__row', {hasText: 'Раскладка кнопок'})).toHaveCount(1);
    // The per-game mask is offered only in-game (context='game').
    await expect(page.locator('.con-set__row', {hasText: 'Приватный счёт'})).toHaveCount(0);
    await shoot(page, '02-settings-controls');

    // The stepper: clicking the row steps FORWARD, the ‹ arrow steps BACK, and
    // the choice persists. Same row, same geometry, only the value changes.
    const layoutRow = page.locator('.con-set__row', {hasText: 'Раскладка кнопок'});
    await expect(layoutRow.locator('.con-set__value')).toHaveText('Стандартный');
    const rowBox = await layoutRow.boundingBox();
    await layoutRow.click();
    await page.waitForTimeout(400);
    await expect(layoutRow.locator('.con-set__value')).toHaveText('Обмен A / B');
    expect(await page.evaluate(() => localStorage.getItem('tm_gp_button_layout'))).toBe('swap-ab');
    // A longer value must not resize the row (fixed-width stepper cell).
    expect((await layoutRow.boundingBox())?.width).toBe(rowBox?.width);
    await shoot(page, '03-button-layout-swapped');

    await layoutRow.locator('.con-set__arrow').first().click();
    await page.waitForTimeout(300);
    await expect(layoutRow.locator('.con-set__value')).toHaveText('Стандартный');

    // The DETAIL strip describes the cursored row and never changes height.
    const detail = page.locator('.con-set__detail');
    const detailBox = await detail.boundingBox();
    await expect(page.locator('.con-set__detail-title')).toHaveText('Раскладка кнопок');
    await page.locator('.con-set__row', {hasText: 'Управление колесом'}).hover();
    await page.waitForTimeout(300);
    await expect(page.locator('.con-set__detail-title')).toHaveText('Управление колесом');
    expect((await detail.boundingBox())?.height).toBe(detailBox?.height);

    // The minor DIAGNOSTICS category is a read-only readout, not a settings list
    // — it is the ONE home of the readout the system menu used to duplicate.
    await tabs.filter({hasText: 'Диагностика'}).click();
    await page.waitForTimeout(400);
    await expect(page.locator('.con-set__row')).toHaveCount(0);
    await expect(page.locator('.con-set__group').filter({hasText: 'Связь'})).toHaveCount(1);
    await expect(page.locator('.con-set__ro', {hasText: 'Версия клиента'})).toHaveCount(1);
    await shoot(page, '04-settings-diagnostics');
  });

  test('TV profile: the couch calibration still fits every category in one card', async ({page}) => {
    test.setTimeout(120_000);
    // The flagship posture (docs/CONSOLE_TV_*): bigger type, bigger hit targets,
    // wider card. What must hold is the same thing as everywhere else — the card
    // is ONE constant size and nothing needs a scroll to be read.
    await page.goto('/?console=1&consoleProfile=tv');
    await page.waitForSelector('.cm-menu', {timeout: 45_000});
    await page.waitForTimeout(1200);
    await page.locator('.cm-item', {hasText: 'Настройки'}).first().click();
    await page.waitForSelector('.con-sys--settings', {timeout: 10_000});
    await page.waitForTimeout(600);
    await shoot(page, '05-tv-interface');

    const card = page.locator('.con-sys__card');
    const box = await card.boundingBox();
    // The card lives inside the viewport (a system surface never overflows).
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(1080);

    for (const category of ['Управление', 'Графика', 'Диагностика']) {
      await page.locator('.con-set__tab', {hasText: category}).click();
      await page.waitForTimeout(350);
      // Constant frame: switching category must not move or resize the card.
      const next = await card.boundingBox();
      expect(next?.height, `${category} height`).toBe(box?.height);
      expect(next?.y, `${category} y`).toBe(box?.y);
      // No value is cut off by the fixed-width stepper cell.
      const clipped = await page.locator('.con-set__value').evaluateAll(
        (els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
      expect(clipped, `${category} clipped values`).toEqual([]);
      await shoot(page, `05-tv-${category}`);
    }
  });
});
