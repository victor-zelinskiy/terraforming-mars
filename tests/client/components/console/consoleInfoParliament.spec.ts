/*
 * ConsoleInfoParliament — «ПАРЛАМЕНТ» of the Information workspace: ONE seat's standing as objects. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md); it is fed ONE reading (`seatParliamentReading`), computes
 * nothing of the game, emits nothing and exposes nothing — so this spec reads what it renders for its prop and what
 * it hands its children.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {PartyName} from '@/common/turmoil/PartyName';
import {AGENDA_TRACK, PARLIAMENT_AGENDA_STEPS} from '@/common/parliament/ParliamentTypes';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import {BOT_PARLIAMENT_NOTE, SeatParliamentReadingVm, SeatTableEntryVm} from '@/client/console/parliament/seatParliamentReading';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import ConsoleInfoParliament from '@/client/components/console/ConsoleInfoParliament.vue';

// The delegate figure and the yield plate are their own subjects; this spec reads what the zone HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, glow: Boolean},
  render: () => h('i', {class: 'delegate-stub'}),
});
const YieldStub = defineComponent({
  name: 'ConsoleInfluenceYield',
  props: {
    yields: {type: Array, required: true},
    formula: {type: Boolean, default: true},
    captions: {type: Boolean, default: true},
    oneNumber: {type: Boolean, default: false},
    size: {type: String, default: 'normal'},
  },
  render: () => h('i', {class: 'yield-stub'}),
});

const YIELD: InfluenceYield = {
  effect: {id: 'cards', unit: {kind: 'cards'}, perInfluence: 1, recipient: 'each'},
  context: 'estimate',
  influence: 3,
  amount: 3,
};

const entry = (over: Partial<SeatTableEntryVm> = {}): SeatTableEntryVm => ({
  instance: 'RX01#0',
  resolution: 'RX01',
  party: PartyName.MARS,
  winning: true,
  votes: 2,
  reading: {kicker: 'For you when enacted', person: 'you', yields: [YIELD], suffixes: [], reactions: [], note: undefined},
  ...over,
});

const reading = (over: Partial<SeatParliamentReadingVm> = {}): SeatParliamentReadingVm => ({
  color: 'red',
  participates: true,
  influence: {total: 5, track: 3, bonus: 2, sources: [{amount: 1, source: 'Event Analysts'}, {amount: 1}]},
  agenda: {position: 4, next: {kind: 'tr'}},
  delegates: {
    lobby: true,
    reserve: 6,
    onSlots: [
      {instance: 'RX01#0', resolution: 'RX01', party: PartyName.MARS, votes: 2, leads: true},
      {instance: 'RX02#0', resolution: 'RX02', party: PartyName.GREENS, votes: 1, leads: false},
    ],
    onResolutions: 3,
  },
  chairman: true,
  access: {held: 2, partyActionsUsed: 1, resolutionActionsUsed: 1},
  table: [],
  ...over,
});

function zone(props: {reading: SeatParliamentReadingVm}) {
  return mount(ConsoleInfoParliament, {
    ...globalConfig,
    props,
    global: {
      ...globalConfig.global,
      stubs: {PlayerDelegate: DelegateStub, ConsoleInfluenceYield: YieldStub, ConsoleInfluenceMod: true, PremiumChairGlyph: true},
    },
  });
}

describe('ConsoleInfoParliament — one seat\'s standing in the Information workspace', () => {
  it('a seat that takes no part reads its ONE honest line — no section at all', () => {
    const w = zone({reading: reading({participates: false})});
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.include.members(['con-info__parl', 'con-iparl']);
    expect(w.attributes('data-info-parliament')).to.not.eq(undefined);
    expect(w.find('[data-parl-info-absent]').text()).to.eq($t(BOT_PARLIAMENT_NOTE));
    expect(w.findAll('[data-parl-info-section]')).to.have.length(0);
  });

  it('the influence as a sum with its givers, and the Career as the printed track with the marker and the next step', () => {
    const w = zone({reading: reading()});
    expect(w.find('[data-parl-info-absent]').exists()).to.eq(false);
    expect(w.findAll('[data-parl-info-section]').map((s) => s.attributes('data-parl-info-section'))).to.deep.eq(['influence', 'agenda', 'delegates', 'table']);

    // ВЛИЯНИЕ: the number the seat votes with, then «track + bonuses = total»; an unnamed giver reads «other».
    expect(w.find('[data-parl-info-total]').text()).to.eq('5');
    expect(w.findAll('[data-parl-info-influence] .con-info__parl-term b').map((b) => b.text())).to.deep.eq(['3', '2']);
    expect(w.find('[data-parl-info-influence] .con-iparl__sumtotal').text()).to.eq('5');
    const sources = w.findAll('[data-parl-info-sources] .con-iparl__source');
    expect(sources.map((s) => s.find('span').text())).to.deep.eq([$t('Event Analysts'), $t('other')]);
    expect(sources.map((s) => s.find('b').text())).to.deep.eq(['+1', '+1']);

    // КАРЬЕРА: «4 of 12», a rung per printed step, the marker on the seat's own, the next one named by what it pays.
    expect(w.find('[data-parl-info-step]').text()).to.eq(`4 of ${PARLIAMENT_AGENDA_STEPS}`);
    const rungs = w.findAll('.con-iparl__rung');
    expect(rungs).to.have.length(AGENDA_TRACK.length);
    expect(rungs.map((rung) => rung.classes().find((c) => c.startsWith('con-iparl__rung--'))).slice(0, 6)).to.deep.eq([
      'con-iparl__rung--passed', 'con-iparl__rung--passed', 'con-iparl__rung--passed',
      'con-iparl__rung--here', 'con-iparl__rung--next', 'con-iparl__rung--ahead',
    ]);
    expect(rungs.map((rung) => rung.find('.con-iparl__rungmark .delegate-stub').exists()).indexOf(true), 'the marker stands on step 4').to.eq(3);
    expect(rungs.filter((rung) => rung.find('.con-iparl__rungmark .delegate-stub').exists())).to.have.length(1);
    const first = AGENDA_TRACK[0];
    expect(rungs[0].find('.con-iparl__runglevel').text(), 'an influence step prints its level').to.eq(first.kind === 'influence' ? String(first.influence) : '');
    expect(w.find('[data-parl-info-next]').text()).to.eq($t('TR'));
  });

  it('the delegates as tokens and every resolution the seat stands on; every figure the seat\'s own at the Information\'s size', () => {
    const w = zone({reading: reading()});
    const tokens = w.findAll('.con-iparl__tokens .con-iparl__token');
    expect(tokens.map((t) => t.find('.con-iparl__tokenlabel').text())).to.deep.eq(
      ['In the lobby', 'Reserve', 'On resolutions', 'Chairman', 'Access', 'Actions used'].map((key) => $t(key)));
    expect(tokens[0].classes()).to.not.include('con-iparl__token--empty');
    expect(tokens[0].find('.delegate-stub').exists(), 'the free delegate is in the lobby').to.eq(true);
    expect(tokens[1].find('b').text()).to.eq('×6');
    expect(tokens[2].find('b').text()).to.eq('3');
    expect(tokens[4].find('b').text(), 'access is a COUNT here').to.eq('2');
    expect(tokens[5].find('b').text(), 'party actions + the law\'s action').to.eq('2');

    const slots = w.findAll('[data-parl-info-slot]');
    expect(slots.map((slot) => slot.attributes('data-parl-info-slot'))).to.deep.eq(['RX01#0', 'RX02#0']);
    expect(slots.map((slot) => slot.find('img').attributes('src'))).to.deep.eq([partyEmblemUrl(PartyName.MARS), partyEmblemUrl(PartyName.GREENS)]);
    expect(slots.map((slot) => slot.find('.con-info__parl-slot-votes').text())).to.deep.eq(['×2', '×1']);
    expect(slots.map((slot) => slot.find('.con-info__parl-lead').exists()), 'the seat leads the first').to.deep.eq([true, false]);

    // The marker, the lobby's, the reserve's and one per slot — the seat's colour, 28 logical, no glow.
    const figures = w.findAllComponents(DelegateStub);
    expect(figures).to.have.length(5);
    for (const figure of figures) {
      expect(figure.props('color')).to.eq('red');
      expect(figure.props('size')).to.eq(delegateFigurePx(28));
      expect(figure.props('glow')).to.eq(false);
    }
  });

  it('the table follows the reading: a paying resolution hands its yields over, a silent one says so, the last enactment stands apart', async () => {
    const w = zone({reading: reading({
      chairman: false,
      agenda: {position: PARLIAMENT_AGENDA_STEPS},
      delegates: {lobby: false, reserve: 7, onSlots: [], onResolutions: 0},
      table: [entry(), entry({instance: 'RX02#0', resolution: 'RX02', party: PartyName.GREENS, winning: false, reading: {...entry().reading, yields: []}})],
    })});
    expect(w.find('[data-parl-info-next]').exists(), 'the end of the track pays nothing more').to.eq(false);
    expect(w.find('.con-iparl__token').classes(), 'an empty lobby keeps its socket').to.include('con-iparl__token--empty');
    expect(w.findAll('.con-iparl__tokens .con-iparl__token'), 'no chair without the office').to.have.length(5);
    expect(w.find('.con-iparl__slots').exists()).to.eq(false);

    const rows = w.findAll('[data-parl-info-row]');
    expect(rows.map((row) => row.attributes('data-parl-info-row'))).to.deep.eq(['RX01#0', 'RX02#0']);
    expect(rows.map((row) => row.find('.con-info__parl-win').exists()), 'only the leading card is marked').to.deep.eq([true, false]);
    expect(rows.map((row) => row.find('img').attributes('src'))).to.deep.eq([partyEmblemUrl(PartyName.MARS), partyEmblemUrl(PartyName.GREENS)]);
    expect(rows[0].find('[data-parl-info-reading]').classes()).to.include.members(['yield-stub', 'con-info__parl-yield']);
    expect(rows[1].find('[data-parl-info-reading]').exists()).to.eq(false);
    expect(rows[1].find('.con-info__parl-nothing').text()).to.eq($t('Nothing at the enactment'));
    const plate = w.findComponent(YieldStub);
    expect(plate.props('yields')).to.deep.eq([YIELD]);
    expect([plate.props('formula'), plate.props('captions'), plate.props('oneNumber'), plate.props('size')]).to.deep.eq([false, false, true, 'compact']);
    expect(w.find('[data-parl-info-enacted]').exists()).to.eq(false);

    await w.setProps({reading: reading({table: [], enacted: {resolution: 'RX03', party: PartyName.REDS, yields: [YIELD]}})});
    expect(w.findAll('[data-parl-info-row]')).to.have.length(0);
    const enacted = w.find('[data-parl-info-enacted]');
    expect(enacted.find('img').attributes('src')).to.eq(partyEmblemUrl(PartyName.REDS));
    expect(enacted.find('[data-parl-info-received]').classes()).to.include('yield-stub');
    expect(w.findComponent(YieldStub).props('oneNumber'), 'what was received is not an estimate').to.eq(false);
  });
});
