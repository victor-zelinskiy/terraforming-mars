/*
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the card-reaction framework beyond its first owner, iteration 3 «МЕСТО ·
 * ТЕМП · НЕПРЕРЫВНОСТЬ» (`docs/claude/console/card-reaction.md`; the owner's field report of 2026-10-27).
 *
 *  MANY  · ONE PLAY WAKES FIVE REACTORS (Noctis City — a green card placing a city on the reserved area): Hartlan's
 *          answer rides the play's own rail half (attached), Tharsis' +3 M€ / +1 M€ production, Rover's +2 M€,
 *          Immigrant City's +1 M€ production and Pets' animal are the STANDALONE chain — groups in the server's order
 *          on the ONE STAGE (the centre of the central opening, a row of slots) at the quick pace, each reactor's
 *          tokens born on ITS effect row; not one delta lost; the faces never overlap, never stand in a corner.
 *  BOARD · A STANDARD PROJECT CITY wakes the same table: Tharsis Republic rises at the stage's centre at a
 *          protagonist's size, its +3 M€ born on its printed M€.
 *  RIVAL · the viewer's city wakes RED's Tharsis: on the viewer's screen the rival's card rises at the SAME stage a
 *          step smaller under a caption naming red, its token landing on red's intake plaque.
 *  SCALE · a heat → temperature step wakes Homeostasis Bureau at the stage; the step's own rating rides the marker.
 *  FIBER · A CARD WHOSE OWN ACTION WAKES ITS OWN EFFECT (Martian Fiber): the composer's hero IS the reactor — lifted in
 *          place, its effect row lit, its M€ born on ITS printed M€ — never a second instance of one card.
 *  HURRY · a press while the chain plays is a PACE, never a cut: every face still rises, nothing is summarized.
 *  SLOW  · the handheld profile under a 4× CPU throttle: every face that rises STANDS for a readable beat — never one
 *          frame (the rise starts on a painted, warmed face; the chain goes by events).
 * TIMING class (`timingSpecs.ts`): run `--exclusive --workers=1` on the box.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, commitFocusedSpace, fetchPlayerModel, focusCard, openActionFocus, openCardActions, placeTile, press, pressUntil, settle, waitForBoardHome,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 'hartlan');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const DECK = {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'} as const;
const HARTLAN = 'Hartlan Heating';
const THARSIS = 'Tharsis Republic';
const ROVER = 'Rover Construction';
const IMMIGRANT = 'Immigrant City';
const PETS = 'Pets';
const HOMEOSTASIS = 'Homeostasis Bureau';
const FIBER = 'Martian Fiber';
const NOCTIS = 'Noctis City';
/** A face at the stage is a protagonist: this share of the opening's height (`REACTION_STAGE_SHARE`) — a rival's ×0.8. */
const STAGE_SHARE = 0.34;
const RIVAL_SCALE = 0.8;

type Seat = {color: string, name: string, megacredits: number, megacreditProduction: number, heat: number, terraformRating: number, tableau: Array<{name: string, resources?: number}>};
type Wire = {
  thisPlayer: Seat,
  players: Array<Seat>,
  cardsInHand?: Array<{name: string}>,
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const animalsOn = (w: Wire, card: string): number => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
const dataOn = animalsOn;

async function shoot(page: Page, preset: {id: string}, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset.id, `${name}.png`)});
}

