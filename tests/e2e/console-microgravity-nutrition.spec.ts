import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P79 MICROGRAVITY NUTRITION — the SEVENTEENTH Prelude 2 card: «+1 M€ production per colony you have», a counted
 * production DECLARATION (the hand-counted `bespokePlay` gone). The fixture `microgravity-nutrition`: blue's cubes on two
 * colony tiles, red's on a third, 20 M€, the card in the hand. What the declaration brings for free, witnessed:
 *   (1) the hand plate reads the server's count «+2»;
 *   (2) the composer's «ПОЧЕМУ» reads ONE term — the colonies, 2 — and the result «+2»;
 *   (3) A → ONE POST, the card on the table, the server's M€ production +2, every token's ends painted.
 */

const CARD = 'Microgravity Nutrition';
const OUT = path.resolve('screenshots', 'p79');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';

type Wire = {thisPlayer: {megacredits: number, megacreditProduction: number, tableau: Array<{name: string}>}};
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

test.describe(`P79 Microgravity Nutrition · a counted production per colony · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the hand plate «+2», «Ваши колонии: 2» in the composer, ONE POST, M€ production +2', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'microgravity-nutrition', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect(before.thisPlayer.megacredits, 'the fixture: 20 M€').toBe(20);

    // (1) the hand plate — the server's counted number.
    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`), 'the hand plate: the server\'s count')
      .toHaveAttribute('data-hand-count', '2');
    await shoot(page, 'a-hand');

    // (2) the composer — ONE term, the colonies.
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const why = page.locator(`${COMPOSER} [data-count-why]`);
    await expect(why, 'the «why» strip stands').toHaveCount(1);
    // ONE term is the strip's own reading (`data-count-why-total`) — a sum of parts only past one term.
    await expect(why.locator('[data-count-term]'), 'one term — no sum of parts').toHaveCount(0);
    await expect(why, 'the colonies: 2').toHaveAttribute('data-count-why-total', '2');
    await expect(why.locator('[data-count-result]'), 'the result').toContainText('+2');
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    // (3) A — ONE POST, the production ticks on its token.
    await armTransferWitness(page);
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD),
      {timeout: 40_000, message: 'the card is on the table'}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
    await shoot(page, 'c-played');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacreditProduction - before.thisPlayer.megacreditProduction, 'M€ production +2').toBe(2);
    expect(after.thisPlayer.megacredits, '20 − 11').toBe(9);
    expect(posts.length, 'still ONE POST').toBe(1);
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'c-trail.txt'), transferTrail(witness) + '\n');
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    expect(witness.landings.some((l) => /megacredits/.test(l.under ?? '')), `the production token landed on the M€ row\n${transferTrail(witness)}`).toBe(true);
  });
});
