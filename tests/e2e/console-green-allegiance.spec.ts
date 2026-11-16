import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openConsole, openZoomViewer, press, pressUntil, settle} from './consoleStart';
import {openParliament} from './parliamentDrive';
import {readSettled} from './settledRead';
import {armWitness, pageNow, witnessOf} from './witness';

/**
 * TR42 «ВЕРНОСТЬ ЗЕЛЁНЫМ» — the walk of TR04 / TR37 with its length COUNTED
 * from the player's rating («1 step per complete set of 5 TR over 20»). The
 * walk is the ONE phrase TR04 pinned; what is new end to end, on two profiles,
 * against a real server:
 *
 *   1. THE FORECAST BEFORE THE PRESS, with WHY: the hand tile's quiet plate
 *      «[★] 2» (К-H1), the composer's track chip «1 → 3 · 2 набора по 5 РТ
 *      сверх 20», the WHY as a reading of the result (PL-156, M1) «ПОЧЕМУ
 *      2 ШАГА · [РТ] 33 сверх 20 → 2 полных набора по 5 → [★] 2 · до
 *      следующего ещё 2 РТ» above the stage row («ДАЛЕЕ» — the stage only), the TR and
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

/**
 * THE TABLE'S ANSWER CARRIED ON A STEP (67cbb017ee, 2026-10-28 — `AgendaAdvanceStep.answer`): under the ruling Greens a
 * walked TR step carries their 2 M€, measured by the server around the step's own payment. Honest server truth — the
 * walk's record asserts it, never drops it.
 */
const GREENS_ANSWER = {answer: {stock: {megacredits: 2}}};
const CARD = 'Green Allegiance';
const CARD_RU = 'Верность Зелёным';
const ROOT_RU = 'Карты в руке';
const OUT = path.resolve('screenshots', 'green-allegiance');

const PRESETS = [
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
  /** The DISTINCT moments the recording kept (a change each — never a count of frames). */
  samples: number;
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
  /** The marker proxy's distinct POSES in flight: [ms, x, y]. */
  proxy: Array<[number, number, number]>;
  /** The board home stands again (no hand, no Parliament, no band) — the flow's end on the probe's clock (the page's). */
  homeMs: number | undefined;
};

/**
 * THE WALK, RECORDED (FLAKE ZERO — `armWitness`, armed before the press, replace-proof): the reader returns what stands
 * NOW — the crumb, the Parliament's pose, the marker, the rail's counts — and every change is kept with the page's time;
 * `readProbe` folds the record into the series the claims read. Every claim here is about what a FRAME shows and in
 * which ORDER (the walk pose on the first sample, one Parliament, each landing before its rating before the Greens'
 * answer), so the record is `settled`: the state a task LEAVES (its reactive flush included), never a state between two
 * writes of one task that no frame paints — the old sampler's «frame claims on the timer ticks only».
 */
type Tr42Seen = {
  head: {root: string, subjects: Array<string>, steps: Array<string>} | null;
  hand: boolean;
  /** The unveiled Parliaments (a WARMED one — PL-127, mounted invisible ahead of its frame — is not on screen). */
  parls: Array<{walk: boolean, outside: boolean, ownHead: boolean, degraded: string | null}>;
  ws: number;
  stranded: boolean;
  bar: string;
  cube: Array<number>;
  /** The marker proxy in flight: its centre. */
  proxy: {x: number, y: number} | null;
  tr: string;
  mc: string;
  inf: string;
  band: string;
  beat: string;
  /** Rating chips in flight: their centres. */
  chips: Array<{x: number, y: number}>;
};
const TR42_WITNESS = 'tr42-walk';
/** The probe's ZERO on the page's clock (the samples' `t` is the page's `Date.now()`). */
const probeZero = new WeakMap<Page, number>();

