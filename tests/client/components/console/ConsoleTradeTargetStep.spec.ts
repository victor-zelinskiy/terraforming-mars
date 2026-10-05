import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {buildColonyTradeTargetModel, openTradeTargetFocus} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import ConsoleTradeTargetStep from '@/client/components/console/ConsoleTradeTargetStep.vue';
import ConsoleTradeTargetValue from '@/client/components/console/ConsoleTradeTargetValue.vue';
import ConsoleTradeReceivingCards from '@/client/components/console/ConsoleTradeReceivingCards.vue';

/*
 * THE TRADE'S TARGET STEP AND ITS RECEIVING CARDS — the pieces a colony trade
 * and a fleet-dock trade (TR27) share, extracted from the colony focus stage
 * with no change to what it draws. What this spec owns: the step opens on the
 * chosen card (else the model's first seat), A answers with the focused
 * candidate and nothing else, the «КУДА» row reads the card and its own
 * `n → n + k`, and a receiving card's counter is FROZEN at the pre-trade value
 * and ticks by exactly what has landed.
 */
const card = (name: string, resources?: number): CardModel => ({name, resources} as CardModel);
const PLAYERS = [{name: 'victor', color: 'blue', tableau: [card('Aurora Station', 0), card('Floating Habs', 1)]}];

function model() {
  const step: Extract<TradeStep, {kind: 'cardTarget'}> = {
    kind: 'cardTarget', role: 'tradeReward', resource: 'Floater', amount: 2,
    pick: {title: 'Select card', cards: [card('Aurora Station', 0), card('Floating Habs', 1)]} as unknown as SelectCardModel,
  };
  return buildColonyTradeTargetModel({
    step, ask: 'Выберите карту', players: PLAYERS, viewerColor: 'blue',
    typeOf: () => CardType.ACTIVE, resourceOf: () => 'Floater',
  });
}

const STUBS = {
  ConsolePlayedTargetStep: {props: ['model', 'layout', 'focus', 'bandHeight', 'lockedCard'], template: '<div class="ptsel-stub"></div>'},
  ConsoleCardFaceLite: {props: ['name', 'card'], template: '<div class="face-stub" :data-name="name" :data-res="card && card.resources"></div>'},
};

describe('ConsoleTradeTargetStep — the trade\'s target step, one host for both stages', () => {
  it('opens on the chosen card, else on the first seat; nothing to point at → no step', () => {
    const m = model();
    expect(openTradeTargetFocus(m, '')).to.not.eq(undefined);
    const locked = openTradeTargetFocus(m, 'Floating Habs');
    expect(m.owners[0].candidates[locked!.index].cardName).to.eq('Floating Habs');
    expect(openTradeTargetFocus(undefined, '')).to.eq(undefined);
  });

  it('A answers with the FOCUSED candidate — the stage turns it into its capture', () => {
    const wrapper = mount(ConsoleTradeTargetStep, {
      global: {...globalConfig.global, stubs: STUBS},
      props: {model: model(), lockedCard: 'Floating Habs'},
    });
    expect(wrapper.find('section.con-colfocus__targetstage').exists(), 'the colony stage\'s own room').to.eq(true);
    (wrapper.vm as unknown as {confirm: () => void}).confirm();
    expect(wrapper.emitted('pick')).to.deep.eq([['Floating Habs']]);
  });

  it('the «КУДА» value: the card and its own n → n + k; the placeholder while none is chosen', () => {
    const answered = mount(ConsoleTradeTargetValue, {
      global: globalConfig.global,
      props: {iconClass: 'x', card: 'Floating Habs', impact: '1 → 3', changeable: true},
    });
    expect(answered.text()).to.contain('Floating Habs');
    expect(answered.find('em').text()).to.eq('1 → 3');
    expect(answered.find('.con-colfocus__steprow-change').exists()).to.eq(true);
    const open = mount(ConsoleTradeTargetValue, {global: globalConfig.global, props: {iconClass: '', card: undefined}});
    expect(open.find('.con-colfocus__steprow-empty').exists()).to.eq(true);
    expect(open.find('em').exists()).to.eq(false);
  });
});

describe('ConsoleTradeReceivingCards — the receiving card, frozen until its tokens land', () => {
  it('reads «было» until a touchdown, then ticks by exactly what landed; the meta states the whole move', () => {
    const players = [{color: 'blue', tableau: [card('Floating Habs', 3)]}] as unknown as ReadonlyArray<PublicPlayerModel>;
    const targets = [{card: 'Floating Habs', role: 'tradeReward', icon: 'floater', amount: 2, before: 1}] as never;
    const wrapper = mount(ConsoleTradeReceivingCards, {
      global: {...globalConfig.global, stubs: STUBS},
      props: {targets, landings: {}, players, leaving: false},
    });
    expect(wrapper.find('.face-stub').attributes('data-res'), 'the live 3 is not shown before a token lands').to.eq('1');
    expect(wrapper.find('.con-colfocus__landmeta em').text()).to.eq('1 → 3');
    expect(wrapper.find('[data-played-key="Floating Habs"]').exists(), 'the destination ladder\'s anchor').to.eq(true);
  });

  it('one landed token = one tick; the departure is a pose of the same section', async () => {
    const players = [{color: 'blue', tableau: [card('Floating Habs', 3)]}] as unknown as ReadonlyArray<PublicPlayerModel>;
    const targets = [{card: 'Floating Habs', role: 'tradeReward', icon: 'floater', amount: 2, before: 1}] as never;
    const wrapper = mount(ConsoleTradeReceivingCards, {
      global: {...globalConfig.global, stubs: STUBS},
      props: {targets, landings: {'Floating Habs': 1}, players, leaving: false},
    });
    expect(wrapper.find('.face-stub').attributes('data-res')).to.eq('2');
    expect(wrapper.find('.con-colfocus__landflash').exists()).to.eq(true);
    await wrapper.setProps({leaving: true});
    expect(wrapper.find('section.con-colfocus__cardland').classes()).to.include('con-colfocus__cardland--leaving');
  });
});