function writeTrail(scene: string, preset: {id: string}, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/card-reaction-${scene}-${preset.id}.txt`, trail);
}

type Box = {l: number, t: number, w: number, h: number};
type FaceSample = Box & {card: string, op: number};
type Sample = {
  t: number, phase: string, groups: string, seats: string, landed: string, summarized: string, hurried: string,
  seated: string, emerged: string, hero: string,
  /** The painted faces of the layer (opacity ≥ .3) with their boxes. */
  faces: Array<FaceSample>,
  /** The card whose own face stands LIFTED in place (`data-reaction-lifted`), if any. */
  lifted: string,
  /** An effect row lit as the WHY (`data-reaction-row`). */
  row: boolean,
  /** The central opening as the band geometry mirror publishes it. */
  opening: Box,
};

/** The reaction layer's state + the faces' geometry + the hero's phase, sampled on a task clock (never rAF). */
async function armReactionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Box = {l: number, t: number, w: number, h: number};
    type FaceSample = Box & {card: string, op: number};
    type Sample = {
      t: number, phase: string, groups: string, seats: string, landed: string, summarized: string, hurried: string,
      seated: string, emerged: string, hero: string, faces: Array<FaceSample>, lifted: string, row: boolean, opening: Box,
    };
    const w = window as unknown as {__reaction: Array<Sample>};
    w.__reaction = [];
    let last = '';
    const px = (name: string): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
    window.setInterval(() => {
      const root = document.querySelector('.con-reaction');
      const read = (a: string) => root?.getAttribute(a) ?? '';
      const faces: Array<FaceSample> = Array.from(document.querySelectorAll<HTMLElement>('.con-reaction__face[data-reaction-card]')).map((el) => {
        const r = el.getBoundingClientRect();
        return {card: el.getAttribute('data-reaction-card') ?? '', l: r.left, t: r.top, w: r.width, h: r.height, op: Number(getComputedStyle(el).opacity)};
      }).filter((f) => f.w > 4 && f.op >= 0.3);
      const liftedEl = document.querySelector<HTMLElement>('[data-reaction-lifted]');
      const lifted = liftedEl === null ? '' :
        (liftedEl.getAttribute('data-reaction-home') ?? liftedEl.getAttribute('data-composer-card') ?? liftedEl.getAttribute('data-played-key') ?? 'lifted');
      const t = px('--con-stage-t');
      const b = px('--con-stage-b');
      const l = px('--con-stage-l');
      const r = px('--con-stage-r');
      const sample: Sample = {
        t: performance.now(),
        phase: read('data-reaction-phase') || 'none',
        groups: read('data-reaction-groups'),
        seats: read('data-reaction-seats'),
        landed: read('data-reaction-landed'),
        summarized: read('data-reaction-summarized'),
        hurried: read('data-reaction-hurried'),
        seated: faces.map((f) => f.card).join('|'),
        emerged: Array.from(document.querySelectorAll('.con-recv__emerge[data-played-key]')).map((e) => e.getAttribute('data-played-key')).join('|'),
        hero: document.querySelector('.con-played-hero')?.getAttribute('data-hero-phase') ?? 'none',
        faces, lifted, row: document.querySelector('[data-reaction-row]') !== null,
        opening: {l, t, w: window.innerWidth - l - r, h: window.innerHeight - t - b},
      };
      const key = JSON.stringify({...sample, t: 0, faces: sample.faces.map((f) => ({c: f.card, l: Math.round(f.l / 8), t: Math.round(f.t / 8), op: Math.round(f.op * 4)}))});
      if (key !== last) {
        last = key;
        w.__reaction.push(sample);
      }
    }, 16);
  });
}

async function reactionProbe(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => (window as unknown as {__reaction?: Array<Sample>}).__reaction ?? []);
}

/** The chain's wall-clock: from the first `rising` sample of the standalone chain to its first `idle` after it. */
function chainWallMs(samples: ReadonlyArray<Sample>): number | undefined {
  const first = samples.findIndex((s) => s.phase === 'rising' || s.phase === 'paying');
  if (first < 0) {
    return undefined;
  }
  const idle = samples.slice(first).find((s) => s.phase === 'idle' || s.phase === 'none');
  return idle === undefined ? undefined : idle.t - samples[first].t;
}

const overlaps = (a: Box, b: Box): boolean => a.l < b.l + b.w && a.l + a.w > b.l && a.t < b.t + b.h && a.t + a.h > b.t;

/**
 * THE ONE STAGE: every painted face stands in the MIDDLE of the central opening (its centre within the central
 * 70 % × 60 % of the opening — never a corner, never beside the rail), at a protagonist's size, and two faces never
 * overlap. Returns the cards seen at the stage.
 */
function expectAtTheStage(samples: ReadonlyArray<Sample>, label: string, share = STAGE_SHARE): Set<string> {
  const seen = new Set<string>();
  const painted = samples.filter((s) => s.faces.length > 0);
  expect(painted.length, `${label}: faces were painted at the stage`).toBeGreaterThan(0);
  for (const s of painted) {
    for (const f of s.faces) {
      seen.add(f.card);
      const cx = f.l + f.w / 2;
      const cy = f.t + f.h / 2;
      const ox = s.opening.l + s.opening.w / 2;
      const oy = s.opening.t + s.opening.h / 2;
      expect(Math.abs(cx - ox), `${label}: ${f.card} stands in the middle of the opening (x) — ${JSON.stringify(f)} vs ${JSON.stringify(s.opening)}`).toBeLessThan(s.opening.w * 0.35);
      expect(Math.abs(cy - oy), `${label}: ${f.card} stands in the middle of the opening (y) — ${JSON.stringify(f)} vs ${JSON.stringify(s.opening)}`).toBeLessThan(s.opening.h * 0.3);
      // The face's PAINTED height is the seat's (the lift of the rise is a hair); a protagonist, never a corner card.
      expect(f.h / s.opening.h, `${label}: ${f.card} stands at a protagonist's size`).toBeGreaterThan(share * 0.8);
      expect(f.h / s.opening.h, `${label}: ${f.card} never taller than the stage's share`).toBeLessThan(share * 1.12);
    }
    for (let i = 0; i < s.faces.length; i++) {
      for (let j = i + 1; j < s.faces.length; j++) {
        expect(overlaps(s.faces[i], s.faces[j]), `${label}: two faces never share a box — ${s.faces[i].card} / ${s.faces[j].card}`).toBe(false);
      }
    }
  }
  return seen;
}

