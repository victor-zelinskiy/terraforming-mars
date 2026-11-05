import {expect, test, Page} from './consoleTest';
import {bootFixture, openBotScreenHub, press, visibleSurfaces} from './consoleStart';

/**
 * TITAN HOLDINGS (CF10) — the fork's own bot card, «the Holding's Lobby» (docs/AUTOMA_DATA_AUDIT.md §20). Planet tags
 * put leverage on the card; before the action phase each leverage buys a delegate where it can still change the vote,
 * or is invested in a planet track. The fixture `bot-leverage` (a Parliament table) stands 3 leverage on the card: the
 * face prints Earth + Jovian and its capsule reads the leverage.
 */

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation that lobbies with its planets\' leverage', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the face prints Earth + Jovian and its capsule reads the leverage', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-leverage', {query: '&consoleProfile=tv'});

    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/titan/i);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'Earth + Jovian').toHaveCount(2);
    await expect(face.locator('.pcard__res'), 'the leverage capsule').toContainText('3');
    await face.screenshot({path: 'screenshots/bot-corp-leverage-face.png'});
  });
});
