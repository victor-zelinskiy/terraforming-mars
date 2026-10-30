import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, commitFocusedSpace, fetchPlayerModel, placementState, press, sendPlayerInput, settle, walkToSpace} from './consoleStart';

/**
 * THE TILE LANGUAGE (the owner's decisions of 2026-10-20 — W1 · W2/W3/W4 · W6 · W7; contract
 * `docs/claude/console/board-placement-flow.md` § THE TILE LANGUAGE) — every landing of the board's tile language on ONE
 * table (fixture `tile-language`: blue on the move, red driven over the API), fhd + tv4k:
 *
 *   A · BLUE'S CITY (the City standard project): the place the player locked does NOT let go — the reticle stands on the
 *       cell as the landing marker while the tile flies in from the table edge, and lets go at the CONTACT; the city
 *       lands with its dust.
 *   B · BLUE'S GREENERY for 8 plants: the tile GROWS out of its cell (never fetched from the table); what the landing
 *       pays is ONE wave (several tokens in the air together); the scales' story starts WITH the camera's pullback.
 *   C · RED'S CITY: the remote tile is born WHOLE under red's chip and dives — no frame of its flight behind the screen's
 *       top edge; a beacon in red's colour gathers on the cell before the touchdown; the cell's printed bonus flies to
 *       red's chip.
 *   D · RED'S OCEAN: the water answers the contact with its splash.
 *
 * The probe is `setInterval` + `MutationObserver` — never rAF. Screens under screenshots/tile-language/<profile>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'tile-language');
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type WireSpace = {id: string, x: number, y: number, tileType?: number, color?: string, bonus?: Array<number>};
type WireOption = {type: string, title?: string | {message: string}, cards?: Array<{name: string, calculatedCost?: number}>, spaces?: Array<string>};
type Wire = {
  thisPlayer: {color: string},
  game: {spaces?: Array<WireSpace>},
  waitingFor?: {type: string, spaces?: Array<string>, options?: Array<WireOption>},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/** The legal cell with the most printed bonus icons, nearest the board's centre on a tie — a cell whose payout is seen. */
function richCell(w: Wire, legal: ReadonlyArray<string>, avoid: ReadonlySet<string>): string {
  const spaces = new Map((w.game.spaces ?? []).map((s) => [s.id, s]));
  const scored = legal.filter((id) => !avoid.has(id)).map((id) => {
    const s = spaces.get(id);
    return {id, n: s?.bonus?.length ?? 0, d: Math.abs((s?.x ?? 4) - 4) + Math.abs((s?.y ?? 4) - 4)};
  });
  scored.sort((a, b) => b.n - a.n || a.d - b.d || a.id.localeCompare(b.id));
  expect(scored.length, 'a legal cell to land on').toBeGreaterThan(0);
  return scored[0].id;
}

type Box = {x: number, y: number, w: number, h: number, o: number};
type Sample = {
  t: number,
  /** The reticle's landing marker (the cell it holds) — `null` when no marker stands. */
  marker: string | null,
  own: Box | null, remote: Box | null,
  beacon: {o: number, color: string} | null,
  /** The strongest dust mote / splash ring (effective opacity) — the contact by kind. */
  dust: number, splash: number,
  /** The contact's STAGE by kind — the dust / splash box the director WAKES in the frame of contact (`playStackDust` /
   *  `playCoverSplash` set it visible synchronously). The motes and the ring are a 230–460 ms transient a starved 4K
   *  SwiftShader frame can skip whole (CI 2026-10-30: no mote ever above 0.1); the wake is the product's decision. */
  dustBox: number, splashBox: number,
  chips: Array<{x: number, y: number}>,
  board: string,
  /** The oxygen cursor's resting value (`~` while it travels). */
  oxy: string,
  /** The watched cell paints its committed tile, and its rect. */
  painted: boolean, cell: Box | null,
  /** The acting seat's chip in the status strip. */
  chip: Box | null,
};
type Probe = {samples: Array<Sample>, stop: () => void};

