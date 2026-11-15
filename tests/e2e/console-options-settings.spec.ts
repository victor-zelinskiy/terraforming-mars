import {test, expect} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {readSettled} from './settledRead';

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

/**
 * The main menu, DRIVABLE: its root painted and the boot veil gone (the veil owns the top layer while it stands — a
 * click under it lands nowhere). The state the old fixed pause stood in for.
 */
async function menuReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForSelector('.cm-menu', {timeout: 45_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => {});
}

test.describe('the settings console — categories, stepper, detail strip', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('a horizontal category strip groups the settings; the stepper dials a value both ways', async ({page}) => {
    test.setTimeout(120_000);
    // Deterministic: default layout.
    await page.addInitScript(() => localStorage.removeItem('tm_gp_button_layout'));
    await page.goto('/?console=1&consoleProfile=auto');
    await menuReady(page);

    // Open the settings console (click the menu item by its localized label — the click waits for it to be stable).
    await page.locator('.cm-item', {hasText: 'Настройки'}).first().click();
    await page.waitForSelector('.con-sys--settings', {timeout: 10_000});

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
    // top — the minor tabs are smaller and centred, so their top sits lower). Measured AT REST (the card's entrance
    // moves every tab).
    const centres = await readSettled(page, () => tabs.evaluateAll((els) => [...new Set(els.map((el) => {
      const r = el.getBoundingClientRect();
      return Math.round(r.top + r.height / 2);
    }))]), {message: 'the tabs\' centres'});
    expect(centres, 'the tabs are on one row').toHaveLength(1);
    await expect(tabs.filter({hasText: 'Интерфейс'})).toHaveClass(/con-set__tab--current/);
    await shoot(page, '01-settings-interface');

    // Every category fits WITHOUT scrolling — the whole point of the strip (the
    // flat list had outgrown the screen). No overflow ⇒ no progress rail.
    await expect(page.locator('.con-set__scroll .con-scroll-area__rail')).toHaveCount(0);
    // The printed card number is technical information: an interface OPT-IN, off by default.
    const numbersRow = page.locator('.con-set__row', {hasText: 'Номера карт'});
    await expect(numbersRow).toHaveCount(1);
    await expect(numbersRow.locator('.con-set__value')).toHaveText('выкл.');
    // The tallest category (six rows) ends inside its fixed pane — nothing is clipped below the last row. Both edges
    // read at rest, in one read.
    const edges = await readSettled(page, async () => ({
      pane: await page.locator('.con-set__scroll').evaluate((el) => el.getBoundingClientRect().bottom),
      lastRow: await page.locator('.con-set__row').last().evaluate((el) => el.getBoundingClientRect().bottom),
    }), {message: 'the pane and its last row'});
    expect(edges.lastRow, 'the last interface row stands inside the pane').toBeLessThanOrEqual(edges.pane + 0.5);

    // Switching category swaps the pane; the row this spec was written around
    // (Раскладка кнопок) lives under «Управление».
    await expect(page.locator('.con-set__row', {hasText: 'Раскладка кнопок'})).toHaveCount(0);
    await tabs.filter({hasText: 'Управление'}).click();
    await expect(tabs.filter({hasText: 'Управление'})).toHaveClass(/con-set__tab--current/);
    await expect(page.locator('.con-set__row', {hasText: 'Раскладка кнопок'})).toHaveCount(1);
    // The per-game mask is offered only in-game (context='game').
    await expect(page.locator('.con-set__row', {hasText: 'Приватный счёт'})).toHaveCount(0);
    await shoot(page, '02-settings-controls');

    // The stepper: clicking the row steps FORWARD, the ‹ arrow steps BACK, and
    // the choice persists. Same row, same geometry, only the value changes.
    const layoutRow = page.locator('.con-set__row', {hasText: 'Раскладка кнопок'});
    await expect(layoutRow.locator('.con-set__value')).toHaveText('Стандартный');
    // The row's box is compared across the step — BOTH sides read at rest.
    const rowBox = await readSettled(page, () => layoutRow.boundingBox(), {message: 'the layout row before the step'});
    await layoutRow.click();
    await expect(layoutRow.locator('.con-set__value')).toHaveText('Обмен A / B');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tm_gp_button_layout')),
      {message: 'the layout choice persists'}).toBe('swap-ab');
    // A longer value must not resize the row (fixed-width stepper cell).
    expect((await readSettled(page, () => layoutRow.boundingBox(), {message: 'the layout row after the step'}))?.width)
      .toBe(rowBox?.width);
    await shoot(page, '03-button-layout-swapped');

    await layoutRow.locator('.con-set__arrow').first().click();
    await expect(layoutRow.locator('.con-set__value')).toHaveText('Стандартный');

    // The DETAIL strip describes the cursored row and never changes height.
    const detail = page.locator('.con-set__detail');
    const detailBox = await readSettled(page, () => detail.boundingBox(), {message: 'the detail strip on the layout row'});
    await expect(page.locator('.con-set__detail-title')).toHaveText('Раскладка кнопок');
    await page.locator('.con-set__row', {hasText: 'Управление колесом'}).hover();
    await expect(page.locator('.con-set__detail-title')).toHaveText('Управление колесом');
    expect((await readSettled(page, () => detail.boundingBox(), {message: 'the detail strip on the wheel row'}))?.height)
      .toBe(detailBox?.height);

    // The minor DIAGNOSTICS category holds the SETTINGS of diagnostics — dialable rows like every other category.
    // (The read-only readout it used to be lives on the diagnostics surface: System → «Диагностика» → СИСТЕМА —
    // `console-diagnostics.spec.ts`.)
    await tabs.filter({hasText: 'Диагностика'}).click();
    await expect(page.locator('.con-set__row', {hasText: 'Уведомления разработчика'})).toHaveCount(1);
    await expect(page.locator('.con-set__ro')).toHaveCount(0);
    // Off by default: a player who never opens this category never meets the notice.
    await expect(page.locator('.con-set__row', {hasText: 'Уведомления разработчика'}).locator('.con-set__value')).toHaveText('выкл.');
    await shoot(page, '04-settings-diagnostics');
  });

  test('TV profile: the couch calibration still fits every category in one card', async ({page}) => {
    test.setTimeout(120_000);
    // The flagship posture (docs/CONSOLE_TV_*): bigger type, bigger hit targets,
    // wider card. What must hold is the same thing as everywhere else — the card
    // is ONE constant size and nothing needs a scroll to be read.
    await page.goto('/?console=1&consoleProfile=tv');
    await menuReady(page);
    await page.locator('.cm-item', {hasText: 'Настройки'}).first().click();
    await page.waitForSelector('.con-sys--settings', {timeout: 10_000});
    const card = page.locator('.con-sys__card');
    // The card AT REST — the reference every category's frame is compared against (and the shot's moment).
    const box = await readSettled(page, () => card.boundingBox(), {message: 'the settings card (interface)'});
    await shoot(page, '05-tv-interface');
    // The TALLEST category (Interface: six rows since «Номера карт») needs no scroll at the couch calibration either.
    await expect(page.locator('.con-set__row', {hasText: 'Номера карт'})).toHaveCount(1);
    await expect(page.locator('.con-set__scroll .con-scroll-area__rail')).toHaveCount(0);

    // The card lives inside the viewport (a system surface never overflows).
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(1080);

    for (const category of ['Управление', 'Графика', 'Диагностика']) {
      await page.locator('.con-set__tab', {hasText: category}).click();
      await expect(page.locator('.con-set__tab', {hasText: category})).toHaveClass(/con-set__tab--current/);
      // Constant frame: switching category must not move or resize the card — read at rest, like the reference.
      const next = await readSettled(page, () => card.boundingBox(), {message: `the settings card (${category})`});
      expect(next?.height, `${category} height`).toBe(box?.height);
      expect(next?.y, `${category} y`).toBe(box?.y);
      // No value is cut off by the fixed-width stepper cell (the values at rest).
      const clipped = await readSettled(page, () => page.locator('.con-set__value').evaluateAll(
        (els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent)),
      {message: `${category} values`});
      expect(clipped, `${category} clipped values`).toEqual([]);
      await shoot(page, `05-tv-${category}`);
    }
  });
});
