import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, cinematicBeat, commitFocusedSpace, fetchPlayerModel, press, pressUntil, settle,
  walkToSpace,
} from './consoleStart';

/**
 * FORESTRY SUPPORT (Turmoil Redux, RX11) — the law that INTRODUCES an adjacency
 * bonus the engine has no notion of: every greenery beside the tile you place
 * pays you 2 M€ and 1 plant. Its exact relative is the OCEAN adjacency, and the
 * whole point of the iteration is that the new bonus is that bonus's TWIN on
 * every layer — so this journey checks the twin where the player meets it.
 *
 * ONE e2e on ONE profile (the card's verification budget). The card stands
 * ENACTED (fixture `parliament-forestry-enacted`: red opens generation 2 with
 * 30 M€, and TWO of BLUE's greeneries stand around one quiet legal cell — any
 * owner's grove pays, exactly as any owner's ocean does). The viewer builds a
 * standard-project CITY there (a city, not a greenery: a greenery would step
 * the oxygen — a TR step the ruling Greens pay 2 M€ for — and advance the
 * card's own chairman quest, two other flows over the one under test), and the
 * journey asserts the four things the owner asked to see:
 *   ① the cell's DOSSIER promises the law's +4 M€ and +2 plants BEFORE the
 *     commit, under the resolution's own name (the preview↔commit law, at the
 *     surface the player reads it on);
 *   ② the commit plays the LAW'S WAVE (`data-law-wave`) with TWO grove pulses
 *     and FOUR chips — a coin AND a plant per grove — every one of them born
 *     INSIDE its own VISIBLE grove hex, never in the middle of the screen;
 *   ③ the chips travel and the RAIL counters tick: plants +2, and the M€ pass
 *     THROUGH the city's price on their way to «−25 + 4»;
 *   ④ the LAW's own card: the viewer's action is suppressed, the resolution's
 *     answer to it is not — «Сработал эффект», the resolution as the source.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; the wire
 * (`/api/player`) is the truth the screen is checked against.
 * Screenshots under screenshots/parliament-forestry/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-forestry', 'standard-1080');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/**
 * A SCREENCAST RECORDER, because a `page.screenshot()` taken from Node cannot
 * be aimed at a 600 ms cinematic: the round trip that observes «the chips are
 * in flight» and the capture that follows it are two different instants, and
 * the artifact then shows the board a beat after the payout (measured — three
 * tries, three frames of a finished placement). CDP streams every painted
 * frame with its own wall-clock stamp, so the REVIEWABLE frame is chosen
 * afterwards, from the probe's own peak, instead of being raced for.
 */
type CastFrame = {wall: number, data: string};

async function recordFrames(page: Page): Promise<{frames: ReadonlyArray<CastFrame>, stop: () => Promise<void>}> {
  const frames: Array<CastFrame> = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (frame) => {
    frames.push({wall: (frame.metadata.timestamp ?? 0) * 1000, data: frame.data});
    cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {format: 'png', everyNthFrame: 1});
  return {
    frames,
    stop: async () => {
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    },
  };
}

/** Write the recorded frame nearest a moment the probe named. */
function writeFrameAt(frames: ReadonlyArray<CastFrame>, wall: number, name: string): boolean {
  let best: CastFrame | undefined;
  for (const frame of frames) {
    if (best === undefined || Math.abs(frame.wall - wall) < Math.abs(best.wall - wall)) {
      best = frame;
    }
  }
  if (best === undefined || Math.abs(best.wall - wall) > 250) {
    return false;
  }
  fs.mkdirSync(OUT_DIR, {recursive: true});
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(best.data, 'base64'));
  return true;
}

