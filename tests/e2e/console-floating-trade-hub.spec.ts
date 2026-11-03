import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, press, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P49 «ОБЛАЧНЫЙ ТОРГОВЫЙ УЗЕЛ» — the first card of the set with a VARIABLE X: «put 2 floaters on ANY card, OR remove X
 * floaters here to gain X of ONE standard resource» (docs/claude/prompts/prelude2-p49-floating-trade-hub.md, ledger FA):
 *
 *   B (`floating-trade-hub-holders`) — the «add» row: the target step over Dirigibles, Aerial Mappers AND the hub itself
 *     («ANY card» — the hub is the hero's own handle, never hidden, never a duplicate); Dirigibles → ONE POST → 2 → 4.
 *   D (`floating-trade-hub-holders`) — the «remove» row: the dial X = 4 by default, LB → 3; the «?» row opens the SHARED
 *     wild-resource step as a radio whose every lane reads «+3»; plants → ONE POST (`or 1` + `amount 3` + the addressed
 *     resource) → plants +3, the hub 4 → 1; the price leaves the capsule FIRST, the result after (the witness).
 *   C (`floating-trade-hub-sole`) — the hub is the ONLY floater card: the target seeded and marked, A confirms → 4 → 6.
 *   E (`floating-trade-hub-empty`) — 0 floaters: the «remove» row SHOWN refused with its reason; «add» → 0 → 2.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P49. Storyboard: `TM_E2E_STORYBOARD=1` (frames in screenshots/p49/).
 */

const CARD = 'Floating Trade Hub';
const CARD_RU = 'ОБЛАЧНЫЙ ТОРГОВЫЙ УЗЕЛ';
const ADD = 0;
const REMOVE = 1;
const OUT = path.resolve('screenshots', 'p49');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';
const ROW = `${STAGE} [data-wild-row]`;
const INNER = `${STAGE} [data-wild-inner]`;

type Wire = {thisPlayer: {plants: number, tableau: Array<{name: string, resources?: number}>}};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const resourcesOf = (w: Wire, name: string) => w.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `p49-${name}.png`)});
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

async function commitOnce(page: Page, posts: Array<string>, before: number): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(before + 1);
}

const focusedTile = (page: Page) => page.evaluate(() => {
  const f = document.querySelector('.con-cardactions__tile--focused');
  if (f === null) {
    return '';
  }
  const card = f.getAttribute('data-action-card') ?? '';
  const tiles = [...document.querySelectorAll(`.con-cardactions__tile[data-action-card="${card}"]`)];
  return `${card}#${tiles.indexOf(f)}`;
});

/** «ДЕЙСТВИЯ КАРТ» › the hub's `variant` tile › its configuration stage. */
async function openVariant(page: Page, variant: number): Promise<void> {
  await openCardActions(page);
  const want = `${CARD}#${variant}`;
  for (let i = 0; i < 4 && !(await focusedTile(page)).startsWith(CARD); i++) {
    await press(page, 'ArrowDown', 400);
  }
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === want, () => focusedTile(page), 30), `never focused ${want}`).toBeTruthy();
  await openActionFocus(page);
  await settle(page);
}

