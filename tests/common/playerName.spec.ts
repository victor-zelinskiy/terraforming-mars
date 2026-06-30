import {expect} from 'chai';
import {normalizePlayerName, validatePlayerName} from '../../src/common/utils/playerName';

describe('playerName', () => {
  describe('normalizePlayerName', () => {
    it('trims and lower-cases (locale-aware, Cyrillic)', () => {
      expect(normalizePlayerName('  Victor ')).eq('victor');
      expect(normalizePlayerName('ВИКТОР')).eq('виктор');
    });
    it('matches case/whitespace variants of the same name', () => {
      expect(normalizePlayerName(' nastYA ')).eq(normalizePlayerName('Nastya'));
    });
  });

  describe('validatePlayerName', () => {
    it('rejects empty / whitespace-only', () => {
      expect(validatePlayerName('')).deep.eq({ok: false, reason: 'empty'});
      expect(validatePlayerName('   ')).deep.eq({ok: false, reason: 'empty'});
    });
    it('rejects a single character', () => {
      expect(validatePlayerName('a')).deep.eq({ok: false, reason: 'too-short'});
    });
    it('rejects names over 32 code points', () => {
      expect(validatePlayerName('x'.repeat(33))).deep.eq({ok: false, reason: 'too-long'});
    });
    it('accepts a valid name and returns the trimmed display form', () => {
      expect(validatePlayerName('  Victor ')).deep.eq({ok: true, displayName: 'Victor'});
    });
  });
});
