import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {CardModel} from '../../src/common/models/CardModel';
import {Color} from '../../src/common/Color';
import {
  dossierActionCounts, dossierActionTiles, dossierCardHistory, dossierEffectFamilies, dossierLadder, dossierMedallions,
  dossierPlateTiles, dossierSealedFacts, MEDALLION_EMBLEMS_MAX, scoreCategoryGlyph,
} from '../../src/client/console/infoDossierModel';
import {ScoreOverviewModel, ScoreTile} from '../../src/client/console/scoreExplorerModel';
import {SCORE_CATEGORY_TABLE} from '../../src/client/console/endgame/consoleEndgameModel';
import {PlayedZones} from '../../src/client/components/console/consolePlayedModel';

/**
 * TR60 — THE PARTICIPANT DOSSIER's pure half: which objects stand on the Information summary and in what order.
 * Every number is a model's; the module computes no rule and never reads a hidden score.
 */
const card = (name: string, extra: Partial<CardModel> = {}): CardModel => ({name: name as CardName, ...extra} as CardModel);

function tile(key: ScoreTile['key'], value: number, ledger: ScoreTile['ledger'] = {kind: 'empty', empty: {key: 'e', label: 'x'}}): ScoreTile {
  return {key, label: key, accent: key, value, sharePct: 0, zero: value === 0, penalty: key === 'penalty', ledger};
}

