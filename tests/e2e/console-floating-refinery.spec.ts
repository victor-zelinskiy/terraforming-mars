import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P73 «ОБЛАЧНАЯ ПЕРЕРАБОТКА» — the series' first Venus card with an action CHOICE
 * (docs/claude/prompts/prelude2-p73-floating-refinery.md, decision 3):
 *
 *   (1) `floating-refinery` — Venus Governor (2) + Dirigibles (1) on the table: the hand plate «+4», ONE POST, 4 floaters
 *       on the card on the server.
 *   (2) `floating-refinery-action` — «ДЕЙСТВИЯ КАРТ» › the card's «remove» variant › НАСТРОЙКА: the source step offers
 *       Dirigibles and Floating Habs (never P73 itself — 1 floater), Floating Habs chosen, ONE POST: Floating Habs 2 → 0,
 *       +1 titanium, +2 M€ on the server; the spend leaves the chosen card, no end over glass.
 *   (3) `floating-refinery-sole` — the «remove» variant SHOWN refused with its reason; the «add» variant → ONE POST, no
 *       question: 1 → 2 floaters.
 *   (4) `floating-refinery-action` — the «add» variant asks no source.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P73 (dry runs prove the +4 and B's −2 / +1 / +2).
 * Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Floating Refinery';
const CARD_RU = 'ОБЛАЧНАЯ ПЕРЕРАБОТКА';
const OUT = path.resolve('screenshots', 'p73');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PLAY = '.con-composer--play';
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';
/** The printed rows, in the card's order: «+1 floater here» · «2 floaters off a card → titanium + M€». */
const ADD = 0;
const REMOVE = 1;

type Wire = {
  thisPlayer: {
    megacredits: number, titanium: number,
    tableau: Array<{name: string, resources?: number}>,
  },
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const resourcesOf = (w: Wire, name: string) => w.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
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

/** A → ONE more POST (retried only while none went out). */
async function commitOnce(page: Page, posts: Array<string>, before: number): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(before + 1);
}

/** The focused tile as «card#k» — k counts that card's tiles in the printed order. */
const focusedTile = (page: Page) => page.evaluate(() => {
  const f = document.querySelector('.con-cardactions__tile--focused');
  if (f === null) {
    return '';
  }
  const card = f.getAttribute('data-action-card') ?? '';
  const tiles = [...document.querySelectorAll(`.con-cardactions__tile[data-action-card="${card}"]`)];
  return `${card}#${tiles.indexOf(f)}`;
});

/** «ДЕЙСТВИЯ КАРТ» › the card's `variant` tile focused › its configuration stage. */
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

/** The played-target step's focused candidate (the card's name, or 'self' for the hero proxy). */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

test.describe(`P73 Floating Refinery · the counted play, the action choice, the source pick · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the play: the hand plate «+4», ONE POST, 4 floaters on the card', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'floating-refinery', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await settle(page);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
    await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`), 'the hand plate: Venus tags 3 + this card')
      .toHaveAttribute('data-hand-count', '4');
    await shoot(page, 'a-hand');
    await press(page, 'Enter', 1200);
    await page.locator(PLAY).waitFor({timeout: 15_000});
    await settle(page);
    const stop = await storyboard(page, 'play');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: 4 floaters on P73'}).toBe(4);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'b-played');
    await waitForBoardHome(page, 30);
  });

  test('the «remove» variant: the source step (Dirigibles · Floating Habs), ONE POST, Floating Habs 2 → 0, +1 titanium, +2 M€', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'floating-refinery-action', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openVariant(page, REMOVE);
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, 'the crumb: the workspace › the card › the stage').toContain(CARD_RU);
    expect(crumb).toContain('НАСТРОЙКА');
    await shoot(page, 'c-setup');

    // The source row is still unanswered: A opens the step over the server's candidates.
    const row = page.locator(`${STAGE} .con-composer__row--missing`);
    await expect(row, 'one unanswered source row').toHaveCount(1);
    for (let i = 0; i < 6 && await page.locator(`${STAGE} .con-composer__row--focused.con-composer__row--missing`).count() === 0; i++) {
      await press(page, 'ArrowUp', 250);
    }
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-ptsel'), 'the source step opened').toBeVisible();
    const offered = await page.evaluate(() => [...document.querySelectorAll('.con-ptsel__cell')]
      .filter((cell) => cell.querySelector('[data-ptsel-blocked]') === null)
      .map((cell) => cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? ''));
    expect(offered, 'Dirigibles and Floating Habs — never the card itself (1 floater)').toEqual(expect.arrayContaining(['Dirigibles', 'Floating Habs']));
    expect(offered, 'the card itself (1 floater) is a near miss, never a source').not.toContain(CARD);
    for (const key of ['ArrowRight', 'ArrowLeft']) {
      for (let i = 0; i < 6 && await focusedCandidate(page) !== 'Floating Habs'; i++) {
        await press(page, key, 220);
      }
    }
    expect(await focusedCandidate(page), 'the cursor on Floating Habs').toBe('Floating Habs');
    await shoot(page, 'd-source');
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
    await toCommitRow(page);
    await shoot(page, 'e-answered');
    expect(posts.length, 'nothing sent before the commit').toBe(0);

    await armTransferWitness(page);
    const stop = await storyboard(page, 'refine');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), 'Floating Habs'), {timeout: 30_000, message: 'the server: Floating Habs 2 → 0'}).toBe(0);
    await expect(page.locator('.con-cardactions'), 'the flow leaves').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'f-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.titanium - before.thisPlayer.titanium, '+1 titanium').toBe(1);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, '+2 M€').toBe(2);
    expect(resourcesOf(after, 'Dirigibles'), 'Dirigibles untouched').toBe(3);
    expect(resourcesOf(after, CARD), 'P73 untouched').toBe(1);
    const witness = await transferWitness(page);
    fs.writeFileSync(path.join(OUT, PRESET.id, 'refine-trail.txt'), transferTrail(witness) + '\n');
    console.log(`[p73] refine trail\n${transferTrail(witness)}`);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(posts.length, 'ONE POST for the action').toBe(1);
  });

  test('no source: the «remove» variant SHOWN refused with its reason; «add» asks nothing — ONE POST, 1 → 2', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'floating-refinery-sole', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openCardActions(page);
    const removeTile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`).nth(REMOVE);
    await expect(removeTile, 'the «remove» variant is shown').toBeVisible();
    expect(await removeTile.getAttribute('data-action-verdict'), 'refused, never hidden').not.toBe('available');
    await expect(removeTile, 'its reason, in words').toContainText('Ни на одной вашей карте нет 2 аэростатов');
    await shoot(page, 'g-sole-browse');
    await openVariant(page, ADD);
    await expect(page.locator(`${STAGE} .con-composer__row--missing`), 'nothing to answer').toHaveCount(0);
    await toCommitRow(page);
    await shoot(page, 'h-sole-setup');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: 1 → 2 floaters'}).toBe(2);
    await settle(page, {timeoutMs: 40_000});
    expect(posts.length, 'ONE POST').toBe(1);
  });

  test('the «add» variant on a table with sources asks no source', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'floating-refinery-action', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openVariant(page, ADD);
    await expect(page.locator(`${STAGE} .con-composer__row--missing`), 'no source row').toHaveCount(0);
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => resourcesOf(await wireOf(request, id), CARD), {timeout: 30_000, message: 'the server: 1 → 2 floaters'}).toBe(2);
    const after = await wireOf(request, id);
    expect(resourcesOf(after, 'Floating Habs'), 'no source touched').toBe(2);
    expect(resourcesOf(after, 'Dirigibles')).toBe(3);
    await settle(page, {timeoutMs: 40_000});
  });
});
