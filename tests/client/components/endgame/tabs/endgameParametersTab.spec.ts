/*
 * EndgameParametersTab — «who pushed the planet»: the total terraforming push and the contribution by parameter.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it reads one prop (`model`; `view` and
 * `viewerColor` are declared only so the overlay's shared props do not fall through), emits nothing and exposes
 * nothing — so the spec is what it renders for the model. Mounted WITHOUT the i18n plugin on purpose: the component
 * imports `v-i18n` itself, and a Vue warning (an unresolved directive) fails the test.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {GlobalParameter} from '@/common/GlobalParameter';
import EndgameParametersTab from '@/client/components/endgame/tabs/EndgameParametersTab.vue';
import {EndgameModel, EndgameParameter, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

/** One score row — only what the tab reads. */
function score(color: Color, name: string, parametersTotal: number): EndgamePlayerScore {
  return {color, name, parametersTotal} as EndgamePlayerScore;
}

function model(players: Array<EndgamePlayerScore>, parameters: Array<EndgameParameter>): EndgameModel {
  return {players, parameters} as EndgameModel;
}

function tab(props: {model: EndgameModel, viewerColor?: Color}) {
  return mount(EndgameParametersTab, {props, global: {config: globalConfig.global.config}});
}

function width(el: Element): string {
  return (el as HTMLElement).style.width;
}

describe('EndgameParametersTab — who pushed the planet', () => {
  const players = () => [score('red', 'Victor', 6), score('blue', 'Nastya', 12), score('green', 'Oleg', 0)];
  const oxygen = (): EndgameParameter => ({
    key: GlobalParameter.OXYGEN, label: 'Oxygen', accent: 'oxygen', values: {red: 5, blue: 2}, max: 5, leaders: ['red'],
  });
  const temperature = (): EndgameParameter => ({
    key: GlobalParameter.TEMPERATURE, label: 'Temperature', accent: 'temperature', values: {blue: 10, red: 1}, max: 10, leaders: ['blue'],
  });

  it('ranks the players by their total push — each bar against the strongest one, in the player\'s colour', () => {
    const w = tab({model: model(players(), [])});
    expect(w.classes()).to.include.members(['eg-tab', 'eg-params']);
    expect(w.find('.eg-tab__hint').text()).to.eq($t('Each step raising a global parameter is one terraform rating point. Here is who pushed the planet.'));
    expect(w.find('.eg-params__total .eg-section-title').text()).to.eq($t('Total terraforming push'));
    const bars = w.findAll('.eg-params__total .eg-pbar');
    expect(bars.map((b) => b.find('.eg-pbar__name').text())).to.deep.eq(['Nastya', 'Victor', 'Oleg']);
    expect(bars.map((b) => b.find('.eg-pbar__val').text())).to.deep.eq(['12', '6', '0']);
    expect(bars.map((b) => width(b.find('.eg-pbar__fill').element))).to.deep.eq(['100%', '50%', '0%']);
    expect(bars.map((b) => (b.element as HTMLElement).style.getPropertyValue('--eg-pc')))
      .to.deep.eq([endgamePlayerHex('blue'), endgamePlayerHex('red'), endgamePlayerHex('green')]);
    expect(bars.map((b) => b.find('.eg-pbar__dot').classes().find((c) => c.startsWith('player_bg_color_'))))
      .to.deep.eq(['player_bg_color_blue', 'player_bg_color_red', 'player_bg_color_green']);
    expect(w.find('.eg-params__by').exists(), 'no parameter moved — no per-parameter section').to.eq(false);
  });

  it('one card per parameter — its players by contribution, the leader marked, a seat that added nothing reads 0', () => {
    const w = tab({model: model(players(), [oxygen(), temperature()]), viewerColor: 'red'});
    expect(w.find('.eg-params__by .eg-section-title').text()).to.eq($t('Contribution by parameter'));
    const cards = w.findAll('.eg-param-grid > .eg-param-card');
    expect(cards.map((c) => c.find('.eg-param-card__label').text())).to.deep.eq([$t('Oxygen'), $t('Temperature')]);
    expect(cards.map((c) => c.find('.eg-param-card__dot').classes())).to.deep.eq([
      ['eg-param-card__dot', 'vp-accent--oxygen'],
      ['eg-param-card__dot', 'vp-accent--temperature'],
    ]);

    const rows = cards[0].findAll('.eg-pbar');
    expect(rows.every((r) => r.classes().includes('eg-pbar--sm'))).to.eq(true);
    expect(rows.map((r) => r.find('.eg-pbar__name').text())).to.deep.eq(['Victor', 'Nastya', 'Oleg']);
    expect(rows.map((r) => r.find('.eg-pbar__val').text())).to.deep.eq(['5', '2', '0']);
    expect(rows.map((r) => width(r.find('.eg-pbar__fill').element))).to.deep.eq(['100%', '40%', '0%']);
    expect(rows.map((r) => r.classes().includes('eg-pbar--leader'))).to.deep.eq([true, false, false]);

    const other = cards[1].findAll('.eg-pbar');
    expect(other.map((r) => r.find('.eg-pbar__name').text())).to.deep.eq(['Nastya', 'Victor', 'Oleg']);
    expect(other.map((r) => r.classes().includes('eg-pbar--leader'))).to.deep.eq([true, false, false]);
  });

  it('follows its model — and a board nobody pushed draws empty bars, never a division by zero', async () => {
    const w = tab({model: model(players(), [oxygen()])});
    expect(w.findAll('.eg-param-card')).to.have.lengthOf(1);

    const idle: EndgameParameter = {...oxygen(), values: {}, max: 0, leaders: []};
    await w.setProps({model: model([score('red', 'Victor', 0), score('blue', 'Nastya', 0)], [idle])});
    expect(w.findAll('.eg-params__total .eg-pbar__fill').map((f) => width(f.element))).to.deep.eq(['0%', '0%']);
    expect(w.findAll('.eg-param-card .eg-pbar__fill').map((f) => width(f.element))).to.deep.eq(['0%', '0%']);
    expect(w.findAll('.eg-param-card .eg-pbar__val').map((v) => v.text())).to.deep.eq(['0', '0']);
    expect(w.find('.eg-pbar--leader').exists()).to.eq(false);
  });
});
