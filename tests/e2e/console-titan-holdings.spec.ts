/*
 * TR84 TITAN HOLDINGS — the seventh new corporation of Turmoil Redux (`docs/TURMOIL_REDUX_TITAN_HOLDINGS.md`): «50 M€ +
 * 2 M€ production, Earth + Jovian; after you play a Mars, Earth, Venus, Jovian, or Moon tag (including these), add 1
 * leverage here; spend 2 leverage from here to add 1 delegate to a resolution, OR 4 to add 2». On the TV profile:
 *
 *  A · THE START (a real start flow, Titan forced): the deferred corporation's status rail reads «Сработает» with its
 *      OWN leverage (its Earth + Jovian — «including these»); A → the corporation lands and pays itself: the server
 *      holds 2 leverage, Titan rises (in its place or at the stage), tokens are born on its printed effect row.
 *  B · A HAND PLAY + THE ACTION (`titan`, 3 leverage): the composer's «Сработает» names a leverage for Earth Office;
 *      A → 4. «Действия карт»: TWO tiles (the printed rows); the first → «Выбрать резолюцию» → the Parliament takes
 *      the stage, the locked receipt reads «Карта · 2 [leverage]»; A → ONE batch POST → 2 leverage left INSIDE the
 *      answer, one delegate from the reserve on the chosen resolution.
 *  C · TWO DELEGATES (`titan-two`, 4 leverage): the second tile → the receipt reads 4 → A → both delegates on ONE
 *      resolution, the card emptied.
 *
 * TIMING class (`timingSpecs.ts`): the rise and the flights are sampled motion — `--exclusive --workers=1` on the box.
 * The rule (the predicate, the twin, the branches, the price inside the answer) is pinned server-side
 * (`TitanHoldings.spec.ts`); the text without the Moon client-side (`cardTextVariants.spec.ts`).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, createGameWithCards, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, pickCards, playQueueCard,
  press, pressUntil, sendPlayerInput, settle, soloGameConfig, submitSummary, waitForBoardHome, waitQueueIdle, walkFocusUntil, walkToSummary,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 'titan');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const TITAN = 'Titan Holdings';
const EARTH_CARD = 'Earth Office';
const voteMode = '.con-cardactions .con-parl--embedded [data-parl-vote-door="card"]';
const composer = '.con-cardactions .con-composer';

type Wire = {
  thisPlayer: {color: string, actionsThisGeneration: Array<string>, tableau: Array<{name: string, resources?: number}>};
  game: {
    gameAge: number;
    parliament: {
      slots: Array<{party: string, totalVotes: number, votes: Array<{owner: string}>}>;
      players: Array<{color: string, lobby: boolean, reserve: number}>;
    };
  };
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}
const leverage = (w: Wire): number => w.thisPlayer.tableau.find((c) => c.name === TITAN)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, PRESET.id, `${name}.png`)});
}

function writeTrail(scene: string, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/titan-${scene}-${PRESET.id}.txt`, trail);
}

/** Any face of Titan lifted in its place, risen out of the receiving stage, or at the stage of the reaction layer. */
async function armRiseProbe(page: Page): Promise<void> {
  await page.evaluate((card) => {
    const w = window as unknown as {__rose: boolean};
    w.__rose = false;
    window.setInterval(() => {
      if (document.querySelector(`[data-played-key="${card}"][data-reaction-lifted], [data-played-key="${card}"] [data-reaction-lifted], ` +
        `[data-reaction-home="${card}"][data-reaction-lifted], .con-recv__emerge[data-played-key="${card}"], ` +
        `.con-reaction__face[data-reaction-card="${card}"]`) !== null) {
        w.__rose = true;
      }
    }, 16);
  }, TITAN);
}

async function roseSeen(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as {__rose?: boolean}).__rose === true);
}

const titanTiles = (page: Page) => page.locator(`.con-cardactions__tile[data-action-card="${TITAN}"]`);

/** The index of the focused tile among Titan's tiles (−1: the cursor is elsewhere). */
const focusedTitanTile = (page: Page) => page.evaluate((card) => {
  const tiles = Array.from(document.querySelectorAll(`.con-cardactions__tile[data-action-card="${card}"]`));
  return tiles.findIndex((t) => t.classList.contains('con-cardactions__tile--focused'));
}, TITAN);

/** «ВЫБРАТЬ РЕЗОЛЮЦИЮ» — one press, verified by what it opens (a second A once the mode is up is the COMMIT). */
async function chooseResolution(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) => document.querySelector(sel) !== null, voteMode);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 3_000}).toBe(true).catch(() => undefined);
  }
  await page.locator(voteMode).waitFor({timeout: 30_000});
  await expect(page.locator('.con-cardactions .con-composer--parlstep'), 'the setup parked under the step').toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** The action's tile `index` (0 — 2 leverage, 1 — 4) → its door → the vote; then A, ONE batch POST. */
