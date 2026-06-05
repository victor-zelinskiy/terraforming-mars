import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  cardHasPassiveEffect,
  playerEffects,
  playerEffectCount,
  allScopeEffectCardNames,
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
});
