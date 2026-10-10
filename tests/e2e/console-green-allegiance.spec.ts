import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openConsole, openZoomViewer, press, settle} from './consoleStart';
import {openParliament} from './parliamentDrive';

/**
 * TR42 «ВЕРНОСТЬ ЗЕЛЁНЫМ» — the walk of TR04 / TR37 with its length COUNTED
 * from the player's rating («1 step per complete set of 5 TR over 20»). The
 * walk is the ONE phrase TR04 pinned; what is new end to end, on two profiles,
 * against a real server:
 *
 *   1. THE FORECAST BEFORE THE PRESS, with WHY: the hand tile's quiet plate
 *      «[★] 2» (К-H1), the composer's track chip «1 → 3 · 2 набора по 5 РТ
 *      сверх 20», the why row «Шаги Карьеры по РТ: РТ 33 · порог 20 · 2
 *      полных набора · до следующего 2» before the stage row, the TR and
 *      influence chips, the ruling Greens' answer in «Сработает»; the
 *      inspector's «ДЛЯ ВАС» says the same (decision 5 (в)).
 *   2. THE HONEST ZERO (TR 23): the plate «[★] 0» muted, the composer with NO
 *      track chip and ONE row naming the zero and the distance to the first
 *      set, no stage promised; the play is one POST and lands as an ordinary
 *      play — the Parliament never rises; the 2 M€ are paid; no walk record.
 *   3. THE LONGEST WALK OF THE SET (TR 45 from step 0): five legs in order,
 *      two rating chips and two Greens' answers, each after its cause; the
 *      duration from A to the board is printed (К-W1); and with «дожать» (A
 *      during the walk pose) the waits collapse while every leg and every
 *      reward still plays — nothing is skipped.
 *
 * Fixtures `green-allegiance` / `-zero` / `-long` (tests/e2e/fixtures/
 * generate.ts): blue's action phase, 10 M€, the Greens ruling by the starting
 * rule, blue at Thorgate (pays the printed 2), red at Teractor, red on step 3.
 */

const CARD = 'Green Allegiance';
const CARD_RU = 'Верность Зелёным';
const ROOT_RU = 'Карты в руке';
const OUT = path.resolve('screenshots', 'green-allegiance');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>, cardsInHandNbr: number};
  game: {
    parliament: {
      players: Array<{color: string, agenda: number, influence: number}>;
      lastAdvance?: {seq: number, from: number, to: number, steps: Array<{to: number, bonus?: string}>, reason: string, card?: string};
    };
  };
};

