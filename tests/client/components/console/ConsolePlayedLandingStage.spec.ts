import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsolePlayedLandingStage from '@/client/components/console/played/ConsolePlayedLandingStage.vue';
import {armPlayedHero, abortPlayedHero, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';

function view(): PlayerViewModel {
  return {
    thisPlayer: {color: 'red' as Color, tableau: [{name: CardName.THARSIS_REPUBLIC}]},
    players: [{color: 'red' as Color, name: 'Вы', tableau: [{name: CardName.THARSIS_REPUBLIC}]}],
    game: {automa: undefined},
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function make() {
  return mount(ConsolePlayedLandingStage, {
    props: {playerView: view()},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {ConsolePlayedOverlay: true},
    },
  });
}

describe('ConsolePlayedLandingStage (the workspace «Разыграно» final step)', () => {
  afterEach(async () => {
    abortPlayedHero();
    await settle(5); // 'failed' lowers to 'idle' on nextTick
  });

  it('hands the tableau the LANDING dress: embedded + headless + the viewer seat forced', () => {
    const wrapper = make();
    const overlay = wrapper.findComponent({name: 'ConsolePlayedOverlay'});
    expect(overlay.exists()).to.be.true;
    expect(overlay.props('embedded')).to.be.true;
    expect(overlay.props('headless')).to.be.true;
    expect(overlay.props('forcedColor')).to.eq('red');
    wrapper.unmount();
  });

  it('the incoming card and the presenting window derive from the transaction (never props drift)', async () => {
    const wrapper = make();
    const overlay = () => wrapper.findComponent({name: 'ConsolePlayedOverlay'});
    // Armed: the submit is in flight — nothing presents, no reserved slot yet.
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    await wrapper.vm.$nextTick();
    expect(overlay().props('heroIncoming')).to.be.undefined;
    expect(overlay().props('heroActive')).to.be.false;
    // The server proved the play: the scene presents, the slot is reserved.
    playedHeroState.phase = 'preparing';
    await wrapper.vm.$nextTick();
    expect(overlay().props('heroIncoming')).to.deep.eq({name: CardName.TREES});
    expect(overlay().props('heroActive')).to.be.true;
    wrapper.unmount();
  });

  it('the stack SETTLE is a one-shot at the handoff (showing-result), re-armed per transaction', async () => {
    const wrapper = make();
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.settleRan).to.be.false;
    playedHeroState.phase = 'showing-result';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.settleRan).to.be.true; // ran (degrades to a no-op with the overlay stubbed)
    // A second pass of the same phase can never replay the press…
    playedHeroState.phase = 'returning';
    playedHeroState.phase = 'showing-result';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.settleRan).to.be.true;
    // …and a FRESH transaction re-arms the latch.
    armPlayedHero(CardName.BIRDS, false, {manualTableOpen: false, host: 'workspace'});
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.settleRan).to.be.false;
    wrapper.unmount();
  });
});
