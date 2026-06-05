import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  cardHasPassiveEffect,
  playerEffects,
  playerEffectGroups,
  playerEffectCount,
  allScopeEffectCardNames,
  textOverrideEffectCards,
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

  it('covers Olympus Conference via the text override (no clean effect node)', () => {
    expect(cardHasPassiveEffect(CardName.OLYMPUS_CONFERENCE)).to.eq(true);
    const entries = playerEffects([model(CardName.OLYMPUS_CONFERENCE)]);
    expect(entries).to.have.length(1);
    expect(entries[0].effectNode).to.eq(undefined);
    expect(entries[0].text).to.not.eq(undefined);
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

  it('lists text-override cards as a diagnostic (Olympus Conference)', () => {
    expect(textOverrideEffectCards()).to.include(CardName.OLYMPUS_CONFERENCE);
  });

  it('flags in-scope passive cards with no effect graphic (needs descriptor)', () => {
    const flagged = flaggedEffectCandidates();
    expect(flagged).to.include(CardName.PROTECTED_HABITATS);
    expect(flagged).to.include(CardName.SUPERCAPACITORS);
    expect(flagged).to.include(CardName.NEPTUNIAN_POWER_CONSULTANTS);
    // Must NOT include cards that already render (Space Station), action cards
    // (Ants), or text-override cards (Olympus Conference).
    expect(flagged).to.not.include(CardName.SPACE_STATION);
    expect(flagged).to.not.include(CardName.ANTS);
    expect(flagged).to.not.include(CardName.OLYMPUS_CONFERENCE);
    // Stays a small, focused list (not a dump of every card).
    expect(flagged.length).to.be.lessThan(12);
  });
});
