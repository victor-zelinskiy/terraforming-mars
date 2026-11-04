import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, openActionFocus, openCardActions, placeTile, press, settle, walkFocusUntil,
} from './consoleStart';

/**
 * P67 «СОВЕТНИК МИРОВОГО ПРАВИТЕЛЬСТВА» — the player acts as the World Government for ONE action in the middle of the
 * action phase (docs/claude/prompts/prelude2-p67-world-government-advisor.md, ledgers GK · GL;
 * docs/claude/console/world-government-act.md):
 *
 *   B (`wga-table`) — «ДЕЙСТВИЯ КАРТ» › P67: the parameter is chosen BEFORE the press (four variant tiles in the printed
 *     order, each a World Government move «без РТ»); temperature −2 → 0 °C → ONE POST, the solar phase's «Поддержка
 *     правительства» dialog never stands (observed from the frame before), the server: TR and M€ unchanged; then the
 *     government's own 0 °C ocean is placed on the board — still nobody's rating.
 *   C (`wga-table`) — the ocean branch: the cell is picked on the board BEFORE the post (the staged pick, its answer
 *     nested in the branch pick) → ONE POST, the ocean stands, no rating, no cell bonus, no adjacency M€.
 *   D (`wga-table`) — the Venus branch: the rival's Aphrodite is paid 2 M€ (a rival's «any Venus step»), no rating for
 *     the player.
 *   E (`wga-maxed`) — every parameter at its maximum: the tile carries the futility verdict; the action stays legal.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P67. Storyboard: `TM_E2E_STORYBOARD=1` (frames in screenshots/p67/).
 */

const CARD = 'World Government Advisor';
const CARD_RU = 'СОВЕТНИК МИРОВОГО ПРАВИТЕЛЬСТВА';
const OUT = path.resolve('screenshots', 'p67');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';
/** The printed order of the action's row — the preview's branch positions. */
const POS = {oceans: '0', oxygen: '1', temperature: '2', venus: '3'} as const;

type Wire = {
  thisPlayer: {color: string, terraformRating: number, megaCredits: number},
  players: Array<{color: string, megacredits: number}>,
  game: {temperature: number, oxygenLevel: number, oceans: number, venusScaleLevel: number, phase: string},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `p67-${name}.png`)});
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

/** Arm, BEFORE anything is pressed, a record of the solar phase's own dialog ever standing (a MutationObserver). */
async function armGovSupportWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__p67Gov?: number};
    w.__p67Gov = 0;
    const seen = () => {
      if (document.querySelector('[data-motion-surface="gov-support"], .con-govsupport') !== null) {
        w.__p67Gov = (w.__p67Gov ?? 0) + 1;
      }
    };
    new MutationObserver(seen).observe(document.body, {childList: true, subtree: true});
    seen();
  });
}
const govSupportSeen = (page: Page) => page.evaluate(() => (window as unknown as {__p67Gov?: number}).__p67Gov ?? -1);

const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

/** «ДЕЙСТВИЯ КАРТ» › P67 › its configuration stage. */
async function openAdvisor(page: Page): Promise<void> {
  await openCardActions(page);
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === CARD, () => focusedTile(page), 30), `never focused ${CARD}`).toBeTruthy();
  await openActionFocus(page);
  await settle(page);
  await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb: the workspace › the card'}).toContain(CARD_RU);
}

const branchTiles = (page: Page) => page.locator(`${STAGE} .con-composer__branches .con-vchoice__opt`);
const focusedPos = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-composer__branches .con-vchoice__opt--focused')?.getAttribute('data-branch-pos') ?? '');

/** Walk the variant group onto `pos` and SELECT it (A). */
async function chooseBranch(page: Page, pos: string): Promise<void> {
  for (let i = 0; i < 3 && (await focusedPos(page)) === ''; i++) {
    await press(page, 'ArrowUp', 200);
  }
  const row = await page.evaluate(() => document.querySelector('.con-composer__branches')?.getAttribute('data-variant-axis') === 'row');
  for (let i = 0; i < 6 && (await focusedPos(page)) !== pos; i++) {
    await press(page, row ? 'ArrowRight' : 'ArrowDown', 300);
  }
  expect(await focusedPos(page), `the cursor stands on branch ${pos}`).toBe(pos);
  await press(page, 'Enter', 700);
  await expect(page.locator(`${STAGE} .con-composer__branches .con-vchoice__opt--selected[data-branch-pos="${pos}"]`), `branch ${pos} selected`).toHaveCount(1);
}

