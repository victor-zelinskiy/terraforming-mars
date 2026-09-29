import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, openMandatoryAnnounce, press} from './consoleStart';
import {answerGateAs, mandatoryPlate, parliamentWire, sittingStage, waitSittingAtRest} from './parliamentDrive';

/**
 * TR02 POLITICAL SCIENCE — a CARD ANSWERS A LEAVE of the renewal (docs/TURMOIL_REDUX_POLITICAL_SCIENCE.md).
 *
 * The fixture `political-science-assembly`: blue holds «Политология» (0 data); TWO of blue's delegates stand on the
 * Greens' loser; red wins Architecture Award from the middle slot. ONE A plays the whole walk. The tact's probe is the
 * renewal spec's law — the source was visible, the destination was visible, movement happened — read on the OBJECTS of
 * this card's own event:
 *
 *  1. ВОЗВРАТ   both of blue's cubes flew off the loser and LANDED in blue's reserve (visible);
 *  2. ЖЕТОН     AFTER the last landing a data token «+2» was born over blue's reserve plaque, ROSE (its centre moved
 *               up, monotonic) and dissolved — never before a landing, never anywhere else;
 *  3. ЛЕНТА     a line of the band named the card («Политология») and the count («Данные 2») while the token stood;
 *  4. ЧЕСТНОСТЬ `data-renewal-degraded` never appeared (no hold folded without its flight);
 *  5. СЕРВЕР    the card holds 2 data; the journal carries `card-effect` count 2 right after the Greens' leave;
 *  6. ТАБЛО     the tableau's card reads «2» on the wire — the very number the premium capsule paints.
 *
 * `MutationObserver` + `setInterval`, never rAF; `waitForTimeout` = 0. Screenshots under screenshots/political-science/.
 */
const OUT = path.resolve('screenshots', 'political-science');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type Rect = {x: number, y: number, w: number, h: number};
type Vis = {box: boolean, ink: number, free: boolean};
type Proxy = {id: string, body: string, color: string, amount: string, text: string, x: number, y: number, w: number, h: number, shown: boolean};
type Sample = {
  src: 'mo' | 'tick', t: number, stage: string, motion: string, degraded: string,
  proxies: Array<Proxy>,
  reserves: Record<string, {rect: Rect | undefined, count: number, vis: Vis}>,
  slots: Array<{instance: string, rect: Rect | undefined}>,
  band: {kicker: string, text: string, lines: number},
};
type Probe = {samples: Array<Sample>};

type Journal = Array<
  | {kind: 'leave', instance: string, resolution: string, party: string, slot: number, returned: Array<{owner: string, count: number}>}
  | {kind: 'card-effect', player: string, card: string, resource: string, count: number, instance: string}
  | {kind: string}>;

