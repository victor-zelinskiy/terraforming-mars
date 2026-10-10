import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, settle} from './consoleStart';
import {armLeakWitness, openParliament, strandedReports} from './parliamentDrive';

/**
 * TR31 «НАЦИОНАЛИСТИЧЕСКОЕ ДВИЖЕНИЕ» — A RALLY OF NEUTRAL DELEGATES as the
 * OUTCOME of a play (docs/TURMOIL_REDUX_NATIONALIST_MOVEMENT.md).
 *
 * A card that asks NOTHING and does three things at once: a neutral cube on
 * each Reds / Mars First resolution up for a vote (the winner may change), a
 * cube into each of their areas (the ceiling of three), then M€ per neutral
 * delegate IN USE — a number the player does not keep in their head. So the
 * composer says everything BEFORE the press, with the server's numbers, and
 * the play is an OUTCOME hosted by the hand (TR04's form): «Разыграть карту»
 * is ONE POST, the Parliament rises INSIDE the hand's zone, the cubes land
 * one by one in the printed order, the recount runs over the table, the coin
 * is born from the count — then the hand and the hosted Parliament leave as
 * ONE surface. The contract under test, against a real server, two profiles:
 *
 *   1. The composer BEFORE the press: the stage named, every resolution with
 *      «3 → 4» and its political consequence, every area with its room or its
 *      NAMED ZERO, «В игре 11 → 14», the chips; «Сработает» absent; 0 POST.
 *   2. A → exactly ONE POST; on every sample the crumb keeps its root and the
 *      card's name, the tail only ever moves forward (РОЗЫГРЫШ → РАЗЫГРАНО →
 *      ДЕЛЕГАТЫ); the Parliament is ONE instance inside the hand — never a
 *      band of its own, never a second workspace, never a head of its own.
 *   3. Before the first landing: HC «3», AA «3», the pool «3», the Reds'
 *      plaque 1 of 3, the winning marker on AC, the rail's M€ at 10 (the price
 *      charged with the landing — PL-001 for plays).
 *   4. THE ORDER: cube ① born inside the pool's rect → the pool «2» on the
 *      lift-off → it lands on HC → «4» and the winning marker on HC NOT BEFORE
 *      that touchdown → cube ② → AA «4» → cube ③ → the Reds' second place,
 *      «2/3» → Mars First's plaque reads «+0 · область заполнена» (no cube) →
 *      the recount: the count grows 0 → 14 one mark at a time (never «12 → 14»
 *      in one render) → the coin «+14» is born inside the count's rect → the
 *      rail's M€ 10 on every sample until the touchdown → 24 → the read → the
 *      board. No cube / coin above the screen; nothing degraded; nothing
 *      stranded; no overflow.
 *   5. The server agrees: HC 4 (2 neutral), AA 4, AC 4, the areas 2 / 3 / 2,
 *      the supply 0, blue 24 M€, the card on the table, the quest untouched.
 *   6. RED, without reloading, with the Parliament OPEN: the three cubes
 *      arrived (the pool → the ribbons / the plaque), the counts agree; the
 *      notification carries the lines and opens the Parliament.
 *   7. The `arrange` variants, composer only: the SHORT SUPPLY (Unity 3) —
 *      both votes, «+0 · нейтральных не осталось» for the Reds' area, «+0 ·
 *      область заполнена» for Mars First's, 14 in use; the REDS RULING by
 *      their enacted card — the named zero «Красные — резолюции на
 *      голосовании нет», AA alone, both areas.
 *
 * Fixtures `nationalist-movement` / `-short-supply` / `-reds-rule`
 * (tests/e2e/fixtures/generate.ts); the dry run there checks the plan.
 */

