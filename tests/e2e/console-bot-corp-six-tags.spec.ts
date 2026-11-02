import {expect, test, Page} from './consoleTest';
import {bootSeededGame, corporationsExcluding, openBotBoardDetail, openBotScreenHub, press, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * POLYPHEMOS (C32) — SIX printed starting tags, the most of any implemented
 * corporation (C08 Saturn Systems' four was the previous record). They are
 * resolved at selection like a revealed card's, so by the time the player
 * first opens the bot's mat, TWO tracks are already well up it.
 *
 * The face has to carry all six on its tag rail, and the mat has to show what
 * they did — this probe reads both, because six is the number that would first
 * break a rail built for one or two.
 */

const POLYPHEMOS_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C32'},
  // The human's own deal must NOT contain Polyphemos: the collision rule (RB-B
  // Setup 1) would legitimately hand the bot a different corporation. The list
  // has to fill ALL EIGHT dealt slots — it is cards-on-top, not a restriction.
  customCorporationsList: corporationsExcluding('Polyphemos'),
});

async function key(page: Page, code: string, settle = 700): Promise<void> {
  await press(page, code, settle);
}

test.describe('console: a MarsBot corporation with six starting tags', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face carries all six, and the mat shows what they moved', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: POLYPHEMOS_CONFIG});
    expect(created.ok(), 'the server accepted the automa config').toBeTruthy();
    const {players} = await created.json();
    await bootSeededGame(page, request, players[0].id);

    // Information workspace → the BOT seat.
    await key(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine).toContainText(/polyphemos/i);

    // The printed BOARD detail (the `botdoor` ring stop — the bot seat's own reader).
    await openBotBoardDetail(page);
    const tracks = page.locator('.mb-tracks');
    await expect(tracks).toBeVisible();

    // TWO tracks are already up — three tags each, and both #1 cells are
    // «advance», so each went at least one further.
    const positions = await tracks.locator('.mb-track__pos').evaluateAll(
      (nodes) => nodes.map((n) => Number.parseInt(n.textContent ?? '0', 10)));
    const moved = positions.filter((p) => p >= 3);
    expect(moved.length, `two tracks opened on #3 or beyond; saw ${JSON.stringify(positions)}`)
      .toBeGreaterThanOrEqual(2);

    await page.screenshot({path: 'screenshots/bot-corp-six-tags-mat.png', fullPage: false});

    // …and the corporation's own FACE, where all six tags must stand WHOLE in one row, like the printed card
    // (the owner, 2026-11-03: the count-only overlap hid 41 % of every medallion — «пила» of half-coins).
    await key(page, 'Escape', 900); // back to the seat overview
    await openBotScreenHub(page);
    const face = page.locator('.con-info__block--botcorp .pcard');
    await expect(face, 'the bot screen carries the corporation face').toBeVisible();
    const rail = face.locator('.pcard__tags');
    await expect(rail).toHaveClass(/pcard__tags--row/);
    const boxes = await rail.locator('.pcard-tag').evaluateAll((nodes) => nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return {left: r.left, right: r.right};
    }));
    expect(boxes, 'six medallions').toHaveLength(6);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].left, `medallion ${i + 1} clears medallion ${i}: ${JSON.stringify(boxes)}`).toBeGreaterThanOrEqual(boxes[i - 1].right - 0.5);
    }
    await face.screenshot({path: 'screenshots/bot-corp-six-tags-face.png'});
  });
});