/** THE PROBE — armed BEFORE the press. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__polsci: Probe};
    w.__polsci = {samples: []};
    const rect = (el: Element | null | undefined): Rect | undefined => {
      if (el === null || el === undefined) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const vis = (el: Element | null | undefined): Vis => {
      const r = rect(el);
      if (el === null || el === undefined || r === undefined) {
        return {box: false, ink: 0, free: false};
      }
      let ink = 1;
      let node: Element | null = el;
      while (node !== null && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          ink = 0;
          break;
        }
        ink *= Number(cs.opacity === '' ? 1 : cs.opacity);
        node = node.parentElement;
      }
      const hit = document.elementFromPoint(r.x + r.w / 2, r.y + r.h / 2);
      const free = hit !== null && (hit === el || el.contains(hit) || hit.contains(el) || hit.closest('[data-parl-flight]') !== null);
      return {box: r.w > 1 && r.h > 1, ink, free};
    };
    const sample = (src: 'mo' | 'tick') => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      if (root === null) {
        return;
      }
      const proxies: Array<Proxy> = Array.from(document.querySelectorAll<HTMLElement>('[data-parl-flight]')).map((el) => {
        const r = el.getBoundingClientRect();
        const cube = el.querySelector<HTMLElement>('.player-cube');
        const color = cube === null ? '' : (Array.from(cube.classList).find((c) => c.startsWith('player-cube--') || c.startsWith('cube-')) ?? cube.className.toString().slice(0, 40));
        const cs = getComputedStyle(el);
        return {
          id: el.getAttribute('data-parl-flight') ?? '', body: el.getAttribute('data-parl-flight-body') ?? 'cube', color,
          amount: el.getAttribute('data-parl-token-amount') ?? '', text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
          shown: cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.02,
        };
      });
      const reserves: Sample['reserves'] = {};
      for (const stack of Array.from(root.querySelectorAll<HTMLElement>('[data-parl-seat-reserve]'))) {
        const color = stack.getAttribute('data-parl-seat-reserve') ?? '';
        reserves[color] = {rect: rect(stack), count: Number(stack.getAttribute('data-count') ?? '0'), vis: vis(stack)};
      }
      const slots = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slots > .con-parl__slot-home')).map((home) => ({
        instance: home.getAttribute('data-home') ?? '',
        rect: rect(home.querySelector('.con-parl__card .pcard') ?? home.querySelector('.con-parl__card') ?? home.querySelector('.con-parl__slot-empty-card')),
      }));
      const bandLines = Array.from(root.querySelectorAll<HTMLElement>('.con-band__line'));
      w.__polsci.samples.push({
        src, t: performance.now(),
        stage: root.getAttribute('data-sitting-stage') ?? '',
        motion: root.getAttribute('data-sitting-motion') ?? '',
        degraded: root.getAttribute('data-renewal-degraded') ?? '',
        proxies, reserves, slots,
        band: {
          kicker: bandLines.map((l) => l.querySelector('.con-band__kicker')?.textContent?.trim() ?? '').join('|'),
          text: bandLines.map((l) => (l.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' || '),
          lines: Math.max(0, ...bandLines.map((l) => Math.round(l.getBoundingClientRect().height / Math.max(1, parseFloat(getComputedStyle(l).lineHeight) || 1)))),
        },
      });
      if (w.__polsci.samples.length > 9000) {
        w.__polsci.samples.splice(0, 1500);
      }
    };
    new MutationObserver(() => sample('mo')).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-motion', 'data-sitting-stage', 'data-count', 'data-parl-token-amount']});
    window.setInterval(() => sample('tick'), 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__polsci: Probe}).__polsci);

const center = (r: Rect): {x: number, y: number} => ({x: r.x + r.w / 2, y: r.y + r.h / 2});
const dist = (a: {x: number, y: number}, b: {x: number, y: number}): number => Math.hypot(a.x - b.x, a.y - b.y);
const visible = (v: Vis): boolean => v.box && v.ink > 0.9;

/** Every sample of one proxy id, in order, shown frames only. */
function track(samples: ReadonlyArray<Sample>, id: string, clock: 'tick' | 'any' = 'tick'): Array<{s: Sample, p: Proxy}> {
  const out: Array<{s: Sample, p: Proxy}> = [];
  for (const s of samples) {
    if (clock === 'tick' && s.src !== 'tick') {
      continue;
    }
    const p = s.proxies.find((x) => x.id === id);
    if (p !== undefined && p.shown) {
      out.push({s, p});
    }
  }
  return out;
}

function ids(samples: ReadonlyArray<Sample>, body: string): Array<string> {
  const out: Array<string> = [];
  for (const s of samples) {
    for (const p of s.proxies) {
      if (p.body === body && !out.includes(p.id)) {
        out.push(p.id);
      }
    }
  }
  return out;
}

