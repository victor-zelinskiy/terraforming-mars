import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle,
} from './consoleStart';
import {
  answerGateAs, closeSitting, armLeakWitness, expectParliamentFits, mandatoryPlate, openParliament, parliament, parliamentWire, sittingStage, strandedReports,
  waitSittingAtRest,
} from './parliamentDrive';

/**
 * GREENS BUDGET (Turmoil Redux, RX34) — the ONE e2e of the card's one new thing:
 * a law that asks ONE seat TWO questions IN A ROW. Everything else it does is
 * assembled from shipped parts (the levy of RX15, the tag count of RX29, the
 * picker of RX01), so the journey is measured for its ORDER — four beats of
 * one seat, in turn, never on top of each other — on one profile:
 *
 *   PART 1 · THE VOTE (fixture `parliament-greens-vote`): the panel reads the
 *   levy at the head of the money's plate, the three-tag breakdown behind the
 *   number («[plant] 1 + [microbe] 2 + [animal] 2 + [influence] 1 → +6»), the
 *   NET at its tail («= −4»), the win suffix, and the two PORTIONS as rows of
 *   their own — flat, with nothing bought them. The fullscreen prints the
 *   levy row and the breakdown by tag.
 *
 *   PART 2 · THE SITTING (fixture `parliament-greens-assembly`; blue wins):
 *   ① the levy's chip «−10» leaves the rail for the law and only then the
 *   «+7» comes back and ticks the counter — the money is settled BEFORE the
 *   first question; ② the ANIMALS' picker stands inside the Parliament's
 *   stage (two holders, the crumb continuous), A commits the focused card and
 *   a «+2» chip lands on ITS capsule; ③ only then the MICROBES' picker takes
 *   the same stage (two other holders) — the second question of the same
 *   seat, never side by side with the first — and A lands «+3» the same way;
 *   ④ the results row reads the four parts in the printed order with the
 *   cards each portion landed on, and the NET; the other seat, with no holder
 *   of either kind, reads its two portions NAMED and forfeited.
 *
 * The probe is `MutationObserver` + `setInterval` — never rAF. Screens under
 * screenshots/parliament-greens/standard-1080/.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-greens', 'standard-1080');
const BUDGET_ID = 'RDX_GREENS_GREENS_BUDGET';
const BUDGET_INSTANCE = `${BUDGET_ID}#0`;
const BUDGET_CLASS = /rdx-greens-greens-budget/;
const STAGE = '.con-parl [data-embed-slot="parliament-stage"]';
const SLOTS = `${STAGE} .con-cards__slot`;
const ANIMAL_HOLDERS = ['Fish', 'Pets'];
const MICROBE_HOLDERS = ['GHG Producing Bacteria', 'Tardigrades'];

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

type Outcome = {
  player: string, step: string, kind: string, amount?: number, owed?: number, count?: number, influence?: number, card?: string, reason?: string,
  countedByTag?: Array<{tag: string, count: number}>, before?: number, after?: number,
};
type Wire = {
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string, resources?: number}>},
  game: {generation: number, parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
  waitingFor?: {type?: string, cards?: Array<{name: string}>},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Chip = {id: string, x: number, y: number, dir: string, amt: string};
type Sample = {
  t: number; stage: string; step: string; chips: Array<Chip>;
  /** The candidates the stage's picker shows right now (their card names), and the focused one. */
  slots: Array<string>; focused: string;
  /** Each candidate's resource capsule, as printed. */
  capsules: Record<string, string>;
  mc: string;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — armed BEFORE the gate is answered. `setInterval` + `MutationObserver`, never rAF. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate((slots) => {
    const w = window as unknown as {__greensProbe: Probe};
    w.__greensProbe = {samples: []};
    const sample = () => {
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        return {id: `${el.dataset.transferId ?? '?'}`, x: r.left + r.width / 2, y: r.top + r.height / 2, dir: el.dataset.transferDirection ?? 'gain', amt: el.textContent?.trim() ?? ''};
      });
      const slotEls = Array.from(document.querySelectorAll<HTMLElement>(slots));
      const capsules: Record<string, string> = {};
      for (const el of slotEls) {
        const name = el.getAttribute('data-zoom-slot') ?? '';
        capsules[name] = el.querySelector('.pcard__res-count')?.textContent?.trim() ?? '';
      }
      w.__greensProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        step: document.querySelector('.con-sit')?.getAttribute('data-sit-step') ?? '',
        chips,
        slots: slotEls.map((el) => el.getAttribute('data-zoom-slot') ?? ''),
        focused: slotEls.find((el) => el.classList.contains('con-cards__slot--focused'))?.getAttribute('data-zoom-slot') ?? '',
        capsules,
        mc: ((document.querySelector('.con-res__row--megacredits .con-res__digits')?.textContent?.trim() ?? '').match(/^-?\d+/) ?? [''])[0],
      });
      if (w.__greensProbe.samples.length > 9000) {
        w.__greensProbe.samples.splice(0, 1500);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'data-sitting-stage', 'data-sit-step']});
    window.setInterval(sample, 16);
  }, SLOTS);
}
const readProbe = (page: Page) => page.evaluate(() => (window as unknown as {__greensProbe: Probe}).__greensProbe);