/** The server's own view. One retry on a dropped socket (a loaded per-worker server resets a connection now and then). */
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
  wsMax: number;
  ownHead: boolean;
  degraded: Array<string>;
  stranded: boolean;
  parlFirst: {walk: boolean, tail: string, ms: number} | undefined;
  bar: Series;
  cube: Series;
  tr: Series;
  mc: Series;
  inf: Series;
  band: Series;
  beat: Series;
  /** Rating chips in flight: [ms, x, y]. */
  chip: Array<[number, number, number]>;
  /** The marker proxy in flight: [ms, x, y]. */
  proxy: Array<[number, number, number]>;
  /** The board home stands again (no hand, no Parliament, no band) — the flow's end on the probe's clock. */
  homeMs: number | undefined;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, viewer: string): Promise<void> {
  await page.evaluate(({viewer, card, root}) => {
    const w = window as unknown as {__tr42: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, wsMax: 0, ownHead: false,
      degraded: [], stranded: false, parlFirst: undefined, bar: [], cube: [], tr: [], mc: [], inf: [], band: [], beat: [],
      chip: [], proxy: [], homeMs: undefined,
    };
    w.__tr42 = p;
    const t0 = Date.now();
    let seenHand = false;
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: string | undefined) => {
      if (value !== undefined && value !== '' && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const visible = (el: HTMLElement | null): boolean => {
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
      return opacity > 0.5;
    };
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const hand = document.querySelector('.con-hand');
      seenHand = seenHand || hand !== null;
      const head = hand?.querySelector('.con-wshead') ?? null;
      let tail = '';
      if (head !== null) {
        const rootText = text(head.querySelector('.con-wshead__root'));
        const subjects = Array.from(head.querySelectorAll('.con-wshead__subject')).map(text);
        if (rootText.toLowerCase() !== root.toLowerCase() || !subjects.some((s) => s.toLowerCase() === card.toLowerCase())) {
          if (p.crumbMisses.length < 8) {
            p.crumbMisses.push(`${Date.now() - t0}ms root=«${rootText}» subject=«${subjects.join('|')}»`);
          }
        }
        const stepEls = Array.from(head.querySelectorAll('.con-wshead__step'));
        stepEls.forEach((el) => {
          const step = text(el);
          if (step !== '' && !p.steps.includes(step)) {
            p.steps.push(step);
          }
        });
        tail = text(stepEls[stepEls.length - 1] ?? null);
      }
      const parls = document.querySelectorAll<HTMLElement>('.con-parl:not(.con-parl--warm)');
      p.parlMax = Math.max(p.parlMax, parls.length);
      if (parls.length > 0 && p.parlFirst === undefined) {
        p.parlFirst = {walk: parls[0].classList.contains('con-parl--walk'), tail, ms: Date.now() - t0};
      }
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
      if (p.homeMs === undefined && seenHand && hand === null && parls.length === 0 && document.querySelectorAll('.con-ws').length === 0) {
        p.homeMs = Date.now() - t0;
      }
      if (!tick) {
        return; // the frame claims below are made on the task samples only (a microtask sees states never painted)
      }
      note(p.bar, text(document.querySelector('.con-cmdbar')));
      for (let step = 0; step <= 12; step++) {
        const cube = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${viewer}"]`);
        if (cube !== null && !cube.classList.contains('con-parl__agenda-cube--hidden') && visible(cube)) {
          note(p.cube, String(step));
        }
      }
      const proxy = document.querySelector<HTMLElement>('.con-parl__flight--agenda');
      if (proxy !== null && visible(proxy)) {
        const r = proxy.getBoundingClientRect();
        p.proxy.push([Date.now() - t0, Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]);
      }
      note(p.tr, text(document.querySelector('.con-res .con-score__value--tr')));
      // The digits ONLY — a delta chip inside the row («7−3») is the move's story, not the count.
      note(p.mc, (text(document.querySelector('.con-res__row--megacredits .con-res__digits')).match(/^-?\d+/) ?? [undefined])[0]);
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
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {viewer, card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr42: Probe}).__tr42);

type RedNote = {at: number, text: string, detail: string};
type RedProbe = {notes: Array<RedNote>, cube: Series, proxy: number};

/** RED'S WITNESS: every notification card as it APPEARS, and where blue's marker stands on red's own Parliament. */
async function armRedProbe(page: Page, blue: string): Promise<void> {
  await page.evaluate(({blue}) => {
    const w = window as unknown as {__red: RedProbe};
    const p: RedProbe = {notes: [], cube: [], proxy: 0};
    w.__red = p;
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
        p.notes.push({at: Date.now() - t0, text: text(el), detail: text(el.querySelector('.con-notif__action--detail'))});
      });
      let position: string | undefined;
      for (let step = 0; step <= 12 && position === undefined; step++) {
        const cube = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${blue}"]`);
        if (cube !== null && !cube.classList.contains('con-parl__agenda-cube--hidden') && cube.getBoundingClientRect().width > 1) {
          position = String(step);
        }
      }
      if (position === undefined) {
        const proxy = document.querySelector<HTMLElement>('.con-parl__flight--agenda');
        const r = proxy?.getBoundingClientRect();
        if (r !== undefined && r.width > 1) {
          p.proxy++;
          const cx = r.left + r.width / 2;
          for (let step = 0; step <= 12 && position === undefined; step++) {
            const row = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"]`)?.getBoundingClientRect();
            if (row !== undefined && cx >= row.left && cx <= row.right) {
              position = String(step);
            }
          }
        }
      }
      const last = p.cube[p.cube.length - 1];
      if (position !== undefined && (last === undefined || last[1] !== position)) {
        p.cube.push([Date.now() - t0, position]);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 50);
  }, {blue});
}

const readRedProbe = (page: Page): Promise<RedProbe> => page.evaluate(() => (window as unknown as {__red: RedProbe}).__red);

const composer = '.con-composer--play';
const slot = `.con-hand [data-zoom-slot="${CARD}"]`;

