import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi, defaultCardActionsFilter} from '@/client/console/consoleCardActions';
import {consoleActionComposerUi, resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {enterConsoleRepeatPick, resetConsoleRepeatPick} from '@/client/console/consoleRepeatPick';
import {resetConsoleRepeatPickUi} from '@/client/console/consoleRepeatPickUi';
import {CardName} from '@/common/cards/CardName';

// Stub the gamepad glyphs — this spec is about the browse ⇄ focus flow.
const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const CARD = 'Regolith Eaters';

function playerView(): any {
  return {
    id: '', // '' → the preview/stats fetches are skipped under the test runner
    thisPlayer: {
      color: 'blue', name: 'Me',
      megacredits: 12, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0,
      tableau: [{name: CARD, resources: 2}],
      actionsThisGeneration: [],
    },
    players: [{color: 'blue', name: 'Me'}],
    game: {generation: 3},
    cardsInHand: [],
    waitingFor: {
      type: 'or',
      title: 'Take your next action',
      options: [{
        type: 'card',
        title: 'Perform an action from a played card',
        buttonLabel: 'Take action',
        cards: [{name: CARD}],
        min: 1, max: 1,
      }],
    },
  };
}

function factory() {
  return mount(ConsoleCardActions, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {playerView: playerView()},
    attachTo: document.body,
  });
}

async function settle(w: any): Promise<void> {
  await w.vm.$nextTick();
  await w.vm.$nextTick();
}

