import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, fetchPlayerModel, openMandatoryAnnounce, press, pressUntil, settle} from './consoleStart';
import {
  answerAsksAs, answerGateAs, armLeakWitness, expectParliamentFits, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports,
  waitSittingAtRest,
} from './parliamentDrive';

/**
 * COLONIAL AFFAIRS (Turmoil Redux, RX07) — «gain all your colony bonuses 2 times +
 * 1/2 influence»: the first resolution with a PLAN OF STEPS PER PLAYER, the first
 * whose reward stage reads a LEDGER (a row per tile, ×k) as its BODY, the first
 * whose chips leave the LEDGER'S ROWS, and the first to host the hand's DISCARD as
 * a step of the sitting. ONE e2e, the whole reward stage on one profile (the
 * owner's budget: one new e2e per new mechanic, a few frames of the NEW):
 *
 *   ① the LEDGER is the body: the resolution stands as the hero on the left, a
 *     row per tile (Luna · Titan · Miranda · Pluto) with «× 3» and the multiplier
 *     read from the influence — before anything flies;
 *   ② the WAVE leaves the ROW: Luna's chips are born on the row's printed bonus
 *     cell, the row is the one marked while they fly, the M€ counter ticks on the
 *     TOUCHDOWN (never before), the row reads «получено» only after it;
 *   ③ the delta chip on the M€ row lands OFF the digits and INSIDE the row (the
 *     delta-chip anchor law);
 *   ④ the DISTRIBUTION (Titan's floaters over two holders) opens INSIDE the
 *     sitting's zone — the ledger yields to it, the crumb says «РАСКЛАДКА»;
 *   ⑤ the TAKE of THREE (Miranda's «draw 1 card» ×3 — ONE intake of k) inside the
 *     sitting — «ПОЛУЧЕНИЕ», the embedded take, no plate of its own;
 *   ⑥ the TAKE of ONE (Pluto's first draw — a pair is never merged with the next);
 *   ⑦ the DISCARD — the HAND stands as a step INSIDE the sitting's zone, in its
 *     discard mode, the crumb «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › СБРОС», the header names
 *     Pluto and «1 из 3», B is «Свернуть» (never a close), A discards the focused
 *     card — the card leaves for the pile, the hand pops, the next take stands;
 *   ⑧ the RESULTS group blue's payouts by tile; the band never moved, the body
 *     never stood empty, nothing stranded, the ledger read every row received.
 *
 * Fixture: `parliament-colonial-assembly` (blue: Luna + Titan (Atmo Collectors,
 * Jovian Lanterns) + Miranda + Pluto, Agenda step 4 → influence 3 → k = 3; red:
 * Luna, k = 2). Screenshots under screenshots/parliament-colonial/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-colonial');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const STAGE = '.con-parl [data-embed-slot="parliament-stage"]';
const LEDGER = '.con-parl [data-sit-ledger]';

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Outcome = {player: string, step: string, kind: string, amount?: number, colony?: string, multiplier?: number, card?: string, cards?: Array<{card: string, amount: number}>, reason?: string};
type Wire = {
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string, resources?: number}>, cardsInHandNbr?: number},
  cardsInHand?: Array<{name: string}>,
  game: {generation: number, phase: string, parliament: {phase?: {step: string, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
  waitingFor?: {type?: string, discardPrompt?: unknown, externalDrawPrompt?: unknown, cardResourceDistributionPrompt?: unknown},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Rect = {x: number, y: number, w: number, h: number};
type Sample = {
  t: number;
  stage: string;
  step: string;
  crumb: string;
  /** The ledger pane is on screen (laid out and visible). */
  ledgerShown: boolean;
  k: string;
  rows: Record<string, {state: string, active: boolean}>;
  lunaCell: Rect | undefined;
  /** What stands in the stage's zone right now. */
  zone: {task: boolean, extdraw: boolean, hand: boolean, handDiscard: boolean};
  chips: Array<{id: string, x: number, y: number, res: string, text: string}>;
  mc: string;
  /** The M€ row's delta chip against the law: its box, the digits' ink, the row's frame (px² of overlap / outside). */
  mcDelta: {overDigits: number, outsideRow: number} | undefined;
  bandH: number;
  bodyEmpty: boolean;
  hero: boolean;
};
type Probe = {samples: Array<Sample>};

