import * as fs from 'fs';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';

/**
 * TR03 «ПОЛИТИЧЕСКОЕ ПОЖЕРТВОВАНИЕ» — THE STAGED VOTE, the vote's third door
 * (docs/TURMOIL_REDUX_POLITICAL_DONATION.md).
 *
 * A card that places a delegate by being PLAYED. The contract under test, end
 * to end against a real server, on two profiles (a geometry claim made at one
 * resolution is a claim about one resolution):
 *
 *   1. «Выбрать резолюцию» sends NOTHING: the landing ritual plays, the
 *      Parliament's vote mode rises INSIDE the hand workspace, and the server
 *      has not heard a word (its change counter stands, the card is in hand).
 *   2. It is ONE flow: on every sample the crumb keeps its root and the card's
 *      name; the tail only ever reads РОЗЫГРЫШ → РАЗЫГРАНО (the ritual's own
 *      word, the staged cell's precedent) → ГОЛОСОВАНИЕ; the Parliament is the
 *      ONE instance, teleported into the hand — never a second band.
 *   3. The panel says what will change BEFORE the press: slot 0 «0 → 3», slot 1
 *      «2 → 3 · предел области» — and walking the cards moves no box.
 *   4. B walks back to the composer with the same payment; A is the play's ONE
 *      POST, and its tail is ADDRESSED to the card (`stagedFor`).
 *   5. The landing: the viewer's cube leaves the RESERVE stack for the card's
 *      ribbon (the lobby's cube never moves); then the party's neutral
 *      delegates leave the COMMON SUPPLY for the panel's support places, one by
 *      one — the supply's count drops on the lift, a place fills on the
 *      touchdown.
 *   6. The server agrees: the card is on the table, 4 M€ paid, the vote stands,
 *      the support is 3, the supply is three short.
 *   7. The flow ENDS ON THE BOARD: no workspace, nothing stranded, no overflow,
 *      no page error, and no flight ever confessed a missing rect.
 *
 * Fixture `political-donation` (tests/e2e/fixtures/generate.ts): blue's action
 * phase, 20 M€, the free delegate in the lobby, a full reserve; the voting area
 * is pinned [Industrialists · Mars First · Greens] and Mars First's area holds
 * two neutral delegates already (SYNTHETIC, for the «area limit» reading).
 */

const CARD = 'Political Donation';
const CARD_RU = 'Политическое пожертвование';
const ROOT_RU = 'Карты в руке';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>};
  game: {
    gameAge: number;
    parliament: {
      neutralSupply: number;
      popularSupport: Record<string, number>;
      slots: Array<{party: string, totalVotes: number, votes: Array<{owner: string}>}>;
      players: Array<{color: string, lobby: boolean, reserve: number}>;
    };
  };
};

/** The server's own view. One retry on a dropped socket: a loaded per-worker server resets a connection now and then, and that is not this spec's subject. */
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

