import {expect, test, Page} from './consoleTest';
import {bootFixture, openBotScreenHub, press, visibleSurfaces} from './consoleStart';

/**
 * HARTLAN HEATING (CF6) — the fork's own bot card, «the Construction Boiler» (docs/AUTOMA_DATA_AUDIT.md §20). The heat
 * lives on the corporation card; the fixture `bot-boiler` stands the boiler at 7. This probe opens the bot's corporation
 * face and reads the heat off its capsule — where the table SEES the next heating season coming.
 */

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that heats Mars from its building sites', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the face prints Space + Building and its capsule reads the boiler', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-boiler', {query: '&consoleProfile=tv'});

    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/hartlan/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'Space + Building').toHaveCount(2);
    await expect(face.locator('.pcard__res'), 'the boiler\'s capsule').toContainText('7');
    await face.screenshot({path: 'screenshots/bot-corp-boiler-face.png'});
  });
});
