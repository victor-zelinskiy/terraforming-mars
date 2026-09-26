import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * UNITY BUDGET (Turmoil Redux, RX29) — the ONE e2e of the new mechanic: a law
 * that moves EVERY COLONY TRACK, and therefore plays where the tracks are —
 * the sitting HOSTS the colonies screen as its own SHOW step and comes back.
 *
 * The journey, on one profile (the owner's budget — one e2e per new mechanic):
 *   ⓪ the inspection says what will happen to the TABLE, tile by tile, in the
 *      server's own numbers — «Луна: 2 → 4», «Ио: трек на максимуме»;
 *   ① the seat is paid FIRST: the levy leaves (−12) and the payout lands (the
 *      server's own count + influence) on the rail — the colony grid does NOT
 *      stand before that;
 *   ② the COLONIES GRID stands INSIDE the Parliament's stage zone — the frame's
 *      own slot, host-agnostic (no head, no motion id), the crumb continuous
 *      («ПАРЛАМЕНТ › ЗАСЕДАНИЕ › КОЛОНИИ»), every marker still where it STOOD
 *      (the hold: the scene breathes before anything moves);
 *   ③ the WAVE: the markers step in the table's order, one tile after another
 *      (Luna lands before Callisto lands before Ceres), Luna's marker passes
 *      through its middle cell (two countable steps, never one jump), Io's
 *      never moves (its track is at its end), the flying markers are VISIBLE
 *      over a visible grid;
 *   ④ the frame LEAVES by itself and the sitting is still there: the band
 *      reads the colony table's line, the RESULTS carry the «Треки колоний»
 *      row — Luna +2, Callisto +2, Ceres +1, Io named at its maximum.
 *
 * Fixture: `parliament-unity-assembly` (the card alone in the first voting
 * slot with blue's delegate on it, blue at Agenda step 2 → influence 2 with
 * Luna Governor + Jovian Lanterns; the table Luna 2 · Callisto 4 · Ceres 5 ·
 * Io 6 after the generation's own step). Screens under screenshots/parliament-unity/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-unity');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const STAGE = '.con-parl [data-embed-slot="parliament-stage"]';
const GRID = `${STAGE} .con-colonies`;
const TILES = ['Luna', 'Callisto', 'Ceres', 'Io'] as const;
/** The table when the law reads it (after the generation's own step) and after the law's two steps. */
const BEFORE: Record<string, number> = {Luna: 2, Callisto: 4, Ceres: 5, Io: 6};
const AFTER: Record<string, number> = {Luna: 4, Callisto: 6, Ceres: 6, Io: 6};

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Outcome = {
  player?: string, step: string, part?: string, kind: string, amount?: number, count?: number, influence?: number,
  tracks?: Array<{colony: string, before: number, after: number}>,
};
type Wire = {
  thisPlayer: {color: string, megacredits: number},
  game: {colonies: Array<{name: string, trackPosition: number}>, parliament?: {phase?: {outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
  waitingFor?: {type?: string, parliamentPhasePrompt?: unknown},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/**
 * THE PROBE — a task clock (`setInterval` + `MutationObserver`, never rAF), armed BEFORE the gate is answered. Every
 * sample reads: the sitting's presence, the hosted grid's VISIBILITY (laid out, no hidden ancestor), each tile's
 * PRESENTED marker cell, how many marker proxies are in the air and whether the grid is visible under them, the rail's
 * M€ digits, the crumb, the walk's page and the band's colony-table chip.
 */
type Sample = {
  t: number;
  parl: boolean;
  grid: boolean;
  gridHead: boolean;
  gridMotionId: string | null;
  marker: Record<string, number>;
  /** The tiles whose marker proxy is MID-GLIDE (the resting marker dims) — the wave's start order. */
  gliding: Array<string>;
  /** The cells wearing the passing impulse right now (`<colony>#<cell>`) — the countable steps. */
  swept: Array<string>;
  proxies: number;
  sweeps: number;
  /** The verbs the command bar advertises — a show step asks NOTHING, so while the wave plays there are none. */
  bar: number;
  mc: string;
  crumb: string;
  page: string;
  tracksChip: boolean;
};
type Probe = {samples: Array<Sample>};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({grid, tiles}) => {
    const w = window as unknown as {__unityProbe: Probe};
    w.__unityProbe = {samples: []};
    const visible = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return false;
      }
      for (let n: Element | null = el; n !== null && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
          return false;
        }
      }
      return true;
    };
    const sample = () => {
      const gridEl = document.querySelector<HTMLElement>(grid);
      const marker: Record<string, number> = {};
      for (const name of tiles) {
        const cells = Array.from(document.querySelectorAll<HTMLElement>(`${grid} [data-test="con-colony-${name}"] .con-coltile__track-cell`));
        marker[name] = cells.findIndex((cell) => cell.classList.contains('con-coltile__track-cell--marker'));
      }
      const heads = Array.from(document.querySelectorAll<HTMLElement>('.con-wshead')).filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
      const head = heads[heads.length - 1];
      w.__unityProbe.samples.push({
        t: performance.now(),
        parl: document.querySelector('.con-parl') !== null,
        grid: visible(gridEl),
        gridHead: gridEl !== null && gridEl.querySelector('.con-wshead') !== null,
        gridMotionId: gridEl === null ? null : gridEl.getAttribute('data-motion-surface'),
        marker,
        gliding: Array.from(document.querySelectorAll<HTMLElement>(`${grid} .con-coltile--marker-gliding`))
          .map((el) => (el.getAttribute('data-test') ?? '').replace('con-colony-', '')),
        swept: Array.from(document.querySelectorAll<HTMLElement>('.con-coltile__track-cell--sweep')).map((el) => el.getAttribute('data-colony-track-cell') ?? ''),
        proxies: Array.from(document.querySelectorAll<HTMLElement>('.con-coltrade-marker')).filter((el) => visible(el)).length,
        sweeps: document.querySelectorAll('.con-coltile__track-cell--sweep').length,
        bar: document.querySelectorAll('.con-cmdbar__cmd').length,
        mc: ((document.querySelector('.con-res__row--megacredits .con-res__digits')?.textContent?.trim() ?? '').match(/^-?\d+/) ?? [''])[0],
        crumb: head === undefined ? '' : (head.textContent ?? '').replace(/\s+/g, ' ').trim(),
        page: document.querySelector('.con-parl')?.getAttribute('data-sitting-page') ?? '',
        tracksChip: document.querySelector('[data-parl-band-chip="tracks"]') !== null,
      });
      if (w.__unityProbe.samples.length > 6000) {
        w.__unityProbe.samples.splice(0, 3000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 16);
  }, {grid: GRID, tiles: TILES});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__unityProbe: Probe}).__unityProbe);

/** The console's own facts about the wave (`e2eReadiness.ts`) — how the last one ended, for a failure that names itself. */
const waveDiag = (page: Page): Promise<string> => page.evaluate(() => {
  const fn = (window as unknown as {__conReady?: () => {colonyTrackWave?: {active: boolean, tiles: number, lastFinish: string}}}).__conReady;
  return JSON.stringify(fn?.()?.colonyTrackWave ?? null);
});

/** The first task-clock sample at or after which `pick` holds (undefined when none). */
function firstWhere(samples: ReadonlyArray<Sample>, pick: (s: Sample) => boolean): Sample | undefined {
  return samples.find(pick);
}

test.describe(`Unity Budget · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the seat is paid, the colonies stand INSIDE the sitting, every marker glides in a wave, the frame leaves and the results name every track', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-unity-assembly', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);

    const before = await wireOf(request, playerId);
    for (const name of TILES) {
      expect(before.game.colonies.find((c) => c.name === name)?.trackPosition, `the fixture stands with ${name} at ${BEFORE[name]}`).toBe(BEFORE[name]);
    }
    await shoot(page, '01-verdict');

    // ── ⓪ THE INSPECTION SAYS WHAT WILL HAPPEN TO THE TABLE, tile by tile, in the server's own numbers.
    await openZoomViewer(page);
    const rules = page.locator('dialog.con-zoom[open] .con-zoom-sidecol');
    await expect(rules).toContainText(/Что делает со столом колоний|What it does to the colony table/);
    await expect(rules).toContainText(/Луна: 2 → 4|Luna: 2 → 4/);
    await expect(rules).toContainText(/Церера: 5 → 6|Ceres: 5 → 6/);
    await expect(rules).toContainText(/Ио: трек на максимуме|Io: track at its maximum/);
    await shoot(page, '01b-inspect-table');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 15_000});

    await armProbe(page);

    // ── GATE 1: A on the verdict; red answers over the API. Everything after this turns by itself.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

    // ── ① THE SEAT IS PAID FIRST: −12, then the payout by the seat's OWN count and influence (the deal is not
    // reproducible — a corporation may print an Earth or a Jovian tag — so the number is the SERVER's record, checked
    // against its own inputs: at least the two arranged cards' three tags plus the winner's influence 2).
    await expect.poll(async () => {
      const outcomes = (await wireOf(request, playerId)).game.parliament?.phase?.outcomes ?? [];
      const mine = outcomes.filter((o) => o.player === before.thisPlayer.color);
      return mine.find((o) => o.step === 'levy')?.amount === -12 && mine.find((o) => o.step === 'megacredits')?.amount !== undefined;
    }, {timeout: 60_000, message: 'the seat\'s own levy and payout are recorded'}).toBe(true);
    const paidRecord = ((await wireOf(request, playerId)).game.parliament?.phase?.outcomes ?? [])
      .find((o) => o.player === before.thisPlayer.color && o.step === 'megacredits')!;
    const paid = paidRecord.amount ?? 0;
    expect(paidRecord.count ?? 0, 'Luna Governor (2 Earth) + Jovian Lanterns (1) are counted, at least').toBeGreaterThanOrEqual(3);
    expect(paidRecord.influence, 'the winner\'s Agenda step 2 → 3 = influence 2').toBe(2);
    expect(paid, 'the payout is the count plus the influence, no cap').toBe((paidRecord.count ?? 0) + (paidRecord.influence ?? 0));
    const net = String(before.thisPlayer.megacredits - 12 + paid);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.mc === net), {timeout: 60_000,
      message: `the M€ counter reads the net ${net} after the two chips`}).toBe(true);
    // …and the server has moved the whole table already — the screen is what holds it back.
    const mid = await wireOf(request, playerId);
    for (const name of TILES) {
      expect(mid.game.colonies.find((c) => c.name === name)?.trackPosition, `the server advanced ${name}`).toBe(AFTER[name]);
    }
    const record = (mid.game.parliament?.phase?.outcomes ?? []).find((o) => o.player === undefined && o.step === 'colonyTracks');
    expect(record?.kind, 'the world record of the colony table, no seat on it').toBe('colonyTrack');
    expect(record?.tracks?.map((t) => `${t.colony}:${t.before}→${t.after}`)).toEqual(TILES.map((name) => `${name}:${BEFORE[name]}→${AFTER[name]}`));

    // ── ② THE COLONIES GRID stands INSIDE the sitting's zone — after the wave, with every marker where it STOOD.
    await expect(page.locator(GRID), 'the colonies stand in the Parliament\'s stage zone').toBeVisible({timeout: 60_000});
    await shoot(page, '02-colonies-hosted');
    let probe = await readProbe(page);
    const netTick = firstWhere(probe.samples, (s) => s.mc === net);
    const gridFirst = firstWhere(probe.samples, (s) => s.grid);
    expect(netTick, 'the net tick was sampled').not.toBe(undefined);
    expect(gridFirst, 'the hosted grid was sampled').not.toBe(undefined);
    expect(gridFirst!.t, 'the show step opened only after the seat\'s own chips had landed').toBeGreaterThanOrEqual(netTick!.t);
    for (const name of TILES) {
      expect(gridFirst!.marker[name], `${name}'s marker is HELD where it stood when the grid appears`).toBe(BEFORE[name]);
    }
    expect(gridFirst!.gridHead, 'host-agnostic: no head of its own').toBe(false);
    expect(gridFirst!.gridMotionId, 'no motion id inside a host zone (the shade guard)').toBeNull();
    const crumb = await crumbText(page);
    const hostedDiag = await waveDiag(page);
    expect(crumb, `ONE continuous crumb: the workspace, the sitting, the step (wave ${hostedDiag})`).toMatch(/парламент|parliament/i);
    expect(crumb, `the sitting is the crumb's subject (wave ${hostedDiag})`).toMatch(/заседание|sitting/i);
    expect(crumb, `the step is the crumb's tail (wave ${hostedDiag})`).toMatch(/колонии|colonies/i);
    await expect(page.locator(`${GRID} .con-coltile`)).toHaveCount(4);
    await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the resolution is the hero on the left').toHaveClass(/rdx-unity-unity-budget/);
    await expectParliamentFits(page, `${PRESET.id} colonies hosted`);

    // ── ③ THE WAVE: one tile after another, two countable steps, a track at its end named and unmoved.
    await expect.poll(async () => {
      const s = (await readProbe(page)).samples;
      return s.some((x) => x.grid && x.marker.Luna === AFTER.Luna) && s.some((x) => x.grid && x.marker.Ceres === AFTER.Ceres);
    }, {timeout: 60_000, message: 'Luna\'s and Ceres\'s markers landed on their new cells while the grid stood'}).toBe(true);
    await shoot(page, '03-wave');
    probe = await readProbe(page);
    const inGrid = probe.samples.filter((s) => s.grid && s.t >= gridFirst!.t);
    const landed = (name: string): Sample | undefined => inGrid.find((s) => s.marker[name] === AFTER[name]);
    const luna = landed('Luna');
    const callisto = landed('Callisto');
    const ceres = landed('Ceres');
    const diag = await waveDiag(page);
    expect(luna && callisto && ceres, `every moving marker landed on screen (wave ${diag})`).toBeTruthy();
    // THE WAVE'S ORDER IS THE TABLE'S — read at the START of each leg (the resting marker dims when ITS proxy
    // starts): Luna, then Callisto, then Ceres, never a volley. The LANDING order is each leg's own length
    // (Ceres's one step lands before Callisto's two) and says nothing about the wave.
    const started = (name: string): Sample | undefined => inGrid.find((s) => s.gliding.includes(name));
    const lunaStart = started('Luna');
    const callistoStart = started('Callisto');
    const ceresStart = started('Ceres');
    expect(lunaStart && callistoStart && ceresStart, `every moving tile's leg started on screen (wave ${diag})`).toBeTruthy();
    expect(callistoStart!.t - lunaStart!.t, `Callisto starts after Luna (${(callistoStart!.t - lunaStart!.t).toFixed(0)} ms; wave ${diag})`).toBeGreaterThan(100);
    expect(ceresStart!.t - callistoStart!.t, `Ceres starts after Callisto (${(ceresStart!.t - callistoStart!.t).toFixed(0)} ms; wave ${diag})`).toBeGreaterThan(100);
    // …and every marker lands AFTER its own leg started — the value moves only through the glide.
    expect(luna!.t).toBeGreaterThan(lunaStart!.t);
    expect(callisto!.t).toBeGreaterThan(callistoStart!.t);
    expect(ceres!.t).toBeGreaterThan(ceresStart!.t);
    // Two COUNTABLE steps: Luna's middle cell answers with its impulse BEFORE its last cell does, and the marker
    // lands only after the last cell was passed — a step, a beat, a step; never one jump.
    const sweptAt = (cell: string): Sample | undefined => inGrid.find((s) => s.swept.includes(cell));
    const lunaMiddle = sweptAt(`Luna#${BEFORE.Luna + 1}`);
    const lunaLast = sweptAt(`Luna#${AFTER.Luna}`);
    expect(lunaMiddle, 'Luna\'s marker passed through its middle cell — two steps, not one jump').not.toBe(undefined);
    expect(lunaLast, 'Luna\'s marker passed its last cell').not.toBe(undefined);
    expect(lunaLast!.t - lunaMiddle!.t, 'the two steps are apart').toBeGreaterThan(60);
    expect(luna!.t).toBeGreaterThanOrEqual(lunaLast!.t);
    // The hold held: nothing moved before the scene breathed (the grid's first samples stand still).
    expect(lunaStart!.t - gridFirst!.t, `the scene breathed before Luna moved (${(lunaStart!.t - gridFirst!.t).toFixed(0)} ms)`).toBeGreaterThan(300);
    // Io's track is at its end: its marker never moves, in any sample.
    expect(inGrid.every((s) => s.marker.Io === BEFORE.Io), 'Io\'s marker never moved (its track is at its maximum)').toBe(true);
    // The flying markers were VISIBLE over a VISIBLE grid (a probe asserts the source and the destination, not an event).
    const flying = inGrid.filter((s) => s.proxies > 0);
    expect(flying.length, 'marker proxies were seen in the air over the grid').toBeGreaterThan(0);
    expect(inGrid.some((s) => s.sweeps > 0), 'a passed cell answered with its impulse').toBe(true);
    // …and the sitting never left the screen: the show is HOSTED, not a trip away.
    expect(probe.samples.filter((s) => s.t >= gridFirst!.t).every((s) => s.parl), 'the Parliament stood the whole time').toBe(true);
    // A SHOW STEP ASKS NOTHING: while a marker is in the air the bar advertises no verb (the pad is inert —
    // a press could only open a trade over a moving marker or fold the sitting under its own beat).
    expect(flying.every((s) => s.bar === 0), `the command bar stayed empty while the wave played (saw ${flying.filter((s) => s.bar > 0).length} sample(s) with verbs)`).toBe(true);
    test.info().annotations.push({type: 'wave', description: `breath ${(lunaStart!.t - gridFirst!.t).toFixed(0)} ms · starts Luna→Callisto ${(callistoStart!.t - lunaStart!.t).toFixed(0)} ms · Callisto→Ceres ${(ceresStart!.t - callistoStart!.t).toFixed(0)} ms · Luna's two steps ${(lunaLast!.t - lunaMiddle!.t).toFixed(0)} ms apart`});

    // ── ④ THE FRAME LEAVES BY ITSELF, the band reads the table's line, and the results name every track.
    await expect(page.locator(GRID), 'the show step left').toHaveCount(0, {timeout: 60_000});
    await expect(parliament(page), 'the sitting is still there').toHaveCount(1);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.grid && s.tracksChip && s.parl), {timeout: 30_000,
      message: 'the band reads the colony table\'s chip once the frame is down'}).toBe(true);
    await waitSittingAtRest(page, 60_000);
    await shoot(page, '04-back-in-the-sitting');
    await expect.poll(() => sittingStage(page), {timeout: 90_000, message: 'the walk reaches the results'}).toBe('results');
    await expect(page.locator('.con-cmdbar__cmd'), 'the results give the pad back — the bar advertises its verbs again').not.toHaveCount(0);
    const tracks = page.locator('[data-sit-section="tracks"] [data-sit-track]');
    await expect(tracks, 'one member per tile').toHaveCount(4);
    await expect(tracks.nth(0)).toHaveAttribute('data-sit-track-colony', 'Luna');
    await expect(tracks.nth(0)).toHaveAttribute('data-sit-track-steps', '2');
    await expect(tracks.nth(2)).toHaveAttribute('data-sit-track-colony', 'Ceres');
    await expect(tracks.nth(2)).toHaveAttribute('data-sit-track-steps', '1');
    await expect(tracks.nth(3)).toHaveAttribute('data-sit-track-colony', 'Io');
    await expect(tracks.nth(3)).toHaveAttribute('data-sit-track-steps', '0');
    await expect(tracks.nth(3)).toContainText(/трек на максимуме|track at its maximum/);
    await expect(page.locator('[data-sit-section="tracks"]')).toHaveAttribute('data-sit-tracks-steps', '2');
    await shoot(page, '05-results-tracks');
    await expectParliamentFits(page, `${PRESET.id} results`);

    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