/** THE PROBE — a task clock (`setInterval` + `MutationObserver`), never rAF; armed BEFORE the gate is answered. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({stage, ledger}) => {
    const w = window as unknown as {__colonialProbe: Probe};
    w.__colonialProbe = {samples: []};
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
      for (let n: Element | null = el; n !== null && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
          return false;
        }
      }
      return true;
    };
    const overlap = (a: DOMRect, b: DOMRect): number =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const sample = () => {
      const ledgerEl = document.querySelector<HTMLElement>(ledger);
      const rows: Record<string, {state: string, active: boolean}> = {};
      for (const row of Array.from(document.querySelectorAll<HTMLElement>(`${ledger} [data-colony-row]`))) {
        rows[row.dataset.colonyRow ?? ''] = {state: row.dataset.colonyRowState ?? '', active: row.hasAttribute('data-colony-row-active')};
      }
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => el.style.transform !== '').map((el) => {
        const r = el.getBoundingClientRect();
        const icon = el.querySelector<HTMLElement>('.con-transfer__icon');
        // A M€ chip draws its coin without the resource sprite — the reward probe's own reading (no icon = megacredits).
        const res = icon === null ? 'megacredits' : (Array.from(icon.classList).find((c) => c.startsWith('resource_icon--')) ?? '').replace('resource_icon--', '');
        return {id: el.dataset.transferId ?? '?', x: r.left + r.width / 2, y: r.top + r.height / 2, res, text: el.textContent?.trim() ?? ''};
      });
      const mcRow = document.querySelector<HTMLElement>('.con-res__row--megacredits');
      const digits = mcRow?.querySelector<HTMLElement>('.con-res__digits') ?? null;
      const delta = mcRow?.querySelector<HTMLElement>('.delta-chip') ?? null;
      let mcDelta: Sample['mcDelta'];
      if (mcRow !== null && mcRow !== undefined && digits !== null && delta !== null) {
        const range = document.createRange();
        range.selectNodeContents(digits.firstChild ?? digits);
        const ink = range.getBoundingClientRect();
        const chip = delta.getBoundingClientRect();
        const row = mcRow.getBoundingClientRect();
        mcDelta = {overDigits: Math.round(overlap(chip, ink)), outsideRow: Math.round(chip.width * chip.height - overlap(chip, row))};
      }
      const heads = Array.from(document.querySelectorAll<HTMLElement>('.con-wshead')).filter((el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
      const head = heads[heads.length - 1];
      const body = document.querySelector<HTMLElement>('.con-parl__bodyzone');
      const bodyEmpty = body !== null && !Array.from(body.children).some((child) => {
        const r = child.getBoundingClientRect();
        const cs = getComputedStyle(child);
        return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      w.__colonialProbe.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') ?? '',
        step: document.querySelector('.con-sit')?.getAttribute('data-sit-step') ?? '',
        crumb: head === undefined ? '' : (head.textContent ?? '').replace(/\s+/g, ' ').trim(),
        ledgerShown: visible(ledgerEl),
        k: ledgerEl?.querySelector('[data-colony-ledger]')?.getAttribute('data-colony-ledger-multiplier') ?? '',
        rows,
        lunaCell: rectOf(document.querySelector(`${ledger} [data-colony-row="Luna"] [data-colony-bonus]`)),
        zone: {
          task: document.querySelector(`${stage} .con-task`) !== null,
          extdraw: document.querySelector(`${stage} .con-extdraw`) !== null,
          hand: document.querySelector(`${stage} .con-hand`) !== null,
          handDiscard: document.querySelector(`${stage} .con-hand.con-hand--discard`) !== null,
        },
        chips,
        mc: digits?.textContent?.trim() ?? '',
        mcDelta,
        bandH: Math.round(document.querySelector('.con-band')?.getBoundingClientRect().height ?? 0),
        bodyEmpty,
        hero: document.querySelector('[data-parl-sit-hero] .con-parl__gov-card .pcard') !== null,
      });
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
    window.setInterval(sample, 16);
  }, {stage: STAGE, ledger: LEDGER});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__colonialProbe: Probe}).__colonialProbe);

test.describe(`Colonial Affairs · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the ledger is the body; the wave leaves the rows; the layout, the pick, the take and the DISCARD stand inside the sitting in turn; the results by tile', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-colonial-assembly', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);
    await waitSittingAtRest(page, 30_000);
    const before = await wireOf(request, playerId);
    await armProbe(page);

    // ── GATE 1: A on the verdict; red answers over the API. The chain runs: the enactment's beats, then the REWARD page.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined, {tries: 4, settleMs: 1500}),
      'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

    // ── ① THE LEDGER IS THE BODY of the reward stage — the hero on the left, a row per tile, × 3.
    await expect(page.locator(`${LEDGER} [data-colony-ledger]`), 'the ledger stands in the stage').toBeVisible({timeout: 60_000});
    await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the resolution is the hero on the left').toHaveClass(/rdx-unity-colonial-affairs/);
    await expect(page.locator(`${LEDGER} [data-colony-row]`)).toHaveCount(4);
    expect(await page.locator(`${LEDGER} [data-colony-row]`).evaluateAll((els) => els.map((el) => el.getAttribute('data-colony-row'))),
      'the rows are the table\'s tiles, in the table\'s order').toEqual(['Luna', 'Titan', 'Miranda', 'Pluto']);
    await expect(page.locator(`${LEDGER} [data-colony-ledger]`)).toHaveAttribute('data-colony-ledger-multiplier', '3');
    await expect(page.locator(`${LEDGER} [data-colony-row="Luna"] [data-colony-row-times]`)).toHaveText(/3/);
    await expect(page.locator(`${LEDGER} [data-colony-ledger-none]`), 'never «no colonies» here').toHaveCount(0);
    expect(await crumbText(page), 'the crumb: the sitting, its reward stage').toMatch(/заседание|sitting/i);
    await shoot(page, '01-ledger');

    // ── ② THE WAVE LEAVES THE ROW — Luna pays 6 M€: the chips are born on the row's bonus cell, the row is
    // marked while they fly, the M€ counter ticks on the touchdown, the row reads «получено» after it.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.rows.Luna?.state === 'received'), {timeout: 40_000, message: 'Luna\'s row received its payout'}).toBe(true);
    let probe = await readProbe(page);
    const mcChips = probe.samples.flatMap((s) => s.chips.filter((c) => c.res === 'megacredits').map((c) => ({...c, t: s.t, lunaActive: s.rows.Luna?.active === true, cell: s.lunaCell})));
    if (mcChips.length === 0) {
      // Name the state the flight was missed IN: every chip the probe ever saw, the ledger's trail, the console's own readiness facts.
      const diag = await page.evaluate(() => {
        const w = window as unknown as {__colonialProbe: Probe, __conReady?: () => unknown};
        const ready = typeof w.__conReady === 'function' ? w.__conReady() : undefined;
        const chips = w.__colonialProbe.samples.flatMap((s) => s.chips);
        return {chips: chips.slice(0, 12), samples: w.__colonialProbe.samples.length, ready: JSON.stringify(ready ?? null).slice(0, 2500)};
      });
      throw new Error(`the M€ chips never flew: ${JSON.stringify(diag)}`);
    }
    const firstMc = mcChips[0];
    expect(firstMc.lunaActive, 'Luna\'s row is the one marked while its chips fly').toBe(true);
    expect(firstMc.cell, 'the row\'s bonus cell is on screen at the birth').not.toBe(undefined);
    if (firstMc.cell !== undefined) {
      const rem = 20;
      expect(Math.abs(firstMc.x - (firstMc.cell.x + firstMc.cell.w / 2)) <= 3 * rem && Math.abs(firstMc.y - (firstMc.cell.y + firstMc.cell.h / 2)) <= 2 * rem,
        `the first chip is born on Luna's bonus cell (chip ${firstMc.x.toFixed(0)},${firstMc.y.toFixed(0)} vs cell ${JSON.stringify(firstMc.cell)})`).toBe(true);
    }
    const lastChipT = Math.max(...mcChips.map((c) => c.t));
    // The rail paints «committed − held» until the touchdown: the baseline is what the rail showed at the verdict.
    const mcBase = probe.samples.find((s) => s.mc !== '')?.mc ?? '';
    const tickSample = probe.samples.find((s) => s.mc !== mcBase && s.mc !== '');
    expect(tickSample, 'the M€ counter ticked').not.toBe(undefined);
    expect(tickSample!.t, `the tick (${tickSample!.mc}) came with the touchdown, never before the chips were in the air (tick ${tickSample!.t.toFixed(0)} vs first chip ${firstMc.t.toFixed(0)})`).toBeGreaterThan(firstMc.t);
    const receivedSample = probe.samples.find((s) => s.rows.Luna?.state === 'received');
    expect(receivedSample!.t, 'the row reads «получено» on the touchdown, never on the record\'s arrival').toBeGreaterThanOrEqual(tickSample!.t - 40);
    // A chip still on screen once the row reads «получено» is ABSORBING at the rail (the touchdown's own tail), never still crossing the stage.
    const railX = (await page.locator('.con-res').boundingBox())?.width ?? 320;
    const strays = probe.samples.filter((s) => s.rows.Luna?.state === 'received').flatMap((s) => s.chips.filter((c) => c.res === 'megacredits' && c.x > railX + 40));
    expect(strays, 'no M€ chip is still crossing the stage once the row reads received').toEqual([]);
    void lastChipT;
    // ── ③ THE DELTA CHIP ON THE M€ ROW obeys the anchor law in every sample it was seen in.
    const deltas = probe.samples.map((s) => s.mcDelta).filter((d): d is NonNullable<Sample['mcDelta']> => d !== undefined);
    expect(deltas.length, 'the M€ row showed its delta chip').toBeGreaterThan(0);
    expect(deltas.every((d) => d.overDigits <= 1), `the delta chip never covered the digits (${JSON.stringify(deltas.slice(0, 3))})`).toBe(true);
    expect(deltas.every((d) => d.outsideRow <= 1), `the delta chip stayed inside the row (${JSON.stringify(deltas.slice(0, 3))})`).toBe(true);
    await shoot(page, '02-luna-received');

    // ── ④ THE DISTRIBUTION — Titan's three floaters over two holders, INSIDE the sitting: the ledger yields, «РАСКЛАДКА».
    await expect(page.locator(`${STAGE} .con-task`), 'the layout stands inside the sitting').toHaveCount(1, {timeout: 40_000});
    await expect(page.locator(`${STAGE} [data-spread-blocked]`), 'opens with everything still to place').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator(LEDGER), 'the ledger yielded the zone to the step').toBeHidden();
    await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the hero stays').toHaveCount(1);
    expect(await crumbText(page), 'the crumb\'s tail names the layout').toMatch(/раскладка|distribution/i);
    await expectParliamentFits(page, `${PRESET.id} layout`);
    await shoot(page, '03-layout');
    await press(page, 'KeyE', 500);
    await press(page, 'KeyE', 500);
    await press(page, 'ArrowRight', 500);
    await press(page, 'Period', 700);
    await expect(page.locator(`${STAGE} [data-spread-ready]`)).toHaveCount(1);
    await press(page, 'Enter', 1200);
    const titanPaid = async () => (await wireOf(request, playerId)).game.parliament.phase?.outcomes?.some((o) => o.player === before.thisPlayer.color && o.colony === 'Titan' && o.kind === 'cardResource') === true;
    await expect.poll(titanPaid, {timeout: 30_000, message: 'Titan\'s record carries the layout'}).toBe(true);

    // ── ⑤ THE TAKE OF THREE — Miranda's «draw 1 card» ×3 is ONE intake of k: the embedded take inside the sitting, «ПОЛУЧЕНИЕ».
    await expect(page.locator(`${STAGE} .con-extdraw`), 'the take stands inside the sitting').toHaveCount(1, {timeout: 40_000});
    await expect(page.locator(`${STAGE} .con-extdraw`), 'host-agnostic: no plate of its own').toHaveClass(/con-extdraw--embedded/);
    await expect(page.locator(`${STAGE} .con-extdraw .con-cards__slot`), 'three cards were drawn at once').toHaveCount(3, {timeout: 20_000});
    await expect(page.locator(LEDGER), 'the ledger yielded').toBeHidden();
    expect(await crumbText(page), 'the crumb\'s tail names the take').toMatch(/получение|intake/i);
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '04-take-three');
    const plutoTakeStands = async () => {
      const wf = (await wireOf(request, playerId)).waitingFor;
      const intake = wf?.externalDrawPrompt as {count?: number} | undefined;
      return intake !== undefined && intake.count === 1;
    };
    expect(await pressUntil(page, 'Enter', plutoTakeStands, {tries: 6, settleMs: 1800}), 'A takes the three one by one — Pluto\'s first draw follows').toBe(true);

    // ── ⑥ THE TAKE OF ONE — Pluto's first draw: a pair is never merged with the next.
    await expect(page.locator(`${STAGE} .con-extdraw .con-cards__slot`), 'one card was drawn').toHaveCount(1, {timeout: 40_000});
    expect(await crumbText(page)).toMatch(/получение|intake/i);
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '05-take-one');
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).waitingFor?.discardPrompt !== undefined, {tries: 4, settleMs: 1800}),
      'A takes the card — the server asks for the discard').toBe(true);

    // ── ⑦ THE DISCARD — the HAND stands as a step INSIDE the sitting's zone, in its discard mode.
    const hand = page.locator(`${STAGE} .con-hand.con-hand--embedded`);
    await expect(hand, 'the hand is a step of the sitting, in the stage\'s own zone').toHaveCount(1, {timeout: 60_000});
    await expect(hand, 'in its discard mode').toHaveClass(/con-hand--discard/);
    await expect(page.locator(`${STAGE} .con-hand .con-wshead`), 'host-agnostic: no head of its own').toHaveCount(0);
    await expect(page.locator(LEDGER), 'the ledger yielded').toBeHidden();
    await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the hero stays through the discard').toHaveCount(1);
    await expect(page.locator('.con-hand__discard-src'), 'the header names the tile that demands it').toHaveText(/Плутон|Pluto/);
    await expect(page.locator('.con-hand__discard-seq'), '…and the pair\'s position').toHaveText(/1 из 3|1 of 3/);
    const crumb = await crumbText(page);
    expect(crumb, 'ONE continuous crumb: the workspace, the sitting, then the step').toMatch(/парламент|parliament/i);
    expect(crumb).toMatch(/заседание|sitting/i);
    expect(crumb).toMatch(/сброс|discarding/i);
    const barLabels = (await page.locator('.con-cmdbar__label').allTextContents()).map((t) => t.trim()).join(' | ');
    expect(barLabels, `B is «Свернуть» past the commit, never a close (${barLabels})`).toMatch(/свернуть|minimi[sz]e/i);
    expect(barLabels).not.toMatch(/закрыть|^close$/i);
    await shoot(page, '06-discard');
    try {
      await expectParliamentFits(page, `${PRESET.id} discard`);
    } catch (error) {
      // Name the box the hand did not fit IN: the zone, the embed slot, the hand and every child of its frame.
      const boxes = await page.evaluate((stage) => {
        const read = (el: Element | null, label: string) => {
          if (el === null) {
            return `${label}: -`;
          }
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return `${label}: ${Math.round(r.top)}..${Math.round(r.bottom)} h${Math.round(r.height)} sh${(el as HTMLElement).scrollHeight} ch${(el as HTMLElement).clientHeight} ${cs.display}/${cs.position}/${cs.overflowY}`;
        };
        const zone = document.querySelector('.con-sit__zone');
        const hand = document.querySelector(`${stage} .con-hand`);
        const frame = hand?.querySelector('.con-hand__frame') ?? null;
        return [read(zone, 'zone'), read(document.querySelector(stage), 'embed'), read(hand, 'hand'), read(frame, 'frame'),
          ...Array.from(frame?.children ?? []).map((c) => read(c, 'frame>' + c.className.split(' ')[0])),
          ...Array.from(frame?.querySelectorAll('.con-hand__browse, .con-hand__stagewrap, .con-cards__strip, .con-hand__album') ?? []).map((c) => read(c, c.className.split(' ')[0]))].join('\n');
      }, STAGE);
      throw new Error(`${(error as Error).message}\n[hand boxes]\n${boxes}`);
    }
    const handBefore = (await wireOf(request, playerId)).cardsInHand?.length ?? -1;
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-discard-proxy'), 'the card physically leaves the hand for the pile').toHaveCount(1, {timeout: 15_000});
    await expect.poll(async () => (await wireOf(request, playerId)).cardsInHand?.length ?? -1, {timeout: 30_000}).toBe(handBefore - 1);
    // …the hand pops and the NEXT take (pair 2) stands in the same zone; the zone never stood empty.
    await expect(page.locator(`${STAGE} .con-extdraw`), 'the second pair\'s take stands inside the sitting').toHaveCount(1, {timeout: 60_000});
    await expect(page.locator(`${STAGE} .con-hand`), 'the hand step left').toHaveCount(0, {timeout: 30_000});
    probe = await readProbe(page);
    expect(probe.samples.some((s) => s.zone.handDiscard), 'the probe saw the hand in its discard mode inside the zone').toBe(true);
    expect(probe.samples.filter((s) => s.stage === 'reward' && s.step !== 'reading').every((s) => s.hero), 'the hero never left the stage').toBe(true);

    // ── The rest of blue's pairs over the API (the surface is the subject, not the repetition); red owes nothing.
    await answerAsksAs(request, playerId, 12);
    await answerAsksAs(request, red);
    await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
    await waitSittingAtRest(page, 30_000);

    // ── ⑧ THE RESULTS group blue's payouts by tile; the ledger read every row received before it left.
    probe = await readProbe(page);
    const lastLedger = [...probe.samples].reverse().find((s) => s.stage === 'reward' && s.ledgerShown);
    expect(lastLedger, 'the ledger came back after the steps').not.toBe(undefined);
    expect(Object.entries(lastLedger!.rows).map(([colony, r]) => `${colony}:${r.state}`).sort(), 'every row received').toEqual(['Luna:received', 'Miranda:received', 'Pluto:received', 'Titan:received']);
    // …and it was READ, not flashed: the ledger stood with every row received for a beat (the read beat, ≥ 1 s of task-clock samples).
    const readSamples = probe.samples.filter((s) => s.stage === 'reward' && s.ledgerShown && Object.values(s.rows).every((r) => r.state === 'received'));
    expect(readSamples.length, 'the finished ledger stood long enough to read').toBeGreaterThan(3);
    expect(readSamples[readSamples.length - 1].t - readSamples[0].t, 'the read beat lasted').toBeGreaterThanOrEqual(900);
    const blueTiles = await page.locator(`.con-sit [data-sit-payout-seat="${before.thisPlayer.color}"] [data-sit-part-tile]`).allTextContents();
    expect(blueTiles.map((t) => t.trim()).join(' | '), 'the results panel groups blue\'s payouts by tile').toMatch(/Лун|Luna/);
    expect(blueTiles.length, 'four tiles lead their groups').toBe(4);
    const bandHeights = Array.from(new Set(probe.samples.map((s) => s.bandH).filter((h) => h > 0)));
    expect(Math.max(...bandHeights) - Math.min(...bandHeights), `the band kept its height (${bandHeights.join(', ')})`).toBeLessThanOrEqual(1);
    expect(probe.samples.filter((s) => s.bodyEmpty).length, 'the body zone never stood empty').toBe(0);
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    await expectParliamentFits(page, `${PRESET.id} results`);
    await shoot(page, '07-results');

    // ── GATE 2 closes the sitting; the next generation opens.
    await press(page, 'Enter', 1200);
    await answerGateAs(request, red, 'adjourn');
    await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
    const after = await wireOf(request, playerId);
    const mine = after.game.parliament.lastPhase?.outcomes?.filter((o) => o.player === after.thisPlayer.color) ?? [];
    expect(mine.filter((o) => o.kind === 'discard').length, 'three discards recorded').toBe(3);
    expect(mine.find((o) => o.colony === 'Luna')?.amount, 'Luna paid 2 × 3').toBe(6);
    await settle(page, {timeoutMs: 30_000});
  });
});
