import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, openParliament, parliament, parliamentWire, passAs, sittingStage,
  strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * MIGRATION FUNDING (Turmoil Redux, RX21) — the first counted term paid by a
 * QUANTITY the engine sums: 2 M€ per CITY ON MARS, each tier of a stack
 * separately, + 2 per influence, no cap.
 *
 * ONE e2e on ONE profile — the card's verification budget: the only new
 * mechanism is the board count of the `tiers` measure and its explanation,
 * everything else is the family's and stands on the units of RX08 / RX13. One
 * pass:
 *   · the VOTE: the viewer holds THREE city cells on Mars, one of them a STACK
 *     of 2 (four cities), and influence 3 — the panel reads «[city] 4 +
 *     [influence] 3 → +14» (ONE number, no cap mark, no win suffix: the next
 *     Agenda step is a TR step), the counted object is the BARE city tile (no
 *     footnote spark — that is the space city's), the unit is CASH; the face
 *     prints the city without a spark and no «max»; the fullscreen explains the
 *     four as «3 cells · a stack of 2» and states the rule of the stack;
 *   · the REWARD stage of the sitting that follows (both seats pass over the
 *     API, the announce opens, A answers gate 1, the other seat answers over
 *     the API): the +14 chip is BORN inside the carrier card's printed mechanic
 *     (visible), LANDS on the rail's M€ cell (visible), the counter TICKS in
 *     the landing's frame with its delta chip, and — a card that asks nothing
 *     — the results follow; the record carries the three cells and their
 *     heights.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; a sample
 * carries whether the source and the destination were VISIBLE (a non-zero
 * rect, a non-zero effective opacity, nothing over their centre).
 * Fixture: `parliament-migration-vote`. Screenshots under
 * screenshots/parliament-migration/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-migration', 'standard-1080');
const MIGRATION_ID = 'RDX_MARSFIRST_MIGRATION_FUNDING';
const MIGRATION_INSTANCE = `${MIGRATION_ID}#0`;
const MIGRATION_CLASS = /rdx-marsfirst-migration-funding/;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

type Reading = {context: string | null, count: string | null, influence: string | null, amount: string | null, uncapped: string | null, max: string | null, skipped: string | null};

/** The readings a yield block prints, by context — every input the number stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    count: el.getAttribute('data-yield-count'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    uncapped: el.getAttribute('data-yield-uncapped'),
    max: el.getAttribute('data-yield-max'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

type Wire = {
  thisPlayer: {color: string, megacredits: number, citiesCount: number},
  game: {
    spaces: Array<{id: string, tileType?: number, color?: string, stackHeight?: number}>,
    parliament: {phase?: {step: string, outcomes?: Array<{
      player: string, kind: string, amount?: number, count?: number, influence?: number, uncapped?: number,
      countedSpaces?: Array<string>, countedTiers?: Array<number>,
    }>}},
  },
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
    const w = window as unknown as {__migrationProbe: Probe};
    w.__migrationProbe = {samples: []};
    const rectOf = (el: Element | null): Rect | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width < 2 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    // VISIBLE: a non-zero rect, a non-zero EFFECTIVE opacity (an ancestor fades its children by fading itself),
    // and nothing over the object's own centre (the hit is the object, a part of it, or something it sits inside).
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
      // A chip is sampled once the director has POSED it (its inline transform is written on the tick after
      // its mount); its identity is the flight layer's own id — a list index shifts as earlier chips are absorbed.
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
      w.__migrationProbe.samples.push({
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
      if (w.__migrationProbe.samples.length > 9000) {
        w.__migrationProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step', 'data-yield-context']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__migrationProbe: Probe}).__migrationProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__migrationProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__migrationProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('migration-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('migration-probe', {path: file, contentType: 'application/json'});
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

/** Four cities (three cells, one a stack of 2) and influence 3: (4 + 3) × 2 = 14 — no cap, so no sum beside it and no MAX mark. */
const estimateAtVote: Reading = {context: 'estimate', count: '4', influence: '3', amount: '14', uncapped: null, max: null, skipped: null};

test.describe('Migration Funding · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face, the vote\'s tiers-count reading (four cities from three cells), the stack explained in the fullscreen — then the sitting: the +14 chip from the card\'s graphic onto the M€ cell, the counter ticking on contact', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-migration-vote', {query: '&consoleProfile=auto'});
    const red = seats[1];
    await armLeakWitness(page);

    // ── THE TABLE is the fixture's promise: the viewer's three city cells, one of them a stack of 2 — the board shows the stack.
    const before = await fetchPlayerModel(request, playerId) as unknown as Wire;
    const mine = before.game.spaces.filter((s) => s.color === before.thisPlayer.color && s.tileType !== undefined);
    expect(mine, 'three city cells of the viewer').toHaveLength(3);
    expect(mine.filter((s) => s.stackHeight === 2), 'one of them a stack of 2').toHaveLength(1);
    expect(before.thisPlayer.citiesCount, 'the engine counts four cities — the tier apiece').toBe(4);
    await expect(page.locator('[data-stack-height="2"]'), 'the stack stands on the board with its counter').toHaveCount(1);
    await openParliament(page);

    // ── THE FACE in the voting area: its art (keyed by RX21), the Mars First emblem, the BARE city (no spark), no «max», the two-cities quest.
    const face = page.locator(`.con-parl__slot[data-instance="${MIGRATION_INSTANCE}"] .pcard`);
    await expect(face, 'Migration Funding stands in the voting area').toHaveCount(1);
    await expect(face).toHaveClass(MIGRATION_CLASS);
    expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX21');
    expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Mars First emblem').toContain('mars');
    const cityCount = await face.locator('.pcard__mech .pcard-ic').evaluateAll((els) => els.filter((el) => getComputedStyle(el).backgroundImage.includes('city.png')).length);
    expect(cityCount, 'the printed city tile on the face').toBeGreaterThanOrEqual(1);
    await expect(face.locator('.pcard__mech .pcard-sym--asterix'), 'NO footnote spark: a city ON Mars, not a space city').toHaveCount(0);
    await expect(face.locator('.pcard__mech .pvpcard'), 'no card glyph: this card counts tiles, not cards').toHaveCount(0);
    await expect(face.locator('.pcard__mech'), 'no cap on the face').not.toContainText(/макс|max/i);
    await expect(face.locator('.pcard__quest-graphic'), 'the two-cities quest as a graphic').toHaveCount(1);
    await shoot(page, '01-overview');

    // ── THE VOTE MODE: «[city] 4 + [influence] 3 → +14» — ONE number, no cap, no suffix (a TR step next).
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    await expect(page.locator('[data-parl-vote-yield]'), 'the board count + influence → M€ block').toHaveCount(1);
    expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([estimateAtVote]);
    await expect(page.locator('[data-parl-vote-yield] [data-yield-in="count"]').first(), 'FOUR cities — the stack counted per tier, from three cells').toHaveText('4');
    await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]'), 'no win suffix: the next Agenda step is a TR step').toHaveCount(0);
    await expect(page.locator('[data-parl-vote-yield] .con-iyield__max'), 'no cap on this card — no MAX mark').toHaveCount(0);
    const glyph = page.locator('[data-parl-vote-yield] .pcglyph--tile[data-count-tile="marsCity"]').first();
    await expect(glyph, 'the counted object in the reading is the city TILE').toBeVisible();
    await expect(glyph.locator('.pcglyph__spark'), '…BARE: the spark is the space city\'s').toHaveCount(0);
    await expect(page.locator('[data-parl-vote-yield] .con-iyield__unit--prod'), 'the unit is CASH, not production').toHaveCount(0);
    await expectParliamentFits(page, 'vote mode');
    await shoot(page, '02-vote-reading');

    // ── THE FULLSCREEN: the same number; the rules column states the rule of the stack and explains the four — three cells, a stack of 2.
    await openZoomViewer(page);
    const zoom = page.locator('dialog.con-zoom[open]');
    await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(MIGRATION_CLASS);
    await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([estimateAtVote]);
    const rules = zoom.locator('.con-zoom-sidecol');
    await expect(rules, 'the rule of the stack').toContainText(/стопка из двух даёт 2|a stack of two counts twice/i);
    await expect(rules, 'the counted cells behind the number').toContainText(/Учтены сейчас|Counted right now/);
    await expect(rules, 'the number of cities').toContainText(/4 города на Марсе|4 cit(y|ies) on Mars/);
    await expect(rules, '…on how many cells').toContainText(/3 клетки|3 cell/);
    await expect(rules, '…and the stack that makes the difference').toContainText(/стопка из 2|a stack of 2/);
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

    // ── THE WAVE: the +14 chip born inside the carrier card's mechanic, landing on the M€ cell of the rail.
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
    expect(first.c.amt, 'the chip carries the paid amount').toContain('14');
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
    // when the probe is armed) — the VALUE is the leading integer, never the raw text. And the BASELINE is the
    // value the rail shows when the chip is BORN, not the one at the verdict: the enactment stage moves the
    // supply on its own account first (the Agenda step's bonus, a party's reaction), and that change is not
    // this wave's tick (measured: «60» at the verdict, «62 +2» in the enact stage, «76 +14» at the landing).
    const baseline = digitsOf(probe.samples[first.i].stock);
    const tickAt = probe.samples.findIndex((s, i) => i >= first.i && digitsOf(s.stock) !== baseline);
    const landedAt = landingIndex(track!, REST_SLACK_PX);
    expect(tickAt, `the M€ counter ticked (was «${baseline}» when the chip was born; «${stockBefore}» at the verdict)`).toBeGreaterThan(0);
    const tickLag = probe.samples[tickAt].t - probe.samples[landedAt].t;
    expect(tickLag, `the tick rides the touchdown (${Math.round(tickLag)} ms after the rest)`).toBeGreaterThanOrEqual(-TICK_WINDOW_BEFORE_MS);
    expect(tickLag, `the tick rides the touchdown (${Math.round(tickLag)} ms after the rest)`).toBeLessThanOrEqual(TICK_WINDOW_AFTER_MS);
    expect(probe.samples.slice(first.i, tickAt).every((s) => digitsOf(s.stock) === baseline), 'the counter never moved between the chip\'s birth and its landing').toBe(true);
    expect(probe.samples[tickAt].deltas, 'a delta chip fired on the M€ row with the tick').toBeGreaterThan(0);
    // The whole +14 landed: the rail's number rose by exactly the payout.
    const settled = probe.samples[probe.samples.length - 1].stock;
    expect(digitsOf(settled) - baseline, `M€ ${baseline} → ${settled}: the whole +14 landed`).toBe(14);
    await shoot(page, '06-after-wave');

    // ── THE RECORD is the server's: +14 from FOUR cities on THREE cells (one of height 2) and influence 3; no cap sum.
    const wire = await fetchPlayerModel(request, playerId) as unknown as Wire;
    const record = wire.game.parliament.phase?.outcomes?.find((o) => o.player === wire.thisPlayer.color);
    expect(record).toMatchObject({kind: 'stock', amount: 14, count: 4, influence: 3});
    expect(record?.uncapped, 'no cap declared — no sum beside the amount').toBeUndefined();
    expect(record?.countedSpaces, 'three cells — the stack is never listed twice').toHaveLength(3);
    expect([...(record?.countedTiers ?? [])].sort(), 'the heights: 1 · 1 · 2').toEqual([1, 1, 2]);
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
