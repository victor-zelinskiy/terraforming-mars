import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, pressUntil, settle} from './consoleStart';
import {openParliament} from './parliamentDrive';

/**
 * TR37 «ЮРИСТЫ КРАСНЫХ» — TR04's walk WITHOUT the influence ceiling: the CARD
 * step in the MIDDLE of a walk, the card step LAST, the end of the track
 * (docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md §3 / §7 — the gap this card
 * closes). The walk itself is the ONE phrase TR04 pinned; what is new, end to
 * end against a real server on two profiles:
 *
 *   1. THE ENTRANCE is one phrase (PL-084, decision 6): past A the bar never
 *      reads the composer's verbs again; the Parliament stands in its WALK
 *      pose on its very first sample (never «overview, then dimmed»); the
 *      crumb's tail reads «КАРЬЕРА» no later than the track is in the DOM.
 *   2. THE CARD STEP IN THE MIDDLE (6 → ⑦ card → ⑧ influence 4): the cover
 *      lifts off node ⑦ once the marker has LANDED there — born AT the node;
 *      the card opens in the viewer; A takes it; the dock counts it on the
 *      TOUCHDOWN; and only THEN the marker leaves for ⑧ — the next leg waits
 *      for the reward to land (decision 4); the influence ticks 3 → 4 no
 *      earlier than the landing on ⑧. The server agrees: hand +1 (source
 *      `agenda`), marker on 8, influence 4, 5 M€ paid, one record with both
 *      steps. The rival, with the Parliament open, SEES the walk and is told.
 *   3. THE CARD STEP LAST (5 → ⑥ TR → ⑦ card): the rating chip lands on the
 *      rail from ⑥ before ⑦ is reached; the ruling Greens' +2 M€ ticks no
 *      earlier than the rating does (PL-002 — reproduced here); then the
 *      cover lifts off ⑦, the take, the touchdown, and the flow leaves.
 *   4. THE END (11 → ⑫): the composer names the cut («1 из 2 · конец трека»),
 *      one leg, one landing, no second lead; the server records one step.
 *
 * Fixtures `red-lawyers` / `red-lawyers-tr-first` / `red-lawyers-end`
 * (tests/e2e/fixtures/generate.ts): blue's action phase, 10 M€, two cubes on
 * the Reds' resolution, blue on 6 / 5 / 11, red on 3, the Greens ruling.
 */

const CARD = 'Red Lawyers';
const CARD_RU = 'Юристы Красных';
const ROOT_RU = 'Карты в руке';
const OUT = path.resolve('screenshots', 'red-lawyers');
/** PL-120: from the card's reveal on the stage to the Parliament's first sample — the composer's release (200 ms) and the
 *  section's entry (240 ms) at motion scale 1, a frame of slack for the 4K layout. Was ≈ 1000 ms before the commit entrance. */
