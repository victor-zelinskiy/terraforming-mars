/*
 * ConsoleCorpFirstActionConfirm — the dedicated modal of a corporation's MANDATORY first action. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props (the mandatory framing, the
 * corporation named and shown, the printed ask read structurally off the prompt, the pager when several corporations
 * owe an action), the server's preview (ONE request per corporation per game-state version — the seeding pass never
 * asks twice, and a corporation that owes no action is asked nothing), what it emits (`confirm` with the corporation,
 * once per view; `cancel`) and what it EXPOSES: the shell's pad router reaches it through the surface registry
 * (`surfaces.at('corpFirstConfirm')`) and calls `handleIntent` and `stickScroll`, so a ref on it must carry exactly
 * those two. The card face, the effect chip, the glyph and the scroll area are stubbed by name (each is its own
 * component's subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {flushPromises, mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionEffect, ActionPreview} from '@/common/models/ActionPreviewModel';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {createSurfaceRegistry} from '@/client/console/shell/surfaceRegistry';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import ConsoleCorpFirstActionConfirm from '@/client/components/console/ConsoleCorpFirstActionConfirm.vue';

/** What the pad router reads through the registry — the modal's whole contract with the shell. */
type Surface = {handleIntent(intent: GamepadIntent): void, stickScroll(dy: number): void};

const THARSIS = CardName.THARSIS_REPUBLIC;
const VITOR = CardName.VITOR;

const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object as PropType<CardModel>, required: true}},
  render() {
    return h('i', {'class': 'card-stub'});
  },
});

const ChipStub = defineComponent({
  name: 'ActionEffectChip',
  props: {
    effect: {type: Object as PropType<ActionEffect>, required: true},
    skipped: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'chip-stub'});
  },
});

/** What the briefing column was scrolled by — the stub stands for the scroll area's exposed `scrollByPx`. */
let scrolled: Array<number> = [];
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  setup(_props, {expose, slots}) {
    expose({scrollByPx: (delta: number): void => {
      scrolled.push(delta);
    }});
    return () => h('div', {'class': 'scroll-stub'}, slots.default?.());
  },
});

const global = {
  ...globalConfig.global,
  stubs: {Card: CardStub, ActionEffectChip: ChipStub, ConsoleScrollArea: ScrollStub, GamepadGlyph: true},
};

/**
 * The view as the shell hands it: two corporations on the table, the corp first-action prompt up (found by its
 * marker; Tharsis' option names its card by a CARD token and prints the ask, Vitor has no option of its own), and the
 * ledger of the corporations that still OWE their action — the only ones the server can preview.
 */
function view(over: {owed?: ReadonlyArray<CardName>, gameAge?: number} = {}): PlayerViewModel {
  return {
    id: 'p-spec',
    game: {gameAge: over.gameAge ?? 7, undoCount: 0},
    thisPlayer: {color: 'red', tableau: [{name: THARSIS}, {name: VITOR}]},
    pendingInitialActions: over.owed ?? [],
    waitingFor: {
      type: 'or',
      title: '',
      startGamePrompt: {kind: 'corporationInitialAction'},
      options: [
        {
          type: 'option',
          title: {message: 'Take first action of ${0} corporation', data: [{type: LogMessageDataType.CARD, value: THARSIS}]},
          buttonLabel: 'Place a city tile',
        },
        {type: 'option', title: 'Pass', buttonLabel: 'Pass', warnings: ['pass']},
      ],
    },
  } as unknown as PlayerViewModel;
}

const GAIN = {direction: 'gain', icon: 'megacredits', amount: 3} as ActionEffect;
const CITY = {direction: 'gain', icon: 'city', amount: 1} as ActionEffect;

function preview(effects: ReadonlyArray<ActionEffect>): ActionPreview {
  return {
    card: THARSIS,
    isCorporation: true,
    kind: 'bespoke',
    branches: [{index: -1, title: '', available: true, effects, steps: [{kind: 'note', noteKind: 'generic', text: 'You will pick an award'}]}],
  } as unknown as ActionPreview;
}

function modal(playerView: PlayerViewModel, corpNames: ReadonlyArray<CardName>) {
  return mount(ConsoleCorpFirstActionConfirm, {global, props: {playerView, corpNames}});
}

