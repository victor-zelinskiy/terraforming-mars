import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {
  playedCardsPickState,
  PLAYED_PICK_OVERLAY_THRESHOLD,
  enterPlayedCardsPick,
  resolvePlayedCardsPick,
  cancelPlayedCardsPick,
  exitPlayedCardsPick,
  isPlayedPickCandidate,
  setPlayedPickAvailability,
} from '@/client/components/playedCards/playedCardsPickState';
import {
  playedPickUnavailableReason,
  PICK_REASON_NO_RESOURCE,
  PICK_REASON_WRONG_RESOURCE,
  PICK_REASON_CONDITION,
} from '@/client/components/playedCards/playedCardsPickReason';

describe('playedCardsPickState', () => {
  beforeEach(() => exitPlayedCardsPick());

  it('threshold is 3 (>3 routes to the board)', () => {
    expect(PLAYED_PICK_OVERLAY_THRESHOLD).to.eq(3);
  });

  it('enter sets active + selectable + title', () => {
    enterPlayedCardsPick({
      title: 'Select card to add 1 microbe',
      selectable: [CardName.TARDIGRADES, CardName.ANTS],
      onResolve: () => {},
    });
    expect(playedCardsPickState.active).is.true;
    expect(playedCardsPickState.title).to.eq('Select card to add 1 microbe');
    expect(playedCardsPickState.selectable).to.have.members([CardName.TARDIGRADES, CardName.ANTS]);
    expect(isPlayedPickCandidate(CardName.TARDIGRADES)).is.true;
    expect(isPlayedPickCandidate(CardName.BIRDS)).is.false;
  });

  it('resolve delivers the picked card then exits', () => {
    let delivered: CardName | undefined;
    enterPlayedCardsPick({
      title: 'x',
      selectable: [CardName.ANTS],
      onResolve: (c) => {
        delivered = c;
      },
    });
    resolvePlayedCardsPick(CardName.ANTS);
    expect(delivered).to.eq(CardName.ANTS);
    expect(playedCardsPickState.active).is.false;
    expect(isPlayedPickCandidate(CardName.ANTS)).is.false;
  });

  it('cancel exits WITHOUT delivering', () => {
    let delivered: CardName | undefined;
    enterPlayedCardsPick({
      title: 'x',
      selectable: [CardName.ANTS],
      onResolve: (c) => {
        delivered = c;
      },
    });
    cancelPlayedCardsPick();
    expect(delivered).is.undefined;
    expect(playedCardsPickState.active).is.false;
  });

  it('isPlayedPickCandidate is false when inactive', () => {
    expect(isPlayedPickCandidate(CardName.ANTS)).is.false;
  });

  it('availability defaults to "available" and resets on enter', () => {
    setPlayedPickAvailability('unavailable');
    expect(playedCardsPickState.availability).to.eq('unavailable');
    enterPlayedCardsPick({title: 'x', selectable: [CardName.ANTS], onResolve: () => {}});
    expect(playedCardsPickState.availability).to.eq('available');
  });

  describe('playedPickUnavailableReason', () => {
    const microbeTarget = new Set<CardResource | undefined>([CardResource.MICROBE]);

    it('no resourceType → "holds no resources"', () => {
      expect(playedPickUnavailableReason(undefined, microbeTarget)).to.eq(PICK_REASON_NO_RESOURCE);
    });
    it('different resourceType → "holds a different resource"', () => {
      expect(playedPickUnavailableReason(CardResource.ANIMAL, microbeTarget)).to.eq(PICK_REASON_WRONG_RESOURCE);
    });
    it('same resourceType (excluded by tag/min) → "does not meet the requirement"', () => {
      expect(playedPickUnavailableReason(CardResource.MICROBE, microbeTarget)).to.eq(PICK_REASON_CONDITION);
    });
    it('any-resource target (mixed types) → "does not meet the requirement"', () => {
      const anyTarget = new Set<CardResource | undefined>([CardResource.MICROBE, CardResource.ANIMAL]);
      expect(playedPickUnavailableReason(CardResource.FLOATER, anyTarget)).to.eq(PICK_REASON_CONDITION);
    });
  });
});
