import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameSetupDetail from '@/client/components/GameSetupDetail.vue';
import {fakeGameOptionsModel} from './testHelpers';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {GameOptionsModel} from '@/common/models/GameOptionsModel';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {RULEBOOK_URLS} from '@/client/utils/WikiLinks';

/*
 * GameSetupDetail is a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its
 * three props. It has no children, emits nothing and exposes nothing — so the spec reads the page: the expansion
 * icons and their rulebook links, the board's colour class, the M&A mode (the template compares against the IMPORTED
 * enum), the agendas mark, the escape-velocity sentence, and the solo / multiplayer rows.
 */
function detailOf(gameOptions: GameOptionsModel, playerNumber = 2) {
  return mount(GameSetupDetail, {
    ...globalConfig,
    props: {playerNumber, gameOptions, lastSoloGeneration: 14},
  });
}

/** The labels of the rows on the page («Expansion:», «Board:» …). */
function rowLabels(detail: ReturnType<typeof detailOf>): Array<string> {
  return detail.findAll('.setup-item').map((item) => item.text());
}

describe('GameSetupDetail', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameSetupDetail, {
      ...globalConfig,
      props: {
        playerNumber: 2,
        gameOptions: fakeGameOptionsModel(),
        lastSoloGeneration: 14,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('renders the options it is given: an icon and a rulebook link per expansion, the board, the M&A mode', () => {
    const detail = detailOf(fakeGameOptionsModel({
      expansions: {...DEFAULT_EXPANSIONS, venus: true, colonies: true},
      randomMA: RandomMAOptionType.LIMITED,
      includeFanMA: true,
    }));

    expect(detail.find('.expansion-icon-venus').exists()).to.eq(true);
    expect(detail.find('a[data-tooltip="Venus Next rulebook"]').attributes('href')).to.eq(RULEBOOK_URLS.venus);
    expect(detail.find('a[data-tooltip="Colonies rulebook"]').attributes('href')).to.eq(RULEBOOK_URLS.colonies);
    expect(detail.find('.expansion-icon-prelude').exists(), 'an expansion that is off has no icon').to.eq(false);

    const board = detail.find('.board-tharsis');
    expect(board.classes()).to.include.members(['game-config', 'board-tharsis', 'map']);
    expect(board.text()).to.eq('tharsis');

    const modes = detail.findAll('li').find((row) => row.text().includes('Milestones and Awards:'));
    expect(modes?.findAll('.game-config').map((mode) => mode.text()))
      .to.deep.eq(['Randomized with limited synergy', 'Include fan Milestones/Awards']);
  });

  it('the agendas mark and the escape-velocity sentence stand only when the game has them', () => {
    const plain = detailOf(fakeGameOptionsModel());
    expect(plain.find('.expansion-icon-agendas').exists()).to.eq(false);
    expect(plain.find('.expansion-icon-escape-velocity').exists()).to.eq(false);
    expect(plain.text()).to.include('Board-defined');

    const timed = detailOf(fakeGameOptionsModel({
      politicalAgendasExtension: 'Chairman',
      escapeVelocity: {thresholdMinutes: 30, bonusSectionsPerAction: 5, penaltyPeriodMinutes: 2, penaltyVPPerPeriod: 1},
    }));
    expect(timed.find('.expansion-icon-agendas').exists()).to.eq(true);
    expect(timed.find('.expansion-icon-escape-velocity').exists()).to.eq(true);
    expect(timed.text()).to.include('After 30 min, reduce 1 VP every 2 min. (5 bonus sec. per action.)');
  });

  it('a solo game reads its last generation and its goal, a table of several its M&A and its draft', () => {
    const solo = detailOf(fakeGameOptionsModel({soloTR: true}), 1);
    expect(rowLabels(solo)).to.include('Solo:');
    expect(rowLabels(solo)).to.not.include('Milestones and Awards:');
    expect(rowLabels(solo)).to.not.include('Draft:');
    expect(solo.text()).to.include('14 Gens');
    expect(solo.text()).to.include('63 TR');

    const table = detailOf(fakeGameOptionsModel({draftVariant: true}), 3);
    expect(rowLabels(table)).to.include.members(['Milestones and Awards:', 'Draft:']);
    expect(rowLabels(table)).to.not.include('Solo:');
    expect(table.text()).to.include('Research phase');
  });
});