const CARD = 'Nationalist Movement';
const CARD_RU = 'Националистическое движение';
const ROOT_RU = 'Карты в руке';
const HC = 'RDX_REDS_HEAT_CAPTURE';
const AA = 'RDX_MARS_ARCHITECTURE_AWARD';
const AC = 'RDX_GREENS_AQUIFER_CONTEST';
const REDS = 'Reds';
const MARS = 'Mars First';
const OUT = path.resolve('screenshots', 'nationalist-movement');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>};
  game: {
    parliament: {
      slots: Array<{instance: string, votes: Array<{owner: string, seq: number}>, totalVotes: number, isWinning: boolean}>;
      popularSupport: Record<string, number>;
      neutralSupply: number;
      lastRally?: {seq: number, player: string, card?: string, votes: Array<{instance: string, seq: number, winnerAfter?: string}>, support: Array<{party: string, gained: number, limit?: string}>, inUse: {before: number, after: number}, megacredits: number};
      quest?: {progress: Record<string, number>, completedBy?: string};
      players: Array<{color: string, reserve: number}>;
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

const slotOf = (wire: Wire, prefix: string) => wire.game.parliament.slots.find((s) => s.instance.startsWith(prefix))!;
const neutralOn = (wire: Wire, prefix: string) => slotOf(wire, prefix).votes.filter((v) => v.owner === 'neutral').length;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, by CDP screencast, named by its time. */
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

type Series = Array<[number, string]>;
type Probe = {
  samples: number;
  ticks: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  parlOutsideHand: boolean;
  parlMax: number;
  wsMax: number;
  ownHead: boolean;
  degraded: Array<string>;
  stranded: boolean;
  beat: Series;
  pool: Series;
  hc: Series;
  aa: Series;
  winner: Series;
  redsPlaces: Series;
  marsRead: Series;
  count: Series;
  mc: Series;
  /** Every neutral cube proxy seen: its id, the ms it was first seen, whether it was born inside the pool's rect, its lowest y. */
  cubes: Array<{id: string, at: number, bornInPool: boolean, minY: number}>;
  /** The coin: the ms it was first seen, whether it was born inside the count chip's rect, its lowest y. */
  coin: {at: number, bornInCount: boolean, minY: number} | undefined;
  /** Every sample's [ms, cube proxies in the air, coin in the air] — the storyboard's trace. */
  air: Array<[number, number, number]>;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({card, root, hc, aa, reds, mars}) => {
    const w = window as unknown as {__tr31: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, wsMax: 0, ownHead: false, degraded: [], stranded: false,
      beat: [], pool: [], hc: [], aa: [], winner: [], redsPlaces: [], marsRead: [], count: [], mc: [], cubes: [], coin: undefined, air: [],
    };
    w.__tr31 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: string | undefined) => {
      if (value !== undefined && value !== '' && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const inside = (r: DOMRect, box: DOMRect | undefined, pad = 48) =>
      box !== undefined && r.left + r.width / 2 >= box.left - pad && r.left + r.width / 2 <= box.right + pad && r.top + r.height / 2 >= box.top - pad && r.top + r.height / 2 <= box.bottom + pad;
    // A proxy is BORN invisible at the origin and positioned on the next tick (law 14): only a PAINTED proxy is a witness.
    const visible = (el: HTMLElement): boolean => {
      let opacity = 1;
      for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        opacity *= Number(cs.opacity);
      }
      return opacity > 0.05;
    };
    const seenCubes = new Set<string>();
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
      // A WARMED Parliament (PL-127: mounted invisible ahead of its frame, from the press) is not on screen yet.
      const parls = document.querySelectorAll('.con-parl:not(.con-parl--warm)');
      p.parlMax = Math.max(p.parlMax, parls.length);
      parls.forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.parlOutsideHand = true;
        }
        if (el.querySelector('.con-wshead') !== null) {
          p.ownHead = true;
        }
        for (const attr of ['data-parl-grant-degraded', 'data-renewal-degraded', 'data-parl-rally-degraded', 'data-parl-support-degraded']) {
          const degraded = el.getAttribute(attr);
          if (degraded !== null && !p.degraded.includes(degraded)) {
            p.degraded.push(degraded);
          }
        }
      });
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      // The recount's number is read on EVERY sample (a mark is a task of its own, so every value paints).
      note(p.count, document.querySelector('[data-parl-count-id="rally"] [data-parl-count]')?.getAttribute('data-parl-count') ?? undefined);
      if (!tick) {
        return; // the frame claims below are made on the task samples only
      }
      note(p.beat, document.querySelector('.con-parl')?.getAttribute('data-rally-beat') ?? undefined);
      const poolEl = document.querySelector<HTMLElement>('[data-parl-neutral-cube]');
      note(p.pool, poolEl?.getAttribute('data-count') ?? undefined);
      const slot = (prefix: string) => document.querySelector<HTMLElement>(`.con-parl__slot[data-instance^="${prefix}"]`);
      note(p.hc, text(slot(hc)?.querySelector('.con-parl__tally-num') ?? null));
      note(p.aa, text(slot(aa)?.querySelector('.con-parl__tally-num') ?? null));
      note(p.winner, document.querySelector<HTMLElement>('.con-parl__slot--winning')?.getAttribute('data-party') ?? undefined);
      if (document.querySelector(`[data-parl-support="${reds}"]`) !== null) {
        note(p.redsPlaces, String(document.querySelectorAll(`[data-parl-support="${reds}"] .con-pseal__support-place--on`).length));
      }
      note(p.marsRead, text(document.querySelector(`[data-party="${mars}"] [data-pseal-pick]`)));
      const mcRow = document.querySelector('.con-res__row--megacredits .con-res__digits');
      note(p.mc, text(mcRow));
      const poolRect = poolEl?.getBoundingClientRect();
      const countRect = document.querySelector('[data-parl-count-id="rally"]')?.getBoundingClientRect();
      let cubesInAir = 0;
      document.querySelectorAll<HTMLElement>('.con-parl__flight:not(.con-parl__flight--card):not(.con-parl__flight--token):not(.con-parl__flight--agenda)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || !visible(el)) {
          return;
        }
        cubesInAir++;
        const id = el.getAttribute('data-parl-flight') ?? `anon${p.cubes.length}`;
        if (!seenCubes.has(id)) {
          seenCubes.add(id);
          p.cubes.push({id, at: Date.now() - t0, bornInPool: inside(r, poolRect), minY: r.top});
        } else {
          const cube = p.cubes.find((c) => c.id === id)!;
          cube.minY = Math.min(cube.minY, r.top);
        }
      });
      let coinInAir = 0;
      // The M€ chip is the coin itself (`--mc`: the amount in the coin's own face, no icon element).
      document.querySelectorAll<HTMLElement>('.con-transfer__chip--mc').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || !visible(el)) {
          return;
        }
        coinInAir++;
        if (p.coin === undefined) {
          p.coin = {at: Date.now() - t0, bornInCount: inside(r, countRect, 64), minY: r.top};
        } else {
          p.coin.minY = Math.min(p.coin.minY, r.top);
        }
      });
      p.air.push([Date.now() - t0, cubesInAir, coinInAir]);
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {card: CARD_RU, root: ROOT_RU, hc: HC, aa: AA, reds: REDS, mars: MARS});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr31: Probe}).__tr31);

