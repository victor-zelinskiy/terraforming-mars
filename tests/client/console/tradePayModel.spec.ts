import {expect} from 'chai';
import {Message} from '@/common/logs/Message';
import {DisabledOptionModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {
  tradePayDisabledEntries, tradePayEntries, visibleTradePayDisabled, visibleTradePayRows,
} from '@/client/console/colonyTrade/tradePayModel';

const text = (v: string | Message | undefined) => (typeof v === 'string' ? v : v?.message ?? '');
const icon = (key: string) => 'ico-' + key;

const OPTIONS = [
  {type: 'option', title: 'Pay 3 energy', metadata: {icon: 'energy', resource: {current: 5, resulting: 2}}},
  {type: 'option', title: 'Pay 9 M€', metadata: {icon: 'megacredits'}},
  {type: 'option', title: 'Use Trade Industries', metadata: {icon: 'megacredits', card: 'Some Card'}},
] as unknown as ReadonlyArray<SelectOptionModel>;
const DISABLED = [
  {title: 'Pay 3 titanium', reason: 'Not enough titanium', metadata: {icon: 'titanium', resource: {current: 1}}},
] as unknown as ReadonlyArray<DisabledOptionModel>;

describe('tradePayModel — ONE row model for every stage that composes a trade', () => {
  it('a path reads its title, its icon and the server\'s own `current → resulting`', () => {
    const entries = tradePayEntries(OPTIONS, text, icon);
    expect(entries[0]).to.deep.eq({title: 'Pay 3 energy', iconClass: 'ico-energy', preview: '5 → 2'});
    expect(entries[1]).to.deep.eq({title: 'Pay 9 M€', iconClass: 'ico-megacredits', preview: ''});
  });

  it('a refused path names what the player holds and the server\'s reason', () => {
    expect(tradePayDisabledEntries(DISABLED, text, icon)).to.deep.eq([
      {title: 'Pay 3 titanium · 1', iconClass: 'ico-titanium', reason: 'Not enough titanium'},
    ]);
  });

  it('the colony stage and the dock stage read the SAME rows off the same options (parity by construction)', () => {
    const colony = visibleTradePayRows(tradePayEntries(OPTIONS, text, icon), -1, false);
    const dock = visibleTradePayRows(tradePayEntries(OPTIONS, text, icon), -1, false);
    expect(dock).to.deep.eq(colony);
    expect(dock.map((r) => r.index)).to.deep.eq([0, 1, 2]);
  });

  it('a fee fixed by the entry is ONE row with its server index; refused paths vanish; past the commit there is no list', () => {
    const entries = tradePayEntries(OPTIONS, text, icon);
    expect(visibleTradePayRows(entries, 2, false).map((r) => r.index)).to.deep.eq([2]);
    expect(visibleTradePayDisabled(tradePayDisabledEntries(DISABLED, text, icon), 2, false)).to.deep.eq([]);
    expect(visibleTradePayRows(entries, -1, true)).to.deep.eq([]);
  });
});
