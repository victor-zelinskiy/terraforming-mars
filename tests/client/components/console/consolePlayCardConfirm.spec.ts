/*
 * ConsolePlayCardConfirm — the PLAY COMPOSER («КАРТЫ В РУКЕ › <карта> › РОЗЫГРЫШ»): the console-native pre-submit
 * surface of a project card's play. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its flows —
 * the picks, the payment editor, the staged doors, the landing scene — are its e2e's subject
 * (`console-play-composer-sheet` and the card specs); this spec pins what a unit mount can say about the surface:
 *  - it mounts CONTENT-COMPLETE off the focus prewarm with no Vue warning (`globalConfig` turns one into a failure) —
 *    six `immediate` watchers fire inside setup and read the whole declaration block (the ORDER of RECIPES § 1): the
 *    root, the header, the hero face, the result row, the one-line price, the commit row under the cursor, and its
 *    contextual commands published to the shell's ONE bar — taken back with the surface;
 *  - the shell's surface registry reaches EXACTLY the three members its controllers read (R11), and each answers;
 *  - the pad: B cancels; A on the commit row is the cursor's ARRIVAL inside its window and the play after it — ONE
 *    `confirm` carrying the payment; a refusal re-arms the commit through `resetSubmitting`;
 *  - EMBEDDED in the hand workspace it drops its frame and hands its stage name UP to the host's crumb;
 *  - on a prewarm MISS it shows the loading row, honours only B, and the fetched preview replaces the row in place
 *    (and feeds the prewarm).
 *
 * The card face is stubbed (its own spec's subject); every other child renders for real.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {flushPromises, mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Payment} from '@/common/inputs/Payment';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consolePlayCardUi, resetConsolePlayCardUi} from '@/client/console/consolePlayCardUi';
import {resetHandPlayPrewarm, storeHandPlayPreview, takeHandPlayPreview} from '@/client/console/consoleHandPlayPrewarm';
import {pushWorkspaceFrame, resetWorkspaceStack, workspaceFrameStage} from '@/client/console/consoleWorkspaceStack';
import {resetPostCommitWitness} from '@/client/console/preselectWitness';
import {clearDeferredDiscards} from '@/client/console/deferredDiscardFresh';
import ConsolePlayCardConfirm from '@/client/components/console/ConsolePlayCardConfirm.vue';

const CARD = CardName.ADAPTED_LICHEN;
const COST = 9;
const WALLET = 30;

/** What the shell's controllers reach through the surface registry (the sheet's MUST EXPOSE list + `handedTo`). */
type PlaySurface = {
  composerRootEl(): HTMLElement | undefined,
  resetSubmitting(): void,
  handleIntent(intent: GamepadIntent): void,
};
const EXPOSED = ['composerRootEl', 'handleIntent', 'resetSubmitting'];

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

// (A render function, not a template string: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'CardFace',
  props: {card: {type: Object as PropType<CardModel>, required: true}},
  render() {
    return h('i', {'class': 'card-stub', 'data-card': this.card.name});
  },
});

function viewOf(): PlayerViewModel {
  const thisPlayer = fakePublicPlayerModel({megacredits: WALLET});
  return fakePlayerViewModel({thisPlayer, players: [thisPlayer], cardsInHand: [{name: CARD, calculatedCost: COST}]});
}

/** The server's «play a project card» prompt for the one card — M€ only, nothing else to pay with. */
const INPUT = {
  type: 'projectCard', title: 'Play project card', buttonLabel: 'Play',
  cards: [{name: CARD, calculatedCost: COST}],
  paymentOptions: {},
  microbes: 0, floaters: 0, lunaArchivesScience: 0, seeds: 0, graphene: 0, kuiperAsteroids: 0, auroraiData: 0,
  spireScience: 0, floodgateSteel: 0, mechs: 0, constructionMechs: 0, supercomputerData: 0, arwindFighters: 0,
} as unknown as SelectProjectCardToPlayModel;

/** The server's preview of the play: one branch, nothing to ask, +1 plant production. */
const PREVIEW = {
  card: CARD, isCorporation: false, kind: 'declarative',
  branches: [{
    index: -1, title: '', available: true, renderKeys: [],
    effects: [{direction: 'gain', icon: 'plants', amount: 1, current: 0, resulting: 1, note: 'production'}],
    steps: [],
  }],
} as unknown as ActionPreview;

const global = {...globalConfig.global, stubs: {Card: CardStub}};

/** The composer the way the hand opens it: the card's preview already warm (the focus prewarm's hit). */
function mountWarm(props: {embedded?: boolean} = {}) {
  const playerView = viewOf();
  storeHandPlayPreview(playerView, CARD, PREVIEW);
  return mount(ConsolePlayCardConfirm, {global, props: {playerView, cardName: CARD, input: INPUT, ...props}});
}

