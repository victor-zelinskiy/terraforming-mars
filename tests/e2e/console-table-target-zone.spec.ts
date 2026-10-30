import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, openActionFocus, openCardActions, press, pressUntil, settle, walkFocusUntil} from './consoleStart';

/**
 * «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» (the owner, 2026-10-28). Ants against a table with MarsBot used to ask in TWO steps — a
 * list «карты игроков · бот», and only behind its door the cards. The server's `OrOptions` now carries
 * `tableTargetPrompt`, and the composer answers it on ONE screen. Against a real server, on the TV
 * (`table-target-ants-bot`: blue holds Ants + Tardigrades 2, red GHG Producing Bacteria 3 + Decomposers 1, the bot 2
 * microbes on Enceladus):
 *
 *   (a) A on the removal row opens the ZONE directly — no option list — with THREE groups (red, the bot, blue's own
 *       last), the bot a TILE reading «2 → 1»; LB/RB jump band to band; A on the tile → ONE POST → the bot loses a
 *       microbe, Ants gains one.
 *   (b) A on red's GHG Producing Bacteria → ONE POST → GHG 3 → 2, Ants +1.
 *
 * The marker and the wire form are the unit specs' (`tests/automa/AutomaTargeting.spec.ts`,
 * `tests/client/components/console/tableTargetZone.spec.ts`); this asserts the journey.
 */

const ANTS = 'Ants';
const OUT = path.resolve('screenshots', 'table-target', process.env.TM_E2E_SHOTS_TAG ?? '');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const STEP = '.con-cardactions .con-ptsel';

type Wire = {
  thisPlayer: {tableau: Array<{name: string, resources?: number}>},
  players: Array<{color: string, isMarsBot?: boolean, tableau: Array<{name: string, resources?: number}>, megaCredits?: number}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOn = (wire: Wire, card: string) =>
  wire.players.flatMap((p) => p.tableau).find((c) => c.name === card)?.resources ?? -1;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(new URL(r.url()).pathname);
    }
  });
  return posts;
}

/** «Действия карт» → Ants' tile → its composer → A on the removal row opens the zone. */
async function openZone(page: Page): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  expect(await walkFocusUntil(page, async () => (await focused()) === ANTS, focused, 18), `never focused ${ANTS}`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(STEP).count() > 0, {tries: 3, settleMs: 1200}),
    'A on the removal row opened the zone').toBe(true);
  await settle(page);
}

/** The focused cell's owner colour (`data-owner`), and whether it is the bot's tile. */
const focusedCell = (page: Page) => page.evaluate((sel) => {
  const cell = document.querySelector(`${sel} .con-ptsel__cell[data-focused="1"]`);
  return {owner: cell?.getAttribute('data-owner') ?? '', bot: cell?.querySelector('[data-ptsel-bot]') !== null};
}, STEP);

test.describe(`console · the table's targets are ONE zone · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(a) Ants: three groups in ONE zone, the bot a tile of microbes «N → N−1»; LB/RB jump bands; A on the bot → one POST', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'table-target-ants-bot', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    const bot = before.players.find((p) => p.isMarsBot === true);
    expect(bot, 'the bot sits at the table').toBeDefined();
    await openZone(page);

    expect(await page.locator('.con-cardactions .con-composer__sublist').count(), 'no «карты / бот» list before the cards').toBe(0);
    await expect(page.locator(STEP), 'every group on screen — the BANDS layout').toHaveAttribute('data-mode', 'board');
    const owners = await page.locator(`${STEP} .con-ptsel__owner`).count();
    expect(owners, 'red, the bot, and blue\'s own').toBe(3);
    const tile = page.locator(`${STEP} [data-ptsel-bot]`);
    await expect(tile, 'the bot stands as a tile beside the players').toHaveCount(1);
    // The bot loses MICROBES, one of them: what it can lose of them → one fewer. How its engine pays (Enceladus first, its
    // M€ standing in) is never on the tile — the owner, 2026-10-30: the bot is one more player at the table.
    const delta = ((await tile.locator('[data-ptsel-bot-delta]').textContent()) ?? '').match(/(\d+)\s*→\s*(\d+)/);
    expect(delta, 'the tile reads «from → to»').not.toBeNull();
    expect(Number(delta![1]) - Number(delta![2]), 'one microbe').toBe(1);
    await expect(tile.locator('[data-ptsel-bot-icon]')).toHaveAttribute('data-ptsel-bot-icon', 'Microbe');
    await shoot(page, 'a1-one-zone');

    // LB/RB — band to band; the cursor lands on the bot's tile in its own band.
    const seen = new Set<string>();
    for (let i = 0; i < 4 && !(await focusedCell(page)).bot; i++) {
      seen.add((await focusedCell(page)).owner);
      await press(page, 'KeyE', 400);
    }
    expect((await focusedCell(page)).bot, `RB reached the bot's band (walked ${[...seen].join(' → ')})`).toBe(true);
    expect((await focusedCell(page)).owner).toBe(bot!.color);
    await shoot(page, 'a2-cursor-on-bot');

    const posts = watchPosts(page);
    await pressUntil(page, 'Enter', async () => await page.locator(STEP).count() === 0, {tries: 2, settleMs: 1000});
    expect(posts, 'choosing the target sends nothing').toEqual([]);
    await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 1500});
    expect(posts, 'the action is ONE POST').toHaveLength(1);
    await expect.poll(async () => resourcesOn(await wireOf(request, playerId), ANTS), {timeout: 30_000, message: 'Ants +1'}).toBe(1);
    const after = await wireOf(request, playerId);
    expect(resourcesOn(after, 'GHG Producing Bacteria'), 'red\'s card untouched').toBe(3);
    expect(resourcesOn(after, 'Tardigrades'), 'blue\'s own card untouched').toBe(2);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'a3-done');
  });

  test('(b) Ants: A on red\'s GHG Producing Bacteria answers the card branch — one POST, 3 → 2', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'table-target-ants-bot', {query: PRESET.query});
    await openZone(page);
    const ghg = page.locator(`${STEP} .con-ptsel__slot[data-zoom-slot="GHG Producing Bacteria"]`);
    await expect(ghg).toHaveCount(1);
    for (let i = 0; i < 8 && !(await ghg.evaluate((el) => el.classList.contains('con-ptsel__slot--focused'))); i++) {
      await press(page, i < 4 ? 'ArrowRight' : 'ArrowLeft', 300);
    }
    expect(await ghg.evaluate((el) => el.classList.contains('con-ptsel__slot--focused')), 'the cursor reached GHG Producing Bacteria').toBe(true);
    const posts = watchPosts(page);
    await pressUntil(page, 'Enter', async () => await page.locator(STEP).count() === 0, {tries: 2, settleMs: 1000});
    await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 1500});
    expect(posts, 'the action is ONE POST').toHaveLength(1);
    await expect.poll(async () => resourcesOn(await wireOf(request, playerId), 'GHG Producing Bacteria'), {timeout: 30_000}).toBe(2);
    expect(resourcesOn(await wireOf(request, playerId), ANTS)).toBe(1);
  });
});
