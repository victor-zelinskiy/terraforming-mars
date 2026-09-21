import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openMandatoryAnnounce, press, settle} from './consoleStart';
import {answerGateAs, mandatoryPlate, parliament, parliamentWire, PARLIAMENT_PRESETS, sittingStage, waitSittingAtRest} from './parliamentDrive';

/**
 * «ЗАСЕДАНИЕ v4» — СТОЛ и ЧТЕНИЕ, разделённые ВО ВРЕМЕНИ.
 *
 * The v3 sitting was rejected for one structural reason: the reading panel stood on the middle tier from the
 * verdict on, so the whole parties row — five tiles, their support sockets, the object every physical beat of
 * the sitting moves something to or from — was COVERED for the entire walk. Everything downstream of that was
 * a consequence: the support distribution happened off screen, the party swap could not be a FLIP (its source
 * rects measured nothing), and the panel had to narrate what the player was not allowed to see.
 *
 * v4 splits the two in time: ВЕРДИКТ · ПОВЕСТКА · ПОДДЕРЖКА · ПРИНЯТИЕ and the physical part of ИТОГИ are the
 * TABLE (no panel at all — everything reads on objects); НАГРАДА and the final ИТОГИ card are READING (the
 * panel takes the row's place ONCE, by an explicit motion).
 *
 * EVERY PROBE HERE ASSERTS THREE THINGS: the source was visible, the destination was visible, and movement
 * happened between them. Visible means a non-zero rect, a non-zero effective opacity, and no other element
 * covering the object's own centre. A probe that only asserts that an event fired is treated as absent — so
 * `vis()` walks the ancestor chain for opacity/visibility/display and checks both `elementFromPoint` and the
 * geometric overlap of every mounted reading panel (a panel with `pointer-events: none` is invisible to hit
 * testing and would otherwise cover an object unnoticed).
 *
 * The sampler is `setInterval` + `MutationObserver`, never rAF (headless Chromium drives rAF off the
 * compositor and stops exactly when the screen goes quiet).
 */
type Rect = {x: number, y: number, w: number, h: number};
/** Visibility, the three facts: a box, ink, and nothing on top of its centre. */
type Vis = {box: boolean, ink: number, free: boolean, hit: string, overlap: number};
type TileSample = {party: string, where: 'row' | 'ruler', rect: Rect, vis: Vis};
type FlightSample = {id: string, body: string, x: number, y: number, shown: boolean};
type V4Sample = {
  t: number, motion: string, beat: string, stage: string, resultsHidden: boolean,
  rowShown: boolean, rowVis: Vis, rowRect: Rect | undefined,
  reading: boolean, readingRect: Rect | undefined, readingInk: number,
  tiles: Array<TileSample>, rulerSlotParty: string,
  flights: Array<FlightSample>,
  support: Record<string, number>, landed: number,
  sockets: Record<string, Rect>, supply: Rect | undefined,
  cards: Record<string, Rect>, ribbons: Record<string, Rect>,
  govCard: Rect | undefined, ruling: Rect | undefined, quest: Rect | undefined,
  rulerBox: Rect | undefined, rulerSlot: Rect | undefined,
  kicker: {w: number, sw: number, text: string} | undefined,
};
type V4Probe = {samples: Array<V4Sample>};

const OUT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'parliament-v4');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/**
 * The in-page sampler. `vis()` is the whole point of this file: it is the ONE definition of «видно» the five
 * probes share, and it is deliberately stricter than «the node exists».
 */
