import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GameEnd from '@/client/components/GameEnd.vue';
import VictoryPointChart from '@/client/components/gameend/VictoryPointChart.vue';
import HydroTrack from '@/client/components/hydronetwork/HydroTrack.vue';
import {APP_NAME} from '@/common/constants';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {Color} from '@/common/Color';
import {PlayerId} from '@/common/Types';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel} from './testHelpers';

/*
 * The classic end-of-game page (`the-end`). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): one
 * prop in — the final view — nothing out, nothing exposed. What it renders for that view: the solo verdict, the
 * winner line, the breakdown rows in place order, what it hands the charts — and the page title it leaves behind.
 * The board, the log, the charts and the buttons are stubs (a shallow mount): the spec asserts what the page HANDS them.
 */

/** A line of a chart, as the page hands it over (`DataSet` of `VictoryPointChart.vue`: a type a spec cannot import from a `.vue`). */
type ChartSet = {label: string, data: ReadonlyArray<number>, color: Color};

/** A cell of the Hydronetwork's track, as the page hands it over — the two members this spec reads. */
type TrackStage = {position: number, markers: ReadonlyArray<{color: Color, isViewer: boolean}>};

/** A seat of the final table: its points and its M€ decide its place. */
function seat(color: Color, name: string, total: number, megacredits: number): PublicPlayerModel {
  const base = fakePublicPlayerModel();
  return {...base, color, name, id: `p-${color}-id` as PlayerId, megacredits, victoryPointsBreakdown: {...base.victoryPointsBreakdown, total}};
}

describe('GameEnd', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameEnd, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel(),
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('a solo game: the verdict is the game\'s — the hints after a loss, the next challenge and the winner line after a win — under the app\'s name, and the page title carries the flag', () => {
    const lost = shallowMount(GameEnd, {...globalConfig, props: {playerView: fakePlayerViewModel()}});
    expect(lost.find('h1').text()).to.eq(`${APP_NAME} - Game finished!`);
    expect(lost.find('.game_end_fail').exists()).to.eq(true);
    expect(lost.find('.game_end_success').exists()).to.eq(false);
    expect(lost.find('.game-end-winer-announcement').exists(), 'nobody won').to.eq(false);
    expect(document.title.startsWith('🏁 | '), document.title).to.eq(true);

    const won = shallowMount(GameEnd, {...globalConfig, props: {playerView: fakePlayerViewModel({game: fakeGameModel({isSoloModeWin: true})})}});
    expect(won.find('.game_end_fail').exists()).to.eq(false);
    expect(won.find('.game_end_success .game_end_list').text(), 'ten more than the 20 points just scored').to.contain('30');
    expect(won.find('.game-end-winer-announcement').text()).to.eq('blue won!');
  });

  it('a table: the rows stand in place order, a tie on points is broken by M€, the winner line names only who won — and the charts get every seat', () => {
    const cy = seat('green', 'Cy', 20, 50);
    const bob = seat('red', 'Bob', 30, 5);
    const ann = seat('blue', 'Ann', 30, 9);
    const playerView = fakePlayerViewModel({players: [cy, bob, ann], thisPlayer: ann, id: ann.id as PlayerId});
    const wrapper = shallowMount(GameEnd, {...globalConfig, props: {playerView}});

    expect(wrapper.find('.game_end_fail').exists(), 'no solo verdict at a table').to.eq(false);
    const [breakdown, contributions] = wrapper.findAll('table.game_end_table');
    const rows = breakdown.findAll('tbody tr');
    expect(rows.map((row) => row.find('td a').text())).to.deep.eq(['Ann', 'Bob', 'Cy']);
    expect(rows.map((row) => row.find('td a').attributes('href'))).to.deep.eq(['player?id=p-blue-id&noredirect', 'player?id=p-red-id&noredirect', 'player?id=p-green-id&noredirect']);
    expect(rows.map((row) => row.find('td.game-end-total').text())).to.deep.eq(['30', '30', '20']);
    expect(rows[0].classes()).to.deep.eq(['player_translucent_bg_color_blue']);
    expect(wrapper.find('.game-end-winer-announcement').text(), 'Bob ties on points and loses on M€').to.eq('Ann won!');
    expect(contributions.findAll('tbody tr').map((row) => row.find('td').text()), 'the contributions keep the seat order').to.deep.eq(['Cy', 'Bob', 'Ann']);

    const [points, globals] = wrapper.findAllComponents(VictoryPointChart);
    const pointSets: ReadonlyArray<ChartSet> = points.props('datasets');
    const globalSets: ReadonlyArray<ChartSet> = globals.props('datasets');
    expect(pointSets.map((set) => [set.label, set.color])).to.deep.eq([['Cy', 'green'], ['Bob', 'red'], ['Ann', 'blue']]);
    expect(globalSets.map((set) => set.color), 'temperature, oxygen, oceans — no Venus, no Moon in this game').to.deep.eq(['red', 'green', 'blue']);
    expect(wrapper.find('.game_end_block--log > a').attributes('href')).to.eq(`${apiUrl(paths.API_GAME_LOGS)}?id=p-blue-id&full=true`);
  });

  it('what the options add: the Hydronetwork\'s final track with every seat\'s marker, the timers\' column, a milestone\'s line with its argument', () => {
    const plain = shallowMount(GameEnd, {...globalConfig, props: {playerView: fakePlayerViewModel()}});
    expect(plain.findComponent(HydroTrack).exists(), 'no Hydronetwork in a base game').to.eq(false);
    expect(plain.find('td .game-end-timer').text(), 'without timers the last column is the actions taken').to.eq('0');

    const cy = seat('green', 'Cy', 20, 50);
    const ann = seat('blue', 'Ann', 30, 9);
    ann.victoryPointsBreakdown.detailsMilestones = [{message: 'Claimed ${0} milestone', messageArgs: ['Terraformer'], victoryPoint: 5}];
    const game = fakeGameModel({gameOptions: fakeGameOptionsModel({showTimers: true})});
    game.gameOptions.expansions.deltaProject = true;
    const wrapper = shallowMount(GameEnd, {...globalConfig, props: {playerView: fakePlayerViewModel({players: [cy, ann], thisPlayer: ann, game})}});

    const stages: ReadonlyArray<TrackStage> = wrapper.findComponent(HydroTrack).props('stages');
    expect(stages.length).to.be.greaterThan(0);
    expect(stages.find((stage) => stage.position === 0)?.markers, 'nobody moved: both markers stand at the start, nobody is «the viewer»').to.deep.eq([
      {color: 'green', isViewer: false}, {color: 'blue', isViewer: false},
    ]);
    expect(wrapper.findAll('table.game_end_table')[0].findAll('tbody tr').map((row) => row.findAll('td .game-end-timer').length), 'a time and the actions').to.deep.eq([2, 2]);
    expect(wrapper.findAll('.game-end-column-text').map((line) => line.text())).to.include('Claimed Terraformer milestone');
  });
});