type Rect = {x: number, y: number, w: number, h: number};
type ChipSample = {kind: string, cx: number, cy: number, alpha: number};
type Sample = {
  t: number,
  /** WALL clock, so a sample can be matched against a screencast frame's own timestamp. */
  wall: number,
  src: 'mo' | 'tick',
  phase: string,
  law: boolean,
  pulses: number,
  chips: ReadonlyArray<ChipSample>,
  /** The FLYING objects: the Resource Transfer Framework's chips, which the condensed coins hand off to. */
  flights: ReadonlyArray<ChipSample>,
  mc: number | undefined,
  plants: number | undefined,
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the commit. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__forestryProbe: Probe};
    const probe: Probe = {samples: []};
    w.__forestryProbe = probe;
    const digits = (key: string): number | undefined => {
      const text = document.querySelector<HTMLElement>(`.con-res__row--${key} .con-res__digits`)?.textContent?.trim() ?? '';
      const m = text.match(/^-?\d+/);
      return m === null ? undefined : Number(m[0]);
    };
    const read = (src: 'mo' | 'tick'): void => {
      const scene = document.querySelector<HTMLElement>('.con-tileplace');
      const chips: Array<ChipSample> = [];
      document.querySelectorAll<HTMLElement>('.con-tileplace__oceancoin--megacredits, .con-tileplace__oceancoin--plants')
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) {
            return;
          }
          const css = window.getComputedStyle(el);
          chips.push({
            kind: el.className.includes('--plants') ? 'plants' : 'megacredits',
            cx: r.x + r.width / 2,
            cy: r.y + r.height / 2,
            alpha: css.visibility === 'hidden' ? 0 : Number(css.opacity),
          });
        });
      const flights: Array<ChipSample> = [];
      document.querySelectorAll<HTMLElement>('.con-transfer__chip').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          return;
        }
        const css = window.getComputedStyle(el);
        flights.push({
          kind: el.className.includes('plants') ? 'plants' : 'megacredits',
          cx: r.x + r.width / 2,
          cy: r.y + r.height / 2,
          alpha: css.visibility === 'hidden' ? 0 : Number(css.opacity),
        });
      });
      probe.samples.push({
        t: performance.now(),
        wall: Date.now(),
        src,
        phase: scene?.getAttribute('data-tile-phase') ?? '',
        law: scene?.getAttribute('data-law-wave') === '1',
        pulses: document.querySelectorAll('.con-tileplace__oceanpulse--grove').length,
        chips,
        flights,
        mc: digits('megacredits'),
        plants: digits('plants'),
      });
    };
    new MutationObserver(() => read('mo')).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => read('tick'), 40);
  });
}

const probeOf = (page: Page) => page.evaluate(() => (window as unknown as {__forestryProbe: Probe}).__forestryProbe);

/**
 * THE VISIBILITY of an object the player is told something flew out of: a
 * non-zero rect AND a non-zero effective opacity (the ancestors included — a
 * parked tier fades its children by fading itself). A source nobody can see is
 * not a source (the parliament probes' law 17, applied to the board).
 */
async function visibleRect(page: Page, selector: string): Promise<Rect | undefined> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      return undefined;
    }
    for (let node: HTMLElement | null = el; node !== null; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
        return undefined;
      }
    }
    return {x: r.x, y: r.y, w: r.width, h: r.height};
  }, selector);
}

const inside = (cx: number, cy: number, r: Rect, pad: number): boolean =>
  cx >= r.x - pad && cx <= r.x + r.w + pad && cy >= r.y - pad && cy <= r.y + r.h + pad;

type WireSpaces = {game: {spaces?: Array<{id: string, bonus: Array<number>, tileType?: number}>}, waitingFor?: {spaces?: Array<string>}};
type WireStock = {thisPlayer?: {megacredits?: number, plants?: number}};

/** Walk the standard-projects sheet until the FOCUSED card is «Город». */
async function focusCityProject(page: Page): Promise<boolean> {
  const name = () => page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
  await settle(page, {timeoutMs: 10_000, notifications: false});
  const walk = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight',
    'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i <= walk.length; i++) {
    if (/^город/i.test((await name()).trim())) {
      return true;
    }
    if (i < walk.length) {
      await press(page, walk[i], 500);
    }
  }
  return false;
}

