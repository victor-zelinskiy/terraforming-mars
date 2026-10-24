import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture} from './consoleStart';
import {openParliament, PARLIAMENT_PRESETS, parliament} from './parliamentDrive';

/*
 * THE PARLIAMENT'S INFORMATION BUDGET — «Зал» v7, Ф0 (docs/TURMOIL_REDUX_PARLIAMENT_V7_PLAN.md § 0 / § 9.1).
 *
 * The owner's test audience called the overview «перегружен»; the plan's first criterion is a NUMBER: how
 * many independent units of information stand on the overview at once. This probe measures it off the
 * live DOM, the same way before and after the rework, so the claim «four times the colonies' overview»
 * and the target «≤ 45 units, 0 prose phrases» are counted, not felt.
 *
 * A UNIT is one of:
 *   · a TEXT RUN — a visible text node, classified by what it is: a KICKER (its element renders
 *     `text-transform: uppercase` — a zone or block name), a VALUE (digits and arithmetic only) or WORDS
 *     (anything else — a name, a sentence, a caption; the word count rides along, because a caption like
 *     «Эффект этой партии вам недоступен» is the «душно» the players named);
 *   · an ICON — a graphic element (`.pcard-ic`, `.resource_icon`, a player cube, a socket, an image, an
 *     SVG, the Agenda's nodes) — counted once per icon ROOT, never per leaf, so a compound icon with a
 *     badge is one unit.
 * The bar's commands are counted apart (the plan's criterion 9.2 is «verbs only», not a budget).
 *
 * Ф0 MEASURES and writes `screenshots/parliament-v7/budget/<fixture>-<preset>.json`; the thresholds
 * become assertions in Ф3, once the new overview stands (the plan's § 8). Until then the only verdicts are
 * anti-vacuous: the zones were found and each said something.
 */
const OUT_DIR = path.resolve('screenshots', 'parliament-v7', 'budget');

/** The overview's zones, by their root selector (Парламент v8: the head's ledger · the benches · the dais · «ВАШИ ЭФФЕКТЫ» · the table · the quest and the career; the reading line stands only in a beat). */
const ZONES: Array<[string, string]> = [
  ['seats', '.con-parl__seats'],
  ['government', '.con-parl__gov'],
  ['effects', '.con-parl__effects'],
  ['voting', '.con-parl__voting'],
  ['parties', '.con-parl__parties'],
  ['agenda', '.con-parl__agenda'],
];
const ICON_SELECTOR = [
  '.pcard-ic', '.resource_icon', '[data-player-token]', 'img', 'svg', '.con-pseal__support-place', '.con-pseal__emblem',
  '.con-parl__step-node', '.con-parl__step-res', '[class*="__cube"]', '[class*="__pip"]', '[class*="__socket"]',
].join(', ');

type Run = {zone: string, kind: 'kicker' | 'value' | 'words', text: string, words: number};
type Budget = {
  fixture: string, preset: string,
  zones: Record<string, {kickers: number, values: number, words: number, wordCount: number, icons: number, units: number}>,
  total: {kickers: number, values: number, words: number, wordCount: number, icons: number, units: number},
  prose: Array<{zone: string, text: string}>,
  bar: Array<string>,
};

