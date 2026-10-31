import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import ConsoleVoteFactRow from '@/client/components/console/parliament/ConsoleVoteFactRow.vue';
import {VoteFactVm} from '@/client/console/parliament/voteInfoModel';

/**
 * ONE FACT OF A VOTE, two variants of one markup (P77 · DH «ФАКТЫ — ОБЪЕКТЫ»): the vote panel's TILE draws the leader
 * as a cube (an empty socket where nobody leads), the vote as a crown (a hollow ring where it does not lead), the party
 * effect as its places — the words ride the tile once, for assistive tech, never painted twice; the delegate mode's ROW
 * keeps its words.
 */
const mountFact = (fact: VoteFactVm, variant: 'row' | 'tile') =>
  mount(ConsoleVoteFactRow, {props: {fact, figurePx: 18, variant}, global: {mocks: {$t: (key: string) => key}}});

const LEAD: VoteFactVm = {
  id: 'lead', label: 'Leader', before: {key: 'no leader yet', dash: true}, after: {key: 'you', cube: 'blue' as Color},
  unchanged: false, tone: 'gain', note: undefined,
};
const WIN: VoteFactVm = {id: 'win', label: 'Leading the vote', before: {key: 'no'}, after: {key: 'yes'}, unchanged: false, tone: 'gain', note: undefined};
const ACCESS: VoteFactVm = {
  id: 'access', label: 'Party effect', before: {key: '${0} of ${1}', params: ['1', '2']}, after: {key: 'effect is yours'},
  unchanged: false, tone: 'gain', note: undefined,
};

describe('ConsoleVoteFactRow — the tile draws objects', () => {
  it('the leader: an empty SOCKET before (nobody leads), the viewer\'s CUBE after — never a dash or a word painted', () => {
    const tile = mountFact(LEAD, 'tile');
    expect(tile.find('.con-parl__fact').classes()).to.include('con-parl__fact--tile');
    const objects = tile.find('.con-parl__fact-val--objects');
    expect(objects.find('[data-fact-socket]').exists(), 'the empty socket').to.eq(true);
    expect(objects.find('.player-delegate').exists(), 'the cube that takes the lead').to.eq(true);
    expect(objects.text(), 'no dash, no word among the objects').not.to.match(/—|you/);
    expect(tile.find('.con-parl__fact-words').text(), 'the words, once, for assistive tech').to.contain('you');
  });

  it('the vote: a hollow ring → the crown', () => {
    const tile = mountFact(WIN, 'tile');
    const crowns = tile.findAll('.con-parl__fact-crown');
    expect(crowns.map((c) => c.classes().includes('con-parl__fact-crown--off'))).to.deep.eq([true, false]);
  });

  it('the party effect: 1 of 2 places → 2 of 2 and «effect is yours» — the probe-readable words stay in the tile', () => {
    const tile = mountFact(ACCESS, 'tile');
    const sides = tile.findAll('.con-parl__fact-places');
    expect(sides.map((side) => side.findAll('.con-parl__fact-place--on').length)).to.deep.eq([1, 2]);
    expect(tile.find('.con-parl__fact-yours').text(), 'the word under the places').to.eq('effect is yours');
    expect(tile.text()).to.match(/1 of 2.*effect is yours/);
  });

  it('the row keeps its words (the delegate mode)', () => {
    const row = mountFact(LEAD, 'row');
    expect(row.find('.con-parl__fact').classes()).not.to.include('con-parl__fact--tile');
    expect(row.find('.con-parl__fact-val--objects').exists()).to.eq(false);
    expect(row.find('.con-parl__fact-words').exists()).to.eq(false);
    expect(row.find('.con-parl__fact-none').text()).to.eq('—');
  });
});
