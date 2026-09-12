import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {allScopeEffectCardNames, playerEffects} from '@/client/components/effects/effectExtraction';
import {cardChannelPlan} from '@/client/components/effects/effectChannels';
import {EFFECT_FAMILY_ORDER, EffectFamily, effectFamily} from '@/client/console/effectsExplorerModel';

/**
 * FAMILY COVERAGE GUARD — the effects explorer's per-effect FAMILY must be
 * total and sane over the WHOLE in-scope effect corpus, and the per-effect
 * channel-split worklist must stay visible (a multi-effect card without a
 * disjoint channel plan honestly degrades to card-level stats — this spec
 * names those cards, so the gap can never rot silently).
 *
 * Deliberately free of any Card.vue-family import (the mochapack spec-zeroing
 * trap): only the pure models + the extraction layer.
 */
const model = (name: CardName): CardModel => ({name} as CardModel);

/** Cards whose EMPTY render signature legitimately lands in «Правила». */
const RULES_BY_DESIGN: ReadonlySet<CardName> = new Set([
  CardName.PROTECTED_HABITATS,
]);

/**
 * THE WORKLIST: in-scope MULTI-effect cards whose effects share (or lack) a
 * channel plan — their stats stay honestly card-scoped. Shrink it by adding
 * a disjoint entry to CURATED_EFFECT_CHANNELS (effectChannels.ts); a NEW
 * multi-effect card landing here is the guard telling you to decide.
 */
const CARD_SCOPED_MULTI_EFFECT: ReadonlyArray<CardName> = [
  // Both effects tally into the ONE payment-value-bonus dimension — a split
  // by channel cannot separate steel from titanium honestly.
  CardName.ADVANCED_ALLOYS,
  // The corp's disease intake and its TR/M€ reaction share the same
  // card-played trigger — a genuine collision.
  CardName.PHARMACY_UNION,
  // Both effects fire on 'tile-placed' (ocean→energy / greenery→plant) —
  // the documented collision this fallback exists for.
  CardName.POLDERTECH_DUTCH,
  // Both halves react to the same microbe-tag play (by any player).
  CardName.SPLICE,
];

describe('effect family coverage (corpus guard)', () => {
  const corpus = allScopeEffectCardNames();

  it('classifies EVERY in-scope effect into one of the four families', () => {
    expect(corpus.length).to.be.greaterThan(50); // anti-vacuous floor
    const families = new Set<EffectFamily>();
    for (const name of corpus) {
      const entries = playerEffects([model(name)]);
      expect(entries.length, `${name} yields entries`).to.be.greaterThan(0);
      for (const entry of entries) {
        const family = effectFamily(entry, model(name), entries.length === 1);
        expect(EFFECT_FAMILY_ORDER, `${name}#${entry.effectIndex} → ${family}`).to.include(family);
        families.add(family);
      }
    }
    // The corpus genuinely exercises every family.
    expect([...families].sort()).to.deep.eq([...EFFECT_FAMILY_ORDER].sort());
  });

  it('curated family expectations hold for the marquee cards', () => {
    const expectFamily = (name: CardName, index: number, family: EffectFamily) => {
      const entries = playerEffects([model(name)]);
      const entry = entries.find((e) => e.effectIndex === index);
      expect(entry, `${name}#${index}`).to.not.be.undefined;
      expect(effectFamily(entry!, model(name), entries.length === 1), `${name}#${index}`).to.eq(family);
    };
    expectFamily(CardName.EARTH_CATAPULT, 0, 'discounts');
    expectFamily(CardName.ECOLINE, 0, 'discounts');
    expectFamily(CardName.CRYO_SLEEP, 0, 'discounts');
    expectFamily(CardName.RIM_FREIGHTERS, 0, 'discounts');
    expectFamily(CardName.PETS, 0, 'triggers');
    expectFamily(CardName.ROVER_CONSTRUCTION, 0, 'triggers');
    expectFamily(CardName.OLYMPUS_CONFERENCE, 0, 'triggers');
    expectFamily(CardName.NEPTUNIAN_POWER_CONSULTANTS, 0, 'triggers');
    expectFamily(CardName.TRADING_COLONY, 0, 'triggers');
    expectFamily(CardName.PSYCHROPHILES, 0, 'payValue');
    expectFamily(CardName.CARBON_NANOSYSTEMS, 0, 'triggers');
    expectFamily(CardName.CARBON_NANOSYSTEMS, 1, 'payValue');
    expectFamily(CardName.ADVANCED_ALLOYS, 0, 'payValue');
    expectFamily(CardName.HELION, 0, 'payValue');
    expectFamily(CardName.PROTECTED_HABITATS, 0, 'rules');
    expectFamily(CardName.ADAPTATION_TECHNOLOGY, 0, 'rules');
  });

  it('an EMPTY-signature override card never silently lands in «Правила»', () => {
    const offenders: Array<string> = [];
    for (const name of corpus) {
      const entries = playerEffects([model(name)]);
      for (const entry of entries) {
        const emptySig = entry.signature.icons.length === 0 &&
          !entry.signature.discount && !entry.signature.valueAsPayment && !entry.signature.valueModifier &&
          entry.effectNode === undefined; // an override (renderWhole / text-only)
        if (!emptySig) {
          continue;
        }
        const family = effectFamily(entry, model(name), entries.length === 1);
        if (family === 'rules' && !RULES_BY_DESIGN.has(name)) {
          offenders.push(`${name}#${entry.effectIndex}`);
        }
      }
    }
    expect(offenders, 'override cards falling to «Правила» need a FAMILY_OVERRIDES entry or an allow-list row').to.deep.eq([]);
  });

  it('the channel-split worklist is exactly the pinned set (a new multi-effect card must decide)', () => {
    const unplanned: Array<CardName> = [];
    for (const name of corpus) {
      const entries = playerEffects([model(name)]);
      if (entries.length <= 1) {
        continue;
      }
      if (cardChannelPlan(name, entries) === undefined) {
        unplanned.push(name);
      }
    }
    expect(unplanned.sort()).to.deep.eq([...CARD_SCOPED_MULTI_EFFECT].sort());
  });
});
