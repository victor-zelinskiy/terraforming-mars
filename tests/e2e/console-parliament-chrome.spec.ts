import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, settle} from './consoleStart';
import {expectParliamentFits, openParliament, PARLIAMENT_PRESETS} from './parliamentDrive';

/*
 * THE PARLIAMENT'S CHROME — ONE GLANCE (P70, ledger DA · K1…K6). The tier that stands on EVERY stage of the Parliament —
 * the Career with the chairman's quest under the chamber, the resolution piles at the head's right edge, the vote
 * medallions under the voting area — read whole on all three profiles, on a table posed for its hardest cases
 * (`parliament-chrome`: 4 seats, blue and red on ONE Career place, green and yellow at the start, the quest open with
 * red leading 2 to blue's 1, an empty resolution discard, no vote on any resolution):
 *   K1 · the markers of one place stand SIDE BY SIDE — no two discs (rings included) overlap, and the viewer's disc wears
 *        its kant (a spread ring, never a blurred halo);
 *   K2 · every TR / card tile prints its «+1» INSIDE the tile, at a readable size;
 *   K4 · the quest plate is no wider than its content (+ its padding); the race is ONE encoding (no «0/3» beside the pips)
 *        and the one leader's row is marked;
 *   K5 · the piles print no «×N» (a seat's delegate count) and the empty discard prints nothing;
 *   K6 · a resolution with no vote prints no «0» and no «—»;
 *   and the tier and the head stay inside the Parliament's box (`expectParliamentFits` beside).
 */
const OUT = path.resolve('screenshots', 'p70', 'chrome');

type Chrome = {
  rem: number;
  /** Per Career place with ≥ 2 markers: the overlapping pairs (rings included). */
  overlaps: Array<string>;
  places2: number;
  viewerRing: string;
  otherRing: string;
  /** Every TR / card tile: its «+1» inside it, and its px size. */
  gains: Array<{kind: string, text: string, inside: boolean, px: number}>;
  /** Neighbouring Career tiles that overlap (a tile wider than its column). */
  tileOverlaps: Array<string>;
  /** The plate, the union of its members, its padding — and its profile CAP when the race had to wrap (the only honest reason to stand wider). */
  plate: {w: number, content: number, pad: number, cap: number, raceLines: number};
  raceText: string;
  leadRows: Array<string>;
  pilesText: string;
  emptyTallies: Array<string>;
  outside: Array<string>;
};