async function armProbe(page: Page, watch: {cell: string, seat?: string}): Promise<void> {
  await page.evaluate((c) => {
    const w = window as unknown as {__tlProbe?: Probe};
    w.__tlProbe?.stop();
    const t0 = performance.now();
    const op = (el: Element | null): number => {
      let o = 1;
      for (let e: Element | null = el; e !== null && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          return 0;
        }
        o *= Number(cs.opacity);
      }
      return Math.round(o * 100) / 100;
    };
    const box = (el: Element | null): Box | null => {
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {x: r.left, y: r.top, w: r.width, h: r.height, o: op(el)};
    };
    const strongest = (sel: string) => Math.max(0, ...[...document.querySelectorAll(sel)].map(op));
    const samples: Array<Sample> = [];
    const sample = () => {
      const cell = document.querySelector(`.board-space[data_space_id="${c.cell}"]`);
      const tile = cell?.querySelector('[class*="board-space-tile--"]') ?? null;
      const beacon = document.querySelector<HTMLElement>('.con-tileplace__beacon');
      samples.push({
        t: Math.round(performance.now() - t0),
        // HELD = standing and NOT leaving: a `<transition>` keeps the leaving element's last attributes until its
        // `transitionend`, which a starved renderer delivers hundreds of ms after the 70–140 ms fade (CI: «held 294 ms»,
        // box: 312 / 396) — the let-go is the leave's START, the product's own edge.
        marker: document.querySelector('.con-bcur[data-landing-marker]:not(.con-bcur-out-leave-active)')?.getAttribute('data-landing-marker') ?? null,
        own: box(document.querySelector('.con-tileplace__tile:not(.con-tileplace__tile--remote):not(.con-tileplace__tile--depart):not(.con-tileplace__tile--cover)')),
        remote: box(document.querySelector('.con-tileplace__tile--remote')),
        beacon: beacon === null ? null : {o: op(beacon), color: beacon.dataset.beaconColor ?? ''},
        dust: strongest('.con-tileplace__dust-mote'),
        splash: strongest('.con-tileplace__splash-ring'),
        dustBox: strongest('.con-tileplace__dust'),
        splashBox: strongest('.con-tileplace__splash'),
        chips: [...document.querySelectorAll<HTMLElement>('.con-transfer__chip')].filter((el) => el.style.transform !== '' && op(el) > 0.05)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {x: r.left + r.width / 2, y: r.top + r.height / 2};
          }),
        board: (document.querySelector('.con-board')?.getAttribute('class') ?? '').split(' ').filter((k) => /pfocus|placing/.test(k)).join(' '),
        oxy: document.querySelector<HTMLElement>('.scale-marker[data-scale-marker="oxygen"]')?.dataset.scaleMarkerAt ?? '~',
        painted: tile !== null && !tile.classList.contains('board-space-tile--placement-cleared') && op(tile) > 0.5,
        cell: box(cell),
        chip: c.seat === undefined ? null : box(document.querySelector(`.con-status__player .player_bg_color_${c.seat}`)),
      });
      if (samples.length > 20000) {
        samples.splice(0, 4000);
      }
    };
    const timer = window.setInterval(sample, 12);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-scale-marker-at']});
    w.__tlProbe = {samples, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  }, watch);
}

const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__tlProbe: Probe}).__tlProbe.samples);
const stopProbe = (page: Page) => page.evaluate(() => (window as unknown as {__tlProbe?: Probe}).__tlProbe?.stop());

/** The scene is over: the cell paints its tile, nothing flies, no hold stands. */
async function waitSceneOver(page: Page, what: string): Promise<void> {
  await expect.poll(async () => {
    const samples = await readProbe(page);
    const last = samples[samples.length - 1];
    return last !== undefined && last.painted && last.own === null && (last.remote === null || last.remote.o === 0) && last.chips.length === 0;
  }, {timeout: 45_000, message: `${what}: the tile stands and nothing is in the air`}).toBe(true);
  await settle(page, {timeoutMs: 30_000});
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

async function awaitMenu(request: APIRequestContext, id: string): Promise<NonNullable<Wire['waitingFor']>> {
  await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 60_000, message: 'the action menu stands'}).toBe('or');
  return (await wireOf(request, id)).waitingFor!;
}

