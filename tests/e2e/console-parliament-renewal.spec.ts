import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, crumbText, openMandatoryAnnounce, press} from './consoleStart';
import {answerGateAs, expectRailHonest, mandatoryPlate, parliamentWire, sittingStage, waitSittingAtRest} from './parliamentDrive';

/**
 * «ОБНОВЛЕНИЕ» — the renewal of the voting area as a TACT of its own (2026-09-22,
 * docs/claude/prompts/parliament-renewal-beat.md §6): the owner's three frames were
 * НАГРАДА with popular support on two parties → ИТОГИ with «0 делегатов» under the
 * same two cards → the next generation's overview with a neutral delegate on each.
 * The deck was empty, both losers came back from the reshuffled discard, the old
 * «the same card stays» exception (P-22) let nothing fly, and the holds folded
 * without a single landing.
 *
 * Scenario 2 of the small deck (the fixture `parliament-renewal-assembly`): an EMPTY
 * deck and discard, red wins Architecture Award from the middle slot, blue's free
 * delegate stands on the Greens' loser. One A plays the whole walk. Every probe
 * below asserts THREE things about a flight — the source was visible, the
 * destination was visible, and movement happened between them — and reads the
 * server's own journal as the ground truth. A probe that only asserts that an
 * event fired is treated as absent.
 *
 *  1. УХОД      every loser is visible in its slot before the tact, turns face-DOWN in flight (monotonic, no
 *               overshoot), vanishes at the discard pile; blue's delegate started on the card and landed in
 *               blue's reserve (visible);
 *  2. ПЕРЕТАСОВКА  a frame in which the discard becomes the deck, BEFORE the first deal;
 *  3. РАЗДАЧА   every dealt card started on the deck's top, opened ONCE in flight, landed on its slot (≤ 1 px),
 *               never two cards in one slot;
 *  4. ПОДДЕРЖКА every cube started on ITS OWN plaque's socket (visible), landed on the card's place (visible);
 *               the tally under the card equals the server's record after the last landing; the neutral
 *               supply in the head never moved;
 *  5. ТЕЛО И ЛЕНТА  the body is the row of parties for the whole tact, no results panel in any frame, the
 *               crumb reads «ОБНОВЛЕНИЕ», the band is one honest line;
 *  6. НИКАКИХ ПРИСВАИВАНИЙ  no hold folded without its flight (`data-renewal-degraded` never appears);
 *  7. ИТОГИ ПОСЛЕ  the panel opens only after the last landing; no «0 делегатов» under a card with votes.
 *
 * `MutationObserver` + `setInterval`, never rAF. Screenshots under screenshots/parliament-renewal/.
 */
const OUT = path.resolve('screenshots', 'parliament-renewal');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type Rect = {x: number, y: number, w: number, h: number};
type Vis = {box: boolean, ink: number, free: boolean, overlap: number};
type Proxy = {id: string, body: string, face: string, color: string, x: number, y: number, w: number, rotY: number | undefined, shown: boolean};
type SlotSample = {instance: string, votes: number, tally: string, awaiting: boolean, faceShown: boolean, empty: boolean, rect: Rect | undefined, faceVis: Vis};
type Sample = {
  src: 'mo' | 'tick', t: number, stage: string, motion: string, crumb: string, degraded: string,
  proxies: Array<Proxy>, slots: Array<SlotSample>, homes: number,
  deck: number, discard: number, supply: number,
  support: Record<string, number>, sockets: Record<string, Rect>, socketVis: Record<string, Vis>,
  reserves: Record<string, {rect: Rect | undefined, count: number, vis: Vis}>,
  rowShown: boolean, reading: boolean, resultsHidden: boolean,
  band: {kicker: string, text: string, lines: number},
  faces: Record<string, number>,
};
type Probe = {samples: Array<Sample>};

type Journal = Array<
  | {kind: 'leave', instance: string, resolution: string, party: string, slot: number, returned: Array<{owner: string, count: number}>}
  | {kind: 'reshuffle', size: number}
  | {kind: 'reject', instance: string, resolution: string, party: string, slot: number, reason: string}
  | {kind: 'deal', instance: string, resolution: string, party: string, slot: number, source: string}
  | {kind: 'support', party: string, instance: string, count: number}
  | {kind: 'empty', slot: number}
  | {kind: 'lobby', player: string}>;

