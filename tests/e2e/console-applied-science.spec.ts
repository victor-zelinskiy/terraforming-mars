import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, press, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P43 «ПРИКЛАДНАЯ НАУКА» — the set's first PRELUDE and the first card of the SHARED WILD-RESOURCE CHOICE
 * (docs/claude/prompts/prelude2-p43-applied-science.md, decisions 3 / 4; ledgers EN / EO):
 *
 *   A (`applied-science-holders`) — «ДЕЙСТВИЯ КАРТ» › P43 › НАСТРОЙКА: ONE printed row «[наука] −1 → ?», its door → the
 *     inner step: the OR's two plates; «на карту» → the slot's candidates (Birds, Dirigibles — never P43 itself;
 *     Tardigrades a near miss), no grid; B → the OR; «стандартный» → the 2 × 3 radio in the SAME slot (its height
 *     unchanged); A on steel → the step leaves, the row reads «+1»; ONE POST → steel +1, science 6 → 5, nothing asked.
 *   A′ (`applied-science-holders`) — «на карту» → Birds: ONE POST → Birds 1 → 2.
 *   B (`applied-science-none`) — «на карту» refused WITH its reason, the OR shown; the standard answer alone posts.
 *   C (`applied-science-sole`) — Birds seeded and marked «Единственная цель», still asked (A confirms).
 *   D (`applied-science-many`) — eight candidates in the slot; no scroll.
 *   E (`applied-science-last`) — the last science spent: the card leaves the actions to take (0 science on the server).
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P43. Storyboard: `TM_E2E_STORYBOARD=1` (frames in screenshots/wild-choice/).
 */

const CARD = 'Applied Science';
const CARD_RU = 'ПРИКЛАДНАЯ НАУКА';
const OUT = path.resolve('screenshots', 'wild-choice');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';
const ROW = `${STAGE} [data-wild-row]`;
const INNER = `${STAGE} [data-wild-inner]`;

type Wire = {
  thisPlayer: {steel: number, tableau: Array<{name: string, resources?: number}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const resourcesOf = (w: Wire, name: string) => w.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, 'after', PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `p43-${name}.png`)});
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, 'after', PRESET.id, `story-p43-${name}`);
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

async function commitOnce(page: Page, posts: Array<string>, before: number): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(before + 1);
}

const focusedTile = (page: Page) => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

