import {test, expect, Page} from './consoleTest';
import {bootFixture, settle} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE DELTA-CHIP ANCHOR LAW (R-23 / R-24 — Colonial Affairs block D): ONE rule for
 * every counter that announces its change with the shared ±N chip
 * (`AnimatedMetricValue` → `.metric-feedback-host`), measured at EVERY console
 * host on the three display profiles — never a rail-only patch.
 *
 *   ① OFF THE NUMBER — the chip never covers the glyphs of the value it reports;
 *   ② OFF THE NEIGHBOURS — nor any other readout, icon or row of the instrument
 *     (the row above the rail row, the next tag cell, the VP cell beside TR…);
 *   ③ INSIDE THE INSTRUMENT — the chip stays within the instrument that owns the
 *     number (the rail's box, the aux column, the hand dock); the top beam's
 *     chips keep their documented CHIP LINE under the beam (the HUD-frame
 *     contract) — inside the strip's horizontal extent, hanging from its seam;
 *   ④ REM-SCALED — the chip's gap from its number is a rem quantity, the same on
 *     1080 / 4K / the Deck; a px anchor reads three times smaller at 4K.
 *
 * The subject is the CSS ANCHOR contract, so the probe mounts the shared
 * feedback DOM (`metric-feedback-host--*` + `delta-chip--*`, the very classes the
 * component renders) into each host in turn, measures, photographs the cell and
 * removes it — a LIVE chip is a moving target (its enter carries a translate),
 * the anchor it settles onto is not. Screenshots under
 * screenshots/delta-chip-anchor/<preset>/ (the before/after evidence of the
 * eight consumers), the numbers in geometry.json beside them.
 */
const OUT_ROOT = path.resolve('screenshots', 'delta-chip-anchor');

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

/** ONE CONSUMER: where the component mounts its host, the number it reports, the frame and the instrument around it. */
type Consumer = {
  id: string;
  variant: string;
  /** The element the component's host is a child of (the positioned parent). */
  host: string;
  /** The NUMBER the chip reports — found inside the frame. */
  number: string;
  /** The cell / row that frames the number (neighbour frames of the same class must stay clear). */
  frame: string;
  /** The instrument the chip must stay inside. */
  instrument: string;
  /** `inside` — within the instrument's box; `below` — the beam's chip line: hangs from the strip's seam, inside its width. */
  lane: 'inside' | 'below';
  /**
   * THE POSE the law is measured in (④): `line` — beside the digits (a rem gap to the ink); `corner` — a badge
   * on the cell's own corner (a rem inset from the frame's edges); `chip-line` — hanging from the beam's seam.
   */
  pose: 'line' | 'corner' | 'chip-line';
};

const CONSUMERS: ReadonlyArray<Consumer> = [
  {id: 'rail-stock', variant: 'resource-stock', host: '.con-res__row:nth-of-type(2) .con-res__digits', number: '.con-res__digits', frame: '.con-res__row', instrument: '.con-res', lane: 'inside', pose: 'line'},
  {id: 'rail-production', variant: 'resource-production', host: '.con-res__row:nth-of-type(2)', number: '.con-res__prod', frame: '.con-res__row', instrument: '.con-res', lane: 'inside', pose: 'corner'},
  {id: 'rail-tag', variant: 'tag', host: '.con-tagmx__cell:nth-child(2)', number: '.con-tagmx__num', frame: '.con-tagmx__cell', instrument: '.con-res', lane: 'inside', pose: 'corner'},
  {id: 'score-tr', variant: 'score', host: '.con-score__cell--tr .con-score__valwrap', number: '.con-score__value', frame: '.con-score__cell', instrument: '.con-res', lane: 'inside', pose: 'line'},
  {id: 'status-param', variant: 'global-parameter', host: '.con-status__param:nth-of-type(2)', number: '.con-status__value', frame: '.con-status__param', instrument: '.con-status', lane: 'below', pose: 'chip-line'},
  {id: 'deck', variant: 'misc', host: '.con-deckstack__count', number: '.con-deckstack__count .con-flipval', frame: '.con-deckstack', instrument: '.con-status', lane: 'below', pose: 'chip-line'},
  {id: 'hand-dock', variant: 'misc', host: '.con-handdock__ratio', number: '.con-handdock__num--total', frame: '.con-handdock__ratio', instrument: '.con-handdock', lane: 'inside', pose: 'line'},
  {id: 'aux', variant: 'misc', host: '.con-res-aux__cell', number: '.con-res-aux__value', frame: '.con-res-aux__cell', instrument: '.con-res-aux', lane: 'inside', pose: 'corner'},
];

type Box = {top: number, bottom: number, left: number, right: number, width: number, height: number};
type Measure = {
  id: string;
  present: boolean;
  chip?: Box;
  number?: Box;
  frame?: Box;
  instrument?: Box;
  /** Overlap areas (px²) — the law demands zeros. */
  overNumber: number;
  overNeighbours: Array<{what: string, area: number}>;
  outsideInstrument: number;
  /** The chip's clearance from its number (px, nearest edges; negative = overlap). */
  gapPx: number;
  remPx: number;
};

/** Every DIGIT readout of the instruments — measured by its INK (a Range over its text), never its reserved box. */
const READOUTS = '.con-res__digits, .con-res__prod, .con-tagmx__num, .con-score__value, ' +
  '.con-status__value, .con-status__terra-pct, .con-deckstack__count, .con-handdock__num, .con-res-aux__value';
const FRAMES = '.con-res__row, .con-tagmx__cell, .con-score__cell, .con-res-aux__cell, .con-status__param, .con-deckstack';

async function measure(page: Page, consumer: Consumer): Promise<Measure> {
  return await page.evaluate(({c, readouts, frames}) => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return {top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height};
    };
    // THE INK of a readout: the union of its text boxes (a `min-width` column, a flip viewport, a plate's
    // padding are the cell's reserve, not the digits the law protects).
    const ink = (el: Element): Box => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        return box(el);
      }
      return {top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height};
    };
    const overlap = (a: Box, b: Box): number =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const hostParent = document.querySelector<HTMLElement>(c.host);
    if (hostParent === null) {
      return {id: c.id, present: false, overNumber: 0, overNeighbours: [], outsideInstrument: 0, gapPx: 0, remPx};
    }
    const frameEl = hostParent.closest<HTMLElement>(c.frame) ?? hostParent;
    const numberEl = (hostParent.matches(c.number) ? hostParent : frameEl.querySelector<HTMLElement>(c.number)) ?? document.querySelector<HTMLElement>(c.number);
    const instrumentEl = hostParent.closest<HTMLElement>(c.instrument);
    // The digits' INK is read BEFORE the chip is mounted: a host inside the digits' own span would join the range.
    const numberBox = numberEl === null ? undefined : ink(numberEl);
    // THE SHARED FEEDBACK DOM, exactly as the component renders it (settled — no enter transition).
    const host = document.createElement('span');
    host.className = `metric-feedback-host metric-feedback-host--${c.variant} metric-feedback-host--active-positive`;
    host.dataset.chipProbe = '1';
    const chip = document.createElement('span');
    chip.className = `delta-chip delta-chip--${c.variant} delta-chip--positive`;
    chip.innerHTML = '<span class="delta-chip__sign">+</span><span class="delta-chip__value">2</span>';
    host.appendChild(chip);
    hostParent.appendChild(host);
    const chipBox = box(chip);
    const frameBox = box(frameEl);
    const instrumentBox = instrumentEl === null ? undefined : box(instrumentEl);
    const overNeighbours: Array<{what: string, area: number}> = [];
    const scope = instrumentEl ?? document.body;
    // ② every other readout's DIGITS on the instrument (the own row's stock digits for a production chip
    // included); a cell's emblem / plate is its own furniture — a badge may stand on its shoulder.
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>(readouts))) {
      if (el === numberEl || numberEl?.contains(el) === true || el.contains(numberEl) || el.contains(chip)) {
        continue;
      }
      const area = overlap(chipBox, ink(el));
      if (area > 1) {
        overNeighbours.push({what: el.className.split(' ')[0], area: Math.round(area)});
      }
    }
    for (const el of Array.from(scope.querySelectorAll<HTMLElement>(frames))) {
      if (el === frameEl || el.contains(frameEl) || frameEl.contains(el)) {
        continue;
      }
      const area = overlap(chipBox, box(el));
      if (area > 1) {
        overNeighbours.push({what: 'frame:' + el.className.split(' ')[0], area: Math.round(area)});
      }
    }
    const chipArea = chipBox.width * chipBox.height;
    let outsideInstrument = 0;
    if (instrumentBox !== undefined) {
      const lane: Box = c.lane === 'below' ?
        {...instrumentBox, top: instrumentBox.top, bottom: instrumentBox.bottom + 3 * remPx, height: instrumentBox.height + 3 * remPx} :
        instrumentBox;
      outsideInstrument = Math.round(chipArea - overlap(chipBox, lane));
    }
    let gapPx = 0;
    if (numberBox !== undefined) {
      const dx = Math.max(numberBox.left - chipBox.right, chipBox.left - numberBox.right, 0);
      const dy = Math.max(numberBox.top - chipBox.bottom, chipBox.top - numberBox.bottom, 0);
      const over = overlap(chipBox, numberBox);
      gapPx = over > 0 ? -Math.sqrt(over) : Math.hypot(dx, dy);
    }
    return {
      id: c.id, present: true, chip: chipBox, number: numberBox, frame: frameBox, instrument: instrumentBox,
      overNumber: Math.round(numberBox === undefined ? 0 : overlap(chipBox, numberBox)),
      overNeighbours, outsideInstrument, gapPx, remPx,
    };
  }, {c: consumer, readouts: READOUTS, frames: FRAMES});
}

