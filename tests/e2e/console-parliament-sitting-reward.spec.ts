import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, openMandatoryAnnounce, placementState, placeTile, press, pressUntil, settle} from './consoleStart';
import {
  answerAsksAs, answerGateAs, armLeakWitness, expectParliamentFits, hotVerb, mandatoryPlate, parliament, PARLIAMENT_PRESETS, parliamentWire,
  passAs, sittingStage, sittingStep, strandedReports, turnTo, waitSittingAtRest,
} from './parliamentDrive';

/**
 * THE REWARD STAGE — Э5 (docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §4, §6
 * «НАГРАДА»; docs/TURMOIL_REDUX_PARLIAMENT_FINISH.md § Э5): every reward
 * arrives by its ADDRESS as a physical event, on three profiles, for the
 * five resolutions of the catalog.
 *
 *   · BEFORE the record the reading speaks of «this payout» (`resolving`);
 *   · a production / stock record arrives as a WAVE: every chip is BORN inside
 *     the carrier card's printed mechanic, LANDS on its own cell of the rail,
 *     TRAVELS the whole way (≥ 20 % of the viewport's height, or ≥ 85 % of
 *     the icon → cell chord when the carrier stands beside the rail), and the
 *     rail's counter ticks in the frame of its LANDING (never its dissolve)
 *     with its delta chip; the ruling party's answer leaves the government's
 *     plaque after the card's own chips have landed; the reading then says
 *     «received»;
 *   · the surfaces go IN TURN: the take (Climate Research) deals only after
 *     the wave, inside the stage's zone — no second source dock, no ghost
 *     seat, a real 3D turn on the deal, L3 opening the resolution, and after
 *     a take the survivors re-seat centred ONLY after the landing;
 *   · the winner's tile (Biodome Contest) takes the board after the wave and
 *     the frame comes back to the reward stage in its «received» pose (the
 *     parameter, the TR) before the renewal;
 *   · a resolution that asks nothing (Architecture Award, Central Power Grid)
 *     brings the adjourn in the same response: the reward page HOLDS while
 *     the chips fly, then the renewal enters;
 *   · every `parliament-sitting:*` hold is released at rest; nothing of the
 *     parliament sticks out or scrolls, on every pose.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF.
 * Screenshots under screenshots/parliament-sitting-reward/<preset>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-sitting-reward');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Rect = {x: number, y: number, w: number, h: number};
type Chip = {id: string, x: number, y: number, res: string, amt: string};
type Cells = Record<string, {prod: Rect | undefined, stock: Rect | undefined}>;
type Sample = {
  t: number; stage: string; step: string; chips: Array<Chip>; card: Rect | undefined; mech: Rect | undefined; ruler: Rect | undefined;
  rail: Record<string, {prod: string, stock: string}>; cells: Cells; trCell: Rect | undefined; tr: string; deltas: Record<string, number>; contexts: Array<string>;
  extdraw: number; zone: number; deals: Array<number>; placing: boolean; parl: boolean; winner: string | undefined; holds: Array<string>;
  /** The card-bonus witnesses: the deck-draw scene (phase), the bonus cover lift, the reveal, the plate, the hand dock's total. */
  deckdraw: string; cover: boolean; reveal: boolean; zoom: boolean; plate: boolean; hand: string;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__rewardProbe: Probe, __conReady?: () => {holds: Array<string>}};
    w.__rewardProbe = {samples: []};
    const rectOf = (el: Element | null): Rect | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width < 2 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const sample = () => {
      // A chip is sampled only once the director has POSED it (its inline
      // transform is written on the tick after its mount) — the observer fires
      // on the mount itself, when the element still sits at the layer's origin.
      // A chip's identity is the layer's own flight id (`data-transfer-id`) —
      // a list index shifts the moment an earlier chip is absorbed.
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        const icon = el.querySelector<HTMLElement>('.con-transfer__icon');
        const res = icon === null ? 'megacredits' : (Array.from(icon.classList).find((c) => c.startsWith('resource_icon--')) ?? '').replace('resource_icon--', '');
        return {id: `${el.dataset.transferId ?? '?'}:${res}`, x: r.left + r.width / 2, y: r.top + r.height / 2, res, amt: el.textContent?.trim() ?? ''};
      });
      const card = document.querySelector('[data-parl-sit-hero] .con-parl__gov-card .pcard') ?? document.querySelector('.con-parl [data-parl-gov-carry] .con-parl__gov-card .pcard');
      const rail: Record<string, {prod: string, stock: string}> = {};
      const cells: Cells = {};
      const deltas: Record<string, number> = {};
      for (const key of ['heat', 'plants', 'megacredits']) {
        const row = document.querySelector(`.con-res__row--${key}`);
        rail[key] = {prod: row?.querySelector('.con-res__prod')?.textContent?.trim() ?? '', stock: row?.querySelector('.con-res__stockwrap')?.textContent?.trim() ?? ''};
        cells[key] = {prod: rectOf(row?.querySelector('.con-res__prod') ?? null), stock: rectOf(row?.querySelector('.con-res__stockwrap') ?? null)};
        deltas[key] = row?.querySelectorAll('.delta-chip').length ?? 0;
      }
      deltas.rating = document.querySelectorAll('.con-res .con-score__cell--tr .delta-chip').length;
      w.__rewardProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        step: document.querySelector('.con-sit')?.getAttribute('data-sit-step') ?? '',
        chips,
        card: rectOf(card),
        mech: rectOf(card?.querySelector('.pcard__mech') ?? null),
        ruler: rectOf(document.querySelector('[data-parl-ruler]')),
        rail,
        cells,
        trCell: rectOf(document.querySelector('.con-res .con-score__cell--tr .con-score__valwrap') ?? document.querySelector('.con-res .con-score__cell--tr')),
        tr: document.querySelector('.con-res .con-score__value--tr')?.textContent?.trim() ?? '',
        deltas,
        contexts: Array.from(document.querySelectorAll('.con-sit__panel--on [data-yield-context]')).map((el) => el.getAttribute('data-yield-context') ?? ''),
        extdraw: document.querySelectorAll('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded').length,
        zone: document.querySelectorAll('.con-sit__zone--on').length,
        deals: Array.from(document.querySelectorAll<HTMLElement>('.con-deckpick-fly .con-deal-proxy__flip')).map((el) => {
          const m = /rotateY\(([-\d.]+)deg\)/.exec(el.style.transform);
          return m === null ? -1 : Number(m[1]);
        }),
        placing: document.querySelector('.con-board--placing, .con-board--locked') !== null,
        parl: document.querySelector('.con-parl') !== null,
        winner: document.querySelector('.con-sit__panel--on [data-winner-reward]')?.getAttribute('data-winner-context') ?? undefined,
        holds: (w.__conReady?.().holds ?? []).filter((h) => h.startsWith('parliament-sitting') || h.startsWith('resource-transfer')),
        deckdraw: document.querySelector('.con-deckdraw')?.getAttribute('data-dd-phase') ?? '',
        cover: ((el) => el !== null && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0')(document.querySelector<HTMLElement>('.con-bonusfly-cover')),
        reveal: document.querySelector('.con-reveal, dialog.con-zoom[open]') !== null,
        zoom: document.querySelector('dialog.con-zoom[open]') !== null,
        plate: document.querySelector('.con-mandatory') !== null,
        hand: document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? '',
      });
      if (w.__rewardProbe.samples.length > 9000) {
        w.__rewardProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step', 'data-yield-context']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__rewardProbe: Probe}).__rewardProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__rewardProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__rewardProbe?.samples.slice(-4000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    // A `path` attachment is written to disk beside the screenshot (a `body` one lives only in the report).
    const file = testInfo.outputPath('reward-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('reward-probe', {path: file, contentType: 'application/json'});
  }
});

