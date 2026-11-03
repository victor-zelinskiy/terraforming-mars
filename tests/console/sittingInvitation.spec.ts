import {expect} from 'chai';
import {sittingInvitationFacts} from '../../src/client/console/parliament/sittingInvitation';
import {ParliamentModel} from '../../src/common/models/ParliamentModel';

/**
 * THE SITTING'S INVITATION PLATE (P51 · ledger FG): the plate always names the resolution and the winner of the vote,
 * read off the server's own records in a fixed order — the live summary, the bare winner, the vote's forecast, the
 * last finished sitting.
 */
const as = (v: unknown) => v as ParliamentModel;

const slots = [
  {instance: 'i1', resolution: 'RX01', party: 'greens', isWinning: false, leader: undefined},
  {instance: 'i2', resolution: 'RX05', party: 'scientists', isWinning: true, leader: 'blue'},
  {instance: 'i3', resolution: 'RX09', party: 'reds', isWinning: false, leader: 'red'},
];
const summaryWinner = {instance: 'i2', resolution: 'RX05', party: 'scientists', votes: 3, player: 'blue'};

describe('sittingInvitationFacts', () => {
  it('no parliament, nothing up for a vote: no facts (the plate says «Заседание» alone)', () => {
    expect(sittingInvitationFacts(undefined)).is.undefined;
    expect(sittingInvitationFacts(as({slots: [], phase: {generation: 1, final: false, step: 'winner'}}))).is.undefined;
  });

  it('the live summary: the resolution being enacted and the winner of the vote', () => {
    const facts = sittingInvitationFacts(as({slots, phase: {generation: 2, final: false, step: 'agenda', summary: {winner: summaryWinner}}}));
    expect(facts).deep.eq({resolution: 'RX05', party: 'scientists', resolutionKey: 'Being enacted', winner: 'blue', forecast: false});
  });

  it('the sitting over (the seat still to close it): «принята»', () => {
    const facts = sittingInvitationFacts(as({slots, phase: {generation: 2, final: false, step: 'done', summary: {winner: summaryWinner}}}));
    expect(facts?.resolutionKey).eq('Enacted');
  });

  it('a neutral winner is named as such; a tie names how it was broken', () => {
    const facts = sittingInvitationFacts(as({slots, phase: {generation: 2, final: false, step: 'effects',
      summary: {winner: {...summaryWinner, player: 'neutral', tieBreak: 'earlier-delegate'}}}}));
    expect(facts?.winner).eq('neutral');
    expect(facts?.tieKey).eq('Tie broken by the earlier delegate');
  });

  it('a bare winner (no summary yet): the resolution read off the slot it stands on', () => {
    const facts = sittingInvitationFacts(as({slots, phase: {generation: 2, final: false, step: 'winner', winner: {instance: 'i3', player: 'red'}}}));
    expect(facts).deep.eq({resolution: 'RX09', party: 'reds', resolutionKey: 'Being enacted', winner: 'red', forecast: false});
  });

  it('before the verdict: the vote\'s FORECAST, with its own verb', () => {
    const facts = sittingInvitationFacts(as({slots, phase: {generation: 2, final: false, step: 'winner'}}));
    expect(facts).deep.eq({resolution: 'RX05', party: 'scientists', resolutionKey: 'Leading the vote', winner: 'blue', forecast: true});
  });

  it('no live sitting: the last finished one', () => {
    const facts = sittingInvitationFacts(as({slots, lastPhase: {winner: {...summaryWinner, tieBreak: 'slot-priority'}}}));
    expect(facts).deep.eq({resolution: 'RX05', party: 'scientists', resolutionKey: 'Enacted', winner: 'blue', forecast: false, tieKey: 'Tie broken by the slot order'});
  });
});
