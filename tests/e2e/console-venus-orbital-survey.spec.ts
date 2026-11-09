import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, press, reloadConsole, settle, walkFocusUntil,
} from './consoleStart';

/**
 * P88 «ОРБИТАЛЬНАЯ РАЗВЕДКА ВЕНЕРЫ» — THE SPLIT REVEAL (docs/claude/prompts/prelude2-p88-venus-orbital-survey.md,
 * decisions 2–4): «reveal the top 2; Venus cards to the hand for free; buy or discard the rest».
 *
 *   (A) `-mixed` — НАСТРОЙКА reads the split (2 off the deck · Venus free · the rest for 3 M€), A → ONE POST, the
 *       embedded purchase stage holds BOTH revealed cards in deck order: the Venus card a never-pickable companion
 *       with its verdict, the other an ordinary buy; the crumb's tail only moves forward; B collapses and A restores
 *       the same stage with no request; A·RT buys → ONE POST, +2 in the hand, 10 → 7 M€, nothing discarded.
 *   (A′) `-mixed` — RT with nothing picked: the companion home, the other on the table's ONE discard pile.
 *   (B) `-venus` — no question: the drawn batch of two, taken on the stage; no POST beyond the action's.
 *   (C) `-none` — two offered, both bought: 10 → 4 M€, +2.
 *   (D) `-poor` — `max 0`: the purchase stage still stands (by the marker), the other card marked «В сброс» with
 *       the price that stops it, RT «ОК» → ONE POST, the companion home, the other discarded.
 *   (E) `-helion` — the purchase owes a live payment (heat accepted): RT opens it as the purchase's own stage in the SAME
 *       workspace («› ОПЛАТА»), B is one level back, A pays both prompts in ONE batch (PL-1411).
 *   (G) `-mixed` — a reload mid-purchase rebuilds the same stage: two slots, the companion once.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P88 (dry runs prove the marker and the hands).
 * Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Venus Orbital Survey';
const CARD_RU = 'ОРБИТАЛЬНАЯ РАЗВЕДКА ВЕНЕРЫ';
const VENUS = 'Venus Waystation';
const OTHER = 'Research';
const OUT = path.resolve('screenshots', 'venus-orbital-survey');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const HOST = '[data-embed-slot="workspace-reveal"] .con-task-host--embedded';

type Wire = {thisPlayer: {megacredits: number, cardsInHandNbr?: number}, cardsInHand?: Array<{name: string}>};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const handNames = (w: Wire) => (w.cardsInHand ?? []).map((c) => c.name);

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

/** `key` → ONE more POST (retried only while none went out). */
async function commitOnce(page: Page, posts: Array<string>, before: number, key = 'Enter'): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, key, 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(before + 1);
}

const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

/** «ДЕЙСТВИЯ КАРТ» › P88 focused › НАСТРОЙКА. */
async function openSurvey(page: Page): Promise<void> {
  await openCardActions(page);
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === CARD, () => focusedTile(page), 30), `never focused ${CARD}`).toBeTruthy();
  await openActionFocus(page);
  await settle(page);
}

/** The purchase stage's row, in DOM (= reveal) order: the card names and which are companions. */
const stageRow = (page: Page) => page.evaluate((sel) => [...document.querySelectorAll(`${sel} .con-cards__strip > .con-cards__slot`)]
  .map((el) => ({name: el.getAttribute('data-zoom-slot') ?? '', companion: el.hasAttribute('data-companion-slot')})), HOST);