/** The first ms `series` read `value`; undefined when it never did. */
const at = (series: Series, value: string): number | undefined => series.find(([, v]) => v === value)?.[0];
/** The LANDINGS of a walk — the cube series without the marker's START step (the hold may be sampled before the first lead). */
const landings = (series: Series, from: number): Array<string> => series.map(([, v]) => v).filter((v, i) => !(i === 0 && v === String(from)));

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
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

/** The wheel → the hand → the card focused (the composer is NOT opened — the tile's plate is read first). */
async function focusInHand(page: Page): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(slot).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

/** The focused hand card → its composer. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

type Run = {
  posts: Array<{url: string, body: string}>;
  pageErrors: Array<string>;
  overflow: Array<string>;
  holdWarnings: Array<string>;
};

function witness(page: Page): Run {
  const run: Run = {posts: [], pageErrors: [], overflow: [], holdWarnings: []};
  page.on('pageerror', (e) => run.pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.text().includes('[console-overflow]')) {
      run.overflow.push(m.text().slice(0, 200));
    }
    if (m.text().includes('[animation-hold]') && m.text().includes('force-released')) {
      run.holdWarnings.push(m.text().slice(0, 240));
    }
  });
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      run.posts.push({url: r.url(), body: r.postData() ?? ''});
    }
  });
  return run;
}

/** A: the play's ONE POST (a press may be absorbed — act → verify → retry). */
async function pressA(page: Page, run: Run): Promise<void> {
  for (let attempt = 0; attempt < 3 && run.posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => run.posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(run.posts.length, 'the play is ONE POST').toBe(1);
  expect(run.posts[0].body.includes(CARD), 'the POST is the card\'s play').toBe(true);
}

async function waitFlowLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    hand: document.querySelectorAll('.con-hand').length,
    parl: document.querySelectorAll('.con-parl').length,
    ws: document.querySelectorAll('.con-ws').length,
  })), {timeout: 90_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
  await settle(page, {timeoutMs: 30_000});
}

/** The flow's invariants every WALKING table shares: one flow, one Parliament inside the hand, nothing degraded. «Дожать» collapses the read. */
function expectOneWalk(probe: Probe, run: Run, dump: string, hurried = false): void {
  expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);
  expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
  expect(probe.steps[probe.steps.length - 1], `the crumb ends at the walk (${dump})`).toBe('Карьера');
  expect(probe.steps.filter((s) => s !== 'Розыгрыш' && s !== 'Разыграно' && s !== 'Карьера'), `no stage but the three of the play (${dump})`).toEqual([]);
  expect(probe.parlOutsideHand, 'the Parliament stood inside the hand, never as a band of its own').toBe(false);
  expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
  expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
  expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);
  const beats = probe.beat.map(([, b]) => b);
  expect(hurried ? beats.filter((b) => b !== 'read') : beats, `the walk's beats went forward (${dump})`).toEqual(hurried ? ['walk', 'done'] : ['walk', 'read', 'done']);
  expect(probe.parlFirst?.walk, `the Parliament stood in its WALK pose on its first sample (${dump})`).toBe(true);
  expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
  expect(probe.stranded, 'nothing was stranded').toBe(false);
  expect(run.overflow, 'no overflow').toEqual([]);
  expect(run.pageErrors, 'no page error').toEqual([]);
  expect(run.holdWarnings, 'no animation hold was force-released by its ceiling').toEqual([]);
}

/** The first ms the band carried step `step`'s chip — the LANDING's own witness (the band grows a chip per landing). */
const bandAt = (probe: Probe, step: number): number | undefined => probe.band.find(([, v]) => v.split(',').includes(String(step)))?.[0];

/**
 * The rating ticks after each landing on a TR step, and before the next landing; the Greens' answer never before its
 * rating; and the M€ row NEVER reads below «the price paid» (PL-151: the walk's answer was held twice — by the
 * landing's rail AND the walk — and the row dipped by the whole answer from the press until the landing let go).
 */
