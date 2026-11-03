import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import {ConsoleMaItem, ConsoleMaKind} from '@/client/components/console/consoleMaModel';
import type {Color} from '@/common/Color';

/*
 * ONE SCREEN, TWO COLUMNS (P49 · ledger FB — the owner's frames of 2026-11-03: a fifth tile stretched over the whole
 * width, two surfaces for what the strategy rail and the Steam reference show together). The milestones are the left
 * column, the awards the right, each its own head-tally over rows of one height; the cursor stands in ONE column;
 * Vitor's hosted free sponsorship is the same screen with the awards alone.
 */
const me: Color = 'red';

function item(kind: 'milestone' | 'award', name: string, over: Partial<ConsoleMaItem> = {}): ConsoleMaItem {
  return {
    key: name, name, kind, description: 'Rule', scores: [{color: me, score: 1}], myColor: me, myScore: 1, myReady: false,
    myLead: false, leaderScore: 1, secondRanked: false, raceTone: 'empty', available: false, blocker: '', slotsExhausted: false,
    cost: kind === 'milestone' ? 8 : 14, ...over,
  };
}

const MILESTONES = ['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner'].map((n) => item('milestone', n));
const AWARDS = ['Landlord', 'Banker', 'Scientist', 'Thermalist', 'Miner'].map((n) => item('award', n));

function mountScreen(kind: ConsoleMaKind, index: number, kinds: ReadonlyArray<ConsoleMaKind> = ['milestones', 'awards']) {
  const items = kind === 'milestones' ? MILESTONES : AWARDS;
  return mount(ConsoleMaScreen, {
    ...globalConfig,
    props: {
      kind, items, index, kinds, myMegacredits: 30,
      columnItems: {milestones: MILESTONES, awards: AWARDS},
    },
  });
}

describe('ConsoleMaScreen — one screen, two columns (FB)', () => {
  it('stands BOTH columns, milestones left and awards right, five rows each — no tile spans', () => {
    const w = mountScreen('milestones', 0);
    const cols = w.findAll('.con-ma__col');
    expect(cols.map((c) => c.attributes('data-ma-column'))).deep.eq(['milestones', 'awards']);
    expect(cols.map((c) => c.findAll('.con-ma__card').length)).deep.eq([5, 5]);
    expect(cols.every((c) => c.attributes('style')?.includes('--ma-rows: 5'))).eq(true);
  });

  it('each column has its own head-tally: the price of ITS next slot', () => {
    const w = mountScreen('milestones', 0);
    expect(w.find('[data-ma-column="milestones"] [data-ma-price="milestones"]').text()).contains('8');
    expect(w.find('[data-ma-column="awards"] [data-ma-price="awards"]').text()).contains('14');
  });

  it('the cursor stands in ONE column — the active one (its row index), never mirrored in the other', () => {
    const w = mountScreen('awards', 2);
    const focused = w.findAll('.con-ma__card--focused');
    expect(focused).has.length(1);
    expect(focused[0].attributes('data-ma-row')).eq('Scientist');
    expect(w.find('[data-ma-column="awards"]').classes()).contains('con-ma__col--active');
  });

  it('Vitor\'s hosted step: the awards column alone', () => {
    const w = mountScreen('awards', 0, ['awards']);
    expect(w.findAll('.con-ma__col').map((c) => c.attributes('data-ma-column'))).deep.eq(['awards']);
  });

  it('a click on another column\'s row picks THAT column and row', () => {
    const w = mountScreen('milestones', 0);
    void w.findAll('[data-ma-column="awards"] .con-ma__card')[3].trigger('click');
    expect(w.emitted('pick')?.[0]).deep.eq([{kind: 'awards', index: 3}]);
  });
});