async function armV4Probe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__v4: V4Probe};
    w.__v4 = {samples: []};
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
        return {box: false, ink: 0, free: false, hit: '', overlap: 1};
      }
      // The ANCESTOR CHAIN, not the element: a parked tier fades its children by fading itself.
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
      const free = hit !== null && (hit === el || el.contains(hit) || hit.contains(el));
      // …and the GEOMETRIC test beside it: a `pointer-events: none` panel never answers `elementFromPoint`.
      let overlap = 0;
      for (const panel of Array.from(document.querySelectorAll<HTMLElement>('[data-parl-reading]'))) {
        const pr = rect(panel);
        if (pr !== undefined && Number(getComputedStyle(panel).opacity || 1) > 0.02) {
          overlap = Math.max(overlap, area(r, pr));
        }
      }
      return {box: r.w > 1 && r.h > 1, ink, free, hit: hit === null ? '' : (hit.className || hit.tagName).toString().slice(0, 60), overlap};
    };
    const sample = () => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      if (root === null) {
        return;
      }
      const tiles: Array<TileSample> = [];
      for (const tile of Array.from(root.querySelectorAll<HTMLElement>('.con-parl__party[data-party]'))) {
        const r = rect(tile);
        if (r === undefined) {
          continue;
        }
        tiles.push({
          party: tile.getAttribute('data-party') ?? '',
          where: tile.closest('[data-parl-ruler-slot]') !== null ? 'ruler' : 'row',
          rect: r, vis: vis(tile),
        });
      }
      const support: Record<string, number> = {};
      const sockets: Record<string, Rect> = {};
      for (const box of Array.from(root.querySelectorAll<HTMLElement>('[data-parl-support]'))) {
        const party = box.getAttribute('data-parl-support') ?? '';
        support[party] = box.querySelectorAll('.con-pseal__support-place--on').length;
        const r = rect(box);
        if (r !== undefined) {
          sockets[party] = r;
        }
      }
      const cards: Record<string, Rect> = {};
      const ribbons: Record<string, Rect> = {};
      for (const slot of Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot[data-instance]'))) {
        const key = slot.getAttribute('data-instance') ?? '';
        const c = rect(slot.querySelector('.con-parl__card'));
        const rb = rect(slot.querySelector('.con-parl__ribbon'));
        if (c !== undefined) {
          cards[key] = c;
        }
        if (rb !== undefined) {
          ribbons[key] = rb;
        }
      }
      const tier = root.querySelector<HTMLElement>('.con-parl__parties-tier');
      const panel = root.querySelector<HTMLElement>('[data-parl-reading]');
      const kickerEl = root.querySelector<HTMLElement>('.con-parl__ruler-kicker');
      w.__v4.samples.push({
        t: performance.now(),
        motion: root.getAttribute('data-sitting-motion') ?? '',
        beat: root.getAttribute('data-sitting-beat') ?? '',
        stage: root.getAttribute('data-sitting-stage') ?? '',
        resultsHidden: root.querySelector('[data-sit-results-hidden]') !== null,
        rowShown: tier !== null && tier.hasAttribute('data-parl-row-shown'),
        rowVis: vis(tier),
        rowRect: rect(tier),
        reading: panel !== null,
        readingRect: rect(panel),
        readingInk: panel === null ? 0 : Number(getComputedStyle(panel).opacity || 1),
        tiles,
        rulerSlotParty: root.querySelector('[data-parl-ruler-slot] .con-parl__party')?.getAttribute('data-party') ?? '',
        flights: Array.from(document.querySelectorAll<HTMLElement>('[data-parl-flight]')).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            id: el.getAttribute('data-parl-flight') ?? '',
            body: el.getAttribute('data-parl-flight-body') ?? 'cube',
            x: r.left + r.width / 2, y: r.top + r.height / 2,
            shown: getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity || 1) > 0.02,
          };
        }),
        support, landed: root.querySelectorAll('.con-pseal__support-place--landed').length,
        sockets, supply: rect(root.querySelector('[data-parl-neutral-cube]')),
        cards, ribbons,
        govCard: rect(root.querySelector('.con-parl__gov-card')),
        ruling: rect(root.querySelector('.con-parl__ruling')),
        quest: rect(root.querySelector('[data-parl-quest]')),
        rulerBox: rect(root.querySelector('[data-parl-ruler]')),
        rulerSlot: rect(root.querySelector('[data-parl-ruler-slot]')),
        kicker: kickerEl === null ? undefined : {w: kickerEl.clientWidth, sw: kickerEl.scrollWidth, text: (kickerEl.textContent ?? '').trim()},
      });
      if (w.__v4.samples.length > 9000) {
        w.__v4.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ['style', 'class', 'data-sitting-motion', 'data-sitting-beat', 'data-parl-row-shown', 'data-party']});
    window.setInterval(sample, 16);
  });
}

const readV4 = (page: Page): Promise<V4Probe> => page.evaluate(() => (window as unknown as {__v4: V4Probe}).__v4);