function expectRatingsInOrder(probe: Probe, trBefore: number, mcAfterPrice: number, trSteps: ReadonlyArray<number>, dump: string): void {
  const values = probe.mc.map(([, v]) => Number(v));
  expect(Math.min(...values), `the M€ row never dipped below the price paid (PL-151; mc ${JSON.stringify(probe.mc)})`).toBeGreaterThanOrEqual(mcAfterPrice);
  const paidAt = probe.mc.find(([, v]) => Number(v) === mcAfterPrice)?.[0];
  expect(paidAt, `the price ticked (${dump})`).toBeDefined();
  trSteps.forEach((step, i) => {
    const landed = bandAt(probe, step);
    const rated = at(probe.tr, String(trBefore + i + 1));
    const answered = probe.mc.find(([t, v]) => t >= paidAt! && Number(v) >= mcAfterPrice + 2 * (i + 1))?.[0];
    expect(landed, `the marker landed on ${step} (${dump})`).toBeDefined();
    expect(rated, `the rating ticked to ${trBefore + i + 1} (${dump})`).toBeDefined();
    expect(answered, `the Greens' +2 M€ #${i + 1} ticked (${dump})`).toBeDefined();
    expect(landed!, `${step} before its rating (${dump})`).toBeLessThanOrEqual(rated!);
    expect(answered!, `the Greens' answer #${i + 1} no earlier than the rating it answers (PL-002 / PL-151; mc ${JSON.stringify(probe.mc)}, tr ${JSON.stringify(probe.tr)})`).toBeGreaterThanOrEqual(rated!);
    const next = bandAt(probe, step + 1);
    if (next !== undefined) {
      expect(rated!, `the rating before the marker reached ${step + 1} — the next leg waits for the chip (${dump})`).toBeLessThan(next);
    }
  });
  expect(probe.chip.length, `the rating chips were seen in flight (${dump})`).toBeGreaterThan(0);
}

