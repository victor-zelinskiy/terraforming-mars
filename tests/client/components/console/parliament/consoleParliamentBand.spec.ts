/*
 * ConsoleParliamentBand — «ЛЕНТА ЧТЕНИЯ»: the middle zone's upper strip. It exists in every mode and says WHY what is
 * on the table is happening; the line itself is the pure model's (`parliamentBand.ts` — its own spec), this component
 * BINDS it: the table as it stands, the modes' contexts handed in as props, the sitting's position with the phase's
 * records, and the flows' module state. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it emits
 * and exposes nothing — its contract is what it renders, and the hooks its e2e specs wait for.
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {careerGrantState, CareerWalkOwed, CareerWalkPhase} from '@/client/console/parliament/careerGrantBeat';
import {BandDelegate, BandFocus, BandLine, parliamentBandLine} from '@/client/console/parliament/parliamentBand';
import {SittingPosition} from '@/client/console/parliament/consoleSittingFlow';
import {emptyParliamentView, ParliamentSlotVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import ConsoleParliamentBand from '@/client/components/console/parliament/ConsoleParliamentBand.vue';

// The figure and the readings' own renderers are their specs' subjects; this one reads what the band HANDS them.
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, steel: Boolean, glow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'delegate-stub'}),
});
const stubs = {
  PlayerDelegate: DelegateStub, ConsoleInfluenceYield: true, ConsoleYieldUnit: true, ConsolePartyReaction: true, ConsoleWinnerReward: true,
  ConsoleTileGrant: true, ConsoleInfluenceMod: true,
};

const BLUE: Color = 'blue';
const RED: Color = 'red';

/** The seats the band names, and the table's facts the reward's readers take (no law here reads them). */
const TABLE = {
  players: [{color: 'red', name: 'Bob'}, {color: 'blue', name: 'Alice'}],
  game: {oxygenLevel: 0, temperature: -30, oceans: 0, spaces: [], gameOptions: {boardName: 'tharsis'}},
} as unknown as PlayerViewModel;

/** A bill in the voting area — its printed name is the view's own (no manifest behind these ids). */
const slot = (over: Partial<ParliamentSlotVm>): ParliamentSlotVm => ({
  instance: 'i-1', resolutionId: 'law-1', party: PartyName.MARS, resolution: {text: {name: 'Law of Mars'}}, votes: [], totalVotes: 0,
  leader: undefined, leaderVotes: 0, isWinning: false, tiePriority: 1, viewerVotes: 0, viewerEffectDelegates: 2, projection: undefined, ...over,
} as unknown as ParliamentSlotVm);

const EMPTY: ParliamentViewVm = emptyParliamentView();
const STANDING: ParliamentViewVm = {
  ...emptyParliamentView(),
  slots: [slot({}), slot({instance: 'i-2', resolutionId: 'law-2', party: PartyName.SCIENTISTS, resolution: {text: {name: 'Law of Science'}} as never, isWinning: true, leader: RED, totalVotes: 3})],
};

function band(props: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentBand, {
    ...globalConfig,
    props: {view: EMPTY, playerView: TABLE, viewerColor: BLUE, ...props},
    global: {...globalConfig.global, stubs},
  });
}

type Band = ReturnType<typeof band>;

/** The line as the DOM carries it: its identity, its kicker, its members in order. */
const drawn = (w: Band) => ({
  key: w.attributes('data-parl-band'),
  kicker: w.attributes('data-parl-band-kicker'),
  crumb: w.find('[data-parl-band-crumb]').text(),
  chips: w.findAll('[data-parl-band-chip]').map((chip) => chip.attributes('data-parl-band-chip')),
});
const expected = (line: BandLine) => ({key: line.key, kicker: line.kicker, crumb: $t(line.kicker), chips: line.chips.map((chip) => chip.kind)});

