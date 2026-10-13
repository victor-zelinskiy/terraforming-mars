import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootIntoGame, crumbText, fetchPlayerModel, focusCard, press, settle, soloGameConfig, waitForBoardHome} from './consoleStart';

/**
 * A CARD FROM THE HAND IS CHOSEN IN THE HAND — at every depth (the owner's hard rule, 2026-10-13).
 *
 * The owner's TV photo: «КАРТЫ В РУКЕ › МАРСИАНСКИЙ УНИВЕРСИТЕТ › ВЫБОР» over a column of thirteen card NAMES under
 * «ВЫБЕРИТЕ КАРТУ, ЧТОБЫ СБРОСИТЬ». TR51 (`e8315a4524`) moved the table's questions into the composer, and Mars
 * University's — «discard a card to draw one» beside «do nothing» — is an `or` whose option is itself a pick FROM THE
 * HAND; both composers descended into every such option through their own flat list. Now the option's door is ONE
 * verdict (`handPickRouting.orOptionDoor`): a hand pick opens the HAND ALBUM in pick mode, wearing the discard's own
 * skin off the server's raw marker and leaving nothing (a PRE-SELECT — the card goes with the play's ONE POST), and
 * the answer returns into the option it was asked for.
 *
 * …and the question whose ONE answer is that pick has no option list at all (the owner, 2026-10-13): «do nothing» is
 * a BUTTON — RT, named by the plate in the album's question line («Не сбрасывать · без [+1 карта]») — so A on the row
 * opens the ALBUM directly, and B there returns to the ROW.
 *
 * Against a real server:
 *   A. (fhd + tv4k) Mars University played from the hand — its own question: the reaction row → A → the HAND in pick
 *      mode straight away (no option list ever stands, the crumb's tail «Сброс карты», the decline's plate and its RT
 *      on the bar) → B returns to the ROW, nothing answered → A again → a card → back in the composer, the row naming
 *      it → A → ONE POST carrying the addressed answer → the server: the card discarded, one drawn, nothing asked
 *      again (the harness's `preselectGuard` / `postCommitGuard` stay silent).
 *   B. (fhd) The table's question — Mars University already on the table answers a science tag played after it: the
 *      same door from a play of ANOTHER card; the first play DECLINES its own question with RT inside the album.
 *
 * Heavy 4K: run with `--workers=1`.
 */

const MU = 'Mars University';
/** A plain science tag (the table question's trigger in B). */
const SCIENCE_TAG = 'Adaptation Technology';
/** The hand the discard is chosen from — enough cards that a list would be a COLUMN, as on the photo. */
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan', 'Lichen', 'Algae'];
const DISCARD = 'Investment Loan';
const PLAY_COMPOSER = '.con-composer--play';
const OUT = path.resolve('screenshots', 'hand-pick-preselect', process.env.TM_E2E_SHOTS_TAG ?? '');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  waitingFor?: {type: string, discardPrompt?: unknown, options?: Array<{discardPrompt?: unknown}>};
  thisPlayer: {cardsInHandNbr: number, tableau: Array<{name: string}>};
};

type OrAnswer = {type: string, index?: number, response?: {type: string, cards?: Array<string>}, for?: {role?: string, source?: {card?: string}}};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
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

/** RT → «КАРТЫ» → the card → A: the play composer, nothing sent. */
async function openPlayComposerOf(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${card}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY_COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
  await expect(page.locator(`${PLAY_COMPOSER} .con-composer__row--reaction[data-reaction-card="${MU}"]`),
    'the table question stands as a row of the composer').toHaveCount(1, {timeout: 20_000});
  await settle(page);
}

