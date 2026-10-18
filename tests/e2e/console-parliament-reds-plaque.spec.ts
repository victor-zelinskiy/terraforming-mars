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
 * scroll-cut, and the party's NAME is whole — on all three profiles (the Deck's
 * government block is the shortest room the shared tile is measured from).
 * Evidence → screenshots/parliament-reds/.
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
  /** The party's NAME is rendered whole — never an ellipsis, never a clipped second line. */
  name: string;
  nameCut: boolean;
};

type StripFit = {spill: {left: number, right: number, top: number, bottom: number}, cut: {x: number, y: number}};

/** The party's formula in «ВАШИ ЭФФЕКТЫ» («Зал» v7) against its own strip row — undefined when the strip has no row for it. */
async function stripFit(page: Page, party: string): Promise<StripFit | undefined> {
  return page.evaluate((target) => {
    const row = document.querySelector(`[data-parl-effects] .con-parl__effects-row[data-party="${target}"]`);
    const formula = row?.querySelector<HTMLElement>('.con-parl__effects-formula') ?? null;
    if (row === null || row === undefined || formula === null) {
      return undefined;
    }
    const p = row.getBoundingClientRect();
    const f = formula.getBoundingClientRect();
    const r = (v: number) => Math.round(v * 10) / 10;
    return {
      spill: {left: r(p.left - f.left), right: r(f.right - p.right), top: r(p.top - f.top), bottom: r(f.bottom - p.bottom)},
      cut: {x: formula.scrollWidth - formula.clientWidth, y: formula.scrollHeight - formula.clientHeight},
    };
  }, party);
}

async function plaqueFits(page: Page): Promise<Array<PlaqueFit>> {
  return page.evaluate(() => {
    const out: Array<PlaqueFit> = [];
    const read = (plaque: Element, zone: 'ruler' | 'row') => {
      const party = plaque.getAttribute('data-party') ?? '?';
      const nameEl = plaque.querySelector<HTMLElement>('.con-pseal__name');
      const name = (nameEl?.textContent ?? '').trim();
      // A cut name reads as an ellipsis when the line does not wrap and as a lost
      // second line when it does — both are the same defect, so both are asked.
      const nameCut = nameEl !== null &&
        (nameEl.scrollWidth > nameEl.clientWidth + 1 || nameEl.scrollHeight > nameEl.clientHeight + 1);
      const formula = plaque.querySelector<HTMLElement>('.con-pseal__formula');
      if (formula === null) {
        out.push({party, zone, formula: false, spill: {left: 0, right: 0, top: 0, bottom: 0}, cut: {x: 0, y: 0}, name, nameCut});
        return;
      }
      const p = plaque.getBoundingClientRect();
      const f = formula.getBoundingClientRect();
      const r = (v: number) => Math.round(v * 10) / 10;
      out.push({
        party, zone, formula: true,
        spill: {left: r(p.left - f.left), right: r(f.right - p.right), top: r(p.top - f.top), bottom: r(f.bottom - p.bottom)},
        cut: {x: formula.scrollWidth - formula.clientWidth, y: formula.scrollHeight - formula.clientHeight},
        name, nameCut,
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

for (const preset of PARLIAMENT_PRESETS) {
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
      // «Зал» v7: a MEDALLION prints no formula; the Reds' graphic stands in «ВАШИ ЭФФЕКТЫ» (the ruler's effect is
      // everyone's), inside the strip's own row — whole, never cut.
      for (const fit of fits) {
        expect(fit.formula, `${fit.zone} ${fit.party}: a medallion prints no formula`).toBe(false);
      }
      expect(fits.filter((f) => f.zone === 'row').length, 'the five opposition rows').toBe(5);
      const strip = await stripFit(page, 'Reds');
      expect(strip, 'the Reds\' formula stands in «ВАШИ ЭФФЕКТЫ»').toBeDefined();
      for (const side of ['left', 'right', 'top', 'bottom'] as const) {
        expect(strip!.spill[side], `the Reds' graphic reaches past its strip row's ${side} edge`).toBeLessThanOrEqual(1);
      }
      expect(strip!.cut.x, 'the Reds\' graphic is cut by its own box').toBeLessThanOrEqual(1);
      expect(strip!.cut.y, 'the Reds\' graphic is cut by its own box (height)').toBeLessThanOrEqual(1);
      // THE PARTY'S NAME IS NEVER CUT. The tile's layout answers its own box width
      // (the foot joins the name's line only where both fit), and the 1080 box is
      // narrower than the TV's: side by side there it truncated every name.
      for (const fit of fits) {
        expect(fit.nameCut, `${fit.zone} ${fit.party}: the party's name is cut («${fit.name}»)`).toBe(false);
        expect(fit.name.length, `${fit.zone} ${fit.party}: the party names itself`).toBeGreaterThan(2);
      }
    });
  });
}
