import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, pressUntil, settle,
} from './consoleStart';
import {answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, openParliament, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';

/**
 * INDUSTRIALIST BUDGET (Turmoil Redux, RX15) — the ONE e2e of the family's new
 * mechanism: a LEVY every participant pays FIRST («lose 10 M€»), the first
 * OUTFLOW a resolution ever moves, then a payout by PRODUCTION STEPS +
 * influence, then a flat production part. Two moments of one journey, on one
 * profile (the owner's budget — one e2e per new mechanic):
 *
 *   PART 1 · THE VOTE (fixture `parliament-budget-vote`): the panel reads ONE
 *   line in the printed order — the levy at its head, the payout's inputs
 *   resource by resource, the NET at its tail: «−10 → [steel] 2 + [titanium]
 *   1 + [energy] 2 + [influence] 2 → +7 = −3 M€», the win suffix «+1 · step 5»;
 *   the flat «+4 M€ production» beside it wears its HORIZON («pays from the
 *   next generation») — today's pocket and next generation's income are never
 *   one sum. The fullscreen prints the levy row and the breakdown by resource.
 *
 *   PART 2 · THE SITTING (fixture `parliament-budget-assembly`; red wins, so
 *   blue is paid exactly the vote's numbers): the LEVY's chip «−10» is BORN on
 *   the rail's M€ cell, the counter TICKS DOWN as the chip LEAVES the cell —
 *   before it lands — and it lands on the law's own printed «−10» tile; only
 *   after that does the «+7» come back from the card to the cell, ticking on
 *   contact; only after that does the «+4» production step reach the brown
 *   production zone. Three parts of one seat, in turn, never on top of each
 *   other. The results read the parts signed and the NET «= −3».
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; every sample
 * carries whether the source and the destination were VISIBLE and where each
 * chip stood, so a claim of «born here, landed there» is judged on frames.
 * Screens under screenshots/parliament-budget/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-budget', 'standard-1080');
const BUDGET_ID = 'RDX_INDUSTRIALISTS_INDUSTRIALIST_BUDGET';
const BUDGET_INSTANCE = `${BUDGET_ID}#0`;
const BUDGET_CLASS = /rdx-industrialists-industrialist-budget/;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Reading = {effect: string | null, context: string | null, count: string | null, influence: string | null, amount: string | null, net: string | null, skipped: string | null};

/** The readings a yield block prints, by effect and context — every input the number stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    effect: el.closest<HTMLElement>('[data-yield-effect]')?.getAttribute('data-yield-effect') ?? null,
    context: el.getAttribute('data-yield-context'),
    count: el.getAttribute('data-yield-count'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    net: el.getAttribute('data-yield-net'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

type Outcome = {player: string, step: string, kind: string, amount?: number, owed?: number, count?: number, influence?: number,
  countedByResource?: Array<{resource: string, count: number}>, before?: number, after?: number, reason?: string};
type Wire = {
  thisPlayer: {color: string, megacredits: number, megaCreditProduction?: number},
  game: {parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Rect = {x: number, y: number, w: number, h: number};
type Chip = {id: string, x: number, y: number, kind: 'stock' | 'production', dir: string, amt: string};
type Sample = {
  t: number; stage: string; chips: Array<Chip>;
  mech: Rect | undefined; mechVisible: boolean;
  cell: Rect | undefined; cellVisible: boolean;
  prod: Rect | undefined;
  stock: string; production: string; deltas: number;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__budgetProbe: Probe};
    w.__budgetProbe = {samples: []};
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
        const kind: 'stock' | 'production' = el.classList.contains('con-transfer__chip--production') ? 'production' : 'stock';
        return {
          id: `${el.dataset.transferId ?? '?'}`, x: r.left + r.width / 2, y: r.top + r.height / 2, kind,
          dir: el.dataset.transferDirection ?? 'gain', amt: el.textContent?.trim() ?? '',
        };
      });
      const card = document.querySelector('[data-parl-sit-hero] .con-parl__gov-card .pcard') ?? document.querySelector('.con-parl [data-parl-gov-carry] .con-parl__gov-card .pcard');
      const mech = card?.querySelector('.pcard__mech') ?? null;
      const row = document.querySelector('.con-res__row--megacredits');
      const cell = row?.querySelector('.con-res__stockwrap') ?? null;
      const prod = row?.querySelector('.con-res__prod') ?? null;
      w.__budgetProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        chips,
        mech: rectOf(mech),
        mechVisible: visible(mech),
        cell: rectOf(cell),
        cellVisible: visible(cell),
        prod: rectOf(prod),
        stock: row?.querySelector('.con-res__digits')?.textContent?.trim() ?? '',
        production: prod?.textContent?.trim() ?? '',
        deltas: row?.querySelectorAll('.delta-chip').length ?? 0,
      });
      if (w.__budgetProbe.samples.length > 9000) {
        w.__budgetProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__budgetProbe: Probe}).__budgetProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__budgetProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__budgetProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('budget-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('budget-probe', {path: file, contentType: 'application/json'});
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
const TICK_WINDOW_BEFORE_MS = 34;
const TICK_WINDOW_AFTER_MS = 260;
/** The levy's tick rides the DEPARTURE: the pop of the chip out of the cell (150 ms of motion) plus a frame or two. */
const DEPARTURE_TICK_WINDOW_MS = 600;

test.describe('Industrialist Budget · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the vote reads the levy first and the net last, the production with its horizon; then the sitting: the −10 leaves the rail for the law, ticking as it goes, the +7 comes back, the +4 production follows — and the results net it', async ({page, request}) => {
    test.setTimeout(600_000);

    // ════════════════ PART 1 · THE VOTE — one line in the printed order, the net at its tail ════════════════
    {
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-budget-vote', {query: '&consoleProfile=auto'});
      await armLeakWitness(page);
      await openParliament(page);

      // ── THE FACE in the voting area: its art (keyed by RX15), the Industrialists' emblem, the printed «−10» tile, TWO production boxes.
      const face = page.locator(`.con-parl__slot[data-instance="${BUDGET_INSTANCE}"] .pcard`);
      await expect(face, 'Industrialist Budget stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(BUDGET_CLASS);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX15');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Industrialists\' emblem').toContain('industrialists');
      await expect(face.locator('.pcard__mech .pcard-mi--mc').first(), 'the negative is printed INSIDE the tile, as on the card').toHaveText('−10');
      await expect(face.locator('.pcard__mech .pcard-prod'), 'the flat +4 box and the counted box').toHaveCount(2);
      await expect(face.locator('.pcard__quest-graphic'), 'the +1 steel production quest as a graphic').toHaveCount(1);
      await shoot(page, '01-overview');

      // ── THE VOTE MODE: «−10 → [steel] 2 + [titanium] 1 + [energy] 2 + [influence] 2 → +7 = −3 · +1 if you win · step 5» and «+4 [M€ production] · from the next generation».
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      await expect(block, 'the levy + production count → M€ block').toHaveCount(1);
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        {effect: 'megacredits', context: 'estimate', count: '5', influence: '2', amount: '7', net: '-3', skipped: null},
        {effect: 'production', context: 'estimate', count: null, influence: '2', amount: '4', net: null, skipped: null},
      ]);
      const levy = block.locator('[data-yield-levy]');
      await expect(levy, 'the levy at the HEAD of the payout\'s plate').toHaveCount(1);
      await expect(levy).toHaveAttribute('data-yield-levy-paid', '10');
      await expect(levy).toHaveAttribute('data-yield-levy-owed', '10');
      await expect(levy.locator('.con-iyield__levy-of'), '40 M€ held — the whole levy, no «of 10»').toHaveCount(0);
      await expect(block.locator('[data-yield-in="production:steel"]').first()).toHaveText('2');
      await expect(block.locator('[data-yield-in="production:titanium"]').first()).toHaveText('1');
      await expect(block.locator('[data-yield-in="production:energy"]').first()).toHaveText('2');
      await expect(block.locator('[data-yield-in="influence"]').first()).toHaveText('2');
      const net = block.locator('[data-yield-net-line]');
      await expect(net, 'the NET at the tail').toHaveCount(1);
      await expect(net).toHaveAttribute('data-yield-net-amount', '-3');
      await expect(net).toContainText('−3');
      const suffix = block.locator('[data-parl-vote-suffix]');
      await expect(suffix, 'the win suffix: one more influence at step 5').toHaveCount(1);
      await expect(suffix).toHaveAttribute('data-parl-vote-suffix', '1');
      await expect(suffix).toHaveAttribute('data-suffix-step', '5');
      await expect(block.locator('[data-yield-effect="production"] [data-yield-horizon]'), 'the production part wears its horizon').toHaveCount(1);
      await expect(block.locator('[data-yield-effect="production"] [data-yield-horizon]')).toContainText(/следующего поколения|next generation/i);
      await expect(block.locator('[data-yield-effect="production"] [data-yield-in]'), 'a flat part prints no inputs — nothing bought it').toHaveCount(0);
      await expect(block.locator('[data-yield-note]'), 'no shortfall note: the seat can pay').toHaveCount(0);
      await expectParliamentFits(page, 'vote mode');
      await shoot(page, '02-vote-net');

      // ── THE FULLSCREEN: the levy row FIRST, then the breakdown by resource — never a list of cards.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(BUDGET_CLASS);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        {effect: 'megacredits', context: 'estimate', count: '5', influence: '2', amount: '7', net: '-3', skipped: null},
        {effect: 'megacredits', context: 'forecast', count: '5', influence: '3', amount: '8', net: '-2', skipped: null},
        {effect: 'production', context: 'estimate', count: null, influence: '2', amount: '4', net: null, skipped: null},
      ]);
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules, 'the rule says what counts').toContainText(/Ресурсы в запасе не считаются|Resources in your supply do not count/);
      await expect(rules, 'the levy row').toContainText(/Плата: сначала 10 M€|Levy: 10 M€ first/);
      await expect(rules, 'the breakdown behind the number').toContainText(/Учтены сейчас|Counted right now/);
      await expect(rules).toContainText(/производство стали 2|steel production 2/);
      await expect(rules).toContainText(/производство титана 1|titanium production 1/);
      await expect(rules).toContainText(/производство энергии 2|energy production 2/);
      await expect(rules, 'never «no card»').not.toContainText(/ни одна карта|No card counts/i);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, '03-fullscreen-breakdown');
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 15_000});
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      void playerId;
    }

    // ════════════════ PART 2 · THE SITTING — the outflow first, the payout back, the production last ════════════════
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-budget-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);
    const before = await wireOf(request, playerId);
    await shoot(page, '04-verdict');

    // ── GATE 1: A on the verdict; red answers over the API — the effects run by themselves.
    await armProbe(page);
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await expect(page.locator('.con-band [data-sit-awaiting]')).toHaveCount(1, {timeout: 15_000});
    const stockBefore = (await readProbe(page)).samples.slice(-1)[0].stock;
    await answerGateAs(request, red, 'assembly');

    // ── THE THREE WAVES of the viewer's seat: a loss OUT, a gain IN, a production step IN.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.stage === 'reward' && s.chips.some((c) => c.dir === 'loss')),
      {timeout: 30_000, message: 'the levy\'s chip left the rail on the reward page'}).toBe(true);
    await shoot(page, '05-levy-leaves');
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.chips.some((c) => c.kind === 'production')),
      {timeout: 60_000, message: 'the production step\'s chip flew'}).toBe(true);
    await expect.poll(async () => (await readProbe(page)).samples.slice(-1)[0].chips.length, {timeout: 60_000, message: 'the last chip landed'}).toBe(0);
    await shoot(page, '06-payout-back');

    const probe = await readProbe(page);
    const tracks = tracksOf(probe.samples).filter((tr) => tr[0].s.stage === 'reward');
    const loss = tracks.find((tr) => tr[0].c.dir === 'loss');
    const gain = tracks.find((tr) => tr[0].c.dir !== 'loss' && tr[0].c.kind === 'stock');
    const prod = tracks.find((tr) => tr[0].c.kind === 'production');
    expect(loss, 'a LOSS chip flew on the reward page').toBeDefined();
    expect(gain, 'a GAIN chip flew on the reward page').toBeDefined();
    expect(prod, 'a PRODUCTION chip flew on the reward page').toBeDefined();
    if (loss === undefined || gain === undefined || prod === undefined) {
      return;
    }

    // ① THE LEVY: born on the M€ cell (visible), reads «−10», lands inside the card's printed mechanic (visible) — the address walked backwards.
    const lossFirst = loss[0];
    const lossLandedAt = landingIndex(loss, REST_SLACK_PX);
    const lossLast = loss[loss.length - 1];
    expect(lossFirst.c.amt, 'the chip carries the levy with its sign').toContain('−10');
    expect(lossFirst.s.cellVisible, 'the M€ cell was VISIBLE when the chip was born').toBe(true);
    expect(inside({x: lossFirst.c.x, y: lossFirst.c.y}, lossFirst.s.cell, 10), `the levy is BORN on the M€ cell (${JSON.stringify({chip: [lossFirst.c.x, lossFirst.c.y], cell: lossFirst.s.cell})})`).toBe(true);
    expect(lossLast.s.mechVisible, 'the card\'s mechanic was VISIBLE when the chip landed').toBe(true);
    expect(inside({x: lossLast.c.x, y: lossLast.c.y}, lossLast.s.mech, 8), `the levy LANDED inside the card's printed mechanic (${JSON.stringify({chip: [lossLast.c.x, lossLast.c.y], mech: lossLast.s.mech})})`).toBe(true);
    const lossTravel = loss.slice(1).reduce((sum, p, k) => sum + Math.hypot(p.c.x - loss[k].c.x, p.c.y - loss[k].c.y), 0);
    expect(lossTravel, `the levy TRAVELLED (${Math.round(lossTravel)} px)`).toBeGreaterThan(200);
    // …and the COUNTER TICKED DOWN AS THE CHIP LEFT — after its birth, before its landing, by exactly 10.
    const lossTickAt = probe.samples.findIndex((s, i) => i >= lossFirst.i && digitsOf(s.stock) !== digitsOf(stockBefore));
    expect(lossTickAt, `the M€ counter ticked (was «${stockBefore}»)`).toBeGreaterThan(0);
    expect(lossTickAt, 'the counter never moved BEFORE the chip was born').toBeGreaterThanOrEqual(lossFirst.i);
    expect(lossTickAt, 'the counter ticked BEFORE the chip landed — a departure is fixed at the start').toBeLessThan(lossLandedAt);
    const departureLag = probe.samples[lossTickAt].t - lossFirst.s.t;
    expect(departureLag, `the tick rides the departure (${Math.round(departureLag)} ms after the birth)`).toBeLessThanOrEqual(DEPARTURE_TICK_WINDOW_MS);
    expect(digitsOf(probe.samples[lossTickAt].stock) - digitsOf(stockBefore), 'the whole −10 left').toBe(-10);
    expect(probe.samples.slice(lossFirst.i, lossLandedAt + 1).some((s) => s.deltas > 0), 'a delta chip fired on the M€ row for the loss').toBe(true);
    test.info().annotations.push({type: 'levy', description: `born ${Math.round(lossFirst.c.x)},${Math.round(lossFirst.c.y)} → landed ${Math.round(lossLast.c.x)},${Math.round(lossLast.c.y)}; tick +${Math.round(departureLag)} ms after birth, ${Math.round(probe.samples[lossLandedAt].t - probe.samples[lossTickAt].t)} ms before landing`});

    // ② THE PAYOUT: only AFTER the levy landed, «+7» born inside the mechanic, landing on the M€ cell, ticking on contact.
    const gainFirst = gain[0];
    expect(gainFirst.i, 'the payout left the card only once the levy had landed — surfaces in turn').toBeGreaterThan(lossLandedAt);
    expect(gainFirst.c.amt, 'the chip carries the paid amount').toContain('+7');
    expect(inside({x: gainFirst.c.x, y: gainFirst.c.y}, gainFirst.s.mech, 8), 'the payout is BORN inside the card\'s printed mechanic').toBe(true);
    const gainLandedAt = landingIndex(gain, REST_SLACK_PX);
    const gainLast = gain[gain.length - 1];
    expect(inside({x: gainLast.c.x, y: gainLast.c.y}, gainLast.s.cell, 10), 'the payout LANDED on the M€ cell').toBe(true);
    const afterLoss = probe.samples[lossTickAt].stock;
    const gainTickAt = probe.samples.findIndex((s, i) => i > lossTickAt && digitsOf(s.stock) !== digitsOf(afterLoss));
    expect(gainTickAt, 'the M€ counter ticked a second time').toBeGreaterThan(lossTickAt);
    const gainLag = probe.samples[gainTickAt].t - probe.samples[gainLandedAt].t;
    expect(gainLag, `the payout's tick rides its touchdown (${Math.round(gainLag)} ms)`).toBeGreaterThanOrEqual(-TICK_WINDOW_BEFORE_MS);
    expect(gainLag).toBeLessThanOrEqual(TICK_WINDOW_AFTER_MS);
    expect(digitsOf(probe.samples[gainTickAt].stock) - digitsOf(afterLoss), 'the whole +7 landed').toBe(7);

    // ③ THE PRODUCTION STEP: only AFTER the payout landed, the «+4» chip into the brown production zone.
    const prodFirst = prod[0];
    expect(prodFirst.i, 'the production step left the card only once the payout had landed').toBeGreaterThan(gainLandedAt);
    expect(prodFirst.c.amt).toContain('+4');
    const prodLast = prod[prod.length - 1];
    expect(inside({x: prodLast.c.x, y: prodLast.c.y}, prodLast.s.prod, 10), 'the production step LANDED on the M€ production zone').toBe(true);
    await expect.poll(async () => digitsOf((await readProbe(page)).samples.slice(-1)[0].production), {timeout: 10_000, message: 'the production readout reached 4'}).toBe(4);

    // ── THE RECORD is the server's: −10 (owed 10), then +7 from 5 steps and influence 2, then +4 — the printed order.
    const wire = await wireOf(request, playerId);
    const mine = (wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === wire.thisPlayer.color);
    expect(mine.map((o) => o.step)).toEqual(['levy', 'megacredits', 'production']);
    expect(mine[0]).toMatchObject({kind: 'stock', amount: -10, owed: 10});
    expect(mine[1]).toMatchObject({kind: 'stock', amount: 7, count: 5, influence: 2});
    expect(mine[1].countedByResource).toEqual([{resource: 'steel', count: 2}, {resource: 'titanium', count: 1}, {resource: 'energy', count: 2}]);
    expect(mine[2]).toMatchObject({kind: 'production', amount: 4});
    expect(mine[1].before, 'the payout landed on what the levy LEFT').toBe(mine[0].after);
    expect(wire.thisPlayer.megacredits - before.thisPlayer.megacredits, 'the day\'s balance').toBe(-3);

    // ── THE RESULTS read the parts signed and the NET: «−10 · +7 · +4 = −3».
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    const row = page.locator(`[data-sit-payout][data-sit-payout-seat="${wire.thisPlayer.color}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-sit-part-amount]').nth(0)).toHaveAttribute('data-sit-part-amount', '-10');
    await expect(row.locator('[data-sit-part-amount]').nth(0)).toHaveText('−10');
    await expect(row.locator('[data-sit-part-amount]').nth(1)).toHaveText('+7');
    await expect(row.locator('[data-sit-part-amount]').nth(2)).toHaveText('+4');
    await expect(row.locator('[data-sit-part="skipped"]'), 'a loss is never a skip').toHaveCount(0);
    const netLine = row.locator('[data-sit-net]');
    await expect(netLine, 'the net stands beside the parts').toHaveCount(1);
    await expect(netLine).toHaveAttribute('data-sit-net-amount', '-3');
    await expect(netLine).toContainText('−3');
    await settle(page, {timeoutMs: 30_000});
    await expectParliamentFits(page, 'results');
    await shoot(page, '07-results-net');
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