function inside(p: {x: number, y: number}, r: Rect | undefined, slack = 2): boolean {
  return r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}

const centreOf = (r: Rect | undefined) => r === undefined ? undefined : {x: r.x + r.w / 2, y: r.y + r.h / 2};

/** The probe's px tolerances scale with the profile (1080 = 1). */
const px = (viewport: {width: number}, at1080: number) => Math.max(2, at1080 * viewport.width / 1920);

/**
 * THE LANDING FRAME of a chip: the first sample from which it stays AT REST
 * where it ends — the flight's touchdown is a damped 2.5 px weight over the
 * last 140 ms, and the contact beat fires when that settle is over; the
 * absorb then scales it IN PLACE (its centre no longer moves). The counter's
 * tick is measured against this, never against the chip's last DOM frame,
 * which is the end of its dissolve.
 */
function landingIndex(track: ReadonlyArray<{i: number, c: Chip}>, slack: number): number {
  const end = track[track.length - 1].c;
  let rest = track.length - 1;
  while (rest > 0 && Math.hypot(track[rest - 1].c.x - end.x, track[rest - 1].c.y - end.y) <= slack) {
    rest--;
  }
  return track[rest].i;
}
/**
 * The winner's tile — and whatever the board CHAINS onto it (a greenery's
 * oxygen step can hand out a temperature bonus's ocean): every cell the server
 * asks for, by the server's own prompt ids, until its next demand is not a cell.
 */
async function placeChainedTiles(page: Page, request: APIRequestContext, playerId: string): Promise<number> {
  let placed = 0;
  for (let i = 0; i < 4; i++) {
    const before = (await parliamentWire(request, playerId)).waitingFor;
    if (before?.type !== 'space') {
      return placed;
    }
    await expect.poll(() => placementState(page), {timeout: 40_000, message: `the board is live for cell ${i + 1}`}).not.toBe('none');
    expect(await placeTile(page), `tile ${i + 1} is placed`).toBe(true);
    placed++;
    await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.promptId, {timeout: 30_000, message: `cell ${i + 1} was answered`}).not.toBe(before.promptId);
  }
  return placed;
}

/** At rest a chip's centre is exactly still (the absorb scales it from its centre); the touchdown's own 2.5 px·scale weight is motion. */
const REST_SLACK_PX = 1;
/** The counter may tick one frame before the rest is sampled (a mutation-driven sample) and up to the settle's own tail after it. */
const TICK_WINDOW_BEFORE_MS = 34;
const TICK_WINDOW_AFTER_MS = 160;