const PL120_RISE_BUDGET_MS = 560;

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>, cardsInHandNbr: number};
  game: {
    gameAge: number;
    parliament: {
      players: Array<{color: string, agenda: number, influence: number}>;
      lastAdvance?: {seq: number, from: number, to: number, steps: Array<{to: number, bonus?: string}>, reason: string, card?: string};
    };
  };
  cardDrawReveals?: Array<{source?: {type: string}, cards: Array<{name: string}>}>;
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
type Point = {x: number, y: number};
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
  /** The Parliament's FIRST sample: its pose class and the crumb's tail at that very moment (the entrance's one phrase). */
  parlFirst: {walk: boolean, tail: string, ms: number} | undefined;
  /** The landed card REVEALED on the receiving stage (the real card under the proxy): the first sample, ms (PL-120). */
  landedMs: number | undefined;
  /** The command bar's text on every change (task samples). */
  bar: Series;
  cube: Series;
  cubeDrawn: Series;
  tr: Series;
  mc: Series;
  inf: Series;
  band: Series;
  beat: Series;
  /** The hand dock's total on every change. */
  hand: Series;
  /** The card-bonus COVER: first seen lifting (its centre), and node k's centre at that sample. */
  cover: Series;
  coverBirth: Point | undefined;
  nodeAtBirth: Point | undefined;
  nodeWidth: number;
  /** The fullscreen viewer / the reveal overlay on screen. */
  viewer: Series;
  chip: Array<[number, number, number]>;
  proxy: Array<[number, number, number]>;
  /** The marker proxy's LIFT off the rail (max |y − rail y|) and the marker's own height — the arc in the profile's scale. */
  lift: {max: number, cube: number};
  cubesOnEnd: Array<string>;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, viewer: string, cardStep: number, endStep: number): Promise<void> {
  await page.evaluate(({viewer, card, root, cardStep, endStep}) => {
    const w = window as unknown as {__tr37: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, wsMax: 0, ownHead: false,
      degraded: [], stranded: false, parlFirst: undefined, landedMs: undefined, bar: [], cube: [], cubeDrawn: [], tr: [], mc: [], inf: [], band: [], beat: [], hand: [],
      cover: [], coverBirth: undefined, nodeAtBirth: undefined, nodeWidth: 0, viewer: [], chip: [], proxy: [], lift: {max: 0, cube: 0}, cubesOnEnd: [],
    };
    w.__tr37 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: string | undefined) => {
      if (value !== undefined && value !== '' && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const centre = (el: Element | null): Point | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width < 1 ? undefined : {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};
    };
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
      if (p.landedMs === undefined && document.querySelector('.con-recv [data-recv-front][data-played-key]') !== null) {
        p.landedMs = Date.now() - t0;
      }
      const parls = document.querySelectorAll('.con-parl');
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
      if (!tick) {
        return; // the frame claims below are made on the task samples only (a microtask sees states never painted)
      }
      note(p.bar, text(document.querySelector('.con-cmdbar')));
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
        // The rail's y is the marker row's: the lift is how far above it the proxy rises mid-leg.
        const row = document.querySelector<HTMLElement>(`[data-agenda-markers="${endStep}"]`)?.getBoundingClientRect();
        if (row !== undefined) {
          p.lift.cube = Math.max(p.lift.cube, r.height);
          p.lift.max = Math.max(p.lift.max, (row.top + row.height / 2) - (r.top + r.height / 2));
        }
      }
      const cover = document.querySelector<HTMLElement>('.con-bonusfly-cover');
      if (cover !== null && visible(cover, 0.1)) {
        if (p.coverBirth === undefined) {
          p.coverBirth = centre(cover);
          const node = document.querySelector<HTMLElement>(`.con-parl__step[data-step="${cardStep}"] .con-parl__step-res`);
          p.nodeAtBirth = centre(node);
          p.nodeWidth = node?.getBoundingClientRect().width ?? 0;
        }
        note(p.cover, 'up');
      }
      note(p.viewer, document.querySelector('dialog.con-zoom[open]') !== null ? 'zoom' : (document.querySelector('.con-reveal') !== null ? 'reveal' : undefined));
      note(p.hand, document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? undefined);
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
      const onEnd = Array.from(document.querySelectorAll<HTMLElement>(`[data-agenda-markers="${endStep}"] [data-agenda-cube]`))
        .filter((el) => !el.classList.contains('con-parl__agenda-cube--hidden'))
        .map((el) => el.getAttribute('data-agenda-cube') ?? '?');
      if (onEnd.length > 0) {
        p.cubesOnEnd = onEnd;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {viewer, card: CARD_RU, root: ROOT_RU, cardStep, endStep});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr37: Probe}).__tr37);

type RedNote = {at: number, text: string, detail: string};
type RedProbe = {notes: Array<RedNote>, cube: Series, proxy: number};

/**
 * RED'S WITNESS: every notification card as it APPEARS, and WHERE blue's marker stands on red's own Parliament —
 * the real cube when it is drawn, else the gliding PROXY (a rival's walk hides the real cube under the proxy
 * for the whole walk: the proxy IS the marker the rival sees), by the marker row its centre is over.
 */
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

const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

/** The first ms `series` read `value`; undefined when it never did. */
const at = (series: Series, value: string): number | undefined => series.find(([, v]) => v === value)?.[0];
/**
 * The LANDINGS of a walk — the cube series without the marker's START step: since PL-120 the Parliament rises from the
 * landing's commit, so the probe may sample the real cube standing on `from` (the hold) before the first lead; a landing is
 * every position after it.
 */
const landings = (series: Series, from: number): Array<string> => series.map(([, v]) => v).filter((v, i) => !(i === 0 && v === String(from)));

/**
 * The dock's COUNT of the step's card: the first ms the total reads `before` again AFTER the played card left
 * it (the series starts at `before`, drops by one at the landing, and comes back on the touchdown).
 */
