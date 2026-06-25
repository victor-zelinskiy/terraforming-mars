import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import {BoardFact} from '@/common/boards/BoardInformationFacts';

const current: BoardFact = {id: 'a', category: 'printed-placement-bonus', timing: 'immediate', severity: 'positive', recipient: {kind: 'current-player'}, title: 'a'};
const opponent: BoardFact = {id: 'b', category: 'city-greenery-scoring', timing: 'endgame', severity: 'warning', recipient: {kind: 'tile-owner', color: 'red'}, title: 'b'};
const neutral: BoardFact = {id: 'c', category: 'map-special-zone', timing: 'rule', severity: 'info', recipient: {kind: 'neutral'}, title: 'c'};

describe('BoardFactGroups', () => {
  it('renders one group per recipient, current player first', () => {
    const wrapper = shallowMount(BoardFactGroups, {
      ...globalConfig,
      props: {facts: [neutral, opponent, current]},
    });
    const groups = wrapper.findAll('.board-fact-group');
    expect(groups).to.have.lengthOf(3);
    expect(groups[0].classes()).to.include('board-fact-group--current-player');
    expect(groups[1].classes()).to.include('board-fact-group--tile-owner');
    expect(groups[2].classes()).to.include('board-fact-group--neutral');
  });

  it('collapses the viewer-owned recipient into the current player group', () => {
    const wrapper = shallowMount(BoardFactGroups, {
      ...globalConfig,
      props: {facts: [opponent], viewerColor: 'red'},
    });
    const groups = wrapper.findAll('.board-fact-group');
    expect(groups).to.have.lengthOf(1);
    expect(groups[0].classes()).to.include('board-fact-group--current-player');
  });
});