async function armProbe(page: Page, viewer: string): Promise<void> {
  probeZero.set(page, await pageNow(page));
  await armWitness<Tr42Seen, string>(page, TR42_WITNESS, (viewer) => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
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
    const hand = document.querySelector('.con-hand');
    const headEl = hand?.querySelector('.con-wshead') ?? null;
    const head = headEl === null ? null : {
      root: text(headEl.querySelector('.con-wshead__root')),
      subjects: Array.from(headEl.querySelectorAll('.con-wshead__subject')).map(text),
      steps: Array.from(headEl.querySelectorAll('.con-wshead__step')).map(text),
    };
    const parls = Array.from(document.querySelectorAll<HTMLElement>('.con-parl:not(.con-parl--warm)')).map((el) => ({
      walk: el.classList.contains('con-parl--walk'),
      outside: el.closest('.con-hand') === null || el.classList.contains('con-ws'),
      ownHead: el.querySelector('.con-wshead') !== null,
      degraded: el.getAttribute('data-parl-grant-degraded') ?? el.getAttribute('data-renewal-degraded'),
    }));
    const cube: Array<number> = [];
    for (let step = 0; step <= 12; step++) {
      const el = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${viewer}"]`);
      if (el !== null && !el.classList.contains('con-parl__agenda-cube--hidden') && visible(el)) {
        cube.push(step);
      }
    }
    const proxyEl = document.querySelector<HTMLElement>('.con-parl__flight--agenda');
    let proxy: Tr42Seen['proxy'] = null;
    if (proxyEl !== null && visible(proxyEl)) {
      const r = proxyEl.getBoundingClientRect();
      proxy = {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};
    }
    const chips: Tr42Seen['chips'] = [];
    document.querySelectorAll<HTMLElement>('.con-transfer__chip').forEach((el) => {
      if (el.style.transform === '' || el.querySelector('.resource_icon--rating') === null) {
        return;
      }
      const r = el.getBoundingClientRect();
      chips.push({x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)});
    });
    return {
      head,
      hand: hand !== null,
      parls,
      ws: document.querySelectorAll('.con-ws').length,
      stranded: document.querySelector('.con-stranded') !== null,
      bar: text(document.querySelector('.con-cmdbar')),
      cube,
      proxy,
      tr: text(document.querySelector('.con-res .con-score__value--tr')),
      // The digits ONLY — a delta chip inside the row («7−3») is the move's story, not the count.
      mc: (text(document.querySelector('.con-res__row--megacredits .con-res__digits')).match(/^-?\d+/) ?? [''])[0],
      inf: text(document.querySelector('.con-parl [data-parl-influence]')),
      band: Array.from(document.querySelectorAll('[data-parl-band-chip="agenda"]')).map((el) => el.getAttribute('data-parl-band-step') ?? '?').join(','),
      beat: document.querySelector('.con-parl')?.getAttribute('data-walk-beat') ?? '',
      chips,
    };
  }, {args: viewer, settled: true, max: 20_000});
}

/** The record folded into the probe's series, on the probe's clock (ms since the arm). */
async function readProbe(page: Page): Promise<Probe> {
  const zero = probeZero.get(page) ?? 0;
  const samples = await witnessOf<Tr42Seen>(page, TR42_WITNESS).samples();
  const p: Probe = {
    samples: samples.length, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, wsMax: 0, ownHead: false,
    degraded: [], stranded: false, parlFirst: undefined, bar: [], cube: [], tr: [], mc: [], inf: [], band: [], beat: [],
    chip: [], proxy: [], homeMs: undefined,
  };
  const note = (series: Series, ms: number, value: string) => {
    if (value !== '' && series[series.length - 1]?.[1] !== value) {
      series.push([ms, value]);
    }
  };
  let seenHand = false;
  for (const {t, v} of samples) {
    const ms = t - zero;
    seenHand = seenHand || v.hand;
    let tail = '';
    if (v.head !== null) {
      if (v.head.root.toLowerCase() !== ROOT_RU.toLowerCase() || !v.head.subjects.some((s) => s.toLowerCase() === CARD_RU.toLowerCase())) {
        if (p.crumbMisses.length < 8) {
          p.crumbMisses.push(`${ms}ms root=«${v.head.root}» subject=«${v.head.subjects.join('|')}»`);
        }
      }
      for (const step of v.head.steps) {
        if (step !== '' && !p.steps.includes(step)) {
          p.steps.push(step);
        }
      }
      tail = v.head.steps[v.head.steps.length - 1] ?? '';
    }
    p.parlMax = Math.max(p.parlMax, v.parls.length);
    if (v.parls.length > 0 && p.parlFirst === undefined) {
      p.parlFirst = {walk: v.parls[0].walk, tail, ms};
    }
    for (const parl of v.parls) {
      p.parlOutsideHand ||= parl.outside;
      p.ownHead ||= parl.ownHead;
      if (parl.degraded !== null && !p.degraded.includes(parl.degraded)) {
        p.degraded.push(parl.degraded);
      }
    }
    p.wsMax = Math.max(p.wsMax, v.ws);
    p.stranded ||= v.stranded;
    if (p.homeMs === undefined && seenHand && !v.hand && v.parls.length === 0 && v.ws === 0) {
      p.homeMs = ms;
    }
    note(p.bar, ms, v.bar);
    v.cube.forEach((step) => note(p.cube, ms, String(step)));
    if (v.proxy !== null) {
      const last = p.proxy[p.proxy.length - 1];
      if (last === undefined || last[1] !== v.proxy.x || last[2] !== v.proxy.y) {
        p.proxy.push([ms, v.proxy.x, v.proxy.y]);
      }
    }
    note(p.tr, ms, v.tr);
    note(p.mc, ms, v.mc);
    note(p.inf, ms, v.inf);
    note(p.band, ms, v.band);
    note(p.beat, ms, v.beat);
    for (const chip of v.chips) {
      p.chip.push([ms, chip.x, chip.y]);
    }
  }
  return p;
}

