/*
 * ConsoleBotAttack — the console's compact modal for «бот атаковал вас»: the bot's real card, the bridge, the SHARED
 * played-target selector in its `remove` direction and the commit row. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). What the prompt MEANS and what a press means are the pure model's
 * (`botAttackModel.spec.ts`); this spec is the component's own contract: what it renders for its two props, what it
 * emits, what it publishes to the command bar, how it reads the mounted selector through its template ref — and what
 * the shell's pad router reaches through the surface's ref, which is `handleIntent` and nothing else. So the surface
 * is mounted the way the shell holds it: under a host with a ref, and the pad is driven THROUGH that ref. The commit
 * beat is an owned wait of the flow kernel — the spec drives the kernel's clock.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {consolePanelUi} from '@/client/console/consolePanelUi';
import {abortBotAttackCommit, resetBotAttackStateForTest} from '@/client/console/botAttack/botAttackState';
import {
  BotAttackViewModel, buildBotAttackView, COMMIT_REMOVE_ONE, COMMIT_VERB_KEY, EMPTY_NO_TARGETS, EXPLAIN_REMOVE_ONE,
  EYEBROW_ATTACK, HEADLINE_PLAYS_CARD, VERB_CHOOSE_TARGET, VERB_CONTINUE, VERB_INSPECT_CARD, VERB_MINIMIZE, VERB_NAVIGATE,
} from '@/client/console/botAttack/botAttackModel';
import {PlayedTargetFocus, PlayedTargetModel} from '@/client/console/played/consolePlayedTargetModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {BotAttackPromptMeta} from '@/common/models/BotAttackPromptModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import ConsoleBotAttack from '@/client/components/console/ConsoleBotAttack.vue';

/** What the pad router reads through the registry — the surface's whole contract with the shell. */
type SurfaceReach = {handleIntent(intent: GamepadIntent): void};

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

/** The commit beat's base duration, as the component keeps it. */
const COMMIT_BEAT_MS = 420;
const RESTRICTION = 'Only your highest-scoring animal or microbe cards can be chosen.';

/** One table: the viewer (blue) holds the candidates, the bot's seat attacks. */
type Table = {view: PlayerViewModel, vm: BotAttackViewModel};

/** The prompt exactly as the server builds it — a `card` pick carrying the `botAttackPrompt` marker — and its view. */
function attackOn(cards: ReadonlyArray<CardName>, min = 1): Table {
  const meta: BotAttackPromptMeta = {
    attacker: 'neutral',
    victim: 'blue',
    source: {kind: 'bonusCard', bonusCard: BonusCardId.B02_INVASIVE_SPECIES},
    effect: 'removeCardResource',
    cardResource: CardResource.ANIMAL,
    amount: 1,
    restrictionKey: RESTRICTION,
    targets: cards.map((card) => ({card, resource: CardResource.ANIMAL, resources: {before: 2, after: 1}})),
  };
  const waitingFor = {
    type: 'card', title: 'Remove 1 resource from one of your cards', buttonLabel: 'Remove resource',
    cards: cards.map((name) => ({name, resources: 2})),
    max: 1, min, showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
    botAttackPrompt: meta,
  } as unknown as PlayerInputModel;
  const me = {color: 'blue', name: 'Ada', tableau: [{name: CardName.BIRDS, resources: 2}, {name: CardName.FISH, resources: 2}]};
  const bot = {color: 'neutral', name: 'MarsBot', isMarsBot: true, tableau: []};
  const vm = buildBotAttackView(waitingFor, {venus: false, colonies: false});
  if (vm === undefined) {
    throw new Error('the fixture builds a view');
  }
  return {view: {id: 'p1', thisPlayer: me, players: [me, bot], waitingFor} as unknown as PlayerViewModel, vm};
}

// `<console-source-dock>` is the lazy binding of `asyncComponents.ts` — it answers to the wrapper's name, which is the
// stub's key (RECIPES § 3).
const DockStub = defineComponent({
  name: 'AsyncComponentWrapper',
  props: {view: {type: Object, required: true}},
  render: () => h('div', {class: 'con-src'}),
});

/** What the host asked of the mounted selector through its ref. */
const asked = {navigate: [] as Array<[PlayedTargetFocus, string]>, ensured: 0};

