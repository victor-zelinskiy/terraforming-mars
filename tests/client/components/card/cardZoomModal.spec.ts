/*
 * CardZoomModal — the fullscreen card viewer (a native `<dialog>`). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). This file holds the viewer's PUBLIC SURFACE:
 *  - what it renders for one card and for a list (the browsing chrome is opt-in);
 *  - what its hosts reach through a ref — the exposed list IS the contract: the console viewer's controller and the
 *    menu's zoom host drive it (`measureLanding` → `show` → `prev` / `next` → `fitCardToViewport` → `close`), the card
 *    face, the journal chip, the target picker and the resource overlay call `show`;
 *  - the steps it takes and what it emits for them;
 *  - the settle signal its rule overlay waits for, and the ways it closes.
 * Its archive entry (the left gutter) is `CardZoomModalLore.spec.ts`. The fit engine and the flights need a layout and
 * belong to the e2e.
 *
 * The stage card and the rule overlay are stubbed — this is the viewer, not a premium face under JSDOM. JSDOM's
 * `<dialog>` has neither `showModal()` nor `close()`: the spec lends both, behaving as a browser does (`open`, then
 * the 'close' event). The viewer's timers are owned waits of the flow kernel, so time is the kernel's manual clock.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import type {Component} from 'vue';
import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import CardAnnotationsLayer from '@/client/components/cardAnnotations/CardAnnotationsLayer.vue';

/** What a host reads through its ref on the viewer: the exposed list, its root (`rootEl` — components/rootEl.ts) among it. */
type Viewer = {
  show(): void,
  close(): void,
  prev(): void,
  next(): void,
  fitCardToViewport(cardRoot?: HTMLElement): void,
  measureLanding(): Promise<{rect: {left: number, top: number, width: number, height: number}, zoom: number} | undefined>,
  readonly rootEl: HTMLElement | null,
};

const HACKERS: CardModel = {name: CardName.HACKERS};
const AI_CENTRAL: CardModel = {name: CardName.AI_CENTRAL};
const ALGAE: CardModel = {name: CardName.ALGAE};
const LIST: ReadonlyArray<CardModel> = [HACKERS, AI_CENTRAL, ALGAE];

/** The viewer the way every host mounts it: under a parent that holds a ref on it and binds its props. */
const Host = defineComponent({
  props: {
    bind: {type: Object as PropType<Record<string, unknown>>, required: true},
  },
  render() {
    return h('div', [h(CardZoomModal as Component, {ref: 'cardZoom', ...this.bind}, this.$slots)]);
  },
});

type Stand = {
  host: VueWrapper<any>,
  /** The viewer's own wrapper — its DOM and what it emitted. */
  modal: VueWrapper<any>,
  /** What the host's ref answers. */
  viewer: Viewer,
  dialog: HTMLDialogElement,
  /** How many times the dialog was asked to open as a modal. */
  opened: () => number,
};

function stand(bind: Record<string, unknown>, slots: Record<string, (scope: Record<string, unknown>) => unknown> = {}): Stand {
  const host = mount(Host, {
    props: {bind: {card: HACKERS, ...bind}},
    slots: slots as any,
    global: {...globalConfig.global, stubs: {CardZoomCard: true, CardAnnotationsLayer: true}},
  });
  const dialog = host.find('dialog').element as HTMLDialogElement;
  let opened = 0;
  dialog.showModal = () => {
    opened++;
    dialog.setAttribute('open', '');
  };
  dialog.close = () => {
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new window.Event('close'));
  };
  return {
    host,
    modal: host.findComponent(CardZoomModal),
    viewer: host.vm.$refs.cardZoom as Viewer,
    dialog,
    opened: () => opened,
  };
}

/** The `navigate` events so far, as `[card name, index]`. */
function navigations(modal: VueWrapper<any>): Array<[string, number]> {
  return (modal.emitted('navigate') ?? []).map((args) => [(args[0] as CardModel).name, args[1] as number]);
}

