import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleCarryoverPicker from '@/client/components/console/campaign/ConsoleCarryoverPicker.vue';
import ConsoleCardAlbum from '@/client/components/console/foundation/ConsoleCardAlbum.vue';
import {CardName} from '@/common/cards/CardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

/**
 * «НАСЛЕДИЕ ПРОЕКТОВ» ON THE HAND ALBUM'S CHASSIS (P87 — the owner, 2026-11-01): the cards stand in an album of strict
 * pages, keeping is a TOGGLE IN PLACE (a kant + the ordinal band — no slot the card flies into, no empty socket to
 * press), the seats are a manifest of names, the limit is the SEAT's number, LB / RB turn the page, and a full set of
 * seats is a named refusal — never a dimmed hand.
 */
const HAND: ReadonlyArray<CardName> = [
  CardName.ALGAE, CardName.ANTS, CardName.BIRDS, CardName.CARTEL, CardName.FISH, CardName.PETS, CardName.LICHEN,
  CardName.MANGROVE, CardName.SOLAR_WIND_POWER, CardName.TREES, CardName.HEATHER, CardName.KELP_FARMING,
  CardName.ADAPTED_LICHEN, CardName.ASTEROID,
];

type PickerApi = {handleIntent(intent: GamepadIntent): boolean, cursor: number, armed: boolean, notice: string};

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(ConsoleCarryoverPicker, {
    ...globalConfig,
    props: {eligible: HAND, selected: [], limit: 2, nextMission: 2, ...props},
  });
}
const press = (button: string): GamepadIntent => ({kind: 'press', button} as GamepadIntent);
const nav = (dir: 'left' | 'right' | 'up' | 'down'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

describe('ConsoleCarryoverPicker — the album chassis (P87)', () => {
  it('stands on ConsoleCardAlbum + the ONE head + the spine; no keep-slots, no sockets', async () => {
    const w = mountPicker();
    await w.vm.$nextTick();
    expect(w.findComponent(ConsoleCardAlbum).exists()).is.true;
    expect(w.find('.con-wshead').exists(), 'the ONE workspace head').is.true;
    expect(w.find('[data-album-spine]').exists(), 'the spine in the foot').is.true;
    expect(w.find('[data-carry-slot]').exists()).is.false;
    expect(w.find('.con-carry__card--away').exists()).is.false;
    // 14 cards on a 5 × 2 page: two pages, both mounted (the active page ± 1).
    expect(w.findAll('.con-album__slot')).to.have.length(14);
  });

  it('A keeps the focused card IN PLACE — its kant and band come from the selection, the seat manifest names it', async () => {
    const w = mountPicker();
    (w.vm as unknown as PickerApi).handleIntent(press('confirm'));
    expect(w.emitted('toggle')).to.deep.eq([[CardName.ALGAE]]);
    await w.setProps({selected: [CardName.ALGAE]});
    const slot = w.find(`[data-album-slot="${CardName.ALGAE}"]`);
    expect(slot.classes()).to.include('con-album__slot--picked');
    expect(slot.find('[data-album-band]').exists()).is.true;
    expect(w.find('[data-carry-seat="1"]').attributes('data-carry-seat-card')).to.eq(CardName.ALGAE);
    expect(w.find('[data-carry-seat="2"]').attributes('data-carry-seat-card')).to.eq(undefined);
  });

  it('A on a kept card RETURNS it — the same key on the same object', () => {
    const w = mountPicker({selected: [CardName.ALGAE]});
    (w.vm as unknown as PickerApi).handleIntent(press('confirm'));
    expect(w.emitted('toggle')).to.deep.eq([[CardName.ALGAE]]);
  });

  it('full seats: A on another card is a NAMED refusal, the hand is never dimmed', async () => {
    const w = mountPicker({selected: [CardName.ANTS, CardName.BIRDS]});
    const api = w.vm as unknown as PickerApi;
    api.handleIntent(press('confirm')); // the cursor stands on ALGAE — not kept
    expect(w.emitted('toggle')).to.eq(undefined);
    await w.vm.$nextTick();
    expect(w.find('[data-carry-notice]').exists()).is.true;
    expect(w.findAll('.con-album__slot--disabled')).to.have.length(0);
  });

  it('the limit is the SEAT\'s: three seats under a limit of 3, the third card still keeps', () => {
    const w = mountPicker({limit: 3, selected: [CardName.ANTS, CardName.BIRDS]});
    expect(w.findAll('[data-carry-seat]')).to.have.length(3);
    (w.vm as unknown as PickerApi).handleIntent(press('confirm'));
    expect(w.emitted('toggle')).to.deep.eq([[CardName.ALGAE]]);
  });

  it('LB / RB turn the page; the d-pad walks the hand order', () => {
    const w = mountPicker();
    const api = w.vm as unknown as PickerApi;
    api.handleIntent(nav('right'));
    expect(api.cursor).to.eq(1);
    api.handleIntent(press('bumperR'));
    expect(api.cursor, 'the same slot on page 2').to.eq(11);
    api.handleIntent(press('bumperL'));
    expect(api.cursor).to.eq(1);
  });

  it('RT over a real hand with nothing kept is ARMED first; B disarms; the second RT confirms', () => {
    const w = mountPicker();
    const api = w.vm as unknown as PickerApi;
    api.handleIntent(press('triggerR'));
    expect(api.armed).is.true;
    expect(w.emitted('confirm')).to.eq(undefined);
    api.handleIntent(press('back'));
    expect(api.armed).is.false;
    expect(w.emitted('back')).to.eq(undefined);
    api.handleIntent(press('triggerR'));
    api.handleIntent(press('triggerR'));
    expect(w.emitted('confirm')).to.have.length(1);
  });

  it('an empty hand confirms readiness with one RT, no album', () => {
    const w = mountPicker({eligible: []});
    expect(w.findComponent(ConsoleCardAlbum).exists()).is.false;
    (w.vm as unknown as PickerApi).handleIntent(press('triggerR'));
    expect(w.emitted('confirm')).to.have.length(1);
  });

  it('the bar facts follow the focus: «keep» on a free card, «return» on a kept one', async () => {
    const w = mountPicker({selected: [CardName.ALGAE]});
    const bars = () => w.emitted('bar') as Array<Array<{primary: string}>>;
    expect(bars()[bars().length - 1][0].primary).to.eq('Return to hand');
    (w.vm as unknown as PickerApi).handleIntent(nav('right'));
    await w.vm.$nextTick();
    expect(bars()[bars().length - 1][0].primary).to.eq('Keep for the next mission');
  });
});