// The SHARED selector, as a host sees it: its props, and the three members the attack screen reaches through
// `ref="targetStep"` — `cells`, the page-aware `navigate`, `ensureFocusVisible`. One row of two candidates: RIGHT from
// the first reaches the second and LEFT comes back; every other step is an edge (the selector answers `undefined`).
const StepStub = defineComponent({
  name: 'ConsolePlayedTargetStep',
  props: {
    model: {type: Object, required: true},
    layout: {type: Object, required: true},
    focus: {type: Object, required: true},
    bandHeight: {type: Number, default: 0},
    lockedCard: {type: String, default: ''},
    hostStatesAsk: {type: Boolean, default: false},
  },
  methods: {
    cells(): ReadonlyArray<never> {
      return [];
    },
    navigate(focus: PlayedTargetFocus, dir: string): PlayedTargetFocus | undefined {
      asked.navigate.push([focus, dir]);
      if (dir === 'right' && focus.index === 0) {
        return {ownerId: focus.ownerId, index: 1};
      }
      return dir === 'left' && focus.index === 1 ? {ownerId: focus.ownerId, index: 0} : undefined;
    },
    ensureFocusVisible(): void {
      asked.ensured++;
    },
  },
  render: () => h('div', {class: 'step-stub'}),
});

function mountUnderHost(first: Table) {
  const table = shallowRef(first);
  const submitted: Array<unknown> = [];
  const deferred = {count: 0};
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleBotAttack, {
      ref: 'botAttack',
      playerView: table.value.view,
      vm: table.value.vm,
      onSubmit: (response: unknown) => {
        submitted.push(response);
      },
      onDefer: () => {
        deferred.count++;
      },
    })]),
  });
  const wrapper = mount(Host, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: true, AsyncComponentWrapper: DockStub, ConsolePlayedTargetStep: StepStub}},
  });
  const cta = () => wrapper.find('.con-botattack__cta');
  return {
    wrapper,
    table,
    submitted,
    deferred,
    reach: (): SurfaceReach => {
      const surface = (wrapper.vm.$refs.botAttack ?? undefined) as SurfaceReach | undefined;
      if (surface === undefined) {
        throw new Error('the host holds no ref to the surface');
      }
      return surface;
    },
    step: () => wrapper.findComponent(StepStub),
    /** The commit row's state modifiers, without the block's own class. */
    ctaState: () => cta().classes().filter((c) => c !== 'con-botattack__cta').map((c) => c.replace('con-botattack__cta--', '')).sort(),
    ctaLabel: () => cta().find('.con-botattack__cta-label').text(),
  };
}

