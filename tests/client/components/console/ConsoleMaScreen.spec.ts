import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import {ConsoleMaItem, ConsoleMaKind} from '@/client/components/console/consoleMaModel';
import type {Color} from '@/common/Color';

/*
 * TWO WORKSPACES, ONE FAMILY (ledger FB′ — the owner, 2026-11-03: the one-screen split divided the player's attention
 * and scrolled with Venus's sixth item). Each kind is its own screen: ONE column of full-width rows of one height
 * (five and six both stand whole, nothing spans), the head-tally in the workspace header, and every row read left to
 * right — the medallion · the name and its rule · THE FIELD (the table, seat by seat) · YOUR plate.
 */
const me: Color = 'red';
const blue: Color = 'blue';
const green: Color = 'green';

function item(kind: 'milestone' | 'award', name: string, over: Partial<ConsoleMaItem> = {}): ConsoleMaItem {
  return {
    key: name, name, kind, description: 'Rule', scores: [{color: me, score: 1}, {color: blue, score: 3}], myColor: me, myScore: 1,
    myReady: false, myLead: false, leaderScore: 3, secondRanked: false, raceTone: kind === 'award' ? 'behind' : 'empty',
    threshold: kind === 'milestone' ? 4 : undefined, available: false, blocker: '', slotsExhausted: false,
    cost: kind === 'milestone' ? 8 : 14, ...over,
  };
}

const MILESTONES = ['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner'].map((n) => item('milestone', n));
const AWARDS = ['Landlord', 'Banker', 'Scientist', 'Thermalist', 'Miner', 'Venuphile'].map((n) => item('award', n));

function mountScreen(kind: ConsoleMaKind, index: number, items: ReadonlyArray<ConsoleMaItem> = kind === 'milestones' ? MILESTONES : AWARDS) {
  return mount(ConsoleMaScreen, {
    ...globalConfig,
    props: {kind, items, index, myMegacredits: 30},
  });
}

describe('ConsoleMaScreen — two workspaces, one family (FB′)', () => {
  it('ONE kind a screen: one column of full-width rows, one height each (`--ma-rows` = the list)', () => {
    const w = mountScreen('milestones', 0);
    expect(w.findAll('.con-ma__card')).has.length(5);
    expect(w.find('.con-ma__scroll-host').attributes('style')).contains('--ma-rows: 5');
    expect(w.findAll('.con-ma__card').map((c) => c.attributes('data-ma-row'))).deep.eq(['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner']);
  });

  it('Venus\'s sixth item is a sixth row of the same height — never a scroll target, never a stretched tile', () => {
    const w = mountScreen('awards', 0);
    expect(w.findAll('.con-ma__card')).has.length(6);
    expect(w.find('.con-ma__scroll-host').attributes('style')).contains('--ma-rows: 6');
  });

  it('the head-tally lives in the workspace header: the price of THIS kind\'s next slot', () => {
    expect(mountScreen('milestones', 0).find('.con-ma__wshead [data-ma-tally] [data-ma-price="milestones"]').text()).contains('8');
    expect(mountScreen('awards', 0).find('.con-ma__wshead [data-ma-tally] [data-ma-price="awards"]').text()).contains('14');
  });

  it('the cursor stands on ONE row, and a click picks it by index', () => {
    const w = mountScreen('awards', 2);
    const focused = w.findAll('.con-ma__card--focused');
    expect(focused).has.length(1);
    expect(focused[0].attributes('data-ma-row')).eq('Scientist');
    void w.findAll('.con-ma__card')[3].trigger('click');
    expect(w.emitted('pick')?.[0]).deep.eq([3]);
  });

  it('a milestone\'s field shows the RIVALS (you are the plate); an award\'s field every seat, the leader crowned', () => {
    const ms = mountScreen('milestones', 0).findAll('.con-ma__card')[0];
    expect(ms.findAll('[data-ma-lane]').map((l) => l.attributes('data-ma-lane'))).deep.eq([blue]);
    expect(ms.find('.con-ma__metric').exists()).eq(true);
    const aw = mountScreen('awards', 0).findAll('.con-ma__card')[0];
    expect(aw.findAll('[data-ma-lane]').map((l) => l.attributes('data-ma-lane'))).deep.eq([blue, me]);
    expect(aw.find('[data-ma-lane="blue"] .con-ma__crown').exists()).eq(true);
    expect(aw.find('[data-ma-lane="red"]').classes()).contains('con-ma__lane--me');
    expect(aw.find('.con-ma__race--behind').text()).contains('2');
  });

  it('a claimed milestone draws NO field (the race is over) and its owner stands on the name line', () => {
    const items = [item('milestone', 'Mayor', {takenBy: {color: green, name: 'Gale'}}), ...MILESTONES.slice(1)];
    const row = mountScreen('milestones', 0, items).findAll('.con-ma__card')[0];
    expect(row.find('[data-ma-field]').exists()).eq(false);
    expect(row.find('.con-ma__nameline .con-ma__owner').text()).contains('Gale');
    expect(row.find('.con-ma__seal').exists()).eq(true);
  });

  it('every field reserves the screen\'s widest table (`--ma-seats`) so lanes align row to row', () => {
    const w = mountScreen('awards', 0);
    expect(w.find('.con-ma__scroll-host').attributes('style')).contains('--ma-seats: 2');
  });
});