describe('ConsoleCardActions — the browse ⇄ ACTION FOCUS flow', () => {
  beforeEach(() => {
    consoleCardActionsUi.filter = defaultCardActionsFilter();
    consoleCardActionsUi.confirmOpen = false;
  });
  // Module state is bundle-shared under mochapack: a failed repeat-mode test
  // must never leave the bridge active for the rest of the suite.
  afterEach(() => {
    resetConsoleRepeatPick();
    resetConsoleRepeatPickUi();
  });

  it('BROWSE: the inspector anchors on the card THUMBNAIL (a physical zoom slot) with the tableau resource counter, the old graphic duplicate is gone', async () => {
    const w = factory();
    await settle(w);
    const thumb = w.find('.con-cardactions__detail-cardwrap');
    expect(thumb.exists()).to.eq(true);
    expect(thumb.attributes('data-zoom-slot')).to.eq(CARD);
    expect(thumb.attributes('data-action-flow-thumb')).to.not.eq(undefined);
    // The stored-resource counter rides the thumbnail in the SHARED tableau
    // chip language (con-played__res) — never a new visual pattern.
    expect(thumb.find('.con-played__res').text()).to.eq('2');
    expect(w.find('.con-cardactions__detail-graphic').exists()).to.eq(false);
    // No focus stage yet; the browse layer is live.
    expect(w.find('.con-composer--stage').exists()).to.eq(false);
    expect(w.find('.con-cardactions__browse--parked').exists()).to.eq(false);
    w.unmount();
  });

  it('A recomposes the SAME frame into ACTION FOCUS: the stage mounts INSIDE the stage wrap, the browse layer parks (filters/selection survive)', async () => {
    const w = factory();
    await settle(w);
    consoleCardActionsUi.filter.availability = 'available';
    const focusBefore = (w.vm as any).focusKey;
    (w.vm as any).activateFocused();
    await settle(w);
    // The stage is a CHILD of the frame's stage wrap — not a separate modal.
    expect(w.find('.con-cardactions__stagewrap .con-composer--stage').exists()).to.eq(true);
    // The browse layer stays MOUNTED (hidden) — scroll/selection/filter state
    // survives by construction; only its input is parked.
    const browse = w.find('.con-cardactions__browse');
    expect(browse.exists()).to.eq(true);
    expect(browse.classes()).to.contain('con-cardactions__browse--parked');
    // The header turns into the operation breadcrumb + names the card.
    expect(w.find('.con-cardactions__kicker-step').exists()).to.eq(true);
    expect(w.find('.con-cardactions__title').text()).to.contain(CARD);
    // The shell mirror flips (command bar routing).
    expect(consoleActionComposerUi.open).to.eq(true);
    expect(consoleCardActionsUi.confirmOpen).to.eq(true);
    // The filter the player set is untouched.
    expect(consoleCardActionsUi.filter.availability).to.eq('available');
    expect((w.vm as any).focusKey).to.eq(focusBefore);
    w.unmount();
  });

  it('the stage headline is the PHASE, fixed before the episode starts — it cannot change under the entering animation', async () => {
    const w = factory();
    await settle(w);
    resetConsoleActionComposerUi();
    const vm = w.vm as any;
    (vm as any).activateFocused();
    // SYNCHRONOUS: the value is already final — no nextTick, no store round
    // trip through the composer, nothing async to land later. (It used to be
    // derived from `hasDecisions`, which depends on the ASYNC action preview:
    // the title visibly swapped one or two frames into the entry.)
    expect(vm.focusKickerKey).to.eq('Action setup');
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Action setup');
    expect(w.find('.con-cardactions__kicker-step').text()).to.eq('Action setup');
    // The reveal phase — the ONE thing that renames the stage.
    vm.revealFlow = {};
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Reveal result');
    w.unmount();
  });

  it('the workspace SHELL survives the entry: the header keeps its filters mounted, and the flow state is explicit', async () => {
    const w = factory();
    await settle(w);
    expect((w.vm as any).flowState).to.eq('browse');
    // Both header layers exist in browse…
    expect(w.find('.con-cardactions__aux-layer--browse').exists()).to.eq(true);
    expect(w.find('.con-cardactions__filters').exists()).to.eq(true);
    (w.vm as any).activateFocused();
    await settle(w);
    // …and the filters are STILL mounted in the focus stage — they fade
    // inside a fixed zone, they are never removed (a v-if here reflowed the
    // header, which moved the whole stage region mid-transition).
    expect(w.find('.con-cardactions__filters').exists()).to.eq(true);
    expect(w.find('.con-cardactions__aux-layer--browse').classes()).to.contain('con-cardactions__aux-layer--out');
    expect(w.find('.con-cardactions__aux-layer--focus').classes()).to.not.contain('con-cardactions__aux-layer--out');
    // The stage carries the UNFOLD surface, and no action-graphic carry.
    expect(w.find('[data-unfold-surface]').exists()).to.eq(true);
    expect(w.find('[data-action-strip]').exists()).to.eq(false);
    w.unmount();
  });

  it('A is refused while the surface is still FOLDING back — no second stage over a leaving one', async () => {
    const w = factory();
    await settle(w);
    const vm = w.vm as any;
    vm.activateFocused();
    await settle(w);
    expect(vm.composer).to.not.eq(undefined);
    vm.handleIntent({kind: 'press', button: 'back'});
    await settle(w);
    // The draft is gone but the panel is still folding: A must not re-enter.
    vm.flowState = 'returning';
    vm.activateFocused();
    await settle(w);
    expect(vm.composer).to.eq(undefined);
    // Once the phrase finishes, A works again.
    vm.flowState = 'browse';
    vm.activateFocused();
    await settle(w);
    expect(vm.composer).to.not.eq(undefined);
    w.unmount();
  });

  it('B returns to BROWSE with everything restored (selection, filters, no legacy modal remnants)', async () => {
    const w = factory();
    await settle(w);
    consoleCardActionsUi.filter.activation = 'all';
    const focusBefore = (w.vm as any).focusKey;
    (w.vm as any).activateFocused();
    await settle(w);
    // B is routed through the stage (the parent forwards input while open).
    (w.vm as any).handleIntent({kind: 'press', button: 'back'});
    await settle(w);
    expect((w.vm as any).composer).to.eq(undefined);
    expect(consoleCardActionsUi.confirmOpen).to.eq(false);
    expect(w.find('.con-cardactions__browse--parked').exists()).to.eq(false);
    expect((w.vm as any).focusKey).to.eq(focusBefore);
    expect(consoleCardActionsUi.filter.activation).to.eq('all');
    // The browse header is back.
    expect(w.find('.con-cardactions__kicker-step').exists()).to.eq(false);
    w.unmount();
  });

  it('REPEAT «change» re-open pre-focuses the PRIOR chosen action; the breadcrumb honours the source label override', async () => {
    // Two action sources, both used this generation and both candidates —
    // without the prior the cursor would land on the FIRST tile.
    const view = playerView();
    view.thisPlayer.tableau = [{name: CARD, resources: 2}, {name: CardName.IRONWORKS}];
    view.thisPlayer.actionsThisGeneration = [CARD, CardName.IRONWORKS];
    enterConsoleRepeatPick({
      title: 'Use a blue card action that has already been used this generation',
      buttonLabel: 'Take action',
      candidates: [CardName.REGOLITH_EATERS, CardName.IRONWORKS],
      disabled: [],
      // A non-card source (the Hydronetwork) overrides the breadcrumb text.
      source: {kicker: 'Mars Hydronetwork', card: CardName.DELTA_PROJECT, label: 'Mars Hydronetwork'},
      prior: {chosenCard: CardName.IRONWORKS, nodeIndex: 0},
    }, () => { /* resolve unused — this is a render/focus test */ });
    const w = mount(ConsoleCardActions, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {playerView: view, repeat: true},
      attachTo: document.body,
    });
    await settle(w);
    expect((w.vm as any).focusKey).to.eq(CardName.IRONWORKS + '#0');
    expect((w.vm as any).focusedTile?.cardName).to.eq(CardName.IRONWORKS);
    // The source line never leaks the lore card name for a labelled source.
    expect(w.find('.con-cardactions__kicker-src').text()).to.eq('Mars Hydronetwork');
    w.unmount();
    resetConsoleRepeatPick();
    resetConsoleRepeatPickUi();
  });

  it('the player-context chip renders ONLY for a foreign entry (contextPlayer) — your own visit has no name tag', async () => {
    const w = factory();
    await settle(w);
    expect(w.find('.con-cardactions__player').exists()).to.eq(false);
    w.unmount();

    const w2 = mount(ConsoleCardActions, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {playerView: playerView(), contextPlayer: {color: 'red', name: 'Rival'} as any},
      attachTo: document.body,
    });
    await settle(w2);
    const chip = w2.find('.con-cardactions__player');
    expect(chip.exists()).to.eq(true);
    expect(chip.text()).to.contain('Rival');
    expect(chip.classes()).to.contain('player_bg_color_red');
    w2.unmount();
  });

  it('a filter change that removes the focused tile lands the cursor on the NEAREST surviving position, never back at the top', async () => {
    // Three action sources: two activatable now, one already used this
    // generation (visible only under «Активация: все»).
    const view = playerView();
    view.thisPlayer.tableau = [
      {name: CARD, resources: 2},
      {name: CardName.IRONWORKS},
      {name: CardName.STEELWORKS},
    ];
    view.thisPlayer.actionsThisGeneration = [CardName.STEELWORKS];
    const w = factory();
    await w.setProps({playerView: view});
    consoleCardActionsUi.filter.activation = 'all';
    await settle(w);
    const vm = w.vm as any;
    // Regolith Eaters is a two-variant («или») action → 2 tiles + 1 + 1.
    expect(vm.model.flatKeys.length).to.eq(4);
    // Focus the LAST tile (the activated one, sorted to the tail).
    vm.focusKey = CardName.STEELWORKS + '#0';
    await settle(w);
    // Hiding activated tiles removes the focused one — the cursor must land
    // on the nearest surviving position (the tile above), NOT the first.
    consoleCardActionsUi.filter.activation = 'dormant';
    await settle(w);
    expect(vm.model.flatKeys).to.deep.eq([CARD + '#0', CARD + '#1', CardName.IRONWORKS + '#0']);
    expect(vm.focusKey).to.eq(CardName.IRONWORKS + '#0');
    w.unmount();
  });

  it('repeated A never double-opens; A on an unavailable tile shakes instead of focusing', async () => {
    const w = factory();
    await settle(w);
    (w.vm as any).activateFocused();
    await settle(w);
    const draft = (w.vm as any).composer;
    // A second focus request while open routes INTO the stage — the draft
    // identity never re-arms (no re-mount, no double transition).
    (w.vm as any).activateFocused();
    await settle(w);
    expect((w.vm as any).composer).to.eq(draft);
    w.unmount();

    // Unavailable: strip the server's activatable set — A shakes, never opens.
    const view = playerView();
    view.waitingFor = undefined;
    const w2 = mount(ConsoleCardActions, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {playerView: view},
      attachTo: document.body,
    });
    await settle(w2);
    (w2.vm as any).activateFocused();
    await settle(w2);
    expect((w2.vm as any).composer).to.eq(undefined);
    expect(w2.find('.con-composer--stage').exists()).to.eq(false);
    w2.unmount();
  });
});
