import {expect} from 'chai';
import {PassFacts, passWarnings} from '../../src/client/console/passWarnings';

/**
 * WHAT THE PASS LEAVES UNUSED (the owner's iteration of 2026-10-15): an action with no effect is never listed as an
 * opportunity; when nothing else is left, one quiet line says so and the list is empty (the pass stays calm).
 */
const NONE: PassFacts = {cardActions: 0, futileCardActions: 0, trade: false, plants: false, heat: 'none', hydro: false};

describe('passWarnings', () => {
  it('nothing left — nothing said', () => {
    expect(passWarnings(NONE)).to.deep.eq({lines: []});
  });

  it('counts only the USEFUL card actions', () => {
    const w = passWarnings({...NONE, cardActions: 3, futileCardActions: 1});
    expect(w.lines).to.deep.eq([{key: 'You still have unused available actions', count: '2'}]);
    expect(w.quiet).to.be.undefined;
  });

  it('THE OWNER\'S CASE: only futile actions and a heat conversion at the maximum — no warning, one quiet line', () => {
    const w = passWarnings({...NONE, cardActions: 2, futileCardActions: 2, heat: 'futile'});
    expect(w.lines, 'nothing is presented as an opportunity').to.deep.eq([]);
    expect(w.quiet).to.deep.eq({key: 'Only actions with no effect remain', count: '3'});
  });

  it('a useful heat conversion still warns; a futile one never does', () => {
    expect(passWarnings({...NONE, heat: 'useful'}).lines).to.deep.eq([{key: 'You can still convert heat into temperature'}]);
    expect(passWarnings({...NONE, heat: 'futile'}).lines).to.deep.eq([]);
  });

  it('with something of value left, the quiet line is not added (the warning is the message)', () => {
    const w = passWarnings({...NONE, cardActions: 2, futileCardActions: 1, plants: true, heat: 'futile'});
    expect(w.lines.map((l) => l.key)).to.deep.eq(['You still have unused available actions', 'You can still convert plants into greenery']);
    expect(w.quiet).to.be.undefined;
  });

  it('every other opportunity keeps its line, in the confirm\'s order', () => {
    const w = passWarnings({cardActions: 1, futileCardActions: 0, trade: true, plants: true, heat: 'useful', hydro: true, freeVote: true});
    expect(w.lines.map((l) => l.key)).to.deep.eq([
      'You still have unused available actions',
      'You still have a free trade fleet and can afford a colony trade',
      'You can still convert plants into greenery',
      'You can still convert heat into temperature',
      'You can still advance the Hydronetwork this generation',
      'You can still vote with your free delegate from the lobby',
    ]);
  });

  it('the FREE lobby vote warns; a paid vote (the free one spent) is never a warning and no «no effect» line', () => {
    expect(passWarnings({...NONE, freeVote: true}).lines).to.deep.eq([{key: 'You can still vote with your free delegate from the lobby'}]);
    expect(passWarnings({...NONE, freeVote: false})).to.deep.eq({lines: []});
  });
});
