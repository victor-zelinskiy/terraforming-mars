/*
 * ConsoleParliamentQuestDossier — the CHAIRMAN QUEST's dossier (Парламент v8 § 7): the chair and who sits in it, the
 * quest as an object (its printed condition, the race of every seat, where it comes from) and the rules in words.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md); read-only — it emits and exposes nothing,
 * its whole contract is what it renders for its view.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {STARTER_QUEST} from '@/common/parliament/ParliamentTypes';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {emptyParliamentView, ParliamentQuestVm, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import ConsoleParliamentQuestDossier from '@/client/components/console/parliament/ConsoleParliamentQuestDossier.vue';

// The delegate figure and the mechanics panel are their own specs' subjects; this one reads what the dossier HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, glow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'delegate-stub'}),
});
const MechanicsStub = defineComponent({name: 'PremiumMechanicsPanel', props: ['mechanics'], render: () => h('i', {class: 'mechanics-stub'})});

const BLUE: Color = 'blue';
const RED: Color = 'red';
const GREEN: Color = 'green';

const PLAYERS = [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}, {color: GREEN, name: 'Green'}] as unknown as ReadonlyArray<PublicPlayerModel>;

function quest(over: Partial<ParliamentQuestVm> = {}): ParliamentQuestVm {
  return {
    definition: STARTER_QUEST,
    text: 'Raise your heat production 3 times',
    renderData: undefined,
    source: 'starter',
    generation: 1,
    progress: [
      {color: BLUE, value: 2, participates: true, bot: false},
      {color: RED, value: 0, participates: true, bot: false},
      {color: GREEN, value: 1, participates: false, bot: false},
    ],
    completedBy: undefined,
    ...over,
  };
}

function view(over: Partial<ParliamentViewVm> = {}): ParliamentViewVm {
  return {...emptyParliamentView(), quest: quest(), ...over};
}

function dossier(props: Record<string, unknown>) {
  return mount(ConsoleParliamentQuestDossier as any, {
    ...globalConfig,
    props: {players: PLAYERS, viewerColor: BLUE, ...props},
    global: {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub, PremiumMechanicsPanel: MechanicsStub}},
  });
}

describe('ConsoleParliamentQuestDossier — the chairman quest as an object', () => {
  it('a vacant chair and the starter quest: the printed condition, the race of every seat that takes part, the starting rule', () => {
    const w = dossier({view: view()});
    expect(w.classes()).to.include('con-parl-qd');
    expect(w.attributes('data-parl-quest-dossier')).to.not.eq(undefined);
    expect(w.attributes('role')).to.eq('dialog');
    expect(w.attributes('aria-label')).to.eq($t('Chairman quest'));

    const chair = w.find('[data-parl-qd-chair]');
    expect(chair.find('.con-parl-qd__seat').classes()).to.not.include('con-parl-qd__seat--held');
    expect(chair.find('.con-parl-qd__seat-cube').exists()).to.eq(false);
    expect(chair.find('.con-parl-qd__holder').text()).to.eq($t('The seat is vacant'));

    // With no graphic the goal is the quest's printed text — and § ПРАВИЛА repeats it as the condition.
    expect(w.find('.mechanics-stub').exists()).to.eq(false);
    expect(w.find('[data-parl-qd-quest] .con-parl-qd__goal-text').text()).to.eq($t('Raise your heat production 3 times'));
    expect(w.find('[data-parl-qd-rules] .con-parl-qd__text').text()).to.eq($t('Raise your heat production 3 times'));

    const rows = w.findAll('[data-parl-qd-row]');
    expect(rows.map((r) => r.attributes('data-parl-qd-row')), 'a seat that holds no delegates runs no race').to.deep.eq([BLUE, RED]);
    expect(rows.map((r) => r.classes().includes('con-parl-qd__row--me'))).to.deep.eq([true, false]);
    expect(rows.map((r) => r.find('.con-parl-qd__row-name').text())).to.deep.eq(['Blue', 'Red']);
    expect(rows.map((r) => r.find('.con-parl-qd__row-value').text())).to.deep.eq(['2/3', '0/3']);
    expect(rows[0].findAll('.con-parl-qd__pip').map((p) => p.classes().includes('con-parl-qd__pip--on'))).to.deep.eq([true, true, false]);
    expect(rows.some((r) => r.classes().includes('con-parl-qd__row--won'))).to.eq(false);
    expect(w.find('.con-parl-qd__source').text()).to.eq(translateText('Starting rule'));
  });

  it('a held chair names its holder under the delegate; the winner\'s row is marked; a bot that cannot reach the quest reads ✕', () => {
    const q = quest({
      completedBy: RED,
      botReachable: false,
      progress: [
        {color: BLUE, value: 1, participates: true, bot: false},
        {color: RED, value: 3, participates: true, bot: false},
        {color: GREEN, value: 0, participates: true, bot: true},
      ],
    });
    const w = dossier({view: view({quest: q, chairman: RED})});
    const chair = w.find('[data-parl-qd-chair]');
    expect(chair.find('.con-parl-qd__seat').classes()).to.include('con-parl-qd__seat--held');
    expect(chair.find('.con-parl-qd__seat-cube .delegate-stub').exists()).to.eq(true);
    expect(chair.find('.con-parl-qd__holder').text()).to.eq('Red');

    // The chair's figure first, then one per row of the race — each in its seat's colour, at the scene's scale.
    const figures = w.findAllComponents(DelegateStub);
    expect(figures.map((f) => f.props('color'))).to.deep.eq([RED, BLUE, RED, GREEN]);
    expect(figures.map((f) => f.props('size'))).to.deep.eq([delegateFigurePx(26), delegateFigurePx(21), delegateFigurePx(21), delegateFigurePx(21)]);
    expect(figures.every((f) => f.props('glow') === false)).to.eq(true);

    const rows = w.findAll('[data-parl-qd-row]');
    expect(rows.map((r) => r.classes().includes('con-parl-qd__row--won'))).to.deep.eq([false, true, false]);
    expect(rows[2].find('.con-parl-qd__row-off').text()).to.eq('✕');
    expect(rows[2].find('.con-parl-qd__pips').exists(), 'no race is drawn for a seat that cannot run it').to.eq(false);
    expect(rows[1].find('.con-parl-qd__row-value').text()).to.eq('3/3');
  });

  it('a quest printed on a law names that law as its source — and the dossier follows its view', async () => {
    const onLaw = view({quest: quest({source: 'RDX_SPEC_LAW', definition: {...STARTER_QUEST, count: 2}})});
    const w = dossier({view: onLaw});
    expect(w.find('.con-parl-qd__source').text())
      .to.eq(translateTextWithParams('from the enacted resolution «${0}»', [translateText(resolutionTitleOf(onLaw, 'RDX_SPEC_LAW'))]));
    expect(w.find('[data-parl-qd-row] .con-parl-qd__row-value').text(), 'the count is the definition\'s').to.eq('2/2');
    expect(w.findAll('[data-parl-qd-row="blue"] .con-parl-qd__pip').length).to.eq(2);

    await w.setProps({view: view({quest: undefined})});
    expect(w.find('.con-parl-qd__goal').exists()).to.eq(false);
    expect(w.find('[data-parl-qd-race]').exists()).to.eq(false);
    expect(w.find('.con-parl-qd__source').text()).to.eq('');
    expect(w.find('[data-parl-qd-rules] .con-parl-qd__text').text(), 'no quest — no condition to print').to.eq('');
    expect(w.find('[data-parl-qd-reward]').exists(), 'the reward is the chair\'s — it stands with no quest too').to.eq(true);
  });
});
