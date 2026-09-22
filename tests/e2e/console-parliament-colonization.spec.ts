import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle} from './consoleStart';
import {
  answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, openParliament, parliament, parliamentWire, passAs, sittingStage,
  strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * COLONIZATION FUNDING (Turmoil Redux, RX08) — the first counted term that
 * reads the BOARD: +2 M€ production per SPACE CITY + 1 per influence, max 6.
 *
 * ONE e2e on ONE profile — the card's verification budget: the only new
 * mechanism is the board count, everything else is the family's and stands on
 * the units of RX02 / RX04 / RX06 / RX07. One pass:
 *   · the VOTE: the viewer holds TWO space cities (Ganymede Colony, Phobos
 *     Space Haven) and influence 3 — the panel reads «[city*] 2 + [influence]
 *     3 → +6 · max» (the sum 7 in the data), the counted object is the TILE
 *     glyph, ONE number and no win suffix (the next Agenda step is a TR step);
 *     the face prints the city with its spark and «max 6»; the fullscreen names
 *     the two CELLS by the board's own names and states the rule;
 *   · the REWARD stage of the sitting that follows (both seats pass over the
 *     API, the announce opens, A answers gate 1, the other seat answers over
 *     the API): the chip is BORN inside the carrier card's printed mechanic
 *     (visible), LANDS on the rail's M€ production cell (visible), the counter
 *     TICKS in the landing's frame with its delta chip, the reading turns
 *     «received», and — a card that asks nothing — the results follow.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF; a sample
 * carries whether the source and the destination were VISIBLE (a non-zero
 * rect, a non-zero effective opacity, nothing over their centre) — a probe
 * that only saw an event fire is treated as absent.
 * Fixture: `parliament-colonization-vote`. Screenshots under
 * screenshots/parliament-colonization/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-colonization', 'standard-1080');
const FUNDING_ID = 'RDX_UNITY_COLONIZATION_FUNDING';
const FUNDING_INSTANCE = `${FUNDING_ID}#0`;
const FUNDING_CLASS = /rdx-unity-colonization-funding/;

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
  thisPlayer: {color: string, megacreditProduction: number},
  game: {parliament: {phase?: {step: string, outcomes?: Array<{player: string, kind: string, amount?: number, count?: number, countedSpaces?: Array<string>, influence?: number, uncapped?: number}>}}},
};

