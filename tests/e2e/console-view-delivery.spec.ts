import {test, expect, EXPECTS_LIVENESS_STALL, Page} from './consoleTest';
import {bootFixtureSeats, settle} from './consoleStart';
import {passAs} from './parliamentDrive';

/**
 * THE VIEW'S DELIVERY — «ASKED» IS THE SERVER'S WORD (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §0 row V,
 * §4; docs/claude/console/liveness-arbiter.md § 3c).
 *
 * The arbiter read «the server asks» off the APPLIED view — so whatever kept a view from arriving left the page on
 * its last one: «the other seat's turn», a healthy accepting screen with nobody asked, while the server waited for
 * THIS player. No stall, no rung, no last line; and a failure of the view's own road ended in a native `alert` no
 * pad reaches. The controls, on a real page:
 *
 *  · the view's FETCH never comes back (held on the wire — every attempt is cut at its bound and tried again): the
 *    poll's word is kept apart from the view, the arbiter judges an UNDELIVERED question — `asked: undelivered`,
 *    `holder: view:…` — and past the ladder the page is rebuilt from the server's view: the question is served;
 *  · the view ARRIVES AND CANNOT BE APPLIED (a body the commit throws on): no dialog — the last line at once, asked
 *    by the view's road under its own cause, and the rebuilt page serves the question.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

function watchLines(page: Page): {stalls: Array<string>, rebuilds: Array<string>, dialogs: Array<string>} {
  const lines = {stalls: [] as Array<string>, rebuilds: [] as Array<string>, dialogs: [] as Array<string>};
  page.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('[liveness] stall')) {
      lines.stalls.push(text);
    } else if (text.startsWith('[session-rebuild]')) {
      lines.rebuilds.push(text);
    }
  });
  // A native dialog is the freeze this spec exists against: it is answered (the page must not hang the run) and counted.
  page.on('dialog', (dialog) => {
    lines.dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss().catch(() => undefined);
  });
  return lines;
}

/** The console stands again after a navigation the PRODUCT made. */
async function consoleStandsAgain(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 90_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
}

/** The sitting the other seat's pass opened is on screen: its plate, or the Parliament it opens into. */
const sittingOnScreen = (page: Page): Promise<number> => page.locator('.con-mandatory, .con-parl').count();

test.describe('the view\'s delivery — the server asks, the page was never told', () => {
  test.use({viewport: PRESET.viewport});

  test('the view\'s fetch never comes back: the arbiter judges the UNDELIVERED question — the ladder, the page rebuilt, the question served', async ({page, request}) => {
    test.setTimeout(360_000);
    test.info().annotations.push({type: EXPECTS_LIVENESS_STALL, description: 'the arbiter\'s judgement of an undelivered question is this control\'s subject — the view\'s fetch is held on purpose'});
    const lines = watchLines(page);
    const {seats} = await bootFixtureSeats(page, request, 'eden-alliance-enact-remote', {query: PRESET.query});
    await settle(page);

    // THE PLANT: from now on the view's fetch leaves and never comes back (the page cuts each attempt at its bound).
    // It ends with the rebuild's own line — the next document must get its view.
    let holding = true;
    await page.route('**/api/player?*', async (route) => {
      if (!holding) {
        await route.continue();
      }
      // (held: never fulfilled — the request is the page's to cut)
    });
    page.on('console', (m) => {
      if (m.text().startsWith('[session-rebuild] page')) {
        holding = false;
      }
    });
    const left = page.waitForEvent('framenavigated', {predicate: (frame) => frame === page.mainFrame(), timeout: 240_000});

    // The other seat passes — the last pass of the generation: the server now asks THIS player (the sitting).
    await passAs(request, seats[1]);

    await expect.poll(() => lines.stalls.length, {timeout: 180_000, message: 'the arbiter named the undelivered question'}).toBeGreaterThan(0);
    expect(lines.stalls[0], 'the stall says what was asked and who held it').toMatch(/asked: undelivered; .*holder: view:(fetch|nobody);/);
    await expect.poll(() => lines.rebuilds.length, {timeout: 120_000, message: 'past the spent ladder: the last line'}).toBeGreaterThan(0);
    expect(lines.rebuilds[0]).toMatch(/^\[session-rebuild\] page — «\S+» \(undelivered@\d+\) — by liveness: /);
    await left;
    await consoleStandsAgain(page);
    await expect.poll(() => sittingOnScreen(page), {timeout: 60_000, message: 'the rebuilt page was given the question: the sitting is on screen'}).toBeGreaterThan(0);
    expect(lines.rebuilds.filter((l) => l.startsWith('[session-rebuild] page')), 'rebuilt ONCE').toHaveLength(1);
    expect(lines.dialogs, 'no native dialog anywhere on the road').toEqual([]);
  });

  test('the view arrives and CANNOT BE APPLIED: no dialog — the page is rebuilt by the view\'s own road, and the question is served', async ({page, request}) => {
    test.setTimeout(300_000);
    test.info().annotations.push({type: EXPECTS_LIVENESS_STALL, description: 'the last line asked by the view\'s road is this control\'s subject — the view\'s body is broken on purpose'});
    const lines = watchLines(page);
    const {seats} = await bootFixtureSeats(page, request, 'eden-alliance-enact-remote', {query: PRESET.query});
    await settle(page);

    // THE PLANT: the next view the page fetches has no game in it — the commit throws on its first read. Once.
    let broken = 0;
    await page.route('**/api/player?*', async (route) => {
      if (broken > 0) {
        await route.continue();
        return;
      }
      broken++;
      const answer = await route.fetch();
      const view = await answer.json() as Record<string, unknown>;
      view.game = null;
      await route.fulfill({response: answer, json: view});
    });
    const left = page.waitForEvent('framenavigated', {predicate: (frame) => frame === page.mainFrame(), timeout: 120_000});

    await passAs(request, seats[1]);

    await expect.poll(() => lines.rebuilds.length, {timeout: 90_000, message: 'the view\'s road asked for the last line'}).toBeGreaterThan(0);
    expect(lines.rebuilds[0]).toMatch(/^\[session-rebuild\] page — «view-apply» \(view@\d+\) — by view: the fetched view could not be applied — /);
    expect(lines.stalls, 'the arbiter had nothing to wait out — the failure was known at once').toEqual([]);
    await left;
    await consoleStandsAgain(page);
    await expect.poll(() => sittingOnScreen(page), {timeout: 60_000, message: 'the rebuilt page applied the view: the sitting is on screen'}).toBeGreaterThan(0);
    expect(broken, 'one broken view').toBe(1);
    expect(lines.dialogs, 'a failure of the view\'s road is never a native dialog').toEqual([]);
  });
});
