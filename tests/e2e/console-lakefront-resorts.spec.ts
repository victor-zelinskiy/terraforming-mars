/*
 * R38 LAKEFRONT RESORTS — the first classic Turmoil corporation adapted in place (ledger CI,
 * `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). Its hooks never changed; what the adaptation owes the player is that every
 * surface that reads the table READS the corporation (fixture `lakefront-resorts` — blue on Lakefront, red's two oceans
 * on 06 / 07, the free land 12 between them; TV 4K, the product's profile):
 *
 *  A · the face and the rules: «Разыграно» (Information) → the corporation → its fullscreen inspect — the art R38, 54 M€,
 *      and its effect line in the set's voice (any ocean → +1 M€ production · the adjacency rate 3 instead of 2);
 *  B · the cell dossier reads the OWNER's rate: a standard City aimed at 12 — «Океанов рядом: 2 × 3 M€», B returns with
 *      nothing paid;
 *  C · the table's answer BEFORE the press: the standard Aquifer's «⚡ сработает» door names +1 M€ production, the R3
 *      layer stands Lakefront Resorts in «Вы получите»; the press places the ocean and the server's production rises;
 *  D · a RIVAL's ocean (red's standard Aquifer, over the API) pays blue: one notification, the band «+1» with the
 *      corporation as its reason (`.con-notif__why` — «ВАША КОРПОРАЦИЯ · Lakefront Resorts»), the server's +1.
 * The bot's collision (a human on Lakefront keeps the bot off C35) is pinned server-side
 * (`tests/automa/AutomaCorporations.spec.ts`); the bot twin's own face — `console-bot-corp-card-cube`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  NO_PAYMENT, bootFixtureSeats, fetchPlayerModel, openInfoPlayedTable, placeTile, press, pressUntil, sendPlayerInput, settle, walkToSpace,
} from './consoleStart';

const OUT = path.resolve('screenshots', 'lakefront', 'corp');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type WireOption = {type: string, title?: unknown, cards?: Array<{name: string, calculatedCost?: number}>};
type Wire = {
  thisPlayer: {color: string, megaCreditProduction?: number, megacreditProduction?: number},
  players?: Array<{color: string, megaCreditProduction?: number}>,
  waitingFor?: {type: string, spaces?: Array<string>, options?: Array<WireOption>},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const mcProduction = async (request: APIRequestContext, id: string): Promise<number> => {
  const w = await wireOf(request, id);
  return w.thisPlayer.megaCreditProduction ?? w.thisPlayer.megacreditProduction ?? -999;
};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

const focusedRow = async (page: Page) => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
/** Home to the top-left corner, then snake through the 2-column grid (the stdp workspace's own walk). */
async function focusRow(page: Page, re: RegExp): Promise<void> {
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 6 && !re.test(await focusedRow(page)); i++) {
    await press(page, 'ArrowUp', 200);
  }
  if (!re.test(await focusedRow(page))) {
    await press(page, 'ArrowLeft', 200);
  }
  for (let i = 0; i < snake.length && !re.test(await focusedRow(page)); i++) {
    await press(page, snake[i], 240);
  }
  expect(re.test(await focusedRow(page)), `could not focus ${re} (at «${await focusedRow(page)}»)`).toBeTruthy();
}

async function openStandardProjects(page: Page): Promise<void> {
  await press(page, 'Comma', 1100);
  await press(page, 'Enter', 1400);
  await expect(page.locator('.con-stdp'), 'the standard projects opened').toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

async function backToBoard(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-stdp, .con-info, .con-zoom').count() > 0; i++) {
    await press(page, 'Escape', 900);
  }
  await settle(page, {timeoutMs: 20_000});
}

