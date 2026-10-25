import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, FixtureName, focusCard, press, settle} from './consoleStart';

/**
 * TR76 «ВОТУМ НЕДОВЕРИЯ» — «КРЕСЛО → КАРЬЕРА» as the OUTCOME of a play
 * (docs/TURMOIL_REDUX_VOTE_OF_NO_CONFIDENCE.md).
 *
 * «Requires at least 1 Influence. Remove the current Chairman and move your own
 * delegate (from the reserve) there instead. Advance your Agenda marker 1 step.»
 * No question, no door: «Разыграть карту» is the play's ONE POST, the answer
 * carries the seat's record and the walk's, and the Parliament is pushed INTO
 * the hand's zone to play BOTH as one phrase — the office first (the outgoing
 * delegate home to its owner's reserve, then the player's own off the reserve
 * stack into the chair), then the marker's step and its reward. The contract
 * under test, end to end against a real server:
 *
 *   а. The composer reads the play before the press: the influence plate met,
 *      the chair chip naming whose delegate leaves («снимает: …»), the reserve
 *      chip «n → n−1», the track chip «1 → 2»; A is exactly ONE POST.
 *   б. ONE flow: the crumb keeps its root and the card's name; the tail moves
 *      forward only (РОЗЫГРЫШ → РАЗЫГРАНО → КРЕСЛО → КАРЬЕРА); ONE Parliament,
 *      inside the hand. The walk's beats go seat → walk → read → done.
 *   в. THE ORDER: the chair keeps red until red's cube lifts; red's reserve
 *      counts its delegate home no earlier than the chair let go; the chair reads
 *      blue only after; the marker lands on ② only after the chair is blue.
 *   г. The server agrees: the chair is blue's, both reserves moved by one, the
 *      marker on 2, the TR +1, the card on the table, ONE journal group.
 *   д. The card refuses itself, each blocker named: influence 0 · the chair
 *      vacant · already the chairman · an empty reserve.
 *   е. Reduced motion: the same play, the server's numbers at once, nothing flies.
 *
 * Fixtures `vonc`, `-locked`, `-vacant`, `-self`, `-no-reserve` (tests/e2e/fixtures/generate.ts).
 * TIMING class: `npm run e2e:remote -- vonc tests/e2e/console-vote-of-no-confidence.spec.ts --exclusive --workers=1`.
 */