type RedNote = {at: number, text: string, detail: string, cubesInAir: number};

/**
 * RED'S WITNESS: every notification card as it APPEARS (a card lives ~7 s — by the time blue's recount and coin are
 * over it is gone), with what was in the air on red's table at that moment (the PL-079 class: a card that stands
 * while the cubes it tells of are still flying).
 */
async function armRedWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__red: Array<RedNote>};
    w.__red = [];
    const t0 = Date.now();
    const seen = new Set<string>();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = () => {
      document.querySelectorAll<HTMLElement>('.con-notif').forEach((el) => {
        const id = el.getAttribute('data-notif-id') ?? text(el);
        if (seen.has(id)) {
          return;
        }
        seen.add(id);
        const cubes = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__flight:not(.con-parl__flight--card):not(.con-parl__flight--token)'))
          .filter((f) => f.getBoundingClientRect().width > 1).length;
        w.__red.push({at: Date.now() - t0, text: text(el), detail: text(el.querySelector('.con-notif__action--detail')), cubesInAir: cubes});
      });
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 50);
  });
}

const readRedWitness = (page: Page): Promise<Array<RedNote>> => page.evaluate(() => (window as unknown as {__red: Array<RedNote>}).__red);

const composer = '.con-composer--play';

const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

/** The first ms `series` read `value`; undefined when it never did. */
const at = (series: Series, value: string): number | undefined => series.find(([, v]) => v === value)?.[0];