/** Every chip's samples in order, by its id. */
function chipTracks(samples: ReadonlyArray<Sample>): Map<string, Array<{i: number, s: Sample, c: Chip}>> {
  const out = new Map<string, Array<{i: number, s: Sample, c: Chip}>>();
  samples.forEach((s, i) => {
    for (const c of s.chips) {
      out.set(c.id, [...(out.get(c.id) ?? []), {i, s, c}]);
    }
  });
  return out;
}

type Case = {
  rx: string;
  fixture: 'parliament-climate-assembly' | 'parliament-aquifer-assembly' | 'parliament-biodome-assembly' | 'parliament-architecture-assembly' | 'parliament-powergrid-assembly';
  /** The rail rows the wave lands on (`production` / `stock` keys), the ruling party's answer last. */
  waves: Array<{channel: 'production' | 'stock', res: 'heat' | 'plants' | 'megacredits', reaction?: boolean}>;
  follow: 'take' | 'pick' | 'tile' | 'none';
};

const CASES: ReadonlyArray<Case> = [
  {rx: 'RX05', fixture: 'parliament-climate-assembly', waves: [{channel: 'production', res: 'heat'}, {channel: 'production', res: 'megacredits', reaction: true}], follow: 'take'},
  {rx: 'RX03', fixture: 'parliament-biodome-assembly', waves: [{channel: 'stock', res: 'plants'}], follow: 'tile'},
  {rx: 'RX02', fixture: 'parliament-architecture-assembly', waves: [{channel: 'production', res: 'megacredits'}], follow: 'none'},
  {rx: 'RX04', fixture: 'parliament-powergrid-assembly', waves: [{channel: 'production', res: 'megacredits'}], follow: 'none'},
  {rx: 'RX01', fixture: 'parliament-aquifer-assembly', waves: [], follow: 'pick'},
];

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`the reward stage (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    for (const c of CASES) {
      test(`${c.rx}: «this payout» → the wave from the card → the counter ticks on contact → «received» → the follow-up in turn (${c.follow})`, async ({page, request}) => {
        test.setTimeout(420_000);
        const {playerId, seats} = await bootFixtureSeats(page, request, c.fixture, {query: preset.query, landing: 'prompt'});
        const red = seats[1];
        await armLeakWitness(page);
        const before = await parliamentWire(request, playerId);
        expect(before.game.parliament?.phase?.step).toBe('assembly');
        const viewer = before.thisPlayer.color;
        const iWin = before.game.parliament?.phase?.summary?.winner.player === viewer;

        // ── The sitting, walked to its reward page: the reading says «this payout» BEFORE the record.
        await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
        expect(await openMandatoryAnnounce(page)).toBe(true);
        await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
        await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
        await settle(page, {timeoutMs: 20_000});
        expect(await turnTo(page, 'enact')).toBe(true);
        expect(await turnTo(page, 'reward')).toBe(true);
        await settle(page, {timeoutMs: 20_000});
        expect(await sittingStep(page)).toBe('reading');
        const contextsBefore = await page.locator('.con-sit__panel--on [data-yield-context]').evaluateAll((els) => els.map((el) => el.getAttribute('data-yield-context')));
        expect(contextsBefore.length, 'a reading of what is coming').toBeGreaterThan(0);
        expect(contextsBefore.every((ctx) => ctx === 'resolving'), `the reading speaks of THIS payout before the record, got ${contextsBefore.join(',')}`).toBe(true);
        await expect(page.locator('.con-sit__panel--on [data-sit-reward-state]'), 'ONE word of state beside the kicker').toHaveText(/Эта выплата|This payout/i);
        await expect(page.locator('.con-sit__panel--on .con-iyield__caption'), 'no caption under each reading — the state is said once').toHaveCount(0);
        await expectParliamentFits(page, `${preset.id} ${c.rx} reading`);
        await shoot(page, preset.id, `${c.rx}-01-reading`);

        // ── A answers gate 1; the wait pose; the OTHER seat answers last over the API — the effects run.
        await armProbe(page);
        await press(page, 'Enter', 1200);
        await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000}).toBeUndefined();
        await expect(page.locator('.con-sit__panel--on [data-sit-awaiting]')).toHaveCount(1, {timeout: 15_000});
        const rowBefore: Record<string, {prod: string, stock: string}> = (await readProbe(page)).samples.slice(-1)[0].rail;
        await answerGateAs(request, red, 'assembly');

        if (c.waves.length > 0) {
          // ── THE WAVE: chips born on the card's own graphic, travelling to their rows; the counter ticks on contact.
          await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.chips.length > 0), {timeout: 30_000, message: 'the wave left the card'}).toBe(true);
          await waitSittingAtRest(page, 30_000);
          const probe = await readProbe(page);
          const tracks = chipTracks(probe.samples);
          expect(tracks.size, 'chips flew').toBeGreaterThan(0);
          const own = c.waves.filter((wv) => wv.reaction !== true);
          const reactions = c.waves.filter((wv) => wv.reaction === true);
          const ownIds = new Set<string>();
          let ownLanded = 0;
          for (const wv of own) {
            const track = Array.from(tracks.values()).find((tr) => tr[0].c.res === wv.res);
            expect(track, `a ${wv.res} chip flew`).toBeDefined();
            ownIds.add(track![0].c.id);
            const first = track![0];
            const last = track![track!.length - 1];
            expect(inside({x: first.c.x, y: first.c.y}, first.s.mech ?? first.s.card, px(preset.viewport, 6)),
              `the ${wv.res} chip is BORN inside the carrier card's printed mechanic (${JSON.stringify({chip: [first.c.x, first.c.y], mech: first.s.mech, card: first.s.card})})`).toBe(true);
            // …and LANDS on its own cell of the rail: the address is physical at both ends.
            const field = wv.channel === 'production' ? 'prod' : 'stock';
            const cell = last.s.cells[wv.res][field];
            expect(inside({x: last.c.x, y: last.c.y}, cell, px(preset.viewport, 10)),
              `the ${wv.res} chip LANDED on the rail's ${field} cell (${JSON.stringify({chip: [last.c.x, last.c.y], cell})})`).toBe(true);
            // The travel is the whole icon → cell distance (a carrier standing beside
            // the rail flies a short, direct chord — the 20 % rule is for a far source).
            const travel = Math.hypot(last.c.x - first.c.x, last.c.y - first.c.y);
            const cc = centreOf(cell);
            const chord = cc === undefined ? Infinity : Math.hypot(cc.x - first.c.x, cc.y - first.c.y);
            expect(travel, `the ${wv.res} chip TRAVELLED (${Math.round(travel)} px; icon → cell ${Math.round(chord)} px; ${preset.viewport.height} px high)`)
              .toBeGreaterThan(Math.min(preset.viewport.height * 0.2, chord * 0.85));
            // THE COUNTER TICKS ON CONTACT: the row's value changes within a few samples of the chip's LANDING frame.
            const was = rowBefore[wv.res][field];
            const tickAt = probe.samples.findIndex((s) => s.rail[wv.res][field] !== was);
            const landedAt = landingIndex(track!, REST_SLACK_PX);
            ownLanded = Math.max(ownLanded, landedAt);
            expect(tickAt, `the ${wv.res} ${field} counter ticked (was «${was}»)`).toBeGreaterThan(0);
            // Measured in TIME: the sampler is mutation-driven and takes several samples per frame mid-animation.
            const tickLag = probe.samples[tickAt].t - probe.samples[landedAt].t;
            expect(tickLag, `the tick rides the touchdown (tick @${tickAt}, landing @${landedAt}, chip last seen @${last.i}: ${Math.round(tickLag)} ms after the rest)`).toBeGreaterThanOrEqual(-TICK_WINDOW_BEFORE_MS);
            expect(tickLag, `the tick rides the touchdown (tick @${tickAt}, landing @${landedAt}, chip last seen @${last.i}: ${Math.round(tickLag)} ms after the rest)`).toBeLessThanOrEqual(TICK_WINDOW_AFTER_MS);
            expect(tickAt, 'the counter never moved BEFORE its chip left the card').toBeGreaterThanOrEqual(first.i);
            expect(probe.samples.some((s) => s.deltas[wv.res] > 0), `a delta chip fired on the ${wv.res} row`).toBe(true);
          }
          for (const wv of reactions) {
            // The answer leaves the plaque once the card's own chips have LANDED (their dissolve may still be running).
            const track = Array.from(tracks.values()).find((tr) => tr[0].c.res === wv.res && !ownIds.has(tr[0].c.id) && tr[0].i >= ownLanded - 2);
            expect(track, `the ruling party's ${wv.res} answer flew AFTER the card's own chips landed (@${ownLanded})`).toBeDefined();
            const first = track![0];
            const last = track![track!.length - 1];
            expect(inside({x: first.c.x, y: first.c.y}, first.s.ruler, px(preset.viewport, 8)), `the answer is BORN on the ruling party's plaque (${JSON.stringify({chip: [first.c.x, first.c.y], ruler: first.s.ruler})})`).toBe(true);
            const field = wv.channel === 'production' ? 'prod' : 'stock';
            expect(inside({x: last.c.x, y: last.c.y}, last.s.cells[wv.res][field], px(preset.viewport, 10)), `the answer LANDED on the rail's ${wv.res} ${field} cell`).toBe(true);
          }
          // The reward page HELD while the chips FLEW (a step that arrived with the record waits its turn);
          // a landed chip's dissolve may overlap the next page's entry — the decision was made at the landing.
          for (const [id, tr] of tracks) {
            const landedAt = landingIndex(tr, REST_SLACK_PX);
            expect(tr.filter((p) => p.i < landedAt).every((p) => p.s.stage === 'reward'), `the reward page stood while chip ${id} flew (landing @${landedAt})`).toBe(true);
          }
          // …and nothing of the parliament or the wave is held at rest — read LIVE (a sample can lag a release by one tick).
          const restHolds = await page.evaluate(() => ((window as unknown as {__conReady: () => {holds: Array<string>}}).__conReady().holds)
            .filter((h) => h.startsWith('parliament-sitting') || h.startsWith('resource-transfer')));
          expect(restHolds, 'every hold released at rest').toEqual([]);
        }
        await shoot(page, preset.id, `${c.rx}-02-after-wave`);

        // ── THE FOLLOW-UP, in turn.
        if (c.follow === 'take') {
          await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take stands in the zone').toHaveCount(1, {timeout: 30_000});
          const probe = await readProbe(page);
          const firstTake = probe.samples.findIndex((s) => s.extdraw > 0);
          for (const wv of c.waves) {
            const field = wv.channel === 'production' ? 'prod' : 'stock';
            const was = rowBefore[wv.res][field];
            const tickAt = probe.samples.findIndex((s) => s.rail[wv.res][field] !== was);
            expect(firstTake, `the take DEALT only after the ${wv.res} chip had landed (take @${firstTake}, tick @${tickAt})`).toBeGreaterThanOrEqual(tickAt);
          }
          await expect(page.locator('.con-extdraw__source'), 'no second source dock beside the carrier').toBeHidden();
          await expect(page.locator('.con-extdraw__ghostband, .con-extdraw__slot--ghost'), 'no ghost seat of any kind').toHaveCount(0);
          await expect(page.locator('.con-extdraw__cause'), 'no cause plate inside the stage — the promise rides the status line').toHaveCount(0);
          await expect(page.locator('.con-extdraw__status')).toContainText(/Принятая резолюция|The enacted resolution/i);
          expect((await crumbText(page)).toUpperCase()).toMatch(/ПОЛУЧЕНИЕ|INTAKE/);
          await settle(page, {timeoutMs: 30_000});
          const deals = (await readProbe(page)).samples.flatMap((s) => s.deals).filter((r) => r >= 0);
          expect(deals.some((r) => r > 20 && r < 160), `the deal TURNED in flight (rotateY samples ${deals.slice(0, 12).map(Math.round).join(',')}…)`).toBe(true);
          await expectParliamentFits(page, `${preset.id} ${c.rx} take`);
          await shoot(page, preset.id, `${c.rx}-03-take`);
          // L3 = the SOURCE: the resolution's own inspector opens over the stage.
          await press(page, 'KeyC', 1200);
          await expect(page.locator('dialog.con-zoom[open].con-zoom--parliament'), 'L3 opens the carrier resolution fullscreen').toHaveCount(1, {timeout: 10_000});
          await shoot(page, preset.id, `${c.rx}-04-source`);
          await press(page, 'Escape', 1200);
          await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(0, {timeout: 10_000});
          await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take survived the round trip').toHaveCount(1);
          // A takes ONE: the survivor re-seats CENTRED — only after the landing.
          const total = await page.locator('.con-extdraw .con-cards__slot').count();
          expect(total).toBeGreaterThan(1);
          await press(page, 'Enter', 600);
          await expect.poll(() => page.locator('.con-extdraw .con-cards__slot').count(), {timeout: 20_000}).toBe(total - 1);
          await expect.poll(() => page.locator('.con-handdelivery-layer .con-deal-proxy').count(), {timeout: 20_000}).toBe(0);
          await settle(page, {timeoutMs: 20_000});
          const centred = await page.evaluate(() => {
            const row = document.querySelector('.con-extdraw__row');
            const slots = Array.from(document.querySelectorAll('.con-extdraw .con-cards__slot'));
            if (row === null || slots.length === 0) {
              return {ok: false, why: 'no row'};
            }
            const r = row.getBoundingClientRect();
            const first = slots[0].getBoundingClientRect();
            const last = slots[slots.length - 1].getBoundingClientRect();
            const groupCentre = (first.left + last.right) / 2;
            const rowCentre = r.left + r.width / 2;
            return {ok: Math.abs(groupCentre - rowCentre) < 6, why: `group ${Math.round(groupCentre)} vs row ${Math.round(rowCentre)}`};
          });
          expect(centred.ok, `the survivors stand centred after the landing (${centred.why})`).toBe(true);
          await expect(page.locator('.con-extdraw__status')).toContainText(/Забрано|Taken/i);
          await shoot(page, preset.id, `${c.rx}-05-after-take`);
          expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-extdraw').count() === 0, {tries: 8, settleMs: 2200}), 'the rest is taken').toBe(true);
          await settle(page, {timeoutMs: 30_000});
          await expect.poll(() => sittingStep(page), {timeout: 20_000}).toMatch(/received|waiting/);
          await answerAsksAs(request, red);
        }
        if (c.follow === 'pick') {
          await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-task'), 'the recipient pick stands in the zone').toHaveCount(1, {timeout: 30_000});
          expect((await crumbText(page)).toUpperCase()).toMatch(/ВЫБОР|CHOICE/);
          await settle(page, {timeoutMs: 20_000});
          await expectParliamentFits(page, `${preset.id} ${c.rx} pick`);
          await shoot(page, preset.id, `${c.rx}-03-pick`);
          await press(page, 'Enter', 1500);
          // The chip lands on the chosen card; the record is in.
          await expect.poll(async () => ((await parliamentWire(request, playerId)).game.parliament?.phase?.outcomes ?? []).some((o) => o.player === viewer && o.kind === 'cardResource'), {timeout: 30_000}).toBe(true);
          await settle(page, {timeoutMs: 30_000});
        }
        if (c.follow === 'tile' || (c.follow === 'pick' && iWin)) {
          // ── THE WINNER'S TILE: the board takes the screen after the wave; the frame comes BACK to the reward stage in its «received» pose.
          await expect.poll(() => page.evaluate(() => document.querySelector('.con-board--placing, .con-board--locked') !== null), {timeout: 40_000, message: 'the board is live for the winner\'s tile'}).toBe(true);
          const probe = await readProbe(page);
          const firstPlacing = probe.samples.findIndex((s) => s.placing);
          for (const wv of c.waves) {
            // The wave's TOUCHDOWN is the counter's tick — the board may take the screen only after it (the absorb tail of a landed chip may still be dissolving).
            const field = wv.channel === 'production' ? 'prod' : 'stock';
            const was = rowBefore[wv.res][field];
            const tickAt = probe.samples.findIndex((s) => s.rail[wv.res][field] !== was);
            expect(firstPlacing, `the board took the screen only after the ${wv.res} chip had landed (placing @${firstPlacing}, tick @${tickAt})`).toBeGreaterThanOrEqual(tickAt);
          }
          await expect(parliament(page), 'the sitting stepped aside for the board').toHaveCount(0, {timeout: 20_000});
          await shoot(page, preset.id, `${c.rx}-06-board`);
          const placed = await placeChainedTiles(page, request, playerId);
          expect(placed, 'the winner\'s tile (and any cell the board chained onto it) is placed').toBeGreaterThan(0);
          console.log(`[${c.rx}] cells placed: ${placed}`);
          await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
          await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.parl && s.stage === 'reward' && s.winner === 'applied'),
            {timeout: 30_000, message: 'the reward stage showed the tile\'s receipt (the winner reading applied) on the way back'}).toBe(true);
          await shoot(page, preset.id, `${c.rx}-07-after-tile`);
          // The OTHER seat may still owe its own pick: the reward page WAITS on it, naming the seat with its chip.
          const redWire = await parliamentWire(request, red);
          if (redWire.waitingFor?.type === 'card') {
            await expect.poll(() => sittingStep(page), {timeout: 20_000}).toBe('waiting');
            await expect(page.locator('.con-sit__panel--on [data-sit-wait]'), 'the wait line names the seat').toHaveAttribute('data-sit-wait-for', redWire.thisPlayer.color);
            await expectParliamentFits(page, `${preset.id} ${c.rx} waiting`);
            await shoot(page, preset.id, `${c.rx}-07b-waiting`);
            await answerAsksAs(request, red);
          }
          await expect.poll(() => sittingStage(page), {timeout: 30_000}).toBe('renewal');
          await shoot(page, preset.id, `${c.rx}-07c-renewal`);
        }
        if (c.follow === 'none') {
          // A resolution that asks nothing: the adjourn arrived WITH the record — the renewal enters after the wave has LANDED.
          await expect.poll(() => sittingStage(page), {timeout: 30_000}).toBe('renewal');
          const probe = await readProbe(page);
          const firstRenewal = probe.samples.findIndex((s) => s.stage === 'renewal');
          for (const wv of c.waves) {
            const field = wv.channel === 'production' ? 'prod' : 'stock';
            const was = rowBefore[wv.res][field];
            const tickAt = probe.samples.findIndex((s) => s.rail[wv.res][field] !== was);
            expect(firstRenewal, `the renewal entered only after the ${wv.res} chip had landed (renewal @${firstRenewal}, tick @${tickAt})`).toBeGreaterThanOrEqual(tickAt);
          }
          await shoot(page, preset.id, `${c.rx}-06-renewal`);
        }

        // ── AT REST: the record reads «received», nothing is held, nothing sticks out.
        await waitSittingAtRest(page, 30_000);
        await settle(page, {timeoutMs: 30_000});
        const contextsAfter = await page.locator('.con-sit__panel--on [data-yield-context]').evaluateAll((els) => els.map((el) => el.getAttribute('data-yield-context')));
        if (contextsAfter.length > 0 && await sittingStage(page) === 'reward') {
          expect(contextsAfter.every((ctx) => ctx === 'applied'), `the reading says «received» at rest, got ${contextsAfter.join(',')}`).toBe(true);
          await expect(page.locator('.con-sit__panel--on [data-sit-reward-state]')).toHaveText(/Получено|Received/i);
        }
        await expectParliamentFits(page, `${preset.id} ${c.rx} rest`);
        await shoot(page, preset.id, `${c.rx}-08-rest`);
        expect(await strandedReports(page)).toEqual([]);
      });
    }
  });
}