describe('ConsoleParliamentBand — the reading line: the pure model\'s line, bound to the table, the modes and the sitting', () => {
  // The law's walk is module state the whole bundle shares: every test leaves it at rest.
  afterEach(() => {
    careerGrantState.current = undefined;
    careerGrantState.owed = [];
  });

  it('an EMPTY table still reads — the overview\'s line, in the zone that never leaves; the template STARTS WITH ITS ROOT', () => {
    const w = band();
    // (Its opening comment lives in the script now: a development build no longer wraps the root in a fragment.)
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.deep.eq(['con-band']);
    expect(w.attributes('data-parl-band-zone')).to.not.eq(undefined);
    const line = parliamentBandLine({standing: {votes: 0}});
    expect(drawn(w)).to.deep.eq(expected(line));
    expect(drawn(w).key).to.eq('overview:none');
    const label = w.find('[data-parl-band-chip="label"]');
    expect(label.classes()).to.include('con-band__chip--quiet');
    expect(label.text()).to.eq($t('No resolution is up for a vote'));
    // No sitting — no state word, no career, no «quiet» reading.
    expect(w.find('[data-parl-band-state]').exists()).to.eq(false);
    expect([w.attributes('data-parl-career-phase'), w.attributes('data-parl-career-seat'), w.attributes('data-parl-band-quiet')])
      .to.deep.eq([undefined, undefined, undefined]);
  });

  it('THE TABLE AS IT STANDS: the bill that would be enacted now and who would win it — and the object under the cursor instead, when there is one', async () => {
    const w = band({view: STANDING});
    const line = parliamentBandLine({standing: {resolution: {resolution: 'law-2', party: PartyName.SCIENTISTS}, player: RED, votes: 3}});
    expect(drawn(w)).to.deep.eq(expected(line));
    expect(drawn(w).chips).to.deep.eq(['label', 'resolution', 'label', 'player']);

    const bill = w.find('[data-parl-band-chip="resolution"]');
    expect(bill.find('.con-band__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.SCIENTISTS));
    expect(bill.find('.con-band__text').text(), 'the bill\'s printed name, off the view').to.eq($t('Law of Science'));
    const seat = w.find('[data-parl-band-chip="player"]');
    expect(seat.find('.con-band__text').text()).to.eq('Bob');
    const figure = seat.findComponent(DelegateStub);
    expect([figure.props('color'), figure.props('steel'), figure.props('glow')]).to.deep.eq([RED, false, false]);

    // «Зал» v7: the browse cursor is on a party's plaque — the line reads IT, never the table's standing.
    const focus: BandFocus = {kind: 'party', party: PartyName.GREENS, inArea: false, mine: 1, threshold: 2, held: false, support: 2, action: '', participates: true};
    await w.setProps({focus});
    const focused = parliamentBandLine({standing: {resolution: {resolution: 'law-2', party: PartyName.SCIENTISTS}, player: RED, votes: 3, focus}});
    expect(focused.key).to.not.eq(line.key);
    expect(drawn(w)).to.deep.eq(expected(focused));
  });

  it('A MODE\'s context is its line: «ИЗГНАНИЕ» names the figure and its place — cyan until the press, amber after it', async () => {
    const delegate: BandDelegate = {stage: 'Banishment', owner: 'neutral', place: 'support', party: PartyName.GREENS, committed: false};
    const w = band({view: STANDING, delegate});
    expect(drawn(w)).to.deep.eq(expected(parliamentBandLine({standing: {votes: 0}, delegate})));
    expect(drawn(w).kicker).to.eq('Banishment');
    expect(w.classes()).to.not.include('con-band--committed');
    // A neutral figure is the steel one, named; the place is the party's popular support.
    const figure = w.find('[data-parl-band-chip="player"]').findComponent(DelegateStub);
    expect([figure.props('color'), figure.props('steel')]).to.deep.eq(['neutral', true]);
    const party = w.find('[data-parl-band-chip="party"]');
    expect(party.find('.con-band__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.GREENS));
    expect(party.find('.con-band__text').text()).to.eq($t(partyNameKey(PartyName.GREENS)));

    // The press: the same line past the commit boundary — a NEW identity (it crossfades), the accent amber.
    const before = drawn(w).key;
    await w.setProps({delegate: {...delegate, committed: true}});
    expect(w.classes()).to.include('con-band--committed');
    expect(drawn(w).key).to.not.eq(before);

    // …and an EXCHANGE on a bill names both halves: the figure, the bill, «на его место», the arriving seat.
    await w.setProps({delegate: {stage: 'Exchange', owner: 'neutral', arrives: BLUE, place: 'resolution', party: PartyName.MARS, resolution: 'law-1', committed: false}});
    expect(drawn(w).chips).to.deep.eq(['player', 'resolution', 'label', 'player']);
    expect(w.findAll('[data-parl-band-chip="player"]').map((chip) => chip.find('.con-band__text').text()).slice(-1)).to.deep.eq(['Alice']);
    expect(w.find('[data-parl-band-chip="resolution"] .con-band__text').text()).to.eq($t('Law of Mars'));
  });

  it('THE SITTING is the zone\'s subject while it stands: the verdict reads the phase\'s summary; the law\'s walk names its seat and its phase', async () => {
    const position: SittingPosition = {generation: 3, final: false, step: 'verdict', pages: ['verdict'], gateStanding: false, rewardStep: 'reading'} as unknown as SittingPosition;
    const model = {
      players: [{color: BLUE, participates: true}, {color: RED, participates: true}],
      phase: {
        step: 'verdict', outcomes: [],
        summary: {
          generation: 3, final: false, winner: {instance: 'i-2', resolution: 'law-2', party: PartyName.SCIENTISTS, votes: 3, player: RED},
          enacted: {instance: 'i-2', resolutionId: 'law-2', resolution: 'law-2', party: PartyName.SCIENTISTS}, support: [], refreshed: [], lobbyRefilled: [],
        },
      },
    } as unknown as ParliamentModel;
    const w = band({view: STANDING, model, position, sittingUp: true, stage: 'verdict'});
    expect(drawn(w).key).to.eq('verdict:i-2:reading');
    expect(drawn(w).kicker).to.eq('Verdict');
    expect(drawn(w).chips).to.deep.eq(['resolution', 'count', 'label', 'player', 'label']);
    expect(w.find('[data-parl-band-chip="count"] .con-band__num').text()).to.eq('3');
    expect(w.find('[data-parl-band-chip="player"] .con-band__text').text()).to.eq('Bob');
    // «эта выплата» / «получено» belong to the reward beat alone.
    expect(w.find('[data-parl-band-state]').exists()).to.eq(false);

    // The same props with the sitting NOT up: the overview's line again (the section's own flow state decides).
    await w.setProps({sittingUp: false});
    expect(drawn(w).key?.startsWith('overview:')).to.eq(true);
    await w.setProps({sittingUp: true});

    // КАРЬЕРА (Reds Budget): the walk playing now is published on the zone — the seat and the phase the probes wait for.
    careerGrantState.current = {key: 'red:1::agenda', player: RED, from: 2, to: 3, steps: [{to: 3, bonus: 'tr'}], generation: 3, viewer: false, phase: 'impulse'} as CareerWalkOwed & {phase: CareerWalkPhase};
    await nextTick();
    expect([w.attributes('data-parl-career-phase'), w.attributes('data-parl-career-seat')]).to.deep.eq(['impulse', RED]);
    careerGrantState.current!.phase = 'walk';
    await nextTick();
    expect(w.attributes('data-parl-career-phase')).to.eq('walk');
    careerGrantState.current = undefined;
    await nextTick();
    expect([w.attributes('data-parl-career-phase'), w.attributes('data-parl-career-seat')]).to.deep.eq([undefined, undefined]);
  });

  it('a PARENT\'s ref carries nothing of the script — the band exposes no member', () => {
    const Host = defineComponent({render: () => h('div', [h(ConsoleParliamentBand, {ref: 'band', view: EMPTY, playerView: TABLE})])});
    const host = mount(Host, {global: {...globalConfig.global, stubs}});
    const held = host.vm.$refs.band as Record<string, unknown> | undefined;
    expect(held, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(held ?? {})).to.deep.eq([]);
    for (const inner of ['line', 'sitting', 'reward', 'nameOf', 'figurePx', 'props']) {
      expect(held?.[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
    host.unmount();
  });
});
