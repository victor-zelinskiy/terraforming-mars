/*
 * ConsoleInfoActionGallery — «Информация › Действия» in depth (TR60): the seat's action cards as the «Действия карт»
 * tiles, hosted READ-ONLY on strict pages, a cursor over the cards, a legend of states. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md). `ConsoleInfoMode` stands it under `ref="actionsView"` and forwards the
 * pad's intents to `handleIntent` THROUGH THAT REF — so it is mounted here the way the workspace mounts it, under a
 * host with a string ref, and the spec reads what that ref carries. The tile itself (`ConsoleActionGroupView`) is its
 * own subject: stubbed by name, the stub keeps the props the gallery hands it.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {ConsoleActionGroup} from '@/client/console/consoleCardActions';
import {infoActionsUi, resetInfoActions} from '@/client/console/infoActionsUi';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import ConsoleInfoActionGallery from '@/client/components/console/info/ConsoleInfoActionGallery.vue';

/** What the Information workspace reads through its ref — the component's whole contract with its parent. */
type GalleryReach = {handleIntent(intent: GamepadIntent): void};

// (A render function, not a template string: the runtime compiler is not in this build.)
const GroupStub = defineComponent({
  name: 'ConsoleActionGroupView',
  props: {
    group: {type: Object as PropType<ConsoleActionGroup>, required: true},
    readonly: {type: Boolean, default: false},
  },
  render: () => h('i', {class: 'group-stub'}),
});

const ACTION_CARDS = [CardName.AI_CENTRAL, CardName.BIRDS, CardName.DEVELOPMENT_CENTER];

/** ANOTHER seat's table: only what is public is read — used this generation, or nothing. */
function seat(names: ReadonlyArray<CardName>, used: ReadonlyArray<CardName> = []): PublicPlayerModel {
  return {color: 'red', name: 'Bruno', tableau: names.map((name) => ({name} as CardModel)), actionsThisGeneration: used} as unknown as PublicPlayerModel;
}
const VIEW = {game: {parliament: undefined}, thisPlayer: {color: 'blue'}, waitingFor: undefined} as unknown as PlayerViewModel;