test.describe('the big draw on the Deck (deck-handheld)', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('six owed cards deal into the stage\'s zone in TWO rows at a readable size — nothing trimmed, nothing scrolls, no second source, no ghost', async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-climate-big', {query: '&consoleProfile=handheld', landing: 'prompt'});
    await armLeakWitness(page);
    expect((await parliamentWire(request, playerId)).waitingFor?.type).toBe('card');
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded')).toHaveCount(1, {timeout: 30_000});
    await expect(page.locator('.con-extdraw .con-cards__slot')).toHaveCount(6, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    const shape = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.con-extdraw__row');
      const zone = document.querySelector('.con-sit__zone--on')?.getBoundingClientRect();
      const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-extdraw .con-cards__slot')).map((el) => el.getBoundingClientRect());
      // A ROW is a cluster of tops: the focused card rides a few px higher on its own emphasis, and that is not a row.
      const tops = slots.map((r) => r.top).sort((a, b) => a - b).reduce<Array<number>>((rows, top) => {
        if (rows.length === 0 || top - rows[rows.length - 1] > 24) {
          rows.push(top);
        }
        return rows;
      }, []);
      const insideZone = zone === undefined ? false : slots.every((r) => r.left >= zone.left - 1 && r.right <= zone.right + 1 && r.top >= zone.top - 1 && r.bottom <= zone.bottom + 1);
      return {perRow: row?.style.getPropertyValue('--con-ws-stage-per-row') ?? '', rows: tops.length, insideZone, minW: Math.min(...slots.map((r) => r.width))};
    });
    expect(shape.rows, `two rows (slot tops: ${shape.rows}, per-row ${shape.perRow})`).toBe(2);
    expect(shape.insideZone, 'every card inside the zone').toBe(true);
    expect(shape.minW, 'a readable card (≥ 96 px wide on the Deck)').toBeGreaterThan(96);
    await expect(page.locator('.con-extdraw__source')).toBeHidden();
    await expect(page.locator('.con-extdraw__ghostband, .con-extdraw__slot--ghost, .con-extdraw__cause')).toHaveCount(0);
    await expectParliamentFits(page, 'deck big draw');
    await shoot(page, 'deck-handheld', 'RX05-big-draw');
    expect(await strandedReports(page)).toEqual([]);
  });
});

