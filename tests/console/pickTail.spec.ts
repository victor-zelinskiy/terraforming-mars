import {expect} from 'chai';
import {tailAfterPickAnswer} from '../../src/client/console/pickTail';

/**
 * The hand's crumb after a pick of an effect is answered: handed ON to what the answer buys, never retracted — a
 * refusal (nothing follows) leaves the tail STANDING on the pick's stage until the claim ends. Written empty, the tail
 * fell back to the still-standing batch's «ДОБОР КАРТ» for the conclusion's frames (`console-effect-decision-embed`,
 * «a draw AND an effect from one press», caught by the FLAKE ZERO recorder: ~75 ms of a backwards crumb).
 */
describe('tailAfterPickAnswer', () => {
  const PICK = 'Discarding a card';

  it('hands the tail ON to the stage the answer buys', () => {
    expect(tailAfterPickAnswer(PICK, PICK, 'Card draw')).to.equal('Card draw');
  });

  it('a refusal (nothing follows) leaves the tail STANDING — never written empty', () => {
    expect(tailAfterPickAnswer(PICK, PICK, '')).to.equal(undefined);
  });

  it('never overwrites a stage the claim names by now that is not the pick’s own', () => {
    expect(tailAfterPickAnswer('Effect', PICK, 'Card draw')).to.equal(undefined);
    expect(tailAfterPickAnswer('', PICK, 'Card draw')).to.equal(undefined);
  });

  it('a pick with no stage of its own owns nothing', () => {
    expect(tailAfterPickAnswer('', '', 'Card draw')).to.equal(undefined);
  });
});
