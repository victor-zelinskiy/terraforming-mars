/*
 * ConsolePlayedHeroLayer — the fixed, app-level proxy stage of the «card lands on my tableau» scene and of the return
 * beat. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) with no props, no emits and nothing
 * exposed: it paints the two scenes' module state — `playedHeroState` (the scene's witnesses on the root, the proxy on
 * the shared flip chassis) and `playedReturnState` (one chassis per returning card). The stage handle and the return
 * flights' chassis it registers are private to their modules: the flights that read them are walked by the e2e
 * (`console-play-landing-probe`, `console-play-landing-geometry`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsolePlayedHeroLayer from '@/client/components/console/played/ConsolePlayedHeroLayer.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {playedHeroState, PlayedHeroProxy} from '@/client/console/played/consolePlayedHero';
import {playedReturnState} from '@/client/console/played/playedCardReturn';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

// `globalConfig` promotes every Vue warning to a failure: «mounts without a warning» is part of each test.
const GLOBAL = {config: globalConfig.global.config, stubs: {ConsoleCardFaceLite: true}};

function mountLayer() {
  return mount(ConsolePlayedHeroLayer, {global: GLOBAL});
}

function proxyOf(over: Partial<PlayedHeroProxy> = {}): PlayedHeroProxy {
  return {card: CardName.ANTS, isEvent: false, rect: {x: 10, y: 20, w: 320, h: 460}, face: {lightweight: false}, ...over};
}

describe('ConsolePlayedHeroLayer — the proxy stage of the played-card scene', () => {
  afterEach(() => {
    // Both scenes are module state, shared by the whole bundle.
    playedHeroState.active = false;
    playedHeroState.phase = 'idle';
    playedHeroState.awaitingTarget = false;
    playedHeroState.discard = '';
    playedHeroState.payback = '';
    playedHeroState.proxy = undefined;
    playedReturnState.active = false;
    playedReturnState.flights = [];
    playedReturnState.nonce = 0;
  });

  it('renders nothing while neither scene stands; the hero or the return beat stands the SAME stage up', async () => {
    const wrapper = mountLayer();
    expect(wrapper.find('.con-played-hero').exists(), 'idle — no stage').to.eq(false);

    playedHeroState.active = true;
    await nextTick();
    const root = wrapper.find('.con-played-hero');
    expect(root.exists()).to.eq(true);
    expect(root.attributes('aria-hidden')).to.eq('true');
    // The template STARTS WITH ITS ROOT: the stage is the component's own element.
    expect(wrapper.element).to.eq(root.element);
    expect(root.find('.con-played-hero__proxy').exists(), 'no proxy — the no-flight path').to.eq(false);

    playedHeroState.active = false;
    await nextTick();
    expect(wrapper.find('.con-played-hero').exists()).to.eq(false);

    playedReturnState.active = true;
    await nextTick();
    expect(wrapper.find('.con-played-hero').exists(), 'the return beat is the same stage').to.eq(true);
  });

  it('the scene\'s witnesses ride the root — the phase always, the wait / the discard / the pay-back only while they say something', async () => {
    playedHeroState.active = true;
    playedHeroState.phase = 'lifting';
    const wrapper = mountLayer();
    const root = wrapper.find('.con-played-hero');
    expect(root.attributes('data-hero-phase')).to.eq('lifting');
    expect(root.attributes('data-hero-wait')).to.eq(undefined);
    expect(root.attributes('data-hero-discard')).to.eq(undefined);
    expect(root.attributes('data-hero-payback')).to.eq(undefined);

    playedHeroState.phase = 'flying';
    playedHeroState.awaitingTarget = true;
    playedHeroState.discard = 'leaving';
    playedHeroState.payback = 'paying';
    await nextTick();
    expect(root.attributes('data-hero-phase')).to.eq('flying');
    expect(root.attributes('data-hero-wait')).to.eq('target');
    expect(root.attributes('data-hero-discard')).to.eq('leaving');
    expect(root.attributes('data-hero-payback')).to.eq('paying');

    playedHeroState.awaitingTarget = false;
    await nextTick();
    expect(root.attributes('data-hero-wait'), 'the wait is over').to.eq(undefined);
  });

  it('the proxy is ONE chassis — shade, flip, sweep — wearing the face the scene hands it; only an event mounts a back', async () => {
    const model = {name: CardName.ANTS, resources: 2} as CardModel;
    playedHeroState.active = true;
    playedHeroState.proxy = proxyOf({face: {lightweight: false, card: model}});
    const wrapper = mountLayer();
    const proxy = wrapper.find('.con-played-hero > .con-played-hero__proxy');
    expect(proxy.exists()).to.eq(true);
    expect(Array.from(proxy.element.children).map((part) => part.className)).to.deep.eq([
      'con-played-hero__shade', 'con-deal-proxy__flip', 'con-played-hero__sweep',
    ]);
    const face = proxy.find('.con-deal-proxy__flip > .con-deal-proxy__face').findComponent(ConsoleCardFaceLite);
    expect(face.props('name')).to.eq(CardName.ANTS);
    expect(face.props('card')).to.deep.eq(model);
    expect(face.props('lightweight')).to.eq(false);
    expect(proxy.find('.con-deal-proxy__back').exists(), 'a non-event never mounts the back').to.eq(false);

    // The apex swap: the destination's face (its tier, its model) on the SAME chassis; an event flips over its back.
    const kept = proxy.element;
    playedHeroState.proxy = proxyOf({card: CardName.ASTEROID, isEvent: true, face: {lightweight: true}});
    await nextTick();
    expect(wrapper.find('.con-played-hero__proxy').element, 'the proxy keeps its node').to.eq(kept);
    expect(face.props('name')).to.eq(CardName.ASTEROID);
    expect(face.props('card')).to.eq(undefined);
    expect(face.props('lightweight')).to.eq(true);
    expect(proxy.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back--flyer').exists()).to.eq(true);

    playedHeroState.proxy = undefined;
    await nextTick();
    expect(wrapper.find('.con-played-hero__proxy').exists(), 'the proxy is dropped, the stage stands').to.eq(false);
    expect(wrapper.find('.con-played-hero').exists()).to.eq(true);
  });

  it('the return beat: one chassis per returning card, a back only on a face-down one; a new beat is new nodes', async () => {
    playedReturnState.active = true;
    playedReturnState.nonce = 1;
    playedReturnState.flights = [
      {id: 1, name: CardName.ASTEROID, faceDown: true},
      {id: 2, name: CardName.ANTS, faceDown: false},
    ];
    const wrapper = mountLayer();
    const rets = wrapper.findAll('.con-played-hero > .con-played-hero__ret');
    expect(rets).to.have.length(2);
    expect(rets.map((ret) => ret.find('.con-deal-proxy__flip > .con-deal-proxy__face').findComponent(ConsoleCardFaceLite).props('name')))
      .to.deep.eq([CardName.ASTEROID, CardName.ANTS]);
    expect(rets.map((ret) => ret.find('.con-deal-proxy__flip > .con-deal-proxy__back').exists())).to.deep.eq([true, false]);

    // A flight that left gives its node back; the survivor keeps its own (keyed by the beat's nonce and the flight's id).
    const survivor = rets[1].element;
    playedReturnState.flights = [playedReturnState.flights[1]];
    await nextTick();
    expect(wrapper.findAll('.con-played-hero__ret').map((ret) => ret.element)).to.deep.eq([survivor]);

    // The NEXT beat re-mounts every chassis, even under a repeated id.
    playedReturnState.nonce = 2;
    await nextTick();
    const next = wrapper.findAll('.con-played-hero__ret');
    expect(next).to.have.length(1);
    expect(next[0].element).to.not.eq(survivor);

    playedReturnState.flights = [];
    await nextTick();
    expect(wrapper.findAll('.con-played-hero__ret')).to.have.length(0);
  });

  it('exposes nothing — no parent stands a ref on it', () => {
    playedHeroState.active = true;
    playedHeroState.proxy = proxyOf();
    const Host = defineComponent({render: () => h('div', [h(ConsolePlayedHeroLayer, {ref: 'child'})])});
    const host = mount(Host, {global: GLOBAL});
    expect(Object.keys(host.vm.$refs.child as object)).to.deep.eq([]);
    expect(host.find('.con-played-hero__proxy').exists()).to.eq(true);
  });
});
