/*
 * ConsoleParliamentVotingArea — THE VOTING AREA tier of the Parliament: a home per bill in the table's order (the row
 * always three wide — a slot the deck could not fill names itself), each bill's ribbon and tally AS SHOWN, the cursor,
 * the holds and the verdict read off the Parliament's module state. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no parent stands a ref on it — it emits and exposes nothing.
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {partyAccent} from '@/client/components/premiumCard/partyEmblems';
import {resetConsoleParliamentUi, resetParliamentFlow, parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {PARTY_EFFECT_PLACES, ParliamentSlotVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import ConsoleParliamentVotingArea from '@/client/components/console/parliament/ConsoleParliamentVotingArea.vue';

// The figure, the premium face and the teleport are their own specs' subjects; this one reads what the area HANDS them.
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, steel: Boolean, size: Number, glow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'delegate-stub'}),
});
/** The lazy premium face (`asyncComponents`) answers to the wrapper's name — RECIPES § 3. */
const FaceStub = defineComponent({name: 'VaporAsyncComponentWrapper', render: () => h('i', {class: 'face-stub'})});
/** The teleport, standing its content in place (the slots are carried into the vote row only while the vote mode is up). */
const TeleportStub = defineComponent({
  name: 'ConsoleTeleport',
  props: {to: String, disabled: Boolean, defer: Boolean},
  render() {
    return h('div', {class: 'teleport-stub'}, this.$slots.default?.());
  },
});

const stubs = {PlayerDelegate: DelegateStub, VaporAsyncComponentWrapper: FaceStub, ConsoleTeleport: TeleportStub};

const GREENS: ReduxParty = PartyName.GREENS;
const REDS: ReduxParty = PartyName.REDS;
const BLUE: Color = 'blue';

/** A bill on the table — a resolution the catalog does not know (no face to draw: the face is not this spec's subject). */
const bill = (instance: string, party: ReduxParty, over: Partial<ParliamentSlotVm> = {}): ParliamentSlotVm => ({
  instance, resolutionId: 'SPEC-NO-SUCH-LAW', resolution: undefined, party, votes: [], totalVotes: 0, leader: undefined, leaderVotes: 0,
  isWinning: false, tiePriority: 1, viewerVotes: 0, viewerEffectDelegates: 2, projection: undefined, ...over,
});

const LEADING = bill('greens#0', GREENS, {
  votes: [{owner: BLUE, seq: 1}, {owner: 'neutral', seq: 2}], totalVotes: 2, leader: BLUE, leaderVotes: 1, isWinning: true, viewerVotes: 1,
});
const QUIET = bill('reds#0', REDS, {tiePriority: 2});

/** The area reads the view's slots and nothing else of it. */
const viewOf = (slots: ReadonlyArray<ParliamentSlotVm>): ParliamentViewVm => ({slots}) as unknown as ParliamentViewVm;

function area(props: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentVotingArea, {
    ...globalConfig,
    props: {view: viewOf([LEADING, QUIET]), viewerColor: BLUE, viewerParticipates: true, ...props},
    global: {...globalConfig.global, stubs},
  });
}

