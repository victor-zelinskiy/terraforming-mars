/*
 * EndgamePlayersTab — one card per player: the standing, the VP by category, the final stock and the key stats, the
 * milestones and awards. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): three props in
 * (`model`, `view`, `viewerColor`), nothing emitted, nothing exposed — so the spec is what it renders for them.
 * Mounted WITHOUT the i18n plugin on purpose: the component imports `$t` and `v-i18n` itself, and a Vue warning
 * (an unresolved directive) fails the test.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../../getLocalVue';
import {$t, translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {MADetail} from '@/common/game/VictoryPointsBreakdown';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {AwardName} from '@/common/ma/AwardName';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import EndgamePlayersTab from '@/client/components/endgame/tabs/EndgamePlayersTab.vue';
import {EndgameCategory, EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

type ScoreFields = {place: number, total: number, isWinner: boolean, corporations: Array<string>, botCorporation: {name: string}, parametersTotal: number};

/** One score row — only what the tab reads. */
function score(color: Color, name: string, fields: Partial<ScoreFields> = {}, milestones: Array<MADetail> = [], awards: Array<MADetail> = []): EndgamePlayerScore {
  return {
    color, name, place: 1, total: 0, isWinner: false, corporations: [], parametersTotal: 0,
    ...fields,
    breakdown: {detailsMilestones: milestones, detailsAwards: awards},
  } as unknown as EndgamePlayerScore;
}

function model(players: Array<EndgamePlayerScore>, categories: Array<EndgameCategory> = []): EndgameModel {
  return {players, categories} as unknown as EndgameModel;
}

/** One seat of the view — only what the tab reads. */
function seat(color: Color, fields: Partial<PublicPlayerModel> = {}): PublicPlayerModel {
  return {
    color,
    megacredits: 0, megacreditProduction: 0, steel: 0, steelProduction: 0, titanium: 0, titaniumProduction: 0,
    plants: 0, plantProduction: 0, energy: 0, energyProduction: 0, heat: 0, heatProduction: 0,
    terraformRating: 20, citiesCount: 0, coloniesCount: 0, actionsTakenThisGame: 0,
    ...fields,
  } as unknown as PublicPlayerModel;
}

function view(players: Array<PublicPlayerModel>, colonies = false): ViewModel {
  return {game: {gameOptions: {expansions: {colonies}}}, players} as unknown as ViewModel;
}

function tab(props: Record<string, unknown>) {
  return mount(EndgamePlayersTab, {props, global: {config: globalConfig.global.config}});
}

