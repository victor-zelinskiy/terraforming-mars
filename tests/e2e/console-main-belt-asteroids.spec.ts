import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, press, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P53 «АСТЕРОИДНЫЙ ПОЯС» — the first card of the set whose OWN action feeds its OWN effect: «put 1 asteroid on ANY
 * card» and «an asteroid landing HERE pays 1 titanium» (docs/claude/prompts/prelude2-p53-main-belt-asteroids.md,
 * ledger FJ):
 *
 *   B  (`main-belt-self`)    — the belt is the ONLY target: seeded and marked (shown, never applied silently), A → ONE
 *      POST → 0 → 1 asteroid and +1 titanium; every token's ends painted (the witness), the titanium lands on its row.
 *   B′ (`main-belt-second`)  — the second asteroid: 1 → 2, the belt's VP 0 → 1, +1 titanium.
 *   C  (`main-belt-holders`) — a real pick: the belt («Эта карта»), Comet Aiming and Rotator Impacts; the belt's tag
 *      carries «+1 [titanium]» (the server's per-candidate tail), the others none; Comet Aiming → its 0 → 1, no titanium.
 *   D  (`main-belt-holders`) — the same pick, the belt chosen: 0 → 1 and +1 titanium (the framework's reaction).
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P53. Storyboard: `TM_E2E_STORYBOARD=1` (frames in screenshots/p53/).
 */

const CARD = 'Main Belt Asteroids';
const CARD_RU = 'АСТЕРОИДНЫЙ ПОЯС';
const OUT = path.resolve('screenshots', 'p53');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';

type Wire = {thisPlayer: {titanium: number, victoryPointsBreakdown?: {total?: number}, tableau: Array<{name: string, resources?: number}>}};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const resourcesOf = (w: Wire, name: string) => w.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `p53-${name}.png`)});
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

const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

/** «ДЕЙСТВИЯ КАРТ» › the belt › its configuration stage. */
async function openBelt(page: Page): Promise<void> {
  await openCardActions(page);
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === CARD, () => focusedTile(page), 30), `never focused ${CARD}`).toBeTruthy();
  await openActionFocus(page);
  await settle(page);
  const crumb = (await crumbText(page)).toUpperCase();
  expect(crumb, 'the crumb: the workspace › the card › the stage').toContain(CARD_RU);
  expect(crumb).toContain('НАСТРОЙКА');
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

/** Open the unanswered target row's step (a real pick). */
async function openTargetStep(page: Page): Promise<void> {
  await expect(page.locator(`${STAGE} .con-composer__row--missing`), 'one unanswered target row (a real choice)').toHaveCount(1);
  for (let i = 0; i < 6 && await page.locator(`${STAGE} .con-composer__row--focused.con-composer__row--missing`).count() === 0; i++) {
    await press(page, 'ArrowUp', 250);
  }
  await press(page, 'Enter', 600);
  await expect(page.locator('.con-ptsel'), 'the target step opened').toBeVisible();
}

async function focusCandidate(page: Page, want: string): Promise<void> {
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    for (let i = 0; i < 6 && await focusedCandidate(page) !== want; i++) {
      await press(page, key, 220);
    }
  }
  expect(await focusedCandidate(page), `the cursor on ${want}`).toBe(want);
}

test.describe(`P53 Main Belt Asteroids · its own action feeds its own effect · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('B · the belt is the only target: seeded and marked; A → ONE POST → 0 → 1 asteroid, +1 titanium, every end painted', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'main-belt-self', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openBelt(page);
    await expect(page.locator(`${STAGE} .con-composer__row--missing`), 'the sole target is seeded (shown, never applied silently)').toHaveCount(0);
    await shoot(page, 'b-setup');
    await toCommitRow(page);
    expect(posts.length, 'nothing sent before the commit').toBe(0);
    await armTransferWitness(page);
    const stop = await storyboard(page, 'self');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: the belt 0 → 1'}).toBe(1);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    const after = await wireOf(request, id);
    expect(after.thisPlayer.titanium - before.thisPlayer.titanium, '+1 titanium from the printed effect').toBe(1);
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    const trail = transferTrail(witness);
    fs.writeFileSync(path.join(OUT, PRESET.id, 'self-trail.txt'), trail + '\n');
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(posts.length, 'ONE POST').toBe(1);
    await shoot(page, 'b-after');
  });

  test('B′ · the second asteroid: 1 → 2, +1 titanium, the belt’s VP 0 → 1', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'main-belt-second', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openBelt(page);
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: the belt 1 → 2'}).toBe(2);
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.titanium - before.thisPlayer.titanium, '+1 titanium').toBe(1);
    const vpBefore = before.thisPlayer.victoryPointsBreakdown?.total;
    const vpAfter = after.thisPlayer.victoryPointsBreakdown?.total;
    if (vpBefore !== undefined && vpAfter !== undefined) {
      expect(vpAfter - vpBefore, '1 VP per 2 asteroids: the second one scores').toBe(1);
    }
    await shoot(page, 'b2-after');
  });

  test('C · a real pick: the belt’s tag «+1 [titanium]», the others none; Comet Aiming → its 0 → 1, no titanium', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'main-belt-holders', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openBelt(page);
    await openTargetStep(page);
    const cells = await page.evaluate(() => [...document.querySelectorAll('.con-ptsel__cell')].map((cell) => ({
      who: cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? ''),
      extra: [...cell.querySelectorAll('[data-ptsel-extra]')].map((x) => x.getAttribute('data-ptsel-extra')),
    })));
    const who = cells.map((c) => c.who);
    expect(who, 'Comet Aiming and Rotator Impacts').toEqual(expect.arrayContaining(['Comet Aiming', 'Rotator Impacts']));
    const belt = cells.filter((c) => c.who === 'self' || c.who === CARD);
    expect(belt.length, '«ANY card» — the belt itself, ONCE').toBe(1);
    expect(belt[0].extra, 'the belt’s tag carries the titanium its effect pays').toContain('titanium');
    for (const other of cells.filter((c) => c.who === 'Comet Aiming' || c.who === 'Rotator Impacts')) {
      expect(other.extra, `${other.who} answers nothing`).not.toContain('titanium');
    }
    await focusCandidate(page, 'Comet Aiming');
    await shoot(page, 'c-targets');
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), 'Comet Aiming'), {timeout: 30_000, message: 'the server: Comet Aiming 0 → 1'}).toBe(1);
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(resourcesOf(after, CARD), 'the belt untouched').toBe(0);
    expect(after.thisPlayer.titanium - before.thisPlayer.titanium, 'no titanium — the asteroid did not land HERE').toBe(0);
  });

  test('D · the same pick, the belt chosen: 0 → 1 and +1 titanium', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'main-belt-holders', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openBelt(page);
    await openTargetStep(page);
    const self = await page.evaluate((card) => [...document.querySelectorAll('.con-ptsel__cell')]
      .some((cell) => cell.querySelector('[data-ptsel-self]') !== null || cell.querySelector(`[data-zoom-slot="${card}"]`) !== null), CARD);
    expect(self, 'the belt is a candidate').toBe(true);
    const want = await page.evaluate(() => document.querySelector('.con-ptsel__cell [data-ptsel-self]') !== null ? 'self' : 'Main Belt Asteroids');
    await focusCandidate(page, want);
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
    await toCommitRow(page);
    const stop = await storyboard(page, 'self-among-holders');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: the belt 0 → 1'}).toBe(1);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    const after = await wireOf(request, id);
    expect(after.thisPlayer.titanium - before.thisPlayer.titanium, '+1 titanium').toBe(1);
    await shoot(page, 'd-after');
  });
});