const handTickAt = (series: Series, before: number): number | undefined => {
  const dropped = series.findIndex(([, v]) => v === String(before - 1));
  return dropped === -1 ? undefined : series.slice(dropped + 1).find(([, v]) => v === String(before))?.[0];
};

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

/**
 * A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor actually produced, by CDP
 * screencast, named by its time — the acceptance's eyes on a flight a settled screenshot cannot show.
 */
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
  const sent = JSON.parse(run.posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
  const responses = Array.isArray(sent) ? sent : sent.responses ?? [sent as unknown as Record<string, unknown>];
  expect(responses.some((r) => JSON.stringify(r).includes(CARD)), 'the POST is the card\'s play').toBe(true);
}

/** The card step's viewer OPENS (the overlay mounts veiled first — the press waits for the card itself) → A takes the card → the dock counts it. */
async function takeTheCard(page: Page, preset: string, label: string): Promise<void> {
  await expect(page.locator('dialog.con-zoom[open]'), 'the step\'s card opens in the viewer after the cover\'s flight').toHaveCount(1, {timeout: 40_000});
  await shoot(page, preset, `${label}-viewer`);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('dialog.con-zoom[open], .con-reveal').count() === 0, {tries: 6, settleMs: 1500}), 'A takes the card').toBe(true);
}

async function waitFlowLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    hand: document.querySelectorAll('.con-hand').length,
    parl: document.querySelectorAll('.con-parl').length,
    ws: document.querySelectorAll('.con-ws').length,
  })), {timeout: 60_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
  await settle(page, {timeoutMs: 30_000});
}

/** The flow's invariants every table shares: one flow, one Parliament, the entrance's one phrase, nothing degraded. */
function expectOneFlow(probe: Probe, run: Run, dump: string): void {
  expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);
  expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
  expect(probe.steps[0], `the tail starts at the play (${dump})`).toBe('Розыгрыш');
  expect(probe.steps[probe.steps.length - 1], `…and ends at the walk (${dump})`).toBe('Карьера');
  expect(probe.steps.filter((s) => s !== 'Розыгрыш' && s !== 'Разыграно' && s !== 'Карьера'), `no stage but the three of the play (${dump})`).toEqual([]);
  expect(probe.parlOutsideHand, 'the Parliament stood inside the hand, never as a band of its own').toBe(false);
  expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
  expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
  expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);
  expect(probe.beat.map(([, b]) => b), `the walk's beats went forward (${dump})`).toEqual(['walk', 'read', 'done']);
  // THE ENTRANCE: the walk pose on the Parliament's FIRST sample, the crumb's tail «КАРЬЕРА» at that very moment.
  expect(probe.parlFirst, `the Parliament was seen (${dump})`).toBeDefined();
  expect(probe.parlFirst!.walk, `the Parliament stood in its WALK pose on its first sample — never «overview, then dimmed» (${dump})`).toBe(true);
  expect(probe.parlFirst!.tail, `the crumb read «Карьера» no later than the track was in the DOM (${dump})`).toBe('Карьера');
  // PL-120: the hosted step enters FROM THE COMMIT — the Parliament rises within one phrase of the card's docking
  // (the composer's release + the section's own entry), never after a reading pause over an empty zone.
  expect(probe.landedMs, `the landed card was revealed on the stage (${dump})`).toBeDefined();
  // The measured rise is printed on every run — the A/B of the entrance is read here, never guessed from frames.
  console.log(`[PL-120] landed ${probe.landedMs} → the Parliament's first sample ${probe.parlFirst!.ms} (rise ${probe.parlFirst!.ms - probe.landedMs!} ms, budget ${PL120_RISE_BUDGET_MS})`);
  expect(probe.parlFirst!.ms - probe.landedMs!, `the Parliament rose within the landing's own phrase of the dock (landed ${probe.landedMs}, risen ${probe.parlFirst!.ms})`).toBeLessThanOrEqual(PL120_RISE_BUDGET_MS);
  // PL-084: from the frame the Parliament rises (the composer fading under it, its frame past the commit) the bar
  // never reads the composer's verbs again — the step's own status, never «A РАЗЫГРАТЬ · B ОТМЕНА» over a frame
  // that accepts neither.
  const barAfter = probe.bar.filter(([ms]) => ms >= probe.parlFirst!.ms).map(([, v]) => v);
  expect(barAfter.filter((v) => /Разыграть карту|Отмена/.test(v)), `from the Parliament's rise the bar never read the composer's verbs (bar: ${JSON.stringify(probe.bar)}, rise at ${probe.parlFirst!.ms})`).toEqual([]);
  expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
  expect(probe.stranded, 'nothing was stranded').toBe(false);
  expect(run.overflow, 'no overflow').toEqual([]);
  expect(run.pageErrors, 'no page error').toEqual([]);
  expect(run.holdWarnings, 'no animation hold was force-released by its ceiling (a take in the player\'s hands is not a leaked hold)').toEqual([]);
}