describe('ConsoleParliamentVotingArea — the voting area tier', () => {
  // The area reads module state (the flow's cursor, the display holds) — none may leak between tests.
  const reset = () => {
    resetParliamentFlow();
    resetParliamentHolds();
    resetConsoleParliamentUi();
  };
  beforeEach(reset);
  afterEach(reset);

  it('a home per bill in the table\'s order, the row filled to three by a slot that names why it is empty', () => {
    const w = area();
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-parl__voting', 'con-parl__voting--focus']);
    expect(w.classes()).to.not.include('con-parl__voting--carried');
    expect(w.classes()).to.not.include('con-parl__voting--selecting');
    expect(w.attributes('data-parl-voting')).to.not.eq(undefined);
    expect(w.find('.con-parl__kicker').text()).to.eq($t('Voting'));

    expect(w.findAll('[data-home]').map((home) => home.attributes('data-home'))).to.deep.eq(['greens#0', 'reds#0']);
    const slots = w.findAll('.con-parl__slot');
    expect(slots.map((s) => s.attributes('data-instance'))).to.deep.eq(['greens#0', 'reds#0']);
    expect(slots.map((s) => s.attributes('data-party'))).to.deep.eq([GREENS, REDS]);
    expect(slots.map((s) => s.attributes('data-order'))).to.deep.eq(['1', '2']);
    expect(slots.map((s) => s.attributes('data-votes'))).to.deep.eq(['2', '0']);
    expect((slots[0].element as HTMLElement).style.getPropertyValue('--parl-accent'), 'the party\'s accent is a material of the slot').to.eq(partyAccent(GREENS));
    // The cursor stands on the first bill; the leading bill is the viewer's and wears the table's ONE crown.
    expect(slots[0].classes()).to.include.members(['con-parl__slot--focus', 'con-parl__slot--mine', 'con-parl__slot--winning']);
    expect(slots[1].classes()).to.not.include('con-parl__slot--focus');
    expect(slots[1].classes()).to.not.include('con-parl__slot--winning');
    expect(slots[0].find('.con-parl__slot-win').attributes('data-hint')).to.eq($t('Leading the vote'));
    expect(slots[1].find('.con-parl__slot-win').exists()).to.eq(false);

    // Each bill is ONE instance behind the teleport that carries it into the vote row — in place while no vote stands.
    const carried = w.findAllComponents(TeleportStub);
    expect(carried.map((t) => t.props('to'))).to.deep.eq(['[data-parl-vrow]', '[data-parl-vrow]']);
    expect(carried.every((t) => t.props('disabled') === true && t.props('defer') === true)).to.eq(true);

    const empty = w.findAll('.con-parl__slot-home--empty');
    expect(empty.length, 'three places, two bills').to.eq(1);
    expect(empty[0].attributes('data-parl-slot-empty-held')).to.eq(undefined);
    expect(empty[0].find('[data-parl-slot-empty-card]').attributes('data-parl-slot-empty-why')).to.eq('The deck has no resolution of another party');
    expect(w.find('.face-stub').exists(), 'a resolution the catalog does not know draws no face').to.eq(false);
  });

  it('the RIBBON in placement order and the TALLY as shown — the count, the leader, the viewer\'s places of the threshold', async () => {
    const w = area();
    const [leading, quiet] = w.findAll('.con-parl__slot');
    expect(leading.findAll('.con-parl__vote-cube').map((c) => c.attributes('data-seq'))).to.deep.eq(['1', '2']);
    expect(leading.find('.con-parl__ribbon').classes()).to.not.include('con-parl__ribbon--dense');
    // Every figure of the area, in the DOM's order: the ribbon's two, the leader's, the viewer's one filled place.
    const figures = w.findAllComponents(DelegateStub);
    expect(figures.map((f) => f.props('color'))).to.deep.eq(['blue', 'neutral', 'blue', 'blue']);
    expect(figures.map((f) => f.props('steel')), 'the neutral delegate is steel').to.deep.eq([false, true, false, false]);

    expect(w.findAll('.con-parl__tally-num').map((n) => n.text())).to.deep.eq(['2', '0']);
    const word = translateTextWithParams('${0} delegates', ['2']).replace(/^\d+\s*/, '');
    expect(leading.find('.con-parl__tally-num').attributes('aria-label')).to.eq('2 ' + word);
    expect(leading.find('[data-parl-leader]').exists()).to.eq(true);
    expect(leading.find('.con-parl__tally-total').classes()).to.not.include('con-parl__tally-total--empty');
    // NOTHING TO SAY, NOTHING SAID: no vote — an empty socket and a reserved, empty leader's place.
    expect(quiet.find('.con-parl__tally-total').classes()).to.include('con-parl__tally-total--empty');
    expect(quiet.find('[data-parl-leader]').exists()).to.eq(false);
    expect(quiet.find('.con-parl__tally-row--none').exists()).to.eq(true);

    const mine = leading.find('[data-parl-mine]');
    expect(mine.attributes('data-parl-mine-count')).to.eq('1');
    expect(mine.attributes('data-parl-mine-threshold')).to.eq('2');
    expect(mine.classes(), 'one of two — the effect is not the viewer\'s yet').to.not.include('con-parl__tally-row--held');
    expect(mine.findAll('.con-parl__place').length, 'the PRINTED places, always in the flow').to.eq(PARTY_EFFECT_PLACES);
    expect(mine.findAll('.con-parl__place--on').length).to.eq(1);

    // A viewer who does not take part reads no «yours» row.
    await w.setProps({viewerParticipates: false});
    expect(w.find('[data-parl-mine]').exists()).to.eq(false);
    expect(w.findAllComponents(DelegateStub).length, 'the ribbon\'s two and the leader\'s').to.eq(3);
  });

  it('follows the Parliament\'s module state: the cursor, the zone, a card that has left its held home', async () => {
    const w = area();
    const focused = () => w.findAll('.con-parl__slot--focus').map((s) => s.attributes('data-instance'));
    expect(focused()).to.deep.eq(['greens#0']);
    parliamentFlow.slotIndex = 1;
    await nextTick();
    expect(focused()).to.deep.eq(['reds#0']);
    parliamentFlow.zone = 'parties';
    await nextTick();
    expect(focused(), 'the cursor left the area').to.deep.eq([]);
    expect(w.classes()).to.not.include('con-parl__voting--focus');

    // The winner left for the government, a loser for the discard: each home keeps its PLACE as an outline that says why.
    parliamentHolds.vacated.add('greens#0');
    parliamentHolds.departed.add('reds#0');
    await nextTick();
    const homes = w.findAll('[data-home]');
    expect(homes.map((home) => home.classes().includes('con-parl__slot-home--vacated'))).to.deep.eq([true, true]);
    expect(homes.map((home) => home.attributes('data-parl-slot-vacated'))).to.deep.eq(['', '']);
    expect(homes.map((home) => home.find('[data-parl-slot-empty-card]').attributes('data-parl-slot-empty-why'))).to.deep.eq(['enacted', 'discarded']);
    expect(w.find('.con-parl__slot').exists(), 'the row never re-orders — and no bill is drawn twice').to.eq(false);
  });

  it('THE SITTING\'S VERDICT: the enacted bill carries the winner\'s cube, the others recede — and no bill reads «leading» any more', () => {
    const model = {phase: {step: 'enact', summary: {winner: {instance: 'reds#0', player: BLUE}}}} as unknown as ParliamentModel;
    const w = area({model, sittingStage: 'verdict'});
    const [outvoted, enacting] = w.findAll('.con-parl__slot');
    expect(enacting.classes()).to.include('con-parl__slot--enacting');
    expect(outvoted.classes()).to.include('con-parl__slot--outvoted');
    expect(outvoted.classes(), 'the vote is decided — the live re-ranking names nothing').to.not.include('con-parl__slot--winning');
    const verdict = enacting.find('[data-parl-slot-verdict]');
    expect(verdict.attributes('data-hint')).to.eq($t('Being enacted'));
    expect(outvoted.find('.con-parl__slot-win').exists()).to.eq(false);
    // The seat that carried the resolution, as a cube in the winning card's own chip — the LAST figure of that bill's card.
    const cube = w.findAllComponents(DelegateStub).filter((f) => f.classes().includes('con-parl__slot-win-cube'));
    expect(cube.map((f) => f.props('color'))).to.deep.eq(['blue']);
    expect(cube[0].props('steel')).to.eq(false);
    expect(cube[0].props('glow')).to.eq(false);
  });
});