async function readChrome(page: Page): Promise<Chrome> {
  return await page.evaluate(() => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const root = document.querySelector('.con-parl')!;
    const rootBox = root.getBoundingClientRect();
    const text = (el: Element | null) => ((el as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const out: Chrome = {rem, overlaps: [], places2: 0, viewerRing: '', otherRing: '', gains: [], plate: {w: 0, content: 0, pad: 0, cap: 0, raceLines: 0},
      raceText: '', leadRows: [], pilesText: '', emptyTallies: [], outside: [], tileOverlaps: []};
    const nodes = Array.from(root.querySelectorAll('.con-parl__track > .con-parl__step > .con-parl__step-node')).map((n) => n.getBoundingClientRect());
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i - 1].right > nodes[i].left + 1) {
        out.tileOverlaps.push(`${i - 1}|${i}: ${Math.round(nodes[i - 1].right - nodes[i].left)}px`);
      }
    }
    // K1 — every disc on the track with its painted RING (the largest spread of its box-shadow, never a constant): no two
    // discs of the track touch — inside one place (two seats on one step) nor across two places (a row reaching the gap).
    const spread = (shadow: string): number => Math.max(0, ...Array.from(shadow.matchAll(/0px 0px 0px ([d.]+)px/g)).map((m) => Number(m[1])));
    const discs = Array.from(root.querySelectorAll<HTMLElement>('[data-agenda-markers] [data-agenda-cube] .con-parl__agenda-dot')).map((dot) => {
      const r = dot.getBoundingClientRect();
      const reach = spread(getComputedStyle(dot).boxShadow);
      const place = dot.closest('[data-agenda-markers]')?.getAttribute('data-agenda-markers') ?? '?';
      return {l: r.left - reach, r: r.right + reach, t: r.top - reach, b: r.bottom + reach, place, viewer: dot.className.includes('--viewer'), shadow: getComputedStyle(dot).boxShadow};
    });
    const perPlace = new Map<string, number>();
    discs.forEach((d) => perPlace.set(d.place, (perPlace.get(d.place) ?? 0) + 1));
    out.places2 = [...perPlace.values()].filter((n) => n >= 2).length;
    for (let i = 0; i < discs.length; i++) {
      for (let j = i + 1; j < discs.length; j++) {
        const a = discs[i];
        const b = discs[j];
        if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) {
          out.overlaps.push(`places ${a.place}·${b.place}: ${Math.round(Math.min(a.r - b.l, b.r - a.l))}px`);
        }
      }
    }
    out.viewerRing = discs.find((d) => d.viewer)?.shadow ?? '';
    out.otherRing = discs.find((d) => !d.viewer)?.shadow ?? '';
    // K2 — the reward tiles.
    root.querySelectorAll('.con-parl__step--tr, .con-parl__step--card').forEach((step) => {
      const node = step.querySelector('.con-parl__step-node')!.getBoundingClientRect();
      const plus = step.querySelector<HTMLElement>('.con-parl__step-plus');
      const r = plus?.getBoundingClientRect();
      out.gains.push({
        kind: step.className.includes('--tr') ? 'tr' : 'card',
        text: text(plus),
        inside: r !== undefined && r.width > 0 && r.left >= node.left - 1 && r.right <= node.right + 1 && r.top >= node.top - 1 && r.bottom <= node.bottom + 1,
        px: plus === null ? 0 : parseFloat(getComputedStyle(plus).fontSize),
      });
    });
    // K4 — the quest plate against the union of its members.
    const plate = root.querySelector<HTMLElement>('[data-parl-engine]');
    if (plate !== null) {
      const cs = getComputedStyle(plate);
      const members = ['.con-parl__engine-kicker-word', '.con-parl__throne', '.con-parl__engine-cond', '.con-parl__engine-arrow', '.con-parl__engine-step', '.con-parl__quest-row']
        .flatMap((sel) => Array.from(plate.querySelectorAll(sel))).map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
      const left = Math.min(...members.map((r) => r.left));
      const right = Math.max(...members.map((r) => r.right));
      const tops = new Set(Array.from(plate.querySelectorAll('.con-parl__quest-row')).map((row) => Math.round(row.getBoundingClientRect().top)));
      const cap = parseFloat(getComputedStyle(root).getPropertyValue('--con-parl-quest-w')) * rem;
      out.plate = {w: plate.getBoundingClientRect().width, content: right - left, pad: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), cap, raceLines: tops.size};
      out.raceText = text(plate.querySelector('[data-parl-quest-progress]'));
      out.leadRows = Array.from(plate.querySelectorAll('.con-parl__quest-row--lead')).map((el) => el.getAttribute('data-parl-quest-row') ?? '?');
    }
    // K5 — the piles.
    out.pilesText = text(root.querySelector('[data-parl-deck]'));
    // K6 — the medallions of a resolution nobody voted on.
    root.querySelectorAll('.con-parl__slot[data-instance]').forEach((slot) => {
      const line = text(slot.querySelector('.con-parl__tally-line'));
      const ribbon = slot.querySelectorAll('.con-parl__ribbon [data-seq]').length;
      if (ribbon === 0) {
        out.emptyTallies.push(line);
      }
    });
    // The tier and the head inside the Parliament's box.
    for (const sel of ['[data-parl-agenda]', '[data-parl-deck]', '.con-parl__head']) {
      const el = root.querySelector(sel);
      const r = el?.getBoundingClientRect();
      if (r !== undefined && (r.left < rootBox.left - 1 || r.right > rootBox.right + 1 || r.top < rootBox.top - 1 || r.bottom > rootBox.bottom + 1)) {
        out.outside.push(sel);
      }
    }
    return out;
  });
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`the Parliament's chrome — one glance (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('K1 markers in their nests · K2 «+1» on the reward tiles · K4 the quest plate by its content, one encoding, one leader · K5 the piles · K6 no «0 —»', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'parliament-chrome', {query: preset.query, landing: 'board'});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      fs.mkdirSync(OUT, {recursive: true});
      await page.screenshot({path: path.join(OUT, `${preset.id}-overview.png`)});
      const c = await readChrome(page);
      const told = JSON.stringify(c);
      test.info().annotations.push({type: 'chrome', description: told});

      expect(c.places2, `the table poses two markers on one place (${told})`).toBeGreaterThanOrEqual(1);
      expect(c.overlaps, `K1 · the markers of one place never overlap, rings included (${told})`).toEqual([]);
      expect(c.viewerRing, 'K1 · the viewer\'s disc wears a kant the others do not').not.toBe(c.otherRing);

      expect(c.tileOverlaps, `K2 · no Career tile reaches into its neighbour (${told})`).toEqual([]);
      expect(c.gains.length, 'K2 · eight reward tiles (5 TR + 2 cards + … as printed)').toBeGreaterThanOrEqual(7);
      for (const gain of c.gains) {
        expect(gain.text, `K2 · a ${gain.kind} tile prints «+1» (${told})`).toBe('+1');
        expect(gain.inside, `K2 · the «+1» of a ${gain.kind} tile stands inside it (${told})`).toBe(true);
        expect(gain.px, `K2 · the «+1» is readable (${told})`).toBeGreaterThanOrEqual(c.rem * .6);
      }

      // A race that had to WRAP (four seats on the Deck) pins the plate at its profile cap — never wider than that.
      const plateLimit = c.plate.raceLines > 1 ? Math.max(c.plate.content + c.plate.pad + 4, c.plate.cap + 1) : c.plate.content + c.plate.pad + 4;
      expect(c.plate.w, `K4 · the quest plate is no wider than its content + padding (${told})`).toBeLessThanOrEqual(plateLimit);
      expect(c.raceText, `K4 · the race is ONE encoding — the pips, never «N/3» beside them (${told})`).not.toMatch(/\d\s*\/\s*\d/);
      expect(c.leadRows, `K4 · red leads the race, alone (${told})`).toEqual(['red']);

      expect(c.pilesText, `K5 · the piles print no «×N» (${told})`).not.toMatch(/×/);
      expect(c.pilesText, `K5 · the empty discard prints nothing — no «0» (${told})`).not.toMatch(/(^|\s)0(\s|$)/);

      expect(c.emptyTallies.length, `the table poses resolutions with no vote (${told})`).toBeGreaterThan(0);
      for (const line of c.emptyTallies) {
        expect(line, `K6 · a resolution with no vote prints no «0» and no «—» (${told})`).toBe('');
      }
      expect(c.outside, `the tier and the head stay inside the Parliament (${told})`).toEqual([]);
      await expectParliamentFits(page, `${preset.id} · chrome`);
    });
  });
}
