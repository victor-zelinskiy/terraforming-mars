import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleDossierScore from '@/client/components/console/info/ConsoleDossierScore.vue';
import ConsoleDossierCards from '@/client/components/console/info/ConsoleDossierCards.vue';
import ConsoleDossierCampaign from '@/client/components/console/info/ConsoleDossierCampaign.vue';
import {CardName} from '@/common/cards/CardName';
import {DossierCardHistory, DossierMedallion} from '@/client/console/infoDossierModel';
import {LiveScoreModel} from '@/client/console/liveScoreModel';

/*
 * THE INFORMATION POLISH (2026-10-19 — «сдержанно и дорого»): the dossier's heroes and the campaign as their quiet
 * objects. The score is ONE hero (the total) over a two-column ledger whose rows are SOLVED from the category count
 * (`data-dscore-rows`, the hero yields size to a long ledger — never the frame); a penalty reads with a true minus.
 * The card history is one neat PILE per printed type — the newest face upright, the events face DOWN (the table's law),
 * the paper edges of what lies under it (three at most) — and no badge, no fan. The campaign is the mission's board,
 * the route as nodes and the title points as a token.
 */
const medal = (key: DossierMedallion['key'], value: number, extra: Partial<DossierMedallion> = {}): DossierMedallion => ({
  key, label: key, short: key, accent: key, value, zero: value === 0, penalty: false, glyph: {kind: 'mark'}, ...extra,
});

const live = (total: number) => ({total, categories: [], positiveTotal: total, penaltyTotal: 0, maxCategoryValue: 0} as unknown as LiveScoreModel);

describe('the Information polish — the dossier heroes', () => {
  describe('ConsoleDossierScore — one hero, a quiet ledger', () => {
    it('the total is the hero; the ledger reads in two columns whose rows are half the categories', () => {
      const medallions = [medal('tr', 39), medal('milestones', 5), medal('awards', 10), medal('greenery', 4),
        medal('city', 7), medal('delta', 0), medal('cards', 30), medal('penalty', -1, {penalty: true, zero: false})];
      const w = mount(ConsoleDossierScore, {...globalConfig, props: {liveScore: live(94), medallions, segments: []}});
      expect(w.find('[data-dossier-total]').text()).eq('94');
      expect(w.find('[data-dossier-score]').attributes('data-dscore-rows'), 'eight categories → four rows of two').eq('4');
      expect(w.findAll('[data-dossier-medal]').map((r) => r.attributes('data-dossier-medal'))).deep.eq(
        ['tr', 'milestones', 'awards', 'greenery', 'city', 'delta', 'cards', 'penalty']);
      const penalty = w.find('[data-dossier-medal="penalty"]');
      expect(penalty.classes()).include('con-dscore__row--penalty');
      expect(penalty.find('.con-dscore__value').text(), 'a penalty reads with a TRUE minus').eq('−1');
      expect(w.find('[data-dossier-medal="delta"]').classes(), 'a zero stays a quiet row').include('con-infovp__cat--zero');
      // The shared-element anchors of the explorer's handoff stay where the motion looks for them.
      for (const anchor of ['[data-vpx-total]', '[data-vpx-bar]', '[data-vpx-block]']) {
        expect(w.find(anchor).exists(), anchor).is.true;
      }
    });

    it('the rows are solved from the count — a long ledger takes six rows (the hero yields), a short one keeps its own', () => {
      const many = ['tr', 'milestones', 'awards', 'greenery', 'city', 'moon', 'tracks', 'delta', 'cards', 'titles', 'penalty']
        .map((k) => medal(k as DossierMedallion['key'], 1));
      const long = mount(ConsoleDossierScore, {...globalConfig, props: {liveScore: live(11), medallions: many, segments: []}});
      expect(long.find('[data-dossier-score]').attributes('data-dscore-rows')).eq('6');
      const short = mount(ConsoleDossierScore, {...globalConfig, props: {liveScore: live(3), medallions: [medal('tr', 3)], segments: []}});
      expect(short.find('[data-dossier-score]').attributes('data-dscore-rows')).eq('1');
    });
  });

  describe('ConsoleDossierCards — one neat pile per type', () => {
    const history: DossierCardHistory = {
      corporations: [CardName.TERACTOR],
      stacks: [
        {key: 'active', label: 'Active', count: 18, faces: [CardName.BIRDS], more: 17},
        {key: 'automated', label: 'Automated', count: 2, faces: [CardName.MINE], more: 1},
        {key: 'events', label: 'Events', count: 6, faces: [CardName.COMET], more: 5},
        {key: 'prelude', label: 'Preludes', count: 1, faces: [CardName.DONATION], more: 0},
      ],
      total: 28,
    } as unknown as DossierCardHistory;

    it('the newest face stands upright, the events lie face DOWN, the edges count what lies under (three at most)', () => {
      const w = mount(ConsoleDossierCards, {...globalConfig, props: {history}});
      expect(w.find('[data-dossier-cards]').attributes('data-stacks'), 'the face size is solved by the number of piles').eq('4');
      const pile = (key: string) => w.find(`[data-dossier-stack="${key}"]`);
      expect(pile('active').findAll('.con-dcards__edge'), '18 cards: three edges').has.length(3);
      expect(pile('automated').findAll('.con-dcards__edge'), '2 cards: one edge').has.length(1);
      expect(pile('prelude').findAll('.con-dcards__edge'), 'a lone card: no edge').has.length(0);
      expect(pile('events').find('.con-dcards__top--back').exists(), 'the events pile is face down').is.true;
      expect(pile('active').find('.con-dcards__top--back').exists()).is.false;
      expect(pile('active').find('[data-dossier-stack-count]').text()).eq('18');
      expect(w.findAll('.con-dcards__badge'), 'no badge — the count is the ledger\'s quiet numeral').has.length(0);
    });
  });

  describe('ConsoleDossierCampaign — the campaign as objects', () => {
    it('the route as nodes (done · now · ahead), the mission line, the title points as a token', () => {
      const w = mount(ConsoleDossierCampaign, {
        ...globalConfig,
        props: {missionSlot: 1, missionCount: 4, missionText: '2 of 4', titles: [], tpText: '10 TP', tpNote: 'Accrues at the final mission', corpCount: '2'},
      });
      const nodes = w.findAll('.con-dcmp__node');
      expect(nodes).has.length(4);
      expect(nodes.map((n) => n.classes().includes('con-dcmp__node--done'))).deep.eq([true, false, false, false]);
      expect(nodes.map((n) => n.classes().includes('con-dcmp__node--now'))).deep.eq([false, true, false, false]);
      expect(w.find('[data-dossier-mission]').text()).eq('2 of 4');
      expect(w.find('.con-info__cmp-tp').text()).eq('10 TP');
      expect(w.find('.con-dcmp__board').exists(), 'no board known yet — no empty frame').is.false;
    });
  });
});
