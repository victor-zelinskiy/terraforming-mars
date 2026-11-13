/*
 * ConsoleLobbyCard — ONE card of the pregame showcase («Мои партии» / «Мои кампании»): a game or a campaign shown as
 * an object — its board miniature, its name, one state chip, the crew, the expansions, its age. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): the view is the pure `lobbyCardModel`'s and arrives as a prop,
 * a press / a pointer move goes UP as `activate` / `hover`. It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {BoardName} from '@/common/boards/BoardName';
import {LobbyCardView} from '@/client/console/menu/lobbyCardModel';
import {mapLabelKey, mapMeta} from '@/client/components/create/premium/createGameMeta';
import {expansionIconUrl, expansionLabel} from '@/client/components/mainMenu/expansionMeta';
import ConsoleLobbyCard from '@/client/components/console/menu/ConsoleLobbyCard.vue';

// The board miniature is its own subject (an SVG of the real layout); here it is a mark that carries what the card
// asks of it. (A render function, not a template string: the runtime compiler is not in this build.)
const MapStub = defineComponent({
  name: 'PremiumMapFingerprint',
  props: {mapId: String, variant: String, accent: String, reveal: Boolean, revealDelayMs: Number},
  render: () => h('i', {class: 'map-stub'}),
});

const view = (over: Partial<LobbyCardView> = {}): LobbyCardView => ({
  kind: 'game',
  key: 'g-friday',
  name: 'Friday night',
  board: BoardName.HELLAS,
  state: {key: 'Your turn', tone: 'turn'},
  generation: 4,
  createdTimeMs: 0,
  crew: [
    {name: 'Ada', color: 'red', isYou: true, isActive: true, champion: false},
    {name: 'Bo', color: 'blue', isYou: false, isActive: false, champion: false},
  ],
  expansions: ['prelude', 'venus'],
  isNew: false,
  enterable: true,
  archived: false,
  ...over,
});

function card(props: {view: LobbyCardView, cursor?: boolean, age?: string, reveal?: boolean, revealDelayMs?: number}) {
  return mount(ConsoleLobbyCard, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {PremiumMapFingerprint: MapStub}},
  });
}

describe('ConsoleLobbyCard — one card of the pregame showcase', () => {
  it('a GAME: its board, its name, the state chip by tone, the generation, the crew with whose turn it is, the expansions and the age', () => {
    const w = card({view: view(), age: '5 min ago', reveal: true, revealDelayMs: 120});
    expect(w.element.tagName).to.eq('BUTTON');
    expect(w.classes()).to.include.members(['cm-lcard', 'cm-game']);
    expect(w.attributes('data-lobby-card')).to.eq('game');
    expect(w.attributes('data-lobby-tone')).to.eq('turn');
    for (const off of ['cm-lcard--cursor', 'cm-game--cursor', 'cm-lcard--campaign', 'cm-camp', 'cm-lcard--archived', 'cm-lcard--refused', 'cm-game--disabled', 'cm-game--lan']) {
      expect(w.classes(), off).to.not.include(off);
    }

    const hellas = mapMeta(BoardName.HELLAS);
    const board = w.findComponent(MapStub);
    expect(board.props('mapId')).to.eq(BoardName.HELLAS);
    expect(board.props('variant')).to.eq('card');
    expect(board.props('accent')).to.eq(hellas.accent);
    expect(board.props('reveal')).to.eq(true);
    expect(board.props('revealDelayMs')).to.eq(120);

    expect(w.find('.cm-lcard__kicker').exists(), 'a plain game has no kicker').to.eq(false);
    expect(w.find('.cm-lcard__name.cm-game__name').text()).to.eq('Friday night');
    const state = w.find('[data-lobby-state]');
    expect(state.classes()).to.include('cm-lcard__state--turn');
    expect(state.text()).to.eq($t('Your turn'));
    expect(w.find('.cm-lcard__new').exists() || w.find('.cm-lcard__host').exists() || w.find('.cm-lcard__note').exists()).to.eq(false);
    expect(w.find('.cm-lcard__route').exists(), 'the route is a campaign\'s').to.eq(false);

    expect(w.find('.cm-lcard__gen').text()).to.eq(`${$t('Generation')} 4`);
    expect(w.find('.cm-lcard__board').text()).to.eq($t(mapLabelKey(BoardName.HELLAS)));
    expect(w.find('.cm-lcard__tp').exists()).to.eq(false);

    const crew = w.findAll('.cm-lcard__crew > .cm-lcard__member');
    expect(crew.map((member) => member.find('.cm-lcard__pname').text())).to.deep.eq(['Ada', 'Bo']);
    expect(crew.map((member) => member.classes().includes('cm-game__player--you'))).to.deep.eq([true, false]);
    expect(crew.map((member) => member.classes().includes('cm-game__player--active'))).to.deep.eq([true, false]);
    expect(crew.map((member) => member.find('.cm-game__pturn').exists())).to.deep.eq([true, false]);
    expect(crew.map((member) => member.find('.cm-lcard__cube').classes().find((c) => c.startsWith('player_bg_color_')))).to.deep.eq(
      ['player_bg_color_red', 'player_bg_color_blue']);
    expect(crew[0].find('.cm-lcard__you').text()).to.eq($t('You'));
    expect(w.find('.cm-lcard__crown').exists()).to.eq(false);

    expect(w.find('.cm-lcard__age').text()).to.eq('5 min ago');
    const icons = w.findAll('.cm-lcard__exp img');
    expect(icons.map((icon) => icon.attributes('src'))).to.deep.eq([expansionIconUrl('prelude'), expansionIconUrl('venus')]);
    expect(icons.map((icon) => icon.attributes('alt'))).to.deep.eq([$t(expansionLabel('prelude')), $t(expansionLabel('venus'))]);
    expect(w.find('.cm-lcard__exp-more').exists()).to.eq(false);
  });

  it('a CAMPAIGN that cannot be entered: the kicker and the chip read their params, the route node by node, the note, the points — and every state class', () => {
    const w = card({
      view: view({
        kind: 'campaign',
        name: 'The long road',
        kicker: [{key: 'Campaign'}, {key: 'Mission ${0} of ${1}', params: ['2', '4']}],
        state: {key: 'Turn: ${0}', params: ['Bo'], tone: 'wait'},
        generation: undefined,
        crew: [{name: 'Ada', color: 'red', isYou: true, isActive: false, champion: true}],
        expansions: [],
        isNew: true,
        hostLabel: 'Couch',
        progress: ['done', 'current', 'future', 'future'],
        note: {key: 'A mission game is missing'},
        titlePoints: 3,
        enterable: false,
        archived: true,
      }),
    });
    expect(w.attributes('data-lobby-card')).to.eq('campaign');
    expect(w.attributes('data-lobby-tone')).to.eq('wait');
    expect(w.classes()).to.include.members([
      'cm-lcard--campaign', 'cm-camp', 'cm-camp--archived', 'cm-lcard--archived', 'cm-lcard--refused', 'cm-game--disabled', 'cm-game--lan',
    ]);

    const kicker = w.find('.cm-lcard__kicker');
    expect(kicker.text()).to.eq(`${$t('Campaign')} · ${translateTextWithParams('Mission ${0} of ${1}', ['2', '4'])}`);
    expect(kicker.classes(), 'the game hook rides a game\'s kicker only').to.not.include('cm-game__campaign');
    const state = w.find('[data-lobby-state]');
    expect(state.classes()).to.include('cm-lcard__state--wait');
    expect(state.text()).to.eq(translateTextWithParams('Turn: ${0}', ['Bo']));
    expect(w.find('.cm-lcard__new').text()).to.eq($t('New'));
    expect(w.find('.cm-lcard__host').text()).to.eq('Couch');
    expect(w.find('.cm-lcard__note').text()).to.eq($t('A mission game is missing'));

    const nodes = w.findAll('.cm-lcard__route > .cm-lcard__node');
    expect(nodes.map((node) => node.find('.cm-lcard__node-num').text())).to.deep.eq(['1', '2', '3', '4']);
    expect(nodes.map((node) => node.classes().find((c) => c.startsWith('cm-lcard__node--')))).to.deep.eq(
      ['cm-lcard__node--done', 'cm-lcard__node--current', 'cm-lcard__node--future', 'cm-lcard__node--future']);
    expect(nodes.map((node) => node.classes().find((c) => c.startsWith('cm-camp__seg--')))).to.deep.eq(
      ['cm-camp__seg--done', 'cm-camp__seg--current', 'cm-camp__seg--future', 'cm-camp__seg--future']);

    expect(w.find('.cm-lcard__gen').exists(), 'a campaign names no generation').to.eq(false);
    expect(w.find('.cm-lcard__tp').text()).to.eq(translateTextWithParams('Title Points: ${0}', ['3']));
    expect(w.find('.cm-lcard__crown').exists(), 'a champion wears the crown').to.eq(true);
    expect(w.find('.cm-lcard__exp').exists(), 'no expansions — no strip').to.eq(false);
    expect(w.find('.cm-lcard__age').text(), 'the default age is empty').to.eq('');
  });

  it('it FOLLOWS its props: the cursor is two classes, a tenth expansion folds into «+N», a new board re-points the miniature', async () => {
    const w = card({view: view()});
    expect(w.findComponent(MapStub).props('reveal')).to.eq(false);
    expect(w.findComponent(MapStub).props('revealDelayMs')).to.eq(0);
    await w.setProps({
      cursor: true,
      view: view({
        board: BoardName.THARSIS,
        expansions: ['corpera', 'promo', 'venus', 'colonies', 'prelude', 'prelude2', 'turmoil', 'community', 'ares', 'moon'],
      }),
    });
    expect(w.classes()).to.include.members(['cm-lcard--cursor', 'cm-game--cursor']);
    const board = w.findComponent(MapStub);
    expect(board.props('mapId')).to.eq(BoardName.THARSIS);
    expect(board.props('accent')).to.eq(mapMeta(BoardName.THARSIS).accent);
    expect(w.find('.cm-lcard__board').text()).to.eq($t(mapLabelKey(BoardName.THARSIS)));
    expect(w.findAll('.cm-lcard__exp img')).to.have.length(9);
    expect(w.find('.cm-lcard__exp-more').text()).to.eq('+1');
  });

  it('a click ACTIVATES the card and a pointer move HOVERS it', async () => {
    const w = card({view: view()});
    await w.trigger('mousemove');
    await w.trigger('click');
    await w.trigger('click');
    expect(w.emitted('hover')).to.have.length(1);
    expect(w.emitted('activate')).to.have.length(2);
  });
});
