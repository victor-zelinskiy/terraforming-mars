/*
 * ConsoleTableReceipt — «КВИТАНЦИЯ СТОЛА»: the cards a payout landed on, as ONE row of faces, each with the reading
 * of its change under it. The row is SOLVED from the pane's own box (mount, a new receipt, a resize); a capsule reads
 * the TOUCHDOWN (`cardResourceLanded`), never the record. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): host-agnostic — it emits and exposes nothing.
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {artTierForWidth} from '@/client/cards/cardArt';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {cardResourceLandings, resetCardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {planReceiptRow, RECEIPT_CARD_W, ReceiptCard, TableReceipt} from '@/client/console/parliament/tableReceiptBeat';
import ConsoleTableReceipt from '@/client/components/console/parliament/ConsoleTableReceipt.vue';

// The face is the premium card — its own specs' subject; this one reads what the row HANDS it.
const CardStub = defineComponent({
  name: 'CardFace',
  props: {card: Object, lightweight: Boolean, inert: Boolean, artTier: String},
  render: () => h('i', {class: 'card-stub'}),
});

const share = (card: CardName, before: number, amount: number, vp?: {from: number, to: number}): ReceiptCard =>
  ({card, resource: 'Animal', iconKey: 'animal', before, amount, ...(vp === undefined ? {} : {vp})});
const receiptOf = (key: string, cards: ReadonlyArray<ReceiptCard>): TableReceipt => ({key, player: 'blue', generation: 3, cards, specs: []});

const PETS = share(CardName.PETS, 2, 2, {from: 1, to: 2});
const BIRDS = share(CardName.BIRDS, 0, 1, {from: 0, to: 0});
const FISH = share(CardName.FISH, 4, 1);
const RECEIPT = receiptOf('first', [PETS, BIRDS, FISH]);

function row(props: Record<string, unknown> = {}) {
  return mount(ConsoleTableReceipt, {
    ...globalConfig,
    props: {receipt: RECEIPT, ...props},
    global: {...globalConfig.global, stubs: {Card: CardStub}},
  });
}

/** JSDOM lays nothing out: the spec lends every element ONE box (the pane's — no padding, no tag height here) and gives it back. */
function lendBox(box: {width: number, height: number}): () => void {
  const proto = HTMLElement.prototype;
  Object.defineProperty(proto, 'clientWidth', {configurable: true, get: () => box.width});
  Object.defineProperty(proto, 'clientHeight', {configurable: true, get: () => box.height});
  return () => {
    delete (proto as unknown as {clientWidth?: number}).clientWidth;
    delete (proto as unknown as {clientHeight?: number}).clientHeight;
  };
}

/** The row the component must solve for a pane and a card count — the planner's own answer, rounded as the row rounds it. */
function solved(box: {width: number, height: number}, count: number): {zoom: number, gap: number} {
  const plan = planReceiptRow({availW: box.width, availH: box.height, count, ui: conUiScale(), tagH: 0});
  return {zoom: Math.round(plan.zoom * 1000) / 1000, gap: Math.round(plan.gap)};
}

const styleOf = (r: {zoom: number, gap: number}): Array<string> => [`--con-receipt-zoom: ${r.zoom}`, `--con-receipt-gap: ${r.gap}px`];

