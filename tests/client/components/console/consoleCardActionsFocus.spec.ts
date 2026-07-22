import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleCardActions from '@/client/components/console/ConsoleCardActions.vue';
import {consoleCardActionsUi, defaultCardActionsFilter} from '@/client/console/consoleCardActions';
import {consoleActionComposerUi} from '@/client/console/consoleActionComposerUi';

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

  it('BROWSE: the inspector anchors on the card THUMBNAIL (a physical zoom slot), the old graphic duplicate is gone', async () => {
    const w = factory();
    await settle(w);
    const thumb = w.find('.con-cardactions__detail-card');
    expect(thumb.exists()).to.eq(true);
    expect(thumb.attributes('data-zoom-slot')).to.eq(CARD);
    expect(thumb.attributes('data-action-flow-thumb')).to.not.eq(undefined);
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
