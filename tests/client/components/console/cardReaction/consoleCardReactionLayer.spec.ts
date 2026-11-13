/*
 * ConsoleCardReactionLayer — the app-level stage of «a card's printed effect fired». A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md) with no props, no emits and nothing exposed: it paints the reactor faces of
 * the module's stage (`cardReactionState`), carries the scene's state on its root for the probes, and registers itself
 * as THE stage while it is mounted — the face elements the director rises are its own nodes. The view-models of the
 * law and party faces are built once per page (the sibling module `consoleCardReactionLayerState.ts`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleCardReactionLayer from '@/client/components/console/cardReaction/ConsoleCardReactionLayer.vue';
import {lawVms, partyVms} from '@/client/components/console/cardReaction/consoleCardReactionLayerState';
import {
  cardReactionStageMounted, cardReactionState, reactorEl, seatReactor, unseatAllReactors,
} from '@/client/console/cardReaction/cardReactionStage';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardModel} from '@/common/models/CardModel';
import {PartyName} from '@/common/turmoil/PartyName';

const SEAT = {left: 100, top: 100, width: 200, height: 280};
/** A law of the parliament manifest that is always there (the dev law the face's own spec reads) — and one it does not know. */
const LAW: string = 'RDX_DEV_PASSIVE';
const NO_SUCH_LAW: string = 'RDX_NO_SUCH_LAW';

// The faces are the premium renderer; this spec is about the LAYER — which face stands for a reactor and what it is handed.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String, card: Object},
  render() {
    return h('i', {
      'class': 'face-stub',
      'data-name': this.name,
      'data-resources': this.card === undefined ? 'none' : String((this.card as CardModel).resources),
    });
  },
});
const PremiumStub = defineComponent({
  name: 'PremiumCard',
  props: {vmOverride: {type: Object, default: undefined}, inert: Boolean},
  render() {
    return h('i', {'class': 'premium-stub', 'data-inert': String(this.inert)});
  },
});
const PlanetStub = defineComponent({
  name: 'ConsolePlanetDisc',
  props: {colony: String},
  render() {
    return h('i', {'class': 'planet-stub', 'data-colony': this.colony});
  },
});

const STUBS = {ConsoleCardFaceLite: FaceStub, PremiumCard: PremiumStub, ConsolePlanetDisc: PlanetStub};

function mountLayer(attachTo?: HTMLElement) {
  return mount(ConsoleCardReactionLayer, {global: {...globalConfig.global, stubs: STUBS}, attachTo});
}