async function voteThroughTile(page: Page, request: APIRequestContext, playerId: string, index: 0 | 1, posts: Array<string>): Promise<void> {
  await openCardActions(page);
  await expect(titanTiles(page), 'the two printed rows are two tiles').toHaveCount(2);
  expect(await walkFocusUntil(page, async () => await focusedTitanTile(page) === index, async () => String(await focusedTitanTile(page)), 18),
    `never focused Titan's tile #${index}`).toBe(true);
  await shoot(page, `tile-${index}`);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(`${composer} .con-composer__cta`), 'the CTA is the door\'s navigation verb').toContainText('Выбрать резолюцию');
  await expect(page.locator(composer), 'the delegate leaves the reserve').toContainText('из резерва');
  const before = await wireOf(request, playerId);
  await chooseResolution(page);
  expect(posts, 'no POST before the commit').toEqual([]);
  expect((await wireOf(request, playerId)).game.gameAge, 'the server stands still').toBe(before.game.gameAge);
  const receipt = page.locator('[data-parl-vote-receipt]');
  await expect(receipt, 'the locked receipt is the branch\'s own price').toHaveAttribute('data-receipt-cost', index === 0 ? '2' : '4');
  await expect(receipt, '…in leverage, never M€ and never the cube').toHaveAttribute('data-receipt-icon', 'leverage');
  await expect(page.locator('[data-parl-vote-source]'), 'the delegate is the card\'s').toContainText('из резерва · по карте');
  await shoot(page, `vote-${index}`);
  await armTransferWitness(page);
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts, 'the action is ONE batch POST').toEqual(['/player/input-batch']);
}