test.describe('the Agenda step\'s TR bonus (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the rating is HELD on the rail through the announce and the verdict, and flies from the reached step once the marker has settled', async ({page, request}) => {
    test.setTimeout(300_000);
    // Blue at Agenda 3 wins Climate Research: the step reached is a TR step.
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-climate-vote', {query: '&consoleProfile=auto', landing: 'board'});
    const red = seats[1];
    const trBefore = (await parliamentWire(request, playerId)).thisPlayer.terraformRating;
    await armProbe(page);
    // The generation ends over the API: both seats pass — the political phase starts and the viewer's client learns it through the poll.
    await passAs(request, playerId);
    await expect.poll(async () => (await parliamentWire(request, red)).waitingFor?.type, {timeout: 20_000}).toBe('or');
    await passAs(request, red);
    const t0 = Date.now();
    const since = () => `${((Date.now() - t0) / 1000).toFixed(1)} s after the phase began`;
    await expect.poll(async () => (await parliamentWire(request, playerId)).game.parliament?.phase?.step, {timeout: 30_000}).toBe('assembly');
    const wire = await parliamentWire(request, playerId);
    expect(wire.game.parliament?.phase?.summary?.agenda?.bonus, 'the winner\'s step is a TR step').toBe('tr');
    expect(wire.thisPlayer.terraformRating, 'the server already paid the rating').toBe(trBefore + 1);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    console.log(`[tr-bonus] the plate stands ${since()}`);
    // THE HOLD: the HUD still says the old rating while the plate stands.
    await expect(page.locator('.con-res .con-score__value--tr')).toHaveText(String(trBefore));
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    console.log(`[tr-bonus] the sitting opened ${since()}`);
    await waitSittingAtRest(page);
    await expect(page.locator('.con-res .con-score__value--tr'), 'still held at the verdict').toHaveText(String(trBefore));
    expect(await turnTo(page, 'enact')).toBe(true);
    console.log(`[tr-bonus] the enactment page ${since()}`);
    // The glide, then the chip: the rating ticks on the chip's contact.
    await expect(page.locator('.con-res .con-score__value--tr')).toHaveText(String(trBefore + 1), {timeout: 20_000});
    await waitSittingAtRest(page, 20_000);
    const probe = await readProbe(page);
    const track = Array.from(chipTracks(probe.samples).values()).find((tr) => tr[0].c.res === 'rating');
    const ledger = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady: () => {parliamentReward: unknown}}).__conReady().parliamentReward));
    expect(track, `a rating chip flew (${since()}; ledger ${ledger})`).toBeDefined();
    const first = track![0];
    const last = track![track!.length - 1];
    const stepRect = await page.evaluate((step) => {
      const el = document.querySelector(`.con-parl__step[data-step="${step}"]`);
      const r = el?.getBoundingClientRect();
      return r === undefined ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    }, wire.game.parliament?.phase?.summary?.agenda?.to);
    expect(inside({x: first.c.x, y: first.c.y}, stepRect, 10), `the chip is BORN on the reached Agenda step (${JSON.stringify({chip: [first.c.x, first.c.y], step: stepRect})})`).toBe(true);
    expect(inside({x: last.c.x, y: last.c.y}, last.s.trCell, 10), `the chip LANDED on the rail's rating cell (${JSON.stringify({chip: [last.c.x, last.c.y], cell: last.s.trCell})})`).toBe(true);
    const tickAt = probe.samples.findIndex((s) => s.tr === String(trBefore + 1));
    const landedAt = landingIndex(track!, REST_SLACK_PX);
    const tickLag = probe.samples[tickAt].t - probe.samples[landedAt].t;
    expect(tickLag, `the rating ticks on the chip's contact (tick @${tickAt}, landing @${landedAt}, chip last @${last.i}: ${Math.round(tickLag)} ms after the rest)`).toBeGreaterThanOrEqual(-TICK_WINDOW_BEFORE_MS);
    expect(tickLag, `the rating ticks on the chip's contact (tick @${tickAt}, landing @${landedAt}, chip last @${last.i}: ${Math.round(tickLag)} ms after the rest)`).toBeLessThanOrEqual(TICK_WINDOW_AFTER_MS);
    expect(probe.samples.some((s) => s.deltas.rating > 0), 'the rating\'s delta chip fired').toBe(true);
    expect(await hotVerb(page), 'the enactment page keeps its own verb after the flight').toMatch(/Продолжить|Continue/i);
    await shoot(page, 'standard-1080', 'RX05-tr-bonus-landed');
  });

  test('the Agenda step\'s CARD bonus: the card the step pays reaches the hand PHYSICALLY (a deck deal or the cover lifting off the step), never as a number that changed', async ({page, request}) => {
    test.setTimeout(300_000);
    // Blue at Agenda 6 wins Climate Research: the step reached (7) is a CARD step.
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-climate-cardstep', {query: '&consoleProfile=auto', landing: 'board'});
    const red = seats[1];
    const handBefore = (await parliamentWire(request, playerId)).thisPlayer.cardsInHandNbr;
    await armLeakWitness(page);
    await armProbe(page);
    await passAs(request, playerId);
    await expect.poll(async () => (await parliamentWire(request, red)).waitingFor?.type, {timeout: 20_000}).toBe('or');
    await passAs(request, red);
    const t0 = Date.now();
    const since = () => `${((Date.now() - t0) / 1000).toFixed(1)} s after the phase began`;
    await expect.poll(async () => (await parliamentWire(request, playerId)).game.parliament?.phase?.step, {timeout: 30_000}).toBe('assembly');
    const wire = await parliamentWire(request, playerId);
    expect(wire.game.parliament?.phase?.summary?.agenda?.bonus, 'the winner\'s step is a CARD step').toBe('card');
    expect(wire.thisPlayer.cardsInHandNbr, 'the server already dealt the step\'s card').toBe(handBefore + 1);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    console.log(`[card-bonus] the plate stands ${since()}`);
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    console.log(`[card-bonus] the sitting opened ${since()}`);
    await waitSittingAtRest(page);
    // THE PARK: nothing presented the card while the plate stood or the verdict was read — the dock still says the old total.
    expect(await page.locator('[data-hand-total]').getAttribute('data-hand-total'), 'the dock holds the old total through the verdict').toBe(String(handBefore));
    expect(await turnTo(page, 'enact')).toBe(true);
    console.log(`[card-bonus] the enactment page ${since()}`);
    // The glide lands on the card step → the cover lifts off it → the card opens over the sitting → A takes it to the dock.
    await expect(page.locator('.con-reveal, dialog.con-zoom[open]'), 'the step\'s card is presented after the glide').toHaveCount(1, {timeout: 30_000});
    await shoot(page, 'standard-1080', 'RX05-card-bonus-reveal');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal, dialog.con-zoom[open]').count() === 0, {tries: 6, settleMs: 1500}), 'A takes the card').toBe(true);
    await expect.poll(() => page.locator('[data-hand-total]').getAttribute('data-hand-total'), {timeout: 30_000}).toBe(String(handBefore + 1));
    await waitSittingAtRest(page, 30_000);
    await settle(page, {timeoutMs: 30_000});
    const probe = await readProbe(page);
    const s = probe.samples;
    const at = (pred: (x: Sample) => boolean) => s.findIndex(pred);
    const t = (i: number) => i < 0 ? 'never' : `${Math.round(s[i].t - s[0].t)} ms`;
    const firstDeal = at((x) => x.deckdraw !== '');
    const firstCover = at((x) => x.cover);
    const firstReveal = at((x) => x.reveal);
    const firstZoom = at((x) => x.zoom);
    const firstPlate = at((x) => x.plate);
    const firstSitting = at((x) => x.parl);
    const firstEnact = at((x) => x.stage === 'enact');
    const handTick = at((x) => x.hand === String(handBefore + 1));
    console.log(`[card-bonus] timeline: plate ${t(firstPlate)} · sitting ${t(firstSitting)} · enact ${t(firstEnact)} · deck deal ${t(firstDeal)} · cover lift ${t(firstCover)} · reveal mounted ${t(firstReveal)} · card open ${t(firstZoom)} · hand +1 ${t(handTick)}`);
    const sceneDiag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady: () => {cardBonus: unknown, parliamentReward: unknown}}).__conReady().cardBonus));
    expect(firstDeal, 'the deck never dealt it — the card was dealt with the summary, its source is the step').toBe(-1);
    expect(firstCover, `the cover lifted off the step (scene ${sceneDiag})`).toBeGreaterThanOrEqual(0);
    expect(firstCover, 'the cover lifted only on the enactment page').toBeGreaterThan(firstEnact);
    // The reveal overlay MOUNTS veiled under the scene; the CARD itself opens (the fullscreen viewer) only once the cover has lifted.
    expect(firstZoom, 'the card opened after the lift').toBeGreaterThanOrEqual(firstCover);
    expect(firstPlate, 'the plate came first — nothing presented the card over it').toBeLessThan(firstCover);
    expect(firstReveal, 'nothing presented the card before the enactment page').toBeGreaterThan(firstEnact);
    expect(handTick, 'the dock ticked after the card was taken').toBeGreaterThan(firstZoom);
    expect(await sittingStage(page), 'the sitting stands on its enactment page').toBe('enact');
    expect(await hotVerb(page)).toMatch(/Продолжить|Continue/i);
    await shoot(page, 'standard-1080', 'RX05-card-bonus-landed');
    expect(await strandedReports(page)).toEqual([]);
  });
});
