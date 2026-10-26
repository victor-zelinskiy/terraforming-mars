import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import ConsoleVoteLedger from '@/client/components/console/parliament/ConsoleVoteLedger.vue';
import {LedgerChipVm} from '@/client/console/parliament/voteLedgerModel';

/**
 * THE ROW OF SEATS on the vote panel (2026-10-26): it is the reading's TABS — drawn only where it COMPARES (two
 * seats or more), between the LB and RB glyphs that walk it, the subject's chip raised. A row of one seat only
 * repeated the block under it («вы +1 +1» over «+1», «+1» — the owner's solo frame) and is not drawn at all.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const chip = (color: Color, you: boolean): LedgerChipVm => ({
  color, you, parts: [{key: 'steelProduction', kind: 'amount', amount: 1, icon: {family: 'resource', resource: 'steel', production: true}, tone: 'gain'}],
} as unknown as LedgerChipVm);

const mountRow = (chips: ReadonlyArray<LedgerChipVm>, subject: Color | undefined) =>
  mount(ConsoleVoteLedger, {props: {chips, subject}, global: {mocks: {$t: (key: string) => key}}});

describe('ConsoleVoteLedger — the reading\'s tabs', () => {
  it('ONE seat: no row at all — it would only repeat the block under it', () => {
    const wrapper = mountRow([chip(BLUE, true)], undefined);
    expect(wrapper.find('[data-parl-vote-ledger-row]').exists()).to.eq(false);
  });

  it('TWO seats: the strip stands between the LB and RB glyphs, the viewer first, the subject raised', () => {
    const wrapper = mountRow([chip(BLUE, true), chip(RED, false)], RED);
    const row = wrapper.find('[data-parl-vote-ledger-row]');
    expect(row.exists()).to.eq(true);
    expect(row.findAll('.con-vledger__glyph').length, 'the walk\'s two buttons at the ends').to.eq(2);
    const seats = row.findAll('[data-ledger-seat]');
    expect(seats.map((s) => s.attributes('data-ledger-seat'))).to.deep.eq([BLUE, RED]);
    expect(seats[0].attributes('data-ledger-you')).to.eq('true');
    expect(seats[1].classes(), 'the subject is the raised tab').to.include('con-vledger__chip--subject');
    expect(seats[0].classes()).not.to.include('con-vledger__chip--subject');
  });
});