/** The modal the way the shell mounts it: under a host, standing in the surface registry by its function ref. */
function underShell(playerView: PlayerViewModel, corpNames: ReadonlyArray<CardName>) {
  const surfaces = createSurfaceRegistry();
  const confirmed: Array<CardName> = [];
  const cancelled: Array<true> = [];
  const Host = defineComponent({
    props: {playerView: {type: Object as PropType<PlayerViewModel>, required: true}},
    render() {
      return h('div', [h(ConsoleCorpFirstActionConfirm, {
        ref: surfaces.bind.corpFirstConfirm,
        playerView: this.playerView,
        corpNames,
        onConfirm: (name: CardName) => {
          confirmed.push(name);
        },
        onCancel: () => {
          cancelled.push(true);
        },
      })]);
    },
  });
  const wrapper = mount(Host, {global, props: {playerView}});
  return {
    wrapper,
    confirmed,
    cancelled,
    /** Exactly the pad router's read: `shell.surfaces.at<…>('corpFirstConfirm')`. */
    surface: () => surfaces.at<Surface>('corpFirstConfirm'),
  };
}

describe('ConsoleCorpFirstActionConfirm — the mandatory first action\'s modal', () => {
  /** Every preview request the modal made, and the answers still owed to them. */
  let requests: Array<string> = [];
  let pending: Array<(response: unknown) => void> = [];
  let originalFetch: typeof globalThis.fetch;

  /** Answer the OLDEST open request the way the route does. */
  async function answer(body: ActionPreview): Promise<void> {
    const resolve = pending.shift();
    expect(resolve, 'a preview request is open').to.not.eq(undefined);
    resolve?.({ok: true, status: 200, json: () => Promise.resolve(body)});
    await flushPromises();
  }

  beforeEach(() => {
    requests = [];
    pending = [];
    scrolled = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = ((url: unknown) => {
      requests.push(String(url));
      return new Promise((resolve) => {
        pending.push(resolve);
      });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    // The viewer's state is a MODULE: the X test leaves it closed.
    closeConsoleCardZoom();
  });

  it('what it renders for its props: the mandatory framing, the corporation named and shown, the ask off the prompt; a pager only when several corporations owe an action', () => {
    const w = modal(view(), [THARSIS]);
    // The template starts with its root: the wrapper IS the modal, and the hooks of the shell stand on it.
    expect(w.classes()).to.deep.eq(['con-composer', 'con-composer--corpfirst', 'con-ws']);
    expect([w.attributes('role'), w.attributes('aria-label'), w.attributes('data-motion-surface')])
      .to.deep.eq(['dialog', 'Tharsis Republic', 'corp-first']);
    expect(w.find('.con-composer__panel--corpfirst').attributes('data-motion-panel')).to.eq('');
    expect(w.find('.con-composer__kicker--mandatory').text()).to.include('Mandatory corporation action');
    expect(w.find('.con-composer__name').text()).to.eq('Tharsis Republic');
    expect(w.find('.con-composer__corpfirst-chip').text()).to.eq('First action');
    expect(w.find('.con-composer__paytag--mandatory').text()).to.eq('Mandatory');
    expect(w.find('.con-composer__corpfirst-pager').exists(), 'one corporation: no pager').to.eq(false);
    expect(w.findComponent(CardStub).props('card')).to.deep.eq({name: THARSIS});
    // The ask is the live option's own label — found by the CARD token of its title, never by a text.
    expect(w.find('.con-composer__corpfirst-ask').text()).to.eq('Place a city tile');
    // This corporation owes nothing: the server is asked nothing (it could only answer «no preview»).
    expect(requests).to.deep.eq([]);
    expect(w.findAllComponents(ChipStub).length).to.eq(0);
    expect(w.classes()).to.not.include('con-composer--submitting');

    const two = modal(view(), [THARSIS, VITOR]);
    expect(two.find('.con-composer__corpfirst-pager').text().replace(/\s+/g, ' ')).to.eq('Corporation 1/2');
  });

  it('the server\'s preview: ONE request for the corporation on screen, «Loading…» until it lands, then the result and the next step — and a state that moved drops the verdict and asks again', async () => {
    const w = modal(view({owed: [THARSIS]}), [THARSIS]);
    expect(requests.length, 'one request at mount — the seeding pass of the version watcher never asks twice').to.eq(1);
    expect(requests[0]).to.match(/api\/corp-first-action-preview\?id=p-spec&corp=Tharsis%20Republic$/);
    expect(w.find('.con-composer__loading').text()).to.eq('Loading…');
    expect(w.find('.con-composer__cta').exists(), 'no CTA over a pending verdict').to.eq(false);

    await answer(preview([GAIN, CITY]));
    expect(w.find('.con-composer__loading').exists()).to.eq(false);
    expect(w.find('.con-composer__sub-title').text()).to.eq('Result');
    expect(w.findAllComponents(ChipStub).map((chip) => chip.props('effect'))).to.deep.eq([GAIN, CITY]);
    expect(w.findAll('.con-composer__next').map((row) => [row.find('.con-composer__next-label').text(), row.find('.con-composer__next-text').text()]))
      .to.deep.eq([['Next', 'You will pick an award']]);
    expect(w.find('.con-composer__cta--ready .con-composer__cta-label').text()).to.eq('Take first action');

    // The same view again changes nothing; a later game age is a new version: the verdict is spent and re-asked.
    await w.setProps({playerView: view({owed: [THARSIS]})});
    expect(requests.length).to.eq(1);
    expect(w.findAllComponents(ChipStub).length).to.eq(2);
    await w.setProps({playerView: view({owed: [THARSIS], gameAge: 8})});
    expect(requests.length).to.eq(2);
    expect(w.find('.con-composer__loading').exists()).to.eq(true);
    expect(w.findAllComponents(ChipStub).length).to.eq(0);
    await answer(preview([CITY]));
    expect(w.findAllComponents(ChipStub).map((chip) => chip.props('effect'))).to.deep.eq([CITY]);
  });

  it('the registry\'s ref sees `handleIntent` and `stickScroll` and nothing else; A confirms ONCE per view, B defers, the d-pad and the bumpers walk the corporations', async () => {
    const {wrapper, confirmed, cancelled, surface} = underShell(view(), [THARSIS, VITOR]);
    const on = surface();
    expect(on, 'the surface stands under its name').to.not.eq(undefined);
    if (on === undefined) {
      return;
    }
    expect(Object.keys(on).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['handleIntent', 'stickScroll']);
    const leaked = ['idx', 'previews', 'submitting', 'currentName', 'confirm', 'switchCorp', 'inspectCard', 'loadPreview', 'onNav']
      .filter((key) => (on as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    const name = () => wrapper.find('.con-composer__name').text();
    const pager = () => wrapper.find('.con-composer__corpfirst-pager').text().replace(/\s+/g, ' ');
    // →, then RB wraps back; ← wraps to the last; LB steps back. Up / down move nothing.
    on.handleIntent({kind: 'nav', dir: 'right', repeat: false});
    await nextTick();
    expect([name(), pager()]).to.deep.eq(['Vitor', 'Corporation 2/2']);
    // Vitor has no option of its own in the prompt: the generic ask.
    expect(wrapper.find('.con-composer__corpfirst-ask').text()).to.eq('Take the first action of your corporation');
    on.handleIntent({kind: 'press', button: 'bumperR'});
    await nextTick();
    expect([name(), pager()]).to.deep.eq(['Tharsis Republic', 'Corporation 1/2']);
    on.handleIntent({kind: 'nav', dir: 'left', repeat: false});
    await nextTick();
    expect(name()).to.eq('Vitor');
    on.handleIntent({kind: 'nav', dir: 'up', repeat: false});
    on.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    on.handleIntent({kind: 'press', button: 'bumperL'});
    await nextTick();
    expect(name()).to.eq('Tharsis Republic');
    expect(wrapper.findComponent(CardStub).props('card')).to.deep.eq({name: THARSIS});

    // B defers — and may be pressed again; A submits the corporation on screen, once.
    on.handleIntent({kind: 'press', button: 'back'});
    expect([cancelled.length, confirmed.length]).to.deep.eq([1, 0]);
    on.handleIntent({kind: 'press', button: 'confirm'});
    on.handleIntent({kind: 'press', button: 'confirm'});
    await nextTick();
    expect(confirmed, 'a second A is absorbed while the submit is out').to.deep.eq([THARSIS]);
    expect(wrapper.find('.con-composer').classes()).to.include('con-composer--submitting');
    // The next view (the server's answer — or its refusal) re-arms the press.
    await wrapper.setProps({playerView: view({gameAge: 8})});
    expect(wrapper.find('.con-composer').classes()).to.not.include('con-composer--submitting');
    on.handleIntent({kind: 'press', button: 'confirm'});
    expect(confirmed).to.deep.eq([THARSIS, THARSIS]);
  });

  it('the right stick scrolls the briefing column (through the exposed `stickScroll` and through a scroll intent), and X lifts the corporation\'s card out of its own slot', () => {
    const {wrapper, surface} = underShell(view(), [THARSIS]);
    const on = surface();
    expect(on, 'the surface stands under its name').to.not.eq(undefined);
    if (on === undefined) {
      return;
    }
    on.stickScroll(0.5);
    on.stickScroll(0.01); // inside the dead zone: nothing
    on.handleIntent({kind: 'scroll', dx: 0, dy: -1});
    expect(scrolled).to.deep.eq([22, -44]);

    expect(consoleCardZoom.card, 'the viewer is closed').to.eq(undefined);
    on.handleIntent({kind: 'press', button: 'secondary'});
    expect(consoleCardZoom.card).to.deep.eq({name: THARSIS});
    expect(consoleCardZoom.origin.kind).to.eq('physical');
    // «One physical card»: the origin is the modal's own card slot, found from its root.
    const slot = wrapper.find('.con-composer__playcard').element;
    expect(consoleCardZoom.origin.resolve?.(0)).to.eq(slot);
  });
});
