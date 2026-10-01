import * as fs from 'fs';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';

/**
 * TR04 «ПРЕДСТАВИТЕЛЬСТВО МЕНЬШИНСТВ» — THE WALK OF THE AGENDA TRACK as the
 * OUTCOME of a play (docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md).
 *
 * A card that walks the marker two steps by being PLAYED — no question, no
 * door: «Разыграть карту» is the play's one POST, the answer carries the
 * walk's record, and the Parliament is pushed INTO the hand's own zone to
 * play it, step by step, each step's reward on its own landing; then the hand
 * and the hosted Parliament leave as ONE surface. The contract under test,
 * end to end against a real server, on two profiles:
 *
 *   1. The composer reads the walk BEFORE the press: «1 → 3» on the track's
 *      own unit, «+1 РТ», the influence «1 → 2», and the coming stage named
 *      («Карьера — маркер пройдёт 2 шага в Парламенте»); A is exactly ONE POST.
 *   2. It is ONE flow: on every sample the crumb keeps its root and the card's
 *      name; the tail only ever moves forward (РОЗЫГРЫШ → РАЗЫГРАНО → КАРЬЕРА);
 *      the Parliament is the ONE instance, teleported into the hand — never a
 *      band of its own, never a second workspace, never a head of its own.
 *   3. Before the first landing the marker still STANDS on step 1, the
 *      influence still reads 1 and the rail still says the old rating.
 *   4. THE ORDER: the cube lands on ② → the rating chip lands on the rail
 *      (+1) → the cube lands on ③ → the influence ticks 1 → 2; the band's chip
 *      for ② appears before ③ is reached; two cubes stand on ③ at the end
 *      (blue's beside red's, never on top).
 *   5. The server agrees: the card is on the table, 6 M€ paid (and 2 M€ back
 *      from the ruling Greens for the TR), the marker on 3, the rating +1, the
 *      influence 2 — and the «gain 1 TR» quest closed by the walk stands as a
 *      gate whose plate rose only AFTER the walk had settled.
 *   6. The flow ENDS ON THE BOARD: no workspace, nothing stranded, no overflow,
 *      no page error, no degraded flight.
 *
 * Fixture `minority-representation` (tests/e2e/fixtures/generate.ts): blue's
 * action phase, 10 M€, blue on step 1, red on step 3, the card in hand, a
 * «gain 1 TR» chairman quest open.
 */