async function measure(page: Page, fixture: string, preset: string): Promise<Budget> {
  return page.evaluate(({zones, iconSelector, fixture, preset}) => {
    const root = document.querySelector('.con-parl');
    if (root === null) {
      throw new Error('no .con-parl');
    }
    const visible = (el: Element): boolean => {
      let node: Element | null = el;
      while (node !== null && node !== document.body) {
        const cs = getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05 || node.getAttribute('aria-hidden') === 'true') {
          return false;
        }
        node = node.parentElement;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const zoneOf = (el: Element): string => {
      for (const [name, sel] of zones) {
        if (el.closest(sel) !== null) {
          return name;
        }
      }
      return 'other';
    };
    const runs: Array<Run> = [];
    // A SCALE's graduations are ONE reading — the numbers of a ruler, not facts of their own (П6: the Career's influence
    // ruler names the level of EVERY span at the owner's request). An element declares itself with `data-budget-scale`;
    // every scale counts once, however many marks it prints.
    const scales = new Map<string, string>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const text = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
      const parent = n.parentElement;
      if (text.length === 0 || parent === null || !visible(parent)) {
        continue;
      }
      const scale = parent.closest('[data-budget-scale]');
      if (scale !== null) {
        scales.set(scale.getAttribute('data-budget-scale') ?? '', zoneOf(scale));
        continue;
      }
      const cs = getComputedStyle(parent);
      const kind: Run['kind'] = cs.textTransform === 'uppercase' ? 'kicker' :
        /^[\s\d+\-−×x/→·%:,.()M€#]+$/u.test(text) ? 'value' : 'words';
      runs.push({zone: zoneOf(parent), kind, text, words: text.split(' ').length});
    }
    scales.forEach((zone, name) => runs.push({zone, kind: 'value', text: `scale:${name}`, words: 1}));
    const icons: Array<{zone: string}> = [];
    const seen = new Set<Element>();
    for (const el of Array.from(root.querySelectorAll(iconSelector))) {
      // One unit per icon ROOT: an icon nested in a counted icon is the same unit.
      if (!visible(el) || Array.from(seen).some((s) => s.contains(el))) {
        continue;
      }
      seen.add(el);
      icons.push({zone: zoneOf(el)});
    }
    const fresh = () => ({kickers: 0, values: 0, words: 0, wordCount: 0, icons: 0, units: 0});
    const byZone: Budget['zones'] = {};
    const total = fresh();
    const bump = (zone: string, f: (z: ReturnType<typeof fresh>) => void) => {
      byZone[zone] = byZone[zone] ?? fresh();
      f(byZone[zone]);
      f(total);
    };
    for (const run of runs) {
      bump(run.zone, (z) => {
        if (run.kind === 'kicker') {
          z.kickers++;
        }
        if (run.kind === 'value') {
          z.values++;
        }
        if (run.kind === 'words') {
          z.words++;
          z.wordCount += run.words;
        }
        // A kicker names a zone or a block — it is a label, not a unit of game information.
        if (run.kind !== 'kicker') {
          z.units++;
        }
      });
    }
    for (const icon of icons) {
      bump(icon.zone, (z) => {
        z.icons++;
        z.units++;
      });
    }
    const bar = Array.from(document.querySelectorAll('.con-cmdbar [class*="cmd"]'))
      .filter((el) => visible(el) && el.children.length === 0)
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0);
    return {
      fixture, preset, zones: byZone, total,
      prose: runs.filter((r) => r.kind === 'words' && r.words >= 2).map((r) => ({zone: r.zone, text: r.text})),
      bar,
    };
  }, {zones: ZONES, iconSelector: ICON_SELECTOR, fixture, preset});
}

const PRESETS = PARLIAMENT_PRESETS.filter((p) => p.id === 'tv-4k' || p.id === 'standard-1080');
const FIXTURES = ['parliament-recap', 'parliament'] as const;

for (const preset of PRESETS) {
  for (const fixture of FIXTURES) {
    test(`parliament information budget · ${fixture} · ${preset.id}`, async ({page, request}) => {
      test.setTimeout(180_000);
      await page.setViewportSize(preset.viewport);
      await bootFixture(page, request, fixture, {query: preset.query});
      await openParliament(page);
      await expect(parliament(page)).toHaveAttribute('data-zone', /voting|ruler|parties|government/);
      const budget = await measure(page, fixture, preset.id);
      fs.mkdirSync(OUT_DIR, {recursive: true});
      fs.writeFileSync(path.join(OUT_DIR, `${fixture}-${preset.id}.json`), JSON.stringify(budget, null, 2));
      const line = Object.entries(budget.zones)
        .map(([zone, z]) => `${zone}: ${z.units} (values ${z.values} · words ${z.words}/${z.wordCount}w · icons ${z.icons} · kickers ${z.kickers})`)
        .join(' | ');
      console.log(`[budget] ${fixture} @ ${preset.id}: TOTAL ${budget.total.units} units · ${budget.total.words} word runs (${budget.total.wordCount} words) · ${budget.total.icons} icons · ${budget.total.kickers} kickers\n  ${line}\n  prose: ${budget.prose.map((p) => `[${p.zone}] ${p.text}`).join(' ‖ ')}\n  bar: ${budget.bar.join(' · ')}`);
      // Anti-vacuous: every overview zone was found and said something.
      for (const [zone] of ZONES) {
        expect(budget.zones[zone]?.units ?? 0, `zone ${zone} counted`).toBeGreaterThan(0);
      }
      expect(budget.total.units).toBeGreaterThan(20);
      // THE BUDGET (Ф3, «Зал» v7 — the plan's § 9.1 calibrated on the chamber; Парламент v8 keeps it): the overview stood
      // at 129–130 units before the rework and at 76 (gen 2) / 85 (gen 1) after Ф3's slices; v8 trades the reading line
      // for «ВАШИ ЭФФЕКТЫ» under the chamber and the influence band under the career. ZERO PROSE on the overview: every
      // zone speaks in objects, kickers and names (the reading line exists only in a beat). The guard reads the DOM, so
      // a new «Резолюция ещё не принята» fails here, not on a photo of the TV.
      expect(budget.total.units, `the overview's information budget (${budget.total.units} units)`).toBeLessThanOrEqual(90);
      expect(budget.prose, 'no prose on the overview').toEqual([]);
      expect(budget.total.kickers, `kickers (${budget.total.kickers})`).toBeLessThanOrEqual(20);
    });
  }
}
