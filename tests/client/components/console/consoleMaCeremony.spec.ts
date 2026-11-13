/*
 * ConsoleMaCeremony — the announcement channel of milestone claims / award fundings (and of a rival's completed
 * chairman quest). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) with two roots over two
 * module queues (`maCeremonyState`, `questCeremonyState`); it exposes nothing — the shell stands no ref on it.
 * Driven here the way the product drives it: a beat is OBSERVED off a view, the shell shows it (the own cinematic at
 * centre stage, a rival's as the top strip), plays the burst on the stage it stands on (its three template refs),
 * lets it go after its lifetime — the flow kernel's clock — and its leave hands the stage to the next beat.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleMaCeremony from '@/client/components/console/ConsoleMaCeremony.vue';
import {
  armMaCeremony,
  claimMaCeremonyEmbed,
  maCeremonyState,
  observeMaCeremony,
  resetMaCeremony,
} from '@/client/components/ma/maCeremonyState';
import {observeQuestCeremony, questCeremonyState, resetQuestCeremony} from '@/client/console/parliament/questCeremony';
import {motionMs} from '@/client/components/motion/motionTokens';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import type {Color} from '@/common/Color';

const me: Color = 'red';
const rival: Color = 'blue';
const players = [{color: me, name: 'Ada'}, {color: rival, name: 'Riv'}];

type Taken = {name: string, playerName?: string, color?: Color};
const maView = (over: {milestones?: ReadonlyArray<Taken>, awards?: ReadonlyArray<Taken>} = {}) => ({
  thisPlayer: {color: me},
  players,
  game: {milestones: over.milestones ?? [{name: 'Mayor'}], awards: over.awards ?? [{name: 'Banker'}]},
});
const questView = (completedBy?: Color) => ({
  thisPlayer: {color: me},
  players,
  game: {parliament: {quest: {generation: 4, source: 'chairman', ...(completedBy !== undefined ? {completedBy} : {})}}},
});

/** The lifetimes the shell gives its beats (motion at full: the suite asks for no reduced motion). */
const REMOTE_MS = motionMs(2800);
const AWARD_MS = motionMs(3000);
const QUEST_MS = motionMs(3200);

