import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playCardFromHand, playQueueCard, press, pressUntil,
  reloadConsole, sendPlayerInput, settle, soloGameConfig, submitSummary, waitQueueIdle, walkFocusUntil, walkToSummary,
} from './consoleStart';
import {expectHeadHonest} from './headHonesty';

/**
 * P60 RISE TO POWER — the forty-second Prelude 2 card, adapted STRAIGHT TO TURMOIL REDUX (ledger FW): «Increase your M€
 * production 3 steps. Add 3 delegates — you may add them to different resolutions.» The first SERIES of grants asked
 * FROM THE START (P70's class «a series of grants — one visit» on P51's road «the Parliament takes the start's scene»):
 *
 *   A · the start (TIMING): A on the prelude in the queue → +3 M€ production → the Parliament takes the start's scene in
 *       its VOTE mode ONCE, the crumb «СТАРТ ПАРТИИ › ВОСХОЖДЕНИЕ К ВЛАСТИ › ГОЛОСОВАНИЕ · 1 / 3» → A on X → the cube
 *       lands → the SAME Parliament returns to its selection («2 / 3», the cursor on X) → ▶ Y, A → «3 / 3» → ◀ X, A → the
 *       Parliament leaves ONCE and the queue goes on; the server: reserve −3, X 2 · Y 1; 1 + 3 POSTs.
 *   B · B between two decisions COLLAPSES the series (never «back» — the cube is placed); A from the start brings back
 *       the SAME decision «2 / 3».
 *   C · a reload inside «2 / 3» stands the start up around the vote, the first cube in place.
 *   D · mid-game (`rise-to-power-wg` — WG Project deals P60): the P70 road — the series rises INSIDE the hand, «1 / 3» →
 *       «3 / 3», one Parliament node, the reserve −3 on the server.
 *   E · `rise-to-power-wg-reserve` (two delegates left): the card BURNS in the pick, and the rail NAMES why — «Делегатов
 *       в резерве: 2 из 3» (the card's own `unplayableReason`, the P59 · FV class).
 *
 * The rules are pinned by `tests/cards/prelude2/RiseToPower.spec.ts`; this stand is the JOURNEY on the TV profile. Order
 * claims are read from the MutationObserver record armed BEFORE the press. Storyboard: `TM_E2E_STORYBOARD=1`.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p60', PRESET.id);
const CARD = 'Rise To Power';
const CARD_RU = 'ВОСХОЖДЕНИЕ К ВЛАСТИ';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';
const VOTE = '[data-parl-vote-door]';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>};
type WireSeat = {color: string, reserve: number};
type Wire = {
  thisPlayer: {color: string, megacreditProduction: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, votePrompt?: {source?: string, count?: number, series?: {index: number, of: number}}, coloniesModel?: Array<{name: string}>},
  game: {parliament: {slots: Array<WireSlot>, players: Array<WireSeat>}},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const reserveOf = (wire: Wire): number => wire.game.parliament.players.find((p) => p.color === wire.thisPlayer.color)?.reserve ?? NaN;
const mineOn = (wire: Wire) => wire.game.parliament.slots
  .map((s) => ({party: s.party, n: s.votes.filter((v) => v.owner === wire.thisPlayer.color).length}))
  .filter((s) => s.n > 0);

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
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

type Story = {
  samples: number;
  /** Every distinct crumb line, in order of first appearance. */
  crumbs: Array<string>;
  /** The most `.con-parl` roots standing at once (a second instance is a second surface). */
  parlMax: number;
  /** How many DISTINCT `.con-parl` nodes stood (a re-mount between decisions is a second node). */
  parlNodes: number;
  /** The first moment the vote door stood (−1: never). */
  doorAt: number;
  /** Samples AFTER the first door and BEFORE the last decision's press in which the vote mode did not stand. */
  doorGapSamples: number;
  closed: boolean;
  gap: Array<[number, string]>;
  /** [ms, the press's ordinal] — the moments a decision's A was sent (stamped by the spec). */
  presses: Array<[number, number]>;
  /** [ms, value] — the viewer's reserve as the Parliament draws it: every change. */
  reserve: Array<[number, number]>;
  /** Every landed cube's first sighting — [ms, seq]. */
  touches: Array<[number, number]>;
  /** [ms] — every moment the vote mode came back into its selection after a landing (a door's re-appearance). */
  doorBack: Array<number>;
  /** The first moment no Parliament stood after the door had stood (the step left). */
  parlLeftAt: number;
  /** The start's ceremony body: a sample with NO ceremony while the step stood or right after it left (a blink). */
  startGone: number;
  stranded: boolean;
};