test.describe(`console · R38 Lakefront Resorts · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · B · C — the face and its two rules, the dossier at the owner\'s rate, the Aquifer\'s forecast and its payout', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId: blue} = await bootFixtureSeats(page, request, 'lakefront-resorts', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});

    // ── A · «Разыграно» → the corporation → the fullscreen inspect: the art, 54 M€, the two rules.
    await press(page, 'KeyY', 1200);
    await expect(page.locator('.con-info'), 'the Information workspace').toBeVisible();
    await openInfoPlayedTable(page);
    const corp = page.locator('.con-info .con-played--embedded .pcard', {hasText: /Lakefront/i}).first();
    await expect(corp, 'the corporation stands on blue\'s table').toBeVisible();
    // The corporation is the table's first stack and the cursor's seed; X inspects the current object (A opens its
    // category view).
    await expect(page.locator('.con-info .con-played--embedded [class*="--focused"]', {hasText: /Lakefront/i}).first(),
      'the cursor stands on the corporation').toBeVisible();
    expect(await pressUntil(page, 'KeyX', async () => await page.locator('.con-zoom .card-zoom-stage .pcard').count() > 0, {tries: 3, settleMs: 1500}),
      'X opens the corporation\'s fullscreen inspect').toBeTruthy();
    const face = page.locator('.con-zoom .card-zoom-stage .pcard');
    await expect(face, 'the corporation\'s fullscreen face').toContainText(/Lakefront/i);
    expect(await face.locator('img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src).join(' ')), 'the art R38').toMatch(/R38/);
    expect((await face.innerText()).replace(/\s+/g, ' '), 'the printed 54 M€').toMatch(/54/);
    const rules = (await page.locator('.con-zoom-rules').innerText()).replace(/\s+/g, ' ');
    // The rules panel prints the card's own effect line (RU in the set's voice — decision 1); the information model's
    // two short lines are pinned server-side (`cardInformation.spec` · `LakefrontResorts.spec`).
    expect(rules, 'any ocean → +1 M€ production').toMatch(/размещается любой океан, увеличьте производство M€ на 1 шаг/i);
    expect(rules, 'the adjacency rate').toMatch(/соседство с океанами — 3 M€ вместо 2 M€/i);
    await shoot(page, '01-corporation-face');
    await backToBoard(page);

    // ── B · a standard City aimed at 12 (two oceans beside it): the dossier reads the OWNER's rate — 2 × 3 M€.
    const posts: Array<string> = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
        posts.push(req.url());
      }
    });
    await openStandardProjects(page);
    await focusRow(page, /город/i);
    await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 3, settleMs: 1500});
    await walkToSpace(page, '12');
    const panel = page.locator('.con-context');
    await expect(panel, 'the dossier prices the neighbourhood at blue\'s rate').toContainText(/2\s*×\s*3\s*M€/, {timeout: 10_000});
    await expect(panel, 'six M€ for the two oceans').toContainText(/\+\s*6/);
    await shoot(page, '02-dossier-two-oceans');
    // B steps back to the projects, nothing paid (a standard city is pay-on-commit).
    await backToBoard(page);
    expect(posts.filter((u) => /input/.test(u)).length <= 1, 'at most the pick reached the server (pay-on-commit)').toBe(true);

    // ── C · the Aquifer: the «⚡ сработает» door before the press, the R3 layer, then the ocean and the payout.
    const before = await mcProduction(request, blue);
    await openStandardProjects(page);
    await focusRow(page, /океан/i);
    const door = page.locator('.con-stdp [data-forecast-row]');
    await expect(door, 'the table\'s answer stands on the row').toHaveCount(1);
    expect(((await door.textContent()) ?? '').replace(/\s+/g, ' '), 'the +1 M€ production').toMatch(/\+\s*1/);
    await shoot(page, '03-aquifer-forecast');
    expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-stdp [data-forecast-layer]').count() > 0, {tries: 3, settleMs: 1100}),
      'R3 opens the «Эффекты» layer').toBeTruthy();
    await expect(page.locator('.con-stdp [data-forecast-layer] [data-forecast-group="receive"]'), 'Lakefront Resorts in «Вы получите»')
      .toContainText(/Lakefront/i);
    await shoot(page, '04-aquifer-layer');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-stdp [data-forecast-layer]').count() === 0, {tries: 3, settleMs: 1100}),
      'B folds the layer').toBeTruthy();
    await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 3, settleMs: 1500});
    expect(await placeTile(page), 'the ocean placed').toBeTruthy();
    await expect.poll(() => mcProduction(request, blue), {timeout: 30_000, message: 'the server raised blue\'s M€ production'}).toBe(before + 1);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, '05-aquifer-landed');
  });

  test('D — a RIVAL\'s ocean pays blue: one card, «+1» with the corporation as its reason', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'lakefront-resorts', {query: PRESET.query});
    const red = seats.find((s) => s !== blue)!;
    await settle(page, {timeoutMs: 30_000});
    const before = await mcProduction(request, blue);
    // Blue passes; red runs the standard Aquifer over the API and places its ocean.
    const menu = (await wireOf(request, blue)).waitingFor!;
    const passIdx = (menu.options ?? []).findIndex((o) => JSON.stringify(o.title ?? '').includes('Pass for this generation'));
    expect(passIdx, 'blue can pass').toBeGreaterThanOrEqual(0);
    await sendPlayerInput(request, blue, {type: 'or', index: passIdx, response: {type: 'option'}});
    await expect.poll(async () => (await wireOf(request, red)).waitingFor?.type, {timeout: 30_000}).toBe('or');
    await settle(page, {timeoutMs: 30_000});
    const redMenu = (await wireOf(request, red)).waitingFor!;
    const idx = (redMenu.options ?? []).findIndex((o) => o.type === 'projectCard' && (o.cards ?? []).some((c) => c.name === 'Aquifer'));
    expect(idx, 'red\'s standard projects offer the Aquifer').toBeGreaterThanOrEqual(0);
    const aquifer = (redMenu.options?.[idx].cards ?? []).find((c) => c.name === 'Aquifer');
    await sendPlayerInput(request, red, {type: 'or', index: idx, response: {type: 'projectCard', card: 'Aquifer', payment: {...NO_PAYMENT, megacredits: aquifer?.calculatedCost ?? 18}}});
    await expect.poll(async () => (await wireOf(request, red)).waitingFor?.type, {timeout: 20_000}).toBe('space');
    const spaceId = (await wireOf(request, red)).waitingFor?.spaces?.[0];
    expect(spaceId, 'a legal ocean cell').toBeDefined();
    await sendPlayerInput(request, red, {type: 'space', spaceId: spaceId!});
    await expect.poll(() => mcProduction(request, blue), {timeout: 30_000, message: 'the server paid blue +1 M€ production'}).toBe(before + 1);
    // The card: the band «+1», the reason the corporation (never red's move as the name).
    const card = page.locator('.con-notif', {has: page.locator('.con-notif__why', {hasText: /Lakefront/i})}).first();
    await expect(card, 'blue\'s notification names Lakefront Resorts as the reason').toBeVisible({timeout: 30_000});
    await expect(card.locator('.con-notif__you')).toContainText('+1');
    await expect(card.locator('.con-notif__why')).toContainText(/ВАША КОРПОРАЦИЯ|Your corporation/i);
    await shoot(page, '06-rival-ocean-card');
    await settle(page, {timeoutMs: 30_000});
  });
});
