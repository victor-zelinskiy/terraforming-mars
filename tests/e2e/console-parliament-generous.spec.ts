import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, openParliament, parliament, parliamentWire, passAs, sittingStage,
  strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * GENEROUS FUNDING (Turmoil Redux, RX13) — the first counted term that reads
 * ONE PLAYER METRIC by threshold and step: 2 M€ per influence and per complete
 * set of 5 TR over 15, no cap.
 *
 * ONE e2e on ONE profile — the card's verification budget: the only new
 * mechanism is the threshold count, everything else is the family's and stands
 * on the units of RX02 / RX04 / RX06 / RX08. One pass:
 *   · the VOTE: the viewer's rating is 24 (ONE set, one point short of the
 *     second) at Agenda step 4 (influence 2) — the panel reads
 *     «[TR] 24 → 1 set + [influence] 2 → +6», the counted object is the RATING
 *     glyph, ONE number with the win suffix «+2 · step 5» (an influence step —
 *     the rating stands); the face prints the TR badge and «over 15»; the
 *     fullscreen prints the BREAKDOWN of the rating («TR 24 · threshold 15 ·
 *     1 complete set · 1 to the next set») and states the rule — never a list;
 *   · the REWARD stage of the sitting that follows (both seats pass over the
 *     API, the announce opens, A answers gate 1, the other seat answers over
 *     the API): the +8 chip is BORN inside the carrier card's printed mechanic
 *     (visible), LANDS on the rail's M€ cell (visible), the counter TICKS in
 *     the landing's frame with its delta chip, and — a card that asks nothing
 *     — the results follow.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; a sample
 * carries whether the source and the destination were VISIBLE (a non-zero
 * rect, a non-zero effective opacity, nothing over their centre).
 * Fixture: `parliament-generous-vote`. Screenshots under
 * screenshots/parliament-generous/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-generous', 'standard-1080');
const GENEROUS_ID = 'RDX_GREENS_GENEROUS_FUNDING';
const GENEROUS_INSTANCE = `${GENEROUS_ID}#0`;
const GENEROUS_CLASS = /rdx-greens-generous-funding/;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Reading = {context: string | null, count: string | null, metric: string | null, influence: string | null, amount: string | null, uncapped: string | null, max: string | null, skipped: string | null};

/** The readings a yield block prints, by context — every input the number stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    count: el.getAttribute('data-yield-count'),
    metric: el.getAttribute('data-yield-metric'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    uncapped: el.getAttribute('data-yield-uncapped'),
    max: el.getAttribute('data-yield-max'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number},
  game: {parliament: {phase?: {step: string, outcomes?: Array<{
    player: string, kind: string, amount?: number, count?: number, influence?: number, uncapped?: number,
    countedMetric?: {metric: string, value: number, over: number, step: number, sets: number, toNext: number},
  }>}}},
};

type Rect = {x: number, y: number, w: number, h: number};
type Chip = {id: string, x: number, y: number, res: string, amt: string};
type Sample = {
  t: number; stage: string; chips: Array<Chip>;
  mech: Rect | undefined; mechVisible: boolean;
  cell: Rect | undefined; cellVisible: boolean;
  stock: string; deltas: number; contexts: Array<string>;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__generousProbe: Probe};
    w.__generousProbe = {samples: []};
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
        const icon = el.querySelector<HTMLElement>('.con-transfer__icon');
        const res = icon === null ? 'megacredits' : (Array.from(icon.classList).find((c) => c.startsWith('resource_icon--')) ?? '').replace('resource_icon--', '');
        return {id: `${el.dataset.transferId ?? '?'}:${res}`, x: r.left + r.width / 2, y: r.top + r.height / 2, res, amt: el.textContent?.trim() ?? ''};
      });
      const card = document.querySelector('[data-parl-sit-hero] .con-parl__gov-card .pcard') ?? document.querySelector('.con-parl [data-parl-gov-carry] .con-parl__gov-card .pcard');
      const mech = card?.querySelector('.pcard__mech') ?? null;
      const row = document.querySelector('.con-res__row--megacredits');
      const cell = row?.querySelector('.con-res__stockwrap') ?? null;
      w.__generousProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        chips,
        mech: rectOf(mech),
        mechVisible: visible(mech),
        cell: rectOf(cell),
        cellVisible: visible(cell),
        stock: row?.querySelector('.con-res__digits')?.textContent?.trim() ?? '',
        deltas: row?.querySelectorAll('.delta-chip').length ?? 0,
        contexts: Array.from(document.querySelectorAll('.con-band [data-yield-context]')).map((el) => el.getAttribute('data-yield-context') ?? ''),
      });
      if (w.__generousProbe.samples.length > 9000) {
        w.__generousProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step', 'data-yield-context']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__generousProbe: Probe}).__generousProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__generousProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__generousProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('generous-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('generous-probe', {path: file, contentType: 'application/json'});
  }
});

function inside(p: {x: number, y: number}, r: Rect | undefined, slack = 2): boolean {
  return r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;
}
const centreOf = (r: Rect | undefined) => r === undefined ? undefined : {x: r.x + r.w / 2, y: r.y + r.h / 2};

/** The LANDING frame of a chip: the first sample from which it stays AT REST where it ends (the absorb scales it in place). */
function landingIndex(track: ReadonlyArray<{i: number, c: Chip}>, slack: number): number {
  const end = track[track.length - 1].c;
  let rest = track.length - 1;
  while (rest > 0 && Math.hypot(track[rest - 1].c.x - end.x, track[rest - 1].c.y - end.y) <= slack) {
    rest--;
  }
  return track[rest].i;
}

