import {expect, test, Page} from './consoleTest';
import {bootFixture, openBotScreenHub, press, visibleSurfaces} from './consoleStart';

/**
 * LOTUS INNOVATIONS (CF7) — the fork's own bot card, «the Scientific Breakthrough» (docs/AUTOMA_DATA_AUDIT.md §20). The
 * data live on the corporation card; the fixture `bot-lab` stands the lab at 6. This probe opens the bot's corporation
 * face and reads the data off its capsule — where the table SEES the next breakthrough coming.
 */

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that turns terraforming into breakthroughs', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the face prints Science and its capsule reads the lab', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-lab', {query: '&consoleProfile=tv'});

    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/lotus/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'Science').toHaveCount(1);
    await expect(face.locator('.pcard__res'), 'the lab\'s capsule').toContainText('6');
    await face.screenshot({path: 'screenshots/bot-corp-lab-face.png'});
  });
});
