/*
 * ResultHeroDuel — the two-player result block. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): two props (`model`, `viewerColor`), no emits, nothing exposed — so the spec is what
 * it renders for them. The explainable badge and the verdict banner are their own subjects and are stubbed by name;
 * this spec reads what the hero HANDS them. Mounted WITHOUT the i18n plugin on purpose: the component imports `v-i18n`
 * itself, and a Vue warning (an unresolved directive or component) fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import ResultHeroDuel from '@/client/components/endgame/ResultHeroDuel.vue';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {PlayerStrategyProfile, StrategyArchetype, strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {themeForArchetype} from '@/client/components/endgame/strategyVisualThemes';
import {buildStrategyTermDetail} from '@/client/components/endgame/insightDetail';
import type {FinishVerdict} from '@/client/components/endgame/finishVerdict';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const BannerStub = defineComponent({name: 'FinishVerdictBanner', props: ['verdict'], render: () => h('i', {class: 'banner-stub'})});
const BadgeStub = defineComponent({
  name: 'ExplainableBadge',
  props: {label: String, detail: Object, badgeClass: String, markless: Boolean},
  render: () => h('i', {class: 'badge-stub'}),
});

/** The strategy profile as the hero reads it: the primary line's archetype (and no detection behind it). */
function plays(archetype: StrategyArchetype): PlayerStrategyProfile {
  return {primary: {archetype}, secondary: [], all: []} as unknown as PlayerStrategyProfile;
}

/** One ranked score row — only what the hero block reads. */
function score(color: Color, name: string, place: number, total: number, extra: Partial<EndgamePlayerScore> = {}): EndgamePlayerScore {
  return {color, name, place, total, isWinner: place === 1, corporations: ['Helion'], ...extra} as EndgamePlayerScore;
}

/** The model as the hero reads it: the two players (in ANY order), the winner, the margin, the verdict. */
function model(players: Array<EndgamePlayerScore>, extra: Partial<EndgameModel> = {}): EndgameModel {
  const winner = players.find((p) => p.isWinner);
  const other = players.find((p) => !p.isWinner);
  return {
    players,
    winner,
    margin: winner !== undefined && other !== undefined ? winner.total - other.total : 0,
    finishVerdict: undefined,
    automaClockWin: false,
    ...extra,
  } as EndgameModel;
}

function hero(props: {model: EndgameModel, viewerColor?: Color}) {
  return mount(ResultHeroDuel, {
    props,
    global: {config: globalConfig.global.config, stubs: {FinishVerdictBanner: BannerStub, ExplainableBadge: BadgeStub}},
  });
}

function tint(el: Element): string {
  return (el as HTMLElement).style.getPropertyValue('--eg-pc');
}