const digitsOf = (text: string): number => Number((text.match(/-?\d+/) ?? ['NaN'])[0]);

const REST_SLACK_PX = 1;
const TICK_WINDOW_BEFORE_MS = 34;
const TICK_WINDOW_AFTER_MS = 260;

const estimateAtVote: Reading = {context: 'estimate', count: '1', metric: '24', influence: '2', amount: '6', uncapped: null, max: null, skipped: null};
const forecastAtVote: Reading = {context: 'forecast', count: '1', metric: '24', influence: '3', amount: '8', uncapped: null, max: null, skipped: null};

test.describe('Generous Funding · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face, the vote\'s threshold-count reading with the win suffix, the breakdown of the rating — then the sitting: the +8 chip from the card\'s graphic onto the M€ cell, the counter ticking on contact', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-generous-vote', {query: '&consoleProfile=auto'});
    const red = seats[1];
    await armLeakWitness(page);
    await openParliament(page);

    // ── THE FACE in the voting area: its art (keyed by RX13), the Greens' emblem, the TR badge, «over 15», the +3 TR quest.
    const face = page.locator(`.con-parl__slot[data-instance="${GENEROUS_INSTANCE}"] .pcard`);
    await expect(face, 'Generous Funding stands in the voting area').toHaveCount(1);
    await expect(face).toHaveClass(GENEROUS_CLASS);
    expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX13');
    expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Greens\' emblem').toContain('greens');
    const trCount = await face.locator('.pcard__mech .pcard-ic').evaluateAll((els) => els.filter((el) => getComputedStyle(el).backgroundImage.includes('tr.png')).length);
    expect(trCount, 'the printed TR badge on the face').toBeGreaterThanOrEqual(1);
    await expect(face.locator('.pcard__mech .pvpcard'), 'no card glyph: this card counts a rating, not cards').toHaveCount(0);
    await expect(face.locator('.pcard__mech'), 'the threshold on the face').toContainText(/сверх 15|over 15/i);
    await expect(face.locator('.pcard__quest-graphic'), 'the +3 TR quest as a graphic').toHaveCount(1);
    await shoot(page, '01-overview');

    // ── THE VOTE MODE: «[TR] 24 → 1 set + [influence] 2 → +6 · +2 if you win · step 5» — ONE number and its suffix.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    await expect(page.locator('[data-parl-vote-yield]'), 'the threshold count + influence → M€ block').toHaveCount(1);
    expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([estimateAtVote]);
    await expect(page.locator('[data-parl-vote-yield] [data-yield-in="metric"]').first(), 'the rating itself stands in the reading').toHaveText('24');
    await expect(page.locator('[data-parl-vote-yield] [data-yield-in="count"]').first(), '…and what the rule made of it').toHaveText('1');
    await expect(page.locator('[data-parl-vote-yield] .con-iyield__sets').first(), 'the set noun beside the count').toHaveText(/набор|set/i);
    const suffix = page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]');
    await expect(suffix, 'the win suffix: one more influence at step 5').toHaveCount(1);
    await expect(suffix).toHaveAttribute('data-parl-vote-suffix', '2');
    await expect(suffix).toHaveAttribute('data-suffix-step', '5');
    await expect(page.locator('[data-parl-vote-yield] .con-iyield__max'), 'no cap on this card — no MAX mark').toHaveCount(0);
    await expect(page.locator('[data-parl-vote-yield] .pcglyph--metric[data-count-metric="terraformRating"]').first(), 'the counted object in the reading is the RATING badge').toBeVisible();
    await expect(page.locator('[data-parl-vote-yield] .con-iyield__unit--prod'), 'the unit is CASH, not production').toHaveCount(0);
    await expectParliamentFits(page, 'vote mode');
    await shoot(page, '02-vote-reading');

    // ── THE FULLSCREEN: the estimate and the «if you win» plate; the rules column prints the BREAKDOWN — never a list.
    await openZoomViewer(page);
    const zoom = page.locator('dialog.con-zoom[open]');
    await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(GENEROUS_CLASS);
    await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([estimateAtVote, forecastAtVote]);
    const rules = zoom.locator('.con-zoom-sidecol');
    await expect(rules, 'the rule says what a set is').toContainText(/РТ 25 — два|TR 25 is 2/);
    await expect(rules, 'the breakdown behind the number').toContainText(/Учтены сейчас|Counted right now/);
    await expect(rules, 'the rating').toContainText(/РТ 24|TR 24/);
    await expect(rules, 'the threshold').toContainText(/порог 15|threshold 15/);
    await expect(rules, 'the sets').toContainText(/1 полный набор|1 complete set/);
    await expect(rules, 'the distance to the next set').toContainText(/до следующего 1|1 to the next set/);
    await expect(rules, 'never «no card»').not.toContainText(/ни одна карта|No card counts/i);
    await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
    await shoot(page, '03-fullscreen');
    await closeZoomViewer(page);
    await press(page, 'Escape', 900);
    expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 1000}), 'back on the board').toBe(true);

    // ── THE GENERATION ENDS over the API: both seats pass — the political phase starts, the announce opens.
    await passAs(request, playerId);
    await expect.poll(async () => (await parliamentWire(request, red)).waitingFor?.type, {timeout: 20_000}).toBe('or');
    await passAs(request, red);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '04-verdict');

    // ── A answers gate 1; the other seat answers last over the API — the effects run.
    await armProbe(page);
    await press(page, 'Enter', 1200);
    await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000}).toBeUndefined();
    await expect(page.locator('.con-band [data-sit-awaiting]')).toHaveCount(1, {timeout: 15_000});
    const stockBefore = (await readProbe(page)).samples.slice(-1)[0].stock;
    await answerGateAs(request, red, 'assembly');

    // ── THE WAVE: the +8 chip born inside the carrier card's mechanic, landing on the M€ cell of the rail.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.stage === 'reward' && s.chips.some((c) => c.res === 'megacredits')),
      {timeout: 30_000, message: 'the M€ wave left the card on the reward page'}).toBe(true);
    // The reward page of a card that asks nothing stands only while its chip flies — the frame is taken in flight.
    await shoot(page, '05-reward-wave');
    await waitSittingAtRest(page, 30_000);
    const probe = await readProbe(page);
    const firstReading = probe.samples.findIndex((s) => s.stage === 'reward' && s.contexts.length > 0);
    expect(firstReading, 'the reward page read what was coming').toBeGreaterThanOrEqual(0);
    expect(probe.samples[firstReading].contexts.every((ctx) => ctx === 'resolving'), `«this payout» before the record, got ${probe.samples[firstReading].contexts.join(',')}`).toBe(true);
    const tracks = new Map<string, Array<{i: number, s: Sample, c: Chip}>>();
    probe.samples.forEach((s, i) => {
      for (const c of s.chips) {
        tracks.set(c.id, [...(tracks.get(c.id) ?? []), {i, s, c}]);
      }
    });
    const track = Array.from(tracks.values()).find((tr) => tr[0].c.res === 'megacredits' && tr[0].s.stage === 'reward');
    expect(track, 'a M€ chip flew on the reward page').toBeDefined();
    const first = track![0];
    const last = track![track!.length - 1];
    expect(first.c.amt, 'the chip carries the paid amount').toContain('8');
    // The SOURCE was visible when the chip was born, and the chip was born inside it.
    expect(first.s.mechVisible, `the carrier card's mechanic was VISIBLE at the birth (${JSON.stringify(first.s.mech)})`).toBe(true);
    expect(inside({x: first.c.x, y: first.c.y}, first.s.mech, 6), `the chip is BORN inside the card's printed mechanic (${JSON.stringify({chip: [first.c.x, first.c.y], mech: first.s.mech})})`).toBe(true);
    // …the DESTINATION was visible when it landed, and it landed there.
    expect(last.s.cellVisible, `the rail's M€ cell was VISIBLE at the landing (${JSON.stringify(last.s.cell)})`).toBe(true);
    expect(inside({x: last.c.x, y: last.c.y}, last.s.cell, 10), `the chip LANDED on the M€ cell (${JSON.stringify({chip: [last.c.x, last.c.y], cell: last.s.cell})})`).toBe(true);
    // …and it TRAVELLED the way between them.
    const travel = Math.hypot(last.c.x - first.c.x, last.c.y - first.c.y);
    const cc = centreOf(last.s.cell);
    const chord = cc === undefined ? Infinity : Math.hypot(cc.x - first.c.x, cc.y - first.c.y);
    expect(travel, `the chip TRAVELLED (${Math.round(travel)} px; icon → cell ${Math.round(chord)} px)`).toBeGreaterThan(Math.min(1080 * 0.2, chord * 0.85));
    // THE COUNTER TICKS ON CONTACT — in the landing's frame, never before the chip left the card, with its delta chip.
    // The digits span also hosts the ±N delta chip (the production phase's income chip may still stand there
    // when the probe is armed) — the VALUE is the leading integer, never the raw text.
    const tickAt = probe.samples.findIndex((s) => digitsOf(s.stock) !== digitsOf(stockBefore));
    const landedAt = landingIndex(track!, REST_SLACK_PX);
    expect(tickAt, `the M€ counter ticked (was «${stockBefore}»)`).toBeGreaterThan(0);
    const tickLag = probe.samples[tickAt].t - probe.samples[landedAt].t;
    expect(tickLag, `the tick rides the touchdown (${Math.round(tickLag)} ms after the rest)`).toBeGreaterThanOrEqual(-TICK_WINDOW_BEFORE_MS);
    expect(tickLag, `the tick rides the touchdown (${Math.round(tickLag)} ms after the rest)`).toBeLessThanOrEqual(TICK_WINDOW_AFTER_MS);
    expect(tickAt, 'the counter never moved BEFORE its chip left the card').toBeGreaterThanOrEqual(first.i);
    expect(probe.samples.some((s) => s.deltas > 0), 'a delta chip fired on the M€ row').toBe(true);
    // The whole +8 landed: the rail's number rose by exactly the payout.
    const settled = probe.samples[probe.samples.length - 1].stock;
    expect(digitsOf(settled) - digitsOf(stockBefore), `M€ ${stockBefore} → ${settled}: the whole +8 landed`).toBe(8);
    await shoot(page, '06-after-wave');

    // ── THE RECORD is the server's: +8 from ONE set (TR 24) and influence 3, the breakdown frozen, no cap sum.
    const wire = await fetchPlayerModel(request, playerId) as unknown as Wire;
    const mine = wire.game.parliament.phase?.outcomes?.find((o) => o.player === wire.thisPlayer.color);
    expect(mine).toMatchObject({kind: 'stock', amount: 8, count: 1, influence: 3});
    expect(mine?.uncapped, 'no cap declared — no sum beside the amount').toBeUndefined();
    expect(mine?.countedMetric).toEqual({metric: 'terraformRating', value: 24, over: 15, step: 5, sets: 1, toNext: 1});
    expect(wire.thisPlayer.terraformRating, 'an influence step: the rating stood at 24').toBe(24);
    expect(wire.thisPlayer.megacredits).toBe(digitsOf(settled));

    // ── A card that asks nothing: the results follow the wave; at rest the reading says «received».
    await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    await settle(page, {timeoutMs: 30_000});
    await expectParliamentFits(page, 'results');
    await shoot(page, '07-results');
    expect(await strandedReports(page)).toEqual([]);
  });
});
