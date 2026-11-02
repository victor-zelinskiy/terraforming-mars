import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, placeTile, press, reloadConsole, settle, walkFocusUntil,
} from './consoleStart';

/**
 * P45 «СОВЕТ ДИРЕКТОРОВ» — the VERDICT AFTER THE REVEAL inside «ДЕЙСТВИЯ КАРТ» (docs/claude/prompts/
 * prelude2-p45-board-of-directors.md, ledger ET):
 *
 *   B (`-loan`)    — НАСТРОЙКА reads the deck, the decision and the money; A → ONE prelude off the prelude deck object in
 *                    the action's own zone, the crumb «… › ВЕРДИКТ», two outcome rows with chips; A on «РАЗЫГРАТЬ» →
 *                    ONE POST (`card [Loan]`) → the price first, the hero on the seat; the server: 40 − 12 + 30 = 58 M€,
 *                    3 directors, Loan on the table; the flow LEAVES (never back to the list); no band of its own.
 *   C (`-loan`)    — A on «В СБРОС» → ONE POST (`card []`), Loan in the prelude discard pile, nothing paid.
 *   D (`-poor`)    — 7 M€: «РАЗЫГРАТЬ» refused «не хватает 5 M€», «В СБРОС» the sole outcome — marked, still PRESSED.
 *   E (`-burn`)    — the play row says it burns; A → 40 − 12 + 15 = 43 M€, 3 directors, Loan in the discard pile.
 *   F (`-variant`) — «РАЗЫГРАТЬ» on Atmospheric Enhancers opens «ВАРИАНТ» (the THIRD host), B back to the verdict with
 *                    nothing sent, A on a row → ONE POST (the pick + the addressed `or`).
 *   G (`-tile`)    — Early Settlement: the workspace yields to the board for the city; the hand never mounts.
 *   H (`-loan`)    — a reload on the verdict: the same card, both rows, no second deal.
 *   I (`-last` / `-empty`) — the last director spent / the deck empty: the tile refused WITH its reason.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P45. Storyboard: `TM_E2E_STORYBOARD=1` (frames in screenshots/p45/).
 */

const CARD = 'Board of Directors';
const CARD_RU = 'СОВЕТ ДИРЕКТОРОВ';
const OUT = path.resolve('screenshots', 'p45');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PICK = '.con-cardactions .con-deckpick--play';
const VERDICT = `${PICK} [data-deckpick-verdict]`;
const row = (key: 'play' | 'discard') => `${VERDICT} [data-verdict-row="${key}"]`;

type Wire = {
  thisPlayer: {megacredits: number, tableau: Array<{name: string, resources?: number}>},
  game: {preludeDeckSize?: number, preludeDiscardSize?: number},
  waitingFor?: {type?: string, deckPickPrompt?: unknown},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const onTable = (w: Wire, name: string) => w.thisPlayer.tableau.some((c) => c.name === name);
const directors = (w: Wire) => w.thisPlayer.tableau.find((c) => c.name === CARD)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `p45-${name}.png`)});
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

/** Press A until exactly one more POST is out (a swallowed press retried; a second POST is a defect). */
async function commitOnce(page: Page, posts: Array<string>, before: number, why: string): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 4_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, `ONE POST — ${why}`).toBe(before + 1);
}

const focusedTile = (page: Page) => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

/** «ДЕЙСТВИЯ КАРТ» › P45 › НАСТРОЙКА. */
async function openSetup(page: Page): Promise<void> {
  await openCardActions(page);
  for (let i = 0; i < 4 && (await focusedTile(page)) === ''; i++) {
    await press(page, 'ArrowDown', 400);
  }
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === CARD, () => focusedTile(page), 30), `never focused ${CARD}`).toBeTruthy();
  await openActionFocus(page);
  await settle(page);
}

/** The setup's A → the action's POST → the verdict stands in the zone, the deal landed. */
async function drawToVerdict(page: Page, posts: Array<string>): Promise<void> {
  await expect(page.locator('[data-reveal-split="deal"]'), 'НАСТРОЙКА reads the draw off the prelude deck').toHaveCount(1);
  await expect(page.locator('[data-reveal-split="decide"]'), '…and the decision after the reveal').toHaveCount(1);
  await commitOnce(page, posts, posts.length, 'the action');
  await expect(page.locator(VERDICT), 'the verdict stands INSIDE «ДЕЙСТВИЯ КАРТ»').toHaveCount(1, {timeout: 40_000});
  await expect(page.locator(`${PICK}[data-flow="choosing"]`), 'the deal has landed').toHaveCount(1, {timeout: 30_000});
}

