import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PlanetaryTrackReward from '@/client/components/pathfinders/PlanetaryTrackReward.vue';
import {fakeGameOptionsModel} from '../testHelpers';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {Reward} from '@/common/pathfinders/Reward';

/*
 * ONE REWARD of a planetary track: two props in (the reward, the game's options), no emit, nothing exposed. What it
 * renders is two nested boxes inside `.reward` — the OUTER one is the reward's frame (a production box, a points
 * badge), the INNER one its icon — and both are told by class alone.
 */
function mountReward(reward: Reward, turmoil = false) {
  return shallowMount(PlanetaryTrackReward, {
    ...globalConfig,
    props: {
      reward,
      gameOptions: fakeGameOptionsModel({expansions: {...DEFAULT_EXPANSIONS, turmoil}}),
    },
  });
}

function boxesOf(wrapper: ReturnType<typeof mountReward>): {outer: Array<string>, inner: Array<string>} {
  return {
    outer: wrapper.find('.reward > div').classes(),
    inner: wrapper.find('.reward > div > div').classes(),
  };
}

describe('PlanetaryTrackReward', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(PlanetaryTrackReward, {
      ...globalConfig,
      props: {
        reward: 'card',
        gameOptions: fakeGameOptionsModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('a plain reward is its icon alone — the inner box wears the reward\'s class, the frame around it stays bare', () => {
    const icons: ReadonlyArray<[Reward, Array<string>]> = [
      ['card', ['card']],
      ['ocean', ['ocean']],
      ['any_resource', ['std-wild-resource']],
      ['steel', ['resource_icon', 'resource_icon--steel']],
      ['tr', ['tag-tr', 'tag-size-big', 'tag-type-main']],
    ];
    for (const [reward, icon] of icons) {
      const wrapper = mountReward(reward);
      expect(wrapper.element.tagName, reward).to.eq('DIV');
      expect(wrapper.classes(), reward).to.deep.eq(['reward']);
      expect(wrapper.findAll('.reward > div'), reward).to.have.length(1);
      expect(boxesOf(wrapper), reward).to.deep.eq({outer: [], inner: icon});
    }
  });

  it('a production reward stands in the production box, a VP reward is the points badge with no icon, a M€ reward wears its class on both', () => {
    expect(boxesOf(mountReward('energy_production'))).to.deep.eq({outer: ['card-production-box'], inner: ['resource_icon', 'resource_icon--energy']});
    expect(boxesOf(mountReward('plant_production'))).to.deep.eq({outer: ['card-production-box'], inner: ['resource_icon', 'resource_icon--plants']});
    // The same resource as a plain gain has no box.
    expect(boxesOf(mountReward('energy'))).to.deep.eq({outer: [], inner: ['resource_icon', 'resource_icon--energy']});

    expect(boxesOf(mountReward('1vp'))).to.deep.eq({outer: ['card-points', 'vp1'], inner: []});
    expect(boxesOf(mountReward('2vp'))).to.deep.eq({outer: ['card-points', 'vp2'], inner: []});

    expect(boxesOf(mountReward('3mc'))).to.deep.eq({outer: ['reward-3mc'], inner: ['reward-3mc']});
    expect(boxesOf(mountReward('6mc'))).to.deep.eq({outer: ['reward-6mc'], inner: ['reward-6mc']});
  });

  it('a delegate is a delegate only with Turmoil in the game — without it the reward pays 3 M€ — and the reward follows its props', async () => {
    const wrapper = mountReward('delegate', true);
    expect(boxesOf(wrapper)).to.deep.eq({outer: [], inner: ['delegate']});

    await wrapper.setProps({gameOptions: fakeGameOptionsModel({expansions: {...DEFAULT_EXPANSIONS, turmoil: false}})});
    expect(boxesOf(wrapper)).to.deep.eq({outer: ['reward-3mc'], inner: ['reward-3mc']});

    await wrapper.setProps({reward: 'heat_production'});
    expect(boxesOf(wrapper)).to.deep.eq({outer: ['card-production-box'], inner: ['resource_icon', 'resource_icon--heat']});
  });
});
