import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P71 «КОЛОНИАЛЬНОЕ ПРЕДСТАВИТЕЛЬСТВО» — the ninth Prelude 2 card (docs/claude/prompts/prelude2-p71-colonial-representation.md,
 * ledger CY): «Effect: you have +1 influence. Gain 3 M€ per colony you have.» The card's own play is the T05 class (the
 * influence beyond the Career through the facade, the giver named) plus a counted stock gain; its payoff is READ IN THE
 * SITTING'S RESULTS (`console-parliament-results-ledger`).
 *
 * `colonial-representation` (blue: Career step 1 = influence 1, cubes on Luna and Pluto, 12 M€, the card in hand):
 *   the hand plate reads the server's count «+6»; the composer reads «[influence] 1 → 2» and the M€ gain, nothing sent;
 *   A → ONE POST → the card lands, its M€ fly to the rail (both ends painted); the server: 12 − 10 + 6 = 8 M€, influence
 *   2 with the card as its giver; the journal names the card. Fixture: tests/e2e/fixtures/generate.ts § P71 (its dry run
 *   proves the numbers). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Colonial Representation';
const CARD_RU = 'Колониальное представительство';
const OUT = path.resolve('screenshots', 'p71');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';

type Wire = {
  game: {parliament?: {players: Array<{color: string, influence: number, influenceSources?: Array<{amount: number, source?: string}>}>}},
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const seatOf = (wire: Wire) => wire.game.parliament?.players.find((p) => p.color === wire.thisPlayer.color);

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

test.describe(`P71 Colonial Representation · +1 influence beyond the Career, 3 M€ per colony · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the hand plate «+6», the composer «influence 1 → 2», ONE POST, the M€ fly to the rail, the influence named by the card', async ({page, request}) => {
    test.setTimeout(360_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'colonial-representation', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect([before.thisPlayer.megacredits, seatOf(before)?.influence], 'the fixture: 12 M€, influence 1').toEqual([12, 1]);

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    const plate = page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-hand-count]`);
    await expect(plate, 'the hand plate: the server\'s count of the colony gain').toHaveAttribute('data-hand-count', '6');
    await shoot(page, 'a-hand');

    // ── the composer reads the whole play — and sends nothing ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const composerText = (await page.locator(COMPOSER).innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'composer', description: composerText.slice(0, 1200)});
    expect(composerText, 'the influence chip «1 → 2»').toMatch(/1\s*→\s*2/);
    expect(composerText, 'the M€ gain «+6»').toMatch(/\+\s*6/);
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'b-composer');

    // ── A: ONE POST; the card lands, its M€ fly to the rail ──
    await armTransferWitness(page);
    const stopStory = await storyboard(page, 'play');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
    await settle(page, {timeoutMs: 40_000});
    await stopStory();
    await shoot(page, 'c-played');
    const witness = await transferWitness(page);
    fs.writeFileSync(path.join(OUT, PRESET.id, 'c-trail.txt'), transferTrail(witness) + '\n');
    expect(witness.landings.some((l) => l.under.startsWith('rail:megacredits')), `the M€ landed on the rail (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, 'the server: 12 − 10 + 6 = 8 M€').toBe(8);
    expect(seatOf(after)?.influence, 'influence 1 → 2').toBe(2);
    expect(seatOf(after)?.influenceSources, 'the giver is the card, by name').toEqual([{amount: 1, source: CARD}]);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the card on the table').toContain(CARD);
    expect(posts.length, 'still ONE POST').toBe(1);

    // ── the journal names the card ──
    await press(page, 'KeyR', 1200);
    await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
    await settle(page);
    const journal = (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'journal', description: journal.slice(0, 900)});
    expect(journal, 'the journal names the card').toContain(CARD_RU);
    await shoot(page, 'd-journal');
    await press(page, 'KeyR', 1000);
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});