/** Is a point inside a rect, with a tolerance? */
function inside(p: {x: number, y: number}, r: Rect | undefined, slack: number): boolean {
  return r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}

/** The whole path a flight painted, in px — the metric is TRAVEL, never one step's delta. */
function travelOf(samples: Array<V4Sample>, id: string): number {
  let last: {x: number, y: number} | undefined;
  let sum = 0;
  for (const s of samples) {
    const f = s.flights.find((x) => x.id === id && x.shown);
    if (f === undefined) {
      continue;
    }
    if (last !== undefined) {
      sum += Math.hypot(f.x - last.x, f.y - last.y);
    }
    last = {x: f.x, y: f.y};
  }
  return sum;
}

/** The physical beats — the ones that MOVE objects on the table. */
const TABLE_MOTIONS = ['agenda', 'support', 'enact'];
const tableFrames = (s: Array<V4Sample>): Array<V4Sample> => s.filter((x) => TABLE_MOTIONS.includes(x.motion));

/** A tile is VISIBLE: it has a box, it has ink, nothing covers its centre and no reading panel overlaps it. */
function tileFailures(frames: Array<V4Sample>): Array<string> {
  const bad: Array<string> = [];
  frames.forEach((f, i) => {
    if (f.tiles.length !== 6) {
      bad.push(`@${i} (${f.motion}): ${f.tiles.length} tiles, not 6`);
      return;
    }
    for (const t of f.tiles) {
      if (!t.vis.box) {
        bad.push(`@${i} (${f.motion}): ${t.party} has no box`);
      } else if (t.vis.ink <= 0.05) {
        bad.push(`@${i} (${f.motion}): ${t.party} ink=${t.vis.ink.toFixed(3)}`);
      } else if (t.vis.overlap > 0.02) {
        bad.push(`@${i} (${f.motion}): ${t.party} covered by a reading panel (${(t.vis.overlap * 100).toFixed(0)} %)`);
      } else if (!t.vis.free) {
        bad.push(`@${i} (${f.motion}): ${t.party} centre is covered by ${t.vis.hit}`);
      }
    }
  });
  return bad;
}

/** Drive the fixture to the sitting's verdict, armed and at rest. */
async function openSitting(page: Page, request: Parameters<typeof bootFixtureSeats>[1], fixture: 'parliament-architecture-assembly' | 'parliament-climate-assembly', query: string) {
  const boot = await bootFixtureSeats(page, request, fixture, {query, landing: 'prompt'});
  await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
  expect(await openMandatoryAnnounce(page)).toBe(true);
  await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
  await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
  await waitSittingAtRest(page, 20_000);
  return boot;
}

/** The last answer opens gate 1 and the walk plays itself; come back when everything is at rest. */
async function runWalk(page: Page, request: Parameters<typeof bootFixtureSeats>[1], seat: string): Promise<void> {
  await answerGateAs(request, seat, 'assembly');
  await press(page, 'Enter', 400);
  await expect.poll(() => sittingStage(page), {timeout: 40_000}).not.toBe('verdict');
  await waitSittingAtRest(page, 60_000);
  await settle(page, {timeoutMs: 20_000});
}