async function toCommitRow(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  await expect(page.locator(`${STAGE} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

/** The target step's focused candidate (the card's name, or 'self' for the hero's own handle). */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

test.describe(`P49 Floating Trade Hub · the dial and the wild resource after it · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('B · «add»: the target step over the holders AND the hub itself; Dirigibles → ONE POST, 2 → 4', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'floating-trade-hub-holders', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openVariant(page, ADD);
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, 'the crumb: the workspace › the card › the stage').toContain(CARD_RU);
    expect(crumb).toContain('НАСТРОЙКА');
    await shoot(page, 'b-setup');
    const row = page.locator(`${STAGE} .con-composer__row--missing`);
    await expect(row, 'one unanswered target row (three candidates — a real choice)').toHaveCount(1);
    for (let i = 0; i < 6 && await page.locator(`${STAGE} .con-composer__row--focused.con-composer__row--missing`).count() === 0; i++) {
      await press(page, 'ArrowUp', 250);
    }
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-ptsel'), 'the target step opened').toBeVisible();
    const offered = await page.evaluate(() => [...document.querySelectorAll('.con-ptsel__cell')]
      .filter((cell) => cell.querySelector('[data-ptsel-blocked]') === null)
      .map((cell) => cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '')));
    expect(offered, 'Dirigibles and Aerial Mappers').toEqual(expect.arrayContaining(['Dirigibles', 'Aerial Mappers']));
    expect(offered.filter((n) => n === 'self' || n === CARD).length, '«ANY card» — the hub itself, ONCE').toBe(1);
    expect(offered, 'Tardigrades hold no floater').not.toContain('Tardigrades');
    for (const key of ['ArrowRight', 'ArrowLeft']) {
      for (let i = 0; i < 6 && await focusedCandidate(page) !== 'Dirigibles'; i++) {
        await press(page, key, 220);
      }
    }
    expect(await focusedCandidate(page), 'the cursor on Dirigibles').toBe('Dirigibles');
    await shoot(page, 'b-targets');
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
    await toCommitRow(page);
    expect(posts.length, 'nothing sent before the commit').toBe(0);
    const stop = await storyboard(page, 'add');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), 'Dirigibles'), {timeout: 30_000, message: 'the server: Dirigibles 2 → 4'}).toBe(4);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    const after = await wireOf(request, id);
    expect(resourcesOf(after, CARD), 'the hub untouched').toBe(4);
    expect(posts.length, 'ONE POST').toBe(1);
    await shoot(page, 'b-after');
  });

  test('D · «remove»: the dial X (LB → 3) prices the shared wild step «+3»; plants → ONE POST, +3 plants, the hub 4 → 1', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'floating-trade-hub-holders', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openVariant(page, REMOVE);
    await expect(page.locator(ROW), 'the «?» row stands under the dial').toHaveCount(1);
    await expect(page.locator(ROW), 'unanswered').not.toHaveAttribute('data-wild-answered', '');
    await shoot(page, 'd-setup');
    // The dial is the stage's ONE dial — focus-free, LB/RB drive it: 4 (all, by default) → 3.
    await press(page, 'KeyQ', 400);
    // The «?» row → A → the inner step: the six as a RADIO, every lane «+3».
    for (let i = 0; i < 8 && await page.locator(`${ROW}.con-composer__row--focused`).count() === 0; i++) {
      await press(page, i < 4 ? 'ArrowUp' : 'ArrowDown', 250);
    }
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER), 'the inner step opened').toHaveCount(1);
    await expect(page.locator(`${INNER} [data-wild-or]`), 'no OR — the branch already said «a standard resource»').toHaveCount(0);
    const gains = await page.locator(`${INNER} .con-wildstep__lane-amount`).allInnerTexts();
    expect(gains.length, 'six lanes').toBe(6);
    expect(gains.every((g) => g.trim() === '+3'), `every lane reads the dial's X — ${gains.join(' ')}`).toBe(true);
    await shoot(page, 'd-wild');
    // M€ · steel · titanium / plants · energy · heat — ↓ lands on plants.
    await press(page, 'ArrowDown', 250);
    await expect(page.locator(`${INNER}`)).toHaveAttribute('data-wild-focus-index', '3');
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER), 'A chose and left the step').toHaveCount(0);
    await expect(page.locator(`${ROW} [data-wild-row-answer="standard"]`), 'the row reads the answer').toContainText('+3');
    await toCommitRow(page);
    expect(posts.length, 'nothing sent before the commit').toBe(0);
    await armTransferWitness(page);
    const stop = await storyboard(page, 'remove');
    await commitOnce(page, posts, 0);
    const body = posts[0] ?? '';
    expect(body, 'the dial rides the branch').toContain('"amount":3');
    expect(body, 'the resource rides the same POST').toContain('"resource":"plants"');
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: the hub 4 → 1'}).toBe(1);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    const after = await wireOf(request, id);
    expect(after.thisPlayer.plants - before.thisPlayer.plants, '+3 plants').toBe(3);
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'remove-trail.txt'), transferTrail(witness) + '\n');
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(posts.length, 'ONE POST').toBe(1);
    await shoot(page, 'd-after');
  });

  test('C · the hub is the ONLY floater card: the target seeded and marked; A confirms — 4 → 6', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'floating-trade-hub-sole', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openVariant(page, ADD);
    await expect(page.locator(`${STAGE} .con-composer__row--missing`), 'the sole target is seeded (shown, never applied silently)').toHaveCount(0);
    await shoot(page, 'c-sole');
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: 4 → 6'}).toBe(6);
    await settle(page, {timeoutMs: 40_000});
    expect(posts.length, 'ONE POST').toBe(1);
  });

  test('E · 0 floaters: «remove» SHOWN refused with its reason; «add» → the hub 0 → 2', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'floating-trade-hub-empty', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openCardActions(page);
    const removeTile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`).nth(REMOVE);
    await expect(removeTile, 'the «remove» row is shown').toBeVisible();
    expect(await removeTile.getAttribute('data-action-verdict'), 'refused, never hidden').not.toBe('available');
    await expect(removeTile, 'its reason, in words').toContainText('Нет аэростатов на этой карте');
    await shoot(page, 'e-browse');
    await openVariant(page, ADD);
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: 0 → 2'}).toBe(2);
    await settle(page, {timeoutMs: 40_000});
  });
});
