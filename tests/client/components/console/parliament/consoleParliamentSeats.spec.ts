/*
 * ConsoleParliamentSeats — the DELEGATES ZONE of the Parliament's head line: every participating seat's lobby socket
 * and reserve stack, the neutral supply, the deck and the discard — as SHOWN (the live view under the sitting's
 * display holds). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md); it emits and exposes nothing —
 * its contract is what it renders for its view, its props and the module state it stands on.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {emptyParliamentView, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {rivalVotes} from '@/client/console/parliament/parliamentRivalVotes';
import ConsoleParliamentSeats from '@/client/components/console/parliament/ConsoleParliamentSeats.vue';

// The delegate figure is its own spec's subject; this one reads what the zone HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, glow: {type: Boolean, default: true}, steel: Boolean},
  render: () => h('i', {class: 'delegate-stub'}),
});

const RED: Color = 'red';
const BLUE: Color = 'blue';
const GREEN: Color = 'green';

type Seat = ParliamentViewVm['players'][number];

function seat(color: Color, over: Partial<Seat> = {}): Seat {
  return {
    color, name: color.toUpperCase(), participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    ...over,
  } as Seat;
}

function view(over: Partial<ParliamentViewVm> = {}): ParliamentViewVm {
  return {
    ...emptyParliamentView(),
    players: [seat(RED, {reserve: 5}), seat(BLUE, {lobby: false, reserve: 2}), seat(GREEN, {participates: false})],
    neutralSupply: 7, deckSize: 28, discardSize: 0,
    ...over,
  };
}

function zone(props: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentSeats as any, {
    ...globalConfig,
    props: {view: view(), viewerColor: RED, benchSource: 'none', ...props},
    global: {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub}},
  });
}

describe('ConsoleParliamentSeats — the delegates zone', () => {
  beforeEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
  });
  afterEach(() => {
    rivalVotes.flying = undefined;
    resetParliamentFlow();
    resetParliamentHolds();
  });

  it('one group per PARTICIPATING seat — the lobby socket, the reserve as ≤ 3 figures and its count — then the neutral supply and the two piles', () => {
    const w = zone();
    expect(w.classes()).to.include('con-parl__seats');
    expect(w.attributes('data-parl-seats')).to.not.eq(undefined);

    const groups = w.findAll('[data-parl-seat]');
    expect(groups.map((g) => g.attributes('data-parl-seat')), 'a seat that holds no delegates has no group').to.deep.eq([RED, BLUE]);
    expect(groups.map((g) => g.classes().includes('con-parl__seat--me'))).to.deep.eq([true, false]);
    expect(groups.map((g) => g.find('.con-parl__seat-name').text())).to.deep.eq(['RED', 'BLUE']);
    expect(groups.map((g) => g.find('.con-parl__seat-dot').classes().includes('player_bg_color_' + g.attributes('data-parl-seat')))).to.deep.eq([true, true]);

    // The lobby: one socket — the free delegate waits there, or it is spent.
    const sockets = groups.map((g) => g.find('[data-parl-seat-lobby]'));
    expect(sockets.map((s) => s.classes().includes('con-parl__socket--empty'))).to.deep.eq([false, true]);
    expect(sockets.map((s) => s.find('.delegate-stub').exists())).to.deep.eq([true, false]);
    expect(groups[0].find('[data-parl-seat-place="lobby"]').attributes('aria-label')).to.eq($t('Lobby'));

    // The reserve: the stack shows at most three figures, the count says them all.
    const stacks = groups.map((g) => g.find('[data-parl-seat-reserve]'));
    expect(stacks.map((s) => s.attributes('data-count'))).to.deep.eq(['5', '2']);
    expect(stacks.map((s) => s.findAll('.con-parl__stack-cube').length)).to.deep.eq([3, 2]);
    expect(groups.map((g) => g.find('[data-parl-seat-place="reserve"] .con-parl__seat-count').text())).to.deep.eq(['×5', '×2']);
    expect(stacks.some((s) => s.attributes('data-parl-seat-landed') !== undefined), 'nothing has landed yet').to.eq(false);
    expect(w.find('[data-parl-seat-incoming]').exists()).to.eq(false);

    // Every figure on the ledger is a physical delegate in its seat's colour, drawn without its glow; the supply's are steel.
    const figures = w.findAllComponents(DelegateStub);
    expect(figures.map((f) => f.props('color'))).to.deep.eq([RED, RED, RED, RED, BLUE, BLUE, 'neutral', 'neutral', 'neutral']);
    expect(figures.every((f) => f.props('glow') === false)).to.eq(true);
    expect(figures.map((f) => f.props('steel'))).to.deep.eq([false, false, false, false, false, false, true, true, true]);

    const pool = w.find('[data-parl-neutral-pool]');
    expect(pool.find('.con-parl__seat-name').text()).to.eq($t('Neutral'));
    expect(pool.find('[data-parl-neutral-cube]').attributes('data-count')).to.eq('7');
    expect(pool.find('.con-parl__seat-count').text()).to.eq('×7');
    expect(pool.find('[data-parl-seat-place="neutral"]').attributes('data-parl-neutral-source')).to.eq(undefined);

    // The piles: a deck of 28 is a stack (two edges under the top back), an empty discard an empty nest with its count hidden.
    const deck = w.find('[data-parl-deck-pile]');
    expect(deck.attributes('data-count')).to.eq('28');
    expect(deck.findAll('.con-parl__deck-layer').length).to.eq(2);
    expect(w.find('[data-parl-deck] .con-parl__seat-place--pile').attributes('data-hint')).to.eq($t('Resolution deck') + ' · 28');
    const discard = w.find('[data-parl-discard-pile]');
    expect(discard.classes()).to.include('con-parl__deck--empty');
    expect(discard.findAll('.con-parl__deck-layer').length).to.eq(0);
    expect(w.find('[data-parl-discard]').attributes('data-hint')).to.eq($t('Resolution discard'));
    expect(w.findAll('[data-parl-pile-count]').map((c) => c.text())).to.deep.eq(['28', '0']);
    expect(w.findAll('[data-parl-pile-count]')[1].classes()).to.include('con-parl__seat-count--none');
  });

  it('the zone reads the table AS SHOWN: a delegate still on its way home is not in the reserve yet, the piles follow the renewal\'s hold, the supply its own', async () => {
    const w = zone({neutralSource: true});
    parliamentHolds.returns.set(BLUE, 1);
    parliamentHolds.returns.set('neutral', 2);
    parliamentHolds.pile = {deck: 3, discard: 4};
    await nextTick();

    const blue = w.find('[data-parl-seat="blue"]');
    expect(blue.find('[data-parl-seat-reserve]').attributes('data-count')).to.eq('1');
    expect(blue.find('.con-parl__seat-count').text()).to.eq('×1');
    expect(blue.find('[data-parl-seat-place="reserve"]').classes()).to.include('con-parl__seat-place--incoming');
    expect(blue.find('[data-parl-seat-incoming]').attributes('data-parl-seat-incoming')).to.eq('1');
    expect(w.find('[data-parl-seat="red"] [data-parl-seat-incoming]').exists(), 'the mark exists only where a cube is in the air').to.eq(false);

    expect(w.find('[data-parl-neutral-cube]').attributes('data-count')).to.eq('5');
    const supply = w.find('[data-parl-seat-place="neutral"]');
    expect(supply.classes(), 'the press being decided pays out of the supply').to.include('con-parl__seat-place--source');
    expect(supply.attributes('data-parl-neutral-source')).to.eq('');

    expect(w.find('[data-parl-deck-pile]').attributes('data-count')).to.eq('3');
    expect(w.find('[data-parl-deck-pile]').findAll('.con-parl__deck-layer').length, 'a few cards — one edge').to.eq(1);
    expect(w.find('[data-parl-discard-pile]').attributes('data-count')).to.eq('4');
    expect(w.find('[data-parl-discard]').attributes('data-hint')).to.eq($t('Resolution discard') + ' · 4');
  });

  it('a returning delegate\'s TOUCHDOWN re-keys the stack for its ring — in the sitting only; a price token landed on the viewer\'s reserve does the same', async () => {
    parliamentHolds.returns.set(BLUE, 1);
    const w = zone();
    const landed = (color: Color) => w.find(`[data-parl-seat-reserve="${color}"]`).attributes('data-parl-seat-landed');
    const stackOf = (color: Color) => w.find(`[data-parl-seat-reserve="${color}"]`).element;

    // Outside the sitting a reserve that grows is no landing (the vote mode's own cube never counts).
    parliamentHolds.returns.set(BLUE, 0);
    await nextTick();
    expect(landed(BLUE)).to.eq(undefined);

    parliamentHolds.returns.set(BLUE, 1);
    await nextTick();
    parliamentFlow.stage = 'sitting';
    const before = stackOf(BLUE);
    parliamentHolds.returns.set(BLUE, 0);
    await nextTick();
    await nextTick();
    expect(landed(BLUE)).to.eq('1');
    expect(w.find('[data-parl-seat-reserve="blue"]').classes()).to.include('con-parl__stack--landed');
    expect(stackOf(BLUE), 'a NEW node — the one-shot ring plays on mount').to.not.eq(before);
    expect(landed(RED), 'only the seat it landed on').to.eq(undefined);

    // PL-100: the token that buys the delegate lands on the VIEWER's stack.
    parliamentFlow.reserveAnswers++;
    await nextTick();
    await nextTick();
    expect(landed(RED)).to.eq('1');
    expect(landed(BLUE)).to.eq('1');
  });

  it('the place the next delegate leaves is marked on the VIEWER\'s group while the vote mode selects; a rival\'s carry lights the place it left', async () => {
    const w = zone({benchSource: 'reserve'});
    const sources = () => w.findAll('.con-parl__seat-place--source').map((p) => p.attributes('data-parl-seat-place'));
    expect(sources(), 'no mode — no mark').to.deep.eq([]);

    parliamentFlow.stage = 'vote';
    await nextTick();
    expect(sources()).to.deep.eq(['reserve']);
    expect(w.find('[data-parl-seat="red"] [data-parl-seat-place="reserve"]').classes()).to.include('con-parl__seat-place--source');

    await w.setProps({benchSource: 'lobby'});
    expect(sources()).to.deep.eq(['lobby']);
    await w.setProps({benchWarn: true});
    expect(sources(), 'a refused press has no source').to.deep.eq([]);

    rivalVotes.flying = {kind: 'vote', id: 'v1', instance: 'i1', seq: 4, owner: BLUE, source: 'lobby'};
    await nextTick();
    const carrying = w.findAll('[data-parl-carrying]');
    expect(carrying.length).to.eq(1);
    expect(carrying[0].attributes('data-parl-seat-place')).to.eq('lobby');
    expect(carrying[0].classes()).to.include('con-parl__seat-place--carrying');
    expect(w.find('[data-parl-seat="blue"] [data-parl-carrying]').exists()).to.eq(true);
  });
});
