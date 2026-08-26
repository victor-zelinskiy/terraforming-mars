import {mount} from '@vue/test-utils';
import {toRaw} from 'vue';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleHandRevealLayer from '@/client/components/console/ConsoleHandRevealLayer.vue';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {ensureHandBodyFaces, handBodiesState, resetHandBodies} from '@/client/console/handDock/handBodies';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

/*
 * THE REGRESSION THIS FILE EXISTS FOR — «карты мигают при открытии руки».
 *
 * The single-owner bodies layer flies the SAME element from the pack to the
 * album slot and hands it off to the real grid card underneath. The flying
 * face must therefore be the same PICTURE the slot will render:
 *
 *   - the LIVE model (discount chip, stored-resource capsule, disabled wash
 *     — and, through the cost chip's title safe-area, the name's size and
 *     line breaks);
 *   - the grid's own `lightweight` quality tier;
 *   - the landed dim/blocker state carried DURING the flight;
 *   - and no face at all until a card first needs one (a packet-bound body
 *     stays a cheap back — the face mounts lazily and then stays).
 *
 * The face is STUBBED (real prop shape): under test is the wiring.
 */

const FACE_STUB = {
  name: 'ConsoleCardFaceLite',
  props: {
    name: {type: String, required: true},
    card: {type: Object, required: false, default: undefined},
    lightweight: {type: Boolean, required: false, default: false},
  },
  template: '<div class="facelite" />',
};

function model(name: CardName): CardModel {
  return {name, calculatedCost: 5, resources: 3} as CardModel;
}

function factory(cards: Array<CardModel>) {
  return mount(ConsoleHandRevealLayer, {
    ...globalConfig,
    props: {cards},
    global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FACE_STUB}},
  });
}

describe('ConsoleHandRevealLayer — the flying face IS the landing face', () => {
  afterEach(() => {
    resetHandBodies();
    handBodiesState.faces = [];
    handRevealState.flightVisuals = {};
  });

  it('carries the LIVE model, so the body shows what the slot will show', async () => {
    const card = model(CardName.ANTS);
    ensureHandBodyFaces([CardName.ANTS]);
    handRevealState.flightVisuals = {[CardName.ANTS]: {card}};
    const w = factory([card]);
    await w.vm.$nextTick();

    const face = w.findComponent(FACE_STUB);
    expect(face.exists()).to.eq(true);
    // The SAME object the hand grid renders from — not a re-derived copy.
    expect(toRaw(face.props('card'))).to.eq(card);
    w.unmount();
  });

  it('renders the GRID quality tier — the hand shelf draws <Card … lightweight>', async () => {
    ensureHandBodyFaces([CardName.ANTS]);
    const w = factory([model(CardName.ANTS)]);
    await w.vm.$nextTick();

    expect(w.findComponent(FACE_STUB).props('lightweight')).to.eq(true);
    w.unmount();
  });

  it('a dimmed / blocked card still carries its model — the state is EXTRA, never instead', async () => {
    const card = model(CardName.ANTS);
    ensureHandBodyFaces([CardName.ANTS]);
    handRevealState.flightVisuals = {[CardName.ANTS]: {card, dim: 'soft', chip: 'Requirement'}};
    const w = factory([card]);
    await w.vm.$nextTick();

    expect(toRaw(w.findComponent(FACE_STUB).props('card'))).to.eq(card);
    expect(w.find('.con-deal-proxy__face--dim').exists()).to.eq(true);
    w.unmount();
  });

  it('a body mounts no face until a card first needs one (lazy, then cached)', async () => {
    const w = factory([model(CardName.ANTS)]);
    await w.vm.$nextTick();
    expect(w.findComponent(FACE_STUB).exists()).to.eq(false);
    expect(w.find('.con-deal-proxy__back').exists()).to.eq(true);
    // The back always carries the berth anchor every intake targets.
    expect(w.find('[data-hand-dock-card]').exists()).to.eq(true);

    ensureHandBodyFaces([CardName.ANTS]);
    await w.vm.$nextTick();
    expect(w.findComponent(FACE_STUB).exists()).to.eq(true);
    w.unmount();
  });
});