describe('ConsoleMaCeremony — the milestone / award announcement', () => {
  let clock: ManualFlowClock;

  function mountCeremony() {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleMaCeremony, {ref: 'ceremony'})]),
    });
    const wrapper = mount(Host, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {MaHeroArt: true, PremiumChairGlyph: true, ConsoleMaWaivedPrice: true}},
    });
    return {
      wrapper,
      /** The beat's leave has finished — said by its (stubbed) transition, the first root's or the second's. */
      gone: async (root: 0 | 1) => {
        wrapper.findAllComponents({name: 'transition'})[root].vm.$emit('after-leave');
        await nextTick();
      },
    };
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetMaCeremony();
    resetQuestCeremony();
    // Seeded with everything still open, so the next observation is a LIVE take.
    observeMaCeremony(maView());
    observeQuestCeremony(questView());
  });

  afterEach(() => {
    // The queues are MODULES (and a current own beat is a live animation hold): leave them as they were found.
    resetMaCeremony();
    resetQuestCeremony();
    setFlowClock(undefined);
  });

  it('with nothing queued it renders nothing, and a parent\'s ref sees nothing of the script', () => {
    const {wrapper} = mountCeremony();
    expect(wrapper.find('.con-macere').exists()).to.eq(false);
    const reach = (wrapper.vm.$refs.ceremony ?? undefined) as Record<string, unknown> | undefined;
    expect(reach, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(reach!), 'no `defineExpose`: nothing is a parent\'s to call').to.deep.eq([]);
    for (const inner of ['showCurrent', 'showQuest', 'visible', 'flow']) {
      expect(reach![inner], `«${inner}» stays inside`).to.eq(undefined);
    }
  });

  it('a RIVAL\'s claim is the top strip — who took what, a calm ping on the strip\'s own stage — gone after its lifetime; its leave advances the queue', async () => {
    const {wrapper, gone} = mountCeremony();
    observeMaCeremony(maView({milestones: [{name: 'Mayor', playerName: 'Riv', color: rival}]}));
    await flushPromises();

    const strip = wrapper.find('.con-macere');
    expect(strip.classes()).to.include.members(['con-macere--milestone', 'con-macere--remote']);
    expect(strip.attributes('aria-hidden')).to.eq('true');
    expect(strip.find('.con-macere__veil').exists(), 'a rival\'s beat never veils the game').to.eq(false);
    expect(strip.find('.con-macere__strip-kicker').text()).to.eq('Milestone claimed');
    expect(strip.find('.con-macere__strip-name').text()).to.eq('Mayor');
    expect(strip.find('.con-macere__actor').text()).to.contain('Riv');
    expect(strip.find('.con-macere__actor-dot').classes()).to.contain('player_bg_color_blue');
    expect(strip.find('.con-macere__strip-vp').text()).to.eq('+5 VP');
    expect(strip.find('.con-macere__strip-stage > .con-ceremony-fx').exists(), 'the burst plays on the stage the strip stands on').to.eq(true);

    clock.advance(REMOTE_MS - 1);
    await nextTick();
    expect(wrapper.find('.con-macere').exists(), 'still inside its lifetime').to.eq(true);
    clock.advance(1);
    await nextTick();
    expect(wrapper.find('.con-macere').exists()).to.eq(false);

    expect(maCeremonyState.current?.name, 'the beat is current until its leave has finished').to.eq('Mayor');
    await gone(0);
    expect(maCeremonyState.current, 'ONE advance per beat').to.eq(undefined);
  });

  it('the viewer\'s OWN funding is the centre-stage cinematic with the price it was armed with; the next queued beat follows its leave', async () => {
    const {wrapper, gone} = mountCeremony();
    armMaCeremony({kind: 'award', name: 'Banker', cost: 14, free: false});
    observeMaCeremony(maView({
      milestones: [{name: 'Mayor', playerName: 'Riv', color: rival}],
      awards: [{name: 'Banker', playerName: 'Ada', color: me}],
    }));
    // Two takes in one view: the rival's milestone is shown first (the pools' order), the own award waits its turn.
    await flushPromises();
    expect(wrapper.find('.con-macere').classes()).to.contain('con-macere--remote');
    clock.advance(REMOTE_MS);
    await nextTick();
    await gone(0);
    await flushPromises();

    const scene = wrapper.find('.con-macere');
    expect(scene.classes()).to.contain('con-macere--award');
    expect(scene.classes(), 'the own beat is the full presentation').to.not.contain('con-macere--remote');
    expect(scene.find('.con-macere__veil').exists()).to.eq(true);
    expect(scene.find('.con-macere__kicker').text()).to.eq('Award funded');
    expect(scene.find('.con-macere__name').text()).to.eq('Banker');
    expect(scene.find('.con-macere__actor').text()).to.contain('Ada');
    expect(scene.find('.con-macere__cost').text()).to.contain('14');
    expect(scene.find('.con-macere__vp').exists(), 'an award is no «+5»').to.eq(false);
    expect(scene.find('.con-macere__stage > .con-ceremony-fx').exists(), 'the coronation\'s burst plays on the centre stage').to.eq(true);

    clock.advance(AWARD_MS);
    await flushPromises();
    expect(wrapper.find('.con-macere').exists(), 'the points left first, then the scene').to.eq(false);
    await gone(0);
    expect(maCeremonyState.current).to.eq(undefined);
  });

  it('an own beat the milestones workspace CLAIMED is left to it — never two emblems on screen', async () => {
    const {wrapper} = mountCeremony();
    claimMaCeremonyEmbed('milestone', 'Mayor');
    observeMaCeremony(maView({milestones: [{name: 'Mayor', playerName: 'Ada', color: me}]}));
    await flushPromises();
    expect(maCeremonyState.current?.own, 'the beat stands in the queue').to.eq(true);
    expect(wrapper.find('.con-macere').exists(), 'and the claimant presents it').to.eq(false);
    expect(maCeremonyState.current?.name, 'nor does this shell advance past a beat it does not show').to.eq('Mayor');
  });

  it('a rival\'s completed chairman quest is ONE more strip: it waits for a milestone strip to leave, then stands for its own lifetime', async () => {
    const {wrapper, gone} = mountCeremony();
    observeMaCeremony(maView({milestones: [{name: 'Mayor', playerName: 'Riv', color: rival}]}));
    observeQuestCeremony(questView(rival));
    await flushPromises();
    expect(wrapper.findAll('.con-macere'), 'one strip at a time').to.have.length(1);
    expect(wrapper.find('[data-quest-ceremony]').exists()).to.eq(false);

    clock.advance(REMOTE_MS);
    await nextTick();
    await gone(0);
    await flushPromises();

    const quest = wrapper.find('[data-quest-ceremony]');
    expect(quest.classes()).to.include.members(['con-macere', 'con-macere--remote', 'con-macere--quest']);
    expect(quest.attributes('data-quest-ceremony-actor')).to.eq('blue');
    expect(quest.find('.con-macere__strip-kicker').text()).to.eq('Chairman quest completed');
    expect(quest.find('.con-macere__strip-name').text()).to.eq('Riv');
    expect(quest.find('.con-macere__quest-gain').text()).to.contain('Chairmanship');
    expect(quest.find('.con-macere__strip-stage--quest > .con-ceremony-fx').exists(), 'the ping plays on the quest strip\'s stage').to.eq(true);

    clock.advance(QUEST_MS - 1);
    await nextTick();
    expect(wrapper.find('[data-quest-ceremony]').exists()).to.eq(true);
    clock.advance(1);
    await nextTick();
    expect(wrapper.find('[data-quest-ceremony]').exists()).to.eq(false);
    await gone(1);
    expect(questCeremonyState.current, 'its leave advances the quest queue').to.eq(undefined);
  });

  it('a beat queued while no shell was mounted is picked up at mount', async () => {
    observeMaCeremony(maView({awards: [{name: 'Banker', playerName: 'Riv', color: rival}]}));
    const {wrapper} = mountCeremony();
    await flushPromises();
    const strip = wrapper.find('.con-macere');
    expect(strip.classes()).to.include.members(['con-macere--award', 'con-macere--remote']);
    expect(strip.find('.con-macere__strip-kicker').text()).to.eq('Award funded');
    expect(strip.find('.con-macere__strip-vp').exists()).to.eq(false);
  });
});
