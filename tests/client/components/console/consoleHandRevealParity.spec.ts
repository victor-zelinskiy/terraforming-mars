import {mount} from '@vue/test-utils';
import {toRaw} from 'vue';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleHandRevealLayer from '@/client/components/console/ConsoleHandRevealLayer.vue';
import {clearRevealFlights, handRevealState, nextRevealId} from '@/client/console/handDock/handRevealState';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

/*
 * THE REGRESSION THIS FILE EXISTS FOR — «карты мигают при открытии руки».
 *
 * The dock → shelf open flies one proxy per card and hands each one off to the
 * real grid slot underneath. The proxy face was built from the card NAME alone,
 * so it was never the same picture as the card it landed on:
 *
 *   - no live model  → no discount chip, no stored-resource capsule, no
 *     disabled wash — AND, because the cost chip widens the title's left
 *     safe-area (`--pcard-title-safe-l`), a different title SIZE and different
 *     line breaks;
 *   - no `lightweight` → tier `normal` (engraved gold-gradient title) landing
 *     on the grid's tier `thumb` (solid warm ink).
 *
 * Every one of those is a change of APPEARANCE, not of cost, so the handoff
 * read as a swap: a whole shelf of cards visibly re-drew at the end of the
 * open. The layer's own contract is the only place this can be asserted
 * cheaply — the director moves the proxies, it does not build their faces.
 *
 * The face is STUBBED on purpose (with its real prop shape): what is under
 * test is the wiring, and mounting PremiumCard here would only add its render
 * cost to a question about props.
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

function factory() {
  return mount(ConsoleHandRevealLayer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FACE_STUB}},
  });
}

function model(name: CardName): CardModel {
  return {name, calculatedCost: 5, resources: 3} as CardModel;
}

describe('ConsoleHandRevealLayer — the flying face IS the landing face', () => {
  afterEach(() => clearRevealFlights());

  it('carries the LIVE model, so the proxy shows what the slot will show', async () => {
    const card = model(CardName.ANTS);
    handRevealState.flights = [{id: nextRevealId(), name: CardName.ANTS, face: true, visual: {card}}];
    const w = factory();
    await w.vm.$nextTick();

    const face = w.findComponent(FACE_STUB);
    expect(face.exists()).to.eq(true);
    // The SAME object the hand grid renders from — not a re-derived copy, and
    // never the printed face (which prints cost without the discount and a
    // permanent 0 in the resource capsule). `toRaw`: the flight list is
    // reactive, so what arrives is the model's proxy, not the model.
    expect(toRaw(face.props('card'))).to.eq(card);
    w.unmount();
  });

  it('renders the GRID quality tier — the hand shelf draws <Card … lightweight>', async () => {
    handRevealState.flights = [{id: nextRevealId(), name: CardName.ANTS, face: true, visual: {card: model(CardName.ANTS)}}];
    const w = factory();
    await w.vm.$nextTick();

    // `thumb` is not a quieter version of `normal`: the title's fill, weight
    // and the plate's textures all differ, so a mismatch here IS the flicker.
    expect(w.findComponent(FACE_STUB).props('lightweight')).to.eq(true);
    w.unmount();
  });

  it('a dimmed / blocked card still carries its model — the state is EXTRA, never instead', async () => {
    const card = model(CardName.ANTS);
    handRevealState.flights = [{
      id: nextRevealId(),
      name: CardName.ANTS,
      face: true,
      visual: {card, dim: 'soft', chip: 'Requirement'},
    }];
    const w = factory();
    await w.vm.$nextTick();

    expect(toRaw(w.findComponent(FACE_STUB).props('card'))).to.eq(card);
    expect(w.find('.con-deal-proxy__face--dim').exists()).to.eq(true);
    w.unmount();
  });

  it('a back-only tail proxy mounts no face at all (the off-window sampling stays free)', async () => {
    handRevealState.flights = [{id: nextRevealId(), name: CardName.ANTS, face: false}];
    const w = factory();
    await w.vm.$nextTick();

    expect(w.findComponent(FACE_STUB).exists()).to.eq(false);
    expect(w.find('.con-deal-proxy__back').exists()).to.eq(true);
    w.unmount();
  });
});
