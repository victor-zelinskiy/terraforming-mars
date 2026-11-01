import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P81 SOIL STUDIES — the EIGHTEENTH Prelude 2 card: «requires −4 °C or colder; 1 plant per Venus tag, plant tag
 * (INCLUDING THIS ONE) and colony you have». The fixtures (tests/e2e/fixtures/generate.ts § P81 — the dry run proves the
 * +5): Venus Governor (2 Venus) and Arctic Algae (1 plant) on blue's table, a cube on the first colony tile, the card
 * in the hand, 20 M€.
 *   (1) `soil-studies-locked` (−2 °C): the verdict refuses the play with the temperature; A sends nothing;
 *   (2) the hand plate «+5»; the composer's «РАСЧЁТ» — the ROW [V][plant] 4 «в т.ч. эта карта 1» + the colonies 1 → +5,
 *       ONE line, nothing cut;
 *   (3) the composer's sheet (DJ): the price said once on ONE line, the commit a plate;
 *   (4) A → ONE POST, the card face down in the events, +5 plants on the server, every token's ends painted.
 */

const CARD = 'Soil Studies';
const OUT = path.resolve('screenshots', 'p81');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';

type Wire = {thisPlayer: {megacredits: number, plants: number, tableau: Array<{name: string}>}};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
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

/** RT → the wheel's centre (the hand) → the card focused. */
async function focusInHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
}

test.describe(`P81 Soil Studies · «including this one» named, the play's sheet · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · −2 °C: the verdict names the temperature; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'soil-studies-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    // The verdict's short form: «Температура -2/≤-4°C» — the scale now against the printed bound.
    await expect(verdict, 'the reason: the temperature').toContainText(/Температура\s*-2\s*\/\s*≤\s*-4/);
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · the hand plate «+5», «РАСЧЁТ» of two terms with «эта карта 1», the sheet, ONE POST, +5 plants', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'soil-studies', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect([before.thisPlayer.megacredits, before.thisPlayer.plants], 'the fixture: 20 M€, no plants').toEqual([20, 0]);

    // (2) the hand plate — the server's counted number, this card included.
    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`), 'the hand plate: +5')
      .toHaveAttribute('data-hand-count', '5');
    await shoot(page, 'b-hand');

    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const why = page.locator(`${COMPOSER} [data-count-why]`);
    await expect(why, 'the «РАСЧЁТ» strip stands').toHaveCount(1);
    const terms = why.locator('[data-count-term]');
    await expect(terms, 'two terms — the tag row and the colonies').toHaveCount(2);
    await expect(terms.nth(0)).toHaveAttribute('data-count-term-n', '4');
    await expect(terms.nth(0).locator('[data-count-self]'), '«в т.ч. эта карта 1»').toHaveAttribute('data-count-self', '1');
    await expect(terms.nth(1)).toHaveAttribute('data-count-term-n', '1');
    await expect(why.locator('[data-count-result]'), 'the result').toContainText('+5');
    const strip = await why.evaluate((el) => {
      const tops = Array.from(el.children).map((c) => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2));
      return {spread: Math.max(...tops) - Math.min(...tops), sw: el.scrollWidth, cw: el.clientWidth};
    });
    test.info().annotations.push({type: 'count-why', description: JSON.stringify(strip)});
    expect(strip.spread, 'ONE line — the three terms do not wrap').toBeLessThanOrEqual(12);
    expect(strip.sw, 'nothing cut').toBeLessThanOrEqual(strip.cw + 2);

    // (3) the sheet: the price said once, the commit a plate.
    const pay = page.locator(`${COMPOSER} .con-pay`);
    await expect(pay, 'one lane, nothing to shape → one line').toHaveAttribute('data-pay-density', 'line');
    await expect(page.locator(`${COMPOSER} .con-paystatus`), 'no «✓ Оплачено» / «ТОЧНАЯ ОПЛАТА»').toHaveCount(0);
    await expect(pay.locator('[data-pay-keep] .con-pay__keep-after'), 'the wallet after: 20 − 13').toHaveText('7');
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'c-composer');

    // (4) A — ONE POST, the plants tick on their tokens.
    await armTransferWitness(page);
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.plants,
      {timeout: 40_000, message: 'the server pays +5 plants'}).toBe(5);
    await settle(page, {timeoutMs: 40_000});
    await shoot(page, 'd-played');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, '20 − 13').toBe(7);
    expect(posts.length, 'still ONE POST').toBe(1);
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'd-trail.txt'), transferTrail(witness) + '\n');
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    expect(witness.landings.some((l) => /plants/.test(l.under ?? '')), `the plants landed on the plants row\n${transferTrail(witness)}`).toBe(true);
  });
});