/** The commit's arrival window has passed (the ring painted long ago, no opening settle) — the next A is the move. */
function pastTheArrival(wrapper: ReturnType<typeof mountWarm>): void {
  const vm = wrapper.vm as unknown as {commitArrival: {arrival: unknown}};
  expect(vm.commitArrival.arrival, 'the cursor ARRIVED on the commit row (it did not walk there)').to.not.eq(undefined);
  vm.commitArrival.arrival = {at: 0, paintedAt: -10_000, settleUntil: 0};
}

function surfaceOf(wrapper: ReturnType<typeof mountWarm>): PlaySurface {
  return wrapper.vm as unknown as PlaySurface;
}

describe('ConsolePlayCardConfirm — the play composer', () => {
  // Module state is BUNDLE-SHARED: the composer feeds the prewarm, publishes its commands, arms the commit's witnesses
  // and writes the hand frame's stage.
  afterEach(() => {
    resetHandPlayPrewarm();
    resetConsolePlayCardUi();
    resetPostCommitWitness();
    clearDeferredDiscards();
    resetWorkspaceStack();
  });

  it('mounts content-complete off the prewarm: the header, the hero face, the result, the one-line price and the commit under the cursor', async () => {
    const wrapper = mountWarm();
    await nextTick();

    expect(wrapper.classes()).to.include.members(['con-composer', 'con-composer--play', 'con-ws']);
    expect(wrapper.classes()).to.not.include.members(['con-composer--embed']);
    expect(wrapper.classes(), 'nothing submitted').to.not.include('con-composer--submitting');
    expect(wrapper.attributes('role')).to.eq('dialog');
    expect(wrapper.attributes('aria-label')).to.eq(CARD);
    expect(wrapper.attributes('data-motion-surface')).to.eq('play-composer');
    expect(wrapper.attributes('data-cursor-pending'), 'a warm open holds no cursor').to.eq(undefined);

    expect(wrapper.find('.con-composer__kicker').text()).to.contain('Play project card');
    expect(wrapper.find('.con-composer__name').text()).to.eq(CARD);
    expect(wrapper.find('.con-composer__playcard > .card-stub').attributes('data-card'), 'the hero face').to.eq(CARD);
    expect(wrapper.find('.con-composer__loading').exists(), 'a prewarm hit never shows the loading row').to.eq(false);

    // The result — the preview's own chip, the printed production plate.
    expect(wrapper.find('.con-composer__sub-title--result').text()).to.eq('Result');
    const chips = wrapper.findAll('.con-composer__result-chips .action-effect-chip');
    expect(chips).to.have.length(1);
    expect(chips[0].classes()).to.include('action-effect-chip--gain');
    expect(chips[0].find('[data-chip-prod]').attributes('data-chip-prod-icon')).to.eq('plants');
    expect(wrapper.find('.con-vchoice').exists(), 'one branch — no «ИЛИ» group').to.eq(false);

    // The dock: ONE lane (M€) is a line beside the commit — the price and what the wallet keeps.
    const pay = wrapper.find('.con-composer__playdock > .con-pay');
    expect(pay.attributes('data-pay-density')).to.eq('line');
    expect(pay.find('.con-pay__price-value').text()).to.eq(String(COST));
    expect(pay.find('.con-pay__keep-before').text()).to.eq(String(WALLET));
    expect(pay.find('.con-pay__keep-after').text()).to.eq(String(WALLET - COST));
    expect(wrapper.find('.con-composer__payledger').exists(), 'no ledger in the body for one lane').to.eq(false);

    // Nothing to ask — the ONE cursor rule lands on the commit row.
    const cta = wrapper.find('.con-composer__playdock > .con-composer__cta');
    expect(cta.classes()).to.include.members(['con-composer__cta--ready', 'con-composer__cta--focused']);
    expect(cta.classes()).to.not.include.members(['con-composer__cta--off']);
    expect(cta.find('.con-composer__cta-label').text()).to.eq('Play card');

    // The contextual commands live in the shell's ONE bar — published at setup, taken back with the surface.
    expect(consolePlayCardUi.commands.map((c) => c.control)).to.deep.eq(['confirm', 'secondary', 'back']);
    expect(consolePlayCardUi.commands[0]).to.include({label: 'Play card', enabled: true});
    wrapper.unmount();
    expect(consolePlayCardUi.commands, 'the bar is handed back on unmount').to.deep.eq([]);
  });

  it('exposes to the shell exactly what its controllers read — and each member answers', async () => {
    const playerView = viewOf();
    storeHandPlayPreview(playerView, CARD, PREVIEW);
    const cancelled: Array<true> = [];
    const Host = defineComponent({
      render() {
        return h('div', [h(ConsolePlayCardConfirm, {ref: 'playConfirm', playerView, cardName: CARD, input: INPUT, onCancel: () => cancelled.push(true)})]);
      },
    });
    const host = mount(Host, {global});
    await nextTick();
    const surface = host.vm.$refs.playConfirm as PlaySurface;

    expect(Object.keys(surface as object).sort(), 'defineExpose is the sheet\'s MUST EXPOSE list (+ the router\'s handleIntent)').to.deep.eq(EXPOSED);
    expect(surface.composerRootEl(), 'the root the shell\'s controllers fade').to.eq(host.find('.con-composer').element);
    surface.handleIntent(B);
    expect(cancelled, 'the pad reaches the composer through the registry').to.have.length(1);
    expect(() => surface.resetSubmitting()).to.not.throw();
  });

  it('the pad: B cancels; A is the ARRIVAL inside the commit\'s window and the play after it — once; a refusal re-arms', async () => {
    const wrapper = mountWarm();
    await nextTick();
    const surface = surfaceOf(wrapper);

    surface.handleIntent(B);
    expect(wrapper.emitted('cancel')).to.have.length(1);

    // The A that opened the composer is never the A that plays the card (T14 · CC).
    surface.handleIntent(A);
    expect(wrapper.emitted('confirm'), 'a press inside the arrival window is the arrival').to.eq(undefined);

    pastTheArrival(wrapper);
    surface.handleIntent(A);
    await nextTick();
    const confirms = wrapper.emitted('confirm') as Array<Array<{branchIndex: number, payment: Payment, preResponses: Array<unknown>, stepResponses: Array<unknown>}>>;
    expect(confirms).to.have.length(1);
    const payload = confirms[0][0];
    expect(payload.branchIndex).to.eq(-1);
    expect(payload.payment.megacredits, 'the whole price in M€').to.eq(COST);
    expect(payload.preResponses).to.deep.eq([]);
    expect(payload.stepResponses).to.deep.eq([]);
    expect(wrapper.classes()).to.include('con-composer--submitting');

    // A submit in flight takes no second A …
    surface.handleIntent(A);
    expect(wrapper.emitted('confirm')).to.have.length(1);

    // … and a REFUSED one is re-armed by the shell (`resetSubmitting`): the player retries from the same setup.
    surface.resetSubmitting();
    await nextTick();
    expect(wrapper.classes()).to.not.include('con-composer--submitting');
    surface.handleIntent(A);
    expect(wrapper.emitted('confirm')).to.have.length(2);
  });

  it('EMBEDDED in the hand workspace: no frame, no motion id, no title of its own — the stage name goes UP to the crumb', async () => {
    pushWorkspaceFrame({kind: 'hand', subject: CARD, stage: '', phase: 'configure', serves: [], anchor: {type: 'always'}});
    const wrapper = mountWarm({embedded: true});
    await nextTick();

    expect(wrapper.classes()).to.include('con-composer--embed');
    expect(wrapper.classes(), 'the host carries the workspace marker').to.not.include('con-ws');
    expect(wrapper.attributes('data-motion-surface'), 'the workspace owns the entrance').to.eq(undefined);
    expect(wrapper.find('.con-composer__kicker').exists(), 'an embedded surface never titles itself').to.eq(false);
    expect(wrapper.find('.con-composer__name').exists()).to.eq(false);
    expect(workspaceFrameStage('hand'), 'handed up at setup (an immediate watcher)').to.eq('Playing');
    expect(wrapper.find('.con-composer__cta--ready').exists(), 'the logic is untouched').to.eq(true);
  });

  describe('a prewarm MISS', () => {
    const realFetch = globalThis.fetch;
    let answer: (preview: ActionPreview) => void = () => undefined;
    let asked: Array<string> = [];
    beforeEach(() => {
      asked = [];
      globalThis.fetch = ((url: string) => {
        asked.push(String(url));
        return new Promise((resolve) => {
          answer = (preview) => resolve({ok: true, json: () => Promise.resolve(preview)} as unknown as Response);
        });
      }) as unknown as typeof fetch;
    });
    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it('shows the loading row and honours only B; the fetched preview replaces the row in place and feeds the prewarm', async () => {
      const playerView = viewOf();
      const wrapper = mount(ConsolePlayCardConfirm, {global, props: {playerView, cardName: CARD, input: INPUT}});
      await nextTick();
      const surface = surfaceOf(wrapper);

      expect(asked, 'ONE request for the card\'s preview').to.have.length(1);
      expect(asked[0]).to.contain('card=' + encodeURIComponent(CARD));
      expect(wrapper.find('.con-composer__loading').text()).to.contain('Loading');
      expect(wrapper.find('.con-composer__result-chips').exists()).to.eq(false);
      surface.handleIntent(A);
      expect(wrapper.emitted('confirm'), 'nothing to play while loading').to.eq(undefined);
      surface.handleIntent(B);
      expect(wrapper.emitted('cancel'), 'only Cancel is honoured').to.have.length(1);

      answer(PREVIEW);
      await flushPromises();
      expect(wrapper.find('.con-composer__loading').exists()).to.eq(false);
      expect(wrapper.findAll('.con-composer__result-chips .action-effect-chip')).to.have.length(1);
      expect(wrapper.find('.con-composer__cta--ready').exists()).to.eq(true);
      expect(takeHandPlayPreview(playerView, CARD), 'a re-open in the same game state mounts warm').to.deep.include({hit: true});
    });
  });
});