for (const preset of PRESETS) {
  test.describe(`TR42 Green Allegiance · a walk of counted length · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`TR 33 from ①: the plate «2», the composer's WHY, the inspector's «ДЛЯ ВАС», two steps, the Greens after the rating, the rival sees it (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
      const run = witness(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'green-allegiance', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      expect([me(before).agenda, me(before).influence, before.thisPlayer.terraformRating], 'the fixture: blue on step 1, influence 1, TR 33').toEqual([1, 1, 33]);

      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await openParliament(red);
      await armRedProbe(red, viewer);
      await page.bringToFront();

      // ── 0. THE HAND: the tile's quiet plate says HOW FAR before anything opens (К-H1) ──
      await focusInHand(page);
      const plate = page.locator(`${slot} [data-hand-walk]`);
      await expect(plate, 'the walk card wears its forecast plate').toHaveCount(1);
      await expect(plate).toHaveAttribute('data-hand-walk', '2');
      await expect(plate, 'a walk that moves is not muted').not.toHaveClass(/con-hand__walk--zero/);
      await expect(plate.locator('.resource_icon--agenda-step'), 'the plate wears the track\'s own unit').toHaveCount(1);
      await shoot(page, preset.id, '00-hand-33');

      // ── 0b. THE INSPECTOR (X): the rules, then «ДЛЯ ВАС» — the composer's own rows (decision 5 (в)) ──
      await openZoomViewer(page);
      const forYou = page.locator('.con-zoom-rules [data-rules-group="group:you"]');
      await expect(forYou, 'the inspector reads the walk for the viewer').toHaveCount(1);
      await expect(forYou).toContainText('Шаги Карьеры по РТ: РТ 33 · порог 20 · 2 полных набора · до следующего 2');
      await expect(forYou).toContainText('Карьера — маркер пройдёт 2 шага в Парламенте');
      await shoot(page, preset.id, '01-inspector-33');
      await closeZoomViewer(page);

      // ── 1. THE COMPOSER: the walk read before the press, WITH why ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the play\'s own verb — the walk is an outcome, not a door').toContainText('Разыграть карту');
      const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
      await expect(trackChip, 'ONE track chip').toHaveCount(1);
      await expect(trackChip.locator('.action-effect-chip__cur')).toHaveText('1');
      await expect(trackChip.locator('.action-effect-chip__res')).toHaveText('3');
      await expect(trackChip.locator('.action-effect-chip__note'), 'the chip says why it is this long').toHaveText('2 набора по 5 РТ сверх 20');
      await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--rating')}), 'the TR chip of step ②').toHaveCount(1);
      await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--influence')}), 'the influence the walk sets').toContainText('2');
      const why = page.locator(composer).getByText('Шаги Карьеры по РТ: РТ 33 · порог 20 · 2 полных набора · до следующего 2');
      const stage = page.locator(composer).getByText('Карьера — маркер пройдёт 2 шага в Парламенте');
      await expect(why, 'the WHY row, in the Parliament\'s own words').toHaveCount(1);
      await expect(stage, 'the coming stage, once').toHaveCount(1);
      const whyBox = await why.boundingBox();
      const stageBox = await stage.boundingBox();
      expect(whyBox !== null && stageBox !== null && whyBox.y < stageBox.y, 'why first, then how far').toBe(true);
      const forecast = page.locator(`${composer} [data-forecast-row]`);
      await expect(forecast, 'the «Сработает» row names the ruling Greens\' answer to the walked TR').toHaveCount(1);
      await expect(forecast.locator('[data-forecast-chip="own"] .resource_icon--megacredits')).toHaveCount(1);
      await expect(forecast.locator('[data-forecast-chip="own"]')).toContainText('2');
      await shoot(page, preset.id, '02-composer-33');

      await armProbe(page, viewer);
      const stopStory = await storyboard(page, preset.id, 'walk-33');
      await pressA(page, run);

      // ── 2. the walk inside the hand: ② TR → the rating → ③ influence 2 → the flow leaves ──
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      await waitFlowLeft(page);
      await stopStory();
      expect(run.posts.length, 'and nothing else was sent').toBe(1);
      await shoot(page, preset.id, '03-after-33');

      // ── 3. the server ──
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.thisPlayer.megacredits, 'the card cost 2 M€, the ruling Greens paid 2 for the walked TR').toBe(before.thisPlayer.megacredits - 2 + 2);
      expect(after.thisPlayer.terraformRating, 'the walked TR').toBe(34);
      expect(me(after).agenda, 'the marker walked to 3').toBe(3);
      expect(me(after).influence, 'the influence is 2').toBe(2);
      expect(after.game.parliament.lastAdvance, 'ONE record, the card\'s, with both steps').toMatchObject({from: 1, to: 3, reason: 'card', card: CARD, steps: [{to: 2, bonus: 'tr'}, {to: 3}]});

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, parlFirst: probe.parlFirst, cube: probe.cube, tr: probe.tr, mc: probe.mc, inf: probe.inf, band: probe.band, beat: probe.beat, chip: probe.chip.length, proxy: probe.proxy.length});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/green-allegiance-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expectOneWalk(probe, run, dump);
      expect(landings(probe.cube, 1), `the landings, in order (${dump})`).toEqual(['2', '3']);
      expectRatingsInOrder(probe, 33, before.thisPlayer.megacredits - 2, [2], dump);
      expect(at(probe.inf, '2'), `the influence ticked to 2 on ③ (${dump})`).toBeDefined();
      expect(at(probe.inf, '2')!, `…no earlier than the landing on ③ (${dump})`).toBeGreaterThanOrEqual(at(probe.cube, '3')!);

      // ── 4. red, without reloading, with the Parliament open: the walk played on their table; the notification opens the Parliament ──
      await red.bringToFront();
      await expect.poll(async () => {
        const series = (await readRedProbe(red)).cube;
        return series[series.length - 1]?.[1];
      }, {timeout: 30_000, message: 'red saw blue\'s cube reach 3'}).toBe('3');
      const redProbe = await readRedProbe(red);
      expect(redProbe.cube.map(([, s]) => s), `red's track walked blue's marker forward, step by step (${JSON.stringify(redProbe.cube)})`).toEqual(['1', '2', '3']);
      const told = redProbe.notes.find((n) => n.text.includes(CARD_RU));
      expect(told, `red was told of the play (${JSON.stringify(redProbe.notes)})`).toBeDefined();
      expect(told!.detail, 'the card opens the Parliament — the object it is about').toContain('Парламент');
      await shoot(red, preset.id, '04-red-table');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await red.close();
    });

    test(`TR 23 — the HONEST ZERO: the plate «0» muted, no track chip, ONE row naming the zero, no Parliament, the price paid (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(360_000);
      const run = witness(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'green-allegiance-zero', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      expect([me(before).agenda, before.thisPlayer.terraformRating], 'the fixture: blue on step 1, TR 23').toEqual([1, 23]);

      const red = await context.newPage();
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await armRedProbe(red, viewer);
      await page.bringToFront();

      await focusInHand(page);
      const plate = page.locator(`${slot} [data-hand-walk]`);
      await expect(plate, 'the zero is a plate too — «0», muted').toHaveAttribute('data-hand-walk', '0');
      await expect(plate).toHaveClass(/con-hand__walk--zero/);
      await shoot(page, preset.id, '10-hand-23');

      await openZoomViewer(page);
      const forYou = page.locator('.con-zoom-rules [data-rules-group="group:you"]');
      await expect(forYou).toContainText('Маркер Карьеры не двинется: РТ 23 · порог 20 · ни одного полного набора по 5 · до первого 2');
      await expect(forYou, 'no stage in the inspector either').not.toContainText('маркер пройдёт');
      await shoot(page, preset.id, '11-inspector-23');
      await closeZoomViewer(page);

      await openComposer(page);
      await expect(page.locator(`${composer} .action-effect-chip .resource_icon--agenda-step`), 'NO track chip — «★ 1 → 1» would promise a stage nobody enters (PL-118)').toHaveCount(0);
      await expect(page.locator(composer).getByText('Маркер Карьеры не двинется: РТ 23 · порог 20 · ни одного полного набора по 5 · до первого 2'), 'the zero is NAMED, with the distance to the first set').toHaveCount(1);
      await expect(page.locator(composer).getByText(/маркер пройдёт/), 'no stage is promised').toHaveCount(0);
      await expect(page.locator(composer), 'the play stays alive').toContainText('Разыграть карту');
      expect((await page.locator(`${composer} .con-paystatus`).textContent()) ?? '', 'the payment line states the price').toContain('2');
      await shoot(page, preset.id, '12-composer-23');

      await armProbe(page, viewer);
      const stopStory = await storyboard(page, preset.id, 'zero-23');
      await pressA(page, run);
      await waitFlowLeft(page);
      await stopStory();
      expect(run.posts.length).toBe(1);

      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, 'the 2 M€ are paid').toBe(before.thisPlayer.megacredits - 2);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(me(after).agenda, 'the marker stays').toBe(1);
      expect(after.game.parliament.lastAdvance, 'no walk record').toBeUndefined();

      const probe = await readProbe(page);
      fs.writeFileSync(`test-results/green-allegiance-zero-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.parlMax, `the Parliament never rose (${JSON.stringify(probe.steps)})`).toBe(0);
      expect(probe.wsMax, 'one workspace at most').toBeLessThanOrEqual(1);
      expect(probe.steps.includes('Карьера'), `the crumb never named the walk (${JSON.stringify(probe.steps)})`).toBe(false);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(run.overflow, 'no overflow').toEqual([]);
      expect(run.pageErrors, 'no page error').toEqual([]);

      await red.bringToFront();
      await expect.poll(async () => (await readRedProbe(red)).notes.some((n) => n.text.includes(CARD_RU)), {timeout: 30_000, message: 'red was told of the play'}).toBe(true);
      const told = (await readRedProbe(red)).notes.find((n) => n.text.includes(CARD_RU))!;
      expect(told.detail, `a play that moved nothing in the Parliament does not send red there (${JSON.stringify(told)})`).not.toContain('Парламент');
      await shoot(red, preset.id, '13-red-zero');
      await red.close();
    });

    for (const hurry of [false, true]) {
      test(`TR 45 from ⓪ — the longest walk: five legs, two ratings and two Greens' answers in order${hurry ? ', «ДОЖАТЬ» mid-walk (К-W1)' : ''} (${preset.id})`, async ({page, request}) => {
        test.setTimeout(480_000);
        const run = witness(page);
        const {playerId} = await bootFixtureSeats(page, request, 'green-allegiance-long', {query: preset.query});
        const before = await wireOf(request, playerId);
        const viewer = before.thisPlayer.color;
        const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
        expect([me(before).agenda, before.thisPlayer.terraformRating], 'the fixture: blue on step 0, TR 45').toEqual([0, 45]);

        await focusInHand(page);
        await expect(page.locator(`${slot} [data-hand-walk]`)).toHaveAttribute('data-hand-walk', '5');
        await openComposer(page);
        const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
        await expect(trackChip.locator('.action-effect-chip__cur')).toHaveText('0');
        await expect(trackChip.locator('.action-effect-chip__res')).toHaveText('5');
        await expect(trackChip.locator('.action-effect-chip__note')).toHaveText('5 наборов по 5 РТ сверх 20');
        await expect(page.locator(composer).getByText('Шаги Карьеры по РТ: РТ 45 · порог 20 · 5 полных наборов · до следующего 5')).toHaveCount(1);
        await expect(page.locator(composer).getByText('Карьера — маркер пройдёт 5 шагов в Парламенте'), 'the plural is right for five').toHaveCount(1);
        if (!hurry) {
          await shoot(page, preset.id, '20-composer-45');
        }

        await armProbe(page, viewer);
        const stopStory = await storyboard(page, preset.id, hurry ? 'long-45-hurry' : 'long-45');
        const pressedAt = Date.now();
        await pressA(page, run);
        await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
        if (hurry) {
          // «ДОЖАТЬ» once the first leg has landed: A in the walk pose — the waits ahead collapse, nothing is skipped.
          await expect.poll(async () => landings((await readProbe(page)).cube, 0).length, {timeout: 30_000}).toBeGreaterThanOrEqual(1);
          await press(page, 'Enter', 200);
        }
        await waitFlowLeft(page);
        await stopStory();
        const elapsed = Date.now() - pressedAt;
        expect(run.posts.length, 'nothing else was sent — «дожать» is never a submit').toBe(1);

        const after = await wireOf(request, playerId);
        expect(me(after).agenda, 'five steps').toBe(5);
        expect(me(after).influence, 'influence 3').toBe(3);
        expect(after.thisPlayer.terraformRating, 'two walked TR').toBe(47);
        expect(after.thisPlayer.megacredits, '−2 for the card, +2 × 2 from the Greens').toBe(before.thisPlayer.megacredits - 2 + 4);
        expect(after.game.parliament.lastAdvance?.steps).toEqual([{to: 1}, {to: 2, bonus: 'tr'}, {to: 3}, {to: 4, bonus: 'tr'}, {to: 5}]);

        const probe = await readProbe(page);
        const dump = JSON.stringify({steps: probe.steps, cube: probe.cube, tr: probe.tr, mc: probe.mc, inf: probe.inf, band: probe.band, beat: probe.beat, chip: probe.chip.length, proxy: probe.proxy.length, homeMs: probe.homeMs});
        fs.writeFileSync(`test-results/green-allegiance-long${hurry ? '-hurry' : ''}-${preset.id}.json`, JSON.stringify(probe, null, 1));
        // К-W1, measured on every run: from the press to the board home (the probe's clock), the walk's own span.
        const firstLanding = probe.cube.find(([, v]) => v !== '0')?.[0];
        const lastLanding = at(probe.cube, '5');
        console.log(`[K-W1 ${preset.id}${hurry ? ' hurry' : ''}] A → board ${probe.homeMs ?? elapsed} ms · first landing ${firstLanding} → fifth ${lastLanding} (${lastLanding !== undefined && firstLanding !== undefined ? lastLanding - firstLanding : '?'} ms)`);
        expectOneWalk(probe, run, dump, hurry);
        if (!hurry) {
          expect(landings(probe.cube, 0), `five landings, in order — none skipped (${dump})`).toEqual(['1', '2', '3', '4', '5']);
        }
        // The band grows one chip per landing — every step landed, in order, under «дожать» too (nothing skipped).
        expect(probe.band.map(([, v]) => v), `the band grew one chip per landing, in order (${dump})`).toEqual(['1', '1,2', '1,2,3', '1,2,3,4', '1,2,3,4,5']);
        expectRatingsInOrder(probe, 45, before.thisPlayer.megacredits - 2, [2, 4], dump);
        expect(probe.band[probe.band.length - 1]?.[1], `the band grew a chip per landed step (${dump})`).toBe('1,2,3,4,5');
        expect(probe.proxy.length, `the marker was seen gliding (${dump})`).toBeGreaterThan(5);
      });
    }
  });
}
