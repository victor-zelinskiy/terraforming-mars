import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, openParliament, parliament, parliamentWire, sittingStage, strandedReports,
  waitSittingAtRest,
} from './parliamentDrive';

/**
 * PLANT BAN (Turmoil Redux, RX25) — the ONE e2e of the new mechanic: a LEVEL
 * pointed DOWN. Everything else in this journey is RX15's outflow reused whole,
 * so the spec asserts exactly what is new, in one journey on one profile:
 *
 *   PART 1 · THE VOTE (fixture `parliament-ban-vote`): the panel reads the
 *   three numbers of a cut — «макс. 4 · у вас 7 → −3» — and, because the vote
 *   is the only defence this law leaves, it WARNS the seat that has something
 *   to lose. The limit is never printed alone: a bare «4» answers «you keep
 *   four» to a player asking how many are taken.
 *
 *   PART 2 · THE SITTING (fixture `parliament-ban-assembly`; RED wins, so the
 *   viewer keeps influence 2 and is cut by exactly the number the panel
 *   promised): the «−3» chip is BORN on the rail's plant cell, the counter
 *   TICKS DOWN as the chip LEAVES it — before it lands — and it lands on the
 *   law's own printed «макс. 2 [растение]» graphic: the levy's wave, walked
 *   backwards, over a resource that is not M€. Seven plants become four, and
 *   the results row states the loss as a PART, never a skip.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; every sample
 * carries whether the source and the destination were VISIBLE and where the
 * chip stood, so «born here, landed there, moving between them» is judged on
 * frames. Screens under screenshots/parliament-ban/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-ban', 'standard-1080');
const BAN_ID = 'RDX_REDS_PLANT_BAN';
const BAN_INSTANCE = `${BAN_ID}#0`;
const BAN_CLASS = /rdx-reds-plant-ban/;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Reading = {effect: string | null, context: string | null, target: string | null, before: string | null, after: string | null, amount: string | null, skipped: string | null};

/** The readings a yield block prints, by effect and context — every number the cut stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    effect: el.closest<HTMLElement>('[data-yield-effect]')?.getAttribute('data-yield-effect') ?? null,
    context: el.getAttribute('data-yield-context'),
    target: el.getAttribute('data-yield-target'),
    before: el.getAttribute('data-yield-total-before'),
    after: el.getAttribute('data-yield-total-after'),
    amount: el.getAttribute('data-yield-amount'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

type Outcome = {player: string, step: string, kind: string, amount?: number, owed?: number, influence?: number, target?: number,
  total?: {before: number, after: number}, reason?: string};
type Wire = {
  thisPlayer: {color: string, plants: number},
  game: {parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Rect = {x: number, y: number, w: number, h: number};
type Chip = {id: string, x: number, y: number, dir: string, amt: string};
type Sample = {
  t: number; stage: string; chips: Array<Chip>;
  mech: Rect | undefined; mechVisible: boolean;
  cell: Rect | undefined; cellVisible: boolean;
  plants: string; deltas: number;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__banProbe: Probe};
    w.__banProbe = {samples: []};
    const rectOf = (el: Element | null): Rect | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width < 2 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const visible = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        return false;
      }
      for (let a: Element | null = el; a !== null; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) {
          return false;
        }
      }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && (el.contains(hit) || hit.contains(el));
    };
    const sample = () => {
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: `${el.dataset.transferId ?? '?'}`, x: r.left + r.width / 2, y: r.top + r.height / 2,
          dir: el.dataset.transferDirection ?? 'gain', amt: el.textContent?.trim() ?? '',
        };
      });
      const card = document.querySelector('[data-parl-sit-hero] .con-parl__gov-card .pcard') ?? document.querySelector('.con-parl [data-parl-gov-carry] .con-parl__gov-card .pcard');
      const mech = card?.querySelector('.pcard__mech') ?? null;
      const row = document.querySelector('.con-res__row--plants');
      const cell = row?.querySelector('.con-res__stockwrap') ?? null;
      w.__banProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        chips,
        mech: rectOf(mech),
        mechVisible: visible(mech),
        cell: rectOf(cell),
        cellVisible: visible(cell),
        plants: row?.querySelector('.con-res__digits')?.textContent?.trim() ?? '',
        deltas: row?.querySelectorAll('.delta-chip').length ?? 0,
      });
      if (w.__banProbe.samples.length > 9000) {
        w.__banProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__banProbe: Probe}).__banProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__banProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__banProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('ban-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('ban-probe', {path: file, contentType: 'application/json'});
  }
});

function inside(p: {x: number, y: number}, r: Rect | undefined, slack = 2): boolean {
  return r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}

/** The LANDING frame of a chip: the first sample from which it stays AT REST where it ends (the absorb scales it in place). */
function landingIndex(track: ReadonlyArray<{i: number, c: Chip}>, slack: number): number {
  const end = track[track.length - 1].c;
  let rest = track.length - 1;
  while (rest > 0 && Math.hypot(track[rest - 1].c.x - end.x, track[rest - 1].c.y - end.y) <= slack) {
    rest--;
  }
  return track[rest].i;
}

