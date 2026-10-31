import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, commitFocusedSpace, fetchPlayerModel, focusCard, press, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {armReactionWitness, describeReactionStory, reactionStory} from './reactionWitness';

/**
 * P82 «СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ» — the series' FIRST ATTACK and the stand of «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА»
 * (docs/claude/prompts/prelude2-p82-special-permit.md, ledger DB). Blue stands as ARKLIGHT with Decomposers and Media
 * Group on the table, so ONE press wakes three reactors (the plant tag → Arklight's animal and Decomposers' microbe, the
 * event → Media Group's 3 M€).
 *
 *   A · `special-permit-locked` (the Reds rule, ONE delegate on the Greens' resolution): the verdict refuses the play with
 *       the Greens' «1/2»; A sends nothing.
 *   B · `special-permit` (a fresh table — the Greens rule; red 6 plants, green 3): the composer SHOWS the target (red —
 *       one candidate is still shown), green as the near miss «Недостаточно для кражи», «+4» plants, the price 5; A →
 *       ONE POST → the plants move, and the reactors rise — EXACTLY the server's records of that response, each its own
 *       card, nothing under them (the identity witness: no foreign face, no stacked faces, no lift carrying another
 *       card, no card in two places, no warm face painted).
 *   C · `special-permit-bot` (solo against MarsBot, its plant storage 5): the bot is a seat of the table — the target
 *       shown, the same law of the rise.
 *
 * FUNCTIONAL class — the witness's record (MutationObserver + a 16 ms sampler), never a frame count. Storyboard:
 * `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Special Permit';
const CARD_RU = 'Специальное разрешение';
const OUT = path.resolve('screenshots', 'p82');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';

type Reaction = {seq: number, owner: string, card: string};
type Seat = {color: string, name: string, plants: number, megacredits: number, tableau: Array<{name: string, resources?: number}>};
type Wire = {
  game: {cardReactions?: Array<Reaction>},
  thisPlayer: Seat,
  players: Array<Seat>,
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const resourcesOn = (w: Wire, card: string): number => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
const lastSeq = (w: Wire): number => Math.max(-1, ...(w.game.cardReactions ?? []).map((r) => r.seq));

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

const composerText = async (page: Page): Promise<string> => (await page.locator(COMPOSER).innerText()).replace(/\s+/g, ' ');

/**
 * THE TARGET STEP: the row reads «Выберите вариант…» until A descends into it — the list then SHOWS every target (one
 * candidate too) and every near miss with its reason; A on the focused target answers the row. Returns the list's text.
 */
async function pickTarget(page: Page, target: string): Promise<string> {
  expect(await pressUntil(page, 'Enter', async () => (await composerText(page)).includes(target), {tries: 3, settleMs: 1200}),
    `A descends into the target step and SHOWS «${target}»`).toBe(true);
  await settle(page);
  const list = await composerText(page);
  test.info().annotations.push({type: 'target-list', description: list.slice(0, 1500)});
  await shoot(page, 'target-list');
  expect(await pressUntil(page, 'Enter', async () => !(await composerText(page)).includes('Выберите вариант…'), {tries: 3, settleMs: 1200}),
    'A on the target answers the step').toBe(true);
  await settle(page);
  return list;
}

/**
 * The play and its rise, judged against the SERVER: ONE POST, then every reactor the director declared is a card of the
 * viewer's records of THAT response (nothing older, nothing foreign), every one of those records rose, and the witness
 * saw no face it could not account for.
 */