describe('CardZoomModal', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    PreferencesManager.resetForTest();
    clock = createManualClock(0);
    setFlowClock(clock);
  });

  afterEach(() => {
    setFlowClock(undefined);
  });

  describe('what it renders', () => {
    it('one card: the dialog IS the root, with the stage, Close and the host\'s actions — and no browsing chrome', () => {
      const {modal} = stand({class: 'con-zoom'}, {actions: () => h('button', {class: 'host-action'}, 'Play')});
      // The template starts with its root: what the host lets fall through lands on the dialog itself.
      expect((modal.element as HTMLElement).tagName).to.eq('DIALOG');
      expect(modal.classes()).to.have.members(['card-zoom-dialog', 'con-zoom']);

      const stage = modal.find('.card-zoom-stage').findComponent(CardZoomCard);
      expect(stage.props('card')).to.deep.eq(HACKERS);
      expect(stage.props('selected')).to.eq(false);
      expect(modal.findComponent(CardAnnotationsLayer).props('cardName')).to.eq(CardName.HACKERS);

      expect(modal.find('.card-zoom-actions__panel [data-test="card-zoom-close"]').text()).to.eq('Close');
      expect(modal.find('.card-zoom-actions__panel .host-action').text()).to.eq('Play');

      expect(modal.find('.card-zoom-topbar').exists(), 'no counter').to.eq(false);
      expect(modal.find('.card-zoom-nav-slot').exists(), 'no arrows').to.eq(false);
      expect(modal.find('.card-zoom-preload').exists(), 'no neighbours to warm').to.eq(false);
      expect(modal.find('.card-zoom-side').exists()).to.eq(false);
      expect(modal.find('.card-zoom-aside').exists()).to.eq(false);
      expect(modal.find('.card-zoom-midrow').classes()).to.deep.eq(['card-zoom-midrow']);
    });

    it('a list: a bounded browser — the counter, both arrows, the edge one disabled WITH its reason', async () => {
      const {host, modal} = stand({cards: LIST, selected: true});
      expect(modal.classes()).to.include('card-zoom-dialog--nav');
      expect(modal.find('.card-zoom-counter__current').text()).to.eq('1');
      expect(modal.find('.card-zoom-counter__total').text()).to.eq('3');
      expect(modal.find('.card-zoom-stage').findComponent(CardZoomCard).props('selected')).to.eq(true);

      const prevSlot = modal.find('.card-zoom-nav-slot--prev');
      const nextSlot = modal.find('.card-zoom-nav-slot--next');
      expect(prevSlot.attributes('data-hint'), 'the hint stands on the wrapper — a disabled button never hovers').to.eq('This is the first card');
      expect(prevSlot.find('[data-test="card-zoom-prev"]').attributes('disabled')).to.not.eq(undefined);
      expect(nextSlot.attributes('data-hint')).to.eq('');
      expect(nextSlot.find('[data-test="card-zoom-next"]').attributes('disabled')).to.eq(undefined);

      // A host that states the position elsewhere turns the counter off — no band is drawn.
      await host.setProps({bind: {card: HACKERS, cards: LIST, navCounter: false}});
      expect(modal.find('.card-zoom-topbar').exists()).to.eq(false);
    });

    it('the two opt-in gutters appear with the slots a host fills, and hear the settle and the close', () => {
      const seen: Array<Record<string, unknown>> = [];
      const {modal} = stand({closing: true}, {
        side: (scope: Record<string, unknown>) => {
          seen.push(scope);
          return h('i', {class: 'rules-stub'});
        },
        aside: () => h('i', {class: 'party-stub'}),
      });
      expect(modal.find('.card-zoom-side > .rules-stub').exists()).to.eq(true);
      expect(modal.find('.card-zoom-aside > .party-stub').exists()).to.eq(true);
      expect(modal.find('.card-zoom-midrow').classes()).to.include.members(['card-zoom-midrow--side', 'card-zoom-midrow--flank']);
      expect(seen[0]).to.deep.eq({nonce: 0, closing: true});
    });
  });

  describe('what a host reaches through its ref', () => {
    it('the six members and its root (`rootEl`) — nothing else of the script', () => {
      const {viewer, dialog} = stand({});
      expect(Object.keys(viewer).sort(), 'the exposed list is the contract').to.deep.eq(
        ['close', 'fitCardToViewport', 'measureLanding', 'next', 'prev', 'rootEl', 'show']);
      // The console's flights (swap, depart, hand-off, dive) take the dialog off the ref — by the one name a child's
      // root is read by (components/rootEl.ts), never `$el`: a Vapor child's ref answers none.
      expect(viewer.rootEl).to.eq(dialog);
    });

    it('`show()` opens the dialog as a modal; `close()` closes an OPEN one and tells the host — once', () => {
      const {viewer, modal, dialog, opened} = stand({});
      viewer.close();
      expect(modal.emitted('close'), 'nothing was open').to.eq(undefined);

      viewer.show();
      expect(opened()).to.eq(1);
      expect(dialog.open).to.eq(true);
      expect(modal.emitted('navigate'), 'a single card has no position to report').to.eq(undefined);

      viewer.close();
      expect(dialog.open).to.eq(false);
      expect(modal.emitted('close')).to.deep.eq([[]]);
      viewer.close();
      expect(modal.emitted('close')).to.deep.eq([[]]);
    });

    it('`measureLanding()` measures a CLOSED dialog without opening it — nothing to measure under JSDOM, and no style is left behind', async () => {
      const {viewer, dialog, opened} = stand({});
      expect(await viewer.measureLanding()).to.eq(undefined);
      expect(opened()).to.eq(0);
      expect([dialog.style.display, dialog.style.visibility, dialog.style.pointerEvents]).to.deep.eq(['', '', '']);
      expect(clock.pending(), 'the fit retry it armed is taken back').to.eq(0);

      viewer.show();
      expect(await viewer.measureLanding(), 'an open viewer is not measured again').to.eq(undefined);
      expect(dialog.style.display).to.eq('');
    });

    it('`fitCardToViewport()` waits for a card face that is not there yet — ONE pending retry, bounded, never a throw', () => {
      const {viewer} = stand({});
      viewer.show();
      const standing = clock.pending();
      viewer.fitCardToViewport();
      viewer.fitCardToViewport();
      expect(clock.pending(), 'two calls, one retry frame').to.eq(standing + 1);
      // The retry is bounded: with no face ever arriving the clock runs dry on its own.
      clock.advance(5000);
      expect(clock.pending()).to.eq(0);
    });

    it('`prev()` / `next()` do nothing for a single card', async () => {
      const {viewer, modal} = stand({});
      viewer.show();
      viewer.next();
      viewer.prev();
      await nextTick();
      expect(modal.emitted('navigate')).to.eq(undefined);
      expect(modal.emitted('update:index')).to.eq(undefined);
    });
  });

  describe('browsing a list', () => {
    it('opens on the host\'s `index`, else on the card by name — and reports where it opened', async () => {
      const byIndex = stand({card: HACKERS, cards: LIST, index: 2});
      byIndex.viewer.show();
      await nextTick();
      expect(navigations(byIndex.modal)).to.deep.eq([[CardName.ALGAE, 2]]);
      expect(byIndex.modal.find('.card-zoom-counter__current').text()).to.eq('3');
      expect(byIndex.modal.emitted('update:index'), 'opening is not a step').to.eq(undefined);

      const byName = stand({card: AI_CENTRAL, cards: LIST});
      byName.viewer.show();
      await nextTick();
      expect(navigations(byName.modal)).to.deep.eq([[CardName.AI_CENTRAL, 1]]);
      expect(byName.modal.find('.card-zoom-counter__current').text()).to.eq('2');
    });

    it('steps one card at a time, reports each step, and stops at both ends', async () => {
      const {viewer, modal} = stand({cards: LIST});
      viewer.show();
      await nextTick();

      viewer.next();
      await nextTick();
      expect(modal.find('.card-zoom-counter__current').text()).to.eq('2');
      expect(modal.find('.card-zoom-stage').findComponent(CardZoomCard).props('card')).to.deep.eq(AI_CENTRAL);
      viewer.next();
      await nextTick();
      viewer.next(); // the last card: the edge is felt, nothing wraps
      await nextTick();
      expect(navigations(modal)).to.deep.eq([[CardName.HACKERS, 0], [CardName.AI_CENTRAL, 1], [CardName.ALGAE, 2]]);
      expect(modal.emitted('update:index')).to.deep.eq([[1], [2]]);
      expect(modal.find('.card-zoom-nav-slot--next').attributes('data-hint')).to.eq('This is the last card');

      viewer.prev();
      await nextTick();
      expect(navigations(modal).at(-1)).to.deep.eq([CardName.AI_CENTRAL, 1]);
      expect(modal.emitted('update:index')?.at(-1)).to.deep.eq([1]);
    });

    it('the arrows on screen and the arrow keys take the same steps — the keys only while THIS dialog is open', async () => {
      const {viewer, modal} = stand({cards: LIST});
      const key = (name: string): KeyboardEvent => {
        const event = new window.KeyboardEvent('keydown', {key: name, cancelable: true});
        window.dispatchEvent(event);
        return event;
      };
      expect(key('ArrowRight').defaultPrevented, 'closed: the key is not the viewer\'s').to.eq(false);
      expect(modal.emitted('navigate')).to.eq(undefined);

      viewer.show();
      await nextTick();
      expect(key('ArrowRight').defaultPrevented).to.eq(true);
      await nextTick();
      expect(navigations(modal).at(-1)).to.deep.eq([CardName.AI_CENTRAL, 1]);

      await modal.find('[data-test="card-zoom-prev"]').trigger('click');
      await nextTick();
      expect(navigations(modal).at(-1)).to.deep.eq([CardName.HACKERS, 0]);
    });

    it('warms the neighbours only AFTER the open frame — never in it', async () => {
      const {viewer, modal} = stand({card: AI_CENTRAL, cards: LIST});
      const warmed = () => modal.find('.card-zoom-preload').findAllComponents(CardZoomCard).map((c: {props: (key: string) => unknown}) => (c.props('card') as CardModel).name);
      viewer.show();
      await nextTick();
      expect(warmed()).to.deep.eq([]);

      clock.advance(100);
      await nextTick();
      expect(warmed()).to.deep.eq([CardName.HACKERS, CardName.ALGAE]);
    });

    it('a card taken out of the list under the open viewer: the one that slid into its place is reported', async () => {
      const {host, viewer, modal} = stand({cards: LIST});
      viewer.show();
      await nextTick();

      await host.setProps({bind: {card: HACKERS, cards: [AI_CENTRAL, ALGAE]}});
      expect(navigations(modal).at(-1)).to.deep.eq([CardName.AI_CENTRAL, 0]);
    });
  });

  describe('the settle signal and the ways it closes', () => {
    const nonce = (modal: VueWrapper<any>): number => modal.findComponent(CardAnnotationsLayer).props('nonce') as number;

    it('the rule overlay is told only once the card has LANDED, and is dismissed the moment the close begins', async () => {
      const {host, viewer, modal} = stand({});
      viewer.show();
      await nextTick();
      expect(nonce(modal), 'the card is still landing').to.eq(0);

      clock.advance(1000);
      await nextTick();
      expect(nonce(modal)).to.eq(1);

      // The console's close flight starts BEFORE the dialog closes: the overlay leaves first.
      await host.setProps({bind: {card: HACKERS, closing: true}});
      expect(nonce(modal)).to.eq(0);
    });

    it('a card re-pointed under the open viewer re-arms the signal; a host that suppresses the overlay holds it at 0', async () => {
      const {host, viewer, modal} = stand({});
      viewer.show();
      clock.advance(1000);
      await nextTick();
      expect(nonce(modal)).to.eq(1);

      await host.setProps({bind: {card: AI_CENTRAL}});
      expect(nonce(modal), 'the swap-in is still playing').to.eq(1);
      clock.advance(1000);
      await nextTick();
      expect(nonce(modal)).to.eq(2);

      await host.setProps({bind: {card: AI_CENTRAL, annotationsSuppressed: true}});
      expect(nonce(modal)).to.eq(0);
    });

    it('closing drops the signal, so a viewer that is opened again starts clean', async () => {
      const {viewer, modal} = stand({});
      viewer.show();
      clock.advance(1000);
      await nextTick();
      expect(nonce(modal)).to.eq(1);

      viewer.close();
      await nextTick();
      expect(nonce(modal)).to.eq(0);
      // A beat that was still pending when it closed never fires into the closed viewer.
      clock.advance(1000);
      await nextTick();
      expect(nonce(modal)).to.eq(0);
    });

    it('a tap on the backdrop and the native Esc dismiss it — unless the viewer is MANDATORY', async () => {
      const cancel = (dialog: HTMLDialogElement): boolean => {
        const event = new window.Event('cancel', {cancelable: true});
        dialog.dispatchEvent(event);
        return event.defaultPrevented;
      };

      const free = stand({});
      free.viewer.show();
      expect(cancel(free.dialog), 'Esc stays native').to.eq(false);
      // A click INSIDE the presentation area is not a backdrop tap.
      await free.modal.find('.card-zoom-container').trigger('click');
      expect(free.dialog.open).to.eq(true);
      await free.modal.trigger('click');
      expect(free.dialog.open).to.eq(false);
      expect(free.modal.emitted('close')).to.deep.eq([[]]);

      const mandatory = stand({dismissable: false});
      mandatory.viewer.show();
      expect(cancel(mandatory.dialog), 'the card must be taken').to.eq(true);
      await mandatory.modal.trigger('click');
      expect(mandatory.dialog.open).to.eq(true);
      expect(mandatory.modal.emitted('close')).to.eq(undefined);
    });
  });
});