describe('infoDossierModel', () => {
  describe('the score medallions', () => {
    it('one medallion per overview tile, in the ceremony\'s order, each with its category\'s own symbol', () => {
      const overview: ScoreOverviewModel = {
        total: 40, positiveTotal: 40, penaltyTotal: 0,
        tiles: [tile('tr', 30), tile('milestones', 5, {kind: 'medallions', entries: [{name: 'Terraformer', slug: 'terraformer'}], moreCount: 0, caption: {key: 'c', label: 'x'}}),
          tile('awards', 0), tile('greenery', 2), tile('city', 1), tile('cards', 2), tile('moon', 0)],
      };
      const medallions = dossierMedallions(overview);
      expect(medallions.map((m) => m.key)).deep.eq(['tr', 'milestones', 'awards', 'greenery', 'city', 'cards', 'moon']);
      expect(medallions.map((m) => m.glyph)).deep.eq([
        {kind: 'icon', icon: 'tr'},
        {kind: 'emblems', slugs: ['terraformer']},
        {kind: 'line', icon: 'awards'},
        {kind: 'tile', tile: 'greenery'},
        {kind: 'tile', tile: 'city'},
        {kind: 'icon', icon: 'cards'},
        {kind: 'line', icon: 'moon'},
      ]);
      expect(medallions.filter((m) => m.zero).map((m) => m.key), 'a zero stays IN the list (a seat switch morphs ink, never layout)').deep.eq(['awards', 'moon']);
    });

    it('every category with a sign of its own is told by SHAPE — no two categories share the accent dot', () => {
      // The owner's finale frame (2026-10-28): milestones · awards · titles were three identical gold dots, so «5»,
      // «7» and «35» under a seat could not be told apart.
      const keys = SCORE_CATEGORY_TABLE.map((m) => m.key).filter((k) => k !== 'tracks');
      for (const key of keys) {
        expect(scoreCategoryGlyph(key).kind, key).not.eq('mark');
      }
      const shapes = keys.map((k) => JSON.stringify(scoreCategoryGlyph(k)));
      expect(new Set(shapes).size, 'one sign per category').eq(shapes.length);
    });

    it('at most a few earned emblems stand inside one medallion', () => {
      const entries = ['a', 'b', 'c', 'd', 'e'].map((s) => ({name: s, slug: s}));
      const [m] = dossierMedallions({total: 25, positiveTotal: 25, penaltyTotal: 0,
        tiles: [tile('milestones', 25, {kind: 'medallions', entries, moreCount: 0, caption: {key: 'c', label: 'x'}})]});
      expect(m.glyph).deep.eq({kind: 'emblems', slugs: entries.slice(0, MEDALLION_EMBLEMS_MAX).map((e) => e.slug)});
    });
  });

  describe('the sealed cell — a hidden score leaves only what is public', () => {
    it('the rating and the seat\'s OWN claimed milestones / funded awards — nobody else\'s, and no VP number anywhere', () => {
      const facts = dossierSealedFacts(24, 'red' as Color,
        [{name: 'Terraformer', color: 'red' as Color}, {name: 'Mayor', color: 'blue' as Color}, {name: 'Gardener'}],
        [{name: 'Landlord', color: 'red' as Color}, {name: 'Banker'}],
        (n) => n.toLowerCase());
      expect(facts).deep.eq({rating: 24, milestones: [{name: 'Terraformer', slug: 'terraformer'}], awards: [{name: 'Landlord', slug: 'landlord'}]});
      expect(Object.keys(facts), 'the sealed facts carry no score field').not.to.include.members(['total', 'vp', 'categories']);
    });
  });

  describe('the card history', () => {
    const zones = (over: Partial<PlayedZones>): PlayedZones => ({corporations: [], preludes: [], ceos: [], active: [], automated: [], events: [], ...over});

    it('the corporations, then a fan per type with cards — the most recent faces on top, the rest counted', () => {
      const history = dossierCardHistory(zones({
        corporations: [card('Teractor')],
        active: ['a1', 'a2', 'a3', 'a4', 'a5'].map((n) => card(n)),
        events: [card('e1')],
      }), 3);
      expect(history.corporations).deep.eq(['Teractor']);
      expect(history.stacks.map((s) => [s.key, s.count, s.faces, s.more])).deep.eq([
        ['active', 5, ['a5', 'a4', 'a3'], 2],
        ['events', 1, ['e1'], 0],
      ]);
      expect(history.total).eq(7);
    });

    it('the bot\'s corporation counts like a human\'s (the played table\'s parity); an empty table is an empty history', () => {
      expect(dossierCardHistory(zones({automated: [card('x')]}), 3, 1).total).eq(2);
      expect(dossierCardHistory(zones({}), 3)).deep.eq({corporations: [], stacks: [], total: 0});
    });
  });

  describe('the action tiles — the state is the SERVER\'s, read by the viewer\'s own right to know', () => {
    const cards = ['A', 'B', 'C', 'D', 'E'].map((n) => card(n));
    const hasAction = (n: CardName) => n !== ('E' as CardName);

    it('the viewer\'s own seat: ready (no reason from the server), blocked (with its reason), used — ordered ready · blocked · used', () => {
      const withReason = [card('A'), card('B', {actionReasons: [{type: 'resource', message: 'Not enough energy'}]} as Partial<CardModel>), card('C'), card('D'), card('E')];
      const tiles = dossierActionTiles(withReason, hasAction, new Set(['C' as CardName]), true);
      expect(tiles.map((t) => [t.name, t.state])).deep.eq([['A', 'ready'], ['D', 'ready'], ['B', 'blocked'], ['C', 'used']]);
      expect(tiles[2].reason).deep.eq({message: 'Not enough energy', params: []});
      expect(dossierActionCounts(tiles)).deep.eq([{state: 'ready', count: 2}, {state: 'blocked', count: 1}, {state: 'used', count: 1}]);
    });

    it('another seat: only the PUBLIC «used this generation» — the rest is idle, never a reason, never «ready»', () => {
      const tiles = dossierActionTiles(cards, hasAction, new Set(['B' as CardName]), false);
      expect(tiles.map((t) => [t.name, t.state])).deep.eq([['A', 'idle'], ['C', 'idle'], ['D', 'idle'], ['B', 'used']]);
      expect(tiles.some((t) => t.reason !== undefined)).eq(false);
    });
  });

  describe('the effect families and the career ladder', () => {
    it('the families in canonical order, led by what is armed for the next card', () => {
      const families = dossierEffectFamilies({total: 5, families: [{family: 'triggers', label: 'Triggers', count: 3}, {family: 'discounts', label: 'Discounts', count: 2}]} as never, 1);
      expect(families.map((f) => [f.family, f.count])).deep.eq([['armed', 1], ['triggers', 3], ['discounts', 2]]);
      expect(dossierEffectFamilies({total: 0, families: []} as never, 0)).deep.eq([]);
    });

    it('the ladder: passed steps, the marker\'s own, the next one, the rest ahead', () => {
      expect(dossierLadder(2, 5).map((p) => p.state)).deep.eq(['passed', 'here', 'next', 'ahead', 'ahead']);
      expect(dossierLadder(0, 3).map((p) => p.state), 'no marker yet: the first step is the next').deep.eq(['next', 'ahead', 'ahead']);
      expect(dossierLadder(3, 3).map((p) => p.state), 'the end of the track has no next').deep.eq(['passed', 'passed', 'here']);
    });
  });

  describe('the actions plate past its cap', () => {
    const t = (name: string, state: 'ready' | 'idle' | 'blocked' | 'used') => ({name: name as CardName, state});
    it('every state that exists keeps its first tile; the order stays the state order; one cell is «+K»', () => {
      const tiles = [t('a', 'ready'), t('b', 'ready'), t('c', 'ready'), t('d', 'ready'), t('e', 'blocked'), t('f', 'blocked'), t('g', 'used'), t('h', 'used'), t('i', 'used')];
      const shown = dossierPlateTiles(tiles, 4);
      expect(shown.map((x) => x.name), 'three cells and «+K»').deep.eq(['a', 'e', 'g']);
      expect(dossierPlateTiles(tiles, 6).map((x) => x.name), 'room left fills in the state order').deep.eq(['a', 'b', 'c', 'e', 'g']);
      expect(new Set(shown.map((x) => x.state)), 'ready · blocked · used — all three read on the plate').deep.eq(new Set(['ready', 'blocked', 'used']));
    });
    it('under the cap the plate is the whole list', () => {
      const tiles = [t('a', 'ready'), t('g', 'used')];
      expect(dossierPlateTiles(tiles, 8)).deep.eq(tiles);
    });
  });
});
