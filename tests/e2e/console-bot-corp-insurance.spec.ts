import {expect, test, Page} from './consoleTest';
import {bootFixture, openBotScreenHub, press, visibleSurfaces} from './consoleStart';

/**
 * MONS INSURANCE (CF4) — the fork's own bot card, «the Reserve Fund» (docs/AUTOMA_DATA_AUDIT.md §20). The fund lives
 * on the corporation card as M€; the fixture `bot-insurance` stands it at 13. This probe opens the bot's corporation
 * face and reads the fund off its capsule — the one place the table SEES the capital grow.
 */

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that keeps a reserve fund', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the face prints no tag and its capsule reads the fund', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-insurance', {query: '&consoleProfile=tv'});

    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/mons/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'the card prints no tag').toHaveCount(0);
    await expect(face.locator('.pcard__res'), 'the fund\'s capsule').toContainText('13');
    await face.screenshot({path: 'screenshots/bot-corp-insurance-face.png'});
  });
});