const CARD = 'Vote Of No Confidence:redux';
const CARD_RU = 'Вотум недоверия';
const ROOT_RU = 'Карты в руке';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const OUT = path.join('screenshots', 'vonc');
async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset === 'tv4k' ? 'tv' : preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>};
  game: {
    parliament: {
      chairman?: string;
      players: Array<{color: string, agenda: number, influence: number, reserve: number}>;
      lastAdvance?: {from: number, to: number, reason: string, card?: string};
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

type Series = Array<[number, string]>;
type Probe = {
  samples: number;
  ticks: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  parlOutsideHand: boolean;
  parlMax: number;
  degraded: Array<string>;
  stranded: boolean;
  /** Who the chair DRAWS (`data-parl-seat-chair`, '' = empty) — on task samples, while the Parliament stands. */
  chair: Series;
  /** The reserve stacks' painted counts. */
  redReserve: Series;
  blueReserve: Series;
  /** The step whose row draws the viewer's real cube. */
  cube: Series;
  beat: Series;
  /** Delegate figures in flight (the seat's proxies), per task sample. */
  flights: number;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, viewer: string, rival: string): Promise<void> {
  await page.evaluate(({viewer, rival, card, root}) => {
    const w = window as unknown as {__vonc: Probe};
    const p: Probe = {samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, degraded: [], stranded: false,
      chair: [], redReserve: [], blueReserve: [], cube: [], beat: [], flights: 0};
    w.__vonc = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: string | undefined) => {
      if (value !== undefined && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
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
        const degraded = el.getAttribute('data-parl-grant-degraded');
        if (degraded !== null && !p.degraded.includes(degraded)) {
          p.degraded.push(degraded);
        }
      });
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      if (!tick) {
        return;
      }
      p.ticks++;
      // A WARM mount (`--warm`: invisible, laid out ahead of the push) is not on screen — nothing in it is a flight the player sees.
      const parl = document.querySelector('.con-hand .con-parl--embedded:not(.con-parl--warm)');
      if (parl === null) {
        return;
      }
      note(p.chair, parl.querySelector('[data-parl-seat-chair]')?.getAttribute('data-parl-seat-chair') ?? '');
      note(p.redReserve, parl.querySelector(`[data-parl-seat-reserve="${rival}"]`)?.getAttribute('data-count') ?? undefined);
      note(p.blueReserve, parl.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count') ?? undefined);
      for (let step = 0; step <= 12; step++) {
        const cube = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${viewer}"]`);
        if (cube !== null && !cube.classList.contains('con-parl__agenda-cube--hidden') && cube.getBoundingClientRect().width > 1) {
          note(p.cube, String(step));
        }
      }
      note(p.beat, parl.getAttribute('data-walk-beat') ?? undefined);
      if (document.querySelector('.con-parl__flight') !== null) {
        p.flights++;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {viewer, rival, card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__vonc: Probe}).__vonc);

const composer = '.con-composer--play';

/** The first ms `series` read `value`; undefined when it never did. */
const at = (series: Series, value: string): number | undefined => series.find(([, v]) => v === value)?.[0];

async function focusTheCard(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

/** A on the composer — the play's ONE POST; retried only while nothing was sent. */
async function commitPlay(page: Page, posts: Array<{url: string, body: string}>): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
}

for (const preset of PRESETS) {
  test.describe(`TR76 Vote Of No Confidence · the chair, then the Career · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`а–г. play → the office changes hands inside the hand → one step → the board (${preset.id})`, async ({page, request}) => {
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

      const playerId = await bootFixture(page, request, 'vonc', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      const rivalSeat = (wire: Wire) => wire.game.parliament.players.find((p) => p.color !== viewer)!;
      const rival = rivalSeat(before).color;
      expect(before.game.parliament.chairman, 'the fixture: red in the chair').toBe(rival);
      expect([me(before).agenda, me(before).influence], 'the fixture: blue on step 1, influence 1').toEqual([1, 1]);

      // ── а. the composer reads the play before the press ──
      await focusTheCard(page);
      await shoot(page, preset.id, '01-hand');
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await expect(page.locator(composer), 'the CTA is the play\'s own verb — the seat and the walk are outcomes, not doors').toContainText('Разыграть карту');
      const chairChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--chair')});
      await expect(chairChip, 'the chair chip').toHaveCount(1);
      await expect(chairChip, 'it names whose delegate leaves the chair').toContainText('снимает');
      const reserveChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--delegate')});
      await expect(reserveChip, 'the reserve chip reads n → n−1').toContainText(String(me(before).reserve));
      await expect(reserveChip).toContainText(String(me(before).reserve - 1));
      const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
      await expect(trackChip, 'the track chip «1 → 2»').toContainText('2');
      await shoot(page, preset.id, '02-composer');

      await armProbe(page, viewer, rival);
      await commitPlay(page, posts);
      expect(posts.length, 'the play is ONE POST').toBe(1);
      expect(posts[0].body.includes(CARD), 'the POST is the card\'s play').toBe(true);

      // ── the outcome plays inside the hand, then the flow leaves for the board ──
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat="seat"]').waitFor({timeout: 10_000}).catch(() => undefined);
      await shoot(page, preset.id, '03-seat');
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat="read"]').waitFor({timeout: 30_000}).catch(() => undefined);
      await shoot(page, preset.id, '04-career');
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 60_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 30_000});
      expect(posts.length, 'and nothing else was sent').toBe(1);

      // ── г. the server ──
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.game.parliament.chairman, 'the chair is blue\'s').toBe(viewer);
      expect(me(after).reserve, 'blue\'s delegate left the reserve').toBe(me(before).reserve - 1);
      expect(rivalSeat(after).reserve, 'red\'s delegate is back in red\'s reserve').toBe(rivalSeat(before).reserve + 1);
      expect(me(after).agenda, 'the marker walked to 2').toBe(2);
      expect(after.thisPlayer.terraformRating, 'step ② paid its TR').toBe(before.thisPlayer.terraformRating + 1);
      expect(after.thisPlayer.megacredits, '5 M€ paid, the ruling Greens answered the TR with 2 M€').toBe(before.thisPlayer.megacredits - 5 + 2);
      expect(after.game.parliament.lastAdvance).toMatchObject({from: 1, to: 2, reason: 'card', card: CARD});

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, chair: probe.chair, red: probe.redReserve, blue: probe.blueReserve, cube: probe.cube, beat: probe.beat, flights: probe.flights});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/vonc-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── б. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      const tail = probe.steps.filter((s) => s === 'Кресло' || s === 'Карьера');
      expect(tail, `the tail named the chair, then the Career (${dump})`).toEqual(['Кресло', 'Карьера']);
      expect(probe.steps.filter((s) => !['Розыгрыш', 'Разыграно', 'Кресло', 'Карьера'].includes(s)), `no stage but the play's (${dump})`).toEqual([]);
      expect(probe.parlOutsideHand, 'the Parliament stood inside the hand').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.beat.map(([, b]) => b), `the beats went forward (${dump})`).toEqual(['seat', 'walk', 'read', 'done']);

      // ── в. the order: red's chair → empty (the cube lifts) → blue; red's reserve home on the touchdown; ② after the seat ──
      const chairs = probe.chair.map(([, c]) => c);
      expect(chairs[0], `the chair read red when the Parliament rose (${dump})`).toBe(rival);
      expect(chairs[chairs.length - 1], `…and blue at the end (${dump})`).toBe(viewer);
      expect(chairs.slice(chairs.indexOf(viewer)).every((c) => c === viewer), `nothing else sat down after blue (${dump})`).toBe(true);
      expect(chairs.slice(0, chairs.indexOf(viewer)).includes(''), `the chair read EMPTY between the two — red's cube lifted first (${dump})`).toBe(true);
      const blueSat = at(probe.chair, viewer)!;
      const redHome = at(probe.redReserve, String(rivalSeat(before).reserve + 1));
      expect(probe.redReserve[0]?.[1], `red's reserve read its old count first (${dump})`).toBe(String(rivalSeat(before).reserve));
      expect(redHome, `red's reserve counted the delegate home (${dump})`).toBeDefined();
      expect(redHome!, `…before blue sat down — the chair is vacated FIRST (${dump})`).toBeLessThanOrEqual(blueSat);
      const on2 = at(probe.cube, '2');
      expect(on2, `the cube landed on ② (${dump})`).toBeDefined();
      expect(on2!, `② only after the chair is blue — the office before its reward (${dump})`).toBeGreaterThan(blueSat);
      expect(probe.flights, `the figures were seen in flight (${dump})`).toBeGreaterThan(0);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no overflow').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`д. the card refuses itself, each blocker named (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const cases: Array<[FixtureName, string, string]> = [
        ['vonc-locked', 'Влияние', '05-locked-influence'],
        ['vonc-vacant', 'Кресло свободно', '06-locked-vacant'],
        ['vonc-self', 'Вы уже председатель', '07-locked-self'],
        ['vonc-no-reserve', 'В резерве нет делегатов', '08-locked-no-reserve'],
      ];
      for (const [fixture, words, frame] of cases) {
        await bootFixture(page, request, fixture, {query: preset.query});
        await focusTheCard(page);
        await expect(page.locator('.con-hand'), `${fixture}: «${words}»`).toContainText(words);
        await shoot(page, preset.id, frame);
      }
    });

    test(`е. reduced motion: the same play, the server's numbers at once, nothing flies (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await page.emulateMedia({reducedMotion: 'reduce'});
      const posts: Array<{url: string, body: string}> = [];
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });
      const playerId = await bootFixture(page, request, 'vonc', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const rival = before.game.parliament.players.find((p) => p.color !== viewer)!.color;
      await focusTheCard(page);
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await armProbe(page, viewer, rival);
      await commitPlay(page, posts);
      expect(posts.length, 'one POST').toBe(1);
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament.chairman, {timeout: 30_000}).toBe(viewer);
      await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-hand, .con-parl, .con-ws').length),
        {timeout: 40_000, message: 'the flow leaves for the board'}).toBe(0);
      const probe = await readProbe(page);
      expect(probe.flights, 'reduced motion: nothing flies').toBe(0);
      expect(probe.degraded, 'nothing confessed').toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });
}
