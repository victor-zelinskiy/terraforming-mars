import * as fs from 'fs';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';

/**
 * TR07 «СПОНСОРЫ КОЛОНИЙ» — THE STAGED COLONY, the staged play's fourth target
 * (docs/TURMOIL_REDUX_COLONY_SPONSORS.md).
 *
 * A card that moves a chosen colony tile's marker to its top by being PLAYED.
 * The contract under test, end to end against a real server, on two profiles:
 *
 *   1. «Выбрать колонию» sends NOTHING: the landing ritual plays, the colony
 *      grid rises INSIDE the hand workspace, and the server has not heard a
 *      word (its change counter stands, the card is in hand).
 *   2. It is ONE flow: on every sample the crumb keeps its root and the card's
 *      name; the tail only ever moves forward (РОЗЫГРЫШ → РАЗЫГРАНО → ВЫБОР
 *      КОЛОНИИ → ЛУНА · ТРЕК); the colonies are the ONE instance teleported into
 *      the hand — never a second band, never a fleet toolbar inside the zone.
 *   3. The grid shows the projection on EVERY candidate (Luna: the ghost on the
 *      7th cell, «+4»), the tile at its top and the inactive tile stand with
 *      their reasons, and walking the grid moves no box. B walks back to the
 *      composer with the same payment, nothing sent.
 *   4. A on Luna descends to its stage: the marker on the 3rd cell, the target
 *      on the 7th, «+4», «торговля здесь» — still nothing sent.
 *   5. A «Разыграть карту» is the play's ONE POST, its tail ADDRESSED to the
 *      card (`stagedFor`).
 *   6. The move: the marker stands on the 3rd cell until the move starts (the
 *      hold); the crossed cells light up in order 4, 5, 6, 7; the readout reads
 *      «7/7» only AFTER the landing. The source cell and the destination were
 *      on screen and the marker proxy travelled between them.
 *   7. The server agrees: Luna's track is 6, the card is on the table, 5 M€ paid.
 *   8. The flow ENDS ON THE BOARD: no workspace, nothing stranded, no overflow,
 *      no page error, and the move never confessed a missing track. ONE surface
 *      leaves: the stage stays the colonies' face through the hand's dissolve —
 *      the grid never comes back under it, the stage never lets go first.
 *
 * Fixture `colony-sponsors` (tests/e2e/fixtures/generate.ts): blue's action
 * phase, 10 M€, blue's colony on Luna with the marker on cell 3; Ceres at its
 * top; Titan inactive; Europa (red's cube) and Io further candidates.
 */

const CARD = 'Colony Sponsors';
const CARD_RU = 'Спонсоры колоний';
const ROOT_RU = 'Карты в руке';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>};
  game: {gameAge: number, colonies: Array<{name: string, trackPosition: number}>};
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

const lunaTrack = (wire: Wire) => wire.game.colonies.find((c) => c.name === 'Luna')?.trackPosition;