async function playAndJudgeTheRise(page: Page, request: APIRequestContext, id: string, posts: Array<string>, label: string): Promise<{before: Wire, after: Wire}> {
  const before = await wireOf(request, id);
  const seq0 = lastSeq(before);
  await armTransferWitness(page);
  await armReactionWitness(page);
  const stop = await storyboard(page, label);
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'the play is ONE POST (the target pre-collected in the composer)').toBe(1);
  expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
  await page.locator('.con-reaction__face[data-reaction-card], [data-reaction-lifted]').first().waitFor({state: 'attached', timeout: 30_000}).catch(() => undefined);
  await shoot(page, `${label}-rise`);
  await settle(page, {timeoutMs: 60_000});
  await waitForBoardHome(page, 40);
  await stop();
  const after = await wireOf(request, id);
  const records = (after.game.cardReactions ?? []).filter((r) => r.seq > seq0 && r.owner === after.thisPlayer.color);
  const recorded = [...new Set(records.map((r) => r.card))].sort();
  const story = await reactionStory(page);
  const told = describeReactionStory(story);
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  fs.writeFileSync(path.join(OUT, PRESET.id, `${label}-reaction.json`), JSON.stringify({recorded, story}, null, 1));
  test.info().annotations.push({type: 'reaction', description: `recorded=[${recorded.join(', ')}] ${told}`});
  const witness = await transferWitness(page);
  fs.writeFileSync(path.join(OUT, PRESET.id, `${label}-trail.txt`), transferTrail(witness) + '\n');
  expect(story.verdicts, `the identity witness saw no face it could not account for — ${told}`).toEqual([]);
  expect([...story.declared].sort(), `the reactors that rose are EXACTLY the server's records of this press (${recorded.join(', ')}) — ${told}`).toEqual(recorded);
  expect(endsOverGlass(witness), `no end over glass or nothing\n${transferTrail(witness)}`).toEqual([]);
  return {before, after};
}