describe('EndgamePlayersTab — one card per player', () => {
  const victor = () => score('red', 'Victor', {place: 1, total: 42, isWinner: true, corporations: ['Ecoline', 'Helion'], parametersTotal: 9});
  const bot = () => score('blue', 'Bot', {place: 2, total: 30, botCorporation: {name: 'Tharsis Republic'}});
  const oleg = () => score('green', 'Oleg', {place: 3, total: 11});

  it('the head: place, colour, name, corporation and total — the winner and the viewer marked', () => {
    const w = tab({model: model([victor(), bot(), oleg()]), view: view([]), viewerColor: 'red'});
    expect(w.classes()).to.deep.eq(['eg-tab', 'eg-players']);
    const cards = w.findAll('.eg-players__grid > .eg-pcard');
    expect(cards.map((card) => card.classes())).to.deep.eq([['eg-pcard', 'eg-pcard--winner', 'eg-pcard--you'], ['eg-pcard'], ['eg-pcard']]);
    expect(cards.map((card) => (card.element as HTMLElement).style.getPropertyValue('--eg-pc')))
      .to.deep.eq([endgamePlayerHex('red'), endgamePlayerHex('blue'), endgamePlayerHex('green')]);
    expect(cards.map((card) => card.find('.eg-pcard__place').text())).to.deep.eq(['1', '2', '3']);
    expect(cards.map((card) => card.find('.eg-pcard__dot').classes()[1])).to.deep.eq(['player_bg_color_red', 'player_bg_color_blue', 'player_bg_color_green']);
    expect(cards.map((card) => card.find('.eg-pcard__name').text())).to.deep.eq(['Victor' + $t('You'), 'Bot', 'Oleg']);
    expect(cards.map((card) => card.find('.eg-pcard__you').exists()), 'only the viewer is «You»').to.deep.eq([true, false, false]);
    expect(cards.map((card) => card.find('.eg-pcard__total').text())).to.deep.eq(['42' + $t('VP'), '30' + $t('VP'), '11' + $t('VP')]);

    // The corporation line: a human's own (several joined), the bot's off its own field, none — no line at all.
    expect(cards.map((card) => card.find('.eg-pcard__corp').exists())).to.deep.eq([true, true, false]);
    expect(cards[0].find('.eg-pcard__corp').text()).to.eq($t('Ecoline / Helion'));
    expect(cards[1].find('.eg-pcard__corp').text()).to.eq($t('Tharsis Republic'));
  });

  it('the body: every category, the final stock with its production, the key stats — a seat the view does not know shows neither', async () => {
    const categories: Array<EndgameCategory> = [
      {key: 'tr', label: 'Terraform rating', accent: 'tr-cards', values: {red: 30, blue: 25}, max: 30, leaders: ['red']},
      {key: 'cards', label: 'Cards', accent: 'cards-resource', values: {red: 12}, max: 12, leaders: ['red']},
    ];
    const red = seat('red', {
      megacredits: 14, megacreditProduction: -2, steel: 1, steelProduction: 3, plants: 7, heat: 20, heatProduction: 11,
      terraformRating: 30, citiesCount: 2, coloniesCount: 4, actionsTakenThisGame: 57,
    });
    const w = tab({model: model([victor(), bot(), oleg()], categories), view: view([red, seat('blue')])});
    const cards = w.findAll('.eg-pcard');

    expect(cards[0].findAll('.eg-pcard__cat-lbl').map((label) => label.text())).to.deep.eq([$t('Terraform rating'), $t('Cards')]);
    expect(cards[0].findAll('.eg-pcard__cat-dot').map((dot) => dot.classes()[1])).to.deep.eq(['vp-accent--tr-cards', 'vp-accent--cards-resource']);
    expect(cards[0].findAll('.eg-pcard__cat-val').map((value) => value.text())).to.deep.eq(['30', '12']);
    expect(cards[1].findAll('.eg-pcard__cat-val').map((value) => value.text()), 'a category the seat scored nothing in reads 0').to.deep.eq(['25', '0']);

    const stock = cards[0].findAll('.eg-pcard__res > .eg-pcard__resitem');
    expect(stock.map((item) => item.find('.resource_icon').classes()[1])).to.deep.eq([
      'resource_icon--megacredits', 'resource_icon--steel', 'resource_icon--titanium',
      'resource_icon--plants', 'resource_icon--energy', 'resource_icon--heat',
    ]);
    expect(stock.map((item) => item.find('.eg-pcard__res-amt').text())).to.deep.eq(['14', '1', '0', '7', '0', '20']);
    expect(stock.map((item) => item.find('.eg-pcard__res-prod').text())).to.deep.eq(['-2', '+3', '+0', '+0', '+0', '+11']);
    expect(stock.map((item) => item.find('.eg-pcard__res-prod').classes().includes('eg-pcard__res-prod--neg'))).to.deep.eq([true, false, false, false, false, false]);

    const stats = () => cards[0].findAll('.eg-pcard__stats > .eg-pcard__stat');
    expect(stats().map((stat) => stat.find('.eg-pcard__stat-lbl').text())).to.deep.eq([$t('TR'), $t('Cities'), $t('Actions'), $t('Steps')]);
    expect(stats().map((stat) => stat.find('.eg-pcard__stat-val').text())).to.deep.eq(['30', '2', '57', '9']);

    expect(cards[2].find('.eg-pcard__res').exists(), 'no seat in the view — no stock').to.eq(false);
    expect(cards[2].find('.eg-pcard__stats').exists(), 'and no stats').to.eq(false);
    expect(cards[2].findAll('.eg-pcard__cat-val').map((value) => value.text()), 'its categories still stand').to.deep.eq(['0', '0']);

    // With the Colonies expansion in the game the colonies are a stat of their own — the tab follows its view.
    await w.setProps({view: view([red, seat('blue')], true)});
    expect(stats().map((stat) => stat.find('.eg-pcard__stat-lbl').text())).to.deep.eq([$t('TR'), $t('Cities'), $t('Colonies'), $t('Actions'), $t('Steps')]);
    expect(stats().map((stat) => stat.find('.eg-pcard__stat-val').text())).to.deep.eq(['30', '2', '4', '57', '9']);
  });

  it('milestones and awards as chips — a milestone by its sentence, a funded award with its award and its funder', () => {
    const milestone: MADetail = {message: 'Claimed ${0} milestone', messageArgs: ['Terraformer'], victoryPoint: 5};
    const funded: MADetail = {message: '${0} place for ${1} award (funded by ${2})', messageArgs: ['1st', 'Banker', 'blue'], victoryPoint: 5};
    const bare: MADetail = {message: '${0} place for ${1} award', messageArgs: ['2nd', 'Miner'], victoryPoint: 2};
    const w = tab({model: model([score('red', 'Victor', {}, [milestone], [funded, bare]), bot()]), view: view([])});
    const cards = w.findAll('.eg-pcard');

    expect(cards[0].findAll('.eg-pcard__ma > .vp-source-chip--milestone .vp-source-chip__label').map((label) => label.text()))
      .to.deep.eq([translateTextWithParams('Claimed ${0} milestone', ['Terraformer'])]);
    const fundedText = translateMessage({
      message: '${0} place for ${1} award (funded by ${2})',
      data: [
        {type: LogMessageDataType.STRING, value: '1st'},
        {type: LogMessageDataType.AWARD, value: 'Banker' as AwardName},
        {type: LogMessageDataType.PLAYER, value: 'blue'},
      ],
    });
    expect(fundedText, 'the sentence is filled in').to.include('Banker').and.not.include('${');
    expect(cards[0].findAll('.eg-pcard__ma > .vp-source-chip--award .vp-source-chip__label').map((label) => label.text()))
      .to.deep.eq([fundedText, translateTextWithParams('${0} place for ${1} award', ['2nd', 'Miner'])]);

    expect(cards[1].find('.eg-pcard__ma').exists(), 'nothing claimed, nothing won — no row').to.eq(false);
  });
});