/**
 * EVERY FACE STANDS FOR A READABLE BEAT (the Steam Deck law): each card painted at the stage is seen in at least
 * `minSamples` samples of the task clock (≥ 50 ms apart in time) — never one frame.
 */
function expectEveryFaceStood(samples: ReadonlyArray<Sample>, label: string, minMs: number): void {
  const spans = new Map<string, {first: number, last: number, n: number}>();
  for (const s of samples) {
    for (const f of s.faces) {
      const span = spans.get(f.card);
      if (span === undefined) {
        spans.set(f.card, {first: s.t, last: s.t, n: 1});
      } else {
        span.last = s.t;
        span.n++;
      }
    }
  }
  expect(spans.size, `${label}: faces stood at the stage`).toBeGreaterThan(0);
  for (const [card, span] of spans) {
    expect(span.last - span.first, `${label}: ${card} stood for a readable beat (${span.n} samples)`).toBeGreaterThanOrEqual(minMs);
  }
}

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1400);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).first().waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/**
 * The wheel's centre (LT → «СТАНДАРТНЫЕ ПРОЕКТЫ»), then the cursor steered GEOMETRICALLY onto the named project's card
 * (the tile-language spec's road), then A — the board opens on the project's cell.
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

/** «Действия карт» → the tile of `card` focused → ACTION FOCUS (the composer's stage). */
async function openCardActionOf(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  const focusedTile = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 24 && await focusedTile() !== card; i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await focusedTile(), `the action tile of ${card} is focused`).toBe(card);
  await openActionFocus(page);
  await settle(page);
}

/** The BOARD road: a standard-project city on the first legal cell; the chain of the table's answers follows. */
async function playStandardCity(page: Page): Promise<void> {
  await openStandardProject(page, 'City');
  await expect(page.locator('.con-board--placing'), 'the city placement opened').toBeVisible({timeout: 20_000});
  expect(await commitFocusedSpace(page, 0), 'the city committed').toBe(true);
}