type Box = {x: number, y: number, w: number, h: number};
type Probe = {
  samples: number;
  ticks: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  coloniesOutsideHand: boolean;
  coloniesMax: number;
  wsMax: number;
  toolbarInZone: boolean;
  degraded: Array<string>;
  stranded: boolean;
  /** Once the track stage stood: the grid came back from under it, or the stage let go while the colonies still stood. */
  leaveMisses: Array<string>;
  /** The stage's Luna cells as they lit up: [ms, cell] the first time a cell > 2 read `--passed`. */
  passed: Array<[number, number]>;
  /** The stage's marker cell, on every change: [ms, cell]. */
  marker: Array<[number, number]>;
  /** The stage's readout text, on every change: [ms, text]. */
  readout: Array<[number, string]>;
  /** The track-move proxy: its first and last seen centre, the sample count. */
  proxy: {first?: Box, last?: Box, n: number, firstAt: number, lastAt: number};
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({card, root}) => {
    const w = window as unknown as {__tr07: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], coloniesOutsideHand: false, coloniesMax: 0, wsMax: 0, toolbarInZone: false,
      degraded: [], stranded: false, leaveMisses: [], passed: [], marker: [], readout: [], proxy: {n: 0, firstAt: 0, lastAt: 0},
    };
    w.__tr07 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    let stageSeen = false;
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
      const colonies = document.querySelectorAll('.con-colonies');
      p.coloniesMax = Math.max(p.coloniesMax, colonies.length);
      colonies.forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.coloniesOutsideHand = true;
        }
        if (el.querySelector('.con-colonies__toolbar') !== null) {
          p.toolbarInZone = true;
        }
      });
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      const stage = document.querySelector('.con-colfocus[data-colony-intent="track"]');
      if (stage !== null) {
        stageSeen = true;
      }
      if (stageSeen && colonies.length > 0 && p.leaveMisses.length < 6) {
        const browse = document.querySelector('.con-colonies__browse');
        if (browse !== null && !browse.classList.contains('con-colonies__browse--parked')) {
          const hand = document.querySelector<HTMLElement>('.con-hand');
          // What it was looking at: the stage still standing, and the hand (a `fixed` hand is its dissolve).
          p.leaveMisses.push(`${Date.now() - t0}ms the grid un-parked under the stage · stage=${document.querySelector('.con-colfocus')?.getAttribute('data-colony-intent') ?? 'none'} hand=${hand === null ? 'none' : `${hand.style.position || 'in-flow'}·opacity ${getComputedStyle(hand).opacity}`} ws=${document.querySelectorAll('.con-ws').length}`);
        }
        if (stage === null) {
          p.leaveMisses.push(`${Date.now() - t0}ms the stage let go while the colonies still stood`);
        }
      }
      if (stage !== null) {
        const degraded = stage.getAttribute('data-colony-track-degraded');
        if (degraded !== null && !p.degraded.includes(degraded)) {
          p.degraded.push(degraded);
        }
        const cells = Array.from(stage.querySelectorAll('.con-colfocus__xcell'));
        cells.forEach((cell, i) => {
          if (i > 2 && cell.classList.contains('con-colfocus__xcell--passed') && !p.passed.some(([, c]) => c === i)) {
            p.passed.push([Date.now() - t0, i]);
          }
        });
        const marker = cells.findIndex((cell) => cell.classList.contains('con-colfocus__xcell--marker'));
        if (marker !== -1 && p.marker[p.marker.length - 1]?.[1] !== marker) {
          p.marker.push([Date.now() - t0, marker]);
        }
        const readout = text(stage.querySelector('[data-colony-track-readout]'));
        if (readout !== '' && p.readout[p.readout.length - 1]?.[1] !== readout) {
          p.readout.push([Date.now() - t0, readout]);
        }
      }
      document.querySelectorAll<HTMLElement>('.con-coltrade-marker').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || Number(getComputedStyle(el).opacity) < 0.2) {
          return;
        }
        const now = {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
        if (p.proxy.first === undefined) {
          p.proxy.first = now;
          p.proxy.firstAt = Date.now() - t0;
        }
        p.proxy.last = now;
        p.proxy.lastAt = Date.now() - t0;
        p.proxy.n++;
      });
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr07: Probe}).__tr07);

/** An element's centre box and whether the player can actually SEE it (a rect, an effective opacity, not hidden). */
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

/** A box, SETTLED: three equal reads 100 ms apart (timers, never rAF). */
const boxOf = (page: Page, selector: string) => page.evaluate(async (sel) => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  const read = () => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r === undefined ? '' : [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  };
  let last = read();
  let equal = 0;
  for (let i = 0; i < 60 && equal < 2; i++) {
    await pause();
    const now = read();
    equal = now === last && now !== '' ? equal + 1 : 0;
    last = now;
  }
  return last === '' ? undefined : last.split(',').map(Number);
}, selector);

const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

const composer = '.con-composer--play';
const grid = '.con-hand .con-colonies[data-colony-mode="pick"]';
const stage = '.con-hand .con-colfocus[data-colony-intent="track"]';
const tile = (name: string) => `${grid} [data-test="con-colony-${name}"]`;
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__slot--focused [data-test^="con-colony-"]')?.getAttribute('data-test')?.replace('con-colony-', '') ?? '');

/** «ВЫБРАТЬ КОЛОНИЮ» — one press, verified by the composer's OWN state; never a blind retry. */
async function chooseColony(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) !== null, grid);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await page.locator(grid).waitFor({timeout: 30_000});
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** Walk the grid cursor to `name` — each press verified by the cursor itself. */
async function walkTo(page: Page, name: string): Promise<void> {
  for (let step = 0; step < 12 && await focusedTile(page) !== name; step++) {
    const before = await focusedTile(page);
    await press(page, step < 6 ? 'ArrowRight' : 'ArrowLeft', 200);
    await expect.poll(() => focusedTile(page), {timeout: 2_500}).not.toBe(before).catch(() => undefined);
  }
  expect(await focusedTile(page), `the cursor reached ${name}`).toBe(name);
}