function mountUnderHost(player: PublicPlayerModel) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleInfoActionGallery, {ref: 'actionsView', playerView: VIEW, player, isSelf: false})]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {ConsoleActionGroupView: GroupStub}}});
  return {
    wrapper,
    /** Exactly the workspace's read: `(this.$refs.actionsView ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): GalleryReach => {
      const gallery = (wrapper.vm.$refs.actionsView ?? undefined) as GalleryReach | undefined;
      if (gallery === undefined) {
        throw new Error('the host holds no ref to the gallery');
      }
      return gallery;
    },
    focused: () => wrapper.findAll('.con-dgal__tile').map((tile) => tile.classes().includes('con-dgal__tile--focused')),
  };
}

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

describe('ConsoleInfoActionGallery — the seat\'s actions in depth', () => {
  let savedProfile: typeof consoleLayoutState.profile;

  beforeEach(() => {
    savedProfile = consoleLayoutState.profile;
    consoleLayoutState.profile = 'standard';
    resetInfoActions();
  });

  afterEach(() => {
    consoleLayoutState.profile = savedProfile;
    resetInfoActions();
    closeConsoleCardZoom();
  });

  it('a tile per action card on ONE page — the group view hosted READ-ONLY, the cursor on the first, the legend counting the states', () => {
    const {wrapper, focused} = mountUnderHost(seat(ACTION_CARDS, [CardName.BIRDS]));
    const root = wrapper.find('.con-dgal');
    expect(root.attributes('data-dossier-gallery')).to.eq('3');
    // Three single tiles on a three-column grid: one row of a scene, centred and larger — never a corner of a grid.
    expect(root.classes()).to.contain('con-dgal--sparse');
    const style = (root.element as HTMLElement).style;
    expect([style.getPropertyValue('--dgal-cols'), style.getPropertyValue('--dgal-rows'), style.getPropertyValue('--dgal-zoom')]).to.deep.eq(['3', '3', '1.4']);

    const groups = wrapper.findAllComponents(GroupStub);
    expect(groups.map((group) => group.props('group').cardName).sort(), 'every action card of the table, once').to.deep.eq([...ACTION_CARDS].sort());
    expect(groups.map((group) => group.props('readonly')), 'nothing here submits').to.deep.eq([true, true, true]);
    const tiles = wrapper.findAll('.con-dgal__page > .con-dgal__tile');
    expect(tiles.map((tile) => tile.attributes('data-zoom-slot')), 'a tile is the zoom slot of the card it shows').to.deep.eq(groups.map((group) => group.props('group').cardName));
    expect(tiles.map((tile) => tile.attributes('data-dgal-index'))).to.deep.eq(['0', '1', '2']);
    expect(focused()).to.deep.eq([true, false, false]);
    expect(wrapper.find('[data-dossier-empty]').exists()).to.eq(false);

    // The legend: only the states that exist, in reading order — the shape, the count, the word.
    const counts = wrapper.findAll('.con-dgal__legend [data-action-count]');
    expect(counts.map((c) => [c.attributes('data-action-count'), c.find('.con-dacts__countmark').text(), c.find('b').text(), c.find('span:last-child').text()])).to.deep.eq([
      ['idle', '○', '2', $t('Not used yet')],
      ['used', '✓', '1', $t('Used this generation')],
    ]);
    expect(wrapper.find('[data-dgal-pager]').exists(), 'one page — no pager').to.eq(false);

    // The bar for this screen is published while the zone stands — and taken back when it leaves.
    expect(infoActionsUi.barCommands?.map((command) => command.label)).to.deep.eq(['Players', 'Inspect', 'To overview', 'Close']);
    wrapper.unmount();
    expect(infoActionsUi.barCommands).to.eq(undefined);
  });

  it('no action cards: a composed empty state and one line — no page, no legend, no «Inspect» on the bar', () => {
    const {wrapper} = mountUnderHost(seat([]));
    expect(wrapper.find('.con-dgal').attributes('data-dossier-gallery')).to.eq('0');
    expect(wrapper.find('.con-dgal__page').exists()).to.eq(false);
    expect(wrapper.find('[data-dossier-empty="actions-zone"] .con-dgal__voidline').text()).to.eq($t('No action cards on the table'));
    expect(wrapper.find('.con-dgal__legend').exists()).to.eq(false);
    expect(infoActionsUi.barCommands?.map((command) => command.label)).to.deep.eq(['Players', 'To overview', 'Close']);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else; the pad THROUGH THE REF walks the cursor and stops at the ends', async () => {
    const {reach, focused} = mountUnderHost(seat(ACTION_CARDS));
    const gallery = reach();
    expect(Object.keys(gallery), 'exactly what the gallery exposes').to.deep.eq(['handleIntent']);
    expect(gallery.handleIntent).to.be.a('function');
    const leaked = ['groups', 'cursor', 'page', 'fit', 'publish', 'inspect', 'zoomName', 'ui', 'root']
      .filter((key) => (gallery as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    gallery.handleIntent(nav('right'));
    await nextTick();
    expect(infoActionsUi.cursor, 'the cursor is the zone\'s module state').to.eq(1);
    expect(focused()).to.deep.eq([false, true, false]);
    gallery.handleIntent(nav('right'));
    gallery.handleIntent(nav('right'));
    await nextTick();
    expect(focused(), 'the last card is a wall, never a wrap').to.deep.eq([false, false, true]);
    gallery.handleIntent(nav('down'));
    await nextTick();
    expect(focused(), 'no row below a one-row page').to.deep.eq([false, false, true]);
    gallery.handleIntent(nav('left'));
    gallery.handleIntent(nav('left'));
    gallery.handleIntent(nav('left'));
    await nextTick();
    expect(focused(), 'and so is the first').to.deep.eq([true, false, false]);
  });

  it('X opens the focused card in the ONE zoom viewer — its origin is the card\'s own tile, a browse there moves the cursor', async () => {
    const {wrapper, reach} = mountUnderHost(seat(ACTION_CARDS));
    reach().handleIntent(nav('right'));
    await nextTick();
    const shown = wrapper.findAllComponents(GroupStub).map((group) => group.props('group').cardName);
    reach().handleIntent({kind: 'press', button: 'secondary'});
    expect(consoleCardZoom.card?.name, 'the card under the cursor').to.eq(shown[1]);
    expect(consoleCardZoom.cards.map((card) => card.name), 'the list is what is on screen').to.deep.eq(shown);
    expect(consoleCardZoom.contextLabel).to.eq('Actions');

    const origin = consoleCardZoom.origin;
    expect(origin.kind, 'the viewer opens from a physical slot').to.eq('physical');
    const tiles = wrapper.findAll('.con-dgal__tile');
    expect(origin.resolve?.(1), 'resolved live, inside the gallery\'s own root').to.eq(tiles[1].element);
    expect(origin.resolve?.(7), 'a card that is not on the table has no slot').to.eq(null);
    origin.onBrowse?.(2);
    await nextTick();
    expect(infoActionsUi.cursor, 'the viewer walked to the third card — the cursor follows it').to.eq(2);
  });
});