test.describe(`console · TR84 Titan Holdings · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A — the start: the corporation says «Сработает» with its OWN leverage; A → it pays itself 2 and rises', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true},
      startingCorporations: 1,
      customCorporationsList: [TITAN],
    })});
    // THE REAL START (the wizard's commit holds the workspace — seeded over the API there is no hold).
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, [TITAN]), 'Titan Holdings was offered and picked').toContain(TITAN);
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});

    // The deferred corporation: «Сработает» names its own leverage (Earth + Jovian).
    expect(await focusCard(page, TITAN), `never focused «${TITAN}»`).toBe(true);
    const row = page.locator('[data-start-prelude-forecast] [data-forecast-row]');
    await expect(row, '«Сработает» stands on the status rail of the corporation').toHaveCount(1, {timeout: 20_000});
    await expect(row.locator('.card-resource-leverage'), 'its chip is the corporation\'s own leverage').not.toHaveCount(0);
    await shoot(page, 'A-01-corporation');

    await armTransferWitness(page);
    await armRiseProbe(page);
    expect(await playQueueCard(page, TITAN), 'the corporation was played from the queue').toBe(true);
    // The solo setup's colony removal may stand ahead of the corporation's own leverage — answered over the API.
    for (let i = 0; i < 20; i++) {
      const wf = (await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {type: string, coloniesModel?: Array<{name: string}>}}).waitingFor;
      if (wf?.type === 'colony') {
        await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wf.coloniesModel ?? [])[0]?.name ?? ''});
        break;
      }
      if (leverage(await wireOf(request, playerId)) > 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await expect.poll(async () => leverage(await wireOf(request, playerId)), {timeout: 30_000, message: 'the server: the corporation paid itself 2'}).toBe(2);
    await expect.poll(() => roseSeen(page), {timeout: 30_000, message: 'Titan rose (in its place, or at the stage)'}).toBe(true);
    await shoot(page, 'A-02-rises');
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 60_000});
    const witness = await transferWitness(page);
    // The reaction's own trail (seed → attached / standalone → claimed) beside the witness: names a lost answer.
    const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => {transfer?: unknown}}).__conReady?.()?.transfer ?? null));
    writeTrail('a', transferTrail(witness) + '\n--- transfer trail ---\n' + diag);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    // PL-1098: in a SOLO start the corporation's own answer arrives with the solo colony-removal step, while the start
    // seat is still being dealt in — the chain WAITS for the seat (`waitPlaceArrival`), so Titan lifts IN its seat and
    // both leverage tokens are born on its printed effect row and land in its own capsule.
    const born = witness.births.filter((b) => b.under === `reactor:${TITAN}:leverage`);
    expect(born.length, `two leverage tokens born on Titan's printed effect row\n${diag.slice(0, 4000)}\n${transferTrail(witness)}`).toBe(2);
    const landed = witness.landings.filter((l) => born.some((b) => b.id === l.id)).map((l) => l.under);
    // Its OWN face where the start shows it — the shelf «РАЗЫГРАНО» or the seat «Источник» — never a copy at the stage.
    expect(landed.length, `…both landed\n${transferTrail(witness)}`).toBe(2);
    expect(landed.every((u) => u === `played:${TITAN}` || u === `start-seat:${TITAN}`),
      `…on Titan's own face in the start (${landed.join(', ')})\n${transferTrail(witness)}`).toBe(true);
    await shoot(page, 'A-03-landed');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('B — Earth Office wakes Titan; then 2 leverage → a delegate through the Parliament, the price inside the answer', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    const posts: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(new URL(r.url()).pathname);
      }
    });
    const playerId = await bootFixture(page, request, 'titan', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    expect(leverage(await wireOf(request, playerId)), 'the fixture: 3 leverage').toBe(3);

    // ── the hand play.
    for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1400);
    }
    await page.locator(`.con-hand [data-zoom-slot="${EARTH_CARD}"]`).waitFor({timeout: 20_000});
    expect(await focusCard(page, EARTH_CARD, 24), `never focused «${EARTH_CARD}»`).toBeTruthy();
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}),
      'A opens the play composer').toBeTruthy();
    await settle(page);
    const row = page.locator('.con-composer--play [data-forecast-row]');
    await expect(row, '«Сработает» names the corporation\'s leverage').toHaveCount(1);
    await expect(row.locator('.card-resource-leverage'), '…in leverage').not.toHaveCount(0);
    await shoot(page, 'B-01-composer');
    await armTransferWitness(page);
    await armRiseProbe(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => leverage(await wireOf(request, playerId)), {timeout: 30_000, message: 'the server: +1 leverage'}).toBe(4);
    await expect.poll(() => roseSeen(page), {timeout: 30_000, message: 'Titan rose (in its place, or at the stage)'}).toBe(true);
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witnessB = await transferWitness(page);
    writeTrail('b', transferTrail(witnessB));
    expect(endsOverGlass(witnessB), `every end visible\n${transferTrail(witnessB)}`).toEqual([]);
    expect(witnessB.births.filter((b) => b.under === `reactor:${TITAN}:leverage`).length,
      `one leverage token born on Titan's printed effect row\n${transferTrail(witnessB)}`).toBe(1);
    posts.length = 0;

    // ── the action: the 2-leverage tile → the vote.
    const before = await wireOf(request, playerId);
    const viewer = before.thisPlayer.color;
    const me = (w: Wire) => w.game.parliament.players.find((p) => p.color === viewer)!;
    await voteThroughTile(page, request, playerId, 0, posts);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.actionsThisGeneration,
      {timeout: 30_000, message: 'the action is recorded as used'}).toContain(TITAN);
    const after = await wireOf(request, playerId);
    expect(leverage(after), 'two leverage left the card').toBe(2);
    expect(after.game.parliament.slots.map((s) => s.votes.filter((v) => v.owner === viewer).length).reduce((a, b) => a + b, 0) -
      before.game.parliament.slots.map((s) => s.votes.filter((v) => v.owner === viewer).length).reduce((a, b) => a + b, 0), 'one delegate more on a resolution').toBe(1);
    expect(me(after).reserve, 'the delegate left the RESERVE').toBe(me(before).reserve - 1);
    await settle(page, {timeoutMs: 40_000});
    const witnessV = await transferWitness(page);
    writeTrail('b-vote', transferTrail(witnessV));
    expect(endsOverGlass(witnessV), `every end visible\n${transferTrail(witnessV)}`).toEqual([]);
    await shoot(page, 'B-02-after-vote');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('C — 4 leverage → TWO delegates on ONE resolution, the card emptied', async ({page, request}) => {
    test.setTimeout(300_000);
    const errors: Array<string> = [];
    const posts: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(new URL(r.url()).pathname);
      }
    });
    const playerId = await bootFixture(page, request, 'titan-two', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    expect(leverage(before), 'the fixture: 4 leverage').toBe(4);
    const viewer = before.thisPlayer.color;
    await voteThroughTile(page, request, playerId, 1, posts);
    await expect.poll(async () => leverage(await wireOf(request, playerId)), {timeout: 30_000, message: 'the four leverage left the card'}).toBe(0);
    const after = await wireOf(request, playerId);
    const gained = after.game.parliament.slots.map((s, i) => s.votes.filter((v) => v.owner === viewer).length -
      before.game.parliament.slots[i].votes.filter((v) => v.owner === viewer).length);
    expect(gained.filter((n) => n > 0), 'both delegates on ONE resolution').toEqual([2]);
    await settle(page, {timeoutMs: 40_000});
    await shoot(page, 'C-01-two-delegates');
    expect(errors, 'no page errors').toEqual([]);
  });
});
