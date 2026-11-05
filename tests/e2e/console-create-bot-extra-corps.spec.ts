import {test, expect, Page} from './consoleTest';
import {press} from './consoleStart';
import {campaignBase, seedIdentity} from './campaignFixtures';

/**
 * «ДОПОЛНИТЕЛЬНЫЕ КОРПОРАЦИИ БОТА» (the owner, 2026-11-05; docs/claude/marsbot-corporations.md § ДОПОЛНИТЕЛЬНЫЕ
 * КОРПОРАЦИИ БОТА): a switch in the bot's editor beside the difficulty and «Динамический баланс», OFF for a new
 * setup. A flips it, the note says what the pool is, the bot's crew row names it, the creation sends
 * `automa.extraCorporations`, and the next visit to the creator remembers it.
 */

const NAME = 'Alice';
const PROFILE = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

async function toCreator(page: Page): Promise<void> {
  await page.goto(`${campaignBase()}/?x=1${PROFILE.query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  for (let i = 0; i < 12 && await page.locator('.cm-item--cursor').getAttribute('data-menu-item') !== 'create'; i++) {
    await press(page, 'ArrowDown', 120);
  }
  await expect(page.locator('.cm-item--cursor')).toHaveAttribute('data-menu-item', 'create');
  await press(page, 'Enter', 200);
  await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
  await expect(page.locator('.cm-mode__tile--cursor')).toHaveAttribute('data-mode', 'single');
  await press(page, 'Enter', 600);
  await page.waitForSelector('.cm-crew', {timeout: 30_000});
}

/** The cursor onto the bot's crew row — walked, and turned around at a wall. */
async function cursorToBot(page: Page): Promise<void> {
  const bot = page.locator('.cm-row', {has: page.locator('.cm-row__num--bot')});
  await expect(bot, 'the bot sits in the crew').toHaveCount(1);
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft']) {
    if (await bot.evaluate((el) => el.classList.contains('cm-row--cursor'))) {
      return;
    }
    await press(page, key, 200);
  }
  await expect(bot, 'the cursor on the bot row').toHaveClass(/cm-row--cursor/);
}

test.describe('console: «Дополнительные корпорации бота» — the switch in the bot editor', () => {
  test.use({viewport: PROFILE.viewport});

  test('OFF by default; A flips it, the note and the crew row follow, the creation sends it, the creator remembers it', async ({page}) => {
    test.setTimeout(300_000);
    await seedIdentity(page, NAME);
    // A solo setup with the bot — seeded once: the creator's own save must win on the second visit.
    await page.addInitScript((settings) => {
      if (window.localStorage.getItem('tm_last_game_settings') === null) {
        window.localStorage.setItem('tm_last_game_settings', JSON.stringify(settings));
      }
    }, {gameMode: 'marsbot', players: [{name: NAME, color: 'blue'}], rules: {randomMilestonesAwards: false, randomBoardTiles: false}});

    await toCreator(page);
    const botRow = page.locator('.cm-row', {has: page.locator('.cm-row__num--bot')});
    await expect(botRow.locator('[data-crew-extra-corporations]'), 'OFF: the row names nothing').toHaveCount(0);
    await cursorToBot(page);
    await press(page, 'Enter', 600);
    await page.waitForSelector('.cm-overlay .cm-fields', {timeout: 15_000});

    const editor = page.locator('.cm-overlay');
    const field = editor.locator('.cm-field', {has: page.locator('[data-field="extraCorporations"]')});
    await expect(field, 'the switch beside the difficulty').toContainText('Дополнительные корпорации бота');
    await expect(field.locator('[data-field="extraCorporations"]'), 'OFF for a new setup').toContainText('выкл.');
    await expect(editor.locator('[data-extra-corporations-note]')).toContainText('только корпорации из официального набора');

    for (let i = 0; i < 4 && !(await field.evaluate((el) => el.classList.contains('cm-field--cursor'))); i++) {
      await press(page, 'ArrowDown', 200);
    }
    await expect(field, 'the cursor on the switch').toHaveClass(/cm-field--cursor/);
    await press(page, 'Enter', 400);
    await expect(field.locator('[data-field="extraCorporations"]'), 'A flips it ON').toContainText('вкл.');
    await expect(editor.locator('[data-extra-corporations-note]')).toContainText('созданных для этой версии игры');
    await editor.screenshot({path: 'screenshots/bot-extra-corps/editor-on.png'});

    await press(page, 'Escape', 500);
    await expect(editor).toHaveCount(0);
    await expect(botRow.locator('[data-crew-extra-corporations]'), 'the bot row names it').toHaveText('Доп. корпорации');
    await page.locator('.cm-crew').screenshot({path: 'screenshots/bot-extra-corps/crew-on.png'});

    // The launch: X → the plate → A; the creation carries the option.
    await press(page, 'KeyX', 800);
    await expect(page.locator('.cm-overlay--launch'), 'the launch plate').toBeVisible({timeout: 15_000});
    const created = page.waitForRequest((r) => r.url().includes('/api/creategame') && r.method() === 'POST', {timeout: 60_000});
    await press(page, 'Enter', 400);
    const body = (await created).postDataJSON() as {automa?: {extraCorporations?: boolean}};
    expect(body.automa?.extraCorporations, 'the creation sends the switch').toBe(true);
    await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem('tm_last_game_settings') ?? '{}').botExtraCorporations),
      {message: 'the setup is saved with the switch', timeout: 30_000}).toBe(true);

    // The next visit: the creator remembers it.
    await toCreator(page);
    await expect(botRow.locator('[data-crew-extra-corporations]'), 'remembered for the user').toHaveText('Доп. корпорации');
  });
});