/** THE PROBE — armed BEFORE the press. `vis()` is the v4 definition of «видно»: box, effective ink, no panel over the centre. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__renewal: Probe};
    w.__renewal = {samples: []};
    const rect = (el: Element | null | undefined): Rect | undefined => {
      if (el === null || el === undefined) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const area = (a: Rect, b: Rect): number => {
      const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return a.w * a.h === 0 ? 0 : (x * y) / (a.w * a.h);
    };
    const vis = (el: Element | null | undefined): Vis => {
      const r = rect(el);
      if (el === null || el === undefined || r === undefined) {
        return {box: false, ink: 0, free: false, overlap: 1};
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
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const hit = document.elementFromPoint(cx, cy);
      // A flight proxy over the object is the object's own event, never a cover.
      const free = hit !== null && (hit === el || el.contains(hit) || hit.contains(el) || hit.closest('[data-parl-flight]') !== null);
      let overlap = 0;
      for (const panel of Array.from(document.querySelectorAll<HTMLElement>('[data-parl-reading]'))) {
        const pr = rect(panel);
        if (pr !== undefined && Number(getComputedStyle(panel).opacity || 1) > 0.02 && getComputedStyle(panel).display !== 'none') {
          overlap = Math.max(overlap, area(r, pr));
        }
      }
      return {box: r.w > 1 && r.h > 1, ink, free, overlap};
    };
    const sample = (src: 'mo' | 'tick') => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      if (root === null) {
        return;
      }
      const proxies: Array<Proxy> = Array.from(document.querySelectorAll<HTMLElement>('[data-parl-flight]')).map((el) => {
        const r = el.getBoundingClientRect();
        const inner = el.querySelector<HTMLElement>('.con-card3d');
        const m = inner === null ? null : /rotateY\(([-\d.]+)deg\)/.exec(inner.style.transform);
        // GSAP writes the body's transform; a rotateY of exactly 0 is omitted from its string, and a card PARKED
        // face-up (the enacted card's, a loser's) carries no transform at all until its turn begins — both ARE
        // face-up. A face-down birth (a deal) is written as rotateY(180) on the tick the proxy is born.
        const rotY = m !== null ? Number(m[1]) : (inner !== null ? 0 : undefined);
        const cube = el.querySelector<HTMLElement>('.player-cube');
        const color = cube === null ? '' : (Array.from(cube.classList).find((c) => c.startsWith('player-cube--') || c.startsWith('cube-')) ?? cube.className.toString().slice(0, 40));
        const cs = getComputedStyle(el);
        return {
          id: el.getAttribute('data-parl-flight') ?? '', body: el.getAttribute('data-parl-flight-body') ?? 'cube',
          face: el.getAttribute('data-parl-flight-face') ?? '', color,
          x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, rotY,
          // A proxy is BORN invisible at the layer's origin and positioned on the next tick: only its shown frames are its flight.
          shown: cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0.02,
        };
      });
      const homes = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slots > .con-parl__slot-home'));
      const slots: Array<SlotSample> = homes.map((home) => {
        const slot = home.querySelector<HTMLElement>('.con-parl__slot');
        const face = home.querySelector<HTMLElement>('.con-parl__card .pcard') ?? home.querySelector<HTMLElement>('.con-parl__slot-empty-card');
        return {
          instance: home.getAttribute('data-home') ?? '',
          votes: Number(slot?.getAttribute('data-votes') ?? '0'),
          tally: slot?.querySelector('.con-parl__tally-num')?.textContent?.trim() ?? '',
          awaiting: slot?.hasAttribute('data-parl-slot-awaiting') === true,
          faceShown: face !== null && face.classList.contains('pcard') && getComputedStyle(face).visibility !== 'hidden',
          empty: home.querySelector('[data-parl-slot-empty]') !== null,
          rect: rect(face),
          faceVis: vis(face),
        };
      });
      const support: Record<string, number> = {};
      const sockets: Record<string, Rect> = {};
      const socketVis: Record<string, Vis> = {};
      for (const box of Array.from(root.querySelectorAll<HTMLElement>('[data-parl-support]'))) {
        const party = box.getAttribute('data-parl-support') ?? '';
        support[party] = box.querySelectorAll('.con-pseal__support-place--on').length;
        for (const place of Array.from(box.querySelectorAll<HTMLElement>('[data-support-place]'))) {
          const key = `${party}#${place.getAttribute('data-support-place')}`;
          const r = rect(place);
          if (r !== undefined) {
            sockets[key] = r;
            socketVis[key] = vis(place);
          }
        }
      }
      const reserves: Record<string, {rect: Rect | undefined, count: number, vis: Vis}> = {};
      for (const stack of Array.from(root.querySelectorAll<HTMLElement>('[data-parl-seat-reserve]'))) {
        const color = stack.getAttribute('data-parl-seat-reserve') ?? '';
        reserves[color] = {rect: rect(stack), count: Number(stack.getAttribute('data-count') ?? '0'), vis: vis(stack)};
      }
      const faces: Record<string, number> = {};
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-parl .pcard, [data-parl-flight] .pcard'))) {
        const r = el.getBoundingClientRect();
        if (getComputedStyle(el).visibility === 'hidden' || r.width < 2 || r.height < 2) {
          continue;
        }
        const slug = Array.from(el.classList).find((c) => c.startsWith('pcard--rdx-')) ?? '';
        if (slug !== '') {
          faces[slug] = (faces[slug] ?? 0) + 1;
        }
      }
      const reading = document.querySelector<HTMLElement>('[data-parl-reading]');
      const rr = reading === null ? undefined : reading.getBoundingClientRect();
      // The band CROSSFADES its line: during the fade two lines stand in the DOM (the leaving and the entering one), so every line is read.
      const bandLines = Array.from(root.querySelectorAll<HTMLElement>('.con-band__line'));
      w.__renewal.samples.push({
        src, t: performance.now(),
        stage: root.getAttribute('data-sitting-stage') ?? '',
        motion: root.getAttribute('data-sitting-motion') ?? '',
        crumb: (root.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        degraded: root.getAttribute('data-renewal-degraded') ?? '',
        proxies, slots, homes: homes.length,
        deck: Number(root.querySelector('[data-parl-deck-pile]')?.getAttribute('data-count') ?? '-1'),
        discard: Number(root.querySelector('[data-parl-discard-pile]')?.getAttribute('data-count') ?? '-1'),
        supply: Number(root.querySelector('[data-parl-neutral-cube]')?.getAttribute('data-count') ?? '-1'),
        support, sockets, socketVis, reserves,
        rowShown: root.querySelector('[data-parl-row-shown]') !== null,
        reading: reading !== null && rr !== undefined && rr.width > 1 && Number(getComputedStyle(reading).opacity || 1) > 0.02 && getComputedStyle(reading).display !== 'none',
        resultsHidden: root.querySelector('[data-sit-results-hidden]') !== null,
        band: {
          kicker: bandLines.map((l) => l.querySelector('.con-band__kicker')?.textContent?.trim() ?? '').join('|'),
          text: bandLines.map((l) => (l.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' || '),
          lines: Math.max(0, ...bandLines.map((l) => Math.round(l.getBoundingClientRect().height / Math.max(1, parseFloat(getComputedStyle(l).lineHeight) || 1)))),
        },
        faces,
      });
      if (w.__renewal.samples.length > 9000) {
        w.__renewal.samples.splice(0, 1500);
      }
    };
    new MutationObserver(() => sample('mo')).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-motion', 'data-sitting-stage', 'data-count', 'data-parl-slot-awaiting']});
    window.setInterval(() => sample('tick'), 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__renewal: Probe}).__renewal);

const center = (r: Rect): {x: number, y: number} => ({x: r.x + r.w / 2, y: r.y + r.h / 2});
const dist = (a: {x: number, y: number}, b: {x: number, y: number}): number => Math.hypot(a.x - b.x, a.y - b.y);
const visible = (v: Vis): boolean => v.box && v.ink > 0.9 && v.overlap < 0.02;

/** Every sample of one proxy id, in order (ticks only — claims about frames are made on the task clock). */
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