/** A standard project picked over the API (the menu's own option) — its board placement is what the scene is about. */
async function pickProject(request: APIRequestContext, id: string, project: string): Promise<Array<string>> {
  const menu = await awaitMenu(request, id);
  const idx = (menu.options ?? []).findIndex((o) => o.type === 'projectCard' && (o.cards ?? []).some((c) => c.name === project));
  expect(idx, `the menu offers ${project}`).toBeGreaterThanOrEqual(0);
  const card = (menu.options?.[idx].cards ?? []).find((c) => c.name === project);
  await sendPlayerInput(request, id, {type: 'or', index: idx, response: {type: 'projectCard', card: project, payment: {...NO_PAYMENT, megacredits: card?.calculatedCost ?? 0}}});
  await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 20_000, message: `${project} asks for its cell`}).toBe('space');
  return (await wireOf(request, id)).waitingFor?.spaces ?? [];
}

for (const preset of PRESETS) {
  test.describe(`the tile language · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test(`the marker holds the place, the contact speaks by kind, a greenery grows, one wave, the story with the pullback; another seat's tile from its chip (${preset.id})`, async ({page, request}) => {
      test.setTimeout(600_000);
      const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'tile-language', {query: preset.query});
      const red = seats.find((s) => s !== blue)!;
      const redColor = (await wireOf(request, red)).thisPlayer.color;
      const placed = new Set<string>();

      // ════════ A · BLUE'S CITY — the marker holds the place until the contact; the city lands with its dust ════════
      {
        await openStandardProject(page, 'City');
        await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the board is live'}).not.toBe('none');
        await settle(page, {timeoutMs: 20_000});
        const ask = (await wireOf(request, blue)).waitingFor;
        const legal = ask?.type === 'space' ? ask.spaces ?? [] : (ask?.options ?? []).find((o) => o.type === 'space')?.spaces ?? [];
        const cell = richCell(await wireOf(request, blue), legal, placed);
        placed.add(cell);
        await walkToSpace(page, cell);
        await settle(page, {timeoutMs: 15_000});
        await armProbe(page, {cell});
        expect(await commitFocusedSpace(page, 0), 'the city committed').toBe(true);
        await waitSceneOver(page, 'A');
        const s = await readProbe(page);
        await stopProbe(page);
        const flying = s.filter((x) => x.own !== null && x.own.o > 0.05);
        expect(flying.length, 'the city flew in').toBeGreaterThan(0);
        expect(flying.some((x) => x.marker === cell), 'W1: the marker holds the cell WHILE the tile is in the air').toBe(true);
        const contact = s.findIndex((x) => x.dustBox > 0.5 || x.dust > 0.1);
        expect(contact, `W7: the city lands with its dust (the strongest mote painted: ${Math.max(0, ...s.map((x) => x.dust))})`).toBeGreaterThanOrEqual(0);
        const lastMarker = s.map((x) => x.marker !== null).lastIndexOf(true);
        expect(s[lastMarker].t - s[contact].t, `W1: the marker lets go AT the contact (its leave fade only) — held ${s[lastMarker].t - s[contact].t} ms past it`)
          .toBeLessThanOrEqual(260);
        await shoot(page, preset.id, 'A-city');
      }

      // ════════ B · BLUE'S GREENERY for 8 plants — it grows, one wave, the scales' story with the pullback ════════
      {
        await awaitMenu(request, blue);
        await settle(page, {timeoutMs: 20_000});
        await press(page, 'Comma', 900);
        const slot = page.locator('[data-quick-id="convertPlants"]');
        await expect(slot, 'the wheel offers the plant conversion').toHaveCount(1, {timeout: 15_000});
        await expect(slot, 'the conversion is live (16 plants)').not.toHaveClass(/con-quick__slot--disabled/);
        await press(page, 'ArrowLeft', 900);
        await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the greenery\'s board is live'}).not.toBe('none');
        await settle(page, {timeoutMs: 20_000});
        const w = await wireOf(request, blue);
        const nested = (w.waitingFor?.options ?? []).find((o) => o.type === 'space');
        const legal = w.waitingFor?.type === 'space' ? w.waitingFor.spaces ?? [] : nested?.spaces ?? [];
        const cell = richCell(w, legal, placed);
        placed.add(cell);
        await walkToSpace(page, cell);
        await settle(page, {timeoutMs: 15_000});
        const oxygenBefore = (await readOxygen(page)) ?? '0';
        await armProbe(page, {cell});
        expect(await commitFocusedSpace(page, 0), 'the greenery committed').toBe(true);
        await waitSceneOver(page, 'B');
        // …and the scales' story has been told: the oxygen cursor rests on its new division.
        await expect.poll(async () => {
          const samples = await readProbe(page);
          const last = samples[samples.length - 1];
          return last.oxy !== '~' && last.oxy !== oxygenBefore && last.chips.length === 0 && !/pfocus/.test(last.board);
        }, {timeout: 30_000, message: 'the oxygen cursor rests on its new division'}).toBe(true);
        const s = await readProbe(page);
        await stopProbe(page);
        // W7: GROWN out of the cell — the tile's first visible frame stands on its own hex, never at the table edge.
        const born = s.find((x) => x.own !== null && x.own.o > 0.05);
        expect(born, 'the greenery appeared').toBeDefined();
        const hex = born!.cell!;
        const dist = Math.hypot(born!.own!.x + born!.own!.w / 2 - (hex.x + hex.w / 2), born!.own!.y + born!.own!.h / 2 - (hex.y + hex.h / 2));
        expect(dist, `W7: born ON its cell (${Math.round(dist)} px off the hex centre)`).toBeLessThan(hex.w * 0.35);
        // W6: ONE WAVE — what the landing pays is in the air TOGETHER (the cell's bonus and the greenery's point).
        const landed = s.findIndex((x) => x.own === null && x.painted);
        const wave = s.slice(Math.max(0, landed));
        expect(Math.max(0, ...wave.map((x) => x.chips.length)), 'W6: several of the landing\'s tokens in the air at once').toBeGreaterThanOrEqual(2);
        // W6: the scales' story starts WITH the pullback — the oxygen cursor leaves its division while the camera still lands.
        const glideStart = s.findIndex((x) => x.oxy === '~');
        expect(glideStart, 'the oxygen cursor glided').toBeGreaterThanOrEqual(0);
        expect(s[glideStart].board, 'W6: the glide starts inside the camera\'s exit').toMatch(/pfocus-exit|pfocus-anim/);
        const end = s.map((x) => x.oxy !== '~' && x.oxy !== oxygenBefore && x.chips.length === 0 && !/pfocus/.test(x.board)).indexOf(true);
        console.log(`[tile-language ${preset.id}] greenery: commit → the story told ${s[end]?.t ?? -1} ms (glide at ${s[glideStart].t} ms)`);
        await shoot(page, preset.id, 'B-greenery');
      }

      // ════════ C · RED'S CITY — born whole under red's chip, dives, a beacon in red's colour, the bonus to the chip ════════
      {
        const legal = await pickProjectCellsAhead(request, red, 'City');
        const cell = richCell(await wireOf(request, red), legal, placed);
        placed.add(cell);
        await armProbe(page, {cell, seat: redColor});
        await sendPlayerInput(request, red, {type: 'space', spaceId: cell});
        await waitSceneOver(page, 'C');
        const s = await readProbe(page);
        await stopProbe(page);
        const air = s.filter((x) => x.remote !== null && x.remote.o > 0.05);
        expect(air.length, 'the remote city flew').toBeGreaterThan(0);
        expect(air.filter((x) => x.remote!.y < -1).length, 'W2: no frame of the flight behind the screen\'s top edge').toBe(0);
        const first = air[0];
        const chip = first.chip;
        expect(chip, 'red\'s chip stands in the strip').not.toBeNull();
        expect(Math.abs(first.remote!.x + first.remote!.w / 2 - (chip!.x + chip!.w / 2)), 'W2: born under red\'s chip').toBeLessThan(first.remote!.w);
        expect(first.remote!.y, 'W2: born BELOW the chip — whole, never cut by the strip').toBeGreaterThanOrEqual(chip!.y + chip!.h / 2 - 2);
        const paintedAt = s.findIndex((x) => x.painted);
        expect(s.slice(0, paintedAt).some((x) => x.beacon !== null && x.beacon.o > 0.1 && x.beacon.color === redColor),
          'W4: a beacon in red\'s colour gathers on the cell before the touchdown').toBe(true);
        // W3: the cell's printed bonus flies to red's chip (the richest legal cell prints at least one icon).
        const bonus = (await wireOf(request, blue)).game.spaces?.find((x) => x.id === cell)?.bonus ?? [];
        if (bonus.length > 0) {
          const tail = s.slice(paintedAt).filter((x) => x.chips.length > 0);
          expect(tail.length, 'W3: the cell\'s bonus flies after the touchdown').toBeGreaterThan(0);
          const last = tail[tail.length - 1];
          const target = {x: chip!.x + chip!.w / 2, y: chip!.y + chip!.h};
          expect(Math.min(...last.chips.map((c) => Math.hypot(c.x - target.x, c.y - target.y))), 'W3: …and lands at red\'s chip').toBeLessThan(chip!.w * 3 + 60);
        }
        await shoot(page, preset.id, 'C-remote-city');
      }

      // ════════ D · RED'S OCEAN — the water answers the contact ════════
      {
        const legal = await pickProjectCellsAhead(request, red, 'Aquifer');
        const cell = richCell(await wireOf(request, red), legal, placed);
        placed.add(cell);
        await armProbe(page, {cell, seat: redColor});
        await sendPlayerInput(request, red, {type: 'space', spaceId: cell});
        await waitSceneOver(page, 'D');
        const s = await readProbe(page);
        await stopProbe(page);
        expect(s.some((x) => x.remote !== null && x.remote.o > 0.05), 'the remote ocean flew').toBe(true);
        expect(s.some((x) => x.splashBox > 0.5 || x.splash > 0.1),
          `W7: the ocean lands with its splash (the strongest ring painted: ${Math.max(0, ...s.map((x) => x.splash))})`).toBe(true);
        await shoot(page, preset.id, 'D-remote-ocean');
      }
    });
  });
}

