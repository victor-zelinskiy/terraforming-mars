import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console Options panel — the BUTTON LAYOUT setting in the MAIN-MENU Options
 * (keyboard-reachable), which hosts the SAME `ConsoleOptionsPanel` component the
 * in-game system-menu «Настройки» opens. Also asserts the PRIVATE SCORE row is
 * NOT here — it is per-game and offered ONLY in-game (context='game'), where the
 * system menu is gamepad-only and can't be driven from a keyboard e2e.
 */

const OUT = path.resolve('screenshots', 'console-settings');

async function key(page: Page, code: string, settleMs = 350): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

test.describe('console options — private score + button layout', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the Options panel cycles Button layout; Private score is in-game only', async ({page}) => {
    test.setTimeout(120_000);
    // Deterministic: default layout.
    await page.addInitScript(() => localStorage.removeItem('tm_gp_button_layout'));
    await page.goto('/?console=1&consoleProfile=auto');
    await page.waitForSelector('.cm-menu', {timeout: 45_000});
    await page.waitForTimeout(1200);

    // Open Options (click the menu item by its localized label).
    await page.locator('.cm-item', {hasText: 'Настройки'}).first().click();
    await page.waitForSelector('.cm-overlay', {timeout: 10_000});
    await page.waitForTimeout(500);

    // Button layout is present here; the per-game Private score row is NOT
    // (offered only from the in-game system menu).
    await expect(page.locator('.cm-opt', {hasText: 'Раскладка кнопок'})).toHaveCount(1);
    await expect(page.locator('.cm-opt', {hasText: 'Приватный счёт'})).toHaveCount(0);
    await shoot(page, '01-options-rows');

    // Button layout cycles Standard → Swap A/B in place.
    const layoutRow = page.locator('.cm-opt', {hasText: 'Раскладка кнопок'});
    await expect(layoutRow.locator('.cm-opt__value')).toHaveText('Стандартный');
    await layoutRow.click();
    await page.waitForTimeout(400);
    await expect(layoutRow.locator('.cm-opt__value')).toHaveText('Обмен A / B');
    await shoot(page, '02-button-layout-swapped');
    // The stored preference persists.
    expect(await page.evaluate(() => localStorage.getItem('tm_gp_button_layout'))).toBe('swap-ab');

    // Round-trip back to Standard.
    await layoutRow.click();
    await page.waitForTimeout(300);
    await expect(layoutRow.locator('.cm-opt__value')).toHaveText('Стандартный');
  });
});