/** The verdict's cursor onto `key`. */
async function focusRow(page: Page, key: 'play' | 'discard'): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`${row(key)}.con-deckpick__vrow--focused`).count() === 0; i++) {
    await press(page, key === 'play' ? 'ArrowLeft' : 'ArrowRight', 260);
  }
  await expect(page.locator(`${row(key)}.con-deckpick__vrow--focused`), `the cursor on «${key}»`).toHaveCount(1);
}

test.describe(`P45 Board of Directors · the verdict after the reveal · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('B: draw → «ВЕРДИКТ» in the action\'s zone → A on «РАЗЫГРАТЬ» — ONE POST, the price, Loan on the table, the flow leaves', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'board-of-directors-loan', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openSetup(page);
    await shoot(page, 'b-setup');
    const stop = await storyboard(page, 'play');
    await drawToVerdict(page, posts);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb: ДЕЙСТВИЯ КАРТ › СОВЕТ ДИРЕКТОРОВ › ВЕРДИКТ'}).toMatch(new RegExp(`${CARD_RU}.*ВЕРДИКТ`));
    await expect(page.locator(`${PICK} [data-deckpick-slot="Loan"]`), 'ONE prelude drawn — Loan').toHaveCount(1);
    await expect(page.locator(`${row('play')}[data-verdict-available="true"]`), 'the play is open').toHaveCount(1);
    await expect(page.locator(`${row('play')} [data-verdict-chip="megacredits"]`), 'M€ 40 → 28').toContainText('40 → 28');
    await expect(page.locator(`${row('play')} [data-verdict-chip="card-resource"]`), 'directors 4 → 3').toContainText('4 → 3');
    await expect(page.locator(`${row('discard')}[data-verdict-sole]`), 'the discard is not the sole outcome here').toHaveCount(0);
    await expect(page.locator('.con-decision'), 'no decision band').toHaveCount(0);
    await expect(page.locator('.con-deckpick'), 'ONE deck pick — inside the action, never a band of its own').toHaveCount(1);
    await shoot(page, 'b-verdict');

    await focusRow(page, 'play');
    await commitOnce(page, posts, posts.length, 'the verdict');
    expect(posts[posts.length - 1], 'the body: the pick').toContain('Loan');
    await expect.poll(async () => onTable(await wireOf(request, id), 'Loan'), {timeout: 30_000, message: 'Loan played'}).toBe(true);
    await expect(page.locator('.con-cardactions'), 'the flow LEAVES — never back to the list').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'b-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, '−12 + 30').toBe(18);
    expect(directors(after), 'directors 4 → 3').toBe(3);
    expect(posts.length, 'two POSTs in all: the action, the verdict').toBe(2);
  });

  test('C: A on «В СБРОС» — ONE POST with no card, Loan to the prelude discard pile, nothing paid', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'board-of-directors-loan', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openSetup(page);
    await drawToVerdict(page, posts);
    await focusRow(page, 'discard');
    await commitOnce(page, posts, posts.length, 'the discard');
    await expect.poll(async () => (await wireOf(request, id)).game.preludeDiscardSize, {timeout: 30_000, message: 'Loan in the prelude discard pile'})
      .toBe((before.game.preludeDiscardSize ?? 0) + 1);
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, 'nothing paid').toBe(before.thisPlayer.megacredits);
    expect(directors(after), 'no director spent').toBe(4);
    expect(onTable(after, 'Loan')).toBe(false);
  });

  test('D: 7 M€ — the play refused WITH its magnitude, the discard the sole outcome, marked and still pressed', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'board-of-directors-poor', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await expect(page.locator('[data-reveal-split="money"]'), 'НАСТРОЙКА says only the discard is open').toContainText('5');
    await drawToVerdict(page, posts);
    await expect(page.locator(`${row('play')}[data-verdict-available="false"] [data-verdict-reason]`), 'the refusal names 5 M€').toContainText('5');
    await expect(page.locator(`${row('discard')}[data-verdict-sole="true"] [data-verdict-sole-mark]`), 'the sole outcome is marked').toHaveCount(1);
    await expect(page.locator(`${row('discard')}.con-deckpick__vrow--focused`), 'the cursor opens on the one outcome there is').toHaveCount(1);
    await shoot(page, 'd-poor');
    const n = posts.length;
    await expect.poll(() => posts.length, {timeout: 1_500}).toBeGreaterThan(n).catch(() => undefined);
    expect(posts.length, 'no auto-answer').toBe(n);
    await commitOnce(page, posts, n, 'the sole outcome, pressed');
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.deckPickPrompt === undefined, {timeout: 30_000}).toBe(true);
    expect(directors(await wireOf(request, id))).toBe(4);
  });

  test('E: the play burns — said on the row; the price paid, +15 from the card, Loan to the discard', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'board-of-directors-burn', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openSetup(page);
    await drawToVerdict(page, posts);
    await expect(page.locator(`${row('play')}.con-deckpick__vrow--burns`), 'the row says it burns').toHaveCount(1);
    await expect(page.locator(`${row('play')} [data-verdict-chip="megacredits"]`), 'honest: 40 → 43').toContainText('40 → 43');
    await shoot(page, 'e-burn');
    await focusRow(page, 'play');
    await commitOnce(page, posts, posts.length, 'the burn');
    await expect.poll(async () => directors(await wireOf(request, id)), {timeout: 30_000, message: 'the director spent'}).toBe(3);
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, '−12 + 15').toBe(3);
    expect(onTable(after, 'Loan')).toBe(false);
  });

  test('F: «РАЗЫГРАТЬ» on Atmospheric Enhancers opens «ВАРИАНТ» — B back with nothing sent, A on a row → ONE POST', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'board-of-directors-variant', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await drawToVerdict(page, posts);
    await focusRow(page, 'play');
    const n = posts.length;
    await press(page, 'Enter', 500);
    await expect(page.locator(`${PICK} [data-deckpick-variant]`), 'the «ВАРИАНТ» step — its third host').toHaveCount(1);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: '… › ВАРИАНТ'}).toMatch(/ВАРИАНТ/);
    await shoot(page, 'f-variant');
    await press(page, 'Escape', 400);
    await expect(page.locator(`${PICK} [data-deckpick-variant]`), 'B: back to the verdict').toHaveCount(0);
    expect(posts.length, 'nothing sent').toBe(n);
    await press(page, 'Enter', 500);
    await expect(page.locator(`${PICK} [data-deckpick-variant]`)).toHaveCount(1);
    await commitOnce(page, posts, n, 'the variant row');
    expect(posts[posts.length - 1], 'the pick and the addressed `or` in one body').toMatch(/Atmospheric Enhancers[\s\S]*"or"/);
    await expect.poll(async () => onTable(await wireOf(request, id), 'Atmospheric Enhancers'), {timeout: 30_000}).toBe(true);
  });

  test('G: Early Settlement — the city on the board, the hand never mounts', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'board-of-directors-tile', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await drawToVerdict(page, posts);
    await focusRow(page, 'play');
    await commitOnce(page, posts, posts.length, 'the play');
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 30_000, message: 'the city asked'}).toBe('space');
    // The hero lands on the seat first; then the workspace YIELDS to the board (the chain's host steps aside).
    await expect(page.locator('.con-board--placing'), 'the city is placed on the board').toHaveCount(1, {timeout: 40_000});
    await expect(page.locator('.con-hand'), 'the hand is not the host').toHaveCount(0);
    await shoot(page, 'g-placing');
    expect(await placeTile(page), 'the city placed').toBeTruthy();
    await expect.poll(async () => onTable(await wireOf(request, id), 'Early Settlement'), {timeout: 30_000}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
  });

  test('H: a reload on the verdict — the same prelude, both rows, no second deal', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'board-of-directors-loan', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await drawToVerdict(page, posts);
    const deck = (await wireOf(request, id)).game.preludeDeckSize;
    await reloadConsole(page);
    await settle(page);
    await expect(page.locator('.con-deckpick--play [data-deckpick-slot="Loan"]'), 'the same prelude').toHaveCount(1, {timeout: 40_000});
    await expect(page.locator('.con-deckpick--play [data-verdict-row]'), 'both rows').toHaveCount(2);
    expect((await wireOf(request, id)).game.preludeDeckSize, 'no second draw').toBe(deck);
    await shoot(page, 'h-reload');
  });

  for (const [fixture, reason] of [['board-of-directors-empty', 'Колода прологов пуста']] as const) {
    test(`I: ${fixture} — the tile refused WITH its reason`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixture(page, request, fixture, {query: PRESET.query});
      await settle(page);
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'the tile is listed').toHaveCount(1);
      await expect(page.locator('.con-cardactions'), 'the reason is said').toContainText(reason);
    });
  }

  // The «0 из 1 директора» reason itself is unit-pinned (BoardOfDirectors.spec): this generation the tile reads «used»,
  // which outranks it — the stand proves the last director leaves the card and the flow ends on the board.
  test('I′: the last director spent — 0 on the card, the flow leaves', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'board-of-directors-last', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await drawToVerdict(page, posts);
    await focusRow(page, 'play');
    await commitOnce(page, posts, posts.length, 'the play');
    await expect.poll(async () => directors(await wireOf(request, id)), {timeout: 30_000}).toBe(0);
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
  });
});
