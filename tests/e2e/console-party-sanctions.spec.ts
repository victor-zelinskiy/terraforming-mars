import * as fs from 'fs';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';
import type {ObservedSample} from './observeCore';

/**
 * TR12 «ПАРТИЙНЫЕ САНКЦИИ» — THE SUPPORT-AREA MODE, the staged party pick of an AREA
 * (docs/TURMOIL_REDUX_PARTY_SANCTIONS.md).
 *
 * A card that strips ONE party's Popular Support area and walks the Agenda marker one
 * step, by being PLAYED. The contract under test, end to end against a real server,
 * on two profiles (a geometry claim made at one resolution is a claim about one
 * resolution):
 *
 *   1. The composer names the door («Выбрать партию»), the next step («Область
 *      поддержки — выбор в Парламенте») and the walk's chips; the door sends NOTHING.
 *   2. It is ONE flow: on every sample the crumb keeps its root and the card's name;
 *      the tail only ever reads РОЗЫГРЫШ → РАЗЫГРАНО (the ritual's own word) →
 *      САНКЦИИ; the Parliament is the ONE instance, teleported into the hand.
 *   3. The mode: the cursor walks the party plaques and moves NONE of them; Mars
 *      First's plaque reads «3 → 0», an empty area its reason; B walks back to the
 *      composer, the door opens again.
 *   4. A is the play's ONE POST, its tail ADDRESSED to the card.
 *   5. Two beats on one pose: Mars First's places go dark one by one while the
 *      common supply's count grows; only AFTER the last cube has landed does the
 *      marker leave step 3 for step 4, and the rating ticks after the marker lands.
 *   6. The server agrees: Mars First's area 0, the supply +3, the marker on 4, the
 *      rating +1, the card on the table, 2 M€ paid.
 *   7. The flow ENDS ON THE BOARD: no workspace, nothing stranded, no overflow, no
 *      page error, no flight that confessed a missing rect.
 *
 * Fixture `party-sanctions` (tests/e2e/fixtures/generate.ts): blue in the chair, the
 * card in hand, 10 M€, the Agenda marker on step 3 (step 4 pays TR); support Mars
 * First 3 · Scientists 1 · the rest 0 (SYNTHETIC — no sitting yet); the Industrialists
 * rule (a quiet government).
 */