test.describe(`console · card reaction — one framework · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('MANY · one play wakes five reactors — the attached one out of its place, the chain on the ONE stage under the ceiling, no delta lost', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (/card-reaction|rail-reward|transfer/.test(m.text())) {
        console.log(`[page ${m.type()}] ${m.text()}`);
      }
    });
    const playerId = await bootFixture(page, request, 'card-reaction-many', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.tableau.map((c) => c.name), 'the table: Hartlan + Tharsis + Rover + Immigrant City + Pets').toEqual(
      expect.arrayContaining([HARTLAN, THARSIS, ROVER, IMMIGRANT, PETS]));

    await openPlayComposer(page, NOCTIS);
    await expect(page.locator('.con-composer--play [data-forecast-row]'), 'the «Сработает» row stands').toHaveCount(1);
    await shoot(page, PRESET, 'MANY-01-composer');
    await armTransferWitness(page);
    await armReactionProbe(page);
    // A → the STAGED placement on the board (Noctis City's reserved area is its only legal cell — the cell confirm is
    // the one post), then the commit. A play that posts outright (no staged step) is accepted too: the card left the hand.
    const played = async (): Promise<boolean> => ((await wireOf(request, playerId)).cardsInHand ?? []).every((c) => c.name !== NOCTIS);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0 || await played(), {tries: 3, settleMs: 1500}),
      'A opens the staged placement (or plays the card outright)').toBeTruthy();
    if (await page.locator('.con-board--placing').count() > 0) {
      expect(await placeTile(page), 'the city was placed on the reserved area').toBe(true);
    }
    await page.locator(`.con-recv__emerge[data-played-key="${HARTLAN}"], .con-reaction__face[data-reaction-card]`).first()
      .waitFor({state: 'visible', timeout: 60_000});
    await shoot(page, PRESET, 'MANY-02-reactors-rise');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('many', PRESET, transferTrail(witness));
    const samples = await reactionProbe(page);
    console.log(`[${PRESET.id} MANY probe] ${JSON.stringify(samples.map((s) => ({...s, faces: s.faces.map((f) => `${f.card}@${Math.round(f.l)},${Math.round(f.t)} ${Math.round(f.w)}×${Math.round(f.h)} ${f.op.toFixed(2)}`)})))}`);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    // Every reactor's tokens were born on ITS OWN face — never on the played card. Four rail groups fire in the server's
    // order (the three the city woke at the placement, then Hartlan's DEFERRED gain): from four groups the ceiling is
    // 2.4 s (the owner, PL-1059), so the fourth — the one the forecast PROMISED — rises too; nothing is summarized.
    for (const reactor of [THARSIS, ROVER, IMMIGRANT, HARTLAN]) {
      expect(witness.births.some((b) => b.under.startsWith(`reactor:${reactor}:`)), `${reactor}'s answer was born on its effect row\n${transferTrail(witness)}`).toBe(true);
    }
    // THE ONE STAGE (iteration 3): every standalone reactor rose at the centre of the opening, on a row of slots —
    // never beside the rail, never in a corner, never two faces in one box.
    const seen = expectAtTheStage(samples, 'MANY');
    expect([...seen], 'the standalone reactors rose at the stage').toEqual(expect.arrayContaining([THARSIS, ROVER, IMMIGRANT, HARTLAN]));
    expect(samples.some((s) => Number(s.seats) >= 2), 'MANY groups: a row of slots').toBe(true);
    expect(samples.some((s) => s.faces.length >= 2), 'two reactors stood side by side at once').toBe(true);
    const summarized = new Set(samples.flatMap((s) => s.summarized.split('|').filter((x) => x !== '')));
    expect([...summarized], 'four groups fit under the 2.4 s ceiling — nothing summarized').toEqual([]);
    expect(samples.some((s) => s.row), 'an effect row was lit as the WHY').toBe(true);
    const heatBirths = witness.births.filter((b) => b.under.startsWith(`reactor:${HARTLAN}:`) && /heat/.test(b.under));
    expect(heatBirths.length, `Hartlan's six heat tokens born on its printed heat\n${transferTrail(witness)}`).toBe(6);
    const wall = chainWallMs(samples);
    console.log(`[${PRESET.id} MANY] chain wall ${wall} ms`);
    expect(wall, 'the chain played').not.toBeUndefined();
    // The chain goes by EVENTS now (never a schedule) — bounded all the same: the rises under the ceiling, the last
    // group's own flight, settle and recede after it.
    expect(wall ?? Infinity, 'the chain\'s wall-clock is bounded').toBeLessThan(7000);
    // The server's numbers — not one delta lost: Hartlan +6 heat / +1 prod; Tharsis +3 M€ / +1 prod; Rover +2 M€; Immigrant +1 prod; Noctis +3 prod; Pets +1 animal.
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.heat).toBe(before.thisPlayer.heat + 6);
    expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits - 18 + 3 + 2);
    expect(after.thisPlayer.megacreditProduction).toBe(before.thisPlayer.megacreditProduction + 1 + 1 + 1 + 3);
    expect(animalsOn(after, PETS)).toBe(animalsOn(before, PETS) + 1);
    // The board's family on the framework (PL-1057): Pets' animal is born on ITS printed animal, standing on its plate.
    expect(witness.births.some((b) => b.under.startsWith(`reactor:${PETS}:`)), `Pets' animal born on its own printed icon\n${transferTrail(witness)}`).toBe(true);
    await shoot(page, PRESET, 'MANY-03-board');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('BOARD · a standard-project city wakes Tharsis Republic — the corporation rises at the stage\'s centre, a protagonist, its 3 M€ born on its printed M€', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootFixture(page, request, 'card-reaction-many', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    await armTransferWitness(page);
    await armReactionProbe(page);
    await playStandardCity(page);
    await page.locator(`.con-reaction__face[data-reaction-card="${THARSIS}"]`).waitFor({state: 'visible', timeout: 60_000});
    await shoot(page, PRESET, 'BOARD-01-tharsis-rises');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('board', PRESET, transferTrail(witness));
    const samples = await reactionProbe(page);
    console.log(`[${PRESET.id} BOARD probe] ${JSON.stringify(samples.map((s) => ({...s, faces: s.faces.map((f) => `${f.card}@${Math.round(f.l)},${Math.round(f.t)} ${Math.round(f.w)}×${Math.round(f.h)} ${f.op.toFixed(2)}`)})))}`);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const tharsis = witness.births.filter((b) => b.under.startsWith(`reactor:${THARSIS}:`));
    expect(tharsis.length, `Tharsis' answer was born on its printed M€ / production\n${transferTrail(witness)}`).toBeGreaterThan(0);
    expect(witness.landings.filter((l) => tharsis.some((b) => b.id === l.id)).every((l) => l.under.startsWith('rail:megacredits')),
      `…and landed on the M€ row / plate\n${transferTrail(witness)}`).toBe(true);
    expect(witness.births.some((b) => b.under.startsWith(`reactor:${ROVER}:`)), 'Rover Construction answered from its own row').toBe(true);
    const seen = expectAtTheStage(samples, 'BOARD');
    expect([...seen]).toEqual(expect.arrayContaining([THARSIS, ROVER, IMMIGRANT]));
    expect(samples.some((s) => s.hurried === '1'), 'nothing hurried the chain').toBe(false);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits, 'the city\'s price, Tharsis\' 3 and Rover\'s 2').toBe(before.thisPlayer.megacredits - 25 + 3 + 2);
    expect(after.thisPlayer.megacreditProduction, 'the city\'s own step + Tharsis + Immigrant City').toBe(before.thisPlayer.megacreditProduction + 3);
    expect(animalsOn(after, PETS)).toBe(animalsOn(before, PETS) + 1);
    expect(witness.births.some((b) => b.under.startsWith(`reactor:${PETS}:`)), `Pets' animal born on its own printed icon (the board's family)\n${transferTrail(witness)}`).toBe(true);
    await shoot(page, PRESET, 'BOARD-02-board');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('RIVAL · the viewer\'s city wakes RED\'s Tharsis Republic — on the viewer\'s screen the rival\'s card rises at the same stage under a caption naming red, its token landing on red\'s intake', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootFixture(page, request, 'card-reaction-rival', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    const redBefore = before.players.find((p) => p.color === 'red');
    expect(redBefore?.tableau.map((c) => c.name), 'red holds Tharsis Republic').toContain(THARSIS);
    await armTransferWitness(page);
    await armReactionProbe(page);
    await playStandardCity(page);
    // The rival's face stands at THE stage — a step smaller than an own reactor — under a caption naming red. Read in
    // the SAME in-page tick the face turns visible (a separate read after the wait once found the face already gone).
    const handle = await page.waitForFunction((card) => {
      const el = document.querySelector<HTMLElement>(`.con-reaction__face[data-reaction-card="${card}"]`);
      const f = el?.getBoundingClientRect();
      if (el === null || el === undefined || f === undefined || f.width < 4 || Number(getComputedStyle(el).opacity) < 0.3) {
        return null;
      }
      const caption = el.querySelector<HTMLElement>('.con-reaction__caption');
      return {
        face: {l: f.left, t: f.top, r: f.right, b: f.bottom, h: f.height},
        caption: caption === null ? null : {seat: caption.getAttribute('data-reaction-caption'), text: caption.textContent?.trim() ?? ''},
      };
    }, THARSIS, {timeout: 60_000, polling: 40});
    const geometry = await handle.jsonValue() as {face: {l: number, t: number, r: number, b: number, h: number}, caption: {seat: string | null, text: string} | null} | null;
    await shoot(page, PRESET, 'RIVAL-01-tharsis-at-the-stage');
    expect(geometry, 'the face is measurable').not.toBeNull();
    expect(geometry!.caption, 'the rival\'s face wears a caption').not.toBeNull();
    expect(geometry!.caption!.seat, '…naming red').toBe('red');
    expect(geometry!.caption!.text, '…by red\'s name').toContain(redBefore!.name);
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('rival', PRESET, transferTrail(witness));
    const samples = await reactionProbe(page);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const seen = expectAtTheStage(samples, 'RIVAL', STAGE_SHARE * RIVAL_SCALE);
    expect([...seen]).toContain(THARSIS);
    const births = witness.births.filter((b) => b.under.startsWith(`reactor:${THARSIS}:`));
    expect(births.length, `Tharsis' production step born on its own effect row\n${transferTrail(witness)}`).toBeGreaterThan(0);
    expect(witness.landings.filter((l) => births.some((b) => b.id === l.id)).every((l) => /^(seat|intake):red/.test(l.under)),
      `…and landed on red's chip / its intake\n${transferTrail(witness)}`).toBe(true);
    const after = await wireOf(request, playerId);
    const redAfter = after.players.find((p) => p.color === 'red');
    expect(redAfter?.megacreditProduction, 'the server: red\'s +1 M€ production').toBe((redBefore?.megacreditProduction ?? 0) + 1);
    expect(after.thisPlayer.megacredits, 'the viewer paid the city — no cash of red\'s').toBe(before.thisPlayer.megacredits - 25);
    expect(errors, 'no page errors').toEqual([]);
  });

  test('SCALE · a heat → temperature step wakes Homeostasis Bureau — the card rises at the stage, its 3 M€ born on its printed M€; the step\'s own rating rides the marker', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootFixture(page, request, 'card-reaction-scale', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.heat, 'the fixture: 8 heat').toBe(8);
    await armTransferWitness(page);
    await armReactionProbe(page);
    expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}), 'the basic-actions wheel opens').toBe(true);
    const confirm = page.locator('.con-confirm[data-motion-surface="confirm"][data-confirm-kind="convertHeat"]');
    expect(await pressUntil(page, 'ArrowRight', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), 'the heat conversion\'s confirm stands').toBe(true);
    await settle(page);
    await shoot(page, PRESET, 'SCALE-01-confirm');
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).thisPlayer.heat === 0, {tries: 3, settleMs: 1500}), 'A converts the heat').toBe(true);
    await page.locator(`.con-reaction__face[data-reaction-card="${HOMEOSTASIS}"]`).waitFor({state: 'visible', timeout: 60_000});
    await shoot(page, PRESET, 'SCALE-02-homeostasis-rises');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('scale', PRESET, transferTrail(witness));
    const samples = await reactionProbe(page);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    expect([...expectAtTheStage(samples, 'SCALE')]).toContain(HOMEOSTASIS);
    const births = witness.births.filter((b) => b.under.startsWith(`reactor:${HOMEOSTASIS}:`));
    expect(births.length, `three M€ tokens born on Homeostasis' printed M€\n${transferTrail(witness)}`).toBe(3);
    expect(witness.landings.filter((l) => births.some((b) => b.id === l.id)).every((l) => l.under.startsWith('rail:megacredits')),
      `…and landed on the M€ row\n${transferTrail(witness)}`).toBe(true);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.terraformRating, 'the server: +1 rating for the step').toBe(before.thisPlayer.terraformRating + 1);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'the server: Homeostasis\' 3 M€ (plus whatever the ruling party answers)').toBeGreaterThanOrEqual(3);
    expect(errors, 'no page errors').toEqual([]);
  });

  test('FIBER · a card whose own action wakes its own effect — the composer\'s hero IS the reactor: lifted in place, its row lit, its M€ born on its printed M€; never a second instance', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (/card-reaction|rail-reward|transfer/.test(m.text())) {
        console.log(`[page ${m.type()}] ${m.text()}`);
      }
    });
    const playerId = await bootFixture(page, request, 'card-reaction-fiber', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.tableau.map((c) => c.name), 'the table: Martian Fiber').toContain(FIBER);
    await openCardActionOf(page, FIBER);
    await expect(page.locator(`.con-composer--stage [data-reaction-home="${FIBER}"]`), 'the hero carries the card\'s identity for a reaction').toHaveCount(1);
    await shoot(page, PRESET, 'FIBER-01-composer');
    await armTransferWitness(page);
    await armReactionProbe(page);
    expect(await pressUntil(page, 'Enter', async () => dataOn(await wireOf(request, playerId), FIBER) === dataOn(before, FIBER) + 1, {tries: 3, settleMs: 1500}),
      'A activates the action — a data on the card').toBe(true);
    await page.waitForFunction(() => document.querySelector('[data-reaction-lifted]') !== null || document.querySelector('.con-reaction__face[data-reaction-card]') !== null, undefined, {timeout: 60_000, polling: 40})
      .catch(() => undefined);
    await shoot(page, PRESET, 'FIBER-02-hero-reacts');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('fiber', PRESET, transferTrail(witness));
    const samples = await reactionProbe(page);
    console.log(`[${PRESET.id} FIBER probe] ${JSON.stringify(samples.map((s) => ({t: Math.round(s.t), phase: s.phase, seated: s.seated, lifted: s.lifted, row: s.row})))}`);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    // ONE physical card: the layer never painted a second Martian Fiber; the hero itself was LIFTED and its row lit.
    expect(samples.some((s) => s.faces.some((f) => f.card === FIBER)), 'the layer never painted a copy of the hero').toBe(false);
    expect(samples.some((s) => s.lifted === FIBER), 'the composer\'s hero was lifted in place').toBe(true);
    expect(samples.some((s) => s.lifted === FIBER && s.row), 'its effect row was lit as the WHY').toBe(true);
    const births = witness.births.filter((b) => b.under.startsWith(`reactor:${FIBER}:`));
    expect(births.length, `the M€ was born on the hero's own printed M€\n${transferTrail(witness)}`).toBeGreaterThan(0);
    expect(witness.landings.filter((l) => births.some((b) => b.id === l.id)).every((l) => l.under.startsWith('rail:megacredits')),
      `…and landed on the M€ row\n${transferTrail(witness)}`).toBe(true);
    const after = await wireOf(request, playerId);
    expect(dataOn(after, FIBER), 'the server: +1 data on Martian Fiber').toBe(dataOn(before, FIBER) + 1);
    expect(after.thisPlayer.megacredits, 'the server: +1 M€ from its own effect').toBe(before.thisPlayer.megacredits + 1);
    expect(errors, 'no page errors').toEqual([]);
  });

  test('HURRY · a press while the chain plays is a PACE, never a cut — every face still rises, nothing is summarized', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootFixture(page, request, 'card-reaction-many', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    await armTransferWitness(page);
    await armReactionProbe(page);
    await playStandardCity(page);
    await page.locator('.con-reaction__face[data-reaction-card]').first().waitFor({state: 'visible', timeout: 60_000});
    // ONE press (B) while the first reactor stands: the chain hurries — and goes on.
    await press(page, 'Escape', 120);
    await shoot(page, PRESET, 'HURRY-01-pressed');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witness = await transferWitness(page);
    writeTrail('hurry', PRESET, transferTrail(witness));
    const samples = await reactionProbe(page);
    console.log(`[${PRESET.id} HURRY probe] ${JSON.stringify(samples.map((s) => ({t: Math.round(s.t), phase: s.phase, seated: s.seated, hurried: s.hurried, summarized: s.summarized})))}`);
    expect(samples.some((s) => s.hurried === '1'), 'the press HURRIED the chain').toBe(true);
    const seen = expectAtTheStage(samples, 'HURRY');
    expect([...seen], 'every face still rose — hurried, never cut').toEqual(expect.arrayContaining([THARSIS, ROVER, IMMIGRANT]));
    const summarized = new Set(samples.flatMap((s) => s.summarized.split('|').filter((x) => x !== '')));
    expect([...summarized], 'nothing summarized').toEqual([]);
    for (const reactor of [THARSIS, ROVER, IMMIGRANT]) {
      expect(witness.births.some((b) => b.under.startsWith(`reactor:${reactor}:`)), `${reactor}'s tokens still flew from its row\n${transferTrail(witness)}`).toBe(true);
    }
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits - 25 + 3 + 2);
    expect(after.thisPlayer.megacreditProduction).toBe(before.thisPlayer.megacreditProduction + 3);
    expect(errors, 'no page errors').toEqual([]);
  });
});

