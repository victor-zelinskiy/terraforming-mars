import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleExtrasExplorer from '@/client/components/console/ConsoleExtrasExplorer.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Color} from '@/common/Color';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardVictoryPointsDetail} from '@/common/game/VictoryPointsBreakdown';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {infoModeState} from '@/client/console/infoModeState';
import {extrasExplorerUi, resetExtrasExplorer} from '@/client/console/consoleExtrasExplorer';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';

/*
 * THE EXTRAS EXPLORER («Информация › Доп. ресурсы») AS ITS HOST HOLDS IT. `ConsoleExtrasExplorer` is `<script setup>`
 * (step A of docs/claude/vapor/RECIPES.md): ConsoleInfoMode's template ref of it is ONLY what it `defineExpose`s
 * (§ R11) — `handleIntent` (the pad while the extras route is up) and `selectType` (a press on the rail satellite's
 * cell). This spec is that contract and the surface's own life: the selection its immediate watcher seeds on the
 * shared cursors (`extrasExplorerUi` — the satellite paints the same ones), the bar it publishes there and takes
 * back, the seat switch that restarts the gallery, and the zoom origin that resolves a slot inside its own root (R12:
 * `this.$el` became the root's template ref). What the numbers MEAN is the pure model's (`extrasExplorerModel.spec`);
 * the geometry is the e2e probe's (`console-extras-explorer`).
 *
 * `globalConfig` turns every Vue warning into a throw, so each mount below is also «it mounts without a warning».
 */
const RED: Color = 'red';
const BLUE: Color = 'blue';

const BIRDS = {name: CardName.BIRDS, resources: 3} as CardModel;
const FISH = {name: CardName.FISH, resources: 0} as CardModel;
const TARDIGRADES = {name: CardName.TARDIGRADES, resources: 5} as CardModel;

/** The server's own per-card row of a linear «N resources → 1 VP» rule. */
function perRow(card: CardModel, vp: number, per: number, resourceType: string): CardVictoryPointsDetail {
  return {
    cardName: card.name, victoryPoint: vp, kind: 'resource',
    mechanics: {shape: 'per', each: 1, per, counted: card.resources ?? 0, unit: 'resources', resourceType},
  } as CardVictoryPointsDetail;
}

function seat(color: Color, name: string, tableau: ReadonlyArray<CardModel>, detailsCards: ReadonlyArray<CardVictoryPointsDetail>): PublicPlayerModel {
  return {
    color, name, tableau, steelValue: 2, titaniumValue: 3,
    victoryPointsBreakdown: {detailsCards},
  } as unknown as PublicPlayerModel;
}

/** Ada (the viewer) holds animals on two cards — one of them empty — and microbes on a third; Bo holds one animal card. */
function view(over: {redTableau?: ReadonlyArray<CardModel>} = {}): PlayerViewModel {
  const redTableau = over.redTableau ?? [BIRDS, FISH, TARDIGRADES];
  const red = seat(RED, 'Ada', redTableau, [perRow(BIRDS, 3, 1, 'Animal'), perRow(FISH, 0, 1, 'Animal'), perRow(TARDIGRADES, 1, 4, 'Microbe')]);
  const blue = seat(BLUE, 'Bo', [{name: CardName.FISH, resources: 2} as CardModel], [perRow({name: CardName.FISH, resources: 2} as CardModel, 2, 1, 'Animal')]);
  return {
    thisPlayer: red,
    players: [red, blue],
    game: {automa: undefined, gameOptions: {showOtherPlayersVP: false}},
  } as unknown as PlayerViewModel;
}

/** The premium face is not this spec's subject: a stand-in that says which live card it was handed. */
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object as PropType<CardModel>, required: true}, lightweight: {type: Boolean, default: false}},
  render() {
    return h('div', {'class': 'card-stub', 'data-card-face': this.card.name});
  },
});

const stubs = {Card: CardStub};

function mountExplorer(playerView: PlayerViewModel = view()) {
  return mount(ConsoleExtrasExplorer, {global: {...globalConfig.global, stubs}, props: {playerView}});
}

/** What a host's ref of the explorer carries. */
type ExplorerReach = {handleIntent(intent: GamepadIntent): void, selectType(key: string, index: number): void};

/** The explorer under a PARENT that holds a ref to it — what that ref carries is what ConsoleInfoMode's does. */
function underParent() {
  const held = shallowRef<ExplorerReach | null>(null);
  const playerView = view();
  const Parent = defineComponent({
    name: 'ExtrasExplorerParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleExtrasExplorer as never, {playerView, ref: held})]),
  });
  return {wrapper: mount(Parent, {global: {...globalConfig.global, stubs}}), held};
}