const CARD = 'Party Sanctions';
const CARD_RU = 'Партийные санкции';
const ROOT_RU = 'Карты в руке';
const MARS = 'Mars First';
const SCIENTISTS = 'Scientists';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>};
  game: {
    gameAge: number;
    parliament: {
      neutralSupply: number;
      popularSupport: Record<string, number>;
      chairman?: string;
      players: Array<{color: string, agenda: number}>;
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

type Series = Array<[number, number]>;
type Probe = {
  samples: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  parlOutsideHand: boolean;
  parlMax: number;
  wsMax: number;
  ownHead: boolean;
  degraded: Array<string>;
  stranded: boolean;
  /** Painted states: the cubes Mars First's plaque draws · the supply's shown count · the step the viewer's real cube stands on · the rail's rating. */
  places: Series;
  pool: Series;
  cube: Series;
  tr: Series;
  /** The neutral cubes' proxies seen in flight (painted states) and the marker's. */
  neutralFlights: number;
  markerFlights: number;
};

/** What one painted state shows (the reader's observation). */
type Seen = {
  head: {root: string, subjects: Array<string>, steps: Array<string>} | null,
  parls: Array<{outside: boolean, ownHead: boolean, degraded: Array<string>}>,
  ws: number, stranded: boolean,
  places: number | null, pool: number | null, cubeSteps: Array<number>, tr: string,
  neutralFlights: number, markerFlights: number,
};
const PROBE_WITNESS = 'tr12-sanctions';

/**
 * THE PROBE — RECORDED (FLAKE ZERO — `armWitness`, armed before the door, replace-proof): the reader returns what stands
 * now, every distinct state is kept with the page's time and the folding (the crumb's tail, the series) is `foldProbe`'s.
 * The claims are about painted states and their ORDER, so the record is `settled` — the state a task LEAVES (the old
 * sampler made its frame claims on its timer ticks only: a microtask sees states never painted).
 */
async function armProbe(page: Page, viewer: string): Promise<void> {
  await armWitness<Seen, {viewer: string, mars: string}>(page, PROBE_WITNESS, ({viewer, mars}) => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const hand = document.querySelector('.con-hand');
    const head = hand?.querySelector('.con-wshead') ?? null;
    const plaque = document.querySelector(`[data-parl-support="${mars}"]`);
    const pool = document.querySelector('[data-parl-neutral-cube]')?.getAttribute('data-count');
    const cubeSteps: Array<number> = [];
    for (let step = 0; step <= 12; step++) {
      const cube = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${viewer}"]`);
      if (cube !== null && !cube.classList.contains('con-parl__agenda-cube--hidden') && cube.getBoundingClientRect().width > 1) {
        cubeSteps.push(step);
      }
    }
    let neutralFlights = 0;
    let markerFlights = 0;
    document.querySelectorAll<HTMLElement>('.con-parl__flight').forEach((el) => {
      if (getComputedStyle(el).visibility === 'hidden' || el.getBoundingClientRect().width < 2) {
        return;
      }
      if (el.classList.contains('con-parl__flight--agenda')) {
        markerFlights++;
      } else {
        neutralFlights++;
      }
    });
    return {
      head: head === null ? null : {
        root: text(head.querySelector('.con-wshead__root')),
        subjects: Array.from(head.querySelectorAll('.con-wshead__subject')).map(text),
        steps: Array.from(head.querySelectorAll('.con-wshead__step')).map(text).filter((x) => x !== ''),
      },
      parls: Array.from(document.querySelectorAll('.con-parl')).map((el) => ({
        outside: el.closest('.con-hand') === null || el.classList.contains('con-ws'),
        ownHead: el.querySelector('.con-wshead') !== null,
        degraded: ['data-parl-support-degraded', 'data-parl-grant-degraded', 'data-renewal-degraded']
          .map((attr) => el.getAttribute(attr)).filter((x): x is string => x !== null),
      })),
      ws: document.querySelectorAll('.con-ws').length,
      stranded: document.querySelector('.con-stranded') !== null,
      places: plaque === null ? null : plaque.querySelectorAll('.con-pseal__support-place--on').length,
      pool: pool === null || pool === undefined ? null : Number(pool),
      cubeSteps,
      tr: text(document.querySelector('.con-res .con-score__value--tr')),
      neutralFlights,
      markerFlights,
    };
  }, {args: {viewer, mars: MARS}, settled: true, max: 20_000});
}

/** The record folded into the flow's facts — times are the PAGE's, from the arm. */
function foldProbe(samples: ReadonlyArray<ObservedSample<Seen>>): Probe {
  const p: Probe = {
    samples: samples.length, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, wsMax: 0, ownHead: false,
    degraded: [], stranded: false, places: [], pool: [], cube: [], tr: [], neutralFlights: 0, markerFlights: 0,
  };
  const t0 = samples[0]?.t ?? 0;
  for (const s of samples) {
    const now = s.t - t0;
    const v = s.v;
    const note = (series: Series, value: number | null) => {
      if (value !== null && Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
        series.push([now, value]);
      }
    };
    if (v.head !== null) {
      if (v.head.root.toLowerCase() !== ROOT_RU.toLowerCase() || !v.head.subjects.some((x) => x.toLowerCase() === CARD_RU.toLowerCase())) {
        if (p.crumbMisses.length < 8) {
          p.crumbMisses.push(`${now}ms root=«${v.head.root}» subject=«${v.head.subjects.join('|')}»`);
        }
      }
      for (const step of v.head.steps) {
        if (!p.steps.includes(step)) {
          p.steps.push(step);
        }
      }
    }
    p.parlMax = Math.max(p.parlMax, v.parls.length);
    for (const parl of v.parls) {
      p.parlOutsideHand ||= parl.outside;
      p.ownHead ||= parl.ownHead;
      for (const degraded of parl.degraded) {
        if (!p.degraded.includes(degraded)) {
          p.degraded.push(degraded);
        }
      }
    }
    p.wsMax = Math.max(p.wsMax, v.ws);
    p.stranded ||= v.stranded;
    note(p.places, v.places);
    note(p.pool, v.pool);
    for (const step of v.cubeSteps) {
      note(p.cube, step);
    }
    note(p.tr, Number(v.tr));
    p.neutralFlights += v.neutralFlights;
    p.markerFlights += v.markerFlights;
  }
  return p;
}

const readProbe = async (page: Page): Promise<Probe> => foldProbe(await witnessOf<Seen>(page, PROBE_WITNESS).stop());

const composer = '.con-composer--play';
/** The support-area mode ON SCREEN. After B the composer still declares its hosted step and PL-127 keeps the Parliament
 *  WARM under it — the same instance, invisible, still in its `support` pose (PL-158): it is not the mode taken, and a
 *  driver that counted it pressed nothing on the second door. */
const supportMode = '.con-hand .con-parl--embedded.con-parl--support:not(.con-parl--warm) [data-parl-support-mode]';

/** The plaque the mode's cursor stands on (its reading's party), or undefined. */
const cursorParty = (page: Page) => page.evaluate(() =>
  document.querySelector('[data-parl-support-reading]')?.getAttribute('data-support-party') ?? undefined);

/** Every party plaque's box (rounded), read AT REST (C — `readSettled`) — the ring the cursor walks; nothing in it may move. */
const plaqueBoxes = (page: Page) => readSettled(page, () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-parl__party[data-party]'))
  .map((el) => {
    const r = el.getBoundingClientRect();
    return `${el.getAttribute('data-party')}:${[r.left, r.top, r.width, r.height].map(Math.round).join(',')}`;
  }).sort().join('|')), {message: 'the party plaques\' ring'});

