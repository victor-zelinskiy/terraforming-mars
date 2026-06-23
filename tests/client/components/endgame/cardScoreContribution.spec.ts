import {expect} from 'chai';
import {classifyCardVp, decomposePlayerCardVp, CardDecl, CardLookup} from '@/client/components/endgame/cardScoreContribution';
import {CardVictoryPointsDetail} from '@/common/game/VictoryPointsBreakdown';
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';

function detail(cardName: string, victoryPoint: number, kind: CardVictoryPointsDetail['kind'] = 'fixed'): CardVictoryPointsDetail {
  return {cardName, victoryPoint, kind};
}
function decl(victoryPoints: CardDecl['victoryPoints'], extra: Partial<CardDecl> = {}): CardDecl {
  return {victoryPoints, tags: [], type: CardType.AUTOMATED, ...extra};
}

describe('cardScoreContribution (rework §6)', () => {
  describe('classifyCardVp', () => {
    it('a plain printed number → printed (high)', () => {
      const r = classifyCardVp(detail('X', 3), decl(3));
      expect(r.source).to.eq('printed');
      expect(r.confidence).to.eq('high');
    });
    it('a printed number on an EVENT card → event', () => {
      const r = classifyCardVp(detail('X', 1), decl(1, {type: CardType.EVENT}));
      expect(r.source).to.eq('event');
    });
    it('resourcesHere + ANIMAL resourceType → animal (high)', () => {
      const r = classifyCardVp(detail('Birds', 4, 'resource'), decl({resourcesHere: {}}, {resourceType: CardResource.ANIMAL}));
      expect(r.source).to.eq('animal');
      expect(r.confidence).to.eq('high');
    });
    it('resourcesHere + per + MICROBE → microbe', () => {
      const r = classifyCardVp(detail('Decomposers', 2, 'resource'), decl({resourcesHere: {}, per: 3}, {resourceType: CardResource.MICROBE}));
      expect(r.source).to.eq('microbe');
    });
    it('resourcesHere + FLOATER → floater', () => {
      const r = classifyCardVp(detail('Jovian Lanterns', 3, 'resource'), decl({resourcesHere: {}, per: 2}, {resourceType: CardResource.FLOATER}));
      expect(r.source).to.eq('floater');
    });
    it('a jovian tag multiplier → jovian', () => {
      const r = classifyCardVp(detail('Ganymede Colony', 3, 'conditional'), decl({tag: Tag.JOVIAN}));
      expect(r.source).to.eq('jovian');
    });
    it('a non-jovian tag multiplier → tagMultiplier', () => {
      const r = classifyCardVp(detail('X', 2, 'conditional'), decl({tag: Tag.EARTH}));
      expect(r.source).to.eq('tagMultiplier');
    });
    it('a city-counting card → city', () => {
      const r = classifyCardVp(detail('Commercial District', 2, 'conditional'), decl({cities: {}, nextToThis: {}}));
      expect(r.source).to.eq('city');
    });
    it("a 'special' resource card → its resource (medium)", () => {
      const r = classifyCardVp(detail('X', 3, 'resource'), decl('special', {resourceType: CardResource.ANIMAL}));
      expect(r.source).to.eq('animal');
      expect(r.confidence).to.eq('medium');
    });
    it("a 'special' non-resource card → condition (medium)", () => {
      const r = classifyCardVp(detail('Search For Life', 3, 'conditional'), decl('special'));
      expect(r.source).to.eq('condition');
      expect(r.confidence).to.eq('medium');
    });
    it('a penalty (negative VP) → other (high)', () => {
      const r = classifyCardVp(detail('X', -2, 'penalty'), decl(0));
      expect(r.source).to.eq('other');
      expect(r.confidence).to.eq('high');
    });
    it('no manifest declaration → coarse fallback (low confidence)', () => {
      const r = classifyCardVp(detail('Unknown', 5, 'fixed'), undefined);
      expect(r.source).to.eq('printed');
      expect(r.confidence).to.eq('low');
    });
  });

  describe('decomposePlayerCardVp', () => {
    const lookup: CardLookup = (name) => {
      const table: Record<string, CardDecl> = {
        Pets: decl({resourcesHere: {}}, {resourceType: CardResource.ANIMAL}),
        Birds: decl({resourcesHere: {}}, {resourceType: CardResource.ANIMAL}),
        Ganymede: decl({tag: Tag.JOVIAN}),
        Flat: decl(4),
        Penalty: decl(0),
      };
      return table[name];
    };

    it('aggregates VP by source + tracks penalties + total of positives', () => {
      const details: Array<CardVictoryPointsDetail> = [
        detail('Pets', 3, 'resource'),
        detail('Birds', 5, 'resource'),
        detail('Ganymede', 4, 'conditional'),
        detail('Flat', 4, 'fixed'),
        detail('Penalty', -2, 'penalty'),
      ];
      const {bySource, contributions} = decomposePlayerCardVp(details, {Pets: 3, Birds: 5}, lookup);
      expect(bySource.animal).to.eq(8); // Pets 3 + Birds 5
      expect(bySource.jovian).to.eq(4);
      expect(bySource.printed).to.eq(4);
      expect(bySource.penalties).to.eq(-2);
      expect(bySource.total, 'positives only').to.eq(16);
      // contributions sorted by VP desc, carry the on-card resource count.
      expect(contributions[0].cardName).to.eq('Birds');
      expect(contributions.find((c) => c.cardName === 'Pets')!.resourcesOnCard).to.eq(3);
    });

    it('an unknown card degrades confidence to low', () => {
      const {bySource} = decomposePlayerCardVp([detail('Mystery', 6, 'fixed')], {}, () => undefined);
      expect(bySource.confidence).to.eq('low');
      expect(bySource.printed).to.eq(6);
    });
  });
});