/** MutationObserver + setInterval (never rAF): the story of the screen from the press on. */
async function armStory(page: Page, viewer: string): Promise<void> {
  await page.evaluate((viewer) => {
    const w = window as unknown as {__p60: Story, __p60t0: number};
    const p: Story = {samples: 0, crumbs: [], parlMax: 0, parlNodes: 0, doorAt: -1, doorGapSamples: 0, closed: false, gap: [],
      presses: [], reserve: [], touches: [], doorBack: [], parlLeftAt: -1, startGone: 0, stranded: false};
    w.__p60 = p;
    const t0 = Date.now();
    w.__p60t0 = t0;
    const nodes = new WeakSet<Element>();
    let doorWas = false;
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = () => {
      p.samples++;
      const at = Date.now() - t0;
      document.querySelectorAll<HTMLElement>('.con-wshead').forEach((el) => {
        if (!el.checkVisibility({opacityProperty: true, visibilityProperty: true})) {
          return;
        }
        const crumb = text(el);
        if (crumb !== '' && !p.crumbs.includes(crumb) && p.crumbs.length < 80) {
          p.crumbs.push(crumb);
        }
      });
      const parls = Array.from(document.querySelectorAll('.con-parl:not([data-parl-leaving])'));
      p.parlMax = Math.max(p.parlMax, parls.length);
      parls.forEach((el) => {
        if (!nodes.has(el)) {
          nodes.add(el);
          p.parlNodes++;
        }
      });
      const door = document.querySelector('[data-parl-vote-door]') !== null;
      if (door && p.doorAt < 0) {
        p.doorAt = at;
      }
      if (door && !doorWas && p.doorAt >= 0 && p.doorAt !== at) {
        p.doorBack.push(at);
      }
      doorWas = door;
      if (p.doorAt >= 0 && !p.closed && !door) {
        p.doorGapSamples++;
        const parl = document.querySelector('.con-parl');
        const state = parl === null ? 'no-parl' : `parl:${parl.className.toString().replace(/\s+/g, '.')}`;
        if (p.gap[p.gap.length - 1]?.[1] !== state && p.gap.length < 60) {
          p.gap.push([at, state]);
        }
      }
      if (p.doorAt >= 0 && parls.length === 0 && p.parlLeftAt < 0) {
        p.parlLeftAt = at;
      }
      if (p.doorAt >= 0 && document.querySelector('.con-start') === null) {
        p.startGone++;
      }
      const raw = document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count');
      const value = raw === null || raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(value) && p.reserve[p.reserve.length - 1]?.[1] !== value) {
        p.reserve.push([at, value]);
      }
      document.querySelectorAll('.con-parl__slot [data-seq][data-landed]').forEach((el) => {
        const seq = Number(el.getAttribute('data-seq'));
        if (!p.touches.some(([, seen]) => seen === seq)) {
          p.touches.push([at, seq]);
        }
      });
      p.stranded = p.stranded || document.querySelector('.con-stranded') !== null;
    };
    sample();
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 30);
  }, viewer);
}
const readStory = (page: Page): Promise<Story> => page.evaluate(() => (window as unknown as {__p60: Story}).__p60);
async function stampPress(page: Page, n: number): Promise<void> {
  await page.evaluate((n) => {
    const w = window as unknown as {__p60: Story, __p60t0: number};
    w.__p60.presses.push([Date.now() - w.__p60t0, n]);
  }, n);
}

