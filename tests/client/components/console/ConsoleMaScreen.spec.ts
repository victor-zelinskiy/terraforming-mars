import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import {ConsoleMaItem, ConsoleMaKind} from '@/client/components/console/consoleMaModel';
import type {Color} from '@/common/Color';

/*
 * TWO WORKSPACES, ONE FAMILY (ledger FB′ — the owner, 2026-11-03: the one-screen split divided the player's attention
 * and scrolled with Venus's sixth item; two columns of three tiles read more premium and carry a bigger medallion).
 * Each kind is its own screen: a 2 × 3 grid of tiles (five and six both stand whole, an odd fifth never spans), the
 * head-tally in the workspace header, and every tile — the medallion · the name and its rule beside YOUR plate · the
 * table's FIELD at the foot.
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
  it('ONE kind a screen: two columns of three tiles (`--ma-rows` = half the list, rounded up)', () => {
    const w = mountScreen('milestones', 0);
    expect(w.findAll('.con-ma__card')).has.length(5);
    expect(w.find('.con-ma__scroll-host').attributes('style')).contains('--ma-rows: 3');
    expect(w.findAll('.con-ma__card').map((c) => c.attributes('data-ma-row'))).deep.eq(['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner']);
  });

  it('Venus\'s sixth item fills the empty cell — still three rows, never a scroll target', () => {
    const w = mountScreen('awards', 0);
    expect(w.findAll('.con-ma__card')).has.length(6);
    expect(w.find('.con-ma__scroll-host').attributes('style')).contains('--ma-rows: 3');
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

  it('a claimed milestone draws NO field (the race is over) and its OWNER is the plate — never repeated on the name line', () => {
    const items = [item('milestone', 'Mayor', {takenBy: {color: green, name: 'Gale'}}), ...MILESTONES.slice(1)];
    const row = mountScreen('milestones', 0, items).findAll('.con-ma__card')[0];
    expect(row.find('[data-ma-field]').exists()).eq(false);
    expect(row.find('.con-ma__nameline .con-ma__owner').exists()).eq(false);
    expect(row.find('[data-ma-seal]').text()).contains('Gale');
  });

  it('a tile reads: the name and its rule beside YOUR plate on top, the table\'s field at the foot', () => {
    const tile = mountScreen('awards', 0).findAll('.con-ma__card')[0];
    const main = tile.find('.con-ma__main');
    expect(main.element.children[0].classList.contains('con-ma__top')).eq(true);
    expect(main.element.children[1].hasAttribute('data-ma-field')).eq(true);
    expect([...main.find('.con-ma__top').element.children].map((c) => c.className)).deep.eq(['con-ma__body', 'con-ma__status']);
  });
});