/**
 * The wheel's centre (LT → «СТАНДАРТНЫЕ ПРОЕКТЫ»), then the cursor steered GEOMETRICALLY onto the named project's card
 * (the screen is a grid: each press goes toward the target's rect), then A — the board opens on the project's cell.
 */
async function openStandardProject(page: Page, card: string): Promise<void> {
  await press(page, 'Comma', 900);
  await expect(page.locator('.con-quick'), 'the wheel is open').toBeVisible({timeout: 15_000});
  await press(page, 'Enter', 1200);
  await expect(page.locator('.con-stdp'), 'the standard projects stand').toBeVisible({timeout: 15_000});
  let hit = false;
  for (let i = 0; i < 16 && !hit; i++) {
    const step = await page.evaluate((c) => {
      const at = document.querySelector('.con-stdp__card--focused');
      const target = document.querySelector(`.con-stdp__card[data-stdp-card="${c}"]`);
      if (at === null || target === null) {
        return 'none';
      }
      if (at === target) {
        return 'hit';
      }
      const a = at.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      return Math.abs(dy) > a.height / 2 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    }, card);
    expect(step, `the ${card} card stands on the screen`).not.toBe('none');
    hit = step === 'hit';
    if (!hit) {
      await press(page, step, 280);
    }
  }
  expect(hit, `the cursor reached ${card}`).toBe(true);
  await press(page, 'Enter', 900);
}

/** The oxygen cursor's resting value right now. */
async function readOxygen(page: Page): Promise<string | undefined> {
  return await page.evaluate(() => document.querySelector<HTMLElement>('.scale-marker[data-scale-marker="oxygen"]')?.dataset.scaleMarkerAt);
}

/** Red's project picked, its cells read — the CELL is sent once the probe is armed (the landing is the scene). */
async function pickProjectCellsAhead(request: APIRequestContext, id: string, project: string): Promise<Array<string>> {
  return await pickProject(request, id, project);
}
