import {expect, test, Page} from './consoleTest';
import {bootFixture, openBotScreenHub, press, visibleSurfaces} from './consoleStart';

/**
 * THE DEIMOS GROUP (CF9) — the fork's own bot card, «the Conspiracy Theory» (docs/AUTOMA_DATA_AUDIT.md §20). Every
 * vote MarsBot does not win puts a rumour on the card; before the action phase each rumour sends a delegate and pushes
 * the bot's least advanced track. The fixture `bot-rumours` (a Parliament table) stands 2 rumours on the card: the
 * face prints the Mars tag and its capsule reads the rumours.
 */

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that turns lost votes into rumours', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the face prints the Mars tag and its capsule reads the rumours', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-rumours', {query: '&consoleProfile=tv'});

    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/deimos/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'the Mars tag').toHaveCount(1);
    await expect(face.locator('.pcard__res'), 'the rumours\' capsule').toContainText('2');
    await face.screenshot({path: 'screenshots/bot-corp-rumours-face.png'});
  });
});