/** The wheel → the hand → the card → its composer. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

for (const preset of PRESETS) {
  test.describe(`TR31 Nationalist Movement · the rally of neutral delegates · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → the cubes, the recount and the coin inside the hand → the board; red watches (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
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

      const {playerId, seats} = await bootFixtureSeats(page, request, 'nationalist-movement', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect([slotOf(before, HC).totalVotes, slotOf(before, AA).totalVotes, slotOf(before, AC).totalVotes], 'the fixture: HC 3, AA 3, AC 4').toEqual([3, 3, 4]);
      expect(slotOf(before, AC).isWinning, 'the fixture: AC wins before').toBe(true);
      expect([before.game.parliament.popularSupport[REDS], before.game.parliament.popularSupport[MARS], before.game.parliament.neutralSupply], 'the fixture: the Reds 1, Mars First 3, a supply of 3').toEqual([1, 3, 3]);
      expect(before.thisPlayer.megacredits, 'the fixture: 12 M€').toBe(12);
      const questBefore = JSON.stringify(before.game.parliament.quest?.progress ?? {});

      // RED watches with the Parliament OPEN — the rival's table, where the cubes arrive physically.
      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await openParliament(red);
      const redPoolBefore = await red.locator('[data-parl-neutral-cube]').getAttribute('data-count');
      expect(redPoolBefore, 'red\'s table: the pool at 3').toBe('3');
      await page.bringToFront();

      // ── 1. the composer: everything said BEFORE the press, with the server's numbers ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the play\'s own verb — the rally is an outcome, not a door').toContainText('Разыграть карту');
      const rows = await textOf(page, composer);
      expect(rows, 'the coming stage, named').toContain('Делегаты — нейтральные делегаты в Парламенте');
      expect(rows, 'Heat Capture: 3 → 4, it becomes the winning one on the tie').toMatch(/Улавливание тепла · 3 → 4 · Принимается — ничья в пользу слота ближе к правительству/);
      expect(rows, 'Architecture Award: 3 → 4, still not the winning one').toMatch(/Архитектурная премия · 3 → 4 · Всё ещё не принимается/);
      expect(rows, 'the Reds\' area: 1 → 2 of 3').toMatch(/Красные · 1 → 2 из 3/);
      expect(rows, 'Mars First\'s area: the named zero, the quiet register').toMatch(/Марс вперёд · \+0 · область заполнена/);
      expect(rows, 'the count the M€ stands on').toMatch(/В игре 11 → 14/);
      const neutralChips = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--neutral-delegate')});
      await expect(neutralChips, 'the neutral chips: the votes and the support').toHaveCount(2);
      // The M€ chip reads the stock before → after the recount (the price is the payment panel's, as for every play).
      const mcChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--megacredits')}).filter({hasText: '26'});
      await expect(mcChip, 'the M€ chip reads the recount: 12 → 26').toHaveCount(1);
      await expect(page.locator(`${composer} [data-forecast-row]`), '«Сработает» is empty and honest — nothing on the table answers the play').toHaveCount(0);
      expect(posts.length, 'nothing sent before A').toBe(0);
      await shoot(page, preset.id, '01-composer');

      await armProbe(page);
      await armRedWitness(red);
      const stopRedStory = await storyboard(red, preset.id, 'red');
      const stopStory = await storyboard(page, preset.id, 'rally');

      // ── 2. A: the play's ONE POST ──
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [sent as unknown as Record<string, unknown>];
      expect(responses.some((r) => JSON.stringify(r).includes(CARD)), 'the POST is the card\'s play').toBe(true);

      // ── the rally plays inside the hand, then the flow leaves for the board ──
      await page.locator('.con-hand .con-parl--embedded[data-rally-beat]').waitFor({timeout: 40_000});
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 90_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      await stopRedStory();
      await expect(page.locator(composer), 'the composer never comes back past the commit').toHaveCount(0);
      expect(posts.length, 'and nothing else was sent').toBe(1);

      // ── 5. the server ──
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect([slotOf(after, HC).totalVotes, slotOf(after, AA).totalVotes, slotOf(after, AC).totalVotes], 'HC 4, AA 4, AC 4').toEqual([4, 4, 4]);
      expect(neutralOn(after, HC), 'two neutral delegates on HC').toBe(2);
      expect(slotOf(after, HC).isWinning, 'HC wins the tie — slot 0').toBe(true);
      expect([after.game.parliament.popularSupport[REDS], after.game.parliament.popularSupport[MARS], after.game.parliament.popularSupport['Unity']], 'the areas 2 / 3 / 2').toEqual([2, 3, 2]);
      expect(after.game.parliament.neutralSupply, 'the supply 0').toBe(0);
      expect(after.thisPlayer.megacredits, '12 − 2 + 14').toBe(24);
      expect(after.game.parliament.lastRally, 'ONE record, the card\'s').toMatchObject({player: viewer, card: CARD, inUse: {before: 11, after: 14}, megacredits: 14});
      expect(after.game.parliament.lastRally?.votes.map((v) => v.instance.replace(/#.*/, ''))).toEqual([HC, AA]);
      expect(JSON.stringify(after.game.parliament.quest?.progress ?? {}), 'the chairman quest is untouched — neutral cubes are nobody\'s').toBe(questBefore);

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, beat: probe.beat, pool: probe.pool, hc: probe.hc, aa: probe.aa, winner: probe.winner, redsPlaces: probe.redsPlaces,
        marsRead: probe.marsRead, count: probe.count, mc: probe.mc, cubes: probe.cubes, coin: probe.coin});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/nationalist-movement-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── 2. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps[0], `the tail starts at the play (${dump})`).toBe('Розыгрыш');
      expect(probe.steps[probe.steps.length - 1], `…and ends at the rally (${dump})`).toBe('Делегаты');
      expect(probe.steps.filter((s) => s !== 'Розыгрыш' && s !== 'Разыграно' && s !== 'Делегаты'), `no stage but the three of the play (${dump})`).toEqual([]);
      expect(probe.parlOutsideHand, 'the Parliament stood inside the hand, never as a band of its own').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);
      expect(probe.beat.map(([, b]) => b), `the beats went forward (${dump})`).toEqual(['votes', 'support', 'count', 'coin', 'read', 'done']);

      // ── 3. before the first landing: the old numbers, the old winner, the price charged ──
      expect(probe.hc[0]?.[1], `HC still read 3 (${dump})`).toBe('3');
      expect(probe.aa[0]?.[1], `AA still read 3 (${dump})`).toBe('3');
      expect(probe.pool[0]?.[1], `the pool still read 3 (${dump})`).toBe('3');
      expect(probe.redsPlaces[0]?.[1], `the Reds' plaque still showed 1 (${dump})`).toBe('1');
      expect(probe.winner[0]?.[1], `the winning marker still on AC (${dump})`).toBe('Greens');
      // The rail's M€ row, its delta chips stripped: 12 at the press → 10 with the landing (the price, PL-001 for plays)
      // → 24 on the coin's touchdown — nothing in between, never the price and the recount in one tick.
      const mcValues = probe.mc.map(([, v]) => v.replace(/[+−-]\d+$/, '')).filter((v, i, all) => i === 0 || all[i - 1] !== v);
      expect(mcValues, `the rail: 12 → 10 (the price with the landing) → 24 (the coin) (${dump})`).toEqual(['12', '10', '24']);

      // ── 4. the order ──
      const pool2 = at(probe.pool, '2');
      const pool1 = at(probe.pool, '1');
      const pool0 = at(probe.pool, '0');
      const hc4 = at(probe.hc, '4');
      const aa4 = at(probe.aa, '4');
      const winHC = at(probe.winner, 'Reds');
      const reds2 = at(probe.redsPlaces, '2');
      const marsZero = probe.marsRead.find(([, v]) => /\+0 · область заполнена/i.test(v))?.[0];
      const count14 = at(probe.count, '14');
      const mc24 = probe.mc.find(([, v]) => v.startsWith('24'))?.[0];
      for (const [name, value] of Object.entries({pool2, hc4, winHC, pool1, aa4, pool0, reds2, marsZero, count14, mc24})) {
        expect(value, `${name} happened (${dump})`).toBeDefined();
      }
      expect(probe.cubes.length, `three cubes flew (${dump})`).toBe(3);
      expect(probe.cubes.every((c) => c.bornInPool), `every cube was born inside the pool's rect (${dump})`).toBe(true);
      expect(probe.cubes[0].at, `cube ① was seen before the pool dropped (${dump})`).toBeLessThanOrEqual(pool2!);
      expect(pool2!, `the pool dropped on the lift-off, before HC ticked (${dump})`).toBeLessThanOrEqual(hc4!);
      expect(hc4!, `HC «4» and the winning marker moved together — on that touchdown (${dump})`).toBeLessThanOrEqual(winHC!);
      expect(winHC! - hc4!, `…within a frame of each other (${dump})`).toBeLessThan(400);
      expect(hc4!, `HC before cube ② lifted (${dump})`).toBeLessThanOrEqual(pool1!);
      expect(pool1!, `cube ② lifted before AA ticked (${dump})`).toBeLessThanOrEqual(aa4!);
      expect(aa4!, `AA before cube ③ lifted (${dump})`).toBeLessThanOrEqual(pool0!);
      expect(pool0!, `cube ③ lifted before the Reds' second place filled (${dump})`).toBeLessThanOrEqual(reds2!);
      expect(reds2!, `the Reds' place before Mars First's named zero was read (${dump})`).toBeLessThanOrEqual(marsZero!);
      expect(marsZero!, `the named zero before the recount ended (${dump})`).toBeLessThan(count14!);
      // The recount: one mark at a time — never two marks in one render.
      const counts = probe.count.map(([, v]) => Number(v));
      expect(counts[0], `the count started at 0 or 1 (${dump})`).toBeLessThanOrEqual(1);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i] - counts[i - 1], `the count grew by one at a time (${dump})`).toBe(1);
      }
      expect(counts[counts.length - 1], `…up to 14 (${dump})`).toBe(14);
      expect(probe.coin, `the coin flew (${dump})`).toBeDefined();
      expect(probe.coin!.at, `the coin was born after the recount ended (${dump})`).toBeGreaterThanOrEqual(count14!);
      expect(probe.coin!.bornInCount, `…inside the count's rect (${dump})`).toBe(true);
      expect(mc24!, `the rail ticked after the coin was born (${dump})`).toBeGreaterThan(probe.coin!.at);
      expect(probe.cubes.every((c) => c.minY >= 0), `no cube above the screen (${dump})`).toBe(true);
      expect(probe.coin!.minY, `the coin never above the screen (${dump})`).toBeGreaterThanOrEqual(0);

      // ── 6. honesty ──
      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(await strandedReports(page), 'the leak witness saw nothing').toEqual([]);
      expect(overflow, 'no overflow').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);

      // ── 6. red, without reloading, with the Parliament open: the cubes arrived; the notification opens the Parliament ──
      await red.bringToFront();
      await expect.poll(() => red.locator('[data-parl-neutral-cube]').getAttribute('data-count'), {timeout: 30_000, message: 'red\'s pool emptied as the cubes arrived'}).toBe('0');
      await expect(red.locator(`.con-parl__slot[data-instance^="${HC}"] .con-parl__tally-num`), 'red reads HC 4').toHaveText('4', {timeout: 15_000});
      await expect(red.locator(`.con-parl__slot[data-instance^="${AA}"] .con-parl__tally-num`), 'red reads AA 4').toHaveText('4');
      await expect(red.locator(`.con-parl__slot[data-instance^="${HC}"].con-parl__slot--winning`), 'red reads the winning marker on HC').toHaveCount(1);
      await expect(red.locator(`[data-parl-support="${REDS}"] .con-pseal__support-place--on`), 'the Reds\' plaque at 2').toHaveCount(2);
      await expect(red.locator(`.con-parl__slot[data-instance^="${HC}"] .con-parl__vote-cube--hidden`), 'no cube left hidden on red\'s ribbon').toHaveCount(0);
      await expect(red.locator('.con-parl[data-parl-grant-degraded], .con-parl[data-parl-rally-degraded]'), 'no degraded flight on red\'s table').toHaveCount(0);
      // The notification stood on red's page while blue's recount played (its TTL is shorter than the rally): the witness saw it.
      const redNotes = await readRedWitness(red);
      const told = redNotes.find((n) => n.text.includes(CARD_RU));
      expect(told, `red was told of the play (${JSON.stringify(redNotes)})`).toBeDefined();
      expect(told!.detail, 'the card opens the Parliament — the object it is about').toContain('Парламент');
      fs.writeFileSync(`test-results/nationalist-movement-red-${preset.id}.json`, JSON.stringify(redNotes, null, 1));
      await shoot(red, preset.id, '02-red-table');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await red.close();
    });

    test(`the arrange variants, composer only: the short supply and the Reds ruling (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const posts: Array<string> = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      // 7a. THE SHORT SUPPLY: Unity 3 → 12 in use, a supply of 2.
      await bootFixture(page, request, 'nationalist-movement-short-supply', {query: preset.query});
      await settle(page);
      await openComposer(page);
      let rows = await textOf(page, composer);
      expect(rows).toMatch(/Улавливание тепла · 3 → 4 · Принимается/);
      expect(rows).toMatch(/Архитектурная премия · 3 → 4/);
      expect(rows, 'the Reds\' area: the named zero by the SUPPLY').toMatch(/Красные · \+0 · нейтральных не осталось/);
      expect(rows, 'Mars First\'s area: the named zero by its ceiling').toMatch(/Марс вперёд · \+0 · область заполнена/);
      expect(rows).toMatch(/В игре 12 → 14/);
      await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--megacredits')}).filter({hasText: '26'}), 'the M€ chip: 12 → 26').toHaveCount(1);
      await shoot(page, preset.id, '03-short-supply');
      expect(posts, 'nothing sent').toEqual([]);

      // 7b. THE REDS RULE by their enacted card: no Reds resolution up for a vote — a named zero, AA alone, both areas.
      await bootFixture(page, request, 'nationalist-movement-reds-rule', {query: preset.query});
      await settle(page);
      await openComposer(page);
      rows = await textOf(page, composer);
      expect(rows, 'the Reds\' named zero').toMatch(/Красные — резолюции на голосовании нет/);
      expect(rows, 'Mars First takes the vote and the tie').toMatch(/Архитектурная премия · 3 → 4 · Принимается — ничья/);
      expect(rows).not.toMatch(/Улавливание тепла/);
      expect(rows).toMatch(/Красные · 1 → 2 из 3/);
      expect(rows).toMatch(/Марс вперёд · \+0 · область заполнена/);
      expect(rows).toMatch(/В игре 11 → 13/);
      await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--megacredits')}).filter({hasText: '25'}), 'the M€ chip: 12 → 25').toHaveCount(1);
      await shoot(page, preset.id, '04-reds-rule');
      expect(posts, 'nothing sent').toEqual([]);
    });
  });
}