describe('ResultHeroDuel — the two-player result block', () => {
  it('the winner stands on the LEFT whatever the model\'s order — both sides with their colour, corporations and total, «You» only on the viewer\'s', async () => {
    const victor = score('red', 'Victor', 1, 87, {corporations: ['Helion', 'Credicor']});
    const bot = score('blue', 'MarsBot', 2, 75, {corporations: [], botCorporation: {id: MarsBotCorpId.C01_CREDICOR, name: 'Credicor'}});
    const w = hero({model: model([bot, victor]), viewerColor: 'red'});

    const left = w.find('.eg-rhduel__player--left');
    expect(left.classes()).to.include('eg-rhduel__player--winner');
    expect(tint(left.element)).to.eq(endgamePlayerHex('red'));
    expect(left.find('.eg-rhduel__crown').exists()).to.eq(true);
    expect(left.find('.eg-rhduel__dot').classes()).to.include('player_bg_color_red');
    expect(left.find('.eg-rhduel__name').text()).to.eq('Victor');
    expect(left.find('.eg-rhduel__you').text()).to.eq($t('You'));
    expect(left.find('.eg-rhduel__corp').text()).to.eq('Helion / Credicor');
    expect(left.find('.eg-rhduel__total').text()).to.eq('87' + $t('VP'));

    const right = w.find('.eg-rhduel__player--right');
    expect(right.classes()).to.not.include('eg-rhduel__player--winner');
    expect(tint(right.element)).to.eq(endgamePlayerHex('blue'));
    expect(right.find('.eg-rhduel__crown').exists(), 'one crown').to.eq(false);
    expect(right.find('.eg-rhduel__name').text()).to.eq('MarsBot');
    expect(right.find('.eg-rhduel__you').exists()).to.eq(false);
    expect(right.find('.eg-rhduel__corp').text(), 'the bot\'s corporation rides `botCorporation`').to.eq('Credicor');
    expect(right.find('.eg-rhduel__total').text()).to.eq('75' + $t('VP'));

    await w.setProps({viewerColor: 'blue'});
    expect(left.find('.eg-rhduel__you').exists()).to.eq(false);
    expect(right.find('.eg-rhduel__you').text()).to.eq($t('You'));

    await w.setProps({model: model([score('red', 'Victor', 1, 87, {corporations: []}), score('blue', 'Nastya', 2, 75)]), viewerColor: undefined});
    expect(w.find('.eg-rhduel__player--left .eg-rhduel__corp').exists(), 'no corporation — no line').to.eq(false);
    expect(w.find('.eg-rhduel__you').exists(), 'no viewer colour — nobody is «You»').to.eq(false);
  });

  it('the centre is the MARGIN — the lead in points, «Decided on M€» on a tie, the clock sentence when MarsBot won on the clock', async () => {
    const two = (winnerTotal: number) => [score('red', 'Victor', 1, winnerTotal), score('blue', 'Nastya', 2, 75)];
    const w = hero({model: model(two(87))});
    const margin = () => w.find('.eg-rhduel__center > .eg-rhduel__margin');
    expect(margin().find('.eg-rhduel__margin-val').text()).to.eq('+12');
    expect(margin().find('.eg-rhduel__margin-lbl').text()).to.eq($t('Lead'));
    expect(margin().classes()).to.deep.eq(['eg-rhduel__margin']);

    await w.setProps({model: model(two(75))});
    expect(margin().classes()).to.include('eg-rhduel__margin--tie');
    expect(margin().find('.eg-rhduel__margin-val').exists()).to.eq(false);
    expect(margin().text()).to.eq($t('Decided on M€'));

    await w.setProps({model: model(two(87), {automaClockWin: true})});
    expect(margin().classes(), 'the rule decided it — not the lead').to.include('eg-rhduel__margin--clock');
    expect(margin().find('.eg-rhduel__margin-val').exists()).to.eq(false);
    expect(margin().text()).to.eq($t('Won on the clock — the final generation was reached'));
  });

  it('a detected strategy is the side\'s line — «Main line» / «Answer» — as an explainable term handed its detail; without one there is no line', () => {
    const victor = score('red', 'Victor', 1, 87, {strategyProfile: plays('jovian')});
    const nastya = score('blue', 'Nastya', 2, 75, {strategyProfile: plays('cityGreenery')});
    const players = [victor, nastya];
    const w = hero({model: model(players)});

    const lines = w.findAll('.eg-rhduel__line');
    expect(lines.map((l) => l.find('.eg-rhduel__line-lbl').text())).to.deep.eq([$t('Main line'), $t('Answer')]);
    const badges = w.findAllComponents(BadgeStub);
    expect(badges.map((b) => b.props('label'))).to.deep.eq([strategyLabel('jovian'), strategyLabel('cityGreenery')]);
    expect(badges.map((b) => b.props('badgeClass'))).to.deep.eq(['eg-term eg-term--strategy', 'eg-term eg-term--strategy']);
    expect(badges.map((b) => b.props('markless'))).to.deep.eq([true, true]);
    expect(badges[0].props('detail')).to.deep.eq(buildStrategyTermDetail(players, 'red', 'jovian'));
    expect(badges[1].props('detail')).to.deep.eq(buildStrategyTermDetail(players, 'blue', 'cityGreenery'));

    const plain = hero({model: model([score('red', 'Victor', 1, 87), score('blue', 'Nastya', 2, 75)])});
    expect(plain.findAll('.eg-rhduel__line'), 'no detected line — no row').to.have.lengthOf(0);
    expect(plain.findComponent(BadgeStub).exists()).to.eq(false);
  });

  it('the theme is the winner\'s primary archetype (neutral without one); the verdict banner stands only with a verdict, handed it whole', async () => {
    const w = hero({model: model([score('red', 'Victor', 1, 87, {strategyProfile: plays('jovian')}), score('blue', 'Nastya', 2, 75)])});
    const jovian = themeForArchetype('jovian');
    expect((w.element as HTMLElement).tagName).to.eq('SECTION');
    expect(w.classes()).to.include.members(['eg-rhduel', 'eg-theme--' + jovian.motif]);
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
