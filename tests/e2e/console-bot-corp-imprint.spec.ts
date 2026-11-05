import {expect, test, Page} from './consoleTest';
import {bootFixture, openBotBoardDetail, openBotScreenHub, press, visibleSurfaces} from './consoleStart';

/**
 * PROTEUS (CF8) — the fork's own bot card, «the Imprint of Form» (docs/AUTOMA_DATA_AUDIT.md §20). Its setup reveals
 * three project cards as MarsBot's Preludes; their tags are the IMPRINT, decided in play — so the mat's white markers
 * come from the game, not from the card's data. The fixture `bot-imprint` pins the imprint to the Space and Science
 * tracks with 5 data on the card: the face reads the data, the mat wears exactly two white trackers, and the legend
 * says what they remind of.
 */

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

async function openBotSeat(page: Page): Promise<void> {
  await key(page, 'KeyY', 1200);
  await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
  const corpLine = page.locator('.con-info__corp--bot');
  for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
    await key(page, 'KeyE', 900);
  }
  await expect(corpLine).toContainText(/proteus/i);
}

test.describe('console: a MarsBot corporation whose form is read off the cards it revealed', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('the face prints the Wild tag and its capsule reads the data', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-imprint', {query: '&consoleProfile=tv'});
    await openBotSeat(page);
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face).toBeVisible();
    await expect(face.locator('.pcard__tags .pcard-tag'), 'the Wild tag').toHaveCount(1);
    await expect(face.locator('.pcard__res'), 'the data capsule').toContainText('5');
    await face.screenshot({path: 'screenshots/bot-corp-imprint-face.png'});
  });

  test('the mat wears the imprint: two white trackers, and the legend names the data', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'bot-imprint', {query: '&consoleProfile=tv'});
    await openBotSeat(page);
    await openBotBoardDetail(page);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();
    await expect(tracks.locator('.mb-track--whitemarker'), 'Space + Science — the imprint decided in play').toHaveCount(2);
    const legend = page.locator('.mb-cubelegend');
    await expect(legend).toBeVisible();
    await expect(legend).toContainText(/Proteus/);
    await page.screenshot({path: 'screenshots/bot-corp-imprint-mat.png', fullPage: false});
  });
});