/** The index of the voting-area card the vote mode's cursor stands on (−1: none). */
async function cursorIndex(page: Page): Promise<number> {
  return await page.evaluate(() => Array.from(document.querySelectorAll('.con-parl__slot[data-instance]'))
    .findIndex((slot) => slot.querySelector('[data-parl-vote-card]') !== null));
}

/** The crumb's tail (the deepest stage) of the head the player SEES (the start's own head stands hidden under the step). */
async function crumbTail(page: Page): Promise<string> {
  const steps = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-wshead .con-wshead__step'))
    .filter((el) => el.checkVisibility({opacityProperty: true, visibilityProperty: true}))
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()));
  return (steps.filter((s) => s !== '').pop() ?? '').toUpperCase();
}

/** The vote mode is back in its SELECTION: the door stands, the cursor on a card, the crumb counting `k / 3`. */
async function selectionAt(page: Page, k: number): Promise<void> {
  await expect.poll(async () => `${await page.locator(VOTE).count()}|${await cursorIndex(page) >= 0}|${await crumbTail(page)}`,
    {timeout: 30_000, message: `the vote mode back in its selection at decision ${k} / 3 (crumb «${await crumbText(page)}»)`})
    .toMatch(new RegExp(`^1\\|true\\|ГОЛОСОВАНИЕ · ${k} / 3$`));
}

/** A solo Redux start with P60 and a second prelude picked, the corporation played: the queue stands with P60 in it. */
async function startWithCard(page: Page, request: APIRequestContext): Promise<string> {
  const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
    expansions: {colonies: true, turmoilRedux: true, prelude: true, prelude2: true},
    startingCorporations: 1,
    customCorporationsList: [CORP],
    customPreludes: [CARD, SECOND_PRELUDE, 'Business Empire', 'Mohole'],
  })});
  await openConsole(page, playerId, PRESET.query);
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        expect(await pickCards(p, [CORP]), 'the corporation was offered and picked').toContain(CORP);
      } else if (kind === 'prelude') {
        const got = await pickCards(p, [CARD, SECOND_PRELUDE]);
        expect(got, 'both preludes were picked').toEqual(expect.arrayContaining([CARD, SECOND_PRELUDE]));
      }
    },
  });
  await submitSummary(page);
  await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
  await settle(page, {timeoutMs: 30_000});
  expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
  for (let i = 0; i < 20; i++) {
    const wire = await wireOf(request, playerId);
    if (wire.waitingFor?.type === 'colony') {
      await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wire.waitingFor.coloniesModel ?? [])[0]?.name ?? ''});
      break;
    }
    if (wire.thisPlayer.tableau.some((c) => c.name === CORP)) {
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  await waitQueueIdle(page);
  await settle(page, {timeoutMs: 30_000});
  return playerId;
}

/** A on P60 in the queue → the server raises decision 1 / 3, and the vote mode stands in the start's scene. */
async function playToFirstDecision(page: Page, request: APIRequestContext, playerId: string): Promise<void> {
  expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
  await expect.poll(async () => JSON.stringify((await wireOf(request, playerId)).waitingFor?.votePrompt?.series ?? null),
    {timeout: 40_000, message: 'the server raises decision 1 / 3 after the prelude'}).toBe(JSON.stringify({index: 1, of: 3}));
  try {
    await page.locator(VOTE).waitFor({timeout: 40_000});
  } catch (e) {
    const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => unknown}).__conReady?.() ?? {}));
    console.log('[p60-diag]', diag.slice(0, 3000), '| parl:', await page.locator('.con-parl').count(), '| crumb:', await crumbText(page));
    throw e;
  }
}

