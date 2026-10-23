import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PRISTAR_MARK_HINT, pristarMarkOf} from '@/client/console/railMarks';

/**
 * THE RATING CELL'S MARKS — the pure half (R07 Pristar): a seat wears the mark only with the corporation on its
 * public tableau, its state is the server's `ratingRaisedThisGeneration`, the MarsBot never wears it.
 */
function seat(over: {cards?: ReadonlyArray<CardName>, raised?: boolean, bot?: boolean} = {}): PublicPlayerModel {
  return {
    tableau: (over.cards ?? []).map((name) => ({name})),
    ratingRaisedThisGeneration: over.raised ?? false,
    ...(over.bot === true ? {isMarsBot: true} : {}),
  } as unknown as PublicPlayerModel;
}

describe('railMarks — Pristar\'s state on the rating cell', () => {
  it('no Pristar on the table → no mark, whatever the flag says', () => {
    expect(pristarMarkOf(seat())).is.undefined;
    expect(pristarMarkOf(seat({cards: [CardName.UNITED_NATIONS_MARS_INITIATIVE], raised: true}))).is.undefined;
  });

  it('Pristar: «waiting» while the rating has not risen, «spent» once it has', () => {
    expect(pristarMarkOf(seat({cards: [CardName.PRISTAR]}))).eq('waiting');
    expect(pristarMarkOf(seat({cards: [CardName.PRISTAR, CardName.ANTS], raised: true}))).eq('spent');
  });

  it('the MarsBot seat never wears it (its C36 twin is its own mechanic)', () => {
    expect(pristarMarkOf(seat({cards: [CardName.PRISTAR], bot: true}))).is.undefined;
  });

  it('one sentence per state, the card named by a parameter', () => {
    expect(PRISTAR_MARK_HINT.waiting).to.contain('${0}');
    expect(PRISTAR_MARK_HINT.spent).to.contain('${0}');
    expect(PRISTAR_MARK_HINT.waiting).to.not.eq(PRISTAR_MARK_HINT.spent);
  });
});