for (const preset of PRESETS) {
  test.describe(`TR07 Colony Sponsors · the staged colony · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать колонию» → the grid inside the hand → B → back → Luna's stage → A → the marker walks → the board (${preset.id})`, async ({page, request}) => {
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

      const playerId = await bootFixture(page, request, 'colony-sponsors', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(lunaTrack(before), 'the fixture: Luna\'s marker stands on cell 3').toBe(2);

      // ── the composer: the door's verb and its step row ──
      await press(page, 'Period', 600); // RT → the quick wheel
      await press(page, 'Enter', 1600); // centre slot → the hand
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
      expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать колонию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Трек колонии — выбор в «Колониях»');
      const paymentBefore = await textOf(page, `${composer} .con-paystatus`);
      expect(paymentBefore, 'the payment line states the price').toContain('5');

      await armProbe(page);

      // ── 1. «Выбрать колонию»: nothing is sent ──
      await chooseColony(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 3. the grid: the projection on every candidate, the reasons on the refused tiles ──
      await expect(page.locator(`${tile('Luna')} [data-colony-track-cell="Luna#6"]`), 'Luna: the ghost marker on the 7th cell')
        .toHaveClass(/con-coltile__track-cell--effective/);
      await expect(page.locator(`${tile('Luna')} .con-coltile__cell-offset`), 'Luna: «+4»').toHaveText('+4');
      await expect(page.locator(`${tile('Luna')} [data-colony-track-cell="Luna#2"]`), 'Luna: the marker on the 3rd cell')
        .toHaveClass(/con-coltile__track-cell--marker/);
      await expect(page.locator(`${tile('Europa')} [data-colony-track-cell="Europa#6"]`), 'a rival\'s tile is a candidate too')
        .toHaveClass(/con-coltile__track-cell--effective/);
      await expect(page.locator(`${tile('Ceres')} .con-coltile__status`), 'the tile at its top states why').toContainText('Маркер уже на максимуме');
      await expect(page.locator(`${tile('Titan')} .con-coltile__status`), 'the inactive tile states why').toContainText('Эта колония ещё не активна');
      expect(await focusedTile(page), 'the cursor stands on the first candidate (A only descends)').toBe('Luna');
      const gridBox = await boxOf(page, `${grid} .con-colonies__grid`);
      await walkTo(page, 'Europa');
      expect(await boxOf(page, `${grid} .con-colonies__grid`), 'the grid\'s box did not move under the walk').toEqual(gridBox);
      await expect(page.locator(`${grid} .con-colonies__rail`), 'the rail reads the focused tile\'s move').toContainText('Торговля здесь');
      expect(posts, 'walking the grid sends nothing').toEqual([]);

      // ── 3b. B walks back to the composer — the same payment, nothing sent ──
      const backTaken = () => page.evaluate((sel) =>
        document.querySelector(sel) !== null || document.querySelector('.con-colonies') === null, composer);
      for (let attempt = 0; attempt < 3 && !await backTaken(); attempt++) {
        await press(page, 'Escape', 300);
        await expect.poll(backTaken, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator(composer), 'B restores the composer').toHaveCount(1, {timeout: 15_000});
      await expect(page.locator('.con-colonies'), 'the step left').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await expect(page.locator(composer)).toContainText('Выбрать колонию');
      await expect.poll(() => textOf(page, `${composer} .con-paystatus`), {timeout: 10_000, message: 'the payment survived the round trip'}).toBe(paymentBefore);
      expect(posts).toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the round trip left no trace').toBe(before.game.gameAge);

      // ── 4. in again; A on Luna descends to its stage ──
      await chooseColony(page);
      await walkTo(page, 'Luna');
      for (let attempt = 0; attempt < 3 && await page.locator(stage).count() === 0; attempt++) {
        await press(page, 'Enter', 400);
        await page.locator(stage).waitFor({timeout: 4_000}).catch(() => undefined);
      }
      await page.locator(stage).waitFor({timeout: 15_000});
      await settle(page, {timeoutMs: 20_000});
      const cell = (i: number) => `${stage} .con-colfocus__xcell:nth-child(${i + 1})`;
      await expect(page.locator(cell(2)), 'the stage: the marker on the 3rd cell').toHaveClass(/con-colfocus__xcell--marker/);
      await expect(page.locator(cell(6)), 'the stage: the target on the 7th').toHaveClass(/con-colfocus__xcell--effective/);
      await expect(page.locator(`${stage} [data-colony-track-offset]`), 'the stage names the move').toContainText('+4');
      await expect(page.locator(`${stage} [data-colony-track-reading]`), 'the reading: «торговля здесь»').toContainText('Торговля здесь');
      await expect(page.locator(`${stage} [data-colony-track-readout]`), 'the readout: «3/7 → 7/7»').toContainText('3/7');
      expect(posts, 'the descent sends nothing').toEqual([]);
      const source = await seen(page, `${stage} [data-colony-track-cell="Luna#2"]`);
      const destination = await seen(page, `${stage} [data-colony-track-cell="Luna#6"]`);
      expect(source?.visible, 'the move\'s source cell is on screen').toBe(true);
      expect(destination?.visible, 'the move\'s destination cell is on screen').toBe(true);

      // ── 5. A «Разыграть карту» — ONE POST, addressed to the card ──
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail is the tile, ADDRESSED to the card')
        .toMatchObject({type: 'colony', colonyName: 'Luna', stagedFor: CARD});

      // ── 7. the server ──
      await expect.poll(async () => lunaTrack(await wireOf(request, playerId)), {timeout: 30_000, message: 'Luna\'s marker is at its top on the server'}).toBe(6);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.thisPlayer.megacredits, 'the card cost 5 M€').toBe(before.thisPlayer.megacredits - 5);

      // ── 8. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        colonies: document.querySelectorAll('.con-colonies').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, colonies: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator(composer), 'the composer never comes back past the commit').toHaveCount(0);
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, passed: probe.passed, marker: probe.marker, readout: probe.readout, proxy: probe.proxy});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/colony-sponsors-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── 2. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps[0], `the tail starts at the composer (${dump})`).toBe('Розыгрыш');
      expect(probe.steps, `the tail moves through the colony selection (${dump})`).toContain('Выбор колонии');
      expect(probe.steps[probe.steps.length - 1], `…and ends on the tile's stage (${dump})`).toBe('Луна · Трек');
      expect(probe.coloniesOutsideHand, 'the colonies stood inside the hand, never as a band of their own').toBe(false);
      expect(probe.coloniesMax, 'ONE colonies instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.toolbarInZone, 'no fleet toolbar stole the grid\'s height inside the zone').toBe(false);

      // ── 6. the move: after A, cell by cell, the readout after the landing ──
      const markers = probe.marker.map(([, c]) => c);
      expect(markers.indexOf(2), `the marker stood on cell 3 (${dump})`).toBeGreaterThanOrEqual(0);
      expect(markers[markers.length - 1], `…and landed on cell 7 (${dump})`).toBe(6);
      expect(markers.lastIndexOf(2) < markers.lastIndexOf(6), `the marker never went back (${dump})`).toBe(true);
      const crossed = probe.passed.map(([, c]) => c);
      expect(crossed, `the crossed cells lit up in order 4, 5, 6, 7 (${dump})`).toEqual([3, 4, 5, 6]);
      const landedAt = probe.marker.find(([, c]) => c === 6)?.[0] ?? Infinity;
      expect(probe.passed[0][0], `the first cell lit up only after the commit's answer (${dump})`).toBeGreaterThan(0);
      // The readout FLIPS on the landing: `ConsoleFlipValue` holds both faces for its turn («3/7» going, «7/7»
      // coming), and the projection («→ 7/7 · +4») is gone the moment the marker stands on the top.
      const landedReadout = probe.readout.findIndex(([, t]) => t.endsWith('7/7') && !t.includes('→'));
      expect(landedReadout, `the readout read «7/7» (${dump})`).toBeGreaterThan(0);
      expect(probe.readout[landedReadout][0], `…only AFTER the landing (${dump})`).toBeGreaterThanOrEqual(landedAt);
      expect(probe.readout.slice(0, landedReadout).every(([, t]) => t.startsWith('3/7→7/7')),
        `before that the readout read «3/7 → 7/7» (${dump})`).toBe(true);
      // Law 17: the source was visible, the destination was visible, and the marker travelled between them.
      expect(probe.proxy.n, `the marker proxy was seen moving (${dump})`).toBeGreaterThanOrEqual(2);
      const slack = preset.viewport.width / 40;
      expect(dist(probe.proxy.first!, source!) <= slack + source!.w, `the proxy left the 3rd cell (${dump})`).toBe(true);
      expect(dist(probe.proxy.last!, destination!) <= slack + destination!.w, `…and arrived on the 7th (${dump})`).toBe(true);

      expect(probe.degraded, 'the move never confessed a missing track').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(probe.leaveMisses, 'ONE surface leaves: the stage stays the colonies\' face to the end, the grid never comes back under it').toEqual([]);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}