test.describe(`P82 Special Permit · the attack's target shown, only the card that fired rises · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · the Reds rule, one delegate on the Greens\' resolution: the verdict refuses the play «1/2»; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'special-permit-locked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    const text = (await verdict.innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'verdict', description: text});
    expect(text, 'the Greens\' road counted: 1 of 2').toMatch(/1\s*\/\s*2/);
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('B · the composer shows the target and the near miss; ONE POST; the plants move; EXACTLY the three reactors rise, nothing under them', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'special-permit', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const start = await wireOf(request, id);
    const red = start.players.find((p) => p.plants === 6);
    const green = start.players.find((p) => p.plants === 3);
    expect(red !== undefined && green !== undefined, 'the fixture: red 6 plants, green 3').toBe(true);
    expect(start.cardsInHand?.find((c) => c.name === CARD)?.calculatedCost, 'P82 costs 5').toBe(5);

    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'the Greens rule on a fresh table: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const composer = await composerText(page);
    test.info().annotations.push({type: 'composer', description: composer.slice(0, 1500)});
    expect(composer, 'the gain: 0 → 4 plants').toMatch(/0\s*→\s*4/);
    expect(composer, '«Сработает» promises the three answers (Arklight +1, Decomposers +1, Media Group +3)').toMatch(/Сработает:\s*\+1\s*\+1\s*\+3/);
    await shoot(page, 'b-composer');
    const list = await pickTarget(page, red!.name);
    expect(list, 'the near miss is shown — green, with its reason').toContain(green!.name);
    expect(list, 'the near miss names why').toContain('Недостаточно для кражи');
    expect(posts.length, 'nothing sent before the commit').toBe(0);

    const {before, after} = await playAndJudgeTheRise(page, request, id, posts, 'b');
    const redAfter = after.players.find((p) => p.color === red!.color)!;
    expect([after.thisPlayer.plants - before.thisPlayer.plants, redAfter.plants], 'the server: blue +4, red 6 → 2').toEqual([4, 2]);
    expect(resourcesOn(after, 'Decomposers') - resourcesOn(before, 'Decomposers'), 'Decomposers +1 microbe').toBe(1);
    expect(resourcesOn(after, 'Arklight') - resourcesOn(before, 'Arklight'), 'Arklight +1 animal').toBe(1);
    expect(after.thisPlayer.megacredits, 'M€: 10 − 5 + 3 (Media Group)').toBe(before.thisPlayer.megacredits - 5 + 3);
    await shoot(page, 'b-board');

    // The journal names the attack.
    await press(page, 'KeyR', 1200);
    await expect(page.locator('.con-journal'), 'the journal opened').toHaveCount(1);
    await settle(page);
    const journal = (await page.locator('.con-journal').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({type: 'journal', description: journal.slice(0, 900)});
    expect(journal, 'the journal names the card').toContain(CARD_RU);
    await press(page, 'KeyR', 1000);
    expect(pageErrors, 'no page errors').toEqual([]);
  });

  test('C · against MarsBot: the bot is a seat of the table — the target shown; ONE POST; the same law of the rise', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'special-permit-bot', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const start = await wireOf(request, id);
    const bot = start.players.find((p) => p.color !== start.thisPlayer.color);
    expect(bot, 'the bot sits at the table').toBeDefined();
    await focusInHand(page);
    await expect(page.locator('.con-hand__verdictbar'), 'playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    test.info().annotations.push({type: 'composer', description: (await composerText(page)).slice(0, 1500)});
    await shoot(page, 'c-composer');
    // The bot's seat reads by its console name («Бот»), never the engine's.
    await pickTarget(page, 'Бот');
    expect(posts.length, 'nothing sent before the commit').toBe(0);
    const {before, after} = await playAndJudgeTheRise(page, request, id, posts, 'c');
    expect(after.thisPlayer.plants - before.thisPlayer.plants, 'the server: blue +4 plants off the bot').toBe(4);
    await shoot(page, 'c-board');
    expect(pageErrors, 'no page errors').toEqual([]);
  });

  test('D · STALE — a standard-project city first (Pets answers it on the city\'s payout plate), THEN P82: only P82\'s own reactors rise — never a group the earlier press left', async ({page, request}) => {
    test.setTimeout(480_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'special-permit-stale', {query: PRESET.query});
    await settle(page);
    const start = await wireOf(request, id);
    expect(start.thisPlayer.tableau.map((c) => c.name), 'Pets on blue\'s table').toContain('Pets');
    // PRESS 1 — the city: Pets' animal is told by the city's payout plate (its host flies it itself).
    await armReactionWitness(page);
    await openStandardCity(page);
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const city = await wireOf(request, id);
    expect(resourcesOn(city, 'Pets') - resourcesOn(start, 'Pets'), 'the city fed Pets').toBe(1);
    test.info().annotations.push({type: 'press-1', description: describeReactionStory(await reactionStory(page))});
    // PRESS 2 — P82: its scene asks for ITS reactors.
    const posts = watchPosts(page);
    await focusInHand(page);
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const red = city.players.find((p) => p.plants === 6);
    await pickTarget(page, red!.name);
    await playAndJudgeTheRise(page, request, id, posts, 'd');
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});

/** The wheel → «Стандартные проекты» → «Город» → the first legal cell, committed (the BOARD road of `console-card-reaction`). */
async function openStandardCity(page: Page): Promise<void> {
  await press(page, 'Comma', 900);
  await expect(page.locator('.con-quick'), 'the wheel is open').toBeVisible({timeout: 15_000});
  await press(page, 'Enter', 1200);
  await expect(page.locator('.con-stdp'), 'the standard projects stand').toBeVisible({timeout: 15_000});
  let hit = false;
  for (let i = 0; i < 16 && !hit; i++) {
    const step = await page.evaluate(() => {
      const at = document.querySelector('.con-stdp__card--focused');
      const target = document.querySelector('.con-stdp__card[data-stdp-card="City"]');
      if (at === null || target === null) {
        return 'none';
      }
      if (at === target) {
        return 'hit';
      }
      const a = at.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      return Math.abs(dy) > a.height / 2 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    });
    expect(step, 'the City card stands on the screen').not.toBe('none');
    hit = step === 'hit';
    if (!hit) {
      await press(page, step, 280);
    }
  }
  expect(hit, 'the cursor reached City').toBe(true);
  await press(page, 'Enter', 900);
  await expect(page.locator('.con-board--placing'), 'the city placement opened').toBeVisible({timeout: 20_000});
  expect(await commitFocusedSpace(page, 0), 'the city committed').toBe(true);
}
