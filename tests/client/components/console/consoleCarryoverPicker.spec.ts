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

  it('«Тендеры»: a tender seat wears its tag; the PRELUDE BAND stands above the album — ↑ from the top row reaches it, A toggles, ↓ returns', async () => {
    const wrapper = mountPicker({
      limit: 3, tenderSeats: 1,
      eligiblePreludes: [CardName.ALLIED_BANK, CardName.BIOFUELS], preludeLimit: 1, selectedPreludes: [],
    });
    const vm = wrapper.vm as unknown as PickerApi & {zone: string, preludeCursor: number};
    // The manifest: three seats, the third a TENDER's — a tag on the place.
    expect(wrapper.findAll('[data-carry-seat]')).has.length(3);
    expect(wrapper.find('[data-carry-seat="3"]').attributes('data-carry-seat-tender')).eq('yes');
    expect(wrapper.find('[data-carry-seat="2"]').attributes('data-carry-seat-tender')).is.undefined;
    expect(wrapper.find('[data-carry-seat="3"] .con-carry__seat-tag').exists()).is.true;
    // The band: two played preludes, the count 0 / 1.
    expect(wrapper.findAll('[data-carry-prelude]')).has.length(2);
    expect(wrapper.find('[data-carry-prelude-count]').text()).eq('0 / 1');
    // ↑ against the album's top row reaches the band; the bar's verb turns to the prelude's.
    vm.handleIntent(nav('up'));
    await wrapper.vm.$nextTick();
    expect(vm.zone).eq('preludes');
    expect(wrapper.emitted('bar')?.at(-1)?.[0]).deep.include({primary: 'Carry the prelude'});
    // ▶ walks the band; A emits the prelude toggle (the host owns the draft).
    vm.handleIntent(nav('right'));
    vm.handleIntent(press('confirm'));
    expect(wrapper.emitted('togglePrelude')?.[0]).deep.eq([CardName.BIOFUELS]);
    expect(wrapper.emitted('toggle')).is.undefined;
    // The host's answer: the carried prelude wears its kant and band, the summary says so, the verb flips.
    await wrapper.setProps({selectedPreludes: [CardName.BIOFUELS]});
    expect(wrapper.find('[data-carry-prelude="Biofuels"]').attributes('data-carry-prelude-picked')).eq('yes');
    expect(wrapper.find('[data-carry-prelude-count]').text()).eq('1 / 1');
    expect(wrapper.find('[data-carry-prelude-summary]').text()).contains('1');
    expect(wrapper.emitted('bar')?.at(-1)?.[0]).deep.include({primary: 'Leave the prelude behind'});
    // A full allowance: A on the other prelude is a NAMED refusal, nothing emitted.
    vm.handleIntent(nav('left'));
    vm.handleIntent(press('confirm'));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('togglePrelude')).has.length(1);
    expect(wrapper.find('[data-carry-notice]').exists()).is.true;
    // ↓ returns to the album; A there is the card toggle again.
    vm.handleIntent(nav('down'));
    expect(vm.zone).eq('album');
    vm.handleIntent(press('confirm'));
    expect(wrapper.emitted('toggle')?.[0]).deep.eq([HAND[0]]);
  });

  it('«Тендеры» (§19 · §20): the ALBUM stands first; the door (L3) opens the LIST — A on a ready legacy tender carries it onto its ACTIVATION SHEET (the result in the seat\'s numbers; B back to the list); A stamps it: the album returns with the GHOST seat and ONE emit; a blocked one names its reason', async () => {
    const tenders = [
      {instance: 'c1', id: 'extendedLegacy', status: 'held', window: 'legacy'},
      {instance: 'c2', id: 'openCall', status: 'held', window: 'start', blocked: 'Executed at the finale\'s start'},
    ];
    const w = mountPicker({tenders});
    const vm = w.vm as unknown as {handleIntent(i: GamepadIntent): boolean, stage: string, tenderMode?: {instance: string}, sheet?: {instance: string, phase: string}};
    const settle = () => new Promise((r) => setTimeout(r, 650));
    /** The sheet's commit: the stamp's beat, the park of the list, the album's return (the motion's own clocks). */
    const settleCommit = () => new Promise((r) => setTimeout(r, 3200));
    /** A sheet's flight in or out (the flight measures its target for up to 40 frames where nothing paints). */
    const settleSheet = () => new Promise((r) => setTimeout(r, 1500));
    // (The wrapper is not attached to the document — a layer's presence is its v-show, never isVisible.)
    const shown = (sel: string) => (w.find(sel).element as HTMLElement).style.display !== 'none';
    expect(vm.stage, 'the album first — the page the legacy tenders change').to.eq('album');
    expect(shown('[data-carry-album-stage]')).to.eq(true);
    expect(w.find('[data-carry-tender-door]').attributes('data-carry-tender-door-ready'), 'the door says one executes here').to.eq('1');
    let bar = w.emitted('bar')!.at(-1)![0] as {stage: string, door?: {ready: number}};
    expect(bar).to.deep.include({stage: 'album', door: {ready: 1}});
    // L3 → the list: the ready certificate FIRST, the blocked one after it with its reason.
    vm.handleIntent(press('stickL'));
    await settle();
    expect(vm.stage).to.eq('list');
    expect(shown('[data-carry-tenders-stage]')).to.eq(true);
    const slots = w.findAll('[data-tport-slot]');
    expect(slots.map((s) => s.attributes('data-tport-kind'))).to.deep.eq(['extendedLegacy', 'openCall']);
    expect(slots[1].attributes('data-tport-state')).to.eq('blocked');
    expect(w.find('[data-tport-reason]').text()).to.contain('finale');
    bar = w.emitted('bar')!.at(-1)![0] as {stage: string};
    expect(bar).to.deep.include({stage: 'list', primary: 'Execute', primaryEnabled: true});
    // ▶ to the blocked one: A says the reason, nothing else happens.
    vm.handleIntent(nav('right'));
    vm.handleIntent(press('confirm'));
    await w.vm.$nextTick();
    expect(vm.tenderMode).to.eq(undefined);
    // ◀ back, A → the ACTIVATION SHEET: the certificate as its hero, the RESULT in the seat's numbers («2 → 3»).
    vm.handleIntent(nav('left'));
    vm.handleIntent(press('confirm'));
    await settleSheet();
    expect(vm.sheet?.instance).to.eq('c1');
    expect(vm.sheet?.phase).to.eq('open');
    expect(w.find('[data-tender-sheet]').attributes('data-tender-sheet-id')).to.eq('extendedLegacy');
    expect(w.find('[data-tsheet-row="Legacy seats"] [data-tsheet-from]').text()).to.eq('2');
    expect(w.find('[data-tsheet-row="Legacy seats"] [data-tsheet-to]').text()).to.eq('3');
    bar = w.emitted('bar')!.at(-1)![0] as {stage: string};
    expect(bar).to.deep.include({stage: 'sheet', primary: 'Execute the tender', primaryEnabled: true});
    // B — one level back to the list, nothing sent.
    vm.handleIntent(press('back'));
    await settleSheet();
    expect(vm.sheet).to.eq(undefined);
    expect(vm.stage).to.eq('list');
    expect(w.emitted('executeTender')).to.eq(undefined);
    // A → the sheet again; A executes: the stamp, the album back with the GHOST seat «+3», then ONE emit.
    vm.handleIntent(press('confirm'));
    await settleSheet();
    vm.handleIntent(press('confirm'));
    await settleCommit();
    expect(vm.stage).to.eq('album');
    expect(vm.sheet).to.eq(undefined);
    expect(vm.tenderMode?.instance).to.eq('c1');
    expect(w.findAll('[data-carry-seat]')).to.have.length(3);
    expect(w.find('[data-carry-seat="3"]').attributes('data-carry-seat-ghost')).to.eq('yes');
    expect(w.emitted('executeTender')?.map((e) => e[0])).to.deep.eq(['c1']);
    // The activation LANDED: the ghost is the REAL seat now (the same place), the mode ends.
    await w.setProps({tenders: [{...tenders[0], status: 'executed'}, tenders[1]], limit: 3, tenderSeats: 1});
    expect(vm.tenderMode).to.eq(undefined);
    expect(w.findAll('[data-carry-seat]')).to.have.length(3);
    expect(w.find('[data-carry-seat="3"]').attributes('data-carry-seat-tender')).to.eq('yes');
    expect(w.find('[data-carry-seat="3"]').attributes('data-carry-seat-ghost')).to.eq(undefined);
    expect(w.find('[data-carry-tender-door]').attributes('data-carry-tender-door-ready'), 'nothing left to execute here').to.eq('0');
  }).timeout(15_000);

  it('«Тендеры»: the readiness RT WARNS while a legacy tender is still executable; B disarms; then the zero-card arm; then the confirm', async () => {
    const w = mountPicker({tenders: [{instance: 'c1', id: 'extendedLegacy', status: 'held', window: 'legacy'}]});
    const vm = w.vm as unknown as {handleIntent(i: GamepadIntent): boolean, armed: boolean};
    vm.handleIntent(press('triggerR'));
    await w.vm.$nextTick();
    expect(w.find('[data-carry-tender-warning]').text()).to.contain('Extended Legacy');
    expect(w.emitted('confirm')).to.eq(undefined);
    vm.handleIntent(press('back'));
    await w.vm.$nextTick();
    expect(w.find('[data-carry-tender-warning]').exists()).to.eq(false);
    vm.handleIntent(press('triggerR'));
    vm.handleIntent(press('triggerR'));
    expect(vm.armed, 'the zero-card confirm arms after the tender warning').to.eq(true);
    vm.handleIntent(press('triggerR'));
    expect(w.emitted('confirm')).to.have.length(1);
    vm.handleIntent(press('back'));
    vm.handleIntent(press('back'));
    expect(w.emitted('back'), 'B on the album (past the standing arm) closes the step').to.have.length(1);
  });

  it('«Продление программы»: the prelude band\'s place is RESERVED (locked) from the first frame — the activation changes the album\'s size by nothing; the mode previews a PRELUDE ghost seat beside the project seats', async () => {
    const w = mountPicker({
      tenders: [{instance: 'p1', id: 'programExtension', status: 'held', window: 'legacy'}],
      eligiblePreludes: [CardName.ALLIED_BANK, CardName.BIOFUELS],
    });
    const vm = w.vm as unknown as {handleIntent(i: GamepadIntent): boolean, tenderMode?: {instance: string}, sheet?: {phase: string}};
    expect(w.find('[data-carry-preludes]').attributes('data-carry-preludes-locked'), 'reserved, locked').to.eq('yes');
    expect(w.findAll('[data-carry-prelude-seat]')).to.have.length(0);
    // ↑ into a LOCKED band is refused — the album keeps the cursor.
    vm.handleIntent(nav('up'));
    expect((w.vm as unknown as {zone: string}).zone).to.eq('album');
    vm.handleIntent(press('stickL'));
    await new Promise((r) => setTimeout(r, 650));
    vm.handleIntent(press('confirm'));
    await new Promise((r) => setTimeout(r, 1500));
    expect(vm.sheet?.phase, 'the sheet stands first').to.eq('open');
    expect(w.find('[data-tsheet-row="Preludes into the finale"] [data-tsheet-to]').text()).to.eq('1');
    vm.handleIntent(press('confirm'));
    await new Promise((r) => setTimeout(r, 3200));
    expect(vm.tenderMode?.instance).to.eq('p1');
    expect(w.find('[data-carry-prelude-seat="1"]').attributes('data-carry-seat-ghost')).to.eq('yes');
    await w.setProps({tenders: [{instance: 'p1', id: 'programExtension', status: 'executed', window: 'legacy'}], preludeLimit: 1});
    expect(w.find('[data-carry-preludes]').attributes('data-carry-preludes-locked'), 'the same band, live').to.eq(undefined);
    expect(w.find('[data-carry-prelude-seat="1"]').attributes('data-carry-seat-ghost')).to.eq(undefined);
    expect((w.vm as unknown as {zone: string}).zone, 'the cursor goes where the choice is').to.eq('preludes');
  }).timeout(15_000);

  it('no prelude allowance (a titles campaign): no band, ↑ on the top row stays in the album', () => {
    const wrapper = mountPicker();
    const vm = wrapper.vm as unknown as PickerApi & {zone: string};
    expect(wrapper.find('[data-carry-preludes]').exists()).is.false;
    vm.handleIntent(nav('up'));
    expect(vm.zone).eq('album');
    expect(vm.cursor).eq(0);
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