async function toCommitRow(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  await expect(page.locator(`${STAGE} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

async function commitOnce(page: Page, posts: Array<string>, before: number): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(before + 1);
}

test.describe(`P67 World Government Advisor · the World Government mid-action · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('B · four parameters chosen BEFORE the press; temperature −2 → 0 °C in ONE POST, no dialog, no rating; then the government\'s ocean', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wga-table', {query: PRESET.query});
    await settle(page);
    await armGovSupportWatch(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openAdvisor(page);
    await expect(branchTiles(page), 'four variant tiles — the printed row').toHaveCount(4);
    await expect(page.locator(`${STAGE} .con-composer__branches .con-vchoice__opt[data-branch-pos="${POS.oceans}"]`),
      'the ocean tile names the bonus the government does not take').toContainText(/без бонуса клетки/);
    await shoot(page, 'b-variants');
    await chooseBranch(page, POS.temperature);
    await expect(page.locator(`${STAGE} .con-composer__branches .con-vchoice__opt[data-branch-pos="${POS.temperature}"]`),
      'the temperature tile names the government\'s bonus ocean').toContainText(/бонусный океан/i);
    await shoot(page, 'b-temperature');
    await toCommitRow(page);
    expect(posts.length, 'nothing sent before the commit').toBe(0);
    const stop = await storyboard(page, 'temperature');
    await commitOnce(page, posts, 0);
    await expect.poll(async () => (await wireOf(request, id)).game.temperature, {timeout: 30_000, message: 'the server: −2 → 0 °C'}).toBe(0);
    // The government's own 0 °C ocean is placed on the board — the borrowed phase still stands. The grid lights once
    // the scale's story has played on a board the player can see (the park's law), so wait for the placement first.
    await expect(page.locator('.con-context__task-kicker'), 'the 0 °C ocean of the government is asked on the board').toBeVisible({timeout: 45_000});
    await shoot(page, 'b-bonus-ocean');
    expect(await placeTile(page), 'the government\'s 0 °C ocean is placed').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, id)).game.oceans, {timeout: 30_000, message: 'the ocean stands'}).toBe(before.game.oceans + 1);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    const after = await wireOf(request, id);
    expect(after.thisPlayer.terraformRating, 'no rating — the World Government is nobody').toBe(before.thisPlayer.terraformRating);
    expect(after.thisPlayer.megaCredits, 'no cell bonus, no adjacency M€').toBe(before.thisPlayer.megaCredits);
    expect(after.game.phase, 'the action phase is back').toBe('action');
    expect(await govSupportSeen(page), 'the solar phase\'s «Поддержка правительства» dialog never stood').toBe(0);
    await shoot(page, 'b-after');
  });

  test('C · the ocean branch: the cell is picked BEFORE the post, nested in the branch pick — ONE POST, no rating, no bonus', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'wga-table', {query: PRESET.query});
    await settle(page);
    await armGovSupportWatch(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openAdvisor(page);
    await chooseBranch(page, POS.oceans);
    await toCommitRow(page);
    const stop = await storyboard(page, 'ocean');
    // A on the commit row hands the composer to the board (the staged pick); nothing is sent yet.
    await press(page, 'Enter', 900);
    expect(posts.length, 'the board is a reversible step — nothing sent').toBe(0);
    expect(await placeTile(page), 'the cell is picked').toBeTruthy();
    await expect.poll(() => posts.length, {timeout: 15_000, message: 'ONE POST'}).toBe(1);
    expect(posts[0], 'the cell rides INSIDE the branch pick').toMatch(/"type":"or","index":2,"response":\{"type":"space"/);
    await expect.poll(async () => (await wireOf(request, id)).game.oceans, {timeout: 30_000, message: 'the ocean stands'}).toBe(before.game.oceans + 1);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    const after = await wireOf(request, id);
    expect(after.thisPlayer.terraformRating).toBe(before.thisPlayer.terraformRating);
    expect(after.thisPlayer.megaCredits, 'no cell bonus, no adjacency M€').toBe(before.thisPlayer.megaCredits);
    expect(posts.length, 'ONE POST').toBe(1);
    expect(await govSupportSeen(page)).toBe(0);
    await shoot(page, 'c-after');
  });

  test('D · Venus: the rival\'s Aphrodite is paid 2 M€; the player gains no rating', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await bootFixture(page, request, 'wga-table', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    const rival = (w: Wire) => w.players.find((p) => p.color !== w.thisPlayer.color)!.megacredits;
    const rivalBefore = rival(before);
    await openAdvisor(page);
    await chooseBranch(page, POS.venus);
    await shoot(page, 'd-venus');
    await toCommitRow(page);
    await commitOnce(page, posts, 0);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 30_000, message: 'the server: Venus +2 %'}).toBe(before.game.venusScaleLevel + 2);
    await settle(page, {timeoutMs: 40_000});
    const after = await wireOf(request, id);
    expect(after.thisPlayer.terraformRating).toBe(before.thisPlayer.terraformRating);
    expect(rival(after) - rivalBefore, 'Aphrodite pays its owner 2 M€ — the World Government terraforms too').toBe(2);
  });

  test('E · everything at its maximum: the tile carries the futility verdict, the action stays legal', async ({page, request}) => {
    test.setTimeout(180_000);
    await bootFixture(page, request, 'wga-maxed', {query: PRESET.query});
    await settle(page);
    await openCardActions(page);
    const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
    await expect(tile).toHaveCount(1);
    await expect(tile, 'the verdict on the tile').toHaveAttribute('data-action-futile', /.+/);
    await shoot(page, 'e-maxed');
  });
});
