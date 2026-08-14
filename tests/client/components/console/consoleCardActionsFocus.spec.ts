import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi, defaultCardActionsFilter} from '@/client/console/consoleCardActions';
import {consoleActionComposerUi, resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {enterConsoleRepeatPick, resetConsoleRepeatPick} from '@/client/console/consoleRepeatPick';
import {resetConsoleRepeatPickUi} from '@/client/console/consoleRepeatPickUi';
import {resetWorkspaceOutcome, setWorkspaceOutcomePhase} from '@/client/console/consoleWorkspaceOutcome';
import {actionPreviewStore, resetActionPreviews} from '@/client/console/actionPreviewStore';
import {resetActionCommit} from '@/client/console/consoleActionCommit';
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
    // The stored-resource counter is the CARD'S OWN capsule (bottom-left,
    // beside the expansion stamp) — one anchor the premium language already
    // reserved, fed by passing the live model down. The gold disc it replaced
    // floated beside the face and named no resource at all.
    const chip = thumb.find('.pcard__res');
    expect(chip.exists(), 'the thumbnail wears the card\'s own capsule').to.eq(true);
    expect(chip.find('.pcard__res-count').text()).to.eq('2');
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
    expect(w.find('.con-wshead__step').exists()).to.eq(true);
    expect(w.find('.con-wshead__subject').text()).to.contain(CARD);
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
    expect(vm.focusKickerKey).to.eq('Setup');
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Setup');
    expect(w.find('.con-wshead__step').text()).to.eq('Setup');
    // The OUTCOME phases — the only things that rename the stage, and each
    // names itself: a deck-check is a «результат вскрытия», a draw is not.
    vm.outcomeFlow = {kind: 'deck-check'};
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Reveal result');
    vm.outcomeFlow = {kind: 'draw'};
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Card draw');
    w.unmount();
  });

  it('an EMBEDDED surface names the stage in the WORKSPACE breadcrumb — the card name never restarts', async () => {
    const w = factory();
    await settle(w);
    resetConsoleActionComposerUi();
    resetWorkspaceOutcome();
    const vm = w.vm as any;
    vm.activateFocused();
    await settle(w);
    const cardName = vm.composer.cardName;

    // The outcome opens; nothing has been re-homed yet → the honest generic.
    vm.outcomeFlow = {kind: 'pending'};
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Card draw');

    // The embedded surface hands its stage name UP (this is what ConsoleTaskHost
    // does instead of drawing its own «◈ ПОКУПКА»): the breadcrumb takes it.
    setWorkspaceOutcomePhase('Buying');
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Buying');
    expect(w.find('.con-wshead__step').text()).to.eq('Buying');
    // …and the CARD is still named, on the same line, unchanged. This is the
    // whole point: only the middle step advanced.
    expect(w.find('.con-wshead__subject').text()).to.eq(cardName);

    // Retracting it falls back to the generic, never to a blank crumb.
    setWorkspaceOutcomePhase('');
    await settle(w);
    expect(vm.focusKickerKey).to.eq('Card draw');
    resetWorkspaceOutcome();
    w.unmount();
  });

  it('the workspace SHELL survives the entry: the header keeps its filters mounted, and the flow state is explicit', async () => {
    const w = factory();
    await settle(w);
    expect((w.vm as any).flowState).to.eq('browse');
    // Both header layers exist in browse…
    expect(w.find('.con-wshead__layer--browse').exists()).to.eq(true);
    expect(w.find('.con-cardactions__filters').exists()).to.eq(true);
    (w.vm as any).activateFocused();
    await settle(w);
    // …and the filters are STILL mounted in the focus stage — they fade
    // inside a fixed zone, they are never removed (a v-if here reflowed the
    // header, which moved the whole stage region mid-transition).
    expect(w.find('.con-cardactions__filters').exists()).to.eq(true);
    expect(w.find('.con-wshead__layer--browse').classes()).to.contain('con-wshead__layer--out');
    expect(w.find('.con-wshead__layer--deep').classes()).to.not.contain('con-wshead__layer--out');
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
    expect(w.find('.con-wshead__step').exists()).to.eq(false);
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
    // The source line never leaks the lore card name for a labelled source: the
    // ROOT carries the override and the fixed second segment names the operation
    // («ПОВТОР ДЕЙСТВИЯ»). The assertion used to read the second segment, which
    // is where the label sat before the identity line grew its two-part anchor.
    expect(w.find('.con-wshead__root').text()).to.eq('Mars Hydronetwork');
    expect(w.find('.con-wshead__context').text()).to.eq('Repeat action');
    expect(w.find('.con-wshead__ident').text()).to.not.contain(CardName.DELTA_PROJECT);
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

  /**
   * PAST THE COMMIT BOUNDARY THE CONFIGURATION SURFACE DOES NOT MOVE.
   *
   * The preview cache is keyed by an AVAILABILITY FINGERPRINT — stored
   * resources, action reasons, the server's activatable set — and the answer to
   * the action the player just confirmed moves every one of them. So the store
   * wipes and refetches WHILE the commit beat is still playing. The composer's
   * whole draft hangs off that prop, so for the length of that round-trip its
   * decision rows evaporated and then came back UNANSWERED and re-armed: the
   * committed ring left the hero card, «Выполняется…» reverted to
   * «ПОДТВЕРДИТЬ», and the amber «выберите…» line stood over a target the
   * player had already chosen AND sent — a blink that describes a decision as
   * unmade while its result is on the wire.
   */
  describe('the committed stage is frozen against the preview cache', () => {
    const COMMITTED_PREVIEW = {
      card: CARD, isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {
          type: 'card', title: 'Select card', buttonLabel: 'Select',
          cards: [{name: CARD}], min: 1, max: 1,
        }}],
      }],
    } as any;

    // Module state is bundle-shared under mochapack — never leave a seeded
    // preview (or a live commit beat) behind for the rest of the suite.
    afterEach(() => {
      resetActionPreviews();
      resetActionCommit();
    });

    /**
     * The player's own path, to the letter: open the action, answer its target
     * on the embedded step, press A. (The shell's awaiting handoff — what keeps
     * `submitting` true across the real response — is not simulated: the subject
     * here is the PREVIEW CACHE, and dropping that lock is one of the symptoms.)
     */
    async function committedStage(): Promise<{w: any, composer: any}> {
      actionPreviewStore.key = 'test';
      actionPreviewStore.previews = {[CARD]: COMMITTED_PREVIEW};
      // The target step reads EVERY seat's tableau (the candidate lies on one).
      const view = playerView();
      view.players = [{color: 'blue', name: 'Me', tableau: [{name: CARD, resources: 2}]}];
      const w = mount(ConsoleCardActions, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
        props: {playerView: view},
        attachTo: document.body,
      });
      await settle(w);
      const vm = w.vm as any;
      vm.activateFocused();
      await settle(w);
      // (Identity is never asserted: the store is `reactive`, so what the stage
      // reads is a PROXY of the seed. The branch's own availability is the
      // discriminator — the refetched preview below says the opposite.)
      expect(vm.composerPreview?.branches[0].available, 'the stage composes against the cached preview').to.eq(true);

      const composer = w.findComponent({name: 'ConsoleActionComposer'}).vm as any;
      composer.openPlayedTargetStep(composer.allChoices[0]);
      await settle(w);
      composer.confirmPlayedTarget();
      await settle(w);
      expect(composer.captured[0], 'the target is answered BEFORE the commit').to.not.eq(undefined);
      composer.submit();
      await settle(w);
      expect(composer.submitting, 'A committed the batch').to.eq(true);
      expect(w.emitted('submit-batch'), 'the batch went to the shell').to.have.length(1);
      return {w, composer};
    }

    it('the answer wiping the preview cache does not empty the committed stage', async () => {
      const {w, composer} = await committedStage();
      const vm = w.vm as any;
      // The response lands: a changed fingerprint clears the cache and refetches.
      actionPreviewStore.key = 'test-after-the-action';
      actionPreviewStore.previews = {};
      await settle(w);
      expect(vm.composerPreview?.branches.length, 'the committed variant keeps what it was composed against').to.eq(1);
      expect(w.find('.con-composer--stage').exists()).to.eq(true);
      // …and the ANSWERED target is still the answered target: the row, the
      // capture and the chosen card all survive their own result.
      expect(composer.captured[0]).to.not.eq(undefined);
      expect(w.find('.con-composer__target-name').text()).to.contain(CARD);
      expect(w.find('.con-composer__row-empty').exists(), 'no «выберите…» over a made decision').to.eq(false);
      w.unmount();
    });

    it('a refetched preview never re-arms the CTA over an action already sent', async () => {
      const {w, composer} = await committedStage();
      const vm = w.vm as any;
      // The refetch lands — same card, a NEW object, and the branch is now
      // «Активирована» because the server marked the action used.
      actionPreviewStore.key = 'test-after-the-action';
      actionPreviewStore.previews = {
        [CARD]: {...COMMITTED_PREVIEW, branches: [{...COMMITTED_PREVIEW.branches[0], available: false}]},
      };
      await settle(w);
      expect(vm.composerPreview?.branches[0].available, 'the «Активирована» refetch never reaches the stage').to.eq(true);
      expect(composer.submitting, 'the commit lock survives a preview change').to.eq(true);
      // The honest in-flight CTA, and no readiness hint over a made decision.
      expect(w.find('.con-composer__cta--waiting').exists()).to.eq(true);
      expect(w.find('.con-composer__cta-hint').exists()).to.eq(false);
      w.unmount();
    });

    it('the freeze is per VARIANT and lets go with the stage', async () => {
      const {w} = await committedStage();
      const vm = w.vm as any;
      expect(vm.committedPreview).to.not.eq(undefined);
      actionPreviewStore.key = 'test-after-the-action';
      actionPreviewStore.previews = {};
      await settle(w);
      // Re-pointing the stage at another variant (what the Viron repeat-reveal
      // handoff does) falls back to the live cache — a frozen preview belongs
      // to the variant it was committed for, never to the surface.
      vm.composer = {cardName: CARD, nodeIndex: 1};
      await settle(w);
      expect(vm.composerPreview).to.eq(undefined);
      // …and a genuine fold ends the freeze outright.
      vm.closeComposer();
      await settle(w);
      expect(vm.committedPreview).to.eq(undefined);
      w.unmount();
    });
  });
});