/** «ДЕЙСТВИЯ КАРТ» › P43's ONE tile › НАСТРОЙКА. */
async function openSetup(page: Page): Promise<void> {
  await openCardActions(page);
  for (let i = 0; i < 4 && (await focusedTile(page)) === ''; i++) {
    await press(page, 'ArrowDown', 400);
  }
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === CARD, () => focusedTile(page), 30), `never focused ${CARD}`).toBeTruthy();
  expect(await page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`).count(), 'ONE tile for the ONE printed row').toBe(1);
  await openActionFocus(page);
  await settle(page);
}

const inner = (page: Page) => page.locator(INNER);
const zone = async (page: Page) => await inner(page).getAttribute('data-wild-focus-zone') ?? '';
const index = async (page: Page) => Number(await inner(page).getAttribute('data-wild-focus-index') ?? '0');

/** The cursor onto the wild row, A → the inner step. */
async function openWild(page: Page): Promise<void> {
  await expect(page.locator(ROW), 'ONE printed row for both branches').toHaveCount(1);
  for (let i = 0; i < 8 && await page.locator(`${ROW}.con-composer__row--focused`).count() === 0; i++) {
    await press(page, i < 4 ? 'ArrowUp' : 'ArrowDown', 250);
  }
  await press(page, 'Enter', 500);
  await expect(inner(page), 'the inner step opened').toHaveCount(1);
}

/** On the OR's row, the cursor onto plate `key`, A. */
async function choosePlate(page: Page, key: 'onCard' | 'asStandard'): Promise<void> {
  for (let i = 0; i < 4 && await zone(page) !== 'wild'; i++) {
    await press(page, 'ArrowUp', 220);
  }
  await press(page, key === 'onCard' ? 'ArrowLeft' : 'ArrowRight', 220);
  await press(page, 'Enter', 450);
}

async function toCommitRow(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  await expect(page.locator(`${STAGE} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

const slotBox = (page: Page) => page.locator(`${INNER} .con-wildstep__slot`).boundingBox();

test.describe(`P43 Applied Science · the shared wild-resource choice · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A: the printed row, the OR, the slot\'s two faces, steel by radio — ONE POST, nothing asked', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'applied-science-holders', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openSetup(page);
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, 'the crumb names the card').toContain(CARD_RU);
    await expect(page.locator(`${ROW} [data-wild-row-glyph]`), 'the printed «?» on the row').toHaveCount(1);
    await shoot(page, 'a-setup');

    await openWild(page);
    await expect(page.locator(`${INNER} [data-wild-option]`), 'two plates').toHaveCount(2);
    await expect(page.locator(`${INNER} [data-wild-face="lanes"]`), 'the grid is not shown before the plate').toHaveClass(/con-wildstep__face--off/);
    await shoot(page, 'b-or');
    const box0 = await slotBox(page);

    await choosePlate(page, 'onCard');
    expect(await zone(page), 'the cursor in the candidates').toBe('card');
    const offered = await page.evaluate(() => [...document.querySelectorAll('[data-wild-inner] [data-wild-card]')].map((el) => el.getAttribute('data-wild-card')));
    expect(offered, 'Birds and Dirigibles — never the card itself').toEqual(['Birds', 'Dirigibles']);
    await expect(page.locator(`${INNER} [data-wild-face="lanes"]`), 'no grid beside the candidates').toHaveClass(/con-wildstep__face--off/);
    const box1 = await slotBox(page);
    await shoot(page, 'c-on-card');

    await press(page, 'ArrowUp', 300);
    expect(await zone(page), 'up: back on the OR').toBe('wild');
    await choosePlate(page, 'asStandard');
    expect(await zone(page), 'the cursor on the grid').toBe('lane');
    await expect(page.locator(`${INNER} [data-wild-face="cards"]`), 'no candidates beside the grid').toHaveClass(/con-wildstep__face--off/);
    await expect(page.locator(`${INNER} [data-wild-dial-hint]`), 'a radio carries no dial').toHaveCount(0);
    const box2 = await slotBox(page);
    for (const b of [box1, box2]) {
      expect(Math.abs((b?.height ?? 0) - (box0?.height ?? 0)), 'the slot never changes height').toBeLessThanOrEqual(1);
    }
    await shoot(page, 'd-standard');
    // steel is lane 1: the cursor lands on lane 0 (M€) — one step right.
    for (let i = 0; i < 4 && await index(page) !== 1; i++) {
      await press(page, await index(page) > 1 ? 'ArrowLeft' : 'ArrowRight', 220);
    }
    await press(page, 'Enter', 500);
    await expect(inner(page), 'A on steel answered and left').toHaveCount(0);
    await expect(page.locator(`${ROW} [data-wild-row-answer="standard"]`), 'the row reads its answer').toHaveCount(1);
    await toCommitRow(page);
    await shoot(page, 'e-answered');
    expect(posts.length, 'nothing sent before the commit').toBe(0);

    await armTransferWitness(page);
    const stop = await storyboard(page, 'standard');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: 6 → 5 science'}).toBe(5);
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'f-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.steel - before.thisPlayer.steel, '+1 steel').toBe(1);
    expect(posts.length, 'ONE POST for the action').toBe(1);
    const witness = await transferWitness(page);
    console.log(`[p43] standard trail\n${transferTrail(witness)}`);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
  });

  test('A′: «на карту» → Birds — ONE POST, Birds 1 → 2', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'applied-science-holders', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await openWild(page);
    await choosePlate(page, 'onCard');
    for (let i = 0; i < 3 && await index(page) !== 0; i++) {
      await press(page, 'ArrowLeft', 220);
    }
    await press(page, 'Enter', 500);
    await expect(inner(page), 'A on Birds answered and left').toHaveCount(0);
    await expect(page.locator(`${ROW}[data-wild-answered] [data-wild-row-card="Birds"]`), 'the row reads «+1 · Птицы»').toHaveCount(1);
    await toCommitRow(page);
    const stop = await storyboard(page, 'on-card');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), 'Birds'), {timeout: 30_000, message: 'the server: Birds 1 → 2'}).toBe(2);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    expect(resourcesOf(await wireOf(request, id), CARD), 'science 6 → 5').toBe(5);
    expect(posts.length).toBe(1);
  });

  test('B: no holder — «на карту» refused with its reason, the OR shown; the standard answer alone posts', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'applied-science-none', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openSetup(page);
    await openWild(page);
    const onCard = page.locator(`${INNER} [data-wild-option="onCard"]`);
    await expect(onCard, 'the plate is SHOWN').toHaveCount(1);
    await expect(onCard, 'refused with its reason').toContainText('Нет карты с ресурсом');
    await shoot(page, 'g-none');
    await choosePlate(page, 'asStandard');
    for (let i = 0; i < 4 && await index(page) !== 1; i++) {
      await press(page, await index(page) > 1 ? 'ArrowLeft' : 'ArrowRight', 220);
    }
    await press(page, 'Enter', 500);
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.steel - before.thisPlayer.steel, {timeout: 30_000, message: '+1 steel'}).toBe(1);
    await settle(page, {timeoutMs: 40_000});
    expect(posts.length).toBe(1);
  });

  test('C: a sole holder is seeded and marked — still asked', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'applied-science-sole', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await openWild(page);
    await choosePlate(page, 'onCard');
    await expect(page.locator(`${INNER} [data-wild-card="Birds"][data-chosen]`), 'Birds seeded').toHaveCount(1);
    await expect(page.locator(`${INNER} .con-wildstep__sole`), '«Единственная цель»').toHaveCount(1);
    await expect(inner(page), 'the step still stands — the player confirms').toHaveCount(1);
    await shoot(page, 'h-sole');
    await press(page, 'Enter', 500);
    await expect(inner(page)).toHaveCount(0);
    expect(posts.length, 'nothing sent').toBe(0);
  });

  test('D: eight candidates — the slot holds them, no scroll', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'applied-science-many', {query: PRESET.query});
    await settle(page);
    await openSetup(page);
    await openWild(page);
    await choosePlate(page, 'onCard');
    await expect(page.locator(`${INNER} [data-wild-card]`), 'eight candidates').toHaveCount(8);
    const scrolls = await page.evaluate(() => {
      const vp = document.querySelector('.con-cardactions__stagewrap .con-composer--stage .con-scroll-area__viewport');
      return vp === null ? 0 : vp.scrollHeight - vp.clientHeight;
    });
    await shoot(page, 'i-many');
    expect(scrolls, 'the decision column does not scroll').toBeLessThanOrEqual(2);
  });

  test('E: the last science spent — the card leaves the actions to take', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'applied-science-last', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openSetup(page);
    await openWild(page);
    await choosePlate(page, 'asStandard');
    await press(page, 'Enter', 500);
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000}).toBe(0);
    await settle(page, {timeoutMs: 40_000});
    // The browse grid files the card under «Активированы» (one action a generation) — the «0 of 1 science» refusal
    // for the next generation is the server's (AppliedScience.spec § the last science spent).
    await openCardActions(page);
    await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'no longer among the actions to take').toHaveCount(0);
  });
});