type Box = {x: number, y: number, w: number, h: number};
type Flight = {first: Box, last: Box, n: number, firstAt: number, lastAt: number};
type Probe = {
  samples: number;
  /** Interval (task) samples only — the probe's own liveness floor. */
  ticks: number;
  /** The crumb's stage words, deduped in order of first appearance. */
  steps: Array<string>;
  /** Samples whose hand head lacked its root or the card's name. */
  crumbMisses: Array<string>;
  /** A `.con-parl` stood OUTSIDE the hand (a second surface), or as a band of its own. */
  parlOutsideHand: boolean;
  parlMax: number;
  wsMax: number;
  ownHead: boolean;
  degraded: Array<string>;
  stranded: boolean;
  flights: Record<string, Flight>;
  /** [ms, value] on every change: the supply's shown count, the panel's filled places, the viewer's reserve, the card's votes. */
  pool: Array<[number, number]>;
  shown: Array<[number, number]>;
  reserve: Array<[number, number]>;
  votes: Array<[number, number]>;
  lobbyEmptied: boolean;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, viewer: string): Promise<void> {
  await page.evaluate(({viewer, card, root}) => {
    const w = window as unknown as {__tr03: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, wsMax: 0, ownHead: false,
      degraded: [], stranded: false, flights: {}, pool: [], shown: [], reserve: [], votes: [], lobbyEmptied: false,
    };
    w.__tr03 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Array<[number, number]>, raw: string | null | undefined) => {
      if (raw === null || raw === undefined || raw === '') {
        return;
      }
      const value = Number(raw);
      if (Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const hand = document.querySelector('.con-hand');
      const head = hand?.querySelector('.con-wshead') ?? null;
      if (head !== null) {
        const rootText = text(head.querySelector('.con-wshead__root'));
        const subjects = Array.from(head.querySelectorAll('.con-wshead__subject')).map(text);
        if (rootText.toLowerCase() !== root.toLowerCase() || !subjects.some((s) => s.toLowerCase() === card.toLowerCase())) {
          if (p.crumbMisses.length < 8) {
            p.crumbMisses.push(`${Date.now() - t0}ms root=«${rootText}» subject=«${subjects.join('|')}»`);
          }
        }
        head.querySelectorAll('.con-wshead__step').forEach((el) => {
          const step = text(el);
          if (step !== '' && !p.steps.includes(step)) {
            p.steps.push(step);
          }
        });
      }
      const parls = document.querySelectorAll('.con-parl');
      p.parlMax = Math.max(p.parlMax, parls.length);
      parls.forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.parlOutsideHand = true;
        }
        if (el.querySelector('.con-wshead') !== null) {
          p.ownHead = true;
        }
        const degraded = el.getAttribute('data-parl-grant-degraded') ?? el.getAttribute('data-renewal-degraded');
        if (degraded !== null && !p.degraded.includes(degraded)) {
          p.degraded.push(degraded);
        }
      });
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      document.querySelectorAll<HTMLElement>('.con-parl__flight').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || getComputedStyle(el).visibility === 'hidden') {
          return;
        }
        const id = el.getAttribute('data-parl-flight') ?? '?';
        const now = {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
        const rec = p.flights[id] ?? (p.flights[id] = {first: now, last: now, n: 0, firstAt: Date.now() - t0, lastAt: 0});
        rec.last = now;
        rec.lastAt = Date.now() - t0;
        rec.n++;
      });
      note(p.pool, document.querySelector('[data-parl-neutral-cube]')?.getAttribute('data-count'));
      note(p.shown, document.querySelector('[data-parl-vote-support]')?.getAttribute('data-support-shown'));
      note(p.reserve, document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count'));
      note(p.votes, document.querySelector('[data-parl-vote-ribbon]')?.getAttribute('data-votes'));
      const lobby = document.querySelector(`[data-parl-seat-lobby="${viewer}"]`);
      if (lobby !== null && lobby.classList.contains('con-parl__socket--empty')) {
        p.lobbyEmptied = true;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {viewer, card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr03: Probe}).__tr03);

/** An element's centre box and whether the player can actually SEE it (a rect, an effective opacity, not `visibility: hidden`). */
async function seen(page: Page, selector: string): Promise<(Box & {visible: boolean}) | undefined> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    let opacity = 1;
    let hidden = false;
    for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      hidden = hidden || cs.visibility === 'hidden' || cs.display === 'none';
    }
    const inView = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, visible: r.width > 1 && r.height > 1 && opacity > 0.6 && !hidden && inView};
  }, selector);
}

const dist = (a: {x: number, y: number}, b: {x: number, y: number}) => Math.hypot(a.x - b.x, a.y - b.y);

const voteMode = '.con-hand .con-parl--embedded [data-parl-vote-door="card"]';
const composer = '.con-composer--play';
const supportBlock = '[data-parl-vote-support]';

const supportReading = (page: Page) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return el === null ? undefined : {
    current: el.getAttribute('data-support-current'),
    resulting: el.getAttribute('data-support-resulting'),
    gained: el.getAttribute('data-support-gained'),
    tail: (document.querySelector('[data-parl-vote-support-tail]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    num: (el.querySelector('.con-parl__info-support-num')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  };
}, supportBlock);

/**
 * A box, SETTLED — both sides of a «nothing moved» comparison go through this. Two waits, because there are two
 * ways to read a box that is not the resting one: ① the panel's bodies CROSSFADE on a card change, and the
 * entering body is born 0.25rem low (`con-parl-xfade-enter-from`) until Vue swaps its classes on a FRAME — on a
 * loaded headless 4K runner that frame can be hundreds of ms away, so «three equal reads» alone measured a body
 * still standing in its enter pose (10 px off, reproducibly); ② the entrance itself. So: no crossfade class left
 * in the panel, THEN three equal reads 100 ms apart. Timers, never rAF — the wait must not stall with the frames.
 */
const boxOf = (page: Page, selector: string) => page.evaluate(async (sel) => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  const crossfading = () => document.querySelector(
    '.con-parl-xfade-enter-from, .con-parl-xfade-enter-active, .con-parl-xfade-leave-active') !== null;
  for (let i = 0; i < 80 && crossfading(); i++) {
    await pause();
  }
  const read = () => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r === undefined ? '' : [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  };
  let last = read();
  let equal = 0;
  for (let i = 0; i < 60 && equal < 2; i++) {
    await pause();
    const now = crossfading() ? '' : read();
    equal = now === last && now !== '' ? equal + 1 : 0;
    last = now;
  }
  return last === '' ? undefined : last.split(',').map(Number);
}, selector);

