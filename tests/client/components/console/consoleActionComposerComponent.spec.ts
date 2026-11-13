/*
 * ConsoleActionComposer AS A COMPONENT — a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). What
 * the composer DOES is the subject of its own family (`composerRender`, `composerLawPlay`, `composerNestedOrBranch`,
 * `composerPolitical`, `composerRuntimeNavigation`, `consoleOutcomeStage`, `tableTargetZone`, `stagedActionVote`);
 * this file holds what the conversion itself owes (§ 3 of the book), and is named `…Component` because
 * `consoleActionComposer.spec.ts` is the spec of the pure module `console/consoleActionComposer.ts`:
 *  - it mounts in a minimal honest state with no Vue warning (`globalConfig` turns one into a failure) and stands on
 *    its ROOT — the template starts with it (R24), so what its holder lets fall through lands on the stage;
 *  - what it EXPOSES, read through a holder's ref (never `wrapper.vm`, which sees the whole setup state): the two
 *    functions ConsoleCardActions reaches through `composerRef`, and the one computed only the composer's specs read
 *    — each of them used;
 *  - its MODULE state (R25 — `consoleActionComposerState.ts`): the merged batch's assembly in flight is one handle
 *    per page, behind three functions.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import {
  composerAssemblyInFlight, killComposerAssembly, playComposerAssembly,
} from '@/client/components/console/consoleActionComposerState';
import type {IntakeAssemblyArgs} from '@/client/console/cardIntake/intakeAssemblyDirector';
import type {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

// The glyphs are the command bar's decoration — a stand-in keeps the mount about the composer.
const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 47, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
  players: [{color: 'blue', name: 'Me', tableau: []}],
  game: {generation: 1},
  cardsInHand: [],
};

function entryFor(cardName: string) {
  return {
    group: {key: cardName, cardName, isCorporation: false, isDisabled: false, nodes: [{key: cardName + '#0', actionNode: undefined, renderRoot: undefined, text: undefined}]},
    cardName,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  } as any;
}

/** An action with nothing to configure — the smallest honest composer: one branch, no step, the commit ready. */
function barePreview(card: string): any {
  return {card, isCorporation: false, kind: 'dynamic', branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}]};
}

/** An action whose ONE branch is a colony trade — the server's own `colonyTrade` step names the card that powers it. */
function tradePreview(card: string): any {
  return {
    card, isCorporation: false, kind: 'dynamic',
    branches: [{
      index: -1, title: 'Spend 1 floater to trade for free', available: true, renderKeys: [],
      effects: [{direction: 'cost', icon: 'floaters', amount: 1, current: 1, resulting: 0}],
      steps: [{kind: 'colonyTrade', card}],
    }],
  };
}

/** What a holder of the composer's ref sees — the exposed object (an exposed computed arrives unwrapped). */
type Held = {
  handleIntent(intent: GamepadIntent): void,
  flyDiscardExchange(): Promise<void>,
  tradeEntryCard: string | undefined,
};

/** The composer under a holder that stands a ref on it and listens — the way ConsoleCardActions holds it. */
function mountHeld(card: string, preview: any) {
  const held = shallowRef<Held | null>(null);
  const heard: Array<string> = [];
  const Host = defineComponent({
    name: 'ComposerHolder',
    setup: () => () => h('div', {'data-holder': ''}, [h(ConsoleActionComposer as never, {
      'ref': held,
      'playerView': PLAYER_VIEW,
      'entry': entryFor(card),
      preview,
      'nodeIndex': 0,
      'onInspectSource': () => heard.push('inspect-source'),
      'onConfirm': () => heard.push('confirm'),
      'onCancel': () => heard.push('cancel'),
    })]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}}});
  return {wrapper, held, heard};
}