test.describe('P60 — Rise to Power: a series of three grants is ONE visit, from the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · the start: +3 M€ production, then THREE decisions in ONE Parliament standing in the start — 1 / 3 · 2 / 3 · 3 / 3; X Y X on the server', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await startWithCard(page, request);
    const posts = watchPosts(page);
    const before = await wireOf(request, playerId);
    const reserve0 = reserveOf(before);
    expect(before.game.parliament.slots.length, 'three resolutions up for the vote').toBe(3);
    await shoot(page, '01-queue');

    await armStory(page, before.thisPlayer.color);
    const stopStory = await storyboard(page, 'series');
    await playToFirstDecision(page, request, playerId);
    const asked = await wireOf(request, playerId);
    expect(asked.thisPlayer.megacreditProduction, '+3 M€ production came with the play, before the first question')
      .toBe(before.thisPlayer.megacreditProduction + 3);
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    await selectionAt(page, 1);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb: the start › the card › the vote'})
      .toMatch(new RegExp(`СТАРТ ПАРТИИ.*${CARD_RU}.*ГОЛОСОВАНИЕ · 1 / 3`));
    const x = await cursorIndex(page);
    expect(x, 'the cursor stands on a resolution of the voting area').toBeGreaterThanOrEqual(0);
    const heads = [await expectHeadHonest(page, 'decision 1 / 3')];
    await shoot(page, '02-vote-1');
    const posts0 = posts.length;

    // ── decision 1: A on X → the cube lands → the SAME Parliament returns to its selection, «2 / 3», the cursor on X ──
    await stampPress(page, 1);
    await pressUntil(page, 'Enter', async () => posts.length >= posts0 + 1, {tries: 3, settleMs: 1500});
    await selectionAt(page, 2);
    expect(await cursorIndex(page), 'the cursor stays on the resolution the cube just landed on').toBe(x);
    heads.push(await expectHeadHonest(page, 'decision 2 / 3'));
    await shoot(page, '03-vote-2');

    // ── decision 2: ▶ Y, A → «3 / 3» ──
    await press(page, 'ArrowRight', 400);
    const y = await cursorIndex(page);
    expect(y, 'the cursor moved to another resolution').not.toBe(x);
    await stampPress(page, 2);
    await pressUntil(page, 'Enter', async () => posts.length >= posts0 + 2, {tries: 3, settleMs: 1500});
    await selectionAt(page, 3);
    heads.push(await expectHeadHonest(page, 'decision 3 / 3'));
    test.info().annotations.push({type: 'head', description: heads.join(' ‖ ')});
    await shoot(page, '04-vote-3');

    // ── decision 3: ◀ X, A → the Parliament leaves ONCE, the queue goes on ──
    for (let i = 0; i < 4 && await cursorIndex(page) !== x; i++) {
      await press(page, 'ArrowLeft', 400);
    }
    expect(await cursorIndex(page), 'back on X').toBe(x);
    await page.evaluate(() => {
      (window as unknown as {__p60: Story}).__p60.closed = true;
    });
    await stampPress(page, 3);
    await pressUntil(page, 'Enter', async () => posts.length >= posts0 + 3, {tries: 3, settleMs: 1500});
    expect(posts.length - posts0, 'three decisions, three POSTs').toBe(3);
    await expect(page.locator('.con-parl'), 'the Parliament left the start').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 40_000});
    await stopStory();
    await shoot(page, '05-queue-after');

    const story = await readStory(page);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'a-series.json'), JSON.stringify(story, null, 1));
    const told = JSON.stringify({crumbs: story.crumbs, parlMax: story.parlMax, parlNodes: story.parlNodes, doorGapSamples: story.doorGapSamples,
      gap: story.gap, presses: story.presses, touches: story.touches, doorBack: story.doorBack, reserve: story.reserve,
      parlLeftAt: story.parlLeftAt, startGone: story.startGone});
    test.info().annotations.push({type: 'series', description: told});
    console.log('[p60-story]', told);
    expect(story.parlMax, `never two Parliament instances (${told})`).toBeLessThanOrEqual(1);
    expect(story.parlNodes, `ONE Parliament node for the whole series — never re-mounted between decisions (${told})`).toBe(1);
    expect(story.doorGapSamples, `the vote mode stood in every sample between the decisions — no fold, no unfold (${told})`).toBe(0);
    const counted = story.crumbs.map((c) => c.toUpperCase().match(/ГОЛОСОВАНИЕ · \d \/ 3/)?.[0]).filter((c) => c !== undefined);
    expect([...new Set(counted)], `the crumb counted the series, only forward (${told})`)
      .toEqual(['ГОЛОСОВАНИЕ · 1 / 3', 'ГОЛОСОВАНИЕ · 2 / 3', 'ГОЛОСОВАНИЕ · 3 / 3']);
    expect(story.crumbs.every((c) => !c.toUpperCase().includes('ГОЛОСОВАНИЕ') || /ГОЛОСОВАНИЕ · \d \/ 3/.test(c.toUpperCase())),
      `never a bare «ГОЛОСОВАНИЕ» on the start's crumb (${told})`).toBe(true);
    expect(story.touches.length, `three cubes touched down (${told})`).toBe(3);
    expect(story.startGone, `the start's scene stood under the step and after it (${told})`).toBe(0);
    expect(story.stranded, 'no stranded prompt').toBe(false);

    const after = await wireOf(request, playerId);
    expect(reserveOf(after), 'the server: three left the reserve').toBe(reserve0 - 3);
    const mine = mineOn(after);
    expect(mine.map((s) => s.n).sort(), `two cubes on X, one on Y (${JSON.stringify(mine)})`).toEqual([1, 2]);
    await waitQueueIdle(page);
    expect(await playQueueCard(page, SECOND_PRELUDE), 'the opening continues with the next prelude').toBe(true);
    expect(errors, 'no page error').toEqual([]);
  });

  test('B · B between two decisions COLLAPSES the series; A brings back the SAME decision «2 / 3»', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await startWithCard(page, request);
    const posts = watchPosts(page);
    await playToFirstDecision(page, request, playerId);
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    await selectionAt(page, 1);
    const posts0 = posts.length;
    await pressUntil(page, 'Enter', async () => posts.length >= posts0 + 1, {tries: 3, settleMs: 1500});
    await selectionAt(page, 2);
    await expect.poll(async () => (await page.locator('.con-cmdbar').innerText()).replace(/\s+/g, ' '),
      {timeout: 10_000, message: 'past the commit B is «Свернуть», never «Назад»'}).toMatch(/свернуть/i);
    await press(page, 'Escape', 1200);
    await expect(page.locator(VOTE), 'B collapsed the vote').toHaveCount(0, {timeout: 15_000});
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    await shoot(page, 'b-collapsed');
    expect(posts.length - posts0, 'B sent nothing').toBe(1);
    expect(JSON.stringify((await wireOf(request, playerId)).waitingFor?.votePrompt?.series), 'the server still asks 2 / 3').toBe(JSON.stringify({index: 2, of: 3}));
    await pressUntil(page, 'Enter', async () => await page.locator(VOTE).count() > 0, {tries: 4, settleMs: 1500});
    await selectionAt(page, 2);
    await shoot(page, 'b-restored');
  });

  test('C · a reload inside «2 / 3» stands the start up around the vote; the first cube stays placed', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await startWithCard(page, request);
    const posts = watchPosts(page);
    const reserve0 = reserveOf(await wireOf(request, playerId));
    await playToFirstDecision(page, request, playerId);
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    await selectionAt(page, 1);
    const posts0 = posts.length;
    await pressUntil(page, 'Enter', async () => posts.length >= posts0 + 1, {tries: 3, settleMs: 1500});
    await selectionAt(page, 2);
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await page.locator(VOTE).waitFor({timeout: 40_000});
    await selectionAt(page, 2);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the reloaded crumb'})
      .toMatch(new RegExp(`СТАРТ ПАРТИИ.*${CARD_RU}.*ГОЛОСОВАНИЕ · 2 / 3`));
    expect(reserveOf(await wireOf(request, playerId)), 'the first cube stays placed').toBe(reserve0 - 1);
    await expectHeadHonest(page, 'reloaded at 2 / 3');
    await shoot(page, 'c-reloaded');
  });
});

