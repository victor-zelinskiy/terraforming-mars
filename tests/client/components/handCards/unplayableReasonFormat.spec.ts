import {expect} from 'chai';
import {unplayableReasonCompact, unplayableReasonEmblem, unplayableReasonLine, unplayableReasonText} from '@/client/components/handCards/unplayableReasonFormat';
import {PartyName} from '@/common/turmoil/PartyName';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

/**
 * THE COMPACT COUNTER FORM of an unplayable reason («<label> <now>/<bound>») —
 * the one-row status rails speak it, the fullscreen panel keeps the sentence.
 * A COUNT reason has a counter presentation only when its message is in the
 * label table; a message the table does not know keeps the full line (never a
 * bare number with no subject).
 */
describe('unplayableReasonFormat — the compact counter form', () => {
  it('«delegates on resolutions» (Turmoil Redux, TR02) reads as the parliament panel\'s own counter — «On resolutions 1/3»', () => {
    const reason: UnplayableReason = {type: 'count', message: 'Requires ${0} delegate(s) on resolutions', params: ['3'], current: 1, requirement: true};
    expect(unplayableReasonCompact(reason)).eq('On resolutions 1/3');
    expect(unplayableReasonLine(reason)).eq('Requires 3 delegate(s) on resolutions · Now: 1');
  });

  it('«tags of one type» (Turmoil Redux, TR01) reads as the tag counter — «Tags 7/10», never a tag name in place of the number', () => {
    const reason: UnplayableReason = {type: 'count', message: 'Requires ${0} tags of one type', params: ['10'], current: 7, requirement: true};
    expect(unplayableReasonCompact(reason)).eq('Tags 7/10');
    expect(unplayableReasonLine(reason)).eq('Requires 10 tags of one type · Now: 7');
  });

  it('«influence» (Turmoil Redux, TR04) reads as one counter for the ceiling and the floor — «Influence 2/≤1» draws the ≤ off the template\'s «or less»', () => {
    const ceiling: UnplayableReason = {type: 'count', message: 'Requires influence ${0} or less', params: ['1'], current: 2, requirement: true};
    expect(unplayableReasonCompact(ceiling)).eq('Influence 2/≤1');
    expect(unplayableReasonLine(ceiling)).eq('Requires influence 1 or less · Now: 2');
    const floor: UnplayableReason = {type: 'count', message: 'Requires ${0} influence', params: ['2'], current: 1, requirement: true};
    expect(unplayableReasonCompact(floor)).eq('Influence 1/2');
  });

  /*
   * A NAMED PARTY REQUIREMENT (Turmoil Redux — TR15 the set's first): the party is read by its parliament name
   * (never the raw English param) and its EMBLEM on a rail; the line states both roads with their «now», and
   * a resolution that is not up for a vote is a CLOSED road — never «0 of 2».
   */
  describe('a PARTY requirement', () => {
    const base: UnplayableReason = {
      type: 'party', message: 'Requires ${0} to be ruling or ${1} of your delegates on its resolution',
      params: [PartyName.MARS, '2'], party: PartyName.MARS, current: 1, requirement: true,
    };

    it('the rule speaks the parliament name for the party (the key, not the raw param)', () => {
      expect(unplayableReasonText(base)).eq('Requires party name: Mars First to be ruling or 2 of your delegates on its resolution');
    });

    it('the line: «not ruling · your delegates on its resolution: 1 of 2»', () => {
      expect(unplayableReasonLine(base)).eq('party name: Mars First is not ruling · your delegates on its resolution: 1 of 2');
    });

    it('the compact counter: «1/2», read with the party emblem', () => {
      expect(unplayableReasonCompact(base)).eq('1/2');
      expect(unplayableReasonEmblem(base)).eq('assets/parties/redux/mars-first.png');
    });

    it('its resolution is not up for a vote: the CLOSED road is named, in the line and on the rail', () => {
      const off: UnplayableReason = {...base, current: 0, partyOffVote: true};
      expect(unplayableReasonLine(off)).eq('party name: Mars First is not ruling · its resolution is not up for a vote');
      expect(unplayableReasonCompact(off)).eq('Not in the vote');
    });

    it('the classic engine keeps its faceless line — no emblem, no counter', () => {
      const classic: UnplayableReason = {type: 'party', message: 'Requires a specific political situation', requirement: true};
      expect(unplayableReasonEmblem(classic)).eq(undefined);
      expect(unplayableReasonCompact(classic)).eq('Requires a specific political situation');
    });
  });

  /*
   * THE NAMED CHAIRMAN REQUIREMENT (Turmoil Redux — TR12 the set's first): the rule, then who holds the seat
   * now — on the rail, the chairman's badge and the holder's name.
   */
  describe('a CHAIRMAN requirement', () => {
    const held: UnplayableReason = {
      type: 'party', message: 'Requires you to be the chairman', chairmanNow: {name: 'Rival', color: 'red'}, requirement: true,
    };
    const vacant: UnplayableReason = {...held, chairmanNow: 'vacant'};

    it('the line: the rule · who holds the seat now', () => {
      expect(unplayableReasonLine(held)).eq('Requires you to be the chairman · chairman now: Rival');
      expect(unplayableReasonLine(vacant)).eq('Requires you to be the chairman · the chair is vacant');
    });

    it('the rail: the chairman badge and the holder (or «vacant»)', () => {
      expect(unplayableReasonEmblem(held)).eq('assets/misc/chairman.png');
      expect(unplayableReasonCompact(held)).eq('Rival');
      expect(unplayableReasonCompact(vacant)).eq('Vacant');
    });
  });

  it('the Hydronetwork precedent keeps its counter, and an unknown count message keeps the full line', () => {
    expect(unplayableReasonCompact({type: 'count', message: 'Requires ${0} step(s) advanced on the Hydronetwork', params: ['4'], current: 3})).eq('Hydronetwork 3/4');
    const unknown: UnplayableReason = {type: 'count', message: 'Not enough resources on this card', current: 2};
    expect(unplayableReasonCompact(unknown)).eq(unplayableReasonLine(unknown));
  });
});