/** Walk the composer's cursor onto Mars University's reaction row (↑ to the top, then ↓ — the rows are few). */
async function focusReactionRow(page: Page): Promise<void> {
  const onRow = () => page.locator(`${PLAY_COMPOSER} .con-composer__row--focused[data-reaction-card="${MU}"]`).count();
  for (let i = 0; i < 6 && await onRow() === 0; i++) {
    await press(page, 'ArrowUp', 250);
  }
  for (let i = 0; i < 10 && await onRow() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  expect(await onRow(), 'the cursor reached the reaction row').toBe(1);
}

/** The hand in PICK mode — the album's own select classes (the card being played rides it DISABLED). */
const handPicking = (page: Page) => page.locator('.con-hand[data-flow="picking"], .con-hand .con-hand__slot--select-disabled, .con-hand .con-hand__slot--select-picked');

/**
 * THE DOOR: A on the reaction ROW opens the hand album DIRECTLY — the question's one answer is a card from the hand —
 * and nothing else: no option list, no list of names stands anywhere while the hand picks, the crumb's tail names the
 * discard, and the decline is RT, its plate standing in the album's question line.
 */
async function enterDiscardAlbum(page: Page, preset: string, shotName: string): Promise<void> {
  await focusReactionRow(page);
  for (let i = 0; i < 3 && await handPicking(page).count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(handPicking(page).first(), 'A on the discard opens the HAND in pick mode').toBeVisible({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  expect(await page.locator('.con-composer__sublist').count(), 'no option list stood before the album — and none stands while it picks').toBe(0);
  expect(await page.locator(`${PLAY_COMPOSER}:visible`).count(), 'the composer waits underneath, hidden').toBe(0);
  const crumb = await crumbText(page);
  expect(crumb.toLowerCase(), `the crumb's tail names the discard — «${crumb}»`).toContain('сброс карты');
  // The card being played flew HOME into its own slot and sits there as the question's source («Разыгрывается»,
  // popped on its touchdown) — the cursor starts on a candidate, never on it.
  await expect(page.locator('.con-hand__slot--source'), 'the played card is seated in its slot').toHaveCount(1);
  await expect(page.locator('.con-hand__slot--source .con-cards__pickband--source'), 'its band says it is being played').toBeVisible({timeout: 5_000});
  expect(await page.locator('.con-hand__slot--source.con-hand__slot--selected').count(), 'the cursor starts on a candidate').toBe(0);
  // Every candidate stands in the album as the real card.
  for (const name of FILLER) {
    await expect(page.locator(`.con-hand [data-zoom-slot="${name}"]`), `«${name}» stands in the album`).toHaveCount(1);
  }
  // THE DECLINE is a button: its plate in the album's question line names RT and what it forgoes, and the bar agrees.
  const plate = page.locator('.con-hand__question [data-decline-plate]');
  await expect(plate, 'the decline stands in the question line').toBeVisible();
  await expect(plate).toContainText(/Не сбрасывать/i);
  await expect(plate.locator('[data-decline-forgone]'), 'what the refusal forgoes rides beside it').toHaveCount(1);
  await expect(page.locator('.con-cmdbar')).toContainText(/Не сбрасывать/i);
  await shoot(page, preset, shotName);
}

/** The commit: walk onto the CTA, A until exactly one POST leaves. */
async function commitPlay(page: Page, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 10 && await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  const before = posts.length;
  for (let attempt = 0; attempt < 4 && posts.length === before; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length - before, 'A sent exactly one request').toBe(1);
}

/** The Mars University answer inside a posted batch (the `or` carrying the card pick, or the leaf). */
function muAnswerOf(post: string): OrAnswer | undefined {
  const body = JSON.parse(post) as {responses?: Array<OrAnswer>};
  return (body.responses ?? []).find((r) => r.type === 'or' && r.for?.source?.card === MU);
}

for (const preset of PRESETS) {
  test.describe(`a hand pick inside an \`or\` is the hand album · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · Mars University's own question: the discard is chosen in the HAND, rides the ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const posts = watchPosts(page);
      const hand = [MU, ...FILLER];
      const playerId = await bootIntoGame(page, request, {
        config: soloGameConfig({customProjectCards: [...hand]}),
        cards: [...hand],
        query: preset.query,
      });
      await settle(page);
      const before = await wireOf(request, playerId);
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: the card and its discard candidates in hand').toEqual(expect.arrayContaining(hand));
      const handBefore = before.thisPlayer.cardsInHandNbr;
      const postsAtStart = posts.length;

      // ── 1. The composer, the reaction row standing.
      await openPlayComposerOf(page, MU);
      await shoot(page, preset.id, 'A1-composer');
      const row = page.locator(`${PLAY_COMPOSER} .con-composer__row--reaction[data-reaction-card="${MU}"]`);

      // ── 2. A on the row → the HAND album directly; B → back to the ROW (there is no list above the album).
      let stopStory = await storyboard(page, preset.id, 'enter');
      await enterDiscardAlbum(page, preset.id, 'A3-album');
      await stopStory();
      stopStory = await storyboard(page, preset.id, 'back');
      await press(page, 'Escape', 1200);
      await expect(page.locator(`${PLAY_COMPOSER}:visible`), 'B returns to the composer').toHaveCount(1, {timeout: 10_000});
      await expect(page.locator(`${PLAY_COMPOSER} .con-composer__sublist`), '…to the ROW — no option list above the album').toHaveCount(0);
      await expect(handPicking(page), 'the album let go').toHaveCount(0);
      await expect(row, 'B answered nothing — it is never the decline').toHaveClass(/con-composer__row--missing/);
      await settle(page);
      await stopStory();
      await enterDiscardAlbum(page, preset.id, 'A4-album-again');

      // ── 3. A card → back in the composer, the row answered with THAT card; nothing sent.
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, DISCARD, slots * 2 + 6), `never focused «${DISCARD}» in the album`).toBe(true);
      stopStory = await storyboard(page, preset.id, 'answer');
      for (let i = 0; i < 3 && await page.locator(`${PLAY_COMPOSER}:visible`).count() === 0; i++) {
        await press(page, 'Enter', 1400);
      }
      await expect(page.locator(`${PLAY_COMPOSER}:visible`), 'A on the card answers and returns to the composer').toHaveCount(1, {timeout: 15_000});
      await settle(page);
      await stopStory();
      await expect(row, 'the row is answered').not.toHaveClass(/con-composer__row--missing/);
      expect(posts.length - postsAtStart, 'nothing sent before the play\'s own A').toBe(0);
      await shoot(page, preset.id, 'A5-answered');

      // ── 4. ONE POST, the answer ADDRESSED to Mars University's question, nesting the card.
      await commitPlay(page, posts);
      const answer = muAnswerOf(posts[posts.length - 1]);
      expect(answer, 'the batch carries Mars University\'s answer, addressed to it').toBeDefined();
      expect(answer?.index, 'the discard option').toBe(0);
      expect(answer?.response?.cards, 'nesting the card chosen in the album').toEqual([DISCARD]);

      // ── 5. The server: the card on the table, the discard gone, one drawn — and nothing asked again.
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === MU),
        {timeout: 30_000, message: 'the card is on the table'}).toBe(true);
      const after = await wireOf(request, playerId);
      expect(after.cardsInHand?.map((c) => c.name), 'the pre-selected card was discarded').not.toContain(DISCARD);
      expect(after.thisPlayer.cardsInHandNbr, 'the hand: −the card −the discard +1 drawn').toBe(handBefore - 2 + 1);
      const wf = after.waitingFor;
      expect(wf?.discardPrompt !== undefined || (wf?.options ?? []).some((o) => o.discardPrompt !== undefined),
        'no discard stands after the batch').toBe(false);
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      await expect(handPicking(page), 'the hand never comes back in pick mode').toHaveCount(0);
      expect(await page.locator('.con-decision').count(), 'no live decision was raised — the question was answered').toBe(0);
      await shoot(page, preset.id, 'A6-board');
    });

    if (preset.id === 'fhd') {
      test('B · the table\'s question: Mars University on the table answers a science tag — the same door', async ({page, request}) => {
        test.setTimeout(300_000);
        const posts = watchPosts(page);
        const hand = [MU, SCIENCE_TAG, ...FILLER];
        const playerId = await bootIntoGame(page, request, {
          config: soloGameConfig({customProjectCards: [...hand]}),
          cards: [...hand],
          query: preset.query,
        });
        await settle(page);

        // ── 1. Mars University itself, DECLINED — RT inside the album: the composer takes the row back, answered with
        //       the refusal in its own words, and the play's ONE POST carries the skip.
        await openPlayComposerOf(page, MU);
        await enterDiscardAlbum(page, preset.id, 'B0-album-decline');
        const stopStory = await storyboard(page, preset.id, 'decline');
        for (let i = 0; i < 3 && await page.locator(`${PLAY_COMPOSER}:visible`).count() === 0; i++) {
          await press(page, 'Period', 1400);
        }
        await expect(page.locator(`${PLAY_COMPOSER}:visible`), 'RT declines and returns to the composer').toHaveCount(1, {timeout: 15_000});
        await expect(handPicking(page), 'the album let go').toHaveCount(0);
        await settle(page);
        await stopStory();
        const muRow = page.locator(`${PLAY_COMPOSER} .con-composer__row--reaction[data-reaction-card="${MU}"]`);
        await expect(muRow).not.toHaveClass(/con-composer__row--missing/);
        await expect(muRow, 'the row reads the refusal, never «Ничего не делать»').toContainText(/Не сбрасывать/i);
        await shoot(page, preset.id, 'B0-declined');
        await commitPlay(page, posts);
        const declined = muAnswerOf(posts[posts.length - 1]);
        expect(declined?.index, 'the skip option').toBe(1);
        expect(declined?.response?.type, 'a bare option — nothing nested').toBe('option');
        await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === MU),
          {timeout: 30_000, message: 'Mars University is on the table'}).toBe(true);
        await settle(page, {timeoutMs: 30_000});
        await waitForBoardHome(page, 30);
        const handBefore = (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr;

        // ── 2. A science tag: the table's question is a row of THIS card's composer, and its discard is the album.
        await openPlayComposerOf(page, SCIENCE_TAG);
        await enterDiscardAlbum(page, preset.id, 'B1-album');
        const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
        expect(await focusCard(page, DISCARD, slots * 2 + 6), `never focused «${DISCARD}» in the album`).toBe(true);
        for (let i = 0; i < 3 && await page.locator(`${PLAY_COMPOSER}:visible`).count() === 0; i++) {
          await press(page, 'Enter', 1400);
        }
        await expect(page.locator(`${PLAY_COMPOSER}:visible`)).toHaveCount(1, {timeout: 15_000});
        await settle(page);
        await commitPlay(page, posts);
        const answer = muAnswerOf(posts[posts.length - 1]);
        expect(answer?.index).toBe(0);
        expect(answer?.response?.cards).toEqual([DISCARD]);

        await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === SCIENCE_TAG),
          {timeout: 30_000, message: 'the science card is on the table'}).toBe(true);
        const after = await wireOf(request, playerId);
        expect(after.cardsInHand?.map((c) => c.name)).not.toContain(DISCARD);
        expect(after.thisPlayer.cardsInHandNbr, 'the hand: −the card −the discard +1 drawn').toBe(handBefore - 2 + 1);
        await settle(page, {timeoutMs: 30_000});
        await waitForBoardHome(page, 30);
        expect(await page.locator('.con-decision').count(), 'no live decision — the table\'s question was answered before the press').toBe(0);
        await shoot(page, preset.id, 'B2-board');
      });
    }
  });
}