/** The cover was BORN at node k (a pixel-perfect separation, never a new object elsewhere). */
function expectCoverBornAtNode(probe: Probe, dump: string): void {
  expect(probe.coverBirth, `the cover was seen lifting (${dump})`).toBeDefined();
  expect(probe.nodeAtBirth, `node k was measurable when the cover was born (${dump})`).toBeDefined();
  const dx = Math.abs(probe.coverBirth!.x - probe.nodeAtBirth!.x);
  const dy = Math.abs(probe.coverBirth!.y - probe.nodeAtBirth!.y);
  const slack = Math.max(24, probe.nodeWidth * 2.5);
  expect(dx, `the cover rose off node k, not elsewhere (dx=${dx} dy=${dy} node=${probe.nodeWidth}, ${dump})`).toBeLessThanOrEqual(slack);
  expect(dy, `…vertically too (dx=${dx} dy=${dy}, ${dump})`).toBeLessThanOrEqual(slack * 2);
}

for (const preset of PRESETS) {
  test.describe(`TR37 Red Lawyers · the card step of a walk · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`6 → ⑦ CARD → ⑧: the cover lifts off ⑦ on the landing, the take lands in the dock, only then ⑧ — the rival sees the walk (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
      const run = witness(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'red-lawyers', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      const rival = (wire: Wire) => wire.game.parliament.players.find((p) => p.color !== viewer)!;
      expect([me(before).agenda, me(before).influence], 'the fixture: blue on step 6, influence 3').toEqual([6, 3]);
      expect(rival(before).agenda, 'the fixture: red on step 3').toBe(3);
      const handBefore = before.thisPlayer.cardsInHandNbr;

      // ── RED watches with the Parliament OPEN — the rival's table, where the walk plays by the tier's own watcher.
      const red = await context.newPage();
      const redErrors: Array<string> = [];
      red.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(red, seats[1], preset.query);
      await settle(red, {timeoutMs: 30_000});
      await openParliament(red);
      await armRedProbe(red, viewer);
      await page.bringToFront();

      // ── 1. the composer: the walk read before the press ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the play\'s own verb — the walk is an outcome, not a door').toContainText('Разыграть карту');
      await expect(page.locator(`${composer} .action-effect-chip .resource_icon--agenda-step`), 'the track chip wears the track\'s own unit').toHaveCount(1);
      const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
      await expect(trackChip, 'the track chip reads the walk «6 → 8»').toContainText('6');
      await expect(trackChip).toContainText('8');
      await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--cards')}), 'the card chip is its own chip').toHaveCount(1);
      const influenceChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--influence')});
      await expect(influenceChip, 'the influence chip reads the level the walk sets').toContainText('4');
      await expect(page.locator(`${composer} .action-effect-chip .resource_icon--rating`), 'no TR step on this walk — no TR chip').toHaveCount(0);
      const stageLine = page.locator(composer).getByText('Карьера — маркер пройдёт 2 шага в Парламенте');
      await expect(stageLine, 'the coming stage is named ONCE, from the server\'s reading').toHaveCount(1);
      expect(await textOf(page, `${composer} .con-paystatus`), 'the payment line states the price').toContain('5');
      await shoot(page, preset.id, '01-composer-6');

      await armProbe(page, viewer, 7, 8);
      const stopStory = await storyboard(page, preset.id, 'walk-6');
      await pressA(page, run);

      // ── 2. the walk inside the hand: ⑦'s cover → the viewer → A → the dock → ⑧ → the flow leaves ──
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      await takeTheCard(page, preset.id, '02-step7');
      await waitFlowLeft(page);
      await stopStory();
      await expect(page.locator(composer), 'the composer never comes back past the commit').toHaveCount(0);
      expect(run.posts.length, 'and nothing else was sent').toBe(1);
      await shoot(page, preset.id, '03-after-6');

      // ── 3. the server ──
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.thisPlayer.megacredits, 'the card cost 5 M€ — no TR step, nothing from the Greens').toBe(before.thisPlayer.megacredits - 5);
      expect(me(after).agenda, 'the marker walked to 8').toBe(8);
      expect(me(after).influence, 'the influence is 4').toBe(4);
      expect(after.thisPlayer.cardsInHandNbr, 'the played card left, the step\'s card came').toBe(handBefore);
      expect(after.game.parliament.lastAdvance, 'ONE record, the card\'s, with both steps').toMatchObject({from: 6, to: 8, reason: 'card', card: CARD, steps: [{to: 7, bonus: 'card'}, {to: 8}]});

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, parlFirst: probe.parlFirst, cube: probe.cube, cubeDrawn: probe.cubeDrawn, inf: probe.inf, band: probe.band, beat: probe.beat,
        hand: probe.hand, cover: probe.cover, coverBirth: probe.coverBirth, nodeAtBirth: probe.nodeAtBirth, viewer: probe.viewer, lift: probe.lift, proxy: probe.proxy.length, cubesOnEnd: probe.cubesOnEnd});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/red-lawyers-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expectOneFlow(probe, run, dump);

      // ── 4. THE ORDER: ⑦ → the cover off ⑦ → the viewer → the dock counts the card → ⑧ → the influence 4 ──
      expect(landings(probe.cube, 6), `the landings, in order (${dump})`).toEqual(['7', '8']);
      expect(probe.inf[0]?.[1], `the influence still read 3 when the Parliament rose (${dump})`).toBe('3');
      const on7 = at(probe.cube, '7');
      const on8 = at(probe.cube, '8');
      const coverUp = at(probe.cover, 'up');
      const viewerOpen = probe.viewer[0]?.[0];
      const handTick = handTickAt(probe.hand, handBefore);
      const influenced = at(probe.inf, '4');
      const bandSeven = probe.band.find(([, v]) => v.split(',').includes('7'))?.[0];
      expect(on7, `the cube landed on ⑦ (${dump})`).toBeDefined();
      expect(coverUp, `the cover lifted (${dump})`).toBeDefined();
      expect(viewerOpen, `the card opened (${dump})`).toBeDefined();
      expect(handTick, `the dock counted the card (${dump})`).toBeDefined();
      expect(on8, `the cube landed on ⑧ (${dump})`).toBeDefined();
      expect(influenced, `the influence ticked to 4 (${dump})`).toBeDefined();
      expect(on7!, `⑦ before the cover lifted — the signal is the marker's lock (${dump})`).toBeLessThanOrEqual(coverUp!);
      expect(coverUp!, `the cover before the viewer (${dump})`).toBeLessThanOrEqual(viewerOpen!);
      expect(viewerOpen!, `the viewer before the dock counted the card (${dump})`).toBeLessThan(handTick!);
      expect(handTick!, `the card LANDED in the dock before the marker left for ⑧ — the next leg waits for the reward (${dump})`).toBeLessThan(on8!);
      expect(on8!, `⑧ before (or with) the influence tick (${dump})`).toBeLessThanOrEqual(influenced!);
      expect(bandSeven, `the band's ⑦ chip appeared (${dump})`).toBeDefined();
      expect(bandSeven!, `…before the marker reached ⑧ (${dump})`).toBeLessThan(on8!);
      // PL-119: a landing GROWS the line by one chip — the unchanged line is never re-crossfaded, so no sample ever
      // holds two chips of one step (the old per-step crossfade read «7» → «7,7,8» → «7,8»).
      const doubled = probe.band.filter(([, v]) => {
        const steps = v.split(',').filter((s) => s !== '');
        return new Set(steps).size !== steps.length;
      });
      expect(doubled, `the band never holds two chips of one step (PL-119) (${dump})`).toEqual([]);
      expectCoverBornAtNode(probe, dump);
      expect(probe.chip.length, `no rating chip on this walk (${dump})`).toBe(0);
      expect(probe.proxy.length, `the marker's proxy was seen in flight (${dump})`).toBeGreaterThan(2);
      expect(probe.cubesOnEnd, `blue's cube alone stood on ⑧ at the end (${dump})`).toEqual([viewer]);
      // THE LIFT is in the profile's scale: the arc off the rail is a fraction of the cube on 1080 and on 4K alike.
      expect(probe.lift.cube, `the proxy's height was measured (${dump})`).toBeGreaterThan(0);
      expect(probe.lift.max / probe.lift.cube, `the arc off the rail reads against the cube (${JSON.stringify(probe.lift)})`).toBeGreaterThan(0.3);

      // ── 5. red, without reloading, with the Parliament open: the walk played on their table; the notification opens the Parliament ──
      await red.bringToFront();
      await expect.poll(async () => (await readRedProbe(red)).cube[(await readRedProbe(red)).cube.length - 1]?.[1], {timeout: 30_000, message: 'red saw blue\'s cube reach 8'}).toBe('8');
      const redProbe = await readRedProbe(red);
      expect(redProbe.cube.map(([, s]) => s), `red's track walked blue's marker forward, step by step — the proxy over ⑦ before ⑧ (${JSON.stringify(redProbe.cube)}, proxy samples ${redProbe.proxy})`).toEqual(['6', '7', '8']);
      expect(redProbe.proxy, 'the marker was seen gliding on red\'s table').toBeGreaterThan(2);
      const told = redProbe.notes.find((n) => n.text.includes(CARD_RU));
      expect(told, `red was told of the play (${JSON.stringify(redProbe.notes)})`).toBeDefined();
      expect(told!.detail, 'the card opens the Parliament — the object it is about').toContain('Парламент');
      fs.writeFileSync(`test-results/red-lawyers-red-${preset.id}.json`, JSON.stringify(redProbe, null, 1));
      await shoot(red, preset.id, '04-red-table');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await red.close();
    });

    test(`5 → ⑥ TR → ⑦ CARD: the rating lands from ⑥ before ⑦, the Greens answer after it, then the card step LAST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const run = witness(page);
      const {playerId} = await bootFixtureSeats(page, request, 'red-lawyers-tr-first', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      expect([me(before).agenda, me(before).influence], 'the fixture: blue on step 5, influence 3').toEqual([5, 3]);
      const trBefore = before.thisPlayer.terraformRating;
      const handBefore = before.thisPlayer.cardsInHandNbr;

      await openComposer(page);
      const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
      await expect(trackChip, 'the track chip reads the walk «5 → 7»').toContainText('5');
      await expect(trackChip).toContainText('7');
      await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--rating')}), 'the TR chip is its own chip').toHaveCount(1);
      await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--cards')}), 'the card chip').toHaveCount(1);
      await expect(page.locator(composer).getByText('Карьера — маркер пройдёт 2 шага в Парламенте')).toHaveCount(1);
      await shoot(page, preset.id, '01-composer-5');

      await armProbe(page, viewer, 7, 7);
      const stopStory = await storyboard(page, preset.id, 'walk-5');
      await pressA(page, run);
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      await takeTheCard(page, preset.id, '02-step7-last');
      await waitFlowLeft(page);
      await stopStory();
      expect(run.posts.length, 'nothing else was sent').toBe(1);

      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, 'the card cost 5 M€, and the ruling Greens paid 2 M€ for the TR').toBe(before.thisPlayer.megacredits - 5 + 2);
      expect(after.thisPlayer.terraformRating, 'the rating rose by the walked step').toBe(trBefore + 1);
      expect(me(after).agenda).toBe(7);
      expect(after.thisPlayer.cardsInHandNbr).toBe(handBefore);
      expect(after.game.parliament.lastAdvance).toMatchObject({from: 5, to: 7, reason: 'card', card: CARD, steps: [{to: 6, bonus: 'tr'}, {to: 7, bonus: 'card'}]});

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, parlFirst: probe.parlFirst, cube: probe.cube, tr: probe.tr, mc: probe.mc, band: probe.band, beat: probe.beat,
        hand: probe.hand, cover: probe.cover, viewer: probe.viewer, chip: probe.chip.length, proxy: probe.proxy.length});
      fs.writeFileSync(`test-results/red-lawyers-tr-first-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expectOneFlow(probe, run, dump);

      // ── THE ORDER: ⑥ → the rating chip lands (+1) → the Greens' +2 M€ no earlier → ⑦ → the cover → the viewer → the dock ──
      expect(landings(probe.cube, 5), `the landings, in order (${dump})`).toEqual(['6', '7']);
      expect(probe.tr[0]?.[1], `the rail still said the old rating (${dump})`).toBe(String(trBefore));
      const on6 = at(probe.cube, '6');
      const on7 = at(probe.cube, '7');
      const rated = at(probe.tr, String(trBefore + 1));
      const coverUp = at(probe.cover, 'up');
      const handTick = handTickAt(probe.hand, handBefore);
      expect(on6, `⑥ (${dump})`).toBeDefined();
      expect(rated, `the rating ticked (${dump})`).toBeDefined();
      expect(on7, `⑦ (${dump})`).toBeDefined();
      expect(coverUp, `the cover lifted off ⑦ (${dump})`).toBeDefined();
      expect(handTick, `the dock counted the card (${dump})`).toBeDefined();
      expect(on6!, `⑥ before the rating (${dump})`).toBeLessThanOrEqual(rated!);
      expect(rated!, `the rating before ⑦ — the next segment waits for the chip (${dump})`).toBeLessThan(on7!);
      expect(on7!, `⑦ before the cover (${dump})`).toBeLessThanOrEqual(coverUp!);
      expect(coverUp!, `the cover before the dock counted the card (${dump})`).toBeLessThan(handTick!);
      expect(probe.chip.length, `the rating chip was seen in flight (${dump})`).toBeGreaterThan(0);
      expectCoverBornAtNode(probe, dump);
      // PL-002: the Greens' +2 M€ is the ANSWER to the rating — it may not tick before the rating has touched the rail.
      const mcAnswered = at(probe.mc, String(before.thisPlayer.megacredits - 5 + 2));
      expect(mcAnswered, `the Greens' +2 M€ ticked (${dump})`).toBeDefined();
      expect(mcAnswered!, `…no earlier than the rating it answers (PL-002; mc: ${JSON.stringify(probe.mc)}, tr: ${JSON.stringify(probe.tr)})`).toBeGreaterThanOrEqual(rated!);
    });

    test(`11 → ⑫: the composer names the cut, one leg, one landing, no second lead (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const run = witness(page);
      const {playerId} = await bootFixtureSeats(page, request, 'red-lawyers-end', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      expect([me(before).agenda, me(before).influence], 'the fixture: blue on step 11, influence 4').toEqual([11, 4]);

      await openComposer(page);
      const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
      await expect(trackChip, 'the track chip reads the walk «11 → 12»').toContainText('11');
      await expect(trackChip).toContainText('12');
      await expect(page.locator(composer).getByText('Карьера — маркер пройдёт 1 шаг в Парламенте'), 'one step reads in its own words').toHaveCount(1);
      await expect(page.locator(composer).getByText('1 из 2 · конец трека'), 'the cut is NAMED before the press').toHaveCount(1);
      await shoot(page, preset.id, '01-composer-11');

      await armProbe(page, viewer, 12, 12);
      await pressA(page, run);
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      await waitFlowLeft(page);
      expect(run.posts.length).toBe(1);

      const after = await wireOf(request, playerId);
      expect(me(after).agenda, 'the marker stands at the end').toBe(12);
      expect(me(after).influence, 'the influence is 5').toBe(5);
      expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits - 5);
      expect(after.game.parliament.lastAdvance, 'ONE step recorded — the end cut the second').toMatchObject({from: 11, to: 12, reason: 'card', card: CARD, steps: [{to: 12}]});

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, parlFirst: probe.parlFirst, cube: probe.cube, inf: probe.inf, band: probe.band, beat: probe.beat, proxy: probe.proxy.length});
      fs.writeFileSync(`test-results/red-lawyers-end-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expectOneFlow(probe, run, dump);
      expect(landings(probe.cube, 11), `one landing, on ⑫ (${dump})`).toEqual(['12']);
      expect(probe.band[probe.band.length - 1]?.[1], `the band grew exactly one chip (${dump})`).toBe('12');
      expect(probe.proxy.length, `the marker's proxy was seen in flight (${dump})`).toBeGreaterThan(2);
      expect(at(probe.inf, '5'), `the influence ticked to 5 on the landing (${dump})`).toBeDefined();
      expect(probe.cover, `no cover on this walk (${dump})`).toEqual([]);
      expect(probe.viewer, `no card opened (${dump})`).toEqual([]);
    });
  });
}