async function confirmToStage(page: Page, posts: Array<string>): Promise<void> {
  await expect(page.locator('.con-composer__cta--ready'), 'the commit is armed').toBeVisible({timeout: 15_000});
  const logs: Array<string> = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error' || /\[(workspace|liveness|wait-graph|screen-shadow)/.test(m.text())) {
      logs.push(`${m.type()} ${m.text().slice(0, 400)}`);
    }
  });
  await commitOnce(page, posts, 0);
  const embedded = await expect(page.locator(HOST)).toHaveCount(1, {timeout: 30_000}).then(() => true, () => false);
  if (!embedded) {
    // THE DIAGNOSIS FIRST (CI 2026-11-09, the max-0 stall): which gate held the claimed stage out of its zone.
    const diag = await page.evaluate(() => ({
      ready: (window as unknown as {__conReady?: () => unknown}).__conReady?.(),
      zones: [...document.querySelectorAll('[data-embed-slot]')].map((el) => el.getAttribute('data-embed-slot')),
      hosts: [...document.querySelectorAll('.con-task-host')].map((el) => el.className),
      wf: document.querySelector('.con-cardactions')?.className ?? '',
    }));
    console.log('── the purchase never embedded ──\n' + JSON.stringify(diag, null, 1) + '\n── console ──\n' + logs.join('\n'));
  }
  expect(embedded, 'the purchase is EMBEDDED in the workspace').toBe(true);
  expect(await page.locator('.con-task-host:not(.con-task-host--embedded)').count(), 'never a standalone band').toBe(0);
  await settle(page, {timeoutMs: 40_000});
}