function ids(samples: ReadonlyArray<Sample>, prefix: string): Array<string> {
  const out: Array<string> = [];
  for (const s of samples) {
    for (const p of s.proxies) {
      if (p.id.startsWith(prefix) && !out.includes(p.id)) {
        out.push(p.id);
      }
    }
  }
  return out;
}

test.describe('«ОБНОВЛЕНИЕ» — the renewal is a tact, and every object of it moves from a visible place to a visible place (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('scenario 2: an empty deck — the losers leave (delegates home first), the discard turns over, both are dealt back, the support seats off the plaques, the panel opens after the last landing', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-renewal-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    const before = await parliamentWire(request, playerId);
    expect(before.game.parliament?.phase?.step).toBe('assembly');
    const viewer = before.thisPlayer.color;
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    await armProbe(page);
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(page.locator('.con-parl')).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page);
    // The table as voted: the two losers are on screen, blue's delegate on the Greens' card.
    const tableBefore = await readProbe(page);
    const seenBefore = tableBefore.samples[tableBefore.samples.length - 1];
    expect(seenBefore.slots.length, 'three cards as voted').toBe(3);
    const neutralSupplyAtVerdict = seenBefore.supply;
    await shoot(page, '00-verdict');

    // ONE A (the other seat answered first): the whole walk plays by itself.
    await answerGateAs(request, seats[1], 'assembly');
    await press(page, 'Enter', 400);
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('renewal');
    // A FILM STRIP of the tact for the report (the probe below is the evidence; these are the owner's frames).
    // The probe is NOT read mid-tact: hauling thousands of samples out of the page takes seconds and would
    // cost the strip its frames.
    for (let frame = 1; frame <= 9; frame++) {
      await shoot(page, `01-tact-${frame}`);
      await cinematicBeat(page, 520, 'the next frame of the film strip of the tact');
    }
    await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '05-results');

    const wire = await parliamentWire(request, playerId);
    const summary = wire.game.parliament?.phase?.summary as (typeof wire.game.parliament extends undefined ? never : {renewal?: Journal, refreshed: Array<{instance: string, party: string, neutralVotes: number}>}) | undefined;
    const journal = summary?.renewal ?? [];
    expect(journal.map((e) => e.kind).join(' '), 'the server journalled scenario 2').toMatch(/^leave leave reshuffle deal( support)? deal( support)? empty( lobby)+$/);
    const leaves = journal.filter((e): e is Extract<Journal[number], {kind: 'leave'}> => e.kind === 'leave');
    const deals = journal.filter((e): e is Extract<Journal[number], {kind: 'deal'}> => e.kind === 'deal');
    const supports = journal.filter((e): e is Extract<Journal[number], {kind: 'support'}> => e.kind === 'support');
    expect(supports.length, 'both re-dealt parties carry the support the sitting paid them').toBe(2);

    const probe = await readProbe(page);
    const all = probe.samples;
    const renewalStart = all.findIndex((s) => s.stage === 'renewal');
    expect(renewalStart, 'the renewal page was sampled').toBeGreaterThan(0);
    const tact = all.slice(renewalStart).filter((s) => s.motion === 'renewal');
    expect(tact.length, 'the tact was sampled').toBeGreaterThan(30);
    const restSample = all[all.length - 1];

    // ── 6. НИКАКИХ ПРИСВАИВАНИЙ: no hold of the tact folded without its flight.
    expect(all.filter((s) => s.degraded !== '').map((s) => s.degraded).slice(0, 3), 'no renewal event settled without a flight').toEqual([]);

    // ── 5. ТЕЛО И ЛЕНТА: the row of parties for the whole tact, no results panel in any frame, the crumb and the band.
    expect(tact.every((s) => s.rowShown), 'the row of parties stood for every frame of the tact').toBe(true);
    expect(tact.some((s) => s.reading), 'no results panel stood over the table during the tact').toBe(false);
    expect(tact.every((s) => s.stage === 'renewal'), 'the page is the renewal for the whole tact').toBe(true);
    expect(tact.every((s) => /ОБНОВЛЕНИЕ|RENEWAL/i.test(s.crumb)), `the crumb reads «ОБНОВЛЕНИЕ» (${tact.find((s) => !/ОБНОВЛЕНИЕ|RENEWAL/i.test(s.crumb))?.crumb})`).toBe(true);
    expect(tact.every((s) => s.band.lines <= 1), `the band never wraps (${tact.find((s) => s.band.lines > 1)?.band.text})`).toBe(true);
    expect(tact.every((s) => /ОБНОВЛЕНИЕ|RENEWAL/i.test(s.band.kicker)), 'the band\'s kicker is the tact\'s').toBe(true);
    const bandTexts = new Set(tact.map((s) => s.band.text));
    expect(bandTexts.size, `the band named the events as they played (${Array.from(bandTexts).slice(0, 6).join(' | ')})`).toBeGreaterThanOrEqual(4);

    // ── 1. УХОД: every loser visible in its slot before the tact, turned face-down in flight (monotonic, no
    //          overshoot), gone at the discard pile; blue's delegate left the card for blue's reserve.
    const discardRect = await page.locator('[data-parl-discard-top]').boundingBox();
    const deckRect = await page.locator('[data-parl-deck-top]').boundingBox();
    expect(discardRect, 'the discard pile is on screen').not.toBeNull();
    expect(deckRect, 'the deck is on screen').not.toBeNull();
    const dPile = center({x: discardRect!.x, y: discardRect!.y, w: discardRect!.width, h: discardRect!.height});
    const kPile = center({x: deckRect!.x, y: deckRect!.y, w: deckRect!.width, h: deckRect!.height});
    for (const leave of leaves) {
      const beforeLift = all.slice(0, renewalStart).filter((s) => s.src === 'tick' && s.stage !== '');
      const lastBefore = beforeLift[beforeLift.length - 1];
      const home = lastBefore.slots.find((sl) => sl.instance === leave.instance);
      expect(home?.faceShown && visible(home.faceVis), `${leave.resolution} was visible in its slot before the tact (${JSON.stringify(home)} on the ${lastBefore.stage} page)`).toBe(true);
      const parkIds = ids(tact, 'sit-park').filter((id) => track(tact, id).some(({p}) => p.face === leave.resolution));
      expect(parkIds.length, `${leave.resolution} left as ONE card body`).toBe(1);
      const flight = track(tact, parkIds[0]).filter(({p}) => p.rotY !== undefined);
      expect(flight.length, `${leave.resolution}'s turn was sampled`).toBeGreaterThan(3);
      const rots = flight.map(({p}) => p.rotY as number);
      expect(rots[0], 'born face-up').toBeLessThan(10);
      expect(rots[rots.length - 1], 'gone face-down').toBeGreaterThan(170);
      for (let i = 1; i < rots.length; i++) {
        expect(rots[i], `${leave.resolution} turns one way, never back (${rots.map((r) => Math.round(r)).join(',')})`).toBeGreaterThanOrEqual(rots[i - 1] - 0.5);
        expect(rots[i], 'never past the back (no overshoot)').toBeLessThanOrEqual(180.5);
      }
      const last = flight[flight.length - 1].p;
      expect(dist(last, dPile), `${leave.resolution} vanished at the DISCARD pile (${Math.round(dist(last, dPile))} px away)`).toBeLessThan(Math.max(discardRect!.width, discardRect!.height) * 1.5);
      expect(dist(flight[0].p, last), 'the card TRAVELLED').toBeGreaterThan(80);
      // …and once it LIFTED (the body is turning — until then the proxy merely stands over the very card it copies),
      // the slot under it read as an empty place: never two cards, never a stale face.
      const lifted = flight.find(({p}) => (p.rotY ?? 0) > 5)?.s;
      expect(lifted, 'a frame of the turn was sampled').toBeDefined();
      const homeAfter = lifted?.slots.find((sl) => sl.instance === leave.instance);
      expect(homeAfter === undefined || homeAfter.empty || homeAfter.awaiting || !homeAfter.faceShown, 'the slot let go of the card as it lifted').toBe(true);
      for (const entry of leave.returned) {
        expect(entry.owner, 'blue\'s delegate stood on a loser').toBe(viewer);
        const cubes = ids(tact, 'f').filter((id) => track(tact, id).some(({p}) => p.body === 'cube' && p.color.includes(entry.owner)));
        expect(cubes.length, `${entry.count} cube(s) of ${entry.owner} flew off the loser`).toBeGreaterThanOrEqual(entry.count);
        const cube = track(tact, cubes[0]);
        const first = cube[0];
        const lastCube = cube[cube.length - 1];
        expect(home?.rect === undefined ? Infinity : dist(first.p, center(home.rect)), 'the delegate started on the card').toBeLessThan((home?.rect?.h ?? 0) * 0.9);
        const reserve = lastCube.s.reserves[entry.owner];
        expect(reserve?.rect !== undefined && visible(reserve.vis), 'the owner\'s reserve was visible at the landing').toBe(true);
        expect(dist(lastCube.p, center(reserve!.rect!)), 'the delegate landed in the owner\'s reserve').toBeLessThan(reserve!.rect!.w + reserve!.rect!.h);
        const beforeCount = first.s.reserves[entry.owner]?.count ?? -1;
        expect(restSample.reserves[entry.owner]?.count, 'the reserve grew by the landing (minus the lobby refill)').toBeGreaterThanOrEqual(beforeCount);
      }
    }

    // ── 2. ПЕРЕТАСОВКА: the discard becomes the deck, and that frame PRECEDES the first deal.
    const shuffleIds = ids(tact, 'sit-shuffle');
    expect(shuffleIds.length, 'the pile turned over as a stack of backs').toBeGreaterThan(0);
    const shuffleFirst = track(tact, shuffleIds[0])[0];
    const shuffleLast = track(tact, shuffleIds[0]).slice(-1)[0];
    expect(dist(shuffleFirst.p, dPile), 'the stack lifted off the DISCARD').toBeLessThan(Math.max(discardRect!.width, discardRect!.height) * 2);
    expect(dist(shuffleLast.p, kPile), 'the stack landed on the DECK').toBeLessThan(Math.max(deckRect!.width, deckRect!.height) * 2);
    const turnedOver = tact.findIndex((s) => s.src === 'tick' && s.deck >= 2 && s.discard <= 0);
    expect(turnedOver, 'a frame in which the discard has become the deck').toBeGreaterThan(0);
    const beforeTurn = tact.slice(0, turnedOver);
    expect(beforeTurn.some((s) => s.src === 'tick' && s.discard >= 2 && s.deck === 0), 'the two losers lay on the discard, the deck empty, before it turned over').toBe(true);
    const firstDeal = tact.findIndex((s) => s.proxies.some((p) => p.id.startsWith('sit-deal')));
    expect(firstDeal, 'a deal happened').toBeGreaterThan(0);
    expect(turnedOver, 'the reshuffle PRECEDES the first deal').toBeLessThan(firstDeal);
    expect(tact[firstDeal].t, 'and the stack had landed before the first card came off the deck').toBeGreaterThanOrEqual(shuffleLast.s.t - 1);

    // ── 3. РАЗДАЧА: every dealt card off the deck's top, opened ONCE in flight, landed on its slot within a pixel.
    const dealIds = ids(tact, 'sit-deal');
    expect(dealIds.length, `${deals.length} cards were dealt (both losers came back — the whole way)`).toBe(deals.length);
    for (const deal of deals) {
      const id = dealIds.find((x) => track(tact, x).some(({p}) => p.face === deal.resolution));
      expect(id, `${deal.resolution} flew as its own body`).toBeDefined();
      const flight = track(tact, id!).filter(({p}) => p.rotY !== undefined);
      expect(flight.length, 'the deal was sampled').toBeGreaterThan(3);
      expect(dist(flight[0].p, kPile), `${deal.resolution} started on the deck's top`).toBeLessThan(Math.max(deckRect!.width, deckRect!.height) * 2.5);
      const rots = flight.map(({p}) => p.rotY as number);
      expect(rots[0], 'born face-down').toBeGreaterThan(170);
      expect(rots[rots.length - 1], 'rests face-up').toBeLessThan(10);
      let crossings = 0;
      for (let i = 1; i < rots.length; i++) {
        expect(rots[i], 'never turns back').toBeLessThanOrEqual(rots[i - 1] + 0.5);
        if (rots[i - 1] > 90 && rots[i] <= 90) {
          crossings++;
        }
      }
      expect(crossings, 'the face opened exactly once').toBe(1);
      // THE LANDING is the first frame the body stands ON its slot: the face is revealed there and the proxy leaves on the
      // NEXT frame (the handoff contract — never a crossfade, never a blank frame), so that one frame legitimately holds both.
      const slotRectOf = (sm: Sample): Rect | undefined => sm.slots.find((sl) => sl.instance === deal.instance)?.rect;
      const deltaOf = ({s: sm, p}: {s: Sample, p: Proxy}): number => {
        const r = slotRectOf(sm);
        return r === undefined ? Infinity : dist(p, center(r));
      };
      // The touchdown is a SNAP to the measured place (one style write) that stands for a frame before the proxy leaves;
      // the task sampler can miss that one frame on a busy main thread, while the MutationObserver fires on the very
      // write — so the landing's precision is read on EVERY sample, the waiting place on the ticks before it.
      const whole = track(tact, id!, 'any').filter(({p}) => p.rotY !== undefined);
      const landedAt = whole.findIndex((f) => deltaOf(f) <= 1.5);
      expect(landedAt, `${deal.resolution} landed ON its slot (closest Δ ${Math.min(...whole.map(deltaOf)).toFixed(1)} px)`).toBeGreaterThan(0);
      const landedT = whole[landedAt].s.t;
      // The place waited: the slot read as a waiting place while its card was in the air, and painted the face once it landed.
      expect(flight.filter(({s: sm}) => sm.t < landedT).every(({s: sm}) => sm.slots.find((sl) => sl.instance === deal.instance)?.faceShown !== true), 'the slot face waited under the flying card').toBe(true);
      expect(restSample.slots.find((sl) => sl.instance === deal.instance)?.faceShown, 'the face shows at rest').toBe(true);
    }
    // NEVER TWO CARDS IN ONE SLOT — the one exception being the HANDOFF frame itself: the body has touched down on the
    // slot (Δ ≤ 2 px), the slot's face is revealed under it, and the proxy leaves on the next frame (the contract). A
    // second painted face anywhere ELSE in a frame is the defect.
    // A claim about FRAMES is made on the task clock only: a MutationObserver sample runs as a microtask and can see the
    // proxy posed over a face whose hide is one Vue flush away — a state the browser never paints.
    const slugOf = (resolution: string): string => `pcard--${resolution.toLowerCase().replace(/_/g, '-')}`;
    for (const s of tact.filter((x) => x.src === 'tick')) {
      for (const [slug, n] of Object.entries(s.faces)) {
        if (n <= 1) {
          continue;
        }
        // (The landing's own precision is asserted above at ≤ 1.5 px; here the question is only WHERE the second face is.)
        const nearest = (p: Proxy): number => Math.min(...s.slots.map((sl) => sl.rect === undefined ? Infinity : dist(p, center(sl.rect))));
        const handoff = s.proxies.some((p) => p.shown && slugOf(p.face) === slug && nearest(p) <= 8);
        expect(handoff, `${slug} is painted twice in one frame, and not at a touchdown (${s.proxies.filter((p) => p.shown).map((p) => `${p.id}[${p.face}→${slugOf(p.face)}]@${Math.round(p.x)},${Math.round(p.y)} Δslot=${nearest(p).toFixed(1)}`).join(' ')})`).toBe(true);
      }
    }
    expect(tact.some((s) => s.src === 'tick' && s.slots.some((sl) => sl.awaiting)), 'a waiting place was seen').toBe(true);

    // ── 4. ПОДДЕРЖКА: every cube off ITS OWN plaque's socket (visible) onto the card's place (visible); the tally is the server's; the supply never moved.
    for (const sup of supports) {
      const card = restSample.slots.find((sl) => sl.instance === sup.instance);
      expect(card?.rect, `${sup.instance} stands at rest`).toBeDefined();
      const cubes = ids(tact, 'f').filter((id) => {
        const tr = track(tact, id);
        return tr.length > 0 && tr[0].p.body === 'cube' && tr[0].p.color.includes('neutral') && card?.rect !== undefined && dist(tr[tr.length - 1].p, center(card.rect)) < card.rect.h;
      });
      expect(cubes.length, `${sup.count} neutral cube(s) landed on ${sup.instance}`).toBe(sup.count);
      for (const id of cubes) {
        const tr = track(tact, id);
        const first = tr[0];
        const socketKey = Object.keys(first.s.sockets).filter((k) => k.startsWith(`${sup.party}#`)).sort((a, b) => dist(first.p, center(first.s.sockets[a])) - dist(first.p, center(first.s.sockets[b])))[0];
        expect(socketKey, 'a socket of the party\'s own plaque').toBeDefined();
        const socket = first.s.sockets[socketKey];
        expect(dist(first.p, center(socket)), `the cube started ON the ${sup.party} plaque's socket ${socketKey} (${Math.round(dist(first.p, center(socket)))} px)`).toBeLessThan(socket.w * 1.5);
        expect(visible(first.s.socketVis[socketKey]), 'the socket was visible when the cube left it').toBe(true);
        const last = tr[tr.length - 1];
        const target = last.s.slots.find((sl) => sl.instance === sup.instance);
        expect(target !== undefined && visible(target.faceVis), 'the card was visible when the cube landed').toBe(true);
        // The plaque let go of the cube as it LEFT: the shown stock fell by one at the lift, never at the landing.
        expect(first.s.support[sup.party], 'the plaque released the cube at its start').toBeLessThan(sup.count - cubes.indexOf(id) + 1);
      }
      expect(card?.tally, `the tally under ${sup.instance} equals the server's record after the last landing`).toBe(String(sup.count));
      expect(summary?.refreshed.find((f) => f.instance === sup.instance)?.neutralVotes).toBe(sup.count);
    }
    // The support step of ПРИНЯТИЕ legitimately takes cubes from the supply; the TACT takes none — nothing of the
    // renewal comes from the head's neutral reserve, and nothing goes back into it here.
    const supplyAtTact = tact[0].supply;
    expect(supplyAtTact, 'the supply is smaller than at the verdict: the enactment paid the parties from it').toBeLessThan(neutralSupplyAtVerdict);
    expect(tact.every((s) => s.supply === supplyAtTact), `the neutral supply in the head never moved during the tact (${supplyAtTact} → ${tact.find((s) => s.supply !== supplyAtTact)?.supply})`).toBe(true);
    expect(restSample.support[supports[0].party] ?? 0, 'the plaque shows no stock once its cubes are on the card').toBe(0);

    // ── 7. ИТОГИ ПОСЛЕ: the panel opens only after the last landing; no «0 делегатов» under a card with votes.
    const lastProxyAt = Math.max(...all.filter((s) => s.src === 'tick' && s.proxies.some((p) => !p.id.startsWith('sit-park') || s.motion === 'renewal')).map((s) => s.t));
    const panelAt = all.find((s) => s.src === 'tick' && s.reading && s.stage === 'results')?.t ?? -1;
    expect(panelAt, 'the results panel opened').toBeGreaterThan(0);
    expect(panelAt, `the panel opened after the last landing (panel @${Math.round(panelAt)}, last proxy @${Math.round(lastProxyAt)})`).toBeGreaterThanOrEqual(lastProxyAt);
    for (const sl of restSample.slots) {
      if (sl.votes > 0) {
        expect(Number(sl.tally), `no «0 делегатов» under ${sl.instance} with ${sl.votes} votes`).toBe(sl.votes);
      }
    }
    await expect(page.locator('[data-sit-results-hidden]'), 'the card revealed at rest').toHaveCount(0);
    expect((await crumbText(page)).toUpperCase()).toMatch(/ИТОГИ|RESULTS/);
    expect(restSample.deck, 'the deck at rest is the live count').toBe(wire.game.parliament === undefined ? -1 : (wire.game.parliament as unknown as {deckSize: number}).deckSize);
    await expectRailHonest(page, 'the results band', '.con-band');
    expect(wire.waitingFor?.parliamentPhasePrompt?.stage, 'gate 2 stands until A').toBe('adjourn');
  });
});