test.describe('«Заседание v4» — СТОЛ и ЧТЕНИЕ (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('Г-П1 · СТОЛ: все шесть плиток видны и не перекрыты в каждом кадре Повестки, Поддержки и Принятия', async ({page, request}) => {
    test.setTimeout(300_000);
    const {seats} = await openSitting(page, request, 'parliament-architecture-assembly', '&consoleProfile=auto');
    await armV4Probe(page);
    await shoot(page, '01-verdict-table');
    await runWalk(page, request, seats[1]);

    const s = (await readV4(page)).samples;
    expect(s.length, 'the sampler ran (a dead probe passes everything)').toBeGreaterThan(40);
    const frames = tableFrames(s);
    expect(frames.length, 'the physical beats were sampled').toBeGreaterThan(20);

    // ① THE ROW IS THE TIER while the table is in play — its own marker, in every frame.
    const hidden = frames.filter((f) => !f.rowShown);
    expect(hidden.length, `the row is shown for every physical frame (${hidden.length} of ${frames.length}; first at ${hidden[0]?.motion})`).toBe(0);

    // ② …AND ALL SIX TILES ARE VISIBLE AND UNOBSTRUCTED (the five of the row + the ruler's).
    const bad = tileFailures(frames);
    expect(bad.length, `every tile is visible in every physical frame (${bad.length} failures; first: ${bad[0] ?? '—'})`).toBe(0);

    // ③ THE BUDGETS (§3): each beat's own window, measured from the published motion.
    const spans = new Map<string, {from: number, to: number}>();
    for (const f of s) {
      if (f.motion === '') {
        continue;
      }
      const cur = spans.get(f.motion);
      spans.set(f.motion, {from: cur?.from ?? f.t, to: f.t});
    }
    const ms = (k: string): number => {
      const sp = spans.get(k);
      return sp === undefined ? 0 : Math.round(sp.to - sp.from);
    };
    // eslint-disable-next-line no-console
    console.log(`[v4] beat windows: agenda=${ms('agenda')}ms support=${ms('support')}ms enact=${ms('enact')}ms reward=${ms('reward')}ms results=${ms('results')}ms`);
    expect(ms('agenda'), 'ПОВЕСТКА inside its budget').toBeGreaterThan(600);
    expect(ms('agenda'), 'ПОВЕСТКА inside its budget').toBeLessThan(1600);
    expect(ms('support'), 'ПОДДЕРЖКА inside its budget').toBeGreaterThan(900);
    expect(ms('support'), 'ПОДДЕРЖКА inside its budget').toBeLessThan(2600);
    expect(ms('enact'), 'ПРИНЯТИЕ inside its budget').toBeGreaterThan(1200);
    expect(ms('enact'), 'ПРИНЯТИЕ inside its budget').toBeLessThan(3600);
    await shoot(page, '02-after-walk');
  });

  test('Г-П2 · ПОДДЕРЖКА: каждый куб вышел из ВИДИМОГО места, сел в ВИДИМЫЙ сокет и между ними было движение', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await openSitting(page, request, 'parliament-climate-assembly', '&consoleProfile=auto');
    await armV4Probe(page);
    await runWalk(page, request, seats[1]);

    const wire = await parliamentWire(request, playerId);
    const record = (wire.game.parliament?.phase?.summary?.support ?? []);
    const paid = record.filter((e) => e.gained > 0);
    expect(paid.length, 'the server paid somebody (the scene has something to show)').toBeGreaterThan(0);

    const s = (await readV4(page)).samples;
    const support = s.filter((x) => x.motion === 'support');
    expect(support.length, 'the support beat was sampled').toBeGreaterThan(10);

    // ① THE SOURCES AND THE DESTINATIONS ARE VISIBLE FOR THE WHOLE BEAT — the tiles carry the sockets.
    const bad = tileFailures(support);
    expect(bad.length, `every tile (and so every socket) is visible for the whole beat (${bad[0] ?? '—'})`).toBe(0);
    const noSupply = support.filter((f) => f.supply === undefined);
    expect(noSupply.length, 'the neutral supply — the source of the absent parties\' cubes — is on screen').toBe(0);

    // ② EVERY CUBE CAME FROM A PLACE, LANDED IN A SOCKET, AND TRAVELLED BETWEEN THEM.
    const firstSeen = new Map<string, {x: number, y: number, at: number}>();
    const lastSeen = new Map<string, {x: number, y: number}>();
    support.forEach((f, i) => f.flights.forEach((fl) => {
      if (!fl.shown || fl.body !== 'cube') {
        return;
      }
      if (!firstSeen.has(fl.id)) {
        firstSeen.set(fl.id, {x: fl.x, y: fl.y, at: i});
      }
      lastSeen.set(fl.id, {x: fl.x, y: fl.y});
    }));
    expect(firstSeen.size, 'cubes flew for the support beat').toBeGreaterThan(0);
    const strays: Array<string> = [];
    for (const [id, birth] of firstSeen) {
      const frame = support[birth.at];
      const places = [frame.supply, ...Object.values(frame.cards), ...Object.values(frame.ribbons)];
      if (!places.some((r) => inside(birth, r, 26))) {
        strays.push(`${id} was born at (${birth.x.toFixed(0)}, ${birth.y.toFixed(0)}) — no place it could have come from`);
      }
      const end = lastSeen.get(id);
      const sockets = Object.values(support[support.length - 1].sockets);
      if (end !== undefined && !sockets.some((r) => inside(end, r, 34)) && !inside(end, frame.supply, 34)) {
        strays.push(`${id} ended at (${end.x.toFixed(0)}, ${end.y.toFixed(0)}) — in no socket and not back in the supply`);
      }
      if (travelOf(support, id) < 24) {
        strays.push(`${id} never travelled (${travelOf(support, id).toFixed(0)} px of path)`);
      }
    }
    expect(strays.length, `every cube came from a visible place, travelled and landed in a visible socket (${strays[0] ?? '—'})`).toBe(0);

    // ③ THE COUNTS ARE THE SERVER'S OWN.
    const rest = s[s.length - 1];
    for (const entry of record) {
      expect(rest.support[entry.party], `${entry.party} shows the server's own total (${entry.total})`).toBe(Math.min(3, entry.total));
    }
    // …and a socket answered its own touchdown (the one-shot, on contact).
    expect(support.some((f) => f.landed > 0), 'a socket answered a landing').toBe(true);
    await shoot(page, '03-support-rest');
  });

  test('Г-П3 · ПРИНЯТИЕ: обмен плиток ФИЗИЧЕСКИЙ — оба объекта видны всю дорогу, и ни в одном кадре содержимое слота не менялось без движения', async ({page, request}) => {
    test.setTimeout(300_000);
    const {seats} = await openSitting(page, request, 'parliament-architecture-assembly', '&consoleProfile=auto');
    await armV4Probe(page);
    await runWalk(page, request, seats[1]);

    const s = (await readV4(page)).samples;
    const first = s[0];
    const rest = s[s.length - 1];
    expect(first.rulerSlotParty, 'the Greens ruled at the verdict').toBe('Greens');
    expect(rest.rulerSlotParty, 'Mars First rules at rest').toBe('Mars First');

    // ① THE SLOT'S CONTENT CHANGES ONCE, AND AT THAT FRAME THE ARRIVING TILE IS STILL AT ITS OLD PLACE —
    //    that is what makes the change a MOVE and not a substitution.
    const swapAt = s.findIndex((x) => x.rulerSlotParty === 'Mars First');
    expect(swapAt, 'the slot changed hands during the sampled walk').toBeGreaterThan(0);
    const centreOf = (f: V4Sample, party: string): {x: number, y: number} | undefined => {
      const t = f.tiles.find((x) => x.party === party);
      return t === undefined ? undefined : {x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.h / 2};
    };
    const riserHome = centreOf(s[swapAt - 1], 'Mars First');
    const riserAtSwap = centreOf(s[swapAt], 'Mars First');
    const riserEnd = centreOf(rest, 'Mars First');
    expect(riserHome, 'the rising tile was on screen before the swap').not.toBeUndefined();
    expect(riserAtSwap, 'the rising tile was on screen at the swap').not.toBeUndefined();
    expect(riserEnd, 'the rising tile is on screen at rest').not.toBeUndefined();
    const trip = Math.hypot(riserEnd!.x - riserHome!.x, riserEnd!.y - riserHome!.y);
    expect(trip, 'the two places are genuinely apart (the swap has a distance to cover)').toBeGreaterThan(40);
    const jump = Math.hypot(riserAtSwap!.x - riserHome!.x, riserAtSwap!.y - riserHome!.y);
    expect(jump, `at the frame the slot changed, the tile was still at its old place (moved ${jump.toFixed(0)} of ${trip.toFixed(0)} px)`).toBeLessThan(trip * 0.5);

    // ② BOTH TILES PAINTED THE WHOLE WAY: intermediate positions, not a single jump — and visible throughout.
    const between = (party: string): number => {
      const home = centreOf(s[Math.max(0, swapAt - 1)], party);
      const end = centreOf(rest, party);
      if (home === undefined || end === undefined) {
        return 0;
      }
      return s.slice(swapAt, Math.min(s.length, swapAt + 80)).filter((f) => {
        const c = centreOf(f, party);
        return c !== undefined && Math.hypot(c.x - home.x, c.y - home.y) > 8 && Math.hypot(c.x - end.x, c.y - end.y) > 8;
      }).length;
    };
    expect(between('Mars First'), 'the rising tile painted intermediate positions (never one frame)').toBeGreaterThanOrEqual(3);
    expect(between('Greens'), 'the descending tile painted intermediate positions too').toBeGreaterThanOrEqual(3);
    const window = s.slice(Math.max(0, swapAt - 2), Math.min(s.length, swapAt + 80));
    const bad = tileFailures(window.filter((f) => TABLE_MOTIONS.includes(f.motion)));
    expect(bad.length, `both objects stayed visible for the whole swap (${bad[0] ?? '—'})`).toBe(0);

    // ③ THE TILE IN THE GOVERNMENT SHOWS THE GOVERNMENT'S STATE (§2.5): no access counter in the ruler's place.
    const counters = await page.locator('[data-parl-ruler-slot] .con-pseal__places').count();
    expect(counters, 'the ruler\'s tile carries no delegate-access counter — that is an opposition tile\'s state').toBe(0);
    await shoot(page, '04-swap-rest');
  });

  test('Г-П5 · ЧТЕНИЕ приходит ПОСЛЕ стола: панели нет ни в одном физическом кадре, и она разворачивается на месте ряда', async ({page, request}) => {
    test.setTimeout(300_000);
    const {seats} = await openSitting(page, request, 'parliament-architecture-assembly', '&consoleProfile=auto');
    await armV4Probe(page);
    await runWalk(page, request, seats[1]);

    const s = (await readV4(page)).samples;
    // ① NOT ONE FRAME of the physical beats (nor of the results' physical part) has a reading panel.
    const physical = s.filter((x) => TABLE_MOTIONS.includes(x.motion) || (x.stage === 'results' && x.resultsHidden));
    expect(physical.length, 'the physical part was sampled').toBeGreaterThan(20);
    const leaked = physical.filter((x) => x.reading && x.readingInk > 0.02);
    expect(leaked.length, `no reading panel exists while anything is moving on the table (${leaked.length} frames; first at ${leaked[0]?.motion || leaked[0]?.stage})`).toBe(0);

    // ② WHEN IT COMES, IT COMES FROM THE ROW'S OWN RECT and takes its place.
    const upAt = s.findIndex((x) => x.reading && x.readingRect !== undefined);
    expect(upAt, 'a reading panel did stand (the reward / the results card)').toBeGreaterThan(0);
    const rowRect = s[Math.max(0, upAt - 1)].rowRect;
    expect(rowRect, 'the row was measurable right before the handoff').not.toBeUndefined();
    const born = s[upAt].readingRect!;
    const overlapWith = (a: Rect, b: Rect): number => {
      const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return (x * y) / (a.w * a.h);
    };
    expect(overlapWith(born, rowRect!), 'the panel unfolds INSIDE the rect the row occupied').toBeGreaterThan(0.6);

    // ③ AND THE HANDOFF IS A MOTION, not a swap: the panel's ink climbs over frames inside the budget.
    const inkWindow = s.slice(upAt).filter((x) => x.reading);
    const settledAt = inkWindow.findIndex((x) => x.readingInk > 0.98);
    expect(settledAt, 'the panel reached full ink').toBeGreaterThanOrEqual(0);
    const rising = inkWindow.slice(0, Math.max(1, settledAt)).filter((x) => x.readingInk > 0.02 && x.readingInk < 0.98).length;
    const took = Math.round(inkWindow[Math.max(0, settledAt)].t - inkWindow[0].t);
    // eslint-disable-next-line no-console
    console.log(`[v4] table → reading: ${took}ms over ${rising} partial frames`);
    expect(rising, 'the panel faded in over several frames (a v-if swap is a blink)').toBeGreaterThanOrEqual(2);
    expect(took, 'the handoff is inside the 0.3–0.4 s budget (with the sampler\'s slack)').toBeLessThan(700);

    // ④ …AND THE ROW RECEDED rather than being cut: it is still in the DOM, parked, with its ink gone.
    const parked = s[s.length - 1];
    if (parked.reading) {
      expect(parked.rowRect, 'the row is still laid out (it receded, it was not removed)').not.toBeUndefined();
      expect(parked.rowShown, 'the parked row no longer claims to be shown').toBe(false);
    }
    await shoot(page, '05-reading');
  });
});