/** The vote mode's cursor: the index of the selected slot (-1 while no slot is selected). */
const selectedSlot = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.con-parl__slot')).findIndex((el) => el.classList.contains('con-parl__slot--selected')));

/**
 * Walk the cursor to `index` — one press at a time, each VERIFIED by the cursor itself. The handoff's last beat
 * still absorbs input for a moment after the mode is up, and a press counted blind either never lands or (pressed
 * twice on a slow frame) overshoots.
 */
async function moveToSlot(page: Page, index: number): Promise<void> {
  for (let step = 0; step < 8; step++) {
    const at = await selectedSlot(page);
    if (at === index) {
      return;
    }
    await press(page, at < index ? 'ArrowRight' : 'ArrowLeft', 200);
    await expect.poll(() => selectedSlot(page), {timeout: 2_500}).not.toBe(at).catch(() => undefined);
  }
  expect(await selectedSlot(page), `the cursor reached slot ${index}`).toBe(index);
}

const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

/**
 * «ВЫБРАТЬ РЕЗОЛЮЦИЮ» — one press, verified by the composer's OWN state. Never
 * a blind retry: a second A landing after the vote mode is up is the COMMIT.
 */
async function chooseResolution(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) !== null, voteMode);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await page.locator(voteMode).waitFor({timeout: 30_000});
  // The handoff is over when the composer has let go and the landing scene's hold is released.
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