/** A red run carries its own evidence: the probe's tail rides the report. */
test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__greensProbe?: Probe, __conReady?: () => unknown};
    return {samples: w.__greensProbe?.samples.slice(-3000) ?? [], ready: w.__conReady?.()};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('greens-probe.json');
    fs.writeFileSync(file, JSON.stringify(evidence));
    await testInfo.attach('greens-probe', {path: file, contentType: 'application/json'});
  }
});

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

/** The LANDING frame of a chip: the first sample from which it stays AT REST where it ends (the absorb scales it in place). */
function landingIndex(track: ReadonlyArray<{i: number, c: Chip}>, slack = 1): number {
  const end = track[track.length - 1].c;
  let rest = track.length - 1;
  while (rest > 0 && Math.hypot(track[rest - 1].c.x - end.x, track[rest - 1].c.y - end.y) <= slack) {
    rest--;
  }
  return track[rest].i;
}

/** The first sample index at or after `from` where `pick` holds (−1 when none). */
function firstIndex(samples: ReadonlyArray<Sample>, from: number, pick: (s: Sample) => boolean): number {
  for (let i = Math.max(0, from); i < samples.length; i++) {
    if (pick(samples[i])) {
      return i;
    }
  }
  return -1;
}

const sorted = (names: ReadonlyArray<string>): Array<string> => [...names].sort();

