import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {createGameWithCards, openConsole, soloGameConfig} from './consoleStart';

/**
 * Console-native · THE ONE COMMAND BAR IS NEVER TUCKED UNDER ITS HOST.
 *
 * The colonies (and hydro) section drops the footer below the page content
 * (`con-footer--behind-workspace`, z-index −1) so the hand dock's rising
 * cards cannot poke over that section's own bottom rail. That tuck is local
 * to the BARE section standing in `.con-main`.
 *
 * Hosted as a STEP inside another workspace — a colony build raised by a
 * prelude or by the corporation's mandatory first action — the section lives
 * inside the start workspace, whose full-bleed plate then paints across the
 * footer's row. With the tuck still on, the ONE bar every surface publishes
 * its hints to («А ВЫБРАТЬ · L3 ОСМОТРЕТЬ ИСТОЧНИК · B СВЕРНУТЬ») is drawn
 * UNDER that plate and reads dimmed — reported from a live game.
 *
 * Verified to FAIL without the host carve-out (`behind: true`, `z: -1`).
 */

const OUT = path.resolve('screenshots', 'console-hosted-section-footer');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

test.describe('console · a hosted section never buries the command bar', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the colonies step inside the start keeps the footer above the host plate', async ({page, request}) => {
    test.setTimeout(300_000);

    // A solo COLONIES game: its setup asks «уберите колонию» — a SelectColony
    // served by the colonies workspace as a STEP of the start workspace,
    // which is exactly the hosted shape under test.
    const playerId = await createGameWithCards(request, [], {
      config: soloGameConfig({
        players: [{name: 'FooterGuard', color: 'red', beginner: false, handicap: 0, first: true}],
        seed: 0.42,
        expansions: {corpera: true, colonies: true},
      }),
    });
    await openConsole(page, playerId);

    const colonies = page.locator('.con-colonies');
    for (let i = 0; i < 40 && await colonies.count() === 0; i++) {
      await page.keyboard.press(i % 2 === 0 ? 'Enter' : 'Period');
      await page.waitForTimeout(700);
    }
    await colonies.waitFor({state: 'visible', timeout: 60_000});
    await page.waitForTimeout(900);
    await shoot(page, 'colonies-step');

    const state = await page.evaluate(() => {
      const footer = document.querySelector('.con-footer');
      return {
        hostedByStart: document.querySelector('.con-start') !== null,
        behind: footer?.classList.contains('con-footer--behind-workspace') ?? null,
        z: footer === null ? null : getComputedStyle(footer as HTMLElement).zIndex,
      };
    });
    expect(state.hostedByStart, 'the colonies must be hosted by the start workspace here').toBeTruthy();
    expect(state.behind, 'the ONE command bar may never be tucked under its host').toBeFalsy();
    expect(state.z, 'a tucked footer shows up as a negative z').not.toBe('-1');
  });
});
