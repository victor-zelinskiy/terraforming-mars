import {expect} from 'chai';
import {placementReasonToUnplayable} from '@/client/components/board/placementReason';

describe('placementReasonToUnplayable', () => {
  it('a money block with a gap reads as the gap', () => {
    const reason = placementReasonToUnplayable('cannot-afford', 6);
    expect(reason.type).eq('megacredits');
    expect(reason.message).eq('Need ${0} more M€');
    expect(reason.params).deep.eq(['6']);
  });

  it('names the M€ the pending action has already earmarked', () => {
    // Without it the refusal is arithmetic the player cannot check: the cell's
    // own row says «расчистка 16 M€» while the bank shows 40 M€.
    const reason = placementReasonToUnplayable('cannot-afford', 1, 25);
    expect(reason.type).eq('megacredits');
    expect(reason.message).eq('Need ${0} more M€ — ${1} M€ goes to the project itself');
    expect(reason.params).deep.eq(['1', '25']);
  });

  it('nothing earmarked → the plain gap, never a "0 M€" clause', () => {
    expect(placementReasonToUnplayable('cannot-afford-bonus', 4, 0).message).eq('Need ${0} more M€');
    expect(placementReasonToUnplayable('cannot-afford-bonus', 4).message).eq('Need ${0} more M€');
  });

  it('no gap → the generic afford label, still on the money accent', () => {
    const reason = placementReasonToUnplayable('cannot-afford', 0, 25);
    expect(reason.type).eq('megacredits');
    expect(reason.params).is.undefined;
  });

  it('a placement rule keeps its own accent', () => {
    expect(placementReasonToUnplayable('adjacent-to-city').type).eq('placement');
    expect(placementReasonToUnplayable('unavailable').type).eq('generic');
  });
});