type Rect = {x: number, y: number, w: number, h: number};
type Chip = {id: string, x: number, y: number, res: string, amt: string};
type Sample = {
  t: number; stage: string; chips: Array<Chip>;
  mech: Rect | undefined; mechVisible: boolean;
  cell: Rect | undefined; cellVisible: boolean;
  prod: string; deltas: number; contexts: Array<string>;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__fundingProbe: Probe};
    w.__fundingProbe = {samples: []};
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
      const cell = row?.querySelector('.con-res__prod') ?? null;
      w.__fundingProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        chips,
        mech: rectOf(mech),
        mechVisible: visible(mech),
        cell: rectOf(cell),
        cellVisible: visible(cell),
        prod: cell?.textContent?.trim() ?? '',
        deltas: row?.querySelectorAll('.delta-chip').length ?? 0,
        contexts: Array.from(document.querySelectorAll('.con-band [data-yield-context]')).map((el) => el.getAttribute('data-yield-context') ?? ''),
      });
      if (w.__fundingProbe.samples.length > 9000) {
        w.__fundingProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step', 'data-yield-context']});
    window.setInterval(sample, 16);
  });
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__fundingProbe: Probe}).__fundingProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__fundingProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__fundingProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('funding-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('funding-probe', {path: file, contentType: 'application/json'});
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

const REST_SLACK_PX = 1;
const TICK_WINDOW_BEFORE_MS = 34;
const TICK_WINDOW_AFTER_MS = 260;

const readingAtMax: Reading = {context: 'estimate', count: '2', influence: '3', amount: '6', uncapped: '7', max: 'true', skipped: null};

test.describe('Colonization Funding · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the face, the vote\'s board-count reading at the maximum, the cells by name — then the sitting: the +6 chip from the card\'s graphic onto the M€ production cell, the counter ticking on contact', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-colonization-vote', {query: '&consoleProfile=auto'});
    const red = seats[1];
    await armLeakWitness(page);
    await openParliament(page);

    // ── THE FACE in the voting area: its art (keyed by RX08), Unity's emblem, the CITY with the footnote spark, «max 6».
    const face = page.locator(`.con-parl__slot[data-instance="${FUNDING_INSTANCE}"] .pcard`);
    await expect(face, 'Colonization Funding stands in the voting area').toHaveCount(1);
    await expect(face).toHaveClass(FUNDING_CLASS);
    expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX08');
    expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'Unity\'s emblem').toContain('unity');
    const cityIcons = face.locator('.pcard__mech .pcard-ic').filter({has: page.locator(':scope')});
    const cityCount = await cityIcons.evaluateAll((els) => els.filter((el) => getComputedStyle(el).backgroundImage.includes('city.png')).length);
    expect(cityCount, 'the printed city tile on the face').toBeGreaterThanOrEqual(1);
    await expect(face.locator('.pcard__mech .pcard-sym--asterix'), 'the footnote spark — a SPACE city').toHaveCount(1);
    await expect(face.locator('.pcard__mech .pvpcard'), 'no card glyph: this card counts tiles, not cards').toHaveCount(0);
    await expect(face.locator('.pcard__mech'), 'the cap on the face').toContainText(/макс\. 6|max 6/i);
    await expect(face.locator('.pcard__quest-graphic'), 'the one-space-city quest as a graphic').toHaveCount(1);
    await shoot(page, '01-overview');

    // ── THE VOTE MODE: «[city*] 2 + [influence] 3 → +6 · max» — ONE number, no suffix (a win adds nothing at the maximum).
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    await expect(page.locator('[data-parl-vote-yield]'), 'the board count + influence → production block').toHaveCount(1);
    expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([readingAtMax]);
    await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]'), 'no win suffix: the number already stands at the maximum').toHaveCount(0);
    await expect(page.locator('[data-parl-vote-yield] .con-iyield__max').first(), 'the reading says MAX beside the amount').toBeVisible();
    await expect(page.locator('[data-parl-vote-yield] .pcglyph--tile[data-count-tile="spaceCity"]').first(), 'the counted object in the reading is the TILE with its spark').toBeVisible();
    await expect(page.locator('[data-parl-vote-yield] .con-iyield__unit--prod').first(), 'the unit is PRODUCTION').toBeVisible();
    await expectParliamentFits(page, 'vote mode');
    await shoot(page, '02-vote-reading');

    // ── THE FULLSCREEN: the footer reads the same number; the rules column names the two CELLS by the board's own names.
    await openZoomViewer(page);
    const zoom = page.locator('dialog.con-zoom[open]');
    await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(FUNDING_CLASS);
    await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([readingAtMax]);
    const rules = zoom.locator('.con-zoom-sidecol');
    await expect(rules, 'the rule names what a space city is').toContainText(/вне Марса|off Mars/i);
    await expect(rules, 'the counted cells behind the number').toContainText(/Учтены сейчас|Counted right now/);
    await expect(rules, 'Ganymede Colony by the board\'s own name').toContainText(/Колония на Ганимеде|Ganymede Colony/);
    await expect(rules, 'Phobos Space Haven by the board\'s own name').toContainText(/Космопорт на Фобосе|Phobos Space Haven/);
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
    const prodBefore = (await readProbe(page)).samples.slice(-1)[0].prod;
    await answerGateAs(request, red, 'assembly');

    // ── THE WAVE: the +6 chip born inside the carrier card's mechanic, landing on the M€ production cell.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.chips.length > 0), {timeout: 30_000, message: 'the wave left the card'}).toBe(true);
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
    const track = Array.from(tracks.values()).find((tr) => tr[0].c.res === 'megacredits');
    expect(track, 'a M€ production chip flew').toBeDefined();
    const first = track![0];
    const last = track![track!.length - 1];
    expect(first.c.amt, 'the chip carries the paid amount').toContain('6');
    // The SOURCE was visible when the chip was born, and the chip was born inside it.
    expect(first.s.mechVisible, `the carrier card's mechanic was VISIBLE at the birth (${JSON.stringify(first.s.mech)})`).toBe(true);
    expect(inside({x: first.c.x, y: first.c.y}, first.s.mech, 6), `the chip is BORN inside the card's printed mechanic (${JSON.stringify({chip: [first.c.x, first.c.y], mech: first.s.mech})})`).toBe(true);
    // …the DESTINATION was visible when it landed, and it landed there.
    expect(last.s.cellVisible, `the rail's M€ production cell was VISIBLE at the landing (${JSON.stringify(last.s.cell)})`).toBe(true);
    expect(inside({x: last.c.x, y: last.c.y}, last.s.cell, 10), `the chip LANDED on the M€ production cell (${JSON.stringify({chip: [last.c.x, last.c.y], cell: last.s.cell})})`).toBe(true);
    // …and it TRAVELLED the way between them.
    const travel = Math.hypot(last.c.x - first.c.x, last.c.y - first.c.y);
    const cc = centreOf(last.s.cell);
    const chord = cc === undefined ? Infinity : Math.hypot(cc.x - first.c.x, cc.y - first.c.y);
    expect(travel, `the chip TRAVELLED (${Math.round(travel)} px; icon → cell ${Math.round(chord)} px)`).toBeGreaterThan(Math.min(1080 * 0.2, chord * 0.85));
    // THE COUNTER TICKS ON CONTACT — in the landing's frame, never before the chip left the card, with its delta chip.
    const tickAt = probe.samples.findIndex((s) => s.prod !== prodBefore);
    const landedAt = landingIndex(track!, REST_SLACK_PX);
    expect(tickAt, `the M€ production counter ticked (was «${prodBefore}»)`).toBeGreaterThan(0);
    const tickLag = probe.samples[tickAt].t - probe.samples[landedAt].t;
    expect(tickLag, `the tick rides the touchdown (${Math.round(tickLag)} ms after the rest)`).toBeGreaterThanOrEqual(-TICK_WINDOW_BEFORE_MS);
    expect(tickLag, `the tick rides the touchdown (${Math.round(tickLag)} ms after the rest)`).toBeLessThanOrEqual(TICK_WINDOW_AFTER_MS);
    expect(tickAt, 'the counter never moved BEFORE its chip left the card').toBeGreaterThanOrEqual(first.i);
    expect(probe.samples.some((s) => s.deltas > 0), 'a delta chip fired on the M€ row').toBe(true);
    expect(probe.samples[tickAt].prod, 'production 3 → 9: the whole +6 landed').toBe('9');
    await shoot(page, '05-after-wave');

    // ── THE RECORD is the server's: +6 from 2 cells and influence 3, the sum 7 before the cap.
    const wire = await fetchPlayerModel(request, playerId) as unknown as Wire;
    const mine = wire.game.parliament.phase?.outcomes?.find((o) => o.player === wire.thisPlayer.color);
    expect(mine).toMatchObject({kind: 'production', amount: 6, count: 2, influence: 3, uncapped: 7});
    expect(mine?.countedSpaces).toEqual(['01', '02']);
    expect(wire.thisPlayer.megacreditProduction).toBe(9);

    // ── A card that asks nothing: the results follow the wave; at rest the reading says «received».
    await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    await settle(page, {timeoutMs: 30_000});
    await expectParliamentFits(page, 'results');
    await shoot(page, '06-results');
    expect(await strandedReports(page)).toEqual([]);
  });
});