const PICK = '.con-hand__outcome .con-deckpick--play';
/** WG Project from the hand → the prelude pick stands → P60 focused. */
async function focusInWgPick(page: Page): Promise<void> {
  expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
  await expect(page.locator(`${PICK}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
  const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
  expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `focused ${CARD}`).toBeTruthy();
}

test.describe('P60 — Rise to Power mid-game (WG Project)', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('D · the series rises INSIDE the hand: «1 / 3» → «3 / 3» in one Parliament; the reserve −3', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'rise-to-power-wg', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    const reserve0 = reserveOf(before);
    const posts = watchPosts(page);
    await focusInWgPick(page);
    await press(page, 'Enter', 400);
    await armStory(page, before.thisPlayer.color);
    const sent = posts.length;
    for (let attempt = 0; attempt < 3 && posts.length === sent; attempt++) {
      await press(page, 'Period', 300); // RT — the pick's commit
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(sent).catch(() => undefined);
    }
    expect(posts.length, 'the pick is ONE POST').toBe(sent + 1);
    await page.locator(`.con-hand ${VOTE}`).waitFor({timeout: 60_000});
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    await selectionAt(page, 1);
    await shoot(page, 'd-vote-1');
    // X · Y · X (the A stand's walk): a second cube on X in decision 2 would win the party's effect mid-series, and the
    // access scene lets the vote layer go by design — this stand judges the series' own fold, never that scene.
    const x = await cursorIndex(page);
    for (const k of [2, 3]) {
      const n = posts.length;
      await pressUntil(page, 'Enter', async () => posts.length >= n + 1, {tries: 3, settleMs: 1500});
      await selectionAt(page, k);
      await expectHeadHonest(page, `the hand at ${k} / 3`);
      if (k === 2) {
        await press(page, 'ArrowRight', 400);
      } else {
        for (let i = 0; i < 4 && await cursorIndex(page) !== x; i++) {
          await press(page, 'ArrowLeft', 400);
        }
      }
    }
    await page.evaluate(() => {
      (window as unknown as {__p60: Story}).__p60.closed = true;
    });
    const n = posts.length;
    await pressUntil(page, 'Enter', async () => posts.length >= n + 1, {tries: 3, settleMs: 1500});
    await expect(page.locator('.con-parl'), 'the Parliament left with the flow').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'd-board');
    const story = await readStory(page);
    const told = JSON.stringify({crumbs: story.crumbs, parlNodes: story.parlNodes, doorGapSamples: story.doorGapSamples, gap: story.gap, touches: story.touches});
    test.info().annotations.push({type: 'series-wg', description: told});
    expect(story.parlNodes, `ONE Parliament node for the whole series (${told})`).toBe(1);
    expect(story.doorGapSamples, `no fold, no unfold between the decisions (${told})`).toBe(0);
    expect(story.stranded, 'no stranded prompt').toBe(false);
    const after = await wireOf(request, id);
    expect(reserveOf(after), 'the server: three left the reserve').toBe(reserve0 - 3);
    expect(after.thisPlayer.megacreditProduction - before.thisPlayer.megacreditProduction, '+3 M€ production').toBe(3);
  });

  test('E · a reserve of two: the card BURNS in the pick, and the rail names why — «2 из 3»', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'rise-to-power-wg-reserve', {query: PRESET.query});
    await settle(page);
    const reserve = reserveOf(await wireOf(request, id));
    expect(reserve, 'the fixture: fewer than three in the reserve').toBeLessThan(3);
    await focusInWgPick(page);
    await expect(page.locator(`.con-deckpick [data-deckpick-slot="${CARD}"] [data-prelude-burns]`), 'the burn mark on the face').toHaveCount(1);
    const why = page.locator('.con-deckpick .con-cards__verdict-inner [data-prelude-burn-reason]');
    await expect(why, 'a burn names its cause').toHaveCount(1, {timeout: 20_000});
    await expect(why, 'the count the server holds').toContainText(`Делегатов в резерве: ${reserve} из 3`);
    await shoot(page, 'e-reserve-reason');
  });
});