/** The published bar, by its labels (English i18n keys). */
const bar = (): Array<string> => (extrasExplorerUi.barCommands ?? []).map((c) => c.label);
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};

describe('ConsoleExtrasExplorer — the surface\'s own life, and what a parent reaches through its ref', () => {
  let seatBefore: Color | undefined;
  let translationsBefore: unknown;

  beforeEach(() => {
    seatBefore = infoModeState.playerColor;
    translationsBefore = (window as any)._translations;
    (window as any)._translations = {};
    infoModeState.playerColor = RED;
    resetExtrasExplorer();
  });

  afterEach(() => {
    // The cursors, the seat and the viewer are BUNDLE-SHARED module state — handed back as they stood.
    closeConsoleCardZoom();
    resetExtrasExplorer();
    infoModeState.playerColor = seatBefore;
    (window as any)._translations = translationsBefore;
  });

  it('mounts over a tableau with NO holders: the honest empty room, nothing selected, its bar published — and taken back on unmount', () => {
    const w = mountExplorer(view({redTableau: []}));
    expect(w.classes()).to.contain('con-exr');
    expect(w.classes(), 'a human seat').to.not.contain('con-exr--bot');
    expect(w.find('.con-exr__void-title').text()).to.eq('No cards that can hold resources');
    expect(w.find('.con-exr__body').exists(), 'no type, no body').to.eq(false);
    expect(extrasExplorerUi.typeKey).to.eq(undefined);
    expect(bar(), 'no «Select» over an empty column').to.deep.eq(['Players', 'To overview', 'Close']);
    w.unmount();
    expect(extrasExplorerUi.barCommands, 'the bar is the host\'s again').to.eq(undefined);
  });

  it('seeds the FIRST type before the first render: its hero, its holders — the empty one included — and the focused card\'s story', () => {
    const w = mountExplorer();
    const hero = w.find('[data-exr-hero]');
    expect(extrasExplorerUi.typeKey, 'the immediate watcher seeded the shared cursor').to.eq(hero.attributes('data-exr-hero'));
    expect(extrasExplorerUi).to.deep.include({typeCursor: 0, cardCursor: 0, zone: 'types'});
    expect(hero.find('.con-exr__hero-name').text(), 'a category names the family').to.eq('Animals');
    expect(hero.find('.con-exr__hero-total').text(), 'the sum over the holders').to.eq('3');
    expect(hero.find('.con-exr__hero-sub').text()).to.eq('Holders: 2');
    expect(hero.find('.con-exr__chip--vp').text(), 'the server\'s rows, summed').to.eq('VP from resources: +3');

    const slots = w.findAll('[data-exr-card]');
    expect(slots.map((s) => s.attributes('data-exr-card')), 'tableau order, the zero holder included').to.deep.eq([CardName.BIRDS, CardName.FISH]);
    expect(slots.map((s) => s.attributes('data-zoom-slot')), 'each slot is the viewer\'s physical origin').to.deep.eq([CardName.BIRDS, CardName.FISH]);
    expect(slots.map((s) => s.classes().includes('con-exr__slot--zero')), 'the quiet pose is ink, never absence').to.deep.eq([false, true]);
    expect(slots.map((s) => s.find('.card-stub').attributes('data-card-face')), 'the face gets the LIVE tableau card').to.deep.eq([CardName.BIRDS, CardName.FISH]);
    expect(w.findAllComponents(CardStub).map((c) => c.props('lightweight'))).to.deep.eq([true, true]);
    expect(w.find('.con-exr__slot--focused').exists(), 'the cursor stands on the type column').to.eq(false);
    expect(w.find('.con-exr__pager').exists(), 'one page — no pager').to.eq(false);

    expect(w.find('.con-exr__detail-name').text()).to.eq(CardName.BIRDS);
    expect(w.find('.con-exr__detail-now').text()).to.eq('Now: +3 VP');
    expect(bar(), '«Select» over the column').to.deep.eq(['Players', 'Select', 'To overview', 'Close']);
  });

  it('a PARENT\'s ref sees `handleIntent` and `selectType` — and nothing else', () => {
    const {held} = underParent();
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value ?? {}), 'exactly what the explorer exposes').to.deep.eq(['handleIntent', 'selectType']);
    // Neither a prop nor the explorer's own state is reachable through the ref.
    const leaked = ['playerView', 'ui', 'viewport', 'root', 'types', 'selected', 'lastTypeIndex', 'lastPage', 'normalizeSelection', 'onInspect', 'slotPressed']
      .filter((name) => (held.value as unknown as Record<string, unknown>)[name] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('through the ref: ↓ + A selects the next type, → walks into its gallery, and `selectType` (the satellite\'s press) brings the first one back', async () => {
    const {wrapper, held} = underParent();
    const reach = held.value as ExplorerReach;
    const first = extrasExplorerUi.typeKey as string;

    reach.handleIntent(nav('down'));
    expect(extrasExplorerUi.typeCursor, 'the cursor moved; the selection waits for A').to.eq(1);
    expect(extrasExplorerUi.typeKey).to.eq(first);
    reach.handleIntent(A);
    await nextTick();
    const second = extrasExplorerUi.typeKey as string;
    expect(second, 'another type').to.not.eq(first);
    expect(wrapper.find('[data-exr-hero]').attributes('data-exr-hero')).to.eq(second);
    expect(wrapper.find('.con-exr__hero-name').text()).to.eq('Microbes');
    expect(wrapper.findAll('[data-exr-card]').map((s) => s.attributes('data-exr-card'))).to.deep.eq([CardName.TARDIGRADES]);
    expect(wrapper.find('.con-exr__detail-next').text(), 'five of the four-per-point rule: three short of the next').to.eq('3 toward the next VP');

    reach.handleIntent(nav('right'));
    await nextTick();
    expect(extrasExplorerUi.zone).to.eq('cards');
    expect(wrapper.find('.con-exr__slot--focused').attributes('data-exr-card')).to.eq(CardName.TARDIGRADES);
    expect(bar(), '«Inspect» over the gallery').to.deep.eq(['Players', 'Inspect', 'To overview', 'Close']);

    reach.selectType(first, 0);
    await nextTick();
    expect(extrasExplorerUi).to.deep.include({typeKey: first, typeCursor: 0, cardCursor: 0, zone: 'types'});
    expect(wrapper.find('.con-exr__hero-name').text()).to.eq('Animals');
    expect(bar()).to.deep.eq(['Players', 'Select', 'To overview', 'Close']);
  });

  it('a SEAT SWITCH restarts the gallery and lands on a type the new seat has; a rival\'s score stays hidden', async () => {
    const w = mountExplorer();
    // Stand deep in Ada's second type first.
    (w.vm as unknown as ExplorerReach).handleIntent(nav('down'));
    (w.vm as unknown as ExplorerReach).handleIntent(A);
    (w.vm as unknown as ExplorerReach).handleIntent(nav('right'));
    await nextTick();
    expect(w.find('.con-exr__hero-name').text()).to.eq('Microbes');
    expect(extrasExplorerUi.zone).to.eq('cards');

    infoModeState.playerColor = BLUE;
    await nextTick();
    expect(w.find('.con-exr__hero-name').text(), 'Bo has no microbes — the first type he has').to.eq('Animals');
    expect(w.find('.con-exr__hero-total').text()).to.eq('2');
    expect(extrasExplorerUi).to.deep.include({typeCursor: 0, cardCursor: 0, zone: 'types'});
    expect(extrasExplorerUi.typeKey).to.eq(w.find('[data-exr-hero]').attributes('data-exr-hero'));
    expect(w.findAll('[data-exr-card]').map((s) => s.attributes('data-exr-card'))).to.deep.eq([CardName.FISH]);
    expect(w.find('.con-exr__chip--vp').exists(), 'no number of a rival\'s hidden score').to.eq(false);
    expect(w.find('.con-exr__chip--hidden').text()).to.eq('Score is hidden until the end of the game');
  });

  it('X in the gallery opens the ONE zoom inspector on the focused card — its origin resolves the slot inside the explorer\'s own root', async () => {
    const w = mountExplorer();
    const reach = w.vm as unknown as ExplorerReach;
    reach.handleIntent(nav('right'));
    reach.handleIntent(nav('right'));
    await nextTick();
    expect(w.find('.con-exr__slot--focused').attributes('data-exr-card')).to.eq(CardName.FISH);

    reach.handleIntent(X);
    expect(consoleCardZoom.card?.name).to.eq(CardName.FISH);
    expect(consoleCardZoom.cards.map((c) => c.name), 'the viewer browses the type\'s own list').to.deep.eq([CardName.BIRDS, CardName.FISH]);
    expect(consoleCardZoom.contextLabel).to.eq('Extra resources');
    const origin = consoleCardZoom.origin;
    expect(origin.kind).to.eq('physical');
    if (origin.kind === 'physical') {
      expect(origin.resolve).to.not.equal(undefined);
      const resolve = origin.resolve!;
      expect(resolve(1), 'the root\'s template ref stands in for the instance\'s element').to.eq(w.find('[data-zoom-slot="Fish"]').element);
      expect(resolve(0)).to.eq(w.find('[data-zoom-slot="Birds"]').element);
      // The viewer's LB/RB walks THIS list: the cursor follows, so B lands on the card being read.
      origin.onBrowse?.(0);
      expect(extrasExplorerUi.cardCursor).to.eq(0);
    }
  });
});
