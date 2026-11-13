/*
 * AdditionalResourceDetailOverlay — the «ДОП. РЕСУРСЫ» detail modal: every card of one seat that holds one card
 * resource, each with its count and its VP reading. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). It has no props but the view: WHAT it shows is module state
 * (`additionalResourcesState` — the rail writes it, the overlay reads it), so the spec opens and closes it there. What
 * it renders for that state and the view, how it closes (✕, Escape — a window listener it owns for its lifetime) and
 * the fullscreen viewer it reaches through its own template ref. The card face, the viewer and the delta chips have
 * their own surfaces — stubbed by the names the template uses. The unit runner renders the English keys.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import AdditionalResourceDetailOverlay from '@/client/components/additionalResources/AdditionalResourceDetailOverlay.vue';
import {additionalResourcesState, closeAdditionalResourceDetail, openAdditionalResourceDetail} from '@/client/components/additionalResources/additionalResourcesState';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: ['card'],
  render: () => h('i', {class: 'card-stub'}),
});
let shown = 0;
const ZoomStub = defineComponent({
  name: 'CardZoomModal',
  props: ['card', 'cards'],
  emits: ['navigate', 'close'],
  methods: {
    show(): void {
      shown++;
    },
  },
  render: () => h('i', {class: 'zoom-stub'}),
});
const MetricStub = defineComponent({
  name: 'AnimatedMetricValue',
  props: ['value', 'metricKey', 'scopeKey', 'epoch', 'variant'],
  render: () => h('i', {class: 'metric-stub'}),
});

// Tardigrades scores 1 VP per 4 microbes (a THRESHOLD scorer); GHG Producing Bacteria holds microbes and scores nothing.
const TARDIGRADES: CardModel = {name: CardName.TARDIGRADES, resources: 5};
const BACTERIA: CardModel = {name: CardName.GHG_PRODUCING_BACTERIA, resources: 0};
const EATERS: CardModel = {name: CardName.REGOLITH_EATERS, resources: 3};

/** The viewer (blue, «Alice») holds two microbe cards; a rival (red, «Bob») holds one. */
function table(): PlayerViewModel {
  const me = fakePublicPlayerModel({color: 'blue', name: 'Alice', tableau: [TARDIGRADES, BACTERIA]});
  const rival = fakePublicPlayerModel({color: 'red', name: 'Bob', tableau: [EATERS]});
  return fakePlayerViewModel({thisPlayer: me, players: [me, rival], runId: 'run-7'});
}

function overlay() {
  return mount(AdditionalResourceDetailOverlay, {
    ...globalConfig,
    props: {playerView: table()},
    global: {
      ...globalConfig.global,
      stubs: {Card: CardStub, CardZoomModal: ZoomStub, AnimatedMetricValue: MetricStub, teleport: true},
    },
  });
}

const OVERLAY = '[data-test="additional-resource-detail-overlay"]';
const CARD = '[data-test="additional-resource-detail-card"]';