describe('ConsoleCardReactionLayer — the stage of a card\'s reaction', () => {
  afterEach(() => {
    // The stage is module state, shared by the whole bundle.
    unseatAllReactors();
    cardReactionState.phase = 'idle';
    cardReactionState.chain = undefined;
    cardReactionState.hurried = false;
    cardReactionState.degraded = undefined;
  });

  it('renders nothing while the stage is idle and empty; a scene on stage carries its state on the root for the probes', async () => {
    const wrapper = mountLayer();
    expect(wrapper.find('.con-reaction').exists(), 'idle, no face — no stage').to.eq(false);

    cardReactionState.phase = 'paying';
    cardReactionState.chain = {cards: [CardName.PETS, CardName.DECOMPOSERS], landed: 1, summarized: [CardName.DECOMPOSERS], seats: 2, pace: 1};
    cardReactionState.hurried = true;
    cardReactionState.degraded = 'no-seat';
    await nextTick();
    const root = wrapper.find('.con-reaction');
    expect(root.attributes('aria-hidden')).to.eq('true');
    expect(root.attributes('data-reaction-phase')).to.eq('paying');
    expect(root.attributes('data-reaction-groups')).to.eq('2');
    expect(root.attributes('data-reaction-landed')).to.eq('1');
    expect(root.attributes('data-reaction-seats')).to.eq('2');
    expect(root.attributes('data-reaction-hurried')).to.eq('1');
    expect(root.attributes('data-reaction-summarized')).to.eq(CardName.DECOMPOSERS);
    expect(root.attributes('data-reaction-degraded')).to.eq('no-seat');

    cardReactionState.chain = {cards: [CardName.PETS], landed: 0, summarized: [], seats: 1, pace: 1};
    cardReactionState.hurried = false;
    cardReactionState.degraded = undefined;
    await nextTick();
    const calm = wrapper.find('.con-reaction');
    expect(calm.attributes('data-reaction-hurried'), 'a state that has nothing to say renders no attribute').to.eq(undefined);
    expect(calm.attributes('data-reaction-summarized')).to.eq(undefined);
    expect(calm.attributes('data-reaction-degraded')).to.eq(undefined);
  });

  it('a card\'s face: the lite face with its LIVE model; a warm face is marked and unnamed; a rival\'s wears its seat; a foreign cause stands on its plate', async () => {
    const wrapper = mountLayer();
    cardReactionState.faces = [
      {key: 'live:1', name: CardName.PETS, seat: SEAT, card: {name: CardName.PETS, resources: 4} as CardModel},
      {key: 'warm:2', name: CardName.DECOMPOSERS, seat: SEAT, warm: true, cause: {kind: 'colony', colony: ColonyName.LUNA, builder: {color: 'red', name: 'Bruno'}}},
      {
        key: 'live:3', name: CardName.THARSIS_REPUBLIC, kind: 'corporation', seat: SEAT,
        caption: {color: 'green', name: 'MarsBot'},
        cause: {kind: 'colony', colony: ColonyName.LUNA, builder: {color: 'red', name: 'Bruno'}},
      },
    ];
    await nextTick();

    const faces = wrapper.findAll('.con-reaction > .con-reaction__face');
    expect(faces.map((f) => f.attributes('data-reaction-key'))).to.deep.eq(['live:1', 'warm:2', 'live:3']);
    expect(faces.map((f) => f.attributes('data-reaction-kind')), 'a face with no kind is a card\'s').to.deep.eq(['card', 'card', 'corporation']);
    expect(faces.map((f) => f.attributes('data-reaction-card'))).to.deep.eq([CardName.PETS, undefined, CardName.THARSIS_REPUBLIC]);
    expect(faces.map((f) => f.attributes('data-reaction-warm'))).to.deep.eq([undefined, CardName.DECOMPOSERS, undefined]);
    expect(faces.map((f) => f.classes('con-reaction__face--warm'))).to.deep.eq([false, true, false]);
    expect(faces.map((f) => f.find('.face-stub').attributes('data-name'))).to.deep.eq([CardName.PETS, CardName.DECOMPOSERS, CardName.THARSIS_REPUBLIC]);
    expect(faces.map((f) => f.find('.face-stub').attributes('data-resources')), 'no model → the pristine print').to.deep.eq(['4', 'none', 'none']);
    expect(wrapper.find('.premium-stub').exists(), 'a card never stands on the law\'s face').to.eq(false);

    expect(faces.map((f) => f.find('.con-reaction__caption').exists())).to.deep.eq([false, false, true]);
    const caption = faces[2].find('.con-reaction__caption');
    expect(caption.attributes('data-reaction-caption')).to.eq('green');
    expect(caption.find('.con-reaction__caption-dot').classes()).to.include('player_bg_color_green');
    expect(caption.find('.con-reaction__caption-name').text()).to.eq('MarsBot');

    expect(faces.map((f) => f.find('.con-reaction__cause').exists()), 'a warm face is not painted — neither is its cause').to.deep.eq([false, false, true]);
    const cause = faces[2].find('.con-reaction__cause');
    expect(cause.attributes('data-reaction-cause')).to.eq('colony');
    expect(cause.attributes('data-cause-colony')).to.eq(ColonyName.LUNA);
    expect(cause.attributes('data-cause-builder')).to.eq('red');
    expect(cause.find('.planet-stub').attributes('data-colony')).to.eq(ColonyName.LUNA);
    expect(cause.find('.con-reaction__cause-name').text()).to.eq(ColonyName.LUNA);
    expect(cause.find('.con-reaction__cause-seat').text()).to.eq('Bruno');
  });

  it('a law\'s and a party\'s face are the manifest\'s own premium faces — ONE view-model per law / party, kept across renders and across layers', async () => {
    expect(resolutionPremiumVmById(LAW), 'the manifest knows the law').to.not.eq(undefined);
    const wrapper = mountLayer();
    cardReactionState.faces = [
      {key: 'law:1', name: LAW as CardName, kind: 'resolution', seat: SEAT},
      {key: 'party:2', name: PartyName.GREENS as unknown as CardName, kind: 'party', seat: SEAT},
      {key: 'law:3', name: NO_SUCH_LAW as CardName, kind: 'resolution', seat: SEAT},
    ];
    await nextTick();

    const faces = wrapper.findAll('.con-reaction__face');
    expect(faces.map((f) => f.attributes('data-reaction-kind'))).to.deep.eq(['resolution', 'party', 'resolution']);
    expect(faces.map((f) => f.find('.premium-stub').exists()), 'a law the manifest does not know falls back to the lite face').to.deep.eq([true, true, false]);
    expect(faces[2].find('.face-stub').attributes('data-name')).to.eq(NO_SUCH_LAW);
    const premium = wrapper.findAllComponents(PremiumStub);
    expect(premium.map((p) => p.props('inert'))).to.deep.eq([true, true]);
    const lawVm = premium[0].props('vmOverride');
    const partyVm = premium[1].props('vmOverride');
    expect(lawVm).to.deep.eq(resolutionPremiumVmById(LAW));
    expect(lawVm, 'built once, kept in the page\'s cache').to.eq(lawVms.get(LAW));
    expect(partyVm).to.eq(partyVms.get(PartyName.GREENS));
    expect(partyVm).to.not.eq(undefined);

    // A re-render hands the SAME objects (a fresh one would re-mount the face)…
    cardReactionState.hurried = true;
    await nextTick();
    expect(wrapper.findAllComponents(PremiumStub).map((p) => p.props('vmOverride'))).to.deep.eq([lawVm, partyVm]);
    expect(wrapper.findAllComponents(PremiumStub)[0].props('vmOverride')).to.eq(lawVm);
    // …and so does a second layer: the cache belongs to the page, not to an instance.
    wrapper.unmount();
    const again = mountLayer();
    cardReactionState.faces = [{key: 'law:4', name: LAW as CardName, kind: 'resolution', seat: SEAT}];
    await nextTick();
    expect(again.findComponent(PremiumStub).props('vmOverride')).to.eq(lawVm);
  });

  it('is THE stage while it is mounted: a seated reactor\'s element is the face\'s own node — and the stage goes with the layer', async () => {
    expect(cardReactionStageMounted(), 'no layer — no stage').to.eq(false);
    expect(await seatReactor({key: 'live:0', name: CardName.PETS, seat: SEAT}), 'nothing can be seated without it').to.eq(undefined);

    // In the document: the stage answers only with a face that is CONNECTED (a node of a torn-down tree is no face).
    const wrapper = mountLayer(document.body);
    expect(cardReactionStageMounted()).to.eq(true);
    const seated = await seatReactor({key: 'live:1', name: CardName.PETS, seat: SEAT});
    const face = wrapper.find('[data-reaction-key="live:1"]');
    expect(face.exists()).to.eq(true);
    expect(seated?.key).to.eq('live:1');
    expect(seated?.el, 'the director rises the node the layer painted').to.eq(face.element);
    expect(reactorEl('live:1')).to.eq(face.element);
    expect(reactorEl('live:9'), 'a key nobody seated').to.eq(undefined);

    wrapper.unmount();
    expect(cardReactionStageMounted()).to.eq(false);
    expect(reactorEl('live:1')).to.eq(undefined);
  });
});