describe('ConsoleActionComposer — the component (script setup)', () => {
  it('mounts on its ROOT with no warning: the stage, its region, the commit dock — and the holder\'s attributes fall through', async () => {
    const w = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {playerView: PLAYER_VIEW, entry: entryFor('Z'), preview: barePreview('Z'), nodeIndex: 0},
      attrs: {'data-probe': 'held'},
    });
    await w.vm.$nextTick();

    // The template STARTS with its root (R24): the mount's element is the stage itself, never a fragment's anchor.
    expect(w.element.nodeType, 'an element root').to.eq(1);
    expect(w.classes()).to.include.members(['con-composer', 'con-composer--stage']);
    expect(w.attributes('role')).to.eq('region');
    expect(w.attributes('data-motion-surface')).to.eq('action-composer');
    expect(w.attributes('data-probe'), 'a fallthrough attribute lands on the root').to.eq('held');
    // A minimal honest state: nothing to configure, so the commit row stands ready in its dock.
    const cta = w.find('.con-composer__ctadock .con-composer__cta');
    expect(cta.exists(), 'the commit lives in the pinned dock').to.eq(true);
    expect(cta.classes()).to.not.include('con-composer__cta--held');
    w.unmount();
  });

  it('EXPOSES exactly `flyDiscardExchange`, `handleIntent` and `tradeEntryCard` to the holder of its ref — each one answers', async () => {
    const {wrapper, held, heard} = mountHeld('X', barePreview('X'));
    await wrapper.vm.$nextTick();

    expect(held.value, 'the holder\'s ref is set').to.not.eq(null);
    const composer = held.value!;
    expect(Object.keys(composer).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['flyDiscardExchange', 'handleIntent', 'tradeEntryCard']);

    // `handleIntent` — the pad drives the stage through it: X inspects the source and never confirms.
    composer.handleIntent({kind: 'press', button: 'secondary'});
    expect(heard).to.deep.eq(['inspect-source']);
    // …and B asks the holder to fold the stage back.
    composer.handleIntent({kind: 'press', button: 'back'});
    expect(heard).to.deep.eq(['inspect-source', 'cancel']);

    // `flyDiscardExchange` — nothing was held for this source, so the payout resolves at once.
    let flown = false;
    await composer.flyDiscardExchange().then(() => {
      flown = true;
    });
    expect(flown, 'no token to fly: the promise resolves').to.eq(true);

    // `tradeEntryCard` — this action declares no trade.
    expect(composer.tradeEntryCard).to.eq(undefined);
    wrapper.unmount();
  });

  it('`tradeEntryCard` reads the selected branch\'s own `colonyTrade` step — unwrapped for the holder', async () => {
    const {wrapper, held} = mountHeld('Titan Floating Launch-Pad', tradePreview('Titan Floating Launch-Pad'));
    await wrapper.vm.$nextTick();
    expect(held.value!.tradeEntryCard, 'the card the trade is paid through').to.eq('Titan Floating Launch-Pad');
    wrapper.unmount();
  });

  it('the MODULE state: the assembly\'s handle is let go before the composer hears «done», and a kill leaves none in flight', () => {
    killComposerAssembly();
    expect(composerAssemblyInFlight(), 'nothing in flight to begin with').to.eq(false);

    // A plan with no run is done at once — what the composer's own `onDone` is told about the handle is the point.
    const inFlightAtDone: Array<boolean> = [];
    const args: IntakeAssemblyArgs = {
      plan: {runs: [], totalMs: 0},
      pairs: [],
      slots: [],
      host: {
        stageRect: () => ({left: 0, top: 0, width: 0, height: 0}),
        triggerEl: () => null,
        cellIconRect: () => undefined,
      },
      alive: () => true,
      onDone: () => inFlightAtDone.push(composerAssemblyInFlight()),
    };
    playComposerAssembly(args);
    expect(inFlightAtDone, '`onDone` ran once, the handle already let go').to.deep.eq([false]);

    killComposerAssembly();
    expect(composerAssemblyInFlight(), 'a kill leaves none').to.eq(false);
  });
});
