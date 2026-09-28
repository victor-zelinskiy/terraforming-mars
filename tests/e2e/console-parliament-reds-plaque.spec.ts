import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, settle} from './consoleStart';
import {openParliament, PARLIAMENT_PRESETS} from './parliamentDrive';

/**
 * THE RULING PARTY'S PLAQUE FITS ITS CHIP (the 2026-09-28 report, item 6):
 * the Reds' action graphic («+2 cards − 2 cards · 2 M€ / plant·microbe·animal
 * tag») overflowed the ruler's plaque — a graphic wider than the chip that
 * holds it, at the government's zoom. The Reds rule here by an enacted Heat
 * Capture (`parliament-heat-enacted`), so the tile stands in the government's
 * slot at its LARGEST zoom; the five opposition tiles are read too.
 *
 * Fit = the formula's box lies INSIDE its plaque's box and nothing in it is
 * scroll-cut — on the 1080 and the 4K profiles. Evidence → screenshots/parliament-reds/.
 */

const OUT = path.resolve('screenshots', 'parliament-reds');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type PlaqueFit = {
  party: string;
  zone: 'ruler' | 'row';
  formula: boolean;
  /** How far the formula's box reaches past its plaque's box on each side (positive = overflow), rounded px. */
  spill: {left: number, right: number, top: number, bottom: number};
  /** The formula's own scroll cut (positive = content wider than its box). */
  cut: {x: number, y: number};
};

async function plaqueFits(page: Page): Promise<Array<PlaqueFit>> {
  return page.evaluate(() => {
    const out: Array<PlaqueFit> = [];
    const read = (plaque: Element, zone: 'ruler' | 'row') => {
      const party = plaque.getAttribute('data-party') ?? '?';
      const formula = plaque.querySelector<HTMLElement>('.con-pseal__formula');
      if (formula === null) {
        out.push({party, zone, formula: false, spill: {left: 0, right: 0, top: 0, bottom: 0}, cut: {x: 0, y: 0}});
        return;
      }
      const p = plaque.getBoundingClientRect();
      const f = formula.getBoundingClientRect();
      const r = (v: number) => Math.round(v * 10) / 10;
      out.push({
        party, zone, formula: true,
        spill: {left: r(p.left - f.left), right: r(f.right - p.right), top: r(p.top - f.top), bottom: r(f.bottom - p.bottom)},
        cut: {x: formula.scrollWidth - formula.clientWidth, y: formula.scrollHeight - formula.clientHeight},
      });
    };
    const ruler = document.querySelector('[data-parl-ruler-slot] .con-pseal[data-party]');
    if (ruler !== null) {
      read(ruler, 'ruler');
    }
    document.querySelectorAll('.con-parl__parties .con-pseal[data-party]').forEach((el) => read(el, 'row'));
    return out;
  });
}

for (const preset of PARLIAMENT_PRESETS.filter((p) => p.id !== 'deck-handheld')) {
  test.describe(`the ruling party's plaque (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('the Reds rule: their action graphic stands INSIDE the government\'s plaque, and inside every row tile', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'parliament-heat-enacted', {query: preset.query});
      await settle(page);
      await openParliament(page);
      await shoot(page, `${preset.id}-overview`);

      const fits = await plaqueFits(page);
      console.log(`── plaques (${preset.id}) ──`, JSON.stringify(fits));
      const ruler = fits.find((f) => f.zone === 'ruler');
      expect(ruler, 'a party stands in the government\'s slot').toBeDefined();
      expect(ruler?.party, 'the Reds rule by the enacted Heat Capture').toBe('Reds');
      expect(ruler?.formula, 'the ruler\'s plaque prints its action graphic').toBe(true);
      expect(fits.filter((f) => f.zone === 'row').length, 'the five opposition tiles').toBe(5);
      for (const fit of fits) {
        if (!fit.formula) {
          continue;
        }
        const tol = 1;
        expect(fit.spill.left, `${fit.zone} ${fit.party}: the graphic reaches past the plaque's left edge`).toBeLessThanOrEqual(tol);
        expect(fit.spill.right, `${fit.zone} ${fit.party}: the graphic reaches past the plaque's right edge`).toBeLessThanOrEqual(tol);
        expect(fit.spill.top, `${fit.zone} ${fit.party}: the graphic reaches past the plaque's top edge`).toBeLessThanOrEqual(tol);
        expect(fit.spill.bottom, `${fit.zone} ${fit.party}: the graphic reaches past the plaque's bottom edge`).toBeLessThanOrEqual(tol);
        expect(fit.cut.x, `${fit.zone} ${fit.party}: the graphic is cut by its own box`).toBeLessThanOrEqual(tol);
        expect(fit.cut.y, `${fit.zone} ${fit.party}: the graphic is cut by its own box (height)`).toBeLessThanOrEqual(tol);
      }
    });
  });
}
