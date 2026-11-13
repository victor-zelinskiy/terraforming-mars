/*
 * EndgameCardsTab — «card impact»: the table's top scoring cards and each player's scoring cards as pills.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it reads one prop (`model`; `view` and
 * `viewerColor` are declared only so the overlay's shared props do not fall through), emits nothing and exposes
 * nothing — so the spec is what it renders for the model. Mounted WITHOUT the i18n plugin on purpose: the component
 * imports `$t` and `v-i18n` itself, and a Vue warning (an unresolved directive) fails the test.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardVictoryPointsKind} from '@/common/game/VictoryPointsBreakdown';
import EndgameCardsTab from '@/client/components/endgame/tabs/EndgameCardsTab.vue';
import {EndgameMode, EndgameModel, EndgamePlayerScore, EndgameTopCard} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

// The journal's card chip is its own subject (hover preview, fullscreen); this spec reads what the tab HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ChipStub = defineComponent({
  name: 'JournalCardChip',
  props: ['name'],
  render: () => h('i', {class: 'chip-stub'}),
});

/** A row that is no card of the manifest — a pseudo-row of the breakdown. */
const SYSTEM_ROW = 'No Such Card Row';

function card(cardName: string, victoryPoint: number, kind: CardVictoryPointsKind = 'fixed'): EndgameTopCard {
  return {cardName, victoryPoint, kind};
}

/** One score row — only what the tab reads. */
function score(color: Color, name: string, cardVp: number, topCards: Array<EndgameTopCard>, penaltyCards: Array<EndgameTopCard> = [], isWinner = false): EndgamePlayerScore {
  return {color, name, isWinner, topCards, penaltyCards, breakdown: {victoryPoints: cardVp}} as unknown as EndgamePlayerScore;
}

function model(players: Array<EndgamePlayerScore>, mode: EndgameMode = 'standings'): EndgameModel {
  return {mode, players} as EndgameModel;
}

function tab(props: Record<string, unknown>) {
  return mount(EndgameCardsTab, {props, global: {config: globalConfig.global.config, stubs: {JournalCardChip: ChipStub}}});
}

function playerColour(el: Element): string {
  return (el as HTMLElement).style.getPropertyValue('--eg-pc');
}

