/*
 * ConsoleCardDealLayer — the stage the deal cinematic plays on. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): its three hosts (the start scene, the task host, the draft workspace) stand it under
 * `ref="dealLayer"` and read exactly two members off that ref — `proxyEls()` and `deckEl()`, the element handles they
 * hand to the deal sequence's `launch()`. Mounted here the way they mount it: under an Options host with a string ref.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleCardDealLayer from '@/client/components/console/cardDeal/ConsoleCardDealLayer.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

/** What a host reads through its ref — the component's whole contract with its parents. */
type DealLayerReach = {proxyEls(): Array<HTMLElement>, deckEl(): HTMLElement | null};

// The lite face is the premium renderer; this spec is about the LAYER — what each face is HANDED.
// (A render function, not a template string: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String, card: Object, lightweight: Boolean},
  render() {
    return h('i', {
      'class': 'face-stub',
      'data-name': this.name,
      'data-resources': this.card === undefined ? 'none' : String((this.card as CardModel).resources),
      'data-lightweight': String(this.lightweight),
    });
  },
});

function mountUnderHost(initial: {cards: Array<CardName>, models?: Array<CardModel | undefined>, nonce: number}) {
  const props = reactive<{cards: Array<CardName>, models?: Array<CardModel | undefined>, nonce: number}>({...initial});
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleCardDealLayer, {ref: 'dealLayer', cards: props.cards, models: props.models, nonce: props.nonce})]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceStub}}});
  return {
    wrapper,
    props,
    /** Exactly the parents' read: `(this.$refs.dealLayer ?? undefined) as … | undefined`. */
    reach: () => (wrapper.vm.$refs.dealLayer ?? undefined) as DealLayerReach | undefined,
    proxies: () => wrapper.findAll('.con-deal-proxy').map((w) => w.element as HTMLElement),
  };
}

describe('ConsoleCardDealLayer — the stage of the deal', () => {
  it('renders the inert stage: the dealer\'s three backs and one proxy per card, in card order', () => {
    const {wrapper} = mountUnderHost({cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET], nonce: 1});
    const layer = wrapper.find('.con-deal-layer');
    expect(layer.attributes('aria-hidden')).to.eq('true');
    expect(layer.findAll('.con-deal-deck > .con-card-back.con-deal-deck__c').map((w) => w.classes().find((c) => c.startsWith('con-deal-deck__c--'))))
      .to.deep.eq(['con-deal-deck__c--3', 'con-deal-deck__c--2', 'con-deal-deck__c--1']);
    const proxies = layer.findAll('.con-deal-proxy');
    expect(proxies.map((p) => p.find('.con-deal-proxy__flip > .con-deal-proxy__face > .face-stub').attributes('data-name')))
      .to.deep.eq([CardName.ANTS, CardName.BIRDS, CardName.COMET]);
    for (const proxy of proxies) {
      expect(proxy.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back.con-card-back--flyer').exists()).to.eq(true);
    }
  });

  it('hands each face its LIVE model by index and the lightweight tier — the flying face is the landed face', () => {
    const live = {name: CardName.BIRDS, resources: 3} as CardModel;
    const {wrapper} = mountUnderHost({cards: [CardName.ANTS, CardName.BIRDS], models: [undefined, live], nonce: 1});
    const faces = wrapper.findAll('.face-stub');
    expect(faces.map((f) => f.attributes('data-resources')), 'no model → the name-only face').to.deep.eq(['none', '3']);
    expect(faces.map((f) => f.attributes('data-lightweight'))).to.deep.eq(['true', 'true']);
  });

  it('a PARENT\'s ref sees exactly `proxyEls` and `deckEl` — and they answer with the ELEMENTS themselves', () => {
    const {wrapper, reach, proxies} = mountUnderHost({cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET], nonce: 1});
    const layer = reach();
    expect(layer, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(layer!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['deckEl', 'proxyEls']);
    for (const inner of ['setProxyRef', 'proxyRefs', 'deck', 'props']) {
      expect((layer as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    const deck = layer!.deckEl();
    expect(deck, 'the dealer\'s stack — the node, not a ref around it').to.eq(wrapper.find('.con-deal-deck').element);

    const els = layer!.proxyEls();
    expect(Array.isArray(els)).to.eq(true);
    expect(els.length).to.eq(3);
    els.forEach((el, i) => expect(el, `proxy ${i} is the ${i}-th card's own node`).to.eq(proxies()[i]));
    expect(els.map((el) => el.querySelector('.face-stub')?.getAttribute('data-name'))).to.deep.eq([CardName.ANTS, CardName.BIRDS, CardName.COMET]);
  });

  it('a NEW deal (the nonce moves) re-seats the handles on the new cards — never a node of the last deal', async () => {
    const {props, reach, proxies} = mountUnderHost({cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET], nonce: 1});
    const first = reach()!.proxyEls();

    props.cards = [CardName.PETS, CardName.ANTS];
    props.nonce = 2;
    await nextTick();

    const second = reach()!.proxyEls();
    expect(second.length).to.eq(2);
    second.forEach((el, i) => expect(el).to.eq(proxies()[i]));
    expect(second.map((el) => el.querySelector('.face-stub')?.getAttribute('data-name'))).to.deep.eq([CardName.PETS, CardName.ANTS]);
    expect(second.some((el) => first.includes(el)), 'the proxy set is keyed per deal').to.eq(false);
  });
});
