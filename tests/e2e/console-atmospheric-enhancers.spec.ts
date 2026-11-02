import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playCardFromHand, playQueueCard, press, settle,
  soloGameConfig, submitSummary, waitQueueIdle, walkFocusUntil, walkToSummary,
} from './consoleStart';

/**
 * P44 ATMOSPHERIC ENHANCERS — the prelude's «ВАРИАНТ» step on its TWO hosts (docs/claude/prompts/prelude2-p44-…, ledger EQ).
 *
 *   A (the real start) — the queue names the choice before A; A opens the step beside the card (crumb «… › ВАРИАНТ»),
 *     three PRINTED rows; B goes back with nothing sent; A on the Venus row plays the prelude in ONE POST that carries
 *     the addressed `or` answer — the server raises Venus, no live effect decision ever stands; the floater search
 *     names its rule on the reveal («со значком аэростата»).
 *   E (`atmospheric-enhancers-wg`) — WG Project's «ВЫБОР ПРОЛОГА»: RT on P44 opens the SAME step beside the candidate,
 *     B back to the candidates (the pick kept), A on the Venus row → ONE POST (the pick + the `or`).
 *   E′ (`-wg-maxed`) — the temperature row is offered and says «на максимуме · ничего не изменит».
 * Storyboard: `TM_E2E_STORYBOARD=1` (screenshots/p44/).
 */

const CARD = 'Atmospheric Enhancers';
const CARD_RU = 'АТМОСФЕРНЫЕ УСИЛИТЕЛИ';
const OUT = path.resolve('screenshots', 'p44');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PICK = '.con-hand__outcome .con-deckpick--play';

type Wire = {thisPlayer: {tableau: Array<{name: string}>}, game: {venusScaleLevel: number, temperature: number}};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const onTable = (w: Wire, name: string) => w.thisPlayer.tableau.some((c) => c.name === name);

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, PRESET.id, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** The live effect decision must never stand (the choice was made before the press); the reveal's rule is sampled. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const p = {decision: 0, floaterRule: 0};
    (window as unknown as {__p44: typeof p}).__p44 = p;
    const sample = () => {
      if (document.querySelector('.con-decision') !== null) {
        p.decision++;
      }
      if (document.querySelector('[data-draw-search="floaterIcon"]') !== null) {
        p.floaterRule++;
      }
    };
    new MutationObserver(() => sample()).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
    window.setInterval(sample, 50);
  });
}
const probe = (page: Page) => page.evaluate(() => (window as unknown as {__p44: {decision: number, floaterRule: number}}).__p44);

