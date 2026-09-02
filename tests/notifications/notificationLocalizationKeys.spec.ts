import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GUARD: every key the notification/event iteration 3 renders has a Russian
 * entry — a missing key falls back to raw English SILENTLY in a packaged
 * build (the dev-only «please translate» warn never ships), which is exactly
 * how «trade» / «raised 1 step(s)» reached the Russian UI.
 *
 * The list is the iteration's affected scope, not the whole dictionary: the
 * card's head label, the colony trade CTA, the bonus-card fate lines, the
 * plural-group templates the corrupted find/replace was fixed onto, and the
 * case-neutral «источник» family.
 */
const REQUIRED_RU_KEYS: ReadonlyArray<string> = [
  // The bot card's neutral head voice («ХОД ЗАВЕРШЁН» + actor chip).
  'Turn finished',
  // The colony trade CTA + controller hint (the `'trade'` sentinel maps here).
  'Trade',
  // The named bonus-card fate lines (the one-shot card's durable record).
  'MarsBot bonus card ${0} was destroyed and removed from the game',
  'MarsBot bonus card ${0} was shuffled back into its bonus deck',
  '${0} played the bonus card ${1}',
  // The plural-group raise templates the 12 corrupted sites were fixed onto.
  '${0} raised ${1} ${2} {step|steps}',
  '${0} track for ${1} production regressed ${2} {step|steps}',
  // The case-neutral attribution family (works for a player AND a card name).
  '${0} lost ${1} ${2} because of ${3}',
  '${0} gained ${1} ${2} because of ${3}',
  // The detached «show on map» affordance sentence (the hazard variant; the
  // tile-placement template is deliberately language-neutral — see below).
  '${0} appeared on the map · ${1}',
  // The queue indicators' shared aria.
  'Pending events',
  // The Modular Floodgates blockade band (DP11): hostile register + the
  // worded loss unit (no number moved — the ban is the loss).
  'Against you',
  'Advancement blocked until the next generation',
];

/** Keys whose ENGLISH form is deliberately the universal value (the make:json
 *  build FORBIDS an identical translation, so their absence is the design). */
const LANGUAGE_NEUTRAL_KEYS: ReadonlyArray<string> = [
  '${0} ${1} ${2} · ${3}',
];

describe('notification iteration 3 — RU localization guard', () => {
  function mergedRuDictionary(): Record<string, string> {
    const dir = path.join(__dirname, '..', '..', 'src', 'locales', 'ru');
    const merged: Record<string, string> = {};
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) {
        continue;
      }
      Object.assign(merged, JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    }
    return merged;
  }

  it('every affected key is translated (no silent English fallback)', () => {
    const ru = mergedRuDictionary();
    const missing = REQUIRED_RU_KEYS.filter((key) => ru[key] === undefined || ru[key] === '');
    expect(missing, `add RU values for: ${missing.join(' | ')}`).to.deep.eq([]);
  });

  it('a translated value never leaks the raw sentinel or a dangling preposition', () => {
    const ru = mergedRuDictionary();
    // «из-за ${N}» requires declining the name that fills the slot — the
    // case-neutral form is the contract (arbitrary player/card names).
    for (const key of ['${0} lost ${1} ${2} because of ${3}', '${0} gained ${1} ${2} because of ${3}',
      '${0} lost ${1} ${2} production because of ${3}', '${0} gained ${1} ${2} production because of ${3}',
      '${0} gained a bonus ${1} because of ${2}']) {
      expect(ru[key], `${key} must not decline an arbitrary name («из-за X»)`).to.not.match(/из-за \$\{\d\}$/);
    }
  });

  it('language-neutral templates stay untranslated by design', () => {
    const ru = mergedRuDictionary();
    for (const key of LANGUAGE_NEUTRAL_KEYS) {
      expect(ru[key], `${key} must NOT get an RU entry (identity values are forbidden by make:json)`)
        .to.eq(undefined);
    }
  });
});
