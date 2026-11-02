import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, openActionFocus, openCardActions, playCardFromHand, press, settle} from './consoleStart';

/**
 * P89 «ВЕНЕРИАНСКИЕ ШАТТЛЫ» (ledger DZ — docs/claude/prompts/prelude2-p89-venus-shuttles.md), the TV profile.
 *
 *  (A) the discounted price in ONE grammar with the standard projects: the composer's price chip reads «12 → 10» with the
 *      «−2» capsule, the «Расчёт» strip opens with the printed 12; one POST; the server: Venus 10 → 12, 15 → 5 M€, +1 TR;
 *  (C) 9 M€ against a price of 10: the tile is blocked with ONE number — «Не хватает 1 M€»;
 *  (D) Venus at 30 %: legal, «действие ничего не изменит»; the price is paid, the scale does not move;
 *  (E) the alternative Venus board at 16 %: the step into 18 % raises the bonus — with no surface to host it, the band
 *      stands only AFTER the board told the step (the marker rests on 18 when the band appears); the pick is collected;
 *  (F) the play: «2 floaters to ANY Venus card» — Dirigibles is the one candidate (Jupiter Floating Station holds
 *      floaters but carries no Venus tag), seeded and SHOWN.
 *
 * Screens under screenshots/venus-shuttles/.
 */
const OUT = path.resolve('screenshots', 'venus-shuttles');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const SHUTTLES = 'Venus Shuttles';

type Wire = {
  thisPlayer: {megacredits: number, terraformRating: number, steel: number, titanium: number, plants: number, energy: number, heat: number};
  game: {venusScaleLevel: number};
  waitingFor?: {venusBonusPrompt?: {kind: string}};
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
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

/** «Действия карт» → the P89 tile (focused; `open` → its composer). */
async function focusShuttles(page: Page, open: boolean): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && (await focused()) !== SHUTTLES; i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await focused(), 'the P89 tile is focused').toBe(SHUTTLES);
  if (open) {
    await openActionFocus(page);
    await settle(page);
  }
}

async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(1);
}

test.describe(`P89 Venus Shuttles · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('(A) the discounted price «12 → 10 · −2», the «Расчёт» strip, one POST, Venus 10 → 12', async ({page, request}) => {
    test.setTimeout(300_000);
    const posts = watchPosts(page);
    const id = await bootFixture(page, request, 'venus-shuttles', {query: PRESET.query});
    await focusShuttles(page, true);
    const composer = page.locator(ACTION_COMPOSER);
    await expect(composer.locator('[data-chip-printed]'), 'the price chip opens with the printed 12').toHaveText('12');
    await expect(composer.locator('[data-chip-paid]'), '…and reads what is paid').toHaveText('10');
    await expect(composer.locator('[data-chip-discount]'), 'the discount capsule').toHaveAttribute('data-chip-discount-n', '2');
    await expect(composer.locator('[data-count-printed]'), 'the «Расчёт» strip reads the discount').toHaveAttribute('data-count-printed-n', '12');
    await shoot(page, 'A1-setup');
    await commit(page, posts);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 20_000}).toBe(12);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, '15 − 10').toBe(5);
    await expect(page.locator(ACTION_COMPOSER), 'the workspace leaves').toHaveCount(0, {timeout: 20_000});
    await shoot(page, 'A2-done');
  });

  test('(C) 9 M€ against 10: the tile is blocked with ONE number', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'venus-shuttles-poor', {query: PRESET.query});
    await focusShuttles(page, false);
    await expect(page.locator('.con-cardactions'), 'the reason names the shortfall').toContainText('Не хватает 1 M€', {timeout: 10_000});
    await shoot(page, 'C-blocked');
  });

  test('(D) Venus at 30 %: legal, named «no effect», the price is paid and the scale stays', async ({page, request}) => {
    test.setTimeout(300_000);
    const posts = watchPosts(page);
    const id = await bootFixture(page, request, 'venus-shuttles-max', {query: PRESET.query});
    await focusShuttles(page, true);
    await expect(page.locator(ACTION_COMPOSER), 'the verdict is named').toContainText('действие ничего не изменит');
    await shoot(page, 'D-futile');
    await commit(page, posts);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 20_000}).toBe(5);
    expect((await wireOf(request, id)).game.venusScaleLevel).toBe(30);
  });

  test('(E) the alternative board 16 → 18 %: the bonus is the action’s next stage (hosted — P89 · EE); the board tells the step after', async ({page, request}) => {
    test.setTimeout(300_000);
    const posts = watchPosts(page);
    const id = await bootFixture(page, request, 'venus-shuttles-alt16', {query: PRESET.query});
    await focusShuttles(page, true);
    await commit(page, posts);
    await expect(page.locator('.con-cardactions .con-venus[data-venus-bonus-embedded]'), 'the bonus stands INSIDE «ДЕЙСТВИЯ КАРТ»')
      .toBeVisible({timeout: 30_000});
    await expect(page.locator('.con-lanes.con-ws'), 'never a band of its own').toHaveCount(0);
    await shoot(page, 'E1-bonus');
    await press(page, 'Enter', 400);
    await expect.poll(async () => {
      await press(page, 'KeyX', 600);
      return (await wireOf(request, id)).waitingFor?.venusBonusPrompt;
    }, {timeout: 30_000, message: 'X collects the bonus'}).toBeUndefined();
    await expect(page.locator('.con-cardactions'), 'the workspace leaves').toHaveCount(0, {timeout: 30_000});
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('[data-scale-marker="venus"]')?.dataset.scaleMarkerAt ?? ''),
      {timeout: 30_000, message: 'the step’s story plays after — the marker rests on 18'}).toBe('18');
    await shoot(page, 'E2-collected');
  });

  test('(F) the play: the 2 floaters land on Dirigibles — the one Venus candidate; Jupiter Floating Station (no Venus tag) gets none', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-shuttles-play', {query: PRESET.query});
    type T = {thisPlayer: {tableau: Array<{name: string, resources?: number}>, megacredits: number}};
    const on = async (card: string) => ((await fetchPlayerModel(request, id)) as unknown as T).thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
    const before = {dirigibles: await on('Dirigibles'), station: await on('Jupiter Floating Station')};
    expect(await playCardFromHand(page, SHUTTLES), 'P89 played from the hand').toBe(true);
    await expect.poll(() => on('Dirigibles'), {timeout: 30_000, message: 'the floaters land on the one Venus holder'}).toBe(before.dirigibles + 2);
    expect(await on('Jupiter Floating Station'), 'no floater on the holder without a Venus tag').toBe(before.station);
    await shoot(page, 'F-play');
  });
});