describe('ConsoleBotAttack — the «бот атаковал вас» modal', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    asked.navigate = [];
    asked.ensured = 0;
  });
  afterEach(() => {
    setFlowClock(undefined);
    // Module state is BUNDLE-SHARED: the abort nonce and the X zoom are never left for the next spec.
    resetBotAttackStateForTest();
    closeConsoleCardZoom();
  });

  it('the template starts with its root: a dialog that says who attacked, with what and why — the source, the bridge, the selector, a held commit row', () => {
    const {wrapper, table, step, ctaState, ctaLabel} = mountUnderHost(attackOn([CardName.BIRDS, CardName.FISH]));
    const root = wrapper.find('.con-botattack');
    const host = wrapper.element as Element;
    expect(host.firstElementChild, 'the surface is one element').to.eq(root.element);
    expect(host.childNodes, 'no comment node stands before the root').to.have.length(1);
    expect(root.classes()).to.include.members(['con-botattack', 'con-ws']);
    expect(root.classes()).to.not.include('con-botattack--committing');
    expect(root.attributes('role')).to.eq('dialog');
    expect(root.attributes('aria-label')).to.eq(`${$t(EYEBROW_ATTACK)}: ${$t('MarsBot')}`);
    expect(root.attributes('data-motion-surface')).to.eq('bot-attack');

    // WHO · WHAT HAPPENED · WHAT IS REQUIRED · WHY only these cards.
    expect(root.find('.con-prompt-head__category').text()).to.eq($t(EYEBROW_ATTACK));
    expect(root.find('.con-botattack__actor').text(), 'the seat\'s DISPLAY name, never a raw seat name').to.eq($t('MarsBot'));
    expect(root.find('.con-botattack__actor').classes()).to.include('player_color_neutral');
    expect(root.find('.con-prompt-head__title').text()).to.eq(translateTextWithParams(HEADLINE_PLAYS_CARD, [$t('MarsBot'), $t('Invasive Species')]));
    expect(root.find('.con-botattack__ask').text()).to.eq($t(EXPLAIN_REMOVE_ONE));
    expect(root.find('.con-botattack__limit').text()).to.eq($t(RESTRICTION));

    // SOURCE (the lazy binding, by import) → BRIDGE → TARGET (the shared selector, the host stating the ask itself).
    const dock = wrapper.findComponent(DockStub);
    expect(dock.exists(), 'the tag resolved to the imported binding').to.eq(true);
    expect(dock.props('view')).to.deep.eq(table.value.vm.source);
    expect(root.find('.con-botattack__bridge-sign').text()).to.eq('−1');
    expect(root.find('.con-botattack__bridge-icon').classes(), 'the removed resource\'s sprite').to.include('card-resource-animal');
    const owners = (step().props('model') as PlayedTargetModel).owners;
    expect(owners.map((owner) => [owner.id, owner.candidates.map((c) => c.cardName)]), 'the SERVER\'s candidates, grouped by their owner')
      .to.deep.eq([['blue', [CardName.BIRDS, CardName.FISH]]]);
    expect((step().props('model') as PlayedTargetModel).contract.direction).to.eq('remove');
    expect(step().props('focus'), 'the cursor rests on the first candidate — a cursor is not a choice').to.deep.eq({ownerId: 'blue', index: 0});
    expect([step().props('lockedCard'), step().props('hostStatesAsk')]).to.deep.eq(['', true]);
    expect(root.find('.con-botattack__empty').exists()).to.eq(false);

    // NOTHING IS SELECTED ON OPEN: the commit row is held and says what is missing.
    expect(ctaState()).to.deep.eq(['held']);
    expect(wrapper.find('.con-botattack__cta').attributes('aria-disabled')).to.eq('true');
    expect(ctaLabel()).to.eq($t('Choose a card first'));
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const surface = mountUnderHost(attackOn([CardName.BIRDS])).reach();
    expect(Object.keys(surface), 'exactly what the surface exposes').to.deep.eq(['handleIntent']);
    expect(surface.handleIntent).to.be.a('function');
    const leaked = ['zone', 'selected', 'committing', 'submitting', 'navigate', 'runCommit', 'resetSubmitting', 'measure']
      .filter((key) => (surface as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: A pre-selects (nothing is sent), A on the commit row plays the beat and THEN sends — once, the beat absorbing every press', async () => {
    const {wrapper, reach, submitted, deferred, step, ctaState, ctaLabel} = mountUnderHost(attackOn([CardName.BIRDS, CardName.FISH]));

    reach().handleIntent(A);
    await nextTick();
    expect(submitted, 'A on a candidate never removes anything').to.deep.eq([]);
    expect(step().props('lockedCard')).to.eq(CardName.BIRDS);
    expect(ctaState(), 'the cursor follows the gate onto the commit row').to.deep.eq(['focused', 'ready']);
    expect(ctaLabel()).to.eq($t(COMMIT_REMOVE_ONE));
    expect(wrapper.find('.con-botattack__cta').attributes('aria-disabled')).to.eq('false');

    reach().handleIntent(A);
    await nextTick();
    expect(wrapper.find('.con-botattack').classes(), 'the chosen cube visibly leaves first').to.include('con-botattack--committing');
    expect(ctaState()).to.deep.eq(['armed']);
    expect(submitted, 'the answer waits for the beat').to.deep.eq([]);
    reach().handleIntent(A);
    reach().handleIntent(B);
    reach().handleIntent(nav('up'));
    expect([submitted, deferred.count], 'the beat owns the screen').to.deep.eq([[], 0]);

    clock.advance(consoleMotionMs(COMMIT_BEAT_MS));
    expect(submitted).to.deep.eq([{type: 'card', cards: [CardName.BIRDS]}]);
    reach().handleIntent(A);
    clock.advance(consoleMotionMs(COMMIT_BEAT_MS));
    expect(submitted, 'sent ONCE').to.have.length(1);
  });

  it('the server REFUSED the answer: the abort signal undoes the beat and the choice is editable again', async () => {
    const {wrapper, reach, submitted, ctaState} = mountUnderHost(attackOn([CardName.BIRDS, CardName.FISH]));
    reach().handleIntent(A);
    reach().handleIntent(A);
    await nextTick();
    expect(ctaState()).to.deep.eq(['armed']);

    // …mid-beat: the pending answer is taken back with it.
    abortBotAttackCommit();
    await nextTick();
    expect(wrapper.find('.con-botattack').classes()).to.not.include('con-botattack--committing');
    expect(ctaState()).to.deep.eq(['focused', 'ready']);
    clock.advance(consoleMotionMs(COMMIT_BEAT_MS));
    expect(submitted, 'a cancelled beat sends nothing').to.deep.eq([]);

    // …and after the answer left: the commit row is live again and the next A sends again.
    reach().handleIntent(A);
    clock.advance(consoleMotionMs(COMMIT_BEAT_MS));
    expect(submitted).to.have.length(1);
    abortBotAttackCommit();
    await nextTick();
    reach().handleIntent(A);
    clock.advance(consoleMotionMs(COMMIT_BEAT_MS));
    expect(submitted).to.deep.eq([{type: 'card', cards: [CardName.BIRDS]}, {type: 'card', cards: [CardName.BIRDS]}]);
  });

  it('the d-pad walks the MOUNTED selector through its ref; DOWN reaches the commit row only once a target is chosen, UP re-opens the choice', async () => {
    const {reach, step, ctaState} = mountUnderHost(attackOn([CardName.BIRDS, CardName.FISH]));

    reach().handleIntent(nav('right'));
    await nextTick();
    expect(asked.navigate, 'the page-aware step is the selector\'s own').to.deep.eq([[{ownerId: 'blue', index: 0}, 'right']]);
    expect(step().props('focus')).to.deep.eq({ownerId: 'blue', index: 1});
    expect(asked.ensured, 'the host keeps the cursored candidate in view after every move').to.eq(1);

    reach().handleIntent(nav('down'));
    await nextTick();
    expect(ctaState(), 'an edge holds: a row that cannot act is not a place to arrive at').to.deep.eq(['held']);
    expect(asked.ensured).to.eq(1);

    reach().handleIntent(A);
    await nextTick();
    expect(step().props('lockedCard'), 'the candidate under the cursor').to.eq(CardName.FISH);
    expect(ctaState()).to.deep.eq(['focused', 'ready']);
    reach().handleIntent(nav('left'));
    reach().handleIntent(nav('down'));
    await nextTick();
    expect([step().props('focus'), asked.navigate.length], 'on the commit row the d-pad moves nothing but UP').to.deep.eq([{ownerId: 'blue', index: 1}, 2]);

    reach().handleIntent(nav('up'));
    await nextTick();
    expect(ctaState(), 'back among the targets, the choice kept').to.deep.eq(['ready']);
    reach().handleIntent(nav('down'));
    await nextTick();
    expect(ctaState()).to.deep.eq(['focused', 'ready']);
  });

  it('B sets the prompt aside (never an answer), X opens the focused candidate fullscreen', () => {
    const {reach, submitted, deferred} = mountUnderHost(attackOn([CardName.BIRDS, CardName.FISH]));
    reach().handleIntent(X);
    expect(consoleCardZoom.card?.name).to.eq(CardName.BIRDS);
    reach().handleIntent(B);
    expect([deferred.count, submitted]).to.deep.eq([1, []]);
  });

  it('a selection that stopped being legal is dropped: the table moved under the player, the cursor goes back to the targets', async () => {
    const {table, reach, step, ctaState} = mountUnderHost(attackOn([CardName.BIRDS, CardName.FISH]));
    reach().handleIntent(A);
    await nextTick();
    expect(step().props('lockedCard')).to.eq(CardName.BIRDS);

    table.value = attackOn([CardName.FISH]);
    await nextTick();
    await nextTick();
    expect(step().props('lockedCard'), 'never a commit row offering what the server would refuse').to.eq('');
    expect(ctaState()).to.deep.eq(['held']);
  });

  it('publishes its verbs to the command bar from the first frame — the A-verb is the honest one — and takes them back on leave', async () => {
    const {wrapper, reach} = mountUnderHost(attackOn([CardName.BIRDS]));
    expect(consolePanelUi.owner).to.eq('botAttack');
    expect(consolePanelUi.commands).to.deep.eq([
      {control: 'dpad', label: VERB_NAVIGATE}, {control: 'confirm', label: VERB_CHOOSE_TARGET},
      {control: 'secondary', label: VERB_INSPECT_CARD}, {control: 'back', label: VERB_MINIMIZE},
    ]);

    reach().handleIntent(A);
    await nextTick();
    expect(consolePanelUi.commands.find((command) => command.control === 'confirm'), 'the loss being accepted wears the danger ink')
      .to.deep.eq({control: 'confirm', label: COMMIT_VERB_KEY, tone: 'danger'});

    wrapper.unmount();
    expect(consolePanelUi.owner).to.eq(undefined);
    expect(consolePanelUi.commands).to.deep.eq([]);
  });

  it('NO VALID TARGET, the honest last resort: the sentence instead of the scene, and A answers empty where the protocol allows', () => {
    const {wrapper, reach, submitted} = mountUnderHost(attackOn([], 0));
    expect(wrapper.find('.con-botattack__empty').text()).to.eq($t(EMPTY_NO_TARGETS));
    expect([wrapper.find('.con-botattack__scene').exists(), wrapper.find('.con-botattack__foot').exists()]).to.deep.eq([false, false]);
    expect(consolePanelUi.commands, 'the A-press is drawn on the confirm glyph, never by its place in the list')
      .to.deep.eq([{control: 'confirm', label: VERB_CONTINUE}, {control: 'back', label: VERB_MINIMIZE}]);

    reach().handleIntent(A);
    reach().handleIntent(A);
    expect(submitted, 'sent ONCE').to.deep.eq([{type: 'card', cards: []}]);
  });
});