const CARD = 'Minority Representation';
const CARD_RU = 'Представительство меньшинств';
const ROOT_RU = 'Карты в руке';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>};
  waitingFor?: {type: string, chairmanQuestPrompt?: unknown};
  game: {
    gameAge: number;
    parliament: {
      players: Array<{color: string, agenda: number, influence: number}>;
      lastAdvance?: {seq: number, from: number, to: number, steps: Array<{to: number, bonus?: string}>, reason: string, card?: string};
      quest?: {completedBy?: string};
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

type Series = Array<[number, string]>;
type Probe = {
  samples: number;
  /** Interval (task) samples only — the probe's own liveness floor. */
  ticks: number;
  /** The crumb's stage words, deduped in order of first appearance. */
  steps: Array<string>;
  /** Samples whose hand head lacked its root or the card's name. */
  crumbMisses: Array<string>;
  parlOutsideHand: boolean;
  parlMax: number;
  wsMax: number;
  ownHead: boolean;
  degraded: Array<string>;
  stranded: boolean;
  /** [ms, value] on every change — the FRAME claims are made on the interval (task) samples only. */
  cube: Series;
  /** The step whose row DRAWS the viewer's real cube (not hidden under a proxy) — through the section's own entry fade, which `cube` waits out. */
  cubeDrawn: Series;
  tr: Series;
  inf: Series;
  band: Series;
  beat: Series;
  /** The rating chip in flight: [ms, x, y] per task sample it was seen posed. */
  chip: Array<[number, number, number]>;
  /** The marker's proxy in flight: [ms, x, y] per task sample. */
  proxy: Array<[number, number, number]>;
  /** The chairman quest in the government, while visible: `open` or `done` («✓ Выполнено»). */
  quest: Series;
  /** The first ms a mandatory plate stood. */
  plateAt: number | undefined;
  /** The cubes on step 3 at the last sample. */
  cubesOn3: Array<string>;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, viewer: string): Promise<void> {
  await page.evaluate(({viewer, card, root}) => {
    const w = window as unknown as {__tr04: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, wsMax: 0, ownHead: false,
      degraded: [], stranded: false, cube: [], cubeDrawn: [], tr: [], inf: [], band: [], beat: [], chip: [], proxy: [], quest: [], plateAt: undefined, cubesOn3: [],
    };
    w.__tr04 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: string | undefined) => {
      if (value !== undefined && value !== '' && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    // `minOpacity`: the default reads «seen at full presence»; a tier the walk pose RECEDES (the government at .5 —
    // still read, as the 4K frame shows) is «painted» from a far lower floor.
    const visible = (el: HTMLElement | null, minOpacity = 0.5): boolean => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        return false;
      }
      let opacity = 1;
      for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        opacity *= Number(cs.opacity);
      }
      return opacity > minOpacity;
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
      if (p.plateAt === undefined && document.querySelector('.con-mandatory') !== null) {
        p.plateAt = Date.now() - t0;
      }
      if (!tick) {
        return; // the frame claims below are made on the task samples only (a microtask sees states never painted)
      }
      // THE MARKER: the step whose row shows the viewer's REAL cube (not hidden under a proxy).
      for (let step = 0; step <= 12; step++) {
        const cube = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${viewer}"]`);
        if (cube !== null && !cube.classList.contains('con-parl__agenda-cube--hidden')) {
          if (cube.getBoundingClientRect().width > 1) {
            note(p.cubeDrawn, String(step));
          }
          if (visible(cube)) {
            note(p.cube, String(step));
          }
        }
      }
      const proxy = document.querySelector<HTMLElement>('.con-parl__flight--agenda');
      if (proxy !== null && visible(proxy)) {
        const r = proxy.getBoundingClientRect();
        p.proxy.push([Date.now() - t0, Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]);
      }
      // THE CHAIRMAN QUEST the walked TR closes: open while the marker walks, «✓ Выполнено» only once the walk has landed.
      // (It stands in the government — the tier the walk pose recedes to .5: painted, read, not «full presence».)
      const quest = document.querySelector<HTMLElement>('[data-parl-quest]');
      if (quest !== null && visible(quest, 0.05)) {
        note(p.quest, quest.classList.contains('con-parl__quest--done') ? 'done' : 'open');
      }
      note(p.tr, text(document.querySelector('.con-res .con-score__value--tr')));
      note(p.inf, text(document.querySelector('.con-parl [data-parl-influence]')));
      note(p.band, Array.from(document.querySelectorAll('[data-parl-band-chip="agenda"]')).map((el) => el.getAttribute('data-parl-band-step') ?? '?').join(','));
      note(p.beat, document.querySelector('.con-parl')?.getAttribute('data-walk-beat') ?? undefined);
      document.querySelectorAll<HTMLElement>('.con-transfer__chip').forEach((el) => {
        if (el.style.transform === '' || el.querySelector('.resource_icon--rating') === null) {
          return;
        }
        const r = el.getBoundingClientRect();
        p.chip.push([Date.now() - t0, Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]);
      });
      const on3 = Array.from(document.querySelectorAll<HTMLElement>('[data-agenda-markers="3"] [data-agenda-cube]'))
        .filter((el) => !el.classList.contains('con-parl__agenda-cube--hidden'))
        .map((el) => el.getAttribute('data-agenda-cube') ?? '?');
      if (on3.length > 0) {
        p.cubesOn3 = on3;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {viewer, card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr04: Probe}).__tr04);

const composer = '.con-composer--play';

const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

/** The first ms `series` read `value`; undefined when it never did. */
const at = (series: Series, value: string): number | undefined => series.find(([, v]) => v === value)?.[0];

for (const preset of PRESETS) {
  test.describe(`TR04 Minority Representation · the walk of the Agenda track · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → the walk inside the hand, step by step, each step paid on its landing → the board (${preset.id})`, async ({page, request}) => {
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

      const playerId = await bootFixture(page, request, 'minority-representation', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      const rival = (wire: Wire) => wire.game.parliament.players.find((p) => p.color !== viewer)!;
      expect([me(before).agenda, me(before).influence], 'the fixture: blue on step 1, influence 1').toEqual([1, 1]);
      expect(rival(before).agenda, 'the fixture: red on step 3 — the step the walk ends on').toBe(3);
      const trBefore = before.thisPlayer.terraformRating;

      // ── 1. the composer: the walk read before the press ──
      await press(page, 'Period', 600); // RT → the quick wheel
      await press(page, 'Enter', 1600); // centre slot → the hand
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
      expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await expect(page.locator(composer), 'the CTA is the play\'s own verb — the walk is an outcome, not a door').toContainText('Разыграть карту');
      await expect(page.locator(`${composer} .action-effect-chip .resource_icon--agenda-step`), 'the track chip wears the track\'s own unit').toHaveCount(1);
      const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
      await expect(trackChip, 'the track chip reads the walk «1 → 3»').toContainText('1');
      await expect(trackChip).toContainText('3');
      const influenceChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--influence')});
      await expect(influenceChip, 'the influence chip reads the level the walk sets').toContainText('2');
      const trChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--rating')});
      await expect(trChip, 'the TR chip is its own chip').toHaveCount(1);
      await expect(page.locator(composer), 'the coming stage is named, from the server\'s reading').toContainText('Карьера — маркер пройдёт 2 шага в Парламенте');
      const paymentBefore = await textOf(page, `${composer} .con-paystatus`);
      expect(paymentBefore, 'the payment line states the price').toContain('6');

      await armProbe(page, viewer);

      // ── A: the play's ONE POST ──
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      expect(new URL(posts[0].url).pathname).toMatch(/\/player\/input/);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [sent as unknown as Record<string, unknown>];
      expect(responses.some((r) => JSON.stringify(r).includes(CARD)), 'the POST is the card\'s play').toBe(true);

      // ── the walk plays inside the hand, then the flow leaves for the board ──
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 60_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 30_000});
      await expect(page.locator(composer), 'the composer never comes back past the commit').toHaveCount(0);
      expect(posts.length, 'and nothing else was sent').toBe(1);

      // ── 5. the server ──
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.thisPlayer.megacredits, 'the card cost 6 M€, and the ruling Greens paid 2 M€ for the TR').toBe(before.thisPlayer.megacredits - 6 + 2);
      expect(me(after).agenda, 'the marker walked to 3').toBe(3);
      expect(me(after).influence, 'the influence is 2').toBe(2);
      expect(after.thisPlayer.terraformRating, 'the rating rose by the walked step').toBe(trBefore + 1);
      expect(after.game.parliament.lastAdvance, 'ONE record, the card\'s, with both steps').toMatchObject({from: 1, to: 3, reason: 'card', card: CARD, steps: [{to: 2, bonus: 'tr'}, {to: 3}]});
      expect(after.game.parliament.quest?.completedBy, 'the walked TR closed the «gain 1 TR» quest').toBe(viewer);

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, cube: probe.cube, cubeDrawn: probe.cubeDrawn, tr: probe.tr, inf: probe.inf, band: probe.band, beat: probe.beat, quest: probe.quest, plateAt: probe.plateAt,
        chip: probe.chip.length, proxy: probe.proxy.length, cubesOn3: probe.cubesOn3});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/minority-representation-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── 2. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps[0], `the tail starts at the play (${dump})`).toBe('Розыгрыш');
      expect(probe.steps[probe.steps.length - 1], `…and ends at the walk (${dump})`).toBe('Карьера');
      expect(probe.steps.filter((s) => s !== 'Розыгрыш' && s !== 'Разыграно' && s !== 'Карьера'), `no stage but the three of the play (${dump})`).toEqual([]);
      expect(probe.parlOutsideHand, 'the Parliament stood inside the hand, never as a band of its own').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);
      expect(probe.beat.map(([, b]) => b), `the walk's beats went forward (${dump})`).toEqual(['walk', 'read', 'done']);

      // ── 3. before the first landing: the marker never ahead of its walk, the influence 1, the old rating ──
      // (The walk starts the moment the Parliament has risen — the cube on 1 is lifted under the proxy within a
      // frame of the pose, so a 30 ms sampler may or may not catch it drawn there; what it must NEVER catch is the
      // cube on a step the marker has not walked to. The section rises through an opacity entry, so the DRAWN
      // series is the row's own witness and the VISIBLE series carries the landings.)
      const drawn = probe.cubeDrawn.map(([, s]) => Number(s));
      expect(drawn[0], `the marker was first drawn on 1 or 2 — never ahead of the walk (${dump})`).toBeLessThanOrEqual(2);
      expect(drawn, `the marker only ever moved forward, one step at a time (${dump})`).toEqual([...drawn].sort((a, b) => a - b));
      expect(drawn[drawn.length - 1], `…and ended on 3 (${dump})`).toBe(3);
      expect(probe.cube.map(([, s]) => s), `the landings, in order, and nothing before ② (${dump})`).toEqual(['2', '3']);
      expect(probe.inf[0]?.[1], `the influence still read 1 (${dump})`).toBe('1');
      expect(probe.tr[0]?.[1], `the rail still said the old rating (${dump})`).toBe(String(trBefore));

      // ── 4. the order: ② → the rating → ③ → the influence; the band's ② before ③ ──
      const on2 = at(probe.cube, '2');
      const on3 = at(probe.cube, '3');
      const rated = at(probe.tr, String(trBefore + 1));
      const influenced = at(probe.inf, '2');
      const bandTwo = probe.band.find(([, v]) => v.split(',').includes('2'))?.[0];
      expect(on2, `the cube landed on ② (${dump})`).toBeDefined();
      expect(rated, `the rating ticked (${dump})`).toBeDefined();
      expect(on3, `the cube landed on ③ (${dump})`).toBeDefined();
      expect(influenced, `the influence ticked to 2 (${dump})`).toBeDefined();
      expect(on2!, `② before the rating (${dump})`).toBeLessThanOrEqual(rated!);
      expect(rated!, `the rating before ③ — the next segment waits for the chip (${dump})`).toBeLessThan(on3!);
      expect(on3!, `③ before (or with) the influence tick (${dump})`).toBeLessThanOrEqual(influenced!);
      expect(bandTwo, `the band's ② chip appeared (${dump})`).toBeDefined();
      expect(bandTwo!, `…before the marker reached ③ (${dump})`).toBeLessThan(on3!);
      expect(probe.chip.length, `the rating chip was seen in flight (${dump})`).toBeGreaterThan(0);
      expect(probe.proxy.length, `the marker's proxy was seen in flight (${dump})`).toBeGreaterThan(2);
      expect(probe.cubesOn3.sort(), `two cubes stood on ③ at the end — blue's beside red's (${dump})`).toEqual([rival(after).color, viewer].sort());

      // ── B4. the chairman quest the walked TR closed: OPEN while the marker walks, «✓ Выполнено» only after the TR
      // has ticked and the marker has reached ③ — the answer's quest is held as it stood until the walk has landed.
      expect(probe.quest[0]?.[1], `the quest read OPEN when the Parliament rose (${dump})`).toBe('open');
      const questDone = at(probe.quest, 'done');
      expect(questDone, `the quest closed on screen (${dump})`).toBeDefined();
      expect(questDone!, `…only after the rating had ticked — the TR is what closes it (${dump})`).toBeGreaterThanOrEqual(rated!);
      expect(questDone!, `…and after the marker had reached ③ (${dump})`).toBeGreaterThanOrEqual(on3!);

      // ── B5. the quest's gate rose only AFTER the marker had settled (never over the walking cube) ──
      const done = at(probe.beat, 'done');
      expect(done, `the walk reported done (${dump})`).toBeDefined();
      expect(probe.plateAt, `the «gain 1 TR» quest closed by the walk announced its gate (${dump})`).toBeDefined();
      expect(probe.plateAt!, `the chairman-quest plate waited for the last landing (${dump})`).toBeGreaterThanOrEqual(on3!);

      // ── 6. honesty ──
      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no overflow').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
    });
  });
}