describe('EndgameCardsTab — card impact', () => {
  const victor = () => score('red', 'Victor', 9, [card(CardName.BIRDS, 6, 'resource'), card(SYSTEM_ROW, 3, 'conditional')], [], true);
  const nastya = () => score('blue', 'Nastya', 2, [card(CardName.PETS, 4, 'resource')], [card(CardName.ANTS, -2, 'penalty')]);
  const oleg = () => score('green', 'Oleg', 0, []);

  it('the podium strip: the table\'s cards by value — the owner\'s colour, a real card as its chip, a pseudo-row as a label', () => {
    const w = tab({model: model([victor(), nastya(), oleg()])});
    expect(w.classes()).to.deep.eq(['eg-tab', 'eg-cards']);
    expect(w.find('.eg-cards__top .eg-section-title').text()).to.eq($t('Top scoring cards'));
    const items = w.findAll('.eg-cards__top-list > .eg-topcard');
    expect(items.map((item) => item.find('.eg-topcard__rank').text())).to.deep.eq(['1', '2', '3']);
    expect(items.map((item) => item.find('.eg-topcard__vp').text())).to.deep.eq(['+6', '+4', '+3']);
    expect(items.every((item) => item.classes().includes('eg-topcard--podium')), 'the first three stand on the podium').to.eq(true);
    expect(items.map((item) => playerColour(item.element))).to.deep.eq([endgamePlayerHex('red'), endgamePlayerHex('blue'), endgamePlayerHex('red')]);
    expect(items.map((item) => item.find('.eg-topcard__owner-dot').classes()[1])).to.deep.eq(['player_bg_color_red', 'player_bg_color_blue', 'player_bg_color_red']);
    expect(items.map((item) => item.find('.eg-topcard__owner-dot').attributes('data-hint'))).to.deep.eq(['Victor', 'Nastya', 'Victor']);

    expect(w.findAllComponents(ChipStub).map((chip) => chip.props('name')), 'the strip\'s two cards, then each column\'s own')
      .to.deep.eq([CardName.BIRDS, CardName.PETS, CardName.BIRDS, CardName.PETS, CardName.ANTS]);
    expect(items.map((item) => item.find('.chip-stub').exists()), 'a pseudo-row is no card chip').to.deep.eq([true, true, false]);
    expect(items[2].find('.vp-source-chip--system .vp-source-chip__label').text()).to.eq($t(SYSTEM_ROW));
  });

  it('only the ten best reach the strip, past the podium without its mark — and with no scoring card there is no strip', () => {
    const many = Array.from({length: 12}, (_, i) => card(SYSTEM_ROW + ' ' + i, i + 1));
    const w = tab({model: model([score('red', 'Victor', 78, many)])});
    const items = w.findAll('.eg-topcard');
    expect(items.map((item) => item.find('.eg-topcard__vp').text())).to.deep.eq(['+12', '+11', '+10', '+9', '+8', '+7', '+6', '+5', '+4', '+3']);
    expect(items.map((item) => item.classes().includes('eg-topcard--podium'))).to.deep.eq([true, true, true, false, false, false, false, false, false, false]);

    const none = tab({model: model([oleg()])});
    expect(none.find('.eg-cards__top').exists()).to.eq(false);
  });

  it('one column per player — the head\'s count and sum, a pill per card with its kind, the penalties after, an empty hand said in words', () => {
    const w = tab({model: model([victor(), nastya(), oleg()])});
    expect(w.find('.eg-cards__players').classes(), 'three seats are no duel').to.deep.eq(['eg-cards__players']);
    const cols = w.findAll('.eg-cards__players > .eg-cards__col');
    expect(cols.map((col) => col.find('.eg-cards__name').text())).to.deep.eq(['Victor', 'Nastya', 'Oleg']);
    expect(cols.map((col) => col.classes().includes('eg-cards__col--winner'))).to.deep.eq([true, false, false]);
    expect(cols.map((col) => playerColour(col.element))).to.deep.eq([endgamePlayerHex('red'), endgamePlayerHex('blue'), endgamePlayerHex('green')]);
    expect(cols.map((col) => col.find('.eg-cards__dot').classes()[1])).to.deep.eq(['player_bg_color_red', 'player_bg_color_blue', 'player_bg_color_green']);
    expect(cols.map((col) => col.find('.eg-cards__count').text())).to.deep.eq(['▤ 2', '▤ 2', '▤ 0']);
    expect(cols[0].find('.eg-cards__count').attributes('data-hint')).to.eq($t('Top scoring cards'));
    expect(cols.map((col) => col.find('.eg-cards__sum').text())).to.deep.eq(['9' + $t('VP'), '2' + $t('VP'), '0' + $t('VP')]);

    const rows = cols[0].findAll('.eg-cards__rows > .eg-cardrow');
    expect(rows.map((row) => row.find('.eg-cardrow__vp').text())).to.deep.eq(['+6', '+3']);
    expect(rows.map((row) => row.classes().includes('eg-cardrow--big')), 'five points and up stand out').to.deep.eq([true, false]);
    expect(rows.map((row) => row.find('.eg-cardrow__kind').classes()[1])).to.deep.eq(['vp-accent--cards-resource', 'vp-accent--cards-conditional']);
    expect(rows.map((row) => row.find('.eg-cardrow__kind').attributes('data-hint'))).to.deep.eq([$t('Resource cards'), $t('Conditional cards')]);
    expect(rows.map((row) => row.find('.chip-stub').exists())).to.deep.eq([true, false]);
    expect(rows[1].find('.vp-source-chip__label').text()).to.eq($t(SYSTEM_ROW));

    const penalty = cols[1].findAll('.eg-cardrow')[1];
    expect(penalty.classes()).to.deep.eq(['eg-cardrow', 'eg-cardrow--penalty']);
    expect(penalty.find('.eg-cardrow__kind').classes()).to.deep.eq(['eg-cardrow__kind', 'vp-accent--penalty']);
    expect(penalty.find('.eg-cardrow__vp').classes()).to.deep.eq(['eg-cardrow__vp', 'eg-cardrow__vp--neg']);
    expect(penalty.find('.eg-cardrow__vp').text(), 'a penalty keeps its own sign').to.eq('-2');
    expect(penalty.find('.chip-stub').exists()).to.eq(true);

    expect(cols[2].find('.eg-cards__rows').exists()).to.eq(false);
    expect(cols[2].find('.eg-cards__empty').text()).to.eq($t('No victory points from cards.'));
  });

  it('follows its model — a duel lays the two columns out as one, and the overlay\'s shared props never fall through', async () => {
    const w = tab({model: model([victor(), nastya(), oleg()]), view: {id: 'p-viewer'}, viewerColor: 'red'});
    expect(Object.keys(w.attributes()), 'declared, so not attributes of the root').to.deep.eq(['class']);

    await w.setProps({model: model([nastya(), oleg()], 'duel')});
    expect(w.find('.eg-cards__players').classes()).to.deep.eq(['eg-cards__players', 'eg-cards__players--duel']);
    expect(w.findAll('.eg-cards__col').map((col) => col.find('.eg-cards__name').text())).to.deep.eq(['Nastya', 'Oleg']);
    expect(w.findAll('.eg-topcard').map((item) => item.find('.eg-topcard__vp').text())).to.deep.eq(['+4']);
    expect(w.find('.eg-cards__col--winner').exists()).to.eq(false);
  });
});