/** Walk the step's column to `row` (0-based) — the cursor starts on the first takeable row. */
async function toRow(page: Page, host: string, row: number): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const at = await page.locator(`${host} .con-vchoice__opt--focused`).getAttribute('data-prelude-variant-row');
    if (at === String(row)) {
      return;
    }
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${host} .con-vchoice__opt--focused`)).toHaveAttribute('data-prelude-variant-row', String(row));
}

test.describe(`P44 Atmospheric Enhancers · the «ВАРИАНТ» step · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A: the start queue — the choice named before A, the step beside the card, B nothing sent, Venus in ONE POST', async ({page, request}) => {
    test.setTimeout(420_000);
    const corp = 'Teractor';
    const preludes = [CARD, 'Donation'];
    const id = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {prelude: true, prelude2: true, venus: true, promo: true},
      startingCorporations: 1,
      customCorporationsList: [corp],
      customPreludes: [CARD, 'Donation', 'Supplier', 'Loan'],
    })});
    await openConsole(page, id, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await pickCards(p, [corp]);
        } else if (kind === 'prelude') {
          expect(await pickCards(p, preludes), 'both preludes picked').toEqual(expect.arrayContaining(preludes));
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    expect(await playQueueCard(page, corp), 'the corporation played').toBe(true);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const venusBefore = (await wireOf(request, id)).game.venusScaleLevel;
    // The queue names the choice BEFORE A.
    await expect(page.locator(`[data-queue-slot="${CARD}"] [data-qcard-variants]`), 'the reading line names the branches').toHaveCount(1, {timeout: 20_000});
    await shoot(page, 'A-queue');
    const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), 'P44 focused').toBeTruthy();
    const posts = watchPosts(page);
    await armProbe(page);
    await press(page, 'Enter', 500);
    await expect(page.locator('[data-start-variant] [data-prelude-variant-row]'), 'three printed rows').toHaveCount(3, {timeout: 10_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb: … › the card › ВАРИАНТ'})
      .toMatch(new RegExp(`${CARD_RU}.*ВАРИАНТ`));
    await expect(page.locator('[data-start-variant] [data-prelude-variant-shared] [data-draw-search="floaterIcon"]'), 'the shared draw names its rule').toHaveCount(1);
    await shoot(page, 'A-step');
    // B — back to the queue, nothing sent.
    await press(page, 'Escape', 400);
    await expect(page.locator('[data-start-variant]')).toHaveCount(0, {timeout: 5_000});
    expect(posts.length, 'B sent nothing').toBe(0);
    // A again → the step; the Venus row → A → ONE POST.
    const stop = await storyboard(page, 'start-venus');
    await press(page, 'Enter', 500);
    await expect(page.locator('[data-start-variant]')).toHaveCount(1, {timeout: 10_000});
    await toRow(page, '[data-start-variant]', 2);
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 15_000}).toBeGreaterThan(0);
    expect(posts.length, 'ONE POST').toBe(1);
    expect(posts[0], 'the batch carries the addressed `or` answer').toMatch(/"type":"or","index":2/);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 30_000, message: 'the server raised Venus'}).toBe(venusBefore + 4);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'A-after');
    expect(onTable(await wireOf(request, id), CARD), 'P44 on the table').toBe(true);
    const p = await probe(page);
    expect(p.decision, 'no live effect decision ever stood').toBe(0);
    expect(p.floaterRule, 'the floater search named its rule').toBeGreaterThan(0);
  });

  test('E: WG Project\'s «ВЫБОР ПРОЛОГА» — RT opens the same step beside P44, B back, the Venus row plays in ONE POST', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'atmospheric-enhancers-wg', {query: PRESET.query});
    await settle(page);
    const venusBefore = (await wireOf(request, id)).game.venusScaleLevel;
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    await expect(page.locator(`${PICK}[data-flow="choosing"]`), 'the pick has landed in the hand').toHaveCount(1, {timeout: 40_000});
    const focusedPick = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focusedPick() === CARD, focusedPick, 12), 'P44 focused').toBeTruthy();
    await press(page, 'Enter', 400);
    await expect(page.locator(`${PICK} [data-deckpick-slot="${CARD}"].con-cards__slot--picked`)).toHaveCount(1, {timeout: 5_000});
    const posts = watchPosts(page);
    await armProbe(page);
    await press(page, 'Period', 500); // RT
    await expect(page.locator(`${PICK} [data-deckpick-variant] [data-prelude-variant-row]`), 'the step stands over the candidates').toHaveCount(3, {timeout: 10_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb\'s tail: ВАРИАНТ'}).toMatch(/ВАРИАНТ/);
    await shoot(page, 'E-step');
    await press(page, 'Escape', 400);
    await expect(page.locator(`${PICK} [data-deckpick-variant]`)).toHaveCount(0, {timeout: 5_000});
    await expect(page.locator(`${PICK} [data-deckpick-slot="${CARD}"].con-cards__slot--picked`), 'the pick is kept').toHaveCount(1);
    expect(posts.length, 'B sent nothing').toBe(0);
    const stop = await storyboard(page, 'wg-venus');
    await press(page, 'Period', 500);
    await expect(page.locator(`${PICK} [data-deckpick-variant]`)).toHaveCount(1, {timeout: 10_000});
    await toRow(page, `${PICK} [data-deckpick-variant]`, 2);
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 15_000}).toBeGreaterThan(0);
    expect(posts.length, 'ONE POST').toBe(1);
    expect(posts[0], 'the pick + the addressed `or`').toMatch(/"type":"or","index":2/);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 30_000, message: 'the server raised Venus'}).toBe(venusBefore + 4);
    await expect.poll(async () => onTable(await wireOf(request, id), CARD), {timeout: 30_000}).toBe(true);
    await settle(page, {timeoutMs: 60_000});
    await stop();
    await shoot(page, 'E-after');
    expect((await probe(page)).decision, 'no live effect decision ever stood').toBe(0);
  });

  test('E′: the temperature at its maximum — the row is offered and says so', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'atmospheric-enhancers-wg-maxed', {query: PRESET.query});
    await settle(page);
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    await expect(page.locator(`${PICK}[data-flow="choosing"]`)).toHaveCount(1, {timeout: 40_000});
    const focusedPick = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focusedPick() === CARD, focusedPick, 12)).toBeTruthy();
    await press(page, 'Enter', 400);
    await press(page, 'Period', 500);
    const first = page.locator(`${PICK} [data-deckpick-variant] [data-prelude-variant-row="0"]`);
    await expect(first).toHaveCount(1, {timeout: 10_000});
    await expect(first.locator('[data-vchoice-quiet]'), 'offered, and it says so').toContainText('на максимуме');
    await expect(first, 'never refused').not.toHaveClass(/con-vchoice__opt--off/);
    await shoot(page, 'E2-maxed');
  });
});
