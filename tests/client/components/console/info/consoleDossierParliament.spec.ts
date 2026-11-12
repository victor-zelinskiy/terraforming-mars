/*
 * ConsoleDossierParliament — the dossier's Parliament plate (TR60): a seat's standing as OBJECTS. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md); it is fed ONE reading (`seatParliamentReading`) and the seat's
 * colour, computes nothing of the game, and exposes nothing — so this spec reads what it renders for its props.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {PartyName} from '@/common/turmoil/PartyName';
import {PARLIAMENT_AGENDA_STEPS} from '@/common/parliament/ParliamentTypes';
import {BOT_PARLIAMENT_NOTE, SeatParliamentReadingVm} from '@/client/console/parliament/seatParliamentReading';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import ConsoleDossierParliament from '@/client/components/console/info/ConsoleDossierParliament.vue';

// The delegate figure is the token's own subject; this spec reads what the plate HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, glow: Boolean},
  render: () => h('i', {class: 'delegate-stub'}),
});

const reading = (over: Partial<SeatParliamentReadingVm> = {}): SeatParliamentReadingVm => ({
  color: 'red',
  participates: true,
  influence: {total: 5, track: 3, bonus: 2, sources: [{amount: 2, source: 'Event Analysts'}]},
  agenda: {position: 4, next: {kind: 'tr'}},
  delegates: {
    lobby: true,
    reserve: 6,
    onSlots: [
      {instance: 'r1', resolution: 'RX01', party: PartyName.MARS, votes: 2, leads: true},
      {instance: 'r2', resolution: 'RX02', party: PartyName.GREENS, votes: 1, leads: false},
    ],
    onResolutions: 3,
  },
  chairman: true,
  access: {held: 0, partyActionsUsed: 0, resolutionActionsUsed: 0},
  table: [],
  ...over,
});

function plate(props: {reading: SeatParliamentReadingVm, color?: string}) {
  return mount(ConsoleDossierParliament, {
    ...globalConfig,
    props: {color: 'red', ...props},
    global: {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub}},
  });
}

describe('ConsoleDossierParliament — the dossier\'s Parliament plate', () => {
  it('a seat that takes no part reads its ONE honest line — no badge, no ladder, no tokens', () => {
    const w = plate({reading: reading({participates: false})});
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.include('con-dparl');
    expect(w.attributes('data-dossier-parliament')).to.not.eq(undefined);
    expect(w.find('[data-parl-zone-absent]').text()).to.eq($t(BOT_PARLIAMENT_NOTE));
    for (const zone of ['[data-parl-zone-influence-badge]', '[data-parl-zone-career]', '[data-parl-zone-delegates]']) {
      expect(w.find(zone).exists(), zone).to.eq(false);
    }
  });

  it('the standing as objects: the influence with its modifier, the chair, the Career ladder, the delegates as tokens', () => {
    const w = plate({reading: reading()});
    expect(w.find('[data-parl-zone-absent]').exists()).to.eq(false);
    expect(w.find('[data-parl-zone-influence]').text(), 'the FINAL number the seat votes with').to.eq('5');
    expect(w.find('[data-parl-zone-influence-badge] [data-inf-mod]').attributes('data-inf-mod-amount'), 'beyond the Career').to.eq('2');
    expect(w.find('[data-parl-zone-chairman]').text()).to.eq($t('Chairman'));

    // The Career: the marker's step out of the track's twelve, and a pip per step.
    expect(w.find('[data-parl-zone-career] .con-dparl__kicker b').text()).to.eq(`4/${PARLIAMENT_AGENDA_STEPS}`);
    const pips = w.findAll('.con-dparl__pip');
    expect(pips).to.have.length(PARLIAMENT_AGENDA_STEPS);
    expect(pips.map((pip) => pip.classes().find((c) => c.startsWith('con-dparl__pip--'))).slice(0, 6)).to.deep.eq([
      'con-dparl__pip--passed', 'con-dparl__pip--passed', 'con-dparl__pip--passed',
      'con-dparl__pip--here', 'con-dparl__pip--next', 'con-dparl__pip--ahead',
    ]);
    // …and ONLY the next step wears what it pays — the track's printed symbol (a rating step here).
    expect(w.findAll('.con-dparl__nexticon')).to.have.length(1);
    expect(pips[4].find('i.con-dparl__nexticon').classes()).to.include.members(['resource_icon', 'resource_icon--rating']);

    // The delegates: the lobby's socket, the reserve as one figure ×N, every resolution as its party's emblem.
    const lobby = w.find('[data-parl-zone-token="lobby"]');
    expect(lobby.classes()).to.not.include('con-dparl__token--empty');
    expect(lobby.find('.delegate-stub').exists(), 'the free delegate is there').to.eq(true);
    expect(w.find('[data-parl-zone-token="reserve"] .con-dparl__times').text()).to.eq('×6');
    const slots = w.findAll('[data-parl-zone-token="slots"] .con-dparl__slot');
    expect(slots.map((slot) => slot.attributes('data-parl-zone-slot'))).to.deep.eq([PartyName.MARS, PartyName.GREENS]);
    expect(slots.map((slot) => slot.find('img.con-dparl__emblem').attributes('src'))).to.deep.eq(
      [partyEmblemUrl(PartyName.MARS), partyEmblemUrl(PartyName.GREENS)]);
    expect(slots.map((slot) => slot.find('.con-dparl__times').text())).to.deep.eq(['×2', '×1']);
    expect(slots.map((slot) => slot.classes().includes('con-dparl__slot--lead')), 'the seat leads the first').to.deep.eq([true, false]);
    expect(slots.map((slot) => slot.find('.con-dparl__leadmark').exists())).to.deep.eq([true, false]);
    expect(w.find('.con-dparl__times--none').exists(), 'cubes stand on resolutions — no bare zero').to.eq(false);

    // Every figure is the seat's own, at the Information's size, with no glow.
    const figures = w.findAllComponents(DelegateStub);
    expect(figures).to.have.length(2);
    for (const figure of figures) {
      expect(figure.props('color')).to.eq('red');
      expect(figure.props('size')).to.eq(delegateFigurePx(28));
      expect(figure.props('glow')).to.eq(false);
    }
  });

  it('an empty standing keeps its sockets: no chair, an empty lobby, a quiet zero on the resolutions', () => {
    const w = plate({reading: reading({
      chairman: false,
      influence: {total: 1, track: 1, bonus: 0, sources: []},
      delegates: {lobby: false, reserve: 7, onSlots: [], onResolutions: 0},
    })});
    expect(w.find('[data-parl-zone-chairman]').exists()).to.eq(false);
    expect(w.find('[data-inf-mod]').exists(), 'the track alone — no modifier').to.eq(false);
    const lobby = w.find('[data-parl-zone-token="lobby"]');
    expect(lobby.classes()).to.include('con-dparl__token--empty');
    expect(lobby.find('.delegate-stub').exists()).to.eq(false);
    expect(w.findAll('[data-parl-zone-token="slots"] .con-dparl__slot')).to.have.length(0);
    expect(w.find('.con-dparl__times--none').text()).to.eq('0');
    expect(w.findAllComponents(DelegateStub), 'the reserve\'s figure alone').to.have.length(1);
  });

  it('the next step wears ITS symbol and follows the reading — a card, an influence, nothing past the end', async () => {
    const w = plate({reading: reading({agenda: {position: 1, next: {kind: 'card'}}})});
    const nextIcon = () => w.find('.con-dparl__pip--next .con-dparl__nexticon');
    expect(nextIcon().classes()).to.include.members(['resource_icon', 'resource_icon--cards']);
    await w.setProps({reading: reading({agenda: {position: 2, next: {kind: 'influence', influence: 2}}})});
    expect(nextIcon().classes()).to.include('con-dparl__nexticon--influence');
    expect(w.find('[data-parl-zone-career] .con-dparl__kicker b').text()).to.eq(`2/${PARLIAMENT_AGENDA_STEPS}`);
    await w.setProps({reading: reading({agenda: {position: PARLIAMENT_AGENDA_STEPS}})});
    expect(w.find('.con-dparl__nexticon').exists(), 'the end of the track pays nothing more').to.eq(false);
    expect(w.findAll('.con-dparl__pip--passed')).to.have.length(PARLIAMENT_AGENDA_STEPS - 1);
  });
});
