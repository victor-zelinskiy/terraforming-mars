import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR58 «ПЕРЕРАБАТЫВАЮЩИЙ ЗАВОД» — «3 [plant] OR 5 [heat] → 3 [floater]*»: the card's «OR» stands on the PRICE side, so
 * the composer asks the PRICE as two tiles and prints the ONE good once after them with its addresses once (decision
 * 4a). Against a real server, on two profiles:
 *
 *   (A) PLANTS (`reprocessing-plant`, TR58 on the table, 4 plants / 6 heat, Dirigibles (1) + Aerial Mappers): ONE tile
 *       in «Действия карт»; the composer's two PRICE tiles print their price alone, the shared result («→ 3
 *       [floater]*») stands once after them with BOTH holders and no tile repeats them; before the choice the formula
 *       already reads «Вы получите» with the PRICE side reserved; A seals the plants tile, the target row asks WHERE,
 *       Dirigibles is answered in the embedded step, the commit is ONE addressed POST; the server: plants 4 → 1,
 *       Dirigibles 1 → 4. «−3» leaves the plants row, «+3» is born on the hero's printed floater and lands on
 *       Dirigibles' miniature — every flight's ends visible.
 *   (B) HEAT (the same table): the heat tile → «−5» off the heat row, plants untouched.
 *   (C) STORMCRAFT (`reprocessing-plant-stormcraft`, 1 heat + Stormcraft's 4 floaters): sealing the heat tile brings
 *       the HEAT SPLIT as a row of the composer, BEFORE the commit (1 heat + 2 floaters); the floaters come back to
 *       Stormcraft itself (4 − 2 + 3 = 5); nothing is asked after the press (the harness's POST-COMMIT guard).
 *   (D) NO HOLDER (`reprocessing-plant-none`): the tile refused, and the reason «no holder» is the FIRST it states —
 *       it closes both variants at once (a price shortfall of one of them is never what the player reads first).
 *   (E) THE REDS RULE (`reprocessing-plant-locked`): «✕ Нельзя разыграть» with the Industrialists' count.
 */

const CARD = 'Reprocessing Plant';
const CARD_RU = 'Перерабатывающий завод';
const DIR = 'Dirigibles';
const MAP = 'Aerial Mappers';
const STORM = 'Stormcraft Incorporated';
const OUT = path.resolve('screenshots', 'tr58', 'e2e');
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, plants: number, heat: number, tableau: Array<{name: string, resources?: number}>},
};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function postsOf(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** Walk the composer's cursor to its commit row and press A until exactly one request has left. */
async function commit(page: Page, root: string, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 10 && await page.locator(`${root} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'A sent exactly one request').toBe(1);
}

/** The focused «Действия карт» tile's card. */
const focusedTileCard = (page: Page) => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');

async function openComposer(page: Page): Promise<void> {
  await openCardActions(page);
  await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'ONE tile — the card prints ONE row').toHaveCount(1);
  expect(await walkFocusUntil(page, async () => await focusedTileCard(page) === CARD, async () => focusedTileCard(page), 10),
    `never focused «${CARD}»`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(ACTION_COMPOSER), 'the composer stands').toBeVisible();
}

type Tile = {selected: boolean, off: boolean, focused: boolean, print: Array<string>, dest: number, reason: string};
async function tiles(page: Page): Promise<Array<Tile>> {
  return page.locator(`${ACTION_COMPOSER} .con-vchoice__opt`).evaluateAll((els) => els.map((el) => ({
    selected: el.classList.contains('con-vchoice__opt--selected'),
    off: el.classList.contains('con-vchoice__opt--off'),
    focused: el.classList.contains('con-vchoice__opt--focused'),
    print: Array.from(el.querySelectorAll('[data-vchoice-print] .pcard-ic')).map((i) => /([\w-]+)\.(?:png|webp|svg)/.exec((i as HTMLElement).style.backgroundImage ?? '')?.[1] ?? '?'),
    dest: el.querySelectorAll('[data-vchoice-dest]').length,
    reason: (el.querySelector('.con-vchoice__reason')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  })));
}

/** THE SHARED RESULT — the good every price buys, printed once after the tiles with its addresses once. */
async function shared(page: Page): Promise<{count: number, print: Array<string>, dest: Array<string>, destCount: string, afterTiles: boolean}> {
  return page.evaluate((root) => {
    const blocks = Array.from(document.querySelectorAll(`${root} [data-vchoice-shared]`));
    const block = blocks[0];
    const opts = Array.from(document.querySelectorAll(`${root} .con-vchoice__opt`));
    const last = opts[opts.length - 1];
    return {
      count: blocks.length,
      print: Array.from(block?.querySelectorAll('[data-vchoice-print] .pcard-ic') ?? []).map((i) => /([\w-]+)\.(?:png|webp|svg)/.exec((i as HTMLElement).style.backgroundImage ?? '')?.[1] ?? '?'),
      dest: Array.from(block?.querySelectorAll('[data-vchoice-dest-card]') ?? []).map((d) => d.getAttribute('data-vchoice-dest-card') ?? ''),
      destCount: block?.querySelector('[data-vchoice-dest]')?.getAttribute('data-vchoice-dest-count') ?? '',
      afterTiles: block !== undefined && last !== undefined && (last.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    };
  }, ACTION_COMPOSER);
}

/** Seal tile `index` with A (the press, never the cursor). */
async function chooseTile(page: Page, index: number): Promise<void> {
  for (let i = 0; i < 6 && await page.locator(`${ACTION_COMPOSER} .con-vchoice__opt--focused`).count() === 0; i++) {
    await press(page, 'ArrowUp', 220);
  }
  for (let i = 0; i < 4; i++) {
    const at = (await tiles(page)).findIndex((t) => t.focused);
    if (at === index || at < 0) {
      break;
    }
    await press(page, at < index ? 'ArrowRight' : 'ArrowLeft', 300);
  }
  expect(await pressUntil(page, 'Enter', async () => (await tiles(page))[index]?.selected === true, {tries: 3, settleMs: 500}),
    `A seals tile ${index}`).toBeTruthy();
}

async function openStep(page: Page): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 6 && await step.count() === 0; i++) {
    const row = page.locator(`${ACTION_COMPOSER} [data-composer-target-row]`);
    const rowFocused = await row.evaluate((el) => el.closest('.con-composer__row')?.classList.contains('con-composer__row--focused') ?? false).catch(() => false);
    if (!rowFocused) {
      await press(page, 'ArrowDown', 400);
      continue;
    }
    await press(page, 'Enter', 1300);
  }
  await expect(step, 'the embedded played-target step opens').toHaveCount(1, {timeout: 10_000});
  await settle(page);
}

async function answerTarget(page: Page, card: string): Promise<void> {
  const at = () => page.evaluate(() => document.querySelector('.con-ptsel__cell[data-focused="1"] [data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
  for (let i = 0; i < 6 && await at() !== card; i++) {
    await press(page, 'ArrowRight', 350);
  }
  expect(await at(), `the cursor reached ${card}`).toBe(card);
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 4 && await step.count() > 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(step, 'A on the candidate answers the target').toHaveCount(0, {timeout: 8000});
  await settle(page);
}

type Variant = {index: 0 | 1, row: 'plants' | 'heat', price: number};
const PLANTS: Variant = {index: 0, row: 'plants', price: 3};
const HEAT: Variant = {index: 1, row: 'heat', price: 5};

/** (A) / (B): the prices, the one result, a variant sealed, Dirigibles answered, ONE POST — and both flights' ends. */
async function payAndLand(page: Page, request: APIRequestContext, preset: string, variant: Variant, tag: string): Promise<void> {
  const posts = postsOf(page);
  const {playerId} = await bootFixtureSeats(page, request, 'reprocessing-plant', {query: preset === 'tv4k' ? '&consoleProfile=tv' : '&consoleProfile=auto'});
  await settle(page);
  const before = await wireOf(request, playerId);
  expect(resourcesOf(before, DIR)).toBe(1);
  await openComposer(page);

  // ── THE PRICES: two tiles, each its own printed price and nothing else; the good ONCE, after them.
  const opened = await tiles(page);
  expect(opened.length, 'two price tiles').toBe(2);
  expect(opened.map((t) => t.print), 'each tile prints ITS price — the plants, the heat').toEqual([['plant'], ['heat']]);
  expect(opened.every((t) => t.dest === 0), 'no tile repeats the addresses').toBe(true);
  expect(opened.every((t) => !t.selected), 'nothing chosen before a press').toBe(true);
  const result = await shared(page);
  expect(result, 'ONE shared result: the printed floater, both holders, after the tiles').toMatchObject({count: 1, destCount: '2', afterTiles: true});
  expect(result.print.some((name) => /floater/.test(name)), `the result prints the floater (${result.print.join(',')})`).toBe(true);
  expect([...result.dest].sort()).toEqual([DIR, MAP].sort());
  // The formula: the good stands from the first frame, the PRICE side is the reserved slot the answer fills.
  await expect(page.locator(`${ACTION_COMPOSER} [data-hero-pending="price"] .con-composer__hero-slot`), 'the reserved price').toHaveCount(1);
  await shoot(page, preset, `${tag}-01-prices`);

  // ── A seals the variant: the price side fills, the target row asks WHERE.
  await chooseTile(page, variant.index);
  await settle(page);
  await expect(page.locator(`${ACTION_COMPOSER} [data-hero-pending]`), 'the price slot is filled').toHaveCount(0);
  await expect(page.locator(`${ACTION_COMPOSER} [data-composer-target-row]`), 'the target row asks').toHaveAttribute('data-tgtrow-state', 'open');
  await shoot(page, preset, `${tag}-02-${variant.row}`);

  await openStep(page);
  expect((await crumbText(page)).toLowerCase(), 'the crumb: the card, then «ЦЕЛЬ»').toMatch(new RegExp(`${CARD_RU.toLowerCase()}.*цель`));
  await shoot(page, preset, `${tag}-03-step`);
  await answerTarget(page, DIR);
  await expect(page.locator(`${ACTION_COMPOSER} [data-composer-target-row]`), 'answered').toHaveAttribute('data-tgtrow-state', 'answered');
  await shoot(page, preset, `${tag}-04-answered`);

  await armTransferWitness(page);
  await commit(page, ACTION_COMPOSER, posts);
  const batch = (JSON.parse(posts[0]) as {responses?: Array<{for?: unknown}>}).responses ?? [];
  expect(batch.some((answer) => answer.for !== undefined), `the batch is ADDRESSED: ${posts[0]}`).toBe(true);
  await expect.poll(async () => resourcesOf(await wireOf(request, playerId), DIR), {timeout: 30_000, message: 'Dirigibles 1 → 4'}).toBe(4);
  const after = await wireOf(request, playerId);
  const other = variant.row === 'plants' ? 'heat' : 'plants';
  expect(after.thisPlayer[variant.row], `the ${variant.price} ${variant.row} were paid`).toBe(before.thisPlayer[variant.row] - variant.price);
  expect(after.thisPlayer[other], `the ${other} untouched`).toBe(before.thisPlayer[other]);
  expect(resourcesOf(after, MAP), 'Aerial Mappers untouched').toBe(0);
  await settle(page);
  const witness = await transferWitness(page);
  expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
  expect(witness.births.some((b) => b.under === `rail:${variant.row}`), `the price leaves the ${variant.row} row\n${transferTrail(witness)}`).toBe(true);
  expect(witness.births.some((b) => b.under === 'hero' && /3/.test(b.value)), `«+3» is born on the card's printed floater\n${transferTrail(witness)}`).toBe(true);
  expect(witness.landings.some((l) => l.under === `composer-card:${DIR}` && /3/.test(l.value)),
    `«+3» lands on Dirigibles' miniature\n${transferTrail(witness)}`).toBe(true);
  await shoot(page, preset, `${tag}-05-done`);
}

for (const preset of PRESETS) {
  test.describe(`TR58 Reprocessing Plant · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) plants: two PRICE tiles, ONE result with its addresses once; −3 plants → Dirigibles +3, ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await payAndLand(page, request, preset.id, PLANTS, 'a');
    });

    test(`(B) heat: the same table, −5 heat off its row (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await payAndLand(page, request, preset.id, HEAT, 'b');
    });

    test(`(C) Stormcraft: the heat split a row of the composer BEFORE the commit, the floaters back on Stormcraft (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const posts = postsOf(page);
      const {playerId} = await bootFixtureSeats(page, request, 'reprocessing-plant-stormcraft', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      expect(resourcesOf(before, STORM)).toBe(4);
      await openComposer(page);
      const split = page.locator(`${ACTION_COMPOSER} .con-composer__row[data-choice-kind="spendHeat"]`);
      await expect(split, 'no split before the heat is chosen — the step is the heat variant\'s').toHaveCount(0);
      await chooseTile(page, HEAT.index);
      await settle(page);
      // THE SPLIT — asked HERE, before A: the heat on hand and Stormcraft's floaters at 2 heat each.
      await expect(split, 'the heat split stands in the composer before the commit').toHaveCount(1);
      await expect(split.locator('.con-composer__stepper-value'), '1 heat + 2 floaters').toHaveText('2');
      await shoot(page, preset.id, 'c-01-split');
      await openStep(page);
      await answerTarget(page, STORM);
      await commit(page, ACTION_COMPOSER, posts);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), STORM), {timeout: 30_000, message: `Stormcraft 4 − 2 + 3 = 5 — the batch: ${posts[0]}`}).toBe(5);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.heat, 'the 1 heat was paid').toBe(0);
      expect(after.thisPlayer.plants, 'the plants untouched').toBe(before.thisPlayer.plants);
      await settle(page);
      await shoot(page, preset.id, 'c-02-done');
    });

    test(`(D) no holder: the tile refused, «no holder» the FIRST reason (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'reprocessing-plant-none', {query: preset.query});
      await settle(page);
      await openCardActions(page);
      const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
      await expect(tile).toHaveCount(1);
      const reasons = tile.locator('.con-cardactions__tile-reason');
      await expect(reasons.first(), 'the reason that closes both variants comes first').toContainText('Нет карты для добавления ресурса');
      await shoot(page, preset.id, 'd-01-no-holder');
    });

    test(`(E) the Reds rule: «✕ Нельзя разыграть» with the Industrialists' count (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'reprocessing-plant-locked', {query: preset.query});
      expect(await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900})).toBeTruthy();
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600})).toBeTruthy();
      expect(await focusCard(page, CARD, 12), 'TR58 focused in the hand').toBe(true);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
      await expect(verdict, 'the count of your delegates on the party').toContainText('0/2');
      await shoot(page, preset.id, 'e-01-locked');
    });
  });
}
