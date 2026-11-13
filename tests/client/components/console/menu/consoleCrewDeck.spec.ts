/*
 * ConsoleCrewDeck — the creator's CREW deck: the participant roster as console rows (the humans, the MarsBot seat,
 * the «Add participant» plate). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): pure
 * presentation — the rows, the cursor and the shaking row arrive as props, the TR chip reads the creator's own rule
 * off the module state, and a press / a pointer move goes UP as `activate` / `hover` with the row's index. It exposes
 * nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CrewRow} from '@/client/console/menu/consoleCreateModel';
import {createGameState, resetCreateGameState} from '@/client/components/create/premium/createGameState';
import {botDifficultyMeta} from '@/client/components/create/premium/createGameMeta';
import ConsoleCrewDeck from '@/client/components/console/menu/ConsoleCrewDeck.vue';

type HumanRow = Extract<CrewRow, {kind: 'human'}>;

const human = (index: number, name: string, over: Partial<HumanRow> = {}): CrewRow => ({
  kind: 'human',
  index,
  slot: {slot: index, name, color: index === 0 ? 'red' : 'blue', trBoost: 0, isCreator: index === 0},
  isCreator: index === 0,
  removable: index > 0,
  nameIssue: undefined,
  ...over,
});

function deck(props: {rows: ReadonlyArray<CrewRow>, cursor: number, shakeRow?: number}) {
  return mount(ConsoleCrewDeck, {...globalConfig, props});
}

describe('ConsoleCrewDeck — the creator\'s participants as console rows', () => {
  afterEach(() => {
    resetCreateGameState();
  });

  it('one row per participant — a human (number, cube, name, the creator\'s tag), the MarsBot seat, the «Add participant» plate', () => {
    const w = deck({
      rows: [
        human(0, 'Ada'),
        human(1, '  '),
        {kind: 'bot', difficulty: 'hard', secondShift: true, extraCorporations: false},
        {kind: 'add', enabled: true, reasonKey: undefined},
      ],
      cursor: 0,
    });
    expect(w.classes()).to.include.members(['cm-deckbody', 'cm-crew']);
    const rows = w.findAll('button.cm-row');
    expect(rows).to.have.length(4);

    expect(rows.slice(0, 2).map((r) => r.find('.cm-row__num').text())).to.deep.eq(['1', '2']);
    expect(rows[0].find('.cm-row__cube').classes()).to.include('player_bg_color_red');
    expect(rows[1].find('.cm-row__cube').classes()).to.include('player_bg_color_blue');
    expect(rows[0].find('.cm-row__name').text()).to.eq('Ada');
    expect(rows[0].find('.cm-row__name').classes()).to.not.include('cm-row__name--missing');
    expect(rows[1].find('.cm-row__name').text(), 'a blank name says so').to.eq($t('Name not set'));
    expect(rows[1].find('.cm-row__name').classes()).to.include('cm-row__name--missing');
    expect(rows[0].find('.cm-row__sub').text()).to.eq($t('Player'));
    expect(rows[0].find('.cm-row__tag--creator').text()).to.eq($t('Creator'));
    expect(rows[1].find('.cm-row__tag--creator').exists()).to.eq(false);

    expect(rows[2].classes()).to.include('cm-row--bot');
    expect(rows[2].find('.cm-row__name').text()).to.eq($t('MarsBot'));
    const botLine = rows[2].find('.cm-row__sub').text();
    expect(botLine).to.contain($t(botDifficultyMeta('hard').labelKey));
    expect(botLine).to.contain($t('Dynamic balance'));
    expect(botLine).to.contain($t('Takes its turns automatically'));
    expect(rows[2].find('[data-crew-extra-corporations]').exists(), 'the extra corporations are off').to.eq(false);
    expect(rows[2].find('.cm-row__tag--bot').text()).to.eq($t('Automa'));

    expect(rows[3].classes()).to.include('cm-row--add');
    expect(rows[3].classes()).to.not.include('cm-row--disabled');
    expect(rows[3].find('.cm-row__name--add').text()).to.eq($t('Add participant'));
    expect(rows[3].find('.cm-row__sub').text()).to.eq($t('A player or the MarsBot'));
  });

  it('the cursor and the shake by index; a name issue and a refused «Add» state their reason', () => {
    const w = deck({
      rows: [
        human(0, 'Ada'),
        human(1, 'Ada', {nameIssue: 'duplicate'}),
        {kind: 'bot', difficulty: 'easy', secondShift: false, extraCorporations: true},
        {kind: 'add', enabled: false, reasonKey: 'The table is full'},
      ],
      cursor: 1,
      shakeRow: 3,
    });
    const rows = w.findAll('button.cm-row');
    expect(rows.map((r) => r.classes().includes('cm-row--cursor'))).to.deep.eq([false, true, false, false]);
    expect(rows.map((r) => r.classes().includes('cm-row--shake'))).to.deep.eq([false, false, false, true]);
    expect(rows.map((r) => r.classes().includes('cm-row--issue'))).to.deep.eq([false, true, false, false]);
    expect(rows[1].find('.cm-row__issue').text()).to.eq($t('Player names must be unique'));
    expect(rows[2].find('[data-crew-extra-corporations]').text()).to.eq($t('Extra corporations'));
    expect(rows[2].find('.cm-row__sub').text(), 'no second shift on this seat').to.not.contain($t('Dynamic balance'));
    expect(rows[3].classes()).to.include('cm-row--disabled');
    expect(rows[3].find('.cm-row__issue').text()).to.eq($t('The table is full'));

    const unshaken = deck({rows: [human(0, 'Ada')], cursor: 0});
    expect(unshaken.find('button.cm-row').classes(), 'the default shake row is none').to.not.include('cm-row--shake');
  });

  it('the TR chip stands only while the creator\'s rule is on, and only on a seat that has a boost', async () => {
    const w = deck({
      rows: [human(0, 'Ada', {slot: {slot: 0, name: 'Ada', color: 'red', trBoost: 2, isCreator: true}}), human(1, 'Bob')],
      cursor: 0,
    });
    expect(w.find('.cm-row__tag--tr').exists(), 'the rule is off').to.eq(false);
    createGameState.config.rules.trBoostEnabled = true;
    await nextTick();
    const chips = w.findAll('.cm-row__tag--tr');
    expect(chips, 'the seat without a boost carries no chip').to.have.length(1);
    expect(chips[0].text()).to.contain('+2');
    expect(w.findAll('button.cm-row')[0].find('.cm-row__tag--tr').exists()).to.eq(true);
  });

  it('a click ACTIVATES the row and a pointer move HOVERS it — each says the row\'s index', async () => {
    const w = deck({rows: [human(0, 'Ada'), human(1, 'Bob'), {kind: 'add', enabled: true, reasonKey: undefined}], cursor: 0});
    const rows = w.findAll('button.cm-row');
    await rows[2].trigger('click');
    await rows[1].trigger('mousemove');
    await rows[0].trigger('click');
    expect(w.emitted('activate')).to.deep.eq([[2], [0]]);
    expect(w.emitted('hover')).to.deep.eq([[1]]);
  });
});