test.describe(`console · card reaction — the handheld under load · ${DECK.id}`, () => {
  test.use({viewport: DECK.viewport, deviceScaleFactor: 1, screen: DECK.viewport});

  test('SLOW · under a 4× CPU throttle every face that rises STANDS for a readable beat — never one frame; the row holds two', async ({page, request}) => {
    test.setTimeout(600_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    const playerId = await bootFixture(page, request, 'card-reaction-many', {query: DECK.query});
    await settle(page, {timeoutMs: 60_000});
    const before = await wireOf(request, playerId);
    await armTransferWitness(page);
    await armReactionProbe(page);
    await playStandardCity(page);
    await page.locator('.con-reaction__face[data-reaction-card]').first().waitFor({state: 'visible', timeout: 90_000});
    await shoot(page, DECK, 'SLOW-01-rises');
    await settle(page, {timeoutMs: 90_000});
    await waitForBoardHome(page, 60);
    const witness = await transferWitness(page);
    writeTrail('slow', DECK, transferTrail(witness));
    const samples = await reactionProbe(page);
    console.log(`[${DECK.id} SLOW probe] ${JSON.stringify(samples.map((s) => ({t: Math.round(s.t), phase: s.phase, seated: s.seated, seats: s.seats})))}`);
    const seen = expectAtTheStage(samples, 'SLOW');
    expect([...seen]).toEqual(expect.arrayContaining([THARSIS, ROVER, IMMIGRANT]));
    // The read beat: every face stood at least a third of a second of task-clock time (a painted, warmed face —
    // never a card that appeared finished and left on the next frame).
    expectEveryFaceStood(samples, 'SLOW', 320);
    expect(samples.every((s) => s.seats === '' || Number(s.seats) <= 2), 'a handheld\'s row holds two').toBe(true);
    for (const reactor of [THARSIS, ROVER, IMMIGRANT]) {
      expect(witness.births.some((b) => b.under.startsWith(`reactor:${reactor}:`)), `${reactor}'s tokens born on its row\n${transferTrail(witness)}`).toBe(true);
    }
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits - 25 + 3 + 2);
    expect(errors, 'no page errors').toEqual([]);
  });
});
