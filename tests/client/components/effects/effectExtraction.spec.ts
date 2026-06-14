import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {isICardRenderItem} from '@/common/cards/render/Types';
import {
  cardHasPassiveEffect,
  playerEffects,
  playerEffectGroups,
  playerEffectCount,
  allScopeEffectCardNames,
  overriddenEffectCards,
  flaggedEffectCandidates,
} from '@/client/components/effects/effectExtraction';

function model(name: CardName, isDisabled = false): CardModel {
  return {name, isDisabled} as CardModel;
}

describe('effectExtraction', () => {
  it('detects a clean passive effect with a render node (Space Station discount)', () => {
    expect(cardHasPassiveEffect(CardName.SPACE_STATION)).to.eq(true);
    const entries = playerEffects([model(CardName.SPACE_STATION)]);
    expect(entries).to.have.length(1);
    expect(entries[0].effectNode).to.not.eq(undefined);
    expect(entries[0].isCorporation).to.eq(false);
  });

  it('excludes action-only blue cards (no passive effect node)', () => {
    expect(cardHasPassiveEffect(CardName.ANTS)).to.eq(false);
    expect(playerEffects([model(CardName.ANTS)])).to.have.length(0);
  });

  it('detects a corporation passive effect (Poseidon)', () => {
    expect(cardHasPassiveEffect(CardName.POSEIDON)).to.eq(true);
    const entries = playerEffects([model(CardName.POSEIDON)]);
    expect(entries).to.have.length(1);
    expect(entries[0].isCorporation).to.eq(true);
  });

  it('orders corporation effects before card effects', () => {
    const entries = playerEffects([model(CardName.SPACE_STATION), model(CardName.POSEIDON)]);
    expect(entries[0].isCorporation).to.eq(true); // Poseidon (corp) first
    expect(entries[1].isCorporation).to.eq(false); // Space Station (card) second
  });

  it('covers Olympus Conference via renderWhole (real symbol graphic + description)', () => {
    expect(cardHasPassiveEffect(CardName.OLYMPUS_CONFERENCE)).to.eq(true);
    const entries = playerEffects([model(CardName.OLYMPUS_CONFERENCE)]);
    expect(entries).to.have.length(1);
    expect(entries[0].effectNode).to.eq(undefined);
    expect(entries[0].renderRoot).to.not.eq(undefined); // whole-renderData graphic
    expect(entries[0].text).to.not.eq(undefined); // localized card description
  });

  it('flags a disabled card so it can be dimmed', () => {
    const entries = playerEffects([model(CardName.SPACE_STATION, true)]);
    expect(entries[0].isDisabled).to.eq(true);
  });

  it('counts total effect blocks across a tableau', () => {
    expect(playerEffectCount([model(CardName.POSEIDON), model(CardName.SPACE_STATION), model(CardName.ANTS)])).to.eq(2);
  });

  it('enumerates a substantial set of in-scope effect cards for the playground', () => {
    expect(allScopeEffectCardNames().length).to.be.greaterThan(50);
  });

  it('groups several effects from ONE source into a single group (no name dup)', () => {
    const groups = playerEffectGroups([model(CardName.CARBON_NANOSYSTEMS)]);
    expect(groups).to.have.length(1);
    expect(groups[0].cardName).to.eq(CardName.CARBON_NANOSYSTEMS);
    expect(groups[0].effects.length).to.eq(2); // two distinct effects, one group
  });

  it('orders groups corporation-first', () => {
    const groups = playerEffectGroups([model(CardName.SPACE_STATION), model(CardName.POSEIDON)]);
    expect(groups).to.have.length(2);
    expect(groups[0].isCorporation).to.eq(true); // Poseidon group first
    expect(groups[1].isCorporation).to.eq(false);
  });

  it('covers the bespoke-render edge cases so they show in the all-effects list', () => {
    // Olympus / Protected Habitats / Neptunian render the WHOLE renderData.
    for (const c of [
      CardName.OLYMPUS_CONFERENCE,
      CardName.PROTECTED_HABITATS,
      CardName.NEPTUNIAN_POWER_CONSULTANTS,
    ]) {
      expect(cardHasPassiveEffect(c), c).to.eq(true);
      expect(overriddenEffectCards(), c).to.include(c);
      expect(flaggedEffectCandidates(), c).to.not.include(c);
    }
    // Protected Habitats renders its whole renderData (graphic).
    expect(playerEffects([model(CardName.PROTECTED_HABITATS)])[0].renderRoot).to.not.eq(undefined);
  });

  it('extracts Supercapacitors via the generic scan (real effect() node, no override)', () => {
    // Supercapacitors now carries a clean effect() node (energy -> heat with a
    // crossed-out arrow), so the generic renderData scan finds it — no override.
    expect(cardHasPassiveEffect(CardName.SUPERCAPACITORS)).to.eq(true);
    expect(overriddenEffectCards()).to.not.include(CardName.SUPERCAPACITORS);
    expect(flaggedEffectCandidates()).to.not.include(CardName.SUPERCAPACITORS);
    const entry = playerEffects([model(CardName.SUPERCAPACITORS)])[0];
    expect(entry.effectNode).to.not.eq(undefined); // a real effect box, not a fallback
    expect(entry.text).to.eq(undefined);
    expect(entry.renderRoot).to.eq(undefined);
  });

  it('keeps the flagged-candidates list small (only true unknowns / vanilla)', () => {
    const flagged = flaggedEffectCandidates();
    expect(flagged).to.not.include(CardName.SPACE_STATION); // already renders
    expect(flagged).to.not.include(CardName.ANTS); // action-only
    expect(flagged).to.not.include(CardName.OLYMPUS_CONFERENCE); // overridden
    expect(flagged.length).to.be.lessThan(8);
  });

  it('carries a per-effect index + a SEPARATE key per effect (multi-effect card)', () => {
    const entries = playerEffects([model(CardName.CARBON_NANOSYSTEMS)]);
    expect(entries.length).to.eq(2);
    expect(entries.map((e) => e.effectIndex)).to.deep.eq([0, 1]);
    // Each effect is independently selectable → distinct keys.
    expect(entries[0].key).to.not.eq(entries[1].key);
    // The per-effect description field is present on every entry.
    expect(entries[0]).to.have.property('description');
    expect(entries[1]).to.have.property('description');
  });

  it('extracts the per-effect description string from a clean effect node (Space Station)', () => {
    const entry = playerEffects([model(CardName.SPACE_STATION)])[0];
    expect(entry.effectIndex).to.eq(0);
    expect(entry.description, 'a discount effect carries a prose description').to.be.a('string');
  });

  it('exposes effectIndex + description on the grouped effects too', () => {
    const effects = playerEffectGroups([model(CardName.CARBON_NANOSYSTEMS)])[0].effects;
    expect(effects.map((e) => e.effectIndex)).to.deep.eq([0, 1]);
    expect(effects[0]).to.have.property('description');
  });

  it('extracts a DISJOINT per-effect impact signature (PolderTech Dutch)', () => {
    // effect A: ocean → energy; effect B: greenery → plant. Disjoint signatures let
    // the details panel scope the per-game stats to the SELECTED effect.
    const entries = playerEffects([model(CardName.POLDERTECH_DUTCH)]);
    expect(entries.length).to.eq(2);
    const a = entries[0].signature.icons;
    const b = entries[1].signature.icons;
    expect(a).to.include('energy');
    expect(a).to.not.include('plants');
    expect(b).to.include('plants');
    expect(b).to.not.include('energy');
  });

  it('marks a discount-effect signature + a draw-effect signature (Solar Logistics)', () => {
    const entries = playerEffects([model(CardName.SOLAR_LOGISTICS)]);
    const discount = entries.find((e) => e.signature.discount);
    expect(discount, 'a discount effect (earth tag → −2 M€)').to.not.be.undefined;
    expect(discount!.signature.icons).to.include('megacredits');
    const draw = entries.find((e) => e.signature.icons.includes('cards'));
    expect(draw, 'a draw effect (space event → draw a card)').to.not.be.undefined;
  });

  it('splices a root cause into an empty-cause effect (Viral Vectors shows the full trigger)', () => {
    const entries = playerEffects([model(CardName.VIRAL_ENHANCERS)]);
    expect(entries.length).to.eq(1);
    // The trigger tags (plant/microbe/animal) lived on a ROOT row with an empty
    // effect cause; extraction splices them in so the effect block isn't truncated.
    const cause = entries[0].effectNode?.rows?.[0] ?? [];
    expect(cause.some(isICardRenderItem), 'spliced trigger items present in the cause').to.be.true;
  });

  it('detects a resource-as-payment signature (Psychrophiles / Carbon Nanosystems)', () => {
    expect(playerEffects([model(CardName.PSYCHROPHILES)]).some((e) => e.signature.valueAsPayment),
      'Psychrophiles microbe = 2 M€').to.be.true;
    expect(playerEffects([model(CardName.CARBON_NANOSYSTEMS)]).some((e) => e.signature.valueAsPayment),
      'Carbon Nanosystems graphene = 4 M€').to.be.true;
    // A plain effect (Space Station discount) is NOT a resource-as-payment effect.
    expect(playerEffects([model(CardName.SPACE_STATION)]).every((e) => !e.signature.valueAsPayment)).to.be.true;
  });
});
