import {expect, test, Page} from './consoleTest';
import {bootFixture, openBotScreenHub, press, visibleSurfaces} from './consoleStart';

/**
 * ARWIND INC. (CF5) — the fork's own bot card, «the Orbital Shipyard» (docs/AUTOMA_DATA_AUDIT.md §20). The fighters
 * live on the corporation card; the fixture `bot-shipyard` (a Parliament table) stands the hangar at 5. This probe opens
 * the bot's corporation face and reads the hangar off its capsule — where the table SEES the next launch coming.
 */

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that runs an orbital shipyard', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the face prints its Space tag and its capsule reads the hangar', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-shipyard', {query: '&consoleProfile=tv'});

    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/arwind/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'the Space tag').toHaveCount(1);
    await expect(face.locator('.pcard__res'), 'the hangar\'s capsule').toContainText('5');
    await face.screenshot({path: 'screenshots/bot-corp-shipyard-face.png'});
  });
});