/**
 * Г-П4 · GEOMETRY — the government's own box, on every profile: the enacted face inside its block in EVERY
 * state, the ruler's header never cut, and the ruler block's height independent of who is standing in it
 * (measured across the change of government, which is the only way one run sees two parties in that slot).
 */
for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`«Заседание v4» — геометрия правительства (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('Г-П4: карта внутри блока, шапка не обрезана, высота блока правителя не зависит от партии', async ({page, request}) => {
      test.setTimeout(300_000);
      const {seats} = await openSitting(page, request, 'parliament-architecture-assembly', preset.query);
      await armV4Probe(page);
      const atVerdict = (await readV4(page)).samples.slice(-1)[0];
      await shoot(page, `06-geometry-${preset.id}-verdict`);
      await runWalk(page, request, seats[1]);
      const s = (await readV4(page)).samples;
      const rest = s[s.length - 1];
      await shoot(page, `07-geometry-${preset.id}-rest`);

      // ① THE ENACTED FACE IS INSIDE ITS BLOCK — in every sampled frame, not only at rest (the block below it
      //    is the chairman's quest, and the card used to paint over its head when the quest grew).
      const spills = s.filter((f) => f.govCard !== undefined && f.ruling !== undefined &&
        (f.govCard.y + f.govCard.h > f.ruling.y + f.ruling.h + 1.5 || f.govCard.x + f.govCard.w > f.ruling.x + f.ruling.w + 1.5));
      const worst = spills.map((f) => (f.govCard!.y + f.govCard!.h) - (f.ruling!.y + f.ruling!.h)).sort((a, b) => b - a)[0];
      expect(spills.length, `the enacted face never leaves its block (${spills.length} of ${s.length} frames, worst ${worst?.toFixed(1) ?? 0} px over)`).toBe(0);

      // ② THE QUEST'S BOX DOES NOT CHANGE SIZE ACROSS THE GOVERNMENT'S CHANGE — that is WHY ① holds: the card's
      //    zoom is solved against the room this block leaves, and the race is now always rendered.
      expect(atVerdict.quest, 'the quest stood at the verdict').not.toBeUndefined();
      expect(rest.quest, 'the quest stands at rest').not.toBeUndefined();
      expect(Math.abs(rest.quest!.h - atVerdict.quest!.h), `the quest keeps its height through the sitting (${atVerdict.quest!.h.toFixed(1)} → ${rest.quest!.h.toFixed(1)})`).toBeLessThan(2);

      // ③ THE RULER'S HEADER IS NEVER TRUNCATED (its own box, its own ellipsis — `scrollWidth` tells on it).
      const cut = s.filter((f) => f.kicker !== undefined && f.kicker.sw > f.kicker.w + 1);
      expect(cut.length, `«${rest.kicker?.text ?? ''}» fits its block on ${preset.id} (${cut[0]?.kicker?.sw ?? 0} > ${cut[0]?.kicker?.w ?? 0})`).toBe(0);

      // ④ THE RULER BLOCK'S HEIGHT IS PARTY-INDEPENDENT: the same box before and after the change of government,
      //    and its slot is the row's own tile box (ONE measured token for all six).
      expect(Math.abs(rest.rulerBox!.h - atVerdict.rulerBox!.h), `the ruler block keeps its height across the change (${atVerdict.rulerBox!.h.toFixed(1)} → ${rest.rulerBox!.h.toFixed(1)})`).toBeLessThan(2);
      const rowTile = rest.tiles.find((t) => t.where === 'row');
      const rulerTile = rest.tiles.find((t) => t.where === 'ruler');
      expect(rowTile, 'the row has tiles').not.toBeUndefined();
      expect(rulerTile, 'the ruler\'s slot has its tile').not.toBeUndefined();
      expect(Math.abs(rulerTile!.rect.h - rowTile!.rect.h), `one tile box for the row and the government (${rowTile!.rect.h.toFixed(1)} vs ${rulerTile!.rect.h.toFixed(1)})`).toBeLessThan(2);
      expect(Math.abs(rulerTile!.rect.w - rowTile!.rect.w), `…and one width (${rowTile!.rect.w.toFixed(1)} vs ${rulerTile!.rect.w.toFixed(1)})`).toBeLessThan(2);
    });
  });
}