test.describe('TR02 Political Science · the renewal\'s card-effect (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('blue\'s two delegates fly home off the Greens\' loser; the data token «+2» rises over blue\'s reserve after the last landing; the band names the card; the server holds 2 data', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'political-science-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    const before = await parliamentWire(request, playerId);
    expect(before.game.parliament?.phase?.step).toBe('assembly');
    const viewer = before.thisPlayer.color;
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    await armProbe(page);
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(page.locator('.con-parl')).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page);
    await shoot(page, '00-verdict');

    // ONE A (the other seat answered first): the whole walk plays by itself.
    await answerGateAs(request, seats[1], 'assembly');
    await press(page, 'Enter', 400);
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('renewal');
    for (let frame = 1; frame <= 6; frame++) {
      await shoot(page, `01-tact-${frame}`);
      await cinematicBeat(page, 420, 'the next frame of the film strip of the tact');
    }
    await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '02-results');

    // ── 5. СЕРВЕР: the card holds 2 data; the journal carries the answer right after the Greens' leave.
    const wire = await parliamentWire(request, playerId) as unknown as {
      game: {parliament?: {phase?: {summary?: {renewal?: Journal}}}},
      thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>},
    };
    const journal = wire.game.parliament?.phase?.summary?.renewal ?? [];
    const effectAt = journal.findIndex((e) => e.kind === 'card-effect');
    expect(effectAt, `the server journalled the card's answer (${journal.map((e) => e.kind).join(' ')})`).toBeGreaterThan(0);
    const effect = journal[effectAt] as Extract<Journal[number], {kind: 'card-effect'}>;
    expect(effect).toMatchObject({player: viewer, card: 'Political Science', resource: 'Data', count: 2});
    const leave = journal[effectAt - 1] as Extract<Journal[number], {kind: 'leave'}>;
    expect(leave.kind, 'right after its own leave').toBe('leave');
    expect(leave.instance).toBe(effect.instance);
    expect(leave.returned.find((r) => r.owner === viewer)?.count, 'blue\'s two delegates went home off that card').toBe(2);
    // ── 6. ТАБЛО: the tableau's card reads 2 — the number the premium capsule paints.
    const card = wire.thisPlayer.tableau.find((c) => c.name === 'Political Science');
    expect(card?.resources, 'the card in the tableau holds the 2 data').toBe(2);

    const probe = await readProbe(page);
    const all = probe.samples;
    const renewalStart = all.findIndex((s) => s.stage === 'renewal');
    expect(renewalStart, 'the renewal page was sampled').toBeGreaterThan(0);
    const tact = all.slice(renewalStart).filter((s) => s.motion === 'renewal');
    expect(tact.length, 'the tact was sampled').toBeGreaterThan(30);

    // ── 4. ЧЕСТНОСТЬ: no hold folded without its flight.
    expect(all.filter((s) => s.degraded !== '').map((s) => s.degraded).slice(0, 3), 'no renewal event settled without a flight').toEqual([]);

    // ── 1. ВОЗВРАТ: both cubes off the loser, into blue's reserve (visible at the landing).
    const beforeLift = all.slice(0, renewalStart).filter((s) => s.src === 'tick' && s.stage !== '');
    const lastBefore = beforeLift[beforeLift.length - 1];
    const home = lastBefore.slots.find((sl) => sl.instance === leave.instance);
    expect(home?.rect, 'the loser stood in its slot before the tact').toBeDefined();
    const cubes = ids(tact, 'cube').filter((id) => {
      const tr = track(tact, id);
      return tr.length > 0 && tr[0].p.color.includes(viewer) && home?.rect !== undefined && dist(tr[0].p, center(home.rect)) < home.rect.h * 0.9;
    });
    expect(cubes.length, `both of ${viewer}'s cubes flew off the loser`).toBe(2);
    let lastLanding = 0;
    for (const id of cubes) {
      const tr = track(tact, id);
      const last = tr[tr.length - 1];
      const reserve = last.s.reserves[viewer];
      expect(reserve?.rect !== undefined && visible(reserve.vis), 'the reserve was visible at the landing').toBe(true);
      expect(dist(last.p, center(reserve!.rect!)), 'the cube landed in blue\'s reserve').toBeLessThan(reserve!.rect!.w + reserve!.rect!.h);
      expect(dist(tr[0].p, last.p), 'the cube TRAVELLED').toBeGreaterThan(40);
      lastLanding = Math.max(lastLanding, last.s.t);
    }

    // ── 2. ЖЕТОН: born over blue's reserve AFTER the last landing, «+2», rose monotonically, dissolved.
    const tokens = ids(tact, 'token');
    expect(tokens.length, 'exactly one token — one card answered one leave of blue\'s').toBe(1);
    const token = track(tact, tokens[0], 'any');
    expect(token.length, 'the token was sampled').toBeGreaterThan(3);
    expect(token[0].p.amount, 'the token announces the count').toBe('2');
    expect(token[0].p.text, 'the token reads «+2»').toContain('+2');
    expect(token[0].s.t, 'the token was born after the last cube landed').toBeGreaterThanOrEqual(lastLanding - 20);
    const reserveAtBirth = token[0].s.reserves[viewer];
    expect(reserveAtBirth?.rect !== undefined && visible(reserveAtBirth.vis), 'blue\'s reserve was visible when the token was born').toBe(true);
    expect(Math.abs(token[0].p.x - center(reserveAtBirth!.rect!).x), 'born centred over the reserve').toBeLessThan(reserveAtBirth!.rect!.w);
    expect(reserveAtBirth!.rect!.y - token[0].p.y, 'born just above the stack').toBeGreaterThan(0);
    const ys = token.filter(({s}) => s.src === 'tick').map(({p}) => p.y);
    expect(ys.length).toBeGreaterThan(2);
    expect(ys[0] - ys[ys.length - 1], 'the token ROSE').toBeGreaterThan(8);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i], `the token rises one way, never back (${ys.map((y) => Math.round(y)).join(',')})`).toBeLessThanOrEqual(ys[i - 1] + 0.5);
    }
    const restSample = all[all.length - 1];
    expect(restSample.proxies.some((p) => p.body === 'token'), 'the token dissolved — nothing left on screen').toBe(false);

    // ── 3. ЛЕНТА: while the token stood, the band named the card and the count; one line, never wrapped.
    const tokenFrames = token.map(({s}) => s);
    expect(tokenFrames.some((s) => /Политология/.test(s.band.text) && /Данные\s*2/.test(s.band.text)),
      `the band named «Политология» and «Данные 2» (${Array.from(new Set(tokenFrames.map((s) => s.band.text))).slice(0, 4).join(' | ')})`).toBe(true);
    expect(tact.every((s) => s.band.lines <= 1), `the band never wraps (${tact.find((s) => s.band.lines > 1)?.band.text})`).toBe(true);
    expect(tact.every((s) => /ОБНОВЛЕНИЕ|RENEWAL/i.test(s.band.kicker)), 'the band\'s kicker is the tact\'s').toBe(true);
  });
});
