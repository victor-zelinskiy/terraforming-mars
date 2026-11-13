import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {globalConfig} from './getLocalVue';
import GameHome from '@/client/components/GameHome.vue';
import {fakeGameOptionsModel} from './testHelpers';
import {Phase} from '@/common/Phase';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {gameDocumentTitle} from '@/client/utils/documentTitle';

/*
 * GameHome is a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its one prop
 * — a row per seat (the turn order, the colour square, the link), the page title — what it hands down to the purge
 * warning and the settings, and what its copy button does. It emits nothing and exposes nothing.
 *
 * Its three children are stubbed by name. The clipboard: jsdom has neither `navigator.clipboard` nor
 * `document.execCommand`, so VueUse's legacy road (the text selected in a textarea, then the `copy` command) is given
 * the command here — and that command is what records the copied text.
 */
const ButtonStub = defineComponent({
  name: 'AppButton',
  props: {title: {type: String, default: ''}, size: {type: String, default: ''}},
  emits: ['click'],
  render() {
    return h('button', {'class': 'copy-stub', 'onClick': () => this.$emit('click')}, this.title);
  },
});

const PurgeWarningStub = defineComponent({
  name: 'PurgeWarning',
  props: {expectedPurgeTimeMs: {type: Number, default: 0}},
  render() {
    return h('i', {'class': 'purge-warning-stub'});
  },
});

const SetupDetailStub = defineComponent({
  name: 'GameSetupDetail',
  props: {
    gameOptions: {type: Object, default: undefined},
    playerNumber: {type: Number, default: 0},
    lastSoloGeneration: {type: Number, default: 0},
  },
  render() {
    return h('i', {'class': 'setup-detail-stub'});
  },
});

function gameOf(): SimpleGameModel {
  return {
    activePlayer: 'blue',
    id: 'game-id-123',
    name: 'Friday night',
    phase: Phase.ACTION,
    players: [{color: 'blue', id: 'p-blue', name: 'Blue'}, {color: 'red', id: 'p-red', name: 'Red'}],
    spectatorId: undefined,
    gameOptions: fakeGameOptionsModel(),
    lastSoloGeneration: 14,
    expectedPurgeTimeMs: 1234,
  };
}

function homeOf(game: SimpleGameModel) {
  return mount(GameHome, {
    global: {
      ...globalConfig.global,
      stubs: {AppButton: ButtonStub, PurgeWarning: PurgeWarningStub, GameSetupDetail: SetupDetailStub},
    },
    props: {game},
  });
}

describe('GameHome', () => {
  let titleBefore = '';
  /** What the legacy clipboard road copied: the text standing in its textarea when the command ran. */
  let copied: Array<string> = [];
  beforeEach(() => {
    titleBefore = document.title;
    copied = [];
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (command: string): boolean => {
        copied.push(`${command} ${document.querySelector('textarea')?.value ?? ''}`);
        return true;
      },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
    document.title = titleBefore;
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(GameHome, {
      ...globalConfig,
      props: {
        game: {
          activePlayer: 'blue',
          id: 'game-id-123',
          phase: Phase.ACTION,
          players: [{color: 'blue', id: 'p-blue', name: 'Blue'}],
          spectatorId: undefined,
          gameOptions: fakeGameOptionsModel(),
          lastSoloGeneration: 14,
          expectedPurgeTimeMs: 0,
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('renders a row per seat — the turn order, the colour square, the link — and names the page after the game', () => {
    const game = gameOf();
    const home = homeOf(game);

    expect(document.title).to.eq(gameDocumentTitle(game));
    expect(home.find('h1').text()).to.include('game-id-123');

    const rows = home.findAll('li');
    expect(rows.map((row) => row.find('.turn-order').text())).to.deep.eq(['1st', '2nd']);
    expect(rows.map((row) => row.find('.player-name').text())).to.deep.eq(['Blue', 'Red']);
    expect(rows.map((row) => row.find('.player-name a').attributes('href'))).to.deep.eq(['player?id=p-blue', 'player?id=p-red']);
    expect(rows[0].find('.color-square').classes()).to.include('player_bg_color_blue');
    expect(rows[1].find('.color-square').classes()).to.include('player_bg_color_red');
    expect(home.findAllComponents(ButtonStub).map((button) => button.props('title'))).to.deep.eq(['copy', 'copy']);
    expect(home.findAll('.copied-notice'), 'nothing copied yet').to.have.length(0);
  });

  it('hands the game down: the purge time to the warning, the options and the seat count to the settings', () => {
    const game = gameOf();
    const home = homeOf(game);

    expect(home.findComponent(PurgeWarningStub).props('expectedPurgeTimeMs')).to.eq(1234);
    const settings = home.findComponent(SetupDetailStub);
    expect(settings.exists(), '<game-setup-detail> is the import `GameSetupDetail`').to.eq(true);
    expect(settings.props('playerNumber')).to.eq(2);
    expect(settings.props('lastSoloGeneration')).to.eq(14);
    expect(settings.props('gameOptions')).to.deep.eq(game.gameOptions);
  });

  it('the copy button copies the link of its seat and marks that row «Copied!» — one seat at a time', async () => {
    const home = homeOf(gameOf());
    const marked = () => home.findAll('li').map((row) => row.find('.copied-notice').exists());

    await home.findAll('.copy-stub')[1].trigger('click');
    expect(copied).to.have.length(1);
    expect(copied[0]).to.match(/^copy .*player\?id=p-red$/);
    expect(marked()).to.deep.eq([false, true]);
    expect(home.find('.copied-notice').text()).to.eq('Copied!');

    await home.findAll('.copy-stub')[0].trigger('click');
    expect(copied).to.have.length(2);
    expect(copied[1]).to.match(/^copy .*player\?id=p-blue$/);
    expect(marked()).to.deep.eq([true, false]);
  });
});