test.describe('Forestry Support (RX11) · the groves pay, as the water does', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the dossier promises the two groves\' 4 M€ and 2 plants; the commit pays them out of the groves themselves', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-forestry-enacted');

    const before = await fetchPlayerModel(request, playerId) as WireStock;
    const mcBefore = before.thisPlayer?.megacredits ?? 0;
    const plantsBefore = before.thisPlayer?.plants ?? 0;

    // ⓪ THE EFFECTS LIST — Information → the effects zone → the explorer's Parliament strip: the LAW leads it,
    //    stated for what it is, with the card's own printed graphic (the passive's visibility, RX10's contract).
    const infoRoot = page.locator('.con-info');
    for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
      if (i > 0) {
        await press(page, 'Enter', 700);
        await press(page, 'Escape', 500);
      }
      await press(page, 'KeyY', 1100);
    }
    await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
    // The effects zone sits BELOW the actions column, so the ring walk needs the down arrow (the gallery's own
    // route — `focusInfoZone`'s generic walk never reaches it).
    const effectsFocused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
    for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
      if (await effectsFocused() > 0) {
        break;
      }
      await press(page, move, 300);
    }
    expect(await effectsFocused(), 'the effects zone takes the focus').toBeGreaterThan(0);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
    const strip = page.locator('.con-pfx');
    await expect(strip, 'the Parliament strip stands in the explorer').toHaveCount(1, {timeout: 10_000});
    const lawRow = strip.locator('.con-pfx__item').first();
    await expect(lawRow, 'the LAW leads the strip').toHaveClass(/con-pfx__item--resolution/);
    await expect(lawRow).toHaveAttribute('data-resolution', 'RDX_GREENS_FORESTRY_SUPPORT');
    await expect(lawRow.locator('.con-pfx__law'), 'said for what it is').toHaveText(/Принятая резолюция/i);
    await expect(lawRow.locator('.con-pfx__why b'), 'titled by the card').toHaveText(/Поддержка лесничества/i);
    await expect(lawRow.locator('.con-pformula__mech'), 'the card\'s own printed graphic').toHaveCount(1);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '00-effects-strip');
    for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await expect(page.locator('.con-info, .con-efx')).toHaveCount(0, {timeout: 10_000});

    // ① THE PLACEMENT — LT wheel → standard projects (the centre slot) → «Город» → pay → the board.
    await press(page, 'Comma', 1200);
    await press(page, 'Enter', 1500);
    expect(await focusCityProject(page), 'never focused «Город»').toBe(true);
    await press(page, 'Enter', 1600);
    if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
      await press(page, 'KeyX', 2600);
    }
    const panel = page.locator('.con-context');
    await expect(panel, 'a board placement is open').toContainText(/Размещение тайла/i, {timeout: 15_000});

    // The target: a LEGAL cell (the SERVER's own list — never a remembered id) that prints nothing. The fixture
    // guarantees exactly one such cell, with two greeneries and nothing else around it.
    const live = await fetchPlayerModel(request, playerId) as WireSpaces;
    const legal = new Set(live.waitingFor?.spaces ?? []);
    const byId = new Map((live.game.spaces ?? []).map((s) => [s.id, s]));
    const cellId = [...legal].find((id) => {
      const s = byId.get(id);
      return s !== undefined && s.tileType === undefined && s.bonus.length === 0;
    });
    expect(cellId, `a legal, unprinted cell (legal: ${[...legal].join(',')})`).toBeTruthy();
    await walkToSpace(page, cellId!);

    // The DOSSIER, before anything is committed: the law's own promise, under the resolution's name.
    const dossier = page.locator('.con-context');
    await expect(dossier, 'the law names itself in the dossier').toContainText(/Поддержка лесничества/i, {timeout: 15_000});
    const dossierText = await dossier.innerText();
    expect(dossierText, `the dossier promises the groves' 4 M€ (${dossierText})`).toMatch(/\+4/);
    expect(dossierText, `the dossier promises the groves' 2 plants (${dossierText})`).toMatch(/\+2/);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '01-dossier-groves');

    // ② + ③ THE WAVE — the sources and the destinations are measured (and asserted VISIBLE) BEFORE the commit.
    // The cell id is a CLASS on the hex (`board-space-XX`), not an `id` attribute — and the rect and the
    // visibility are read in ONE pass, off the element itself: a selector round trip can only re-find it.
    const groveHexes = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.board-space'))
      .filter((el) => el.querySelector('[class*="board-space-tile--greenery"]') !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        let visible = r.width > 0 && r.height > 0;
        for (let node: HTMLElement | null = el; node !== null && visible; node = node.parentElement) {
          const style = window.getComputedStyle(node);
          visible = style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
        }
        const cls = Array.from(el.classList).find((c) => /^board-space-[A-Za-z0-9_]+$/.test(c) &&
          !c.startsWith('board-space-tile') && !c.startsWith('board-space--')) ?? '';
        return {id: cls.replace(/^board-space-/, ''), x: r.x, y: r.y, w: r.width, h: r.height, visible};
      }));
    expect(groveHexes.length, 'both groves stand on the board, measurable').toBe(2);
    for (const hex of groveHexes) {
      expect(hex.visible, `the grove ${hex.id} is VISIBLE before it pays (${JSON.stringify(hex)})`).toBe(true);
    }
    expect(await visibleRect(page, '.con-res__row--megacredits'), 'the M€ rail row is visible (the destination)').toBeTruthy();
    expect(await visibleRect(page, '.con-res__row--plants'), 'the plants rail row is visible (the destination)').toBeTruthy();

    await armProbe(page);
    const cast = await recordFrames(page);
    expect(await commitFocusedSpace(page), 'the city commits on the cell between the two groves').toBe(true);

    // The frame is taken while the FLIGHT is up. The condensed coin never travels — it is a pixel-twin the
    // Resource Transfer Framework's chip takes over from, so «the coin proxy exists» is the condensation, which is
    // the shortest and dimmest part of the beat. The framework's chips are what crosses the screen.
    let travelling: ReadonlyArray<{x: number, y: number, w: number, h: number}> = [];
    for (let i = 0; i < 400 && travelling.length < 2; i++) {
      travelling = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({x: r.x, y: r.y, w: r.width, h: r.height})));
      if (travelling.length < 2) {
        await cinematicBeat(page, 40, 'polling for the law\'s payout chips in flight');
      }
    }
    expect(travelling.length, 'two payout chips were in flight at one instant').toBeGreaterThanOrEqual(2);
    await expect(page.locator('.con-tileplace[data-tile-phase]'), 'the scene finished').toHaveCount(0, {timeout: 40_000});
    await cast.stop();

    // ④ THE LAW's CARD — the viewer's own action is suppressed; the resolution's answer to it is not.
    const toast = page.locator('.con-notif[data-notif-id$=":law"]');
    await expect(toast, 'the law\'s card').toHaveCount(1, {timeout: 20_000});
    await expect(toast.locator('.con-notif__type')).toHaveText(/Сработал эффект/i);
    const source = toast.locator('.con-notif__source[data-effect-source="resolution"]');
    await expect(source, 'the source is the resolution').toHaveCount(1);
    await expect(source).toContainText(/Принятая резолюция/i);
    await expect(toast.locator('.con-notif__lawline'), 'what the law did, in its own words')
      .toContainText(/Поддержка лесничества/i);
    // …and it is THIS placement's payout, not the enactment's plants: the line counts the groves and the chips
    // carry both pools. Without this the card could be the sitting's own, replayed on boot.
    const toastText = await toast.innerText();
    expect(toastText, `the line counts the paying groves (${toastText})`).toMatch(/соседние озеленения\s*\(\s*2\s*\)/i);
    expect(toastText, `the law's own 4 M€ (${toastText})`).toMatch(/\+4/);
    expect(toastText, `the law's own 2 plants (${toastText})`).toMatch(/\+2/);
    await cinematicBeat(page, 450, 'the toast finishes its entrance before the frame is taken');
    await shoot(page, '03-law-toast');
    await settle(page, {timeoutMs: 30_000, notifications: false});

    // THE WIRE — the city cost 25, the two groves paid 4 M€ and 2 plants, and nothing else moved.
    const after = await fetchPlayerModel(request, playerId) as WireStock & WireSpaces;
    const placed = (after.game.spaces ?? []).find((s) => s.id === cellId);
    const wire = `cell ${cellId} tile=${placed?.tileType} · M€ ${mcBefore} → ${after.thisPlayer?.megacredits} · plants ${plantsBefore} → ${after.thisPlayer?.plants}`;
    expect(placed?.tileType, `the city stands on the cell (${wire})`).not.toBeUndefined();
    expect((after.thisPlayer?.megacredits ?? 0) - mcBefore, `the groves paid 4 M€ over the city's 25 (${wire})`).toBe(-21);
    expect((after.thisPlayer?.plants ?? 0) - plantsBefore, `the groves paid 2 plants (${wire})`).toBe(2);

    // THE PROBE — the wave was announced, the chips were BORN IN THE GROVES, they travelled, the counters ticked.
    const probe = await probeOf(page);
    const ticks = probe.samples.filter((s) => s.src === 'tick');
    expect(ticks.length, 'the sampler ran').toBeGreaterThan(10);
    expect(ticks.some((s) => s.law), 'the scene announced the LAW\'s wave on painted frames').toBe(true);
    expect(Math.max(...ticks.map((s) => s.pulses)), 'ONE pulse per paying grove').toBeGreaterThanOrEqual(2);
    const chipFrames = ticks.filter((s) => s.chips.length > 0);
    expect(chipFrames.length, 'the chips were painted').toBeGreaterThan(0);
    expect(Math.max(...chipFrames.map((s) => s.chips.length)), 'a coin AND a plant per grove — four chips')
      .toBeGreaterThanOrEqual(4);
    expect(chipFrames.some((s) => s.chips.some((c) => c.kind === 'plants')), 'a PLANT chip, not a recoloured coin').toBe(true);
    // BORN IN A GROVE: the chips' first painted frame puts every one of them inside one of the two grove hexes (a
    // generous pad — the chip condenses just inside the payer, and a hex is ~56 px across at 1080).
    const birth = chipFrames[0];
    const hexRects: ReadonlyArray<Rect> = groveHexes.map((h) => ({x: h.x, y: h.y, w: h.w, h: h.h}));
    for (const chip of birth.chips) {
      const home = hexRects.some((r) => inside(chip.cx, chip.cy, r, Math.max(r.w, r.h) * 0.75));
      expect(home, `the ${chip.kind} chip was born in a grove (${chip.cx.toFixed(0)},${chip.cy.toFixed(0)}) — hexes ${JSON.stringify(hexRects)}`).toBe(true);
    }
    // THE JOURNEY — from the groves to the rail, measured on the object that actually crosses the screen (the
    // framework's chip; the coin is a pixel-twin that hands off in place). Comparing one class of chip against
    // itself at two instants would compare grove A with grove B and call the gap «travel».
    const railRows = await page.evaluate(() => ['megacredits', 'plants'].map((key) => {
      const r = document.querySelector<HTMLElement>(`.con-res__row--${key}`)?.getBoundingClientRect();
      return r === undefined ? undefined : {x: r.x, y: r.y, w: r.width, h: r.height};
    }));
    const flightFrames = ticks.filter((s) => s.flights.length > 0);
    expect(flightFrames.length, 'the payout flew as the framework\'s own chips').toBeGreaterThan(0);
    const distTo = (c: ChipSample, r: Rect) => Math.hypot(c.cx - (r.x + r.w / 2), c.cy - (r.y + r.h / 2));
    const nearestGrove = (c: ChipSample) => Math.min(...hexRects.map((r) => distTo(c, r)));
    const firstFlight = flightFrames[0];
    const lastFlight = flightFrames[flightFrames.length - 1];
    const startedAtTheGroves = Math.min(...firstFlight.flights.map(nearestGrove));
    const endedAtTheRail = Math.min(...lastFlight.flights.flatMap((c) =>
      railRows.filter((r): r is Rect => r !== undefined).map((r) => distTo(c, r))));
    expect(startedAtTheGroves, `the flight started at a grove (${startedAtTheGroves.toFixed(0)} px away)`).toBeLessThan(140);
    expect(endedAtTheRail, `the flight ended at the rail (${endedAtTheRail.toFixed(0)} px away)`)
      .toBeLessThan(Math.min(...lastFlight.flights.map(nearestGrove)));

    // THE ARTIFACT — the frame the recorder already holds for the instant the probe called the peak of the
    // flight, plus the crop of the corridor the chips crossed. Chosen after the fact, never raced for.
    const peak = [...flightFrames].sort((a, b) => b.flights.length - a.flights.length ||
      Math.min(...b.flights.map(nearestGrove)) - Math.min(...a.flights.map(nearestGrove)))[0];
    expect(writeFrameAt(cast.frames, peak.wall, '02-grove-wave'),
      `a painted frame within 250 ms of the flight's peak (${cast.frames.length} frames recorded)`).toBe(true);
    // …and the frame the payout LEAVES the groves on. Deliberately not the condensation: the coin proxies exist
    // for the whole beat (born invisible) and their grains are ~7 px, so «the most coins mounted» and even «the
    // most coin opacity» both land on frames with nothing to review. The handoff's first frame is the statement.
    expect(writeFrameAt(cast.frames, firstFlight.wall, '02-grove-wave-leaving'),
      'a painted frame of the payout leaving the groves').toBe(true);
    // The coins ARE painted where they are born, even though they are small — the claim the frame cannot carry.
    const alphaOf = (s: Sample) => s.chips.reduce((sum, c) => sum + c.alpha, 0);
    expect(Math.max(...ticks.map(alphaOf)), 'the coins were painted in the groves, not merely mounted').toBeGreaterThan(0.5);
    // THE COUNTERS — read CHRONOLOGICALLY: the story is «what it showed, in order», and sorting the samples
    // would hand back the largest value the rail ever held (50 — the balance BEFORE the city was paid for).
    const series = (pick: (s: Sample) => number | undefined): ReadonlyArray<number> => {
      const out: Array<number> = [];
      for (const s of ticks) {
        const v = pick(s);
        if (v !== undefined && v !== out[out.length - 1]) {
          out.push(v);
        }
      }
      return out;
    };
    // The plants land as the law's own +2…
    const plantSeries = series((s) => s.plants);
    expect(plantSeries[plantSeries.length - 1], `the plants counter reached +2 (${plantSeries.join(' → ')})`).toBe(plantsBefore + 2);
    // …and the M€ pass THROUGH the city's price on the way to «−25 + 4»: two statements, never one summed jump.
    const mcSeries = series((s) => s.mc);
    expect(Math.min(...mcSeries), `the M€ counter paid the city first (${mcSeries.join(' → ')})`).toBeLessThanOrEqual(mcBefore - 25);
    expect(mcSeries[mcSeries.length - 1], `the M€ counter ended on the groves' payout (${mcSeries.join(' → ')})`).toBe(mcBefore - 21);
    expect(mcSeries.length, `the M€ counter ticked more than once (${mcSeries.join(' → ')})`).toBeGreaterThan(1);
  });
});