type RedNote = {at: number, text: string, detail: string};
/** `proxy`: the distinct moments the marker stood on red's table as the gliding PROXY (never a count of frames). */
type RedProbe = {notes: Array<RedNote>, cube: Series, proxy: number};
type RedSeen = {notes: Array<{id: string, text: string, detail: string}>, position: string | null, proxy: boolean};
const RED_WITNESS = 'tr42-red';

/**
 * RED'S WITNESS, RECORDED (`armWitness`, settled — the claim is the ORDER of the marker's positions): every notification
 * card on screen, and where blue's marker stands on red's own Parliament. `readRedProbe` keeps each card's first
 * appearance.
 */
async function armRedProbe(page: Page, blue: string): Promise<void> {
  await armWitness<RedSeen, string>(page, RED_WITNESS, (blue) => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const notes = Array.from(document.querySelectorAll<HTMLElement>('.con-notif')).map((el) => ({
      id: el.getAttribute('data-notif-id') ?? text(el), text: text(el), detail: text(el.querySelector('.con-notif__action--detail')),
    }));
    let position: string | null = null;
    let proxy = false;
    for (let step = 0; step <= 12 && position === null; step++) {
      const cube = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${blue}"]`);
      if (cube !== null && !cube.classList.contains('con-parl__agenda-cube--hidden') && cube.getBoundingClientRect().width > 1) {
        position = String(step);
      }
    }
    if (position === null) {
      const r = document.querySelector<HTMLElement>('.con-parl__flight--agenda')?.getBoundingClientRect();
      if (r !== undefined && r.width > 1) {
        proxy = true;
        const cx = r.left + r.width / 2;
        for (let step = 0; step <= 12 && position === null; step++) {
          const row = document.querySelector<HTMLElement>(`[data-agenda-markers="${step}"]`)?.getBoundingClientRect();
          if (row !== undefined && cx >= row.left && cx <= row.right) {
            position = String(step);
          }
        }
      }
    }
    return {notes, position, proxy};
  }, {args: blue, settled: true, max: 20_000});
}