test.describe('Greens Budget · standard-1080', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the vote reads the levy, the three-tag breakdown, the net and the two flat portions; the sitting pays the money first, then asks the SAME seat twice — animals, then microbes — each landing on its chosen card, and the results name all four', async ({page, request}) => {
    test.setTimeout(600_000);

    // ════════════════ PART 1 · THE VOTE — the net at the tail, the portions as rows of their own ════════════════
    {
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-greens-vote', {query: '&consoleProfile=auto'});
      await armLeakWitness(page);
      await openParliament(page);

      // ── THE FACE in the voting area: its art (keyed by RX34), the Greens' emblem, the printed «−10» tile, the two portion squares, the plant-tag quest.
      const face = page.locator(`.con-parl__slot[data-instance="${BUDGET_INSTANCE}"] .pcard`);
      await expect(face, 'Greens Budget stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(BUDGET_CLASS);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX34');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Greens\' emblem').toContain('greens');
      await expect(face.locator('.pcard__mech .pcard-mi--mc').first(), 'the negative is printed INSIDE the tile, as on the card').toHaveText('−10');
      await expect(face.locator('.pcard__quest-graphic'), 'the 2-plant-tag quest as a graphic').toHaveCount(1);
      await shoot(page, '01-overview');

      // ── THE VOTE MODE: «−10 → [plant] 1 + [microbe] 2 + [animal] 2 + [influence] 1 → +6 = −4 · +1 if you win · step 3», then «2 [animal]» and «3 [microbe]» flat.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const block = page.locator('[data-parl-vote-yield]');
      await expect(block, 'the levy + tag count → M€ block').toHaveCount(1);
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        {effect: 'megacredits', context: 'estimate', count: '5', influence: '1', amount: '6', net: '-4', skipped: null},
        {effect: 'animals', context: 'estimate', count: null, influence: '1', amount: '2', net: null, skipped: null},
        {effect: 'microbes', context: 'estimate', count: null, influence: '1', amount: '3', net: null, skipped: null},
      ]);
      const levy = block.locator('[data-yield-levy]');
      await expect(levy, 'the levy at the HEAD of the money\'s plate').toHaveCount(1);
      await expect(levy).toHaveAttribute('data-yield-levy-paid', '10');
      await expect(levy).toHaveAttribute('data-yield-levy-owed', '10');
      // THE BREAKDOWN BY TAG, in the printed rule's order: plant 1 · microbe 2 · animal 2.
      await expect(block.locator('[data-yield-in="tag:plant"]').first()).toHaveText('1');
      await expect(block.locator('[data-yield-in="tag:microbe"]').first()).toHaveText('2');
      await expect(block.locator('[data-yield-in="tag:animal"]').first()).toHaveText('2');
      await expect(block.locator('[data-yield-in="influence"]').first()).toHaveText('1');
      const net = block.locator('[data-yield-net-line]');
      await expect(net, 'the NET at the tail').toHaveCount(1);
      await expect(net).toHaveAttribute('data-yield-net-amount', '-4');
      const suffix = block.locator('[data-parl-vote-suffix]');
      await expect(suffix, 'the win suffix: one more influence at step 3 — the money alone').toHaveCount(1);
      await expect(suffix).toHaveAttribute('data-parl-vote-suffix', '1');
      await expect(suffix).toHaveAttribute('data-suffix-step', '3');
      // THE PORTIONS: flat rows — no inputs printed (nothing bought them), never inside the net.
      await expect(block.locator('[data-yield-effect="animals"] [data-yield-in]'), 'a flat portion prints no inputs').toHaveCount(0);
      await expect(block.locator('[data-yield-effect="microbes"] [data-yield-in]')).toHaveCount(0);
      await expect(block.locator('[data-yield-note]'), 'both kinds can land and the seat can pay — no note').toHaveCount(0);
      await expectParliamentFits(page, 'vote mode');
      await shoot(page, '02-vote-net-and-portions');

      // ── THE FULLSCREEN: the levy row, the breakdown by TAG behind the number — the cards that made it.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(BUDGET_CLASS);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        {effect: 'megacredits', context: 'estimate', count: '5', influence: '1', amount: '6', net: '-4', skipped: null},
        {effect: 'megacredits', context: 'forecast', count: '5', influence: '2', amount: '7', net: '-3', skipped: null},
        {effect: 'animals', context: 'estimate', count: null, influence: '1', amount: '2', net: null, skipped: null},
        {effect: 'microbes', context: 'estimate', count: null, influence: '1', amount: '3', net: null, skipped: null},
      ]);
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules, 'the levy row').toContainText(/Плата: сначала 10 M€|Levy: 10 M€ first/);
      await expect(rules, 'the rule says what counts').toContainText(/Универсальные метки не считаются|Wild tags do not count/);
      await expect(rules, 'the breakdown behind the number').toContainText(/Учтены сейчас|Counted right now/);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, '03-fullscreen-breakdown');
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 15_000});
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      void playerId;
    }

    // ════════════════ PART 2 · THE SITTING — the money first, then two questions to one seat, in turn ════════════════
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-greens-assembly', {query: '&consoleProfile=auto', landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);
    const before = await wireOf(request, playerId);
    const blue = before.thisPlayer.color;
    await shoot(page, '04-verdict');

    // ── GATE 1: A on the verdict; red answers over the API — the effects run by themselves.
    await armProbe(page);
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

    // ── ① THE MONEY IS SETTLED FIRST: −10 leaves the rail, +7 comes back — and the server already holds the animals' question.
    await expect.poll(async () => {
      const outcomes = (await wireOf(request, playerId)).game.parliament.phase?.outcomes ?? [];
      const mine = outcomes.filter((o) => o.player === blue);
      return mine.find((o) => o.step === 'levy')?.amount === -10 && mine.find((o) => o.step === 'megacredits')?.amount !== undefined;
    }, {timeout: 60_000, message: 'the seat\'s own levy and payout are recorded'}).toBe(true);
    const paidRecord = ((await wireOf(request, playerId)).game.parliament.phase?.outcomes ?? []).find((o) => o.player === blue && o.step === 'megacredits')!;
    expect(paidRecord.count, 'plant 1 + microbe 2 + animal 2 (the corporation may print none of the three)').toBeGreaterThanOrEqual(5);
    expect(paidRecord.influence, 'the winner\'s Agenda step 2 → 3 = influence 2').toBe(2);
    expect(paidRecord.amount).toBe((paidRecord.count ?? 0) + 2);
    expect(paidRecord.countedByTag?.map((e) => e.tag), 'the breakdown rides the record in the printed rule\'s order').toEqual(['plant', 'microbe', 'animal']);
    const paid = paidRecord.amount ?? 0;
    const netMc = String(before.thisPlayer.megacredits - 10 + paid);

    // ── ② THE ANIMALS' PICKER stands inside the Parliament's stage: two holders, the crumb continuous, the M€ already netted.
    await expect.poll(async () => sorted((await readProbe(page)).samples.slice(-1)[0]?.slots ?? []), {timeout: 60_000, message: 'the animals\' picker shows Fish and Pets'}).toEqual(ANIMAL_HOLDERS);
    await settle(page, {timeoutMs: 20_000});
    await expect(page.locator('.con-sit')).toHaveAttribute('data-sit-step', 'choice');
    expect(await crumbText(page), 'the crumb names the pick stage of the sitting').toMatch(/ВЫБОР|CHOICE/i);
    await expect(page.locator('.con-parl__gov-card .pcard'), 'exactly one enacted card on screen').toHaveCount(1);
    await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'carried onto the stage').toHaveClass(BUDGET_CLASS);
    expect((await wireOf(request, playerId)).waitingFor?.cards?.map((c) => c.name).sort(), 'the server asks the same two').toEqual(ANIMAL_HOLDERS);
    let probe = await readProbe(page);
    const loss = tracksOf(probe.samples).find((tr) => tr[0].c.dir === 'loss');
    const gain = tracksOf(probe.samples).find((tr) => tr[0].c.dir !== 'loss' && tr[0].c.amt.includes(`+${paid}`));
    expect(loss, 'the levy\'s chip flew').toBeDefined();
    expect(gain, 'the payout\'s chip flew').toBeDefined();
    const lossLanded = landingIndex(loss!);
    const gainBorn = gain![0].i;
    const gainLanded = landingIndex(gain!);
    expect(loss![0].c.amt, 'the chip carries the levy with its sign').toContain('−10');
    expect(gainBorn, 'the payout left the card only once the levy had landed — surfaces in turn').toBeGreaterThan(lossLanded);
    const pickerFirst = firstIndex(probe.samples, 0, (s) => s.slots.length > 0);
    expect(pickerFirst, 'the picker was sampled').toBeGreaterThanOrEqual(0);
    expect(pickerFirst, 'the first question opened only once the money had landed — never over a chip in the air').toBeGreaterThan(gainLanded);
    expect(probe.samples.some((s) => s.mc === netMc), `the M€ counter read the net ${netMc} before the pick`).toBe(true);
    await expectParliamentFits(page, 'animals picker');
    await shoot(page, '05-pick-animals');

    // ── A commits the focused holder: a «+2» chip lands on ITS capsule, which ticks while the pick is on screen.
    const animalCard = probe.samples.slice(-1)[0].focused;
    expect(ANIMAL_HOLDERS, 'the focus stands on a candidate').toContain(animalCard);
    const pressAt = probe.samples.length;
    await press(page, 'Enter', 1200);
    await expect.poll(async () => (await readProbe(page)).samples.some((s, i) => i >= pressAt && s.capsules[animalCard] === '2'), {
      timeout: 20_000, message: `the chosen card's capsule (${animalCard}) ticks to 2 while the pick is on screen`,
    }).toBe(true);

    // ── ③ THE MICROBES' PICKER takes the SAME stage — the second question of the same seat, only after the first was answered and landed.
    await expect.poll(async () => sorted((await readProbe(page)).samples.slice(-1)[0]?.slots ?? []), {timeout: 60_000, message: 'the microbes\' picker shows the two microbe holders'}).toEqual(MICROBE_HOLDERS);
    await settle(page, {timeoutMs: 20_000});
    await expect(page.locator('.con-sit')).toHaveAttribute('data-sit-step', 'choice');
    expect(await crumbText(page), 'the crumb is still the sitting\'s pick stage').toMatch(/ВЫБОР|CHOICE/i);
    expect((await wireOf(request, playerId)).waitingFor?.cards?.map((c) => c.name).sort(), 'the server asks the two microbe holders').toEqual(MICROBE_HOLDERS);
    const mid = await wireOf(request, playerId);
    expect(mid.thisPlayer.tableau.find((c) => c.name === animalCard)?.resources, `the animals landed on ${animalCard}`).toBe(2);
    probe = await readProbe(page);
    const animalsChip = tracksOf(probe.samples).find((tr) => tr[0].i >= pressAt && tr[0].c.amt.includes('+2'));
    expect(animalsChip, 'a «+2» chip flew to the chosen holder').toBeDefined();
    const animalsLanded = landingIndex(animalsChip!);
    const microbePickerFirst = firstIndex(probe.samples, pressAt, (s) => s.slots.length > 0 && sorted(s.slots).join('|') === MICROBE_HOLDERS.join('|'));
    expect(microbePickerFirst, 'the second picker was sampled').toBeGreaterThanOrEqual(0);
    expect(microbePickerFirst, 'the second question opened only once the first portion had landed — the two never coexist').toBeGreaterThan(animalsLanded);
    expect(probe.samples.slice(pressAt, microbePickerFirst).every((s) => !(s.slots.includes('Fish') && s.slots.includes('Tardigrades'))),
      'no sample ever showed an animal holder and a microbe holder side by side').toBe(true);
    await expectParliamentFits(page, 'microbes picker');
    await shoot(page, '06-pick-microbes');

    // ── A commits the focused microbe holder: «+3» lands on ITS capsule.
    const microbeCard = probe.samples.slice(-1)[0].focused;
    expect(MICROBE_HOLDERS).toContain(microbeCard);
    const press2At = probe.samples.length;
    await press(page, 'Enter', 1200);
    await expect.poll(async () => (await readProbe(page)).samples.some((s, i) => i >= press2At && s.capsules[microbeCard] === '3'), {
      timeout: 20_000, message: `the chosen card's capsule (${microbeCard}) ticks to 3`,
    }).toBe(true);

    // ── ④ THE RESULTS: four parts in the printed order, each portion with the card it landed on, the net; red's portions NAMED and forfeited.
    await expect.poll(() => sittingStage(page), {timeout: 120_000, message: 'the walk reaches the results'}).toBe('results');
    await waitSittingAtRest(page, 30_000);
    const wire = await wireOf(request, playerId);
    const mine = (wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === blue);
    expect(mine.map((o) => o.step)).toEqual(['levy', 'megacredits', 'animals', 'microbes']);
    expect(mine[0]).toMatchObject({kind: 'stock', amount: -10, owed: 10});
    expect(mine[1]).toMatchObject({kind: 'stock', amount: paid, influence: 2});
    expect(mine[2]).toMatchObject({kind: 'cardResource', amount: 2, card: animalCard});
    expect(mine[3]).toMatchObject({kind: 'cardResource', amount: 3, card: microbeCard});
    expect(mine[1].before, 'the payout landed on what the levy LEFT').toBe(mine[0].after);
    expect(wire.thisPlayer.megacredits - before.thisPlayer.megacredits, 'the day\'s balance').toBe(paid - 10);
    expect(wire.thisPlayer.tableau.find((c) => c.name === microbeCard)?.resources).toBe(3);
    expect(wire.thisPlayer.tableau.find((c) => c.name === animalCard)?.resources, 'the animals stayed where they landed').toBe(2);
    const others = (wire.game.parliament.phase?.outcomes ?? wire.game.parliament.lastPhase?.outcomes ?? []).filter((o) => o.player !== blue);
    expect(others.map((o) => `${o.step}:${o.kind}:${o.amount}`), 'red: levied, paid by its influence, and both portions named with their size').toEqual(
      ['levy:stock:-10', 'megacredits:stock:1', 'animals:skipped:2', 'microbes:skipped:3']);
    expect(others[2].reason).toBe('No card can hold animals');
    expect(others[3].reason).toBe('No card can hold microbes');

    const row = page.locator(`[data-sit-payout][data-sit-payout-seat="${blue}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-sit-part]'), 'four parts, one per record').toHaveCount(4);
    await expect(row.locator('[data-sit-part-amount]').nth(0)).toHaveAttribute('data-sit-part-amount', '-10');
    await expect(row.locator('[data-sit-part-amount]').nth(1)).toHaveText(`+${paid}`);
    await expect(row.locator('[data-sit-part-amount]').nth(2)).toHaveText('+2');
    await expect(row.locator('[data-sit-part-amount]').nth(3)).toHaveText('+3');
    // The two portions read as payouts ONTO A CARD (the unit's own square beside the number — the results row of a
    // single recipient prints the kind, the card itself is on the tableau, checked above through the server).
    await expect(row.locator('[data-sit-part="cardResource"]'), 'two portions onto a card, each its own part').toHaveCount(2);
    await expect(row.locator('[data-sit-part="skipped"]'), 'nothing of blue\'s is a skip').toHaveCount(0);
    const netLine = row.locator('[data-sit-net]');
    await expect(netLine, 'the net stands beside the parts — the portions are not in it').toHaveCount(1);
    await expect(netLine).toHaveAttribute('data-sit-net-amount', String(paid - 10));
    const redRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${others[0].player}"]`);
    await expect(redRow.locator('[data-sit-part="skipped"]'), 'red\'s two portions are named skips').toHaveCount(2);
    await settle(page, {timeoutMs: 30_000});
    await expectParliamentFits(page, 'results');
    await shoot(page, '07-results-four-parts');
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);

    // ── The generation moves on: A on the results answers the viewer's gate, red answers over the API.
    await closeSitting(page, request, playerId);
    await answerGateAs(request, red, 'adjourn');
    await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
  });
});
