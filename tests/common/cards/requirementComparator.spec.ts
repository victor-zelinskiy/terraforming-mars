import {expect} from 'chai';
import {RequirementType} from '@/common/cards/RequirementType';
import {comparatorLabel, requirementScale} from '@/common/cards/requirementComparator';

describe('requirementComparator', () => {
  describe('requirementScale', () => {
    it('classifies global-parameter / track requirements as global', () => {
      for (const t of [
        RequirementType.OXYGEN,
        RequirementType.TEMPERATURE,
        RequirementType.OCEANS,
        RequirementType.VENUS,
        RequirementType.TR,
        RequirementType.HABITAT_RATE,
        RequirementType.MINING_RATE,
        RequirementType.LOGISTIC_RATE,
      ]) {
        expect(requirementScale(t), t).to.equal('global');
      }
    });

    it('classifies object counts as quantity', () => {
      for (const t of [
        RequirementType.TAG,
        RequirementType.PRODUCTION,
        RequirementType.CITIES,
        RequirementType.GREENERIES,
        RequirementType.COLONIES,
        RequirementType.FLOATERS,
        RequirementType.RESOURCE_TYPES,
        RequirementType.PARTY_LEADERS,
        RequirementType.HABITAT_TILES,
        RequirementType.MINING_TILES,
        RequirementType.ROAD_TILES,
        RequirementType.CORRUPTION,
        RequirementType.UNDERGROUND_TOKENS,
      ]) {
        expect(requirementScale(t), t).to.equal('quantity');
      }
    });
  });

  describe('comparatorLabel — non-RU keeps math glyphs', () => {
    it('returns the glyph regardless of scale', () => {
      expect(comparatorLabel('min', 'global', 'en')).to.equal('≥');
      expect(comparatorLabel('max', 'global', 'en')).to.equal('≤');
      expect(comparatorLabel('min', 'quantity', 'en')).to.equal('≥');
      expect(comparatorLabel('max', 'quantity', 'en')).to.equal('≤');
      expect(comparatorLabel('gt', 'quantity', 'fr')).to.equal('>');
      expect(comparatorLabel('lt', 'global', 'cn')).to.equal('<');
      expect(comparatorLabel('eq', 'quantity', 'de')).to.equal('=');
    });
  });

  describe('comparatorLabel — RU uses words', () => {
    it('global scale: от / до', () => {
      expect(comparatorLabel('min', 'global', 'ru')).to.equal('от');
      expect(comparatorLabel('max', 'global', 'ru')).to.equal('до');
    });

    it('quantity scale: минимум / максимум', () => {
      expect(comparatorLabel('min', 'quantity', 'ru')).to.equal('минимум');
      expect(comparatorLabel('max', 'quantity', 'ru')).to.equal('максимум');
    });

    it('strict and equality kinds: больше / меньше / ровно', () => {
      expect(comparatorLabel('gt', 'global', 'ru')).to.equal('больше');
      expect(comparatorLabel('lt', 'global', 'ru')).to.equal('меньше');
      expect(comparatorLabel('eq', 'global', 'ru')).to.equal('ровно');
      expect(comparatorLabel('gt', 'quantity', 'ru')).to.equal('больше');
      expect(comparatorLabel('lt', 'quantity', 'ru')).to.equal('меньше');
      expect(comparatorLabel('eq', 'quantity', 'ru')).to.equal('ровно');
    });

    it('never emits a math glyph for RU', () => {
      const kinds = ['min', 'max', 'gt', 'lt', 'eq'] as const;
      const scales = ['global', 'quantity'] as const;
      for (const kind of kinds) {
        for (const scale of scales) {
          const label = comparatorLabel(kind, scale, 'ru');
          expect(/[≥≤<>=]/.test(label), `${kind}/${scale} → ${label}`).to.be.false;
        }
      }
    });
  });
});