async function shootHost(page: Page, preset: string, consumer: Consumer, m: Measure): Promise<void> {
  const frame = m.frame ?? m.chip;
  if (frame === undefined || m.chip === undefined) {
    return;
  }
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  const pad = Math.round(m.remPx * 1.2);
  const left = Math.max(0, Math.min(frame.left, m.chip.left) - pad);
  const top = Math.max(0, Math.min(frame.top, m.chip.top) - pad);
  const right = Math.max(frame.right, m.chip.right) + pad;
  const bottom = Math.max(frame.bottom, m.chip.bottom) + pad;
  await page.screenshot({path: path.join(dir, `${consumer.id}.png`), clip: {x: left, y: top, width: right - left, height: bottom - top}});
}

const unmountProbe = (page: Page) => page.evaluate(() => document.querySelectorAll('[data-chip-probe]').forEach((n) => n.remove()));

for (const preset of PRESETS) {
  test.describe(`delta-chip anchor law · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('every console counter\'s chip is OFF its number, OFF its neighbours, INSIDE its instrument, at a rem gap', async ({page, request}) => {
      test.setTimeout(240_000);
      // A table with every counter alive: stock + production, tags, TR / VP, the beam, the deck, a hand, a card resource (the aux column).
      await bootFixture(page, request, 'effect-forecast', {query: preset.query});
      await settle(page, {timeoutMs: 30_000});
      const results: Array<Measure> = [];
      for (const consumer of CONSUMERS) {
        const m = await measure(page, consumer);
        if (m.present) {
          await shootHost(page, preset.id, consumer, m);
        }
        await unmountProbe(page);
        results.push(m);
      }
      fs.mkdirSync(path.join(OUT_ROOT, preset.id), {recursive: true});
      fs.writeFileSync(path.join(OUT_ROOT, preset.id, 'geometry.json'), JSON.stringify(results, null, 2));

      const rem = results[0]?.remPx ?? 20;
      const missing = results.filter((m) => !m.present).map((m) => m.id);
      expect(missing, 'every consumer stands on this table (the fixture carries all eight)').toEqual([]);
      for (const m of results) {
        const consumer = CONSUMERS.find((c) => c.id === m.id)!;
        const tag = `${preset.id} · ${m.id}`;
        expect.soft(m.overNumber, `${tag}: ① the chip is OFF the number it reports (overlap px²)`).toBeLessThanOrEqual(1);
        expect.soft(m.overNeighbours, `${tag}: ② the chip is OFF every neighbour readout / row`).toEqual([]);
        expect.soft(m.outsideInstrument, `${tag}: ③ the chip stays INSIDE its instrument (px² outside)`).toBeLessThanOrEqual(1);
        // ④ A REM ANCHOR — the same small rem quantity on every profile (a px anchor at 4K reads a quarter of a
        // rem, a chip half over its number reads negative): the gap to the ink on the digits' line, the inset from
        // the cell's edges for a corner badge, the drop under the seam for the beam's chip line.
        if (consumer.pose === 'line') {
          const gapRem = m.gapPx / rem;
          expect.soft(gapRem, `${tag}: ④ the gap from the digits is a rem quantity (${gapRem.toFixed(2)}rem)`).toBeGreaterThanOrEqual(0.05);
          expect.soft(gapRem, `${tag}: ④ …and never a gulf (${gapRem.toFixed(2)}rem)`).toBeLessThanOrEqual(0.9);
        } else if (consumer.pose === 'corner' && m.chip !== undefined && m.frame !== undefined) {
          const top = (m.chip.top - m.frame.top) / rem;
          const side = Math.min(m.chip.left - m.frame.left, m.frame.right - m.chip.right) / rem;
          expect.soft(top, `${tag}: ④ a corner badge sits a rem hair under the cell's top edge (${top.toFixed(2)}rem)`).toBeGreaterThanOrEqual(0.02);
          expect.soft(top, `${tag}: ④ …not adrift inside the cell (${top.toFixed(2)}rem)`).toBeLessThanOrEqual(0.35);
          expect.soft(side, `${tag}: ④ …and a rem hair inside its side edge (${side.toFixed(2)}rem)`).toBeGreaterThanOrEqual(0.02);
          expect.soft(side, `${tag}: ④ …never pushed toward the digits (${side.toFixed(2)}rem)`).toBeLessThanOrEqual(0.35);
        } else if (consumer.pose === 'chip-line' && m.chip !== undefined && m.instrument !== undefined) {
          const drop = (m.chip.top - m.instrument.bottom) / rem;
          expect.soft(drop, `${tag}: ④ the beam's chip hangs from the seam (${drop.toFixed(2)}rem)`).toBeGreaterThanOrEqual(-0.1);
          expect.soft(drop, `${tag}: ④ …never adrift in the scene (${drop.toFixed(2)}rem)`).toBeLessThanOrEqual(0.35);
        }
      }
    });
  });
}