/** The chips of the probe, grouped into TRACKS by id, in the order they first appeared. */
function tracksOf(samples: ReadonlyArray<Sample>): Array<Array<{i: number, s: Sample, c: Chip}>> {
  const tracks = new Map<string, Array<{i: number, s: Sample, c: Chip}>>();
  samples.forEach((s, i) => {
    for (const c of s.chips) {
      const track = tracks.get(c.id) ?? [];
      track.push({i, s, c});
      tracks.set(c.id, track);
    }
  });
  return Array.from(tracks.values());
}

const digitsOf = (text: string): number => Number((text.match(/-?\d+/) ?? ['NaN'])[0]);

const REST_SLACK_PX = 1;
/** The cut's tick rides the DEPARTURE: the pop of the chip out of the cell (150 ms of motion) plus a frame or two. */
const DEPARTURE_TICK_WINDOW_MS = 600;

test.describe('Plant Ban · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the vote reads the limit, the supply and what LEAVES — and warns the seat that has something to lose; then the sitting takes the plants out of the rail, ticking as they go', async ({page, request}) => {
    test.setTimeout(600_000);

    // ════════════════ PART 1 · THE VOTE — three numbers, and the warning ════════════════
    {
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-ban-vote', {query: '&consoleProfile=auto'});
      await armLeakWitness(page);
      await openParliament(page);

      // ── THE FACE in the voting area: its art (keyed by RX25), the Reds' emblem, the printed LIMIT — a POSITIVE
      //    number after «макс.», never a «−»: nothing on this face is an amount taken.
      const face = page.locator(`.con-parl__slot[data-instance="${BAN_INSTANCE}"] .pcard`);
      await expect(face, 'Plant Ban stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(BAN_CLASS);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX25');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Reds\' emblem').toContain('reds');
      await expect(face.locator('.pcard__mech'), 'the printed rule, with the limit as a positive number').toContainText(/макс|max/i);
      await expect(face.locator('.pcard__mech'), 'no minus on the face').not.toContainText('−');
      await expect(face.locator('.pcard__quest-graphic'), 'the 4-delegates quest as a graphic').toHaveCount(1);
      await shoot(page, '01-overview');

      // ── THE VOTE MODE: the level reading — limit 4, seven of yours, −3 — plus the panel's one honest warning.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      await expect(block, 'the level block').toHaveCount(1);
      // Agenda 3 = influence 2 → limit 4; step 4 is a TR step, so the win changes no number and no forecast is drawn.
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        {effect: 'plants', context: 'estimate', target: '4', before: '7', after: '4', amount: '3', skipped: null},
      ]);
      await expect(block.locator('[data-yield-effect="plants"]'), 'the level part, and it goes DOWN').toHaveAttribute('data-yield-direction', 'down');
      await expect(block.locator('[data-yield-in="target"]'), 'the limit').toHaveText('4');
      await expect(block.locator('[data-yield-in="level"]'), 'the supply it is read against — the limit is never printed alone').toContainText('7');
      await expect(block.locator('.con-iyield__out').first(), 'what LEAVES, with its sign').toContainText('−3');
      await expect(block.locator('[data-parl-vote-suffix]'), 'the win takes LESS — there is no «+N» to print').toHaveCount(0);
      const note = block.locator('[data-yield-note]');
      await expect(note, 'the vote is the only defence: the panel warns before it').toHaveCount(1);
      await expect(note).toContainText(/сверх нормы|above the limit/i);
      await expectParliamentFits(page, 'vote mode');
      await shoot(page, '02-vote-warning');
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      void playerId;
    }

    // ════════════════ PART 2 · THE SITTING — the plants leave the rail for the law ════════════════
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-ban-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.plants, 'the viewer holds seven plants at the gate').toBe(7);
    await shoot(page, '03-verdict');

    // ── GATE 1: A on the verdict; red answers over the API — the effects run by themselves.
    await armProbe(page);
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await expect(page.locator('.con-band [data-sit-awaiting]')).toHaveCount(1, {timeout: 15_000});
    const plantsBefore = (await readProbe(page)).samples.slice(-1)[0].plants;
    await answerGateAs(request, red, 'assembly');

    // ── THE ONE WAVE of the viewer's seat, and it goes OUT.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.stage === 'reward' && s.chips.some((c) => c.dir === 'loss')),
      {timeout: 30_000, message: 'the cut\'s chip left the rail on the reward page'}).toBe(true);
    await shoot(page, '04-plants-leave');
    // …and the BAND over it never calls a cut a reward: the kicker names what LEAVES, the state word with it.
    const band = page.locator('.con-band[data-parl-band-zone]');
    await expect(band, 'the reward beat names the loss, never a reward').toHaveAttribute('data-parl-band-kicker', 'What you lose');
    await expect(band.locator('[data-parl-band-state]'), 'never «получено» for a cut').toHaveAttribute('data-parl-band-state', /This loss|Taken/);
    await expect.poll(async () => (await readProbe(page)).samples.slice(-1)[0].chips.length, {timeout: 60_000, message: 'the chip landed'}).toBe(0);

    const probe = await readProbe(page);
    const tracks = tracksOf(probe.samples).filter((tr) => tr[0].s.stage === 'reward');
    const loss = tracks.find((tr) => tr[0].c.dir === 'loss');
    expect(loss, 'a LOSS chip flew on the reward page').toBeDefined();
    expect(tracks.filter((tr) => tr[0].c.dir !== 'loss'), 'this law pays nothing — nothing flew the other way').toEqual([]);
    if (loss === undefined) {
      return;
    }

    // THE CUT: born on the plant cell (VISIBLE), reads «−3», travels, lands inside the card's printed mechanic
    // (VISIBLE) — the levy's address walked backwards, over a resource that is not M€.
    const first = loss[0];
    const landedAt = landingIndex(loss, REST_SLACK_PX);
    const last = loss[loss.length - 1];
    expect(first.c.amt, 'the chip carries the loss with its sign').toContain('−3');
    expect(first.s.cellVisible, 'the plant cell was VISIBLE when the chip was born').toBe(true);
    expect(inside({x: first.c.x, y: first.c.y}, first.s.cell, 10), `the cut is BORN on the plant cell (${JSON.stringify({chip: [first.c.x, first.c.y], cell: first.s.cell})})`).toBe(true);
    expect(last.s.mechVisible, 'the card\'s printed rule was VISIBLE when the chip landed').toBe(true);
    expect(inside({x: last.c.x, y: last.c.y}, last.s.mech, 8), `the cut LANDED inside the card's printed mechanic (${JSON.stringify({chip: [last.c.x, last.c.y], mech: last.s.mech})})`).toBe(true);
    const travel = loss.slice(1).reduce((sum, p, k) => sum + Math.hypot(p.c.x - loss[k].c.x, p.c.y - loss[k].c.y), 0);
    expect(travel, `the cut TRAVELLED (${Math.round(travel)} px)`).toBeGreaterThan(200);
    // …and the COUNTER TICKED DOWN AS THE CHIP LEFT — after its birth, before its landing, by exactly 3.
    const tickAt = probe.samples.findIndex((s, i) => i >= first.i && digitsOf(s.plants) !== digitsOf(plantsBefore));
    expect(tickAt, `the plant counter ticked (was «${plantsBefore}»)`).toBeGreaterThan(0);
    expect(tickAt, 'the counter never moved BEFORE the chip was born').toBeGreaterThanOrEqual(first.i);
    expect(tickAt, 'the counter ticked BEFORE the chip landed — this is a departure, and a departure is fixed at its start').toBeLessThan(landedAt);
    const departureLag = probe.samples[tickAt].t - first.s.t;
    expect(departureLag, `the tick rides the departure (${Math.round(departureLag)} ms after the birth)`).toBeLessThanOrEqual(DEPARTURE_TICK_WINDOW_MS);
    expect(digitsOf(probe.samples[tickAt].plants) - digitsOf(plantsBefore), 'the whole −3 left').toBe(-3);
    expect(probe.samples.slice(first.i, landedAt + 1).some((s) => s.deltas > 0), 'a delta chip fired on the plant row for the loss').toBe(true);
    test.info().annotations.push({type: 'cut', description: `born ${Math.round(first.c.x)},${Math.round(first.c.y)} → landed ${Math.round(last.c.x)},${Math.round(last.c.y)}; tick +${Math.round(departureLag)} ms after birth, ${Math.round(probe.samples[landedAt].t - probe.samples[tickAt].t)} ms before landing`});

    // ── THE RECORD is the server's: a `stock` part with a NEGATIVE amount, the limit and the supply around it.
    const wire = await wireOf(request, playerId);
    const mine = (wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === wire.thisPlayer.color);
    expect(mine.map((o) => o.step)).toEqual(['plants']);
    expect(mine[0]).toMatchObject({kind: 'stock', amount: -3, owed: 3, influence: 2, target: 4});
    expect(mine[0].total).toEqual({before: 7, after: 4});
    expect(wire.thisPlayer.plants, 'seven cut to the limit of four').toBe(4);

    // ── THE RESULTS read the loss as a PART, never a skip — and print no net beside the one number it is made of.
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    const row = page.locator(`[data-sit-payout][data-sit-payout-seat="${wire.thisPlayer.color}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-sit-part-amount]')).toHaveCount(1);
    await expect(row.locator('[data-sit-part-amount]').first()).toHaveAttribute('data-sit-part-amount', '-3');
    await expect(row.locator('[data-sit-part-amount]').first()).toHaveText('−3');
    await expect(row.locator('[data-sit-part="skipped"]'), 'a loss is never a skip').toHaveCount(0);
    await expect(row.locator('[data-sit-net]'), 'nothing was paid in this unit — a net would restate the one part').toHaveCount(0);
    await settle(page, {timeoutMs: 30_000});
    await expectParliamentFits(page, 'results');
    await shoot(page, '05-results');
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