async function readRedProbe(page: Page): Promise<RedProbe> {
  const samples = await witnessOf<RedSeen>(page, RED_WITNESS).samples();
  const first = samples[0]?.t ?? 0;
  const p: RedProbe = {notes: [], cube: [], proxy: 0};
  const seen = new Set<string>();
  for (const {t, v} of samples) {
    for (const n of v.notes) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        p.notes.push({at: t - first, text: n.text, detail: n.detail});
      }
    }
    if (v.proxy) {
      p.proxy++;
    }
    if (v.position !== null && p.cube[p.cube.length - 1]?.[1] !== v.position) {
      p.cube.push([t - first, v.position]);
    }
  }
  return p;
}

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
  // The recording's own liveness: it keeps only CHANGES, so its count says how much changed, never how long it ran —
  // only a dead recorder has none (the real claims below judge themselves).
  expect(probe.samples, `the probe's recording ran (${probe.samples} samples)`).toBeGreaterThan(0);
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
      await expect(plate, 'a walk that moves is not muted').not.toHaveClass(/con-hand__plate--zero/);
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
      // PL-156 (M1): the WHY is a reading of the RESULT, under its chips — never a «ДАЛЕЕ» row.
      const why = page.locator(`${composer} [data-walk-why]`);
      const stage = page.locator(composer).getByText('Карьера — маркер пройдёт 2 шага в Парламенте');
      await expect(why, 'the WHY reading stands in the result').toHaveCount(1);
      await expect(why).toHaveAttribute('data-walk-why-sets', '2');
      await expect(why).toContainText('Расчёт');
      await expect(why).toContainText('33');
      await expect(why).toContainText('сверх 20');
      await expect(why).toContainText('2 полных набора по 5');
      await expect(why).toContainText('до следующего ещё 2 РТ');
      await expect(page.locator(`${composer} .con-composer__next`).filter({hasText: 'Шаги Карьеры'}), '«ДАЛЕЕ» carries the stage only').toHaveCount(0);
      await expect(stage, 'the coming stage, once').toHaveCount(1);
      // The two rows' tops read AT REST (one settled read of both — a comparison is only as settled as its least settled side).
      const tops = await readSettled(page, async () => {
        const whyBox = await why.boundingBox();
        const stageBox = await stage.boundingBox();
        return {why: whyBox === null ? null : Math.round(whyBox.y), stage: stageBox === null ? null : Math.round(stageBox.y)};
      }, {message: 'the WHY reading and the stage row'});
      expect(tops.why !== null && tops.stage !== null && tops.why < tops.stage, 'why first, then how far').toBe(true);
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
      await expect(plate).toHaveClass(/con-hand__plate--zero/);
      await shoot(page, preset.id, '10-hand-23');

      await openZoomViewer(page);
      const forYou = page.locator('.con-zoom-rules [data-rules-group="group:you"]');
      await expect(forYou).toContainText('Маркер Карьеры не двинется: РТ 23 · порог 20 · ни одного полного набора по 5 · до первого 2');
      await expect(forYou, 'no stage in the inspector either').not.toContainText('маркер пройдёт');
      await shoot(page, preset.id, '11-inspector-23');
      await closeZoomViewer(page);

      await openComposer(page);
      await expect(page.locator(`${composer} .action-effect-chip .resource_icon--agenda-step`), 'NO track chip — «★ 1 → 1» would promise a stage nobody enters (PL-118)').toHaveCount(0);
      const zeroWhy = page.locator(`${composer} [data-walk-why]`);
      await expect(zeroWhy, 'the zero is NAMED in the result, with the distance to the first set (PL-156)').toHaveAttribute('data-walk-why-sets', '0');
      await expect(zeroWhy).toContainText('маркер стоит');
      await expect(zeroWhy).toContainText('Расчёт');
      await expect(zeroWhy).toContainText('ни одного полного набора по 5');
      await expect(zeroWhy).toContainText('до первого ещё 2 РТ');
      await expect(page.locator(`${composer} .con-composer__next`), 'nothing «next» for a zero — no stage, no cut').toHaveCount(0);
      await expect(page.locator(composer).getByText(/маркер пройдёт/), 'no stage is promised').toHaveCount(0);
      await expect(page.locator(composer), 'the play stays alive').toContainText('Разыграть карту');
      expect((await page.locator(`${composer} .con-pay`).textContent()) ?? '', 'the payment line states the price').toContain('2');
      await shoot(page, preset.id, '12-composer-23');
      // PL-157: a walk of ZERO steps hosts nothing — no Parliament is warmed under this composer (PL-127's mount is armed
      // a settle after the composer declares a hosted step; by the screenshot that settle is long over).
      await expect(page.locator('.con-parl'), 'nothing warmed for a walk of zero steps').toHaveCount(0);

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
        const why45 = page.locator(`${composer} [data-walk-why]`);
        await expect(why45).toContainText('Расчёт');
        await expect(why45).toContainText('5 полных наборов по 5');
        await expect(why45).toContainText('до следующего ещё 5 РТ');
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
        expect(after.game.parliament.lastAdvance?.steps).toEqual([{to: 1}, {to: 2, bonus: 'tr', ...GREENS_ANSWER}, {to: 3}, {to: 4, bonus: 'tr', ...GREENS_ANSWER}, {to: 5}]);

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
        // «Seen gliding» is EVER (a recorded pose of the proxy in the air), never a count of the frames that caught it.
        expect(probe.proxy.length, `the marker was seen gliding (${dump})`).toBeGreaterThan(0);
      });
    }

    /* THE FIELD WALK (2026-10-25): TR 45 from ⑤ — ⑥ TR · ⑦ CARD · ⑧ · ⑨ TR · ⑩ CARD — played as the turn's LAST action,
     * so the turn is red's the moment the play lands and blue has no prompt for the whole walk. Two card steps in one
     * walk: the park was read over «any card step not lifted», so ⑩'s entry held ⑦'s batch parked while ⑦'s cover was
     * lifting — no «Взять» was ever offered and the Parliament froze inside the hand. Since «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»
     * (7a3762e3c7, 2026-10-26) the whole walk runs inside ONE play POST, so the two step draws are ONE batch with two
     * segments (agenda ⑦ · agenda ⑩) — ONE scene, both cards taken together; the walk finishes, and the board comes back
     * with both cards in the hand and no hold force-released. */
    test(`TR 45 from ⑤ as the LAST action — two card steps, ONE intake scene for both, the walk finishes while the turn is red's (${preset.id})`, async ({page, request}) => {
      test.setTimeout(480_000);
      const run = witness(page);
      const {playerId} = await bootFixtureSeats(page, request, 'green-allegiance-field', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      expect([me(before).agenda, before.thisPlayer.terraformRating], 'the fixture: blue on step 5, TR 45').toEqual([5, 45]);

      await focusInHand(page);
      await openComposer(page);
      await pressA(page, run);
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      const mid = await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: unknown};
      expect(mid.waitingFor, 'the play was the last action of the turn — blue has no prompt during the walk').toBeUndefined();

      // ONE action — ONE intake: both step cards (⑦ and ⑩) stand in ONE draw stage of the Parliament («ПРИЁМКА»), ready to be taken.
      await expect(page.locator('.con-parl [data-parl-draw] .con-reveal--embedded:not(.con-reveal--bonus-held):not(.con-reveal--bonus-veiled) [data-zoom-slot]'),
        'both card steps (⑦ and ⑩) stand in ONE draw stage, ready to be taken').toHaveCount(2, {timeout: 45_000});
      await shoot(page, preset.id, '30-field-take');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('dialog.con-zoom[open], .con-reveal').count() === 0, {tries: 6, settleMs: 1500}),
        'A takes both cards').toBe(true);
      await waitFlowLeft(page);

      const after = await wireOf(request, playerId);
      expect(me(after).agenda, 'five steps: ⑤ → ⑩').toBe(10);
      expect(after.thisPlayer.terraformRating, 'two walked TR').toBe(47);
      expect(after.thisPlayer.cardsInHandNbr, 'the played card left, the two step cards arrived').toBe(before.thisPlayer.cardsInHandNbr - 1 + 2);
      expect(after.game.parliament.lastAdvance?.steps).toEqual([{to: 6, bonus: 'tr', ...GREENS_ANSWER}, {to: 7, bonus: 'card'}, {to: 8}, {to: 9, bonus: 'tr', ...GREENS_ANSWER}, {to: 10, bonus: 'card'}]);
      expect(run.posts.length, 'the play was ONE POST — the takes acknowledge, they submit no input').toBe(1);
      expect(run.holdWarnings, 'no animation hold was force-released by its ceiling').toEqual([]);
      expect(run.pageErrors).toEqual([]);
      await shoot(page, preset.id, '31-field-home');
    });
  });
}