for (const preset of PRESETS) {
  test.describe(`TR03 Political Donation · the staged vote · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать резолюцию» → the vote inside the hand → B → back → A → the cubes land → the board (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<{url: string, body: string}> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });

      const playerId = await bootFixture(page, request, 'political-donation', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      const party0 = before.game.parliament.slots[0].party;
      const party1 = before.game.parliament.slots[1].party;
      expect([before.game.parliament.popularSupport[party0], before.game.parliament.popularSupport[party1]],
        'the fixture: slot 0\'s party holds no support, slot 1\'s holds two').toEqual([0, 2]);
      expect(me(before).lobby, 'the fixture: the free delegate stands in the lobby').toBe(true);

      // ── the composer: the door's verb, the reserve chip, the step row ──
      await press(page, 'Period', 600); // RT → the quick wheel
      await press(page, 'Enter', 1600); // centre slot → the hand
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
      expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать резолюцию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Резолюция — выбор в Парламенте');
      await expect(page.locator(composer), 'the delegate leaves the reserve').toContainText('из резерва');
      // `textContent`, not `innerText`: the composer's groups materialize in a cascade, and a group still hidden
      // by it is absent from the rendered text.
      const paymentBefore = await textOf(page, `${composer} .con-paystatus`);
      expect(paymentBefore, 'the payment line states the price').toContain('4');

      await armProbe(page, viewer);

      // ── 1. «Выбрать резолюцию»: nothing is sent ──
      await chooseResolution(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 3. the panel: «0 → 3» on slot 0, «2 → 3 · предел области» on slot 1; nothing moves ──
      await expect.poll(() => supportReading(page), {timeout: 10_000, message: 'slot 0 reads the full gain'})
        .toMatchObject({current: '0', resulting: '3', gained: '3', tail: '+3'});
      expect((await supportReading(page))?.num.replace(/\s/g, ''), 'current → resulting').toBe('0→3');
      const panel0 = await boxOf(page, '.con-parl__info');
      const party0Box = await boxOf(page, '.con-parl__info-party');
      await expect(page.locator('[data-parl-neutral-source]'), 'the neutral supply is marked as a source').toHaveCount(1);
      await expect(page.locator('[data-parl-vote-receipt]'), 'the locked receipt states the card\'s price').toContainText('4');
      await expect(page.locator('[data-parl-vote-source]'), 'the delegate is the card\'s').toContainText('из резерва · по карте');

      await moveToSlot(page, 1);
      await expect.poll(() => supportReading(page), {timeout: 10_000, message: 'slot 1: the area limit cuts the printed 3 to 1'})
        .toMatchObject({current: '2', resulting: '3', gained: '1', tail: '+1 из 3 · предел области'});
      expect(await boxOf(page, '.con-parl__info'), 'the panel\'s box did not move under ◀ ▶').toEqual(panel0);
      expect(await boxOf(page, '.con-parl__info-party'), 'the party block did not grow').toEqual(party0Box);
      await moveToSlot(page, 0);
      await expect.poll(async () => (await supportReading(page))?.current, {timeout: 10_000, message: 'back on slot 0'}).toBe('0');
      expect(posts, 'walking the cards sends nothing').toEqual([]);

      // ── 4a. B walks back to the composer — the same payment, nothing sent ──
      // The press took when the step is LEAVING (or gone) or the composer is back — never «press again until the
      // composer shows»: a second B landing on the restored composer is «Отмена», and the play is abandoned.
      const backTaken = () => page.evaluate((sel) =>
        document.querySelector(sel) !== null || document.querySelector('.con-parl') === null ||
        document.querySelector('.con-parl[data-parl-leaving]') !== null, composer);
      for (let attempt = 0; attempt < 3 && !await backTaken(); attempt++) {
        await press(page, 'Escape', 300);
        await expect.poll(backTaken, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator(composer), 'B restores the composer').toHaveCount(1, {timeout: 15_000});
      await expect(page.locator('.con-parl'), 'the step left').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await expect(page.locator(composer)).toContainText('Выбрать резолюцию');
      await expect.poll(() => textOf(page, `${composer} .con-paystatus`), {timeout: 10_000, message: 'the payment survived the round trip'}).toBe(paymentBefore);
      expect(posts).toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the round trip left no trace').toBe(before.game.gameAge);

      // ── 4b. in again; A is the play's ONE POST, addressed to the card ──
      await chooseResolution(page);
      const reserveStack = `[data-parl-seat-reserve="${viewer}"]`;
      const sources = {
        reserve: await seen(page, reserveStack),
        pool: await seen(page, '[data-parl-neutral-cube]'),
      };
      const targets = {
        ribbon: await seen(page, '[data-parl-vote-ribbon]'),
        places: [await seen(page, `${supportBlock} [data-support-place="1"]`), await seen(page, `${supportBlock} [data-support-place="2"]`), await seen(page, `${supportBlock} [data-support-place="3"]`)],
      };
      expect(sources.reserve?.visible, 'the reserve stack is on screen').toBe(true);
      expect(sources.pool?.visible, 'the neutral supply is on screen').toBe(true);
      expect(targets.ribbon?.visible, 'the card\'s ribbon is on screen').toBe(true);
      expect(targets.places.map((p) => p?.visible), 'the three support places are on screen').toEqual([true, true, true]);
      const panelAtCommit = await boxOf(page, '.con-parl__info');

      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      const tail = responses[responses.length - 1];
      expect(tail, 'the tail is the resolution, ADDRESSED to the card').toMatchObject({type: 'party', partyName: party0, stagedFor: CARD});

      // ── 6. the server: the card, the price, the vote, the support, the supply ──
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.map((c) => c.name),
        {timeout: 30_000, message: 'the committed play reached the tableau'}).toContain(CARD);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, 'the card cost 4 M€').toBe(before.thisPlayer.megacredits - 4);
      expect(after.game.parliament.slots[0].votes.map((v) => v.owner), 'the viewer\'s delegate stands on the chosen card').toEqual([viewer]);
      expect(after.game.parliament.slots.slice(1).map((s) => s.totalVotes), 'and on no other').toEqual([0, 0]);
      expect(after.game.parliament.popularSupport[party0], 'the party\'s support').toBe(3);
      expect(after.game.parliament.popularSupport[party1], 'the other party\'s support is untouched').toBe(2);
      expect(after.game.parliament.neutralSupply, 'three neutral delegates left the supply').toBe(before.game.parliament.neutralSupply - 3);
      expect(me(after).reserve, 'the delegate left the RESERVE').toBe(me(before).reserve - 1);
      expect(me(after).lobby, 'the lobby\'s cube never moved').toBe(true);

      // ── 7. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator(composer), 'the composer never comes back past the commit').toHaveCount(0);
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, pool: probe.pool, shown: probe.shown, reserve: probe.reserve, votes: probe.votes,
        flights: Object.values(probe.flights).map((f) => [Math.round(f.first.x), Math.round(f.first.y), Math.round(f.last.x), Math.round(f.last.y), f.n])});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/political-donation-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── 2. one flow: the crumb, the one instance ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps, `the tail only ever moved forward (${dump})`).toEqual(['Розыгрыш', 'Разыграно', 'Голосование']);
      expect(probe.parlOutsideHand, 'the Parliament stood inside the hand, never as a band of its own').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);

      // ── 5. the landing: two sources, two addressees, in turn ──
      const flights = Object.values(probe.flights).filter((f) => f.n >= 2 && dist(f.first, f.last) > 24);
      const near = (a: {x: number, y: number}, b: Box | undefined, slack: number) => b !== undefined && dist(a, b) <= Math.max(b.w, b.h) + slack;
      const slack = preset.viewport.width / 24;
      const own = flights.filter((f) => near(f.first, sources.reserve, slack));
      const neutral = flights.filter((f) => near(f.first, sources.pool, slack));
      expect(own.length, `the viewer's cube left the RESERVE stack (${dump})`).toBe(1);
      expect(near(own[0].last, targets.ribbon, slack), `…and landed on the card's ribbon (${dump})`).toBe(true);
      expect(neutral.length, `three neutral delegates left the common supply (${dump})`).toBe(3);
      for (const flight of neutral) {
        expect(targets.places.some((place) => near(flight.last, place, slack / 2)), `a neutral delegate landed on a support place (${dump})`).toBe(true);
      }
      expect(Math.min(...neutral.map((f) => f.firstAt)), 'the neutral delegates fly AFTER the viewer\'s cube has landed')
        .toBeGreaterThanOrEqual(own[0].lastAt - 60);
      // The places fill on the TOUCHDOWNS and the supply's count drops on the LIFTS — read off the landing's
      // own samples (everything past the panel's last «0 filled»). ⚠ The cubes leave 110 ms apart and a loaded
      // 4K runner starves the main thread for longer than that (measured: all three lifts in ONE sample), so
      // the claims here are ORDER and DIRECTION, never a per-cube timestamp and never «three separate
      // samples». The rhythm itself is pinned where it cannot be starved: `SUPPORT_CUBE_STAGGER_MS ≥ 90`
      // (tests/client/console/stagedVote.spec.ts).
      const lastZero = probe.shown.map(([, v]) => v).lastIndexOf(0);
      const landing = probe.shown.slice(lastZero + 1);
      const rising = (xs: ReadonlyArray<number>) => xs.every((v, i) => i === 0 || v > xs[i - 1]);
      expect(landing.length > 0 && rising(landing.map(([, v]) => v)) && landing[landing.length - 1][1] === 3,
        `the places fill upwards to three (${dump})`).toBe(true);
      const supply = before.game.parliament.neutralSupply;
      expect(probe.pool[0]?.[1], 'the supply reads what it held until the first lift').toBe(supply);
      const lifts = probe.pool.slice(1);
      expect(lifts.length > 0 && rising(lifts.map(([, v]) => -v)) && lifts[lifts.length - 1][1] === supply - 3,
        `the supply's count only ever drops, down to three short — never a dip to the server's number first (${dump})`).toBe(true);
      expect(lifts[0][0], 'the first cube LIFTS (the count drops) before the first place fills').toBeLessThan(landing[0][0]);
      expect(lifts[lifts.length - 1][0], 'the last lift precedes the last touchdown').toBeLessThanOrEqual(landing[landing.length - 1][0]);
      expect(probe.reserve.map(([, v]) => v), 'the reserve stack gave exactly one cube').toEqual([me(before).reserve, me(before).reserve - 1]);
      expect(probe.votes[probe.votes.length - 1]?.[1], 'the card\'s count ticked to 1').toBe(1);
      expect(probe.lobbyEmptied, 'the lobby\'s socket was never empty').toBe(false);
      expect(panelAtCommit, 'the panel stood where it was from the press to the leave').toEqual(panel0);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}
