/*
 * ConsoleDraftTray — the draft's ONE «selected cards» area on the table. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its props (the server's drafted cards, the wait state) and for
 * the tray's module state (`draftTrayState` — the optimistic pile, the held slots, the table beat, set-complete), the
 * slot resolver it registers for the flight directors while it is mounted, and the two one-shot accents it times on
 * its own flow scope. It emits nothing and exposes nothing (the shell stands no ref on it).
 *
 * (The tray's MODEL — `consoleDraftTray.ts` — has its own spec: tests/client/components/console/consoleDraftTray.spec.ts.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleDraftTray from '@/client/components/console/cardDeal/ConsoleDraftTray.vue';
import {draftTrayState, resetDraftTray, resolveTraySlot} from '@/client/console/cardDeal/consoleDraftTray';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

// The card face is the premium renderer; this spec is about the TRAY — what each slot hands its face.
// (A render function, not a template string: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object, required: true}, lightweight: Boolean},
  render() {
    const card = this.card as Partial<CardModel>;
    return h('i', {
      'class': 'card-stub',
      'data-name': card.name,
      'data-cost': card.calculatedCost === undefined ? 'none' : String(card.calculatedCost),
      'data-lightweight': String(this.lightweight),
    });
  },
});

const STUBS = {Card: CardStub, GamepadGlyph: true};

function view(drafted: ReadonlyArray<Partial<CardModel>>): PlayerViewModel {
  return {draftedCards: drafted} as unknown as PlayerViewModel;
}

function mountTray(props: {playerView: PlayerViewModel, waiting?: boolean}) {
  return mount(ConsoleDraftTray, {global: {...globalConfig.global, stubs: STUBS}, props});
}

describe('ConsoleDraftTray — the draft\'s selected-cards area', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    resetDraftTray();
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
    resetDraftTray();
  });

  it('the pile: the server\'s drafted cards plus the optimistic ones, a slot each (its name, its paint order, its face lightweight) — and no pile for an empty tray', async () => {
    const wrapper = mountTray({playerView: view([])});
    expect(wrapper.classes()).to.deep.eq(['con-drafttray']);
    expect(wrapper.attributes('role')).to.eq('status');
    expect(wrapper.find('.con-drafttray__pile').exists(), 'nothing drafted — no pile').to.eq(false);

    draftTrayState.pending = [CardName.BIRDS];
    await wrapper.setProps({playerView: view([{name: CardName.ANTS, calculatedCost: 9}])});

    expect(wrapper.find('.con-drafttray__label').text()).to.eq('DRAFTED CARDS');
    expect(wrapper.find('.con-drafttray__count').text()).to.eq('2');
    const slots = wrapper.findAll('.con-drafttray__slot');
    expect(slots.map((s) => s.attributes('data-tray-slot'))).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    expect(slots.map((s) => (s.element as HTMLElement).style.zIndex)).to.deep.eq(['1', '2']);
    const faces = wrapper.findAll('.con-drafttray__slot > .card-stub');
    expect(faces.map((f) => f.attributes('data-name'))).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
    expect(faces.map((f) => f.attributes('data-cost')), 'the server\'s model where it has one, the bare name for an optimistic card')
      .to.deep.eq(['9', 'none']);
    expect(faces.map((f) => f.attributes('data-lightweight'))).to.deep.eq(['true', 'true']);
  });

  it('the states: a held slot, the table beat, set-complete, the wait banner with its inspect hint, the «processing» readout', async () => {
    const wrapper = mountTray({playerView: view([{name: CardName.ANTS}, {name: CardName.BIRDS}])});
    expect(wrapper.find('.con-draftwait').exists()).to.eq(false);
    expect(wrapper.find('.con-drafttray__processing').exists()).to.eq(false);
    expect(wrapper.find('.con-drafttray__hint').exists()).to.eq(false);

    draftTrayState.held = [CardName.BIRDS];
    draftTrayState.tableView = true;
    draftTrayState.setComplete = true;
    draftTrayState.processing = true;
    await nextTick();
    expect(wrapper.classes()).to.include('con-drafttray--table');
    expect(wrapper.findAll('.con-drafttray__slot').map((s) => s.classes('con-deal-hold')), 'the slot a proxy still flies to is held')
      .to.deep.eq([false, true]);
    expect(wrapper.find('.con-drafttray__pile').classes()).to.include('con-drafttray__pile--complete');
    expect(wrapper.find('.con-drafttray__label').text()).to.eq('Draft set complete');
    expect(wrapper.find('.con-drafttray__processing').text()).to.eq('Processing selection…');

    await wrapper.setProps({waiting: true});
    expect(wrapper.find('.con-draftwait .con-draftwait__title').text()).to.eq('Waiting for draft cards');
    expect(wrapper.find('.con-drafttray__hint').text()).to.eq('Inspect');
    expect(wrapper.find('.con-drafttray__processing').exists(), 'the wait banner stands in the readout\'s place').to.eq(false);
  });

  it('registers the slot resolver the flight directors land by — while it is mounted, and only then', () => {
    const wrapper = mountTray({playerView: view([{name: CardName.ANTS}, {name: CardName.BIRDS}])});
    expect(resolveTraySlot(CardName.BIRDS), 'the slot\'s own node').to.eq(wrapper.find(`[data-tray-slot="${CardName.BIRDS}"]`).element);
    expect(resolveTraySlot(CardName.COMET), 'a card that is not in the tray has no slot').to.eq(null);

    wrapper.unmount();
    expect(resolveTraySlot(CardName.BIRDS), 'no tray — no slot').to.eq(null);
  });

  it('a touchdown accents ITS OWN slot and the set-complete beat pulses the pile — each a one-shot that ends on the tray\'s own clock', async () => {
    const wrapper = mountTray({playerView: view([{name: CardName.ANTS}, {name: CardName.BIRDS}])});
    const landed = () => wrapper.findAll('.con-drafttray__slot').map((s) => s.classes('con-drafttray__slot--landed'));
    const pulsing = () => wrapper.find('.con-drafttray__pile').classes('con-drafttray__pile--pulse');
    expect(landed()).to.deep.eq([false, false]);
    expect(pulsing()).to.eq(false);

    draftTrayState.lastLand = {n: draftTrayState.lastLand.n + 1, name: CardName.BIRDS};
    draftTrayState.pulseNonce++;
    await nextTick();
    await nextTick();
    await nextTick();
    expect(landed(), 'the landing accents the slot it landed on — never its neighbours').to.deep.eq([false, true]);
    expect(pulsing()).to.eq(true);
    expect(clock.pending(), 'each accent is one owned wait of the tray\'s flow scope').to.eq(2);

    clock.advance(2000);
    await nextTick();
    expect(landed()).to.deep.eq([false, false]);
    expect(pulsing()).to.eq(false);
    expect(clock.pending()).to.eq(0);
  });
});