/** Walk the cursor to `party` down / up the opposition COLUMN (the hall's own geometry) — one press at a time, each VERIFIED by the cursor itself (never a blind count). */
async function moveCursorTo(page: Page, party: string, dir: 'ArrowDown' | 'ArrowUp'): Promise<void> {
  for (let step = 0; step < 8; step++) {
    const at = await cursorParty(page);
    if (at === party) {
      return;
    }
    await press(page, dir, 200);
    await expect.poll(() => cursorParty(page), {timeout: 2_500}).not.toBe(at).catch(() => undefined);
  }
  expect(await cursorParty(page), `the cursor reached «${party}»`).toBe(party);
}

/** «ВЫБРАТЬ ПАРТИЮ» — one press, verified by the composer's OWN state. Never a blind retry: a second A in the mode is the COMMIT. */
async function chooseParty(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) !== null, supportMode);
  await pressUntil(page, 'Enter', taken, {tries: 3, settleMs: 2_500});
  await page.locator(supportMode).waitFor({timeout: 30_000});
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** The first ms `series` read `value`; undefined when it never did. */
const firstAt = (series: Series, value: number): number | undefined => series.find(([, v]) => v === value)?.[0];

for (const preset of PRESETS) {
  test.describe(`TR12 Party Sanctions · the support-area mode · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать партию» → the plaques inside the hand → B → back → A → the cubes leave, the marker walks → the board (${preset.id})`, async ({page, request}) => {
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

      const playerId = await bootFixture(page, request, 'party-sanctions', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      expect([before.game.parliament.popularSupport[MARS], before.game.parliament.popularSupport[SCIENTISTS]],
        'the fixture: Mars First holds three, the Scientists one').toEqual([3, 1]);
      expect(me(before).agenda, 'the fixture: the marker on step 3').toBe(3);
      const trBefore = before.thisPlayer.terraformRating;

      // ── 1. the composer: the door's verb, the step row, the walk's chips ──
      await press(page, 'Period', 600); // RT → the quick wheel
      await press(page, 'Enter', 1600); // centre slot → the hand
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
      expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      // THE CHAIR in the MIN plate (T10 — the one mark of the chairmanship, never upstream's bust).
      expect(await page.locator(`${composer} .pcard__reqs .pcard-req__icon`).first().evaluate((el) => getComputedStyle(el).backgroundImage),
        'the hero\'s MIN plate prints the chair').toContain('chair.svg');
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать партию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Область поддержки — выбор в Парламенте');
      await expect(page.locator(`${composer} .action-effect-chip .resource_icon--agenda-step`), 'the walk\'s track chip').toHaveCount(1);
      await expect(page.locator(`${composer} .action-effect-chip .resource_icon--rating`), 'the step\'s TR chip').toHaveCount(1);

      await armProbe(page, viewer);

      // ── 1b. «Выбрать партию»: nothing is sent ──
      await chooseParty(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 3. the mode: the plaques read the server's areas; the cursor moves nothing ──
      await expect.poll(() => cursorParty(page), {timeout: 10_000, message: 'the cursor starts on the first area on offer'}).toBe(SCIENTISTS);
      await expect(page.locator(`.con-parl__party[data-party="${MARS}"] [data-pseal-pick]`), 'Mars First reads «3 → 0»').toHaveText(/3\s*→\s*0/);
      await expect(page.locator(`.con-parl__party[data-party="${SCIENTISTS}"] [data-pseal-pick]`), 'the Scientists read «1 → 0»').toHaveText(/1\s*→\s*0/);
      await expect(page.locator('.con-parl__party[data-party="Unity"] [data-pseal-pick]'), 'an empty area names its reason').toContainText('Область пуста');
      const ring0 = await plaqueBoxes(page);
      await moveCursorTo(page, MARS, 'ArrowDown');
      await expect(page.locator('[data-parl-support-reading]'), 'the panel reads the cursor\'s area').toHaveAttribute('data-support-current', '3');
      await expect(page.locator(`[data-parl-support="${MARS}"] [data-support-outgoing]`), 'the cubes that would leave are outlined').toHaveCount(3);
      await moveCursorTo(page, 'Unity', 'ArrowUp');
      await expect(page.locator('[data-parl-support-reading]'), 'an empty area is refused').not.toHaveAttribute('data-support-available', '');
      expect(await plaqueBoxes(page), 'walking the cursor moved no plaque').toBe(ring0);
      expect(posts, 'walking the plaques sends nothing').toEqual([]);

      // ── 3b. B walks back to the composer — nothing sent ──
      const backTaken = () => page.evaluate((sel) =>
        document.querySelector(sel) !== null || document.querySelector('.con-parl:not(.con-parl--warm)') === null ||
        document.querySelector('.con-parl[data-parl-leaving]') !== null, composer);
      await pressUntil(page, 'Escape', backTaken, {tries: 3, settleMs: 3_000});
      await expect(page.locator(composer), 'B restores the composer').toHaveCount(1, {timeout: 15_000});
      // …the hosted step LEFT. The composer still declares its hosted step, so the Parliament's surface is WARMED under it
      // again (PL-127: mounted invisible, `.con-parl--warm`) — that instance is not the step coming back.
      await expect(page.locator('.con-parl:not(.con-parl--warm)'), 'the step left').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await expect(page.locator(composer)).toContainText('Выбрать партию');
      expect(posts).toEqual([]);

      // ── 4. in again; A on Mars First is the play's ONE POST, addressed to the card ──
      await chooseParty(page);
      await moveCursorTo(page, MARS, 'ArrowDown');
      await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 3_000});
      expect(posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail is the AREA, addressed to the card').toMatchObject({type: 'party', partyName: MARS, stagedFor: CARD});

      // ── 6. the server: the area, the supply, the marker, the rating, the card, the price ──
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.map((c) => c.name),
        {timeout: 30_000, message: 'the committed play reached the table'}).toContain(CARD);
      const after = await wireOf(request, playerId);
      expect(after.game.parliament.popularSupport[MARS], 'Mars First\'s area is empty').toBe(0);
      expect(after.game.parliament.popularSupport[SCIENTISTS], 'the Scientists\' area is untouched').toBe(1);
      expect(after.game.parliament.neutralSupply, 'three neutral delegates returned to the supply').toBe(before.game.parliament.neutralSupply + 3);
      expect(me(after).agenda, 'the marker walked one step').toBe(4);
      expect(after.thisPlayer.terraformRating, 'step 4 paid its TR').toBe(trBefore + 1);
      expect(after.thisPlayer.megacredits, 'the card cost 2 M€ (a quiet government pays nothing back)').toBe(before.thisPlayer.megacredits - 2);
      expect(after.game.parliament.chairman, 'the chair stays with blue').toBe(before.game.parliament.chairman);

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
      const dump = JSON.stringify({steps: probe.steps, places: probe.places, pool: probe.pool, cube: probe.cube, tr: probe.tr,
        flights: [probe.neutralFlights, probe.markerFlights]});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/party-sanctions-${preset.id}.json`, JSON.stringify(probe, null, 1));
      // The recorder's liveness only (a dead recorder): it keeps distinct STATES, never frames.
      expect(probe.samples, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(0);

      // ── 2. one flow: the crumb, the one instance ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps, `the tail only ever moved forward (${dump})`).toEqual(['Розыгрыш', 'Разыграно', 'Санкции']);
      expect(probe.parlOutsideHand, 'the Parliament stood inside the hand, never as a band of its own').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);

      // ── 5. two beats, in the printed order: the cubes leave, THEN the marker walks, THEN the rating ticks ──
      // The claims are ORDER and DIRECTION (a loaded runner can merge 110 ms launches into one sample).
      const supply = before.game.parliament.neutralSupply;
      const placesDrop = probe.places.slice(probe.places.map(([, v]) => v).lastIndexOf(3) + 1);
      const falling = (xs: ReadonlyArray<number>) => xs.every((v, i) => i === 0 || v < xs[i - 1]);
      expect(placesDrop.length > 0 && falling(placesDrop.map(([, v]) => v)) && placesDrop[placesDrop.length - 1][1] === 0,
        `Mars First's places went dark downwards to zero — never a blink to empty first (${dump})`).toBe(true);
      expect(probe.pool[0]?.[1], `the supply read what it held until the first touchdown (${dump})`).toBe(supply);
      const rises = probe.pool.slice(1);
      expect(rises.length > 0 && falling(rises.map(([, v]) => -v)) && rises[rises.length - 1][1] === supply + 3,
        `the supply's count only ever rose, up to three more — never a jump to the server's number first (${dump})`).toBe(true);
      expect(placesDrop[0][0], `the first place went dark (lift-off) before the supply counted the cube (${dump})`).toBeLessThanOrEqual(rises[0][0]);
      const lastLanding = rises[rises.length - 1][0];
      const onFour = firstAt(probe.cube, 4);
      expect(probe.cube[0]?.[1], `the marker stood on step 3 first (${dump})`).toBe(3);
      expect(onFour, `the marker reached step 4 (${dump})`).toBeDefined();
      expect(onFour!, `…only AFTER the last cube had landed in the supply — the discard, then the step (${dump})`).toBeGreaterThanOrEqual(lastLanding);
      const rated = firstAt(probe.tr, trBefore + 1);
      expect(probe.tr[0]?.[1], `the rail said the old rating first (${dump})`).toBe(trBefore);
      expect(rated, `the rating ticked (${dump})`).toBeDefined();
      expect(rated!, `…after the marker landed on step 4 (${dump})`).toBeGreaterThanOrEqual(onFour!);
      expect(probe.neutralFlights, `the neutral cubes were seen in flight (${dump})`).toBeGreaterThan(0);
      expect(probe.markerFlights, `the marker was seen in flight (${dump})`).toBeGreaterThan(0);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}
