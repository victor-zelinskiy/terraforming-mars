import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {cardPickSurface} from '@/client/components/cardPickRouting';

describe('cardPickSurface', () => {
  const hand = new Set<CardName>([CardName.BIRDS, CardName.FISH]);
  const tableau = new Set<CardName>([CardName.ANTS, CardName.TARDIGRADES, CardName.PETS, CardName.PREDATORS]);
  const card = (name: CardName) => ({name});

  it('≤3 single-card pick stays inline (no roomy surface)', () => {
    expect(cardPickSurface([card(CardName.ANTS), card(CardName.PETS)], hand, tableau, false)).to.eq('inline');
  });

  it('>3 own-tableau candidates → the РАЗЫГРАНО board', () => {
    const cards = [CardName.ANTS, CardName.TARDIGRADES, CardName.PETS, CardName.PREDATORS].map(card);
    expect(cardPickSurface(cards, hand, tableau, false)).to.eq('board');
  });

  it('a MULTI-card pick ALWAYS routes to a roomy surface, even with ≤3 candidates', () => {
    // 2 tableau candidates but multiCard → board (two inline grids don't fit).
    expect(cardPickSurface([card(CardName.ANTS), card(CardName.PETS)], hand, tableau, true)).to.eq('board');
  });

  it('>3 hand candidates → the КАРТЫ В РУКЕ overlay (ownership drives the surface)', () => {
    const bigHand = new Set<CardName>([CardName.BIRDS, CardName.FISH, CardName.ANTS, CardName.TARDIGRADES]);
    const cards = [CardName.BIRDS, CardName.FISH, CardName.ANTS, CardName.TARDIGRADES].map(card);
    expect(cardPickSurface(cards, bigHand, new Set(), false)).to.eq('hand');
  });

  it('a multi-card HAND pick also routes to the КАРТЫ В РУКЕ overlay', () => {
    expect(cardPickSurface([card(CardName.BIRDS), card(CardName.FISH)], hand, tableau, true)).to.eq('hand');
  });

  it('MIXED hand + tableau candidates → inline (no single roomy surface owns them)', () => {
    const cards = [CardName.BIRDS, CardName.ANTS, CardName.PETS, CardName.PREDATORS].map(card); // 1 hand + 3 tableau
    expect(cardPickSurface(cards, hand, tableau, false)).to.eq('inline');
  });

  it('empty candidate set → inline', () => {
    expect(cardPickSurface([], hand, tableau, true)).to.eq('inline');
  });
});
