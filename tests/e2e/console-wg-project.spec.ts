import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, crumbText, fetchPlayerModel, placeTile, playCardFromHand, press, settle, walkFocusUntil} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P91 «ПРОЕКТ МИРОВОГО ПРАВИТЕЛЬСТВА» — THE FIRST PRELUDE PLAYED IN THE MIDDLE OF THE GAME
 * (docs/claude/prompts/prelude2-p91-wg-project.md, ledger EH): «draw 3 preludes, play 1, discard 2».
 *
 *   (A) `-plain` — the pick stands INSIDE the hand that played the card («КАРТЫ В РУКЕ › ПРОЕКТ МИРОВОГО
 *       ПРАВИТЕЛЬСТВА › ВЫБОР ПРОЛОГА»), never the start workspace; the three cards come off the prelude deck OBJECT
 *       standing in the stage (its count is the server's); A chooses, RT «Разыграть» → ONE POST; the two others land
 *       on the object's discard (its count 0 → 2), the played one on its «Разыграно» seat; the server: Donation on
 *       the table, two discarded, 20 − 9 + 21 M€.
 *   (B) `-fizzle` — Huge Asteroid wears «Сгорит · +15 M€» BEFORE the press; RT reads «Сжечь за 15 M€»; the burn:
 *       0 → 15 M€ as ONE token born on the burnt card (PL-1469), three discarded, nothing on the table.
 *   (C) `-draw` — Biolab's draw is hosted in the same hand zone, never a full-bleed reveal.
 *   (D) `-nested` — New Partner raises a SECOND pick of two in the same zone, off the same deck object.
 *   (E) `-place` — Early Settlement's city goes to the board; the city lands; the server agrees.
 *   (F) `-not-chair` / `-short-deck` — the card is locked in the hand with its NAMED reason.
 *   (G) `valley-trust-burn` — PL-1468: the START's drew-N candidates read the same verdict (word · risk stage · hold).
 *   (H) `-forest` / (I) `-aquifer` — PL-1467: the hand steps aside for the prelude's board step (never torn down) and comes
 *       back only if the flow still owes it; owed nothing, the flow ends on the board.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P91 (each dry run proves the marker and the outcome).
 * Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'WG Project';
const CARD_RU = 'ПРОЕКТ МИРОВОГО ПРАВИТЕЛЬСТВА';
const OUT = path.resolve('screenshots', 'wg-project');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PICK = '.con-hand__outcome .con-deckpick--play';

type Wire = {
  cardsInHand?: Array<{name: string, unplayableReasons?: Array<{message: string}>}>,
  thisPlayer: {megacredits: number, tableau: Array<{name: string}>},
  game: {preludeDeckSize?: number, preludeDiscardSize?: number},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const onTable = (w: Wire, name: string) => w.thisPlayer.tableau.some((c) => c.name === name);

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
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

type Probe = {startSeen: number, standaloneDeckPick: number, revealOutsideHand: number, revealInHand: number, pickZones: number, outside: Array<string>};
/** MutationObserver + setInterval (never rAF): the DANGEROUS frames — the start workspace, a standalone band. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const p: Probe = {startSeen: 0, standaloneDeckPick: 0, revealOutsideHand: 0, revealInHand: 0, pickZones: 0, outside: []};
    (window as unknown as {__p91: Probe}).__p91 = p;
    const sample = () => {
      if (document.querySelector('.con-start') !== null) {
        p.startSeen++;
      }
      if (document.querySelector('.con-deckpick:not(.con-deckpick--embedded)') !== null) {
        p.standaloneDeckPick++;
      }
      // A cell's printed card bonus (`--bonus-mode`) is the BOARD's own story — never a batch of the play.
      for (const el of document.querySelectorAll('.con-reveal:not(.con-reveal--bonus-mode)')) {
        if (el.closest('.con-hand__outcome') !== null) {
          p.revealInHand++;
        } else if ((el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true})) {
          // Only a PAINTED one counts — a leaving node at opacity 0 is no surface the player sees.
          p.revealOutsideHand++;
          if (p.outside.length < 6) {
            p.outside.push(`${(el as HTMLElement).className} hand=${document.querySelector('.con-hand') !== null} op=${getComputedStyle(el).opacity}`);
          }
        }
      }
      p.pickZones = Math.max(p.pickZones, document.querySelectorAll('.con-hand__outcome .con-deckpick--play').length);
    };
    new MutationObserver(() => sample()).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
    window.setInterval(sample, 50);
  });
}
const probe = (page: Page) => page.evaluate(() => (window as unknown as {__p91: Probe}).__p91);

const focusedPick = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');

/** Hand → WG Project → its composer → A: the pick stands EMBEDDED in the hand. */
async function playToPick(page: Page): Promise<void> {
  expect(await playCardFromHand(page, CARD), `${CARD} was played`).toBeTruthy();
  await expect(page.locator(PICK), 'the prelude pick stands INSIDE the hand that played the card').toHaveCount(1, {timeout: 40_000});
  await expect(page.locator(`${PICK}[data-flow="choosing"]`), 'the deal has landed').toHaveCount(1, {timeout: 30_000});
}

/** A on `name` (walking the row), then RT → exactly ONE POST. */
async function choose(page: Page, posts: Array<string>, name: string): Promise<void> {
  expect(await walkFocusUntil(page, async () => await focusedPick(page) === name, () => focusedPick(page), 12), `never focused ${name}`).toBeTruthy();
  await press(page, 'Enter', 400);
  await expect(page.locator(`${PICK} [data-deckpick-slot="${name}"].con-cards__slot--picked`), `${name} is chosen`).toHaveCount(1, {timeout: 5_000});
  const before = posts.length;
  for (let attempt = 0; attempt < 3 && posts.length === before; attempt++) {
    await press(page, 'Period', 300); // RT — the commit
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(before).catch(() => undefined);
  }
  expect(posts.length, 'ONE POST').toBe(before + 1);
}

test.describe(`P91 WG Project · a prelude played mid-game · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('(A) plain: the pick in the hand, off the prelude deck object; Donation played, two discarded, 32 M€', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wg-project-plain', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    const posts = watchPosts(page);
    await armProbe(page);
    const stop = await storyboard(page, 'plain');
    await playToPick(page);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb: the hand › the card › ВЫБОР ПРОЛОГА'})
      .toMatch(new RegExp(`${CARD_RU}.*ВЫБОР ПРОЛОГА`));
    const mid = await wireOf(request, id);
    expect(mid.game.preludeDeckSize, 'three preludes left the deck').toBe((before.game.preludeDeckSize ?? 0) - 3);
    await expect(page.locator(`${PICK} [data-prelude-deck-count]`), 'the deck object reads the server').toHaveText(String(mid.game.preludeDeckSize), {timeout: 10_000});
    expect(await page.locator(`${PICK} .con-cards__slot`).count(), 'three candidates').toBe(3);
    expect(await page.locator(`${PICK} [data-prelude-burns]`).count(), 'nothing burns on this table').toBe(0);
    await shoot(page, 'A-pick');
    await choose(page, posts, 'Donation');
    await expect(page.locator(`${PICK} [data-prelude-discard-count]`), 'two land on the discard').toHaveText('2', {timeout: 20_000});
    await expect.poll(async () => onTable(await wireOf(request, id), 'Donation'), {timeout: 30_000}).toBe(true);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, '20 − 9 + 21').toBe(32);
    expect(after.game.preludeDiscardSize).toBe(2);
    await expect(page.locator(PICK), 'the pick leaves once its story is told').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'A-after');
    const p = await probe(page);
    expect(p.startSeen, 'the START workspace never rose over the hand').toBe(0);
    expect(p.standaloneDeckPick, 'never a standalone band').toBe(0);
    expect(p.pickZones, 'one pick at a time').toBe(1);
  });

  test('(B) fizzle: «Сгорит · +15 M€» before the press, RT burns it: 0 → 15 M€, three discarded', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wg-project-fizzle', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await armProbe(page);
    const stop = await storyboard(page, 'fizzle');
    await playToPick(page);
    await expect(page.locator(`${PICK} [data-deckpick-slot="Huge Asteroid"] [data-prelude-burns]`), 'the burn is shown BEFORE the press').toHaveCount(1);
    expect(await page.locator(`${PICK} [data-deckpick-slot="Donation"] [data-prelude-burns]`).count(), 'a payable prelude does not burn').toBe(0);
    await shoot(page, 'B-pick');
    await armTransferWitness(page);
    await choose(page, posts, 'Huge Asteroid');
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 30_000}).toBe(15);
    // PL-1469: the 15 M€ come OFF THE BURNT CARD — one token born on its face, landing on the M€ row.
    await expect.poll(async () => (await transferWitness(page)).landings.filter((e) => e.under === 'rail:megacredits' && e.value.includes('15')).length,
      {timeout: 20_000, message: 'the +15 token lands on the M€ row'}).toBeGreaterThan(0);
    const witness = await transferWitness(page);
    const born = witness.births.find((e) => e.value.includes('15'));
    expect(born?.under ?? '', `born on the burnt card, never out of nothing (trail:\n${transferTrail(witness)})`).toMatch(/Huge Asteroid|slot:/);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    const after = await wireOf(request, id);
    expect(onTable(after, 'Huge Asteroid'), 'a burnt prelude never reaches the table').toBe(false);
    expect(after.game.preludeDiscardSize).toBe(3);
    await expect(page.locator(PICK)).toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await stop();
    expect((await probe(page)).startSeen).toBe(0);
  });

  test('(C) draw: Biolab\'s draw is hosted in the same hand zone, never a full-bleed reveal', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wg-project-draw', {query: PRESET.query});
    await settle(page);
    const hand0 = (await wireOf(request, id)).cardsInHand?.length ?? 0;
    const posts = watchPosts(page);
    await armProbe(page);
    await playToPick(page);
    await choose(page, posts, 'Biolab');
    await expect.poll(async () => onTable(await wireOf(request, id), 'Biolab'), {timeout: 30_000}).toBe(true);
    // The drawn batch: taken in place wherever it stands (A takes the batch).
    for (let i = 0; i < 10 && ((await wireOf(request, id)).cardsInHand?.length ?? 0) < hand0 - 1 + 3; i++) {
      if (await page.locator('.con-reveal').count() > 0) {
        await shoot(page, 'C-reveal');
        await press(page, 'Enter', 900);
      } else {
        await settle(page, {timeoutMs: 20_000});
      }
    }
    expect((await wireOf(request, id)).cardsInHand?.length, 'WG Project left, three drawn').toBe(hand0 - 1 + 3);
    const p = await probe(page);
    expect(p.startSeen).toBe(0);
    expect(p.revealOutsideHand, 'the draw never left the hand for a full-bleed reveal').toBe(0);
  });

  test('(D) nested: New Partner raises a second pick of two in the same zone, off the same deck object', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wg-project-nested', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await armProbe(page);
    await playToPick(page);
    await choose(page, posts, 'New Partner');
    await expect(page.locator(`${PICK}[data-flow="choosing"] .con-cards__slot`), 'the second pick: two').toHaveCount(2, {timeout: 40_000});
    await shoot(page, 'D-second');
    const second = await page.evaluate(() => [...document.querySelectorAll('.con-deckpick--play .con-cards__slot')].map((el) => el.getAttribute('data-deckpick-slot') ?? ''));
    await choose(page, posts, second[0]);
    await expect.poll(async () => onTable(await wireOf(request, id), second[0]), {timeout: 30_000}).toBe(true);
    const after = await wireOf(request, id);
    expect(onTable(after, 'New Partner')).toBe(true);
    expect(after.game.preludeDiscardSize, 'two of the first pick + one of the second').toBe(3);
    expect((await probe(page)).startSeen).toBe(0);
  });

  test('(E) place: Early Settlement\'s city goes to the board and lands', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wg-project-place', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await armProbe(page);
    const stop = await storyboard(page, 'place');
    await playToPick(page);
    await choose(page, posts, 'Early Settlement');
    await expect(page.locator('.con-board--placing'), 'the city is placed on the board').toHaveCount(1, {timeout: 40_000});
    await shoot(page, 'E-placing');
    expect(await placeTile(page), 'the city landed').toBeTruthy();
    await expect.poll(async () => onTable(await wireOf(request, id), 'Early Settlement'), {timeout: 30_000}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    expect((await probe(page)).startSeen).toBe(0);
  });

  test('(F) locked: not the chairman / a short prelude deck — the card names its reason', async ({request, page}) => {
    test.setTimeout(120_000);
    for (const [fixture, reason] of [
      ['wg-project-not-chair', 'Requires you to be the chairman'],
      ['wg-project-short-deck', 'Fewer than 3 preludes left in the prelude deck'],
    ] as const) {
      const id = await bootFixture(page, request, fixture, {query: PRESET.query});
      const card = (await wireOf(request, id)).cardsInHand?.find((c) => c.name === CARD);
      expect(card?.unplayableReasons?.map((r) => r.message), `${fixture}: the named reason`).toContain(reason);
    }
  });
  test('(G) PL-1468 · the START\'s drew-N pick wears the same burn verdict: Valley Trust → Huge Asteroid at 0 M€ — the word, the risk stage, the hold burns it for 15 M€', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'valley-trust-burn', {query: PRESET.query, landing: 'prompt'});
    await settle(page);
    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    // A performs the first action → the three preludes are dealt as candidates into the deployment's queue.
    const asteroid = page.locator('.con-start [data-queue-slot="Huge Asteroid"]');
    for (let i = 0; i < 4 && await asteroid.count() === 0; i++) {
      await press(page, 'Enter', 1500);
    }
    await expect(asteroid, 'Huge Asteroid is dealt as a candidate').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    await expect(asteroid.locator('[data-qcard-reading]'), 'the candidate wears the verdict BEFORE the press').toHaveAttribute('data-qcard-verdict', /.+/);
    expect(await page.locator('.con-start [data-queue-slot="Donation"] [data-qcard-reading]').count(), 'a payable candidate wears no burn').toBe(0);
    await shoot(page, 'G-candidates');
    // Walk the queue onto the burning candidate, A → the RISK stage (nothing is sent), then HOLD A → the burn.
    const focused = () => page.evaluate(() => document.querySelector('.con-start .con-start__qcard--focused, .con-start [data-queue-slot].con-cards__slot--focused')
      ?.closest('[data-queue-slot]')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === 'Huge Asteroid', focused, 8), 'focused the burning candidate').toBeTruthy();
    const posts = watchPosts(page);
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-start__risk'), 'A enters the risk stage — never a silent play').toBeVisible({timeout: 10_000});
    expect(posts.length, 'the risk stage sends nothing').toBe(0);
    await shoot(page, 'G-risk');
    await page.keyboard.down('Enter');
    await expect.poll(() => posts.length, {timeout: 8_000, message: 'the HOLD commits'}).toBeGreaterThan(0);
    await page.keyboard.up('Enter');
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 30_000}).toBe(15);
    expect(onTable(await wireOf(request, id), 'Huge Asteroid'), 'burnt, never played').toBe(false);
  });
  test('(H) PL-1467 · forest: the found plant cards are taken IN the hand, then the hand STEPS ASIDE for the greenery and the flow ends on the board', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wg-project-forest', {query: PRESET.query});
    await settle(page);
    const hand0 = (await wireOf(request, id)).cardsInHand?.length ?? 0;
    const posts = watchPosts(page);
    await armProbe(page);
    const stop = await storyboard(page, 'forest');
    await playToPick(page);
    await choose(page, posts, 'Experimental Forest');
    // The server searches FIRST: the found cards stand in the hand that made the play («… › ДОБОР КАРТ»).
    await expect(page.locator('.con-hand__outcome .con-reveal'), 'the found cards stand in the hand').toHaveCount(1, {timeout: 40_000});
    await shoot(page, 'H-found');
    expect((await wireOf(request, id)).cardsInHand?.length, 'WG Project left, two plant cards found').toBe(hand0 - 1 + 2);
    // The batch is PRESENTATION (the server already holds the cards in the hand): B takes it, the batch leaves.
    for (let i = 0; i < 8 && await page.locator('.con-hand__outcome .con-reveal').count() > 0; i++) {
      await press(page, 'Escape', 900); // B = take all
    }
    await expect(page.locator('.con-reveal'), 'the batch is taken').toHaveCount(0, {timeout: 20_000});
    // …THEN the greenery: the hand steps aside for the board (never torn down mid-flow), the tile lands.
    await expect(page.locator('.con-board--placing'), 'the greenery is placed on the board').toHaveCount(1, {timeout: 40_000});
    expect(await page.locator('.con-hand').count(), 'the hand has stepped aside for the board').toBe(0);
    await shoot(page, 'H-placing');
    expect(await placeTile(page), 'the greenery landed').toBeTruthy();
    await expect.poll(async () => onTable(await wireOf(request, id), 'Experimental Forest'), {timeout: 30_000}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    expect(await page.locator('.con-hand').count(), 'nothing owed after the greenery: the flow ends on the board').toBe(0);
    const p = await probe(page);
    expect(p.startSeen).toBe(0);
    expect(p.revealOutsideHand, `the found cards never stood in a band of their own (${p.outside.join(' | ')})`).toBe(0);
  });

  test('(I) PL-1467 · aquifer: two oceans on the board and nothing after — the flow ENDS on the board, never a return into an empty hand', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'wg-project-aquifer', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await armProbe(page);
    await playToPick(page);
    await choose(page, posts, 'Great Aquifer');
    for (let ocean = 1; ocean <= 2; ocean++) {
      await expect(page.locator('.con-board--placing'), `ocean ${ocean} is placed on the board`).toHaveCount(1, {timeout: 40_000});
      expect(await page.locator('.con-hand').count(), 'the hand stays aside between the two oceans').toBe(0);
      expect(await placeTile(page), `ocean ${ocean} landed`).toBeTruthy();
    }
    await expect.poll(async () => onTable(await wireOf(request, id), 'Great Aquifer'), {timeout: 30_000}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
    expect(await page.locator('.con-hand').count(), 'nothing owed: no return into an empty hand').toBe(0);
    expect(await page.locator('.con-ws').count(), 'no workspace left standing').toBe(0);
    expect((await probe(page)).startSeen).toBe(0);
  });
});
