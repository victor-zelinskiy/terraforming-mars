import {expect} from 'chai';
import {comparatorLabel, isInclusiveComparator} from '@/common/cards/requirementComparator';

describe('requirementComparator', () => {
  describe('isInclusiveComparator', () => {
    it('min and max are inclusive; strict/equality are not', () => {
      expect(isInclusiveComparator('min')).to.be.true;
      expect(isInclusiveComparator('max')).to.be.true;
      expect(isInclusiveComparator('gt')).to.be.false;
      expect(isInclusiveComparator('lt')).to.be.false;
      expect(isInclusiveComparator('eq')).to.be.false;
    });
  });

  describe('comparatorLabel — non-RU keeps math glyphs', () => {
    it('returns the glyph for every kind', () => {
      expect(comparatorLabel('min', 'en')).to.equal('≥');
      expect(comparatorLabel('max', 'en')).to.equal('≤');
      expect(comparatorLabel('gt', 'fr')).to.equal('>');
      expect(comparatorLabel('lt', 'cn')).to.equal('<');
      expect(comparatorLabel('eq', 'de')).to.equal('=');
    });
  });

  describe('comparatorLabel — RU uses words, uniform inclusive «от / до»', () => {
    it('min → от and max → до (no минимум / максимум)', () => {
      expect(comparatorLabel('min', 'ru')).to.equal('от');
      expect(comparatorLabel('max', 'ru')).to.equal('до');
    });

    it('strict and equality kinds: больше / меньше / ровно', () => {
      expect(comparatorLabel('gt', 'ru')).to.equal('больше');
      expect(comparatorLabel('lt', 'ru')).to.equal('меньше');
      expect(comparatorLabel('eq', 'ru')).to.equal('ровно');
    });

    it('never emits a math glyph and never «минимум / максимум»', () => {
      for (const kind of ['min', 'max', 'gt', 'lt', 'eq'] as const) {
        const label = comparatorLabel(kind, 'ru');
        expect(/[≥≤<>=]/.test(label), `${kind} → ${label}`).to.be.false;
        expect(label).to.not.equal('минимум');
        expect(label).to.not.equal('максимум');
      }
    });
  });
});
