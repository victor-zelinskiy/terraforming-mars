/*
 * ResultHeroMultiplayer — the 3+ player result block. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): two props (`model`, `viewerColor`), no emits, nothing exposed — so the spec is what
 * it renders for them. Mounted WITHOUT the i18n plugin on purpose: the component imports `v-i18n` itself, and a Vue
 * warning (an unresolved directive or component) fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import ResultHeroMultiplayer from '@/client/components/endgame/ResultHeroMultiplayer.vue';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {PlayerStrategyProfile, StrategyArchetype, strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {themeForArchetype} from '@/client/components/endgame/strategyVisualThemes';
import type {FinishVerdict} from '@/client/components/endgame/finishVerdict';

// The verdict banner is its own spec's subject (`finishVerdictBanner.spec.ts`); this one reads what the hero HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const BannerStub = defineComponent({name: 'FinishVerdictBanner', props: ['verdict'], render: () => h('i', {class: 'banner-stub'})});

/** The strategy profile as the hero reads it: the primary line's archetype. */
function plays(archetype: StrategyArchetype): PlayerStrategyProfile {
  return {primary: {archetype}} as unknown as PlayerStrategyProfile;
}

/** One ranked score row — only what the hero block reads. */
function score(color: Color, name: string, place: number, total: number, extra: Partial<EndgamePlayerScore> = {}): EndgamePlayerScore {
  return {color, name, place, total, isWinner: place === 1, corporations: ['Helion'], ...extra} as EndgamePlayerScore;
}

/** The model as the hero reads it: the ranked players, the winner, the margin, the verdict. */
function model(players: Array<EndgamePlayerScore>, extra: Partial<EndgameModel> = {}): EndgameModel {
  return {
    players,
    winner: players[0],
    margin: players.length > 1 ? players[0].total - players[1].total : 0,
    finishVerdict: undefined,
    ...extra,
  } as EndgameModel;
}

function hero(props: {model: EndgameModel, viewerColor?: Color}) {
  return mount(ResultHeroMultiplayer, {
    props,
    global: {config: globalConfig.global.config, stubs: {FinishVerdictBanner: BannerStub}},
  });
}

function tint(el: Element): string {
  return (el as HTMLElement).style.getPropertyValue('--eg-pc');
}