describe('AdditionalResourceDetailOverlay — the cards of one seat that hold one resource', () => {
  beforeEach(() => {
    shown = 0;
  });
  afterEach(() => {
    // Module state is BUNDLE-SHARED: leave the detail closed for the next spec.
    closeAdditionalResourceDetail();
  });

  it('renders nothing until the rail names a resource and a seat — then that seat\'s holders, counted', async () => {
    const w = overlay();
    expect(w.find(OVERLAY).exists()).to.be.false;

    openAdditionalResourceDetail(CardResource.MICROBE, 'blue');
    await nextTick();
    expect(w.find(OVERLAY).exists()).to.be.true;
    expect(w.find('.additional-resource-detail').classes(), 'two holders — the double layout')
      .to.deep.eq(['additional-resource-detail', 'additional-resource-detail--double']);
    expect(w.find('.additional-resource-detail__name').text()).to.eq('Microbe');
    expect(w.find('.additional-resource-detail__icon').classes()).to.contain('card-resource-microbe');
    expect(w.find('.additional-resource-detail__total-value').text()).to.eq('5');
    expect(w.find('.additional-resource-detail__player').classes()).to.contain('player_color_blue');
    expect(w.find('.additional-resource-detail__player-name').text(), 'the viewer\'s own seat').to.eq('You');
    expect(w.findAll('.additional-resource-detail__stat-value').map((stat) => stat.text()), 'cards · with stock · VP')
      .to.deep.eq(['2', '1', '1']);

    expect(w.findAllComponents(CardStub).map((face) => face.props('card'))).to.deep.eq([TARDIGRADES, BACTERIA]);
    const cards = w.findAll(CARD);
    expect(cards.map((card) => card.find('.additional-resource-detail__count-num').text())).to.deep.eq(['5', '0']);
    expect(cards[0].classes()).to.not.contain('additional-resource-detail__card--zero');
    expect(cards[1].classes()).to.contain('additional-resource-detail__card--zero');

    // The delta chips are addressed by the resource, the card and the seat's own scope.
    expect(w.findAllComponents(MetricStub).map((metric) => metric.props())).to.deep.eq([
      {value: 5, metricKey: 'card-resource.Microbe.detail-total', scopeKey: 'blue-aux-detail', epoch: 'run-7', variant: 'score'},
      {value: 5, metricKey: `card-resource.Microbe.card.${CardName.TARDIGRADES}`, scopeKey: 'blue-aux-detail', epoch: 'run-7', variant: 'misc'},
      {value: 0, metricKey: `card-resource.Microbe.card.${CardName.GHG_PRODUCING_BACTERIA}`, scopeKey: 'blue-aux-detail', epoch: 'run-7', variant: 'misc'},
    ]);
  });

  it('a scorer reads its rule, what it has accrued and the way to the next point; another seat is named', async () => {
    const w = overlay();
    openAdditionalResourceDetail(CardResource.MICROBE, 'blue');
    await nextTick();
    const [scorer, plain] = w.findAll(CARD);
    expect(scorer.find('.additional-resource-detail__score-amt').text(), '4 microbes buy a point').to.eq('4');
    expect(scorer.findAll('.additional-resource-detail__score-vp').map((vp) => vp.text()), 'the rate\'s point · accrued').to.deep.eq(['1', '1']);
    expect(scorer.find('.additional-resource-detail__progress-text').text()).to.eq('1/4');
    expect(scorer.find('.additional-resource-detail__progress-fill').attributes('style')).to.contain('width: 25%');
    expect(plain.find('.additional-resource-detail__score').exists(), 'a holder that scores nothing has no VP line').to.be.false;

    // The rail re-points the detail at the rival: one holder, no VP anywhere, the seat by its name.
    openAdditionalResourceDetail(CardResource.MICROBE, 'red');
    await nextTick();
    expect(w.find('.additional-resource-detail').classes()).to.contain('additional-resource-detail--single');
    expect(w.find('.additional-resource-detail__player-name').text()).to.eq('Bob');
    expect(w.find('.additional-resource-detail__total-value').text()).to.eq('3');
    expect(w.findAll('.additional-resource-detail__stat-value').map((stat) => stat.text()), 'no VP stat').to.deep.eq(['1', '1']);
    expect(w.findAllComponents(CardStub).map((face) => face.props('card'))).to.deep.eq([EATERS]);

    // A seat with no holder of the resource has no detail to show.
    openAdditionalResourceDetail(CardResource.FLOATER, 'red');
    await nextTick();
    expect(w.find(OVERLAY).exists()).to.be.false;
  });

  it('closes on ✕ and on Escape — a listener it owns only while it is mounted', async () => {
    const w = overlay();
    openAdditionalResourceDetail(CardResource.MICROBE, 'blue');
    await nextTick();
    await w.find('.additional-resource-detail__close').trigger('click');
    expect(additionalResourcesState.detailResource).to.be.undefined;
    expect(w.find(OVERLAY).exists()).to.be.false;

    openAdditionalResourceDetail(CardResource.MICROBE, 'blue');
    await nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    expect(additionalResourcesState.detailResource, 'another key closes nothing').to.eq(CardResource.MICROBE);
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    await nextTick();
    expect(additionalResourcesState.detailResource).to.be.undefined;
    expect(w.find(OVERLAY).exists()).to.be.false;

    w.unmount();
    openAdditionalResourceDetail(CardResource.MICROBE, 'blue');
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    expect(additionalResourcesState.detailResource, 'the listener left with the component').to.eq(CardResource.MICROBE);
  });

  it('a card opens FULLSCREEN: the viewer mounts on it with the group to page through, is shown through the overlay\'s own ref, follows `navigate` and leaves on `close`', async () => {
    const w = overlay();
    openAdditionalResourceDetail(CardResource.MICROBE, 'blue');
    await nextTick();
    expect(w.findComponent(ZoomStub).exists()).to.be.false;

    await w.findAll(CARD)[0].trigger('click');
    await nextTick();
    const viewer = w.findComponent(ZoomStub);
    expect(viewer.exists()).to.be.true;
    expect(viewer.props('card')).to.deep.eq(TARDIGRADES);
    expect(viewer.props('cards')).to.deep.eq([TARDIGRADES, BACTERIA]);
    expect(shown, 'the mounted viewer was told to show').to.eq(1);

    viewer.vm.$emit('navigate', BACTERIA);
    await nextTick();
    expect(w.findComponent(ZoomStub).props('card')).to.deep.eq(BACTERIA);

    viewer.vm.$emit('close');
    await nextTick();
    expect(w.findComponent(ZoomStub).exists()).to.be.false;
    expect(w.find(OVERLAY).exists(), 'closing the viewer leaves the detail open').to.be.true;
  });
});
