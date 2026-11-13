import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {globalConfig} from './getLocalVue';
import GameBoardView from '@/client/components/GameBoardView.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePublicPlayerModel} from './testHelpers';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {GameModel} from '@/common/models/GameModel';
import {TileView} from '@/client/components/board/TileView';

/*
 * GameBoardView is a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its
 * props — the board and, behind its own hotkey anchor, the board of every expansion the game carries — and the one
 * event it sends up. The four boards are stubbed by name: `<board>` and `<turmoil>` resolve to the IMPORTS `Board` and
 * `Turmoil`, and a stub seen on the page is the proof of that. It exposes nothing.
 */
const BoardStub = defineComponent({
  name: 'BoardStub',
  props: {
    boardName: {type: String, default: ''},
    venusScaleLevel: {type: Number, default: 0},
    oceans_count: {type: Number, default: 0},
    oxygen_level: {type: Number, default: 0},
    temperature: {type: Number, default: 0},
    players: {type: Array, default: () => []},
    tileView: {type: String, default: ''},
  },
  emits: ['toggleTileView'],
  render() {
    return h('i', {'class': 'board-stub'});
  },
});

const TurmoilStub = defineComponent({
  name: 'TurmoilStub',
  props: {turmoil: {type: Object, default: undefined}},
  render() {
    return h('i', {'class': 'turmoil-stub'});
  },
});

const MoonBoardStub = defineComponent({
  name: 'MoonBoard',
  props: {model: {type: Object, default: undefined}, tileView: {type: String, default: ''}},
  render() {
    return h('i', {'class': 'moon-board-stub'});
  },
});

const TracksStub = defineComponent({
  name: 'PlanetaryTracks',
  props: {tracks: {type: Object, default: undefined}, gameOptions: {type: Object, default: undefined}},
  render() {
    return h('i', {'class': 'tracks-stub'});
  },
});

function viewOf(game: GameModel, tileView: TileView = 'show') {
  return mount(GameBoardView, {
    global: {
      ...globalConfig.global,
      stubs: {Board: BoardStub, Turmoil: TurmoilStub, MoonBoard: MoonBoardStub, PlanetaryTracks: TracksStub},
    },
    props: {game, tileView, players: [fakePublicPlayerModel()]},
  });
}

describe('GameBoardView', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameBoardView, {
      ...globalConfig,
      props: {
        game: fakeGameModel(),
        tileView: 'show',
        players: [],
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('renders the board for its props: the game goes down to it, and no board of an absent expansion stands', () => {
    const game = fakeGameModel({oceans: 3, oxygenLevel: 5, temperature: -20, venusScaleLevel: 8});
    const view = viewOf(game, 'coords');

    const board = view.findComponent(BoardStub);
    expect(board.exists(), '<board> is the import `Board`').to.eq(true);
    expect(board.attributes('id')).to.eq('shortkey-board');
    expect(board.props()).to.deep.include({
      boardName: game.gameOptions.boardName,
      venusScaleLevel: 8,
      oceans_count: 3,
      oxygen_level: 5,
      temperature: -20,
      tileView: 'coords',
    });
    expect(board.props('players')).to.have.length(1);

    expect(view.find('a.player_home_anchor').attributes('name')).to.eq('board');
    expect(view.findAll('a.hotkey-target'), 'the anchor of the board alone').to.have.length(1);
    expect(view.findComponent(TurmoilStub).exists()).to.eq(false);
    expect(view.findComponent(MoonBoardStub).exists()).to.eq(false);
    expect(view.findComponent(TracksStub).exists()).to.eq(false);
  });

  it('an expansion the game carries gets its board, behind an anchor of its own', () => {
    const gameOptions = fakeGameOptionsModel({expansions: {...DEFAULT_EXPANSIONS, pathfinders: true}});
    const game = fakeGameModel({
      gameOptions,
      turmoil: {chairman: 'red'},
      moon: {habitatRate: 2},
      pathfinders: {venus: 3},
    });
    const view = viewOf(game, 'hide');

    const turmoil = view.findComponent(TurmoilStub);
    expect(turmoil.exists(), '<turmoil> is the import `Turmoil`').to.eq(true);
    expect(turmoil.props('turmoil')).to.deep.eq({chairman: 'red'});

    const moon = view.findComponent(MoonBoardStub);
    expect(moon.props('model')).to.deep.eq({habitatRate: 2});
    expect(moon.props('tileView')).to.eq('hide');
    expect(moon.attributes('id')).to.eq('shortkey-moonBoard');

    const tracks = view.findComponent(TracksStub);
    expect(tracks.props('tracks')).to.deep.eq({venus: 3});
    expect(tracks.props('gameOptions')).to.deep.eq(gameOptions);

    expect(view.findAll('a.hotkey-target'), 'the anchor of the board and one per expansion').to.have.length(4);
  });

  it('the tile-view toggle of the board goes up as an event of the view', () => {
    const view = viewOf(fakeGameModel());
    expect(view.emitted('toggleTileView')).to.eq(undefined);

    view.findComponent(BoardStub).vm.$emit('toggleTileView');

    expect(view.emitted('toggleTileView')).to.have.length(1);
  });
});