describe('ResultHeroMultiplayer — the 3+ player result block', () => {
  const four = () => [
    score('red', 'Victor', 1, 87, {corporations: ['Helion', 'Credicor'], strategyProfile: plays('jovian')}),
    score('blue', 'Nastya', 2, 75, {strategyProfile: plays('cityGreenery')}),
    score('green', 'Oleg', 3, 60),
    score('yellow', 'Dina', 4, 41),
  ];

  it('the winner stands large — name, corporations, total, the margin to second place — and «You» only for the viewer', async () => {
    const w = hero({model: model(four()), viewerColor: 'red'});
    const winner = w.find('.eg-rhmulti__head > .eg-rhmulti__winner');
    expect(tint(winner.element)).to.eq(endgamePlayerHex('red'));
    expect(winner.find('.eg-rhmulti__dot').classes()).to.include('player_bg_color_red');
    expect(winner.find('.eg-rhmulti__name').text()).to.eq('Victor');
    expect(winner.find('.eg-rhmulti__you').text()).to.eq($t('You'));
    expect(winner.find('.eg-rhmulti__corp').text()).to.eq('Helion / Credicor');
    expect(winner.find('.eg-rhmulti__total').text()).to.eq('87' + $t('VP'));
    expect(winner.find('.eg-rhmulti__lead-val').text()).to.eq('+12');
    expect(winner.find('.eg-rhmulti__lead-lbl').text()).to.eq($t('ahead of second place'));
    expect(winner.find('.eg-rhmulti__lead--tie').exists()).to.eq(false);

    await w.setProps({viewerColor: 'blue'});
    expect(w.find('.eg-rhmulti__you').exists(), 'the viewer is not the winner').to.eq(false);
  });

  it('the leaderboard is the top THREE, in order — the winner\'s and the viewer\'s rows marked, a strategy named where one was detected', () => {
    const w = hero({model: model(four()), viewerColor: 'blue'});
    const rows = w.findAll('.eg-rhmulti__board > .eg-rhmulti__row');
    expect(rows.map((r) => r.find('.eg-rhmulti__rname').text()), 'the fourth seat is not on the block').to.deep.eq(['Victor', 'Nastya', 'Oleg']);
    expect(rows.map((r) => r.find('.eg-rhmulti__place').text())).to.deep.eq(['1', '2', '3']);
    expect(rows.map((r) => r.find('.eg-rhmulti__rtotal').text())).to.deep.eq([87, 75, 60].map((n) => n + $t('VP')));
    expect(rows.map((r) => tint(r.element))).to.deep.eq([endgamePlayerHex('red'), endgamePlayerHex('blue'), endgamePlayerHex('green')]);
    expect(rows.map((r) => r.find('.eg-rhmulti__rdot').classes().find((c) => c.startsWith('player_bg_color_'))))
      .to.deep.eq(['player_bg_color_red', 'player_bg_color_blue', 'player_bg_color_green']);
    expect(rows.map((r) => r.classes().includes('eg-rhmulti__row--winner'))).to.deep.eq([true, false, false]);
    expect(rows.map((r) => r.classes().includes('eg-rhmulti__row--you'))).to.deep.eq([false, true, false]);
    expect(rows[0].find('.eg-rhmulti__rstyle').text()).to.eq($t(strategyLabel('jovian')));
    expect(rows[1].find('.eg-rhmulti__rstyle').text()).to.eq($t(strategyLabel('cityGreenery')));
    expect(rows[2].find('.eg-rhmulti__rstyle').exists(), 'no detected line — no style').to.eq(false);
  });

  it('a tie on points reads «Decided on M€»; the MarsBot seat\'s corporation rides `botCorporation`; no winner — no winner block', async () => {
    const bot = score('red', 'MarsBot', 1, 70, {corporations: [], botCorporation: {id: MarsBotCorpId.C01_CREDICOR, name: 'Credicor'}});
    const w = hero({model: model([bot, score('blue', 'Nastya', 1, 70), score('green', 'Oleg', 3, 50)])});
    expect(w.find('.eg-rhmulti__corp').text()).to.eq('Credicor');
    expect(w.find('.eg-rhmulti__lead--tie').text()).to.eq($t('Decided on M€'));
    expect(w.find('.eg-rhmulti__lead-val').exists()).to.eq(false);
    expect(w.find('.eg-rhmulti__you').exists(), 'no viewer colour — nobody is «You»').to.eq(false);

    await w.setProps({model: model([score('blue', 'Nastya', 1, 70, {corporations: []})])});
    expect(w.find('.eg-rhmulti__corp').exists(), 'no corporation — no line').to.eq(false);

    await w.setProps({model: model([], {winner: undefined})});
    expect(w.find('.eg-rhmulti__winner').exists()).to.eq(false);
    expect(w.findAll('.eg-rhmulti__row')).to.have.lengthOf(0);
  });

  it('the theme is the winner\'s primary archetype (neutral without one); the verdict banner stands only with a verdict, handed it whole', async () => {
    const w = hero({model: model(four())});
    const jovian = themeForArchetype('jovian');
    expect((w.element as HTMLElement).tagName).to.eq('SECTION');
    expect(w.classes()).to.include.members(['eg-rhmulti', 'eg-theme--' + jovian.motif]);
    expect((w.element as HTMLElement).style.getPropertyValue('--eg-theme')).to.eq(jovian.accent);
    expect(w.findComponent(BannerStub).exists(), 'no verdict — no banner').to.eq(false);

    const verdict = {scale: 'solid', pattern: 'normal', rarity: 'common', titleKey: 'Solid win'} as FinishVerdict;
    await w.setProps({model: model([score('green', 'Oleg', 1, 60), score('yellow', 'Dina', 2, 41)], {finishVerdict: verdict})});
    const neutral = themeForArchetype(undefined);
    expect(w.classes()).to.include('eg-theme--' + neutral.motif);
    expect(w.classes()).to.not.include('eg-theme--' + jovian.motif);
    expect((w.element as HTMLElement).style.getPropertyValue('--eg-theme')).to.eq(neutral.accent);
    expect(w.findComponent(BannerStub).props('verdict')).to.deep.eq(verdict);
  });
});