test.describe(`P88 Venus Orbital Survey · the split reveal · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('(A) mixed: the setup reads the split, ONE stage with both cards in deck order, B/A restore, buy → +2, 10 → 7 M€', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'venus-orbital-survey-mixed', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSurvey(page);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb: the workspace › the card › НАСТРОЙКА'})
      .toMatch(new RegExp(`${CARD_RU}.*НАСТРОЙКА`));
    // THE SPLIT, read off the server's descriptor: what leaves the deck and where each kind goes.
    const rows = page.locator('[data-reveal-split]');
    await expect(rows, 'three rows: the deal · the match · the miss').toHaveCount(3);
    await expect(page.locator('[data-reveal-split="deal"]')).toContainText('2');
    await expect(page.locator('[data-reveal-split="match"]')).toContainText('Карты Венеры');
    await expect(page.locator('[data-reveal-split="miss"]')).toContainText('3 M€');
    await expect(page.locator('[data-reveal-split="miss"]')).toContainText('Хватит на 2');
    await shoot(page, 'a1-setup');

    const stop = await storyboard(page, 'mixed');
    await confirmToStage(page, posts);
    await stop();
    expect(await stageRow(page), 'both revealed cards, in the order the deck turned them over').toEqual([
      {name: VENUS, companion: true},
      {name: OTHER, companion: false},
    ]);
    await expect(page.locator(`${HOST} [data-companion-verdict]`), 'the companion\'s verdict, in words').toContainText('Карта Венеры — в руку бесплатно');
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the same flow, the tail moved forward'})
      .toMatch(new RegExp(`${CARD_RU}.*ПОКУПКА`));
    await shoot(page, 'a2-stage');

    // B collapses (the decision stays live), A restores the SAME stage — no request.
    await press(page, 'Escape', 900);
    await expect(page.locator('.con-mandatory'), 'the collapsed decision on the board').toHaveCount(1, {timeout: 15_000});
    await press(page, 'Enter', 1400);
    await expect(page.locator(HOST)).toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 40_000});
    expect(await stageRow(page), 'the same two slots after the restore').toHaveLength(2);
    expect(posts.length, 'the restore asked the server nothing').toBe(1);

    // A on the offered card picks it (the companion is never a stop), RT buys.
    await press(page, 'Enter', 500);
    await expect(page.locator(`${HOST} .con-cards__slot--picked[data-zoom-slot="${OTHER}"]`), 'the offered card picked').toHaveCount(1);
    await expect(page.locator(`${HOST} .con-cards__slot--picked[data-companion-slot]`), 'a companion is never picked').toHaveCount(0);
    await shoot(page, 'a3-picked');
    await commitOnce(page, posts, 1, 'Period');
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, '10 → 7 M€').toBe(7);
    expect(handNames(after), 'both cards in the hand').toEqual(expect.arrayContaining([VENUS, OTHER]));
    await shoot(page, 'a4-after');
  });

  test('(A′) mixed, nothing bought: the companion home, the other on the ONE discard pile', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-orbital-survey-mixed', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSurvey(page);
    await confirmToStage(page, posts);
    // The refused card is SEEN leaving onto the table's ONE discard pile and the pile COUNTS it (PL-1410 — it used to
    // read «0» under the card that had just landed): a sampler armed BEFORE the press records the discard flight and
    // every count the pile shows while it stands.
    await page.evaluate(() => {
      const w = window as unknown as {__p88Discard: number, __p88Pile: Array<number>};
      w.__p88Discard = 0;
      w.__p88Pile = [];
      const t = window.setInterval(() => {
        w.__p88Discard += document.querySelectorAll('.con-discard-proxy').length;
        const pile = document.querySelector('[data-discard-pile-count]');
        if (pile !== null) {
          w.__p88Pile.push(Number(pile.getAttribute('data-discard-pile-count') ?? '0'));
        }
      }, 30);
      window.setTimeout(() => window.clearInterval(t), 15_000);
    });
    await commitOnce(page, posts, 1, 'Period');
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, 'nothing paid').toBe(10);
    expect(handNames(after)).toContain(VENUS);
    expect(handNames(after)).not.toContain(OTHER);
    const seen = await page.evaluate(() => {
      const w = window as unknown as {__p88Discard: number, __p88Pile: Array<number>};
      return {__p88Discard: w.__p88Discard, __p88Pile: w.__p88Pile};
    });
    expect(seen.__p88Discard, 'the unbought card flew to the discard').toBeGreaterThan(0);
    expect(seen.__p88Pile.length, 'the ONE discard pile stood for it').toBeGreaterThan(0);
    expect(Math.max(...seen.__p88Pile) - seen.__p88Pile[0],
      `the pile COUNTED the refused card (counts ${[...new Set(seen.__p88Pile)].join(' → ')})`).toBe(1);
  });

  test('(B) two Venus cards: no question — one drawn batch, taken in place', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-orbital-survey-venus', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSurvey(page);
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
    await commitOnce(page, posts, 0);
    await expect.poll(async () => handNames(await wireOf(request, id)).length, {timeout: 30_000, message: 'both in the hand on the server'})
      .toBeGreaterThanOrEqual(2);
    // Take the batch on its stage (A / RT — whichever the stage offers), then nothing is left standing.
    for (let i = 0; i < 6 && await page.locator('.con-cardactions').count() > 0; i++) {
      await press(page, i % 2 === 0 ? 'Period' : 'Enter', 900);
    }
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    expect(posts.length, 'ONE POST for the action — nothing was asked after it').toBe(1);
    expect((await wireOf(request, id)).thisPlayer.megacredits, 'nothing paid').toBe(10);
  });

  test('(C) two non-Venus cards: both bought — 10 → 4 M€, +2', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-orbital-survey-none', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSurvey(page);
    await confirmToStage(page, posts);
    expect((await stageRow(page)).filter((s) => s.companion), 'no companion').toHaveLength(0);
    await press(page, 'Enter', 500);
    await press(page, 'ArrowRight', 400);
    await press(page, 'Enter', 500);
    await expect(page.locator(`${HOST} .con-cards__slot--picked`)).toHaveCount(2);
    await commitOnce(page, posts, 1, 'Period');
    await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits).toBe(4);
    expect(handNames(after)).toEqual(expect.arrayContaining(['Research', 'Asteroid']));
  });

  test('(D) cannot afford (max 0): the purchase stage by its marker, «В сброс» named, RT «ОК» → ONE POST', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-orbital-survey-poor', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSurvey(page);
    await confirmToStage(page, posts);
    expect(await stageRow(page)).toEqual([{name: VENUS, companion: true}, {name: OTHER, companion: false}]);
    await expect(page.locator(`${HOST} [data-buy-verdict="discard"]`), 'the other card is marked for the discard').toHaveCount(1);
    await expect(page.locator(`${HOST} [data-buy-verdict-reason]`), 'with the price that stops it').toContainText('3 за карту');
    await shoot(page, 'd-poor');
    await press(page, 'Enter', 500);
    await expect(page.locator(`${HOST} .con-cards__slot--picked`), 'nothing is choosable').toHaveCount(0);
    await commitOnce(page, posts, 1, 'Period');
    await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits).toBe(2);
    expect(handNames(after)).toContain(VENUS);
    expect(handNames(after)).not.toContain(OTHER);
  });

  // PICK-THEN-PAY IS ONE DECISION (PL-1411): Helion's heat makes the server ASK the price — the payment is the
  // purchase's own second stage in the SAME workspace, beside the cards being bought; B is one level back; A pays both
  // prompts in ONE batch, and the cards leave in one intake. It used to rise as a band of its own over the board.
  test('(E) Helion: RT carries the picks into «› ОПЛАТА» in the same workspace; B back; A pays — ONE batch, both cards home', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-orbital-survey-helion', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id) as Wire & {thisPlayer: {heat: number}};
    const posts = watchPosts(page);
    await openSurvey(page);
    await confirmToStage(page, posts);
    await press(page, 'Enter', 500);
    await expect(page.locator(`${HOST} .con-cards__slot--picked[data-zoom-slot="${OTHER}"]`)).toHaveCount(1);
    // RT: the payment opens INSIDE the purchase — nothing is sent.
    await press(page, 'Period', 900);
    const pay = page.locator(`${HOST} [data-buy-pay]`);
    await expect(pay, 'the payment stands in the same stage').toHaveCount(1, {timeout: 10_000});
    expect(posts.length, 'RT sent nothing — the purchase and its payment are ONE decision').toBe(1);
    expect(await page.locator('.con-task-host:not(.con-task-host--embedded)').count(), 'never a band of its own').toBe(0);
    await expect(page.locator('.con-cardactions'), 'the workspace stands').toHaveCount(1);
    expect(await stageRow(page), 'the cards being bought stay on the stage').toEqual([{name: VENUS, companion: true}, {name: OTHER, companion: false}]);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the card stays in the crumb, the tail moved forward to the payment'})
      .toMatch(new RegExp(`${CARD_RU}.*ОПЛАТА`));
    await expect(pay.locator('.con-payrow[data-pay-unit="heat"]'), 'heat is a lane').toBeVisible();
    await shoot(page, 'e-helion-pay-stage');
    // B: one level back to the picks — the pick survives, nothing sent.
    await press(page, 'Escape', 900);
    await expect(pay).toHaveCount(0);
    await expect(page.locator(`${HOST} .con-cards__slot--picked[data-zoom-slot="${OTHER}"]`), 'the pick survives B').toHaveCount(1);
    expect(posts.length).toBe(1);
    await press(page, 'Period', 900);
    await expect(pay).toHaveCount(1, {timeout: 10_000});
    // A pays: ONE more POST — the batch answering the purchase and its payment.
    await commitOnce(page, posts, 1, 'Enter');
    expect(posts[1], 'one batch: the card pick and the payment').toContain('"payment"');
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id) as Wire & {thisPlayer: {heat: number}};
    expect(handNames(after), 'both cards in the hand').toEqual(expect.arrayContaining([VENUS, OTHER]));
    expect((before.thisPlayer.megacredits + before.thisPlayer.heat) - (after.thisPlayer.megacredits + after.thisPlayer.heat),
      '3 M€ worth paid (M€ + heat)').toBe(3);
    expect(await page.locator('.con-task-host').count(), 'nothing left asking').toBe(0);
    expect(posts.length, 'two POSTs in all: the action, the purchase with its payment').toBe(2);
  });

  test('(G) a reload mid-purchase rebuilds the same stage — the companion once', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'venus-orbital-survey-mixed', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSurvey(page);
    await confirmToStage(page, posts);
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000});
    // After a reload the decision is presented on the board (a restore card) or straight in the stage.
    if (await page.locator(HOST).count() === 0) {
      await press(page, 'Enter', 1500);
    }
    await expect(page.locator('.con-task-host'), 'the purchase is back').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 40_000});
    const row = await page.evaluate(() => [...document.querySelectorAll('.con-task-host .con-cards__strip > .con-cards__slot')]
      .map((el) => el.getAttribute('data-zoom-slot') ?? ''));
    expect(row.filter((n) => n === VENUS), 'the companion stands once').toHaveLength(1);
    expect(row, 'both revealed cards').toEqual(expect.arrayContaining([VENUS, OTHER]));
  });
});