describe('ConsoleTableReceipt — «КВИТАНЦИЯ СТОЛА»: the receiving cards as one row', () => {
  beforeEach(resetCardResourceLandings);
  afterEach(resetCardResourceLandings);

  it('a card per recipient with the reading of its change; the points only where they MOVE; no face before the row is solved', () => {
    const w = row({phase: 'present'});
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include('con-receipt');
    expect(w.attributes('data-table-receipt')).to.not.eq(undefined);
    expect(w.attributes('data-receipt-phase')).to.eq('present');
    expect(w.attributes('data-receipt-cards')).to.eq('3');
    for (const part of styleOf({zoom: 0.6, gap: 24})) {
      expect(w.attributes('style'), 'the pane has no box here — the row keeps its opening guess').to.include(part);
    }

    const cards = w.findAll('[data-receipt-card]');
    expect(cards.map((c) => c.attributes('data-receipt-card'))).to.deep.eq([CardName.PETS, CardName.BIRDS, CardName.FISH]);
    expect(cards.map((c) => c.attributes('data-receipt-kind'))).to.deep.eq(['animal', 'animal', 'animal']);
    expect(cards.map((c) => c.attributes('data-receipt-count')), 'nothing has touched down yet').to.deep.eq(['2', '0', '4']);
    expect(cards.map((c) => c.find('.con-receipt__from').text())).to.deep.eq(['2', '0', '4']);
    expect(cards.map((c) => c.find('.con-receipt__count .con-receipt__to').text())).to.deep.eq(['4', '1', '5']);
    expect(cards[0].find('i.con-receipt__unit').classes()).to.include.members(iconClassFor('animal').split(' ').filter((c) => c !== ''));

    // «ПО 1 → 2» where the points move; a card whose points stand (or that reads none) keeps the line's room, empty.
    expect(cards.map((c) => c.find('.con-receipt__vp').attributes('data-receipt-vp'))).to.deep.eq(['1-2', undefined, undefined]);
    expect(cards.map((c) => c.find('.con-receipt__vp').classes().includes('con-receipt__vp--none'))).to.deep.eq([false, true, true]);
    expect(cards[0].find('.con-receipt__vp-word').text()).to.eq($t('VP'));
    expect(cards[1].find('.con-receipt__vp').text()).to.eq('');

    expect(w.findComponent(CardStub).exists(), 'a face mounts once the row is SOLVED').to.eq(false);
  });

  it('a capsule reads the TOUCHDOWN: the count follows what has landed, «landed» only once the whole share has', async () => {
    const w = row();
    const pets = () => w.find(`[data-receipt-card="${CardName.PETS}"]`);
    expect(pets().classes()).to.not.include('con-receipt__card--landed');

    cardResourceLandings.by = {[CardName.PETS]: 1};
    await nextTick();
    expect(pets().attributes('data-receipt-count')).to.eq('3');
    expect(pets().attributes('data-receipt-landed')).to.eq(undefined);

    cardResourceLandings.by = {[CardName.PETS]: 5};
    await nextTick();
    expect(pets().attributes('data-receipt-count'), 'never more than the share').to.eq('4');
    expect(pets().attributes('data-receipt-landed')).to.eq('');
    expect(pets().classes()).to.include('con-receipt__card--landed');
    expect(pets().find('.con-receipt__count .con-receipt__to').text(), 'the reading is the RECORD\'s, whatever has landed').to.eq('4');
  });

  it('THE ROW is solved from the pane\'s box on mount — the faces then stand in the tier their width paints; a NEW receipt re-solves it', async () => {
    const box = {width: 1200, height: 700};
    const giveBack = lendBox(box);
    try {
      cardResourceLandings.by = {[CardName.PETS]: 1};
      const w = row();
      await nextTick();
      const first = solved(box, 3);
      for (const part of styleOf(first)) {
        expect(w.attributes('style')).to.include(part);
      }
      const faces = w.findAllComponents(CardStub);
      expect(faces.map((f) => f.props('card')), 'the card and what stands on it NOW').to.deep.eq([
        {name: CardName.PETS, resources: 3}, {name: CardName.BIRDS, resources: 0}, {name: CardName.FISH, resources: 4},
      ]);
      expect(faces.every((f) => f.props('lightweight') === true && f.props('inert') === true)).to.eq(true);
      expect(faces.map((f) => f.props('artTier'))).to.deep.eq(Array(3).fill(artTierForWidth(RECEIPT_CARD_W * first.zoom)));

      // The same receipt with other cards is no new row: only its KEY re-solves (on the tick after the render).
      box.width = 500;
      await w.setProps({receipt: receiptOf('first', [PETS])});
      await nextTick();
      await nextTick();
      for (const part of styleOf(first)) {
        expect(w.attributes('style'), 'same key — the row stands').to.include(part);
      }
      await w.setProps({receipt: receiptOf('second', [PETS, FISH])});
      await nextTick();
      await nextTick();
      const second = solved(box, 2);
      expect(second, 'a narrower pane, another row').to.not.deep.eq(first);
      for (const part of styleOf(second)) {
        expect(w.attributes('style')).to.include(part);
      }
    } finally {
      giveBack();
    }
  });

  it('a RESIZE of the pane re-solves the row — the observer stands on the root and leaves with it', async () => {
    class FakeObserver {
      static made: Array<FakeObserver> = [];
      targets: Array<Element> = [];
      disconnected = false;
      private readonly changed: () => void;
      constructor(changed: () => void) {
        this.changed = changed;
        FakeObserver.made.push(this);
      }
      observe(el: Element): void {
        this.targets.push(el);
      }
      disconnect(): void {
        this.disconnected = true;
      }
      fire(): void {
        this.changed();
      }
    }
    // JSDOM has no ResizeObserver: the spec lends one for this test and gives it back.
    const host = globalThis as unknown as {ResizeObserver?: unknown};
    const had = host.ResizeObserver;
    host.ResizeObserver = FakeObserver;
    const box = {width: 1200, height: 700};
    const giveBack = lendBox(box);
    try {
      const w = row();
      await nextTick();
      expect(FakeObserver.made).to.have.length(1);
      const observer = FakeObserver.made[0];
      expect(observer.targets).to.deep.eq([w.element as Element]);

      box.width = 500;
      observer.fire();
      await nextTick();
      for (const part of styleOf(solved(box, 3))) {
        expect(w.attributes('style')).to.include(part);
      }

      w.unmount();
      expect(observer.disconnected).to.eq(true);
    } finally {
      giveBack();
      if (had === undefined) {
        delete host.ResizeObserver;
      } else {
        host.ResizeObserver = had;
      }
    }
  });
});
