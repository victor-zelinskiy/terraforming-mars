import {expect} from 'chai';
import {buildCacheKey, cacheVersionChanged} from '../../electron/cacheVersion';

// The build-scoped immutable asset cache: `enforceVersionScopedCache` wipes Chromium's
// HTTP/code cache only when the build identity (settings.json version|head|builtAt) differs
// from the one that populated it. The side-effecting part touches `electron`/`fs`; the pure
// key composition + decision are unit-tested here.
//   npx mocha --import=tsx "tests/electron/cacheVersion.spec.ts"

describe('electron/cacheVersion', () => {
  describe('buildCacheKey', () => {
    it('composes version|head|builtAt', () => {
      expect(buildCacheKey({version: '1.0.7', head: 'e8db137e6', builtAt: 'Sun 15:18'}))
        .to.eq('1.0.7|e8db137e6|Sun 15:18');
    });
    it('changes when the git head changes (same package version)', () => {
      const a = buildCacheKey({version: '1.0.7', head: 'aaaaaaa', builtAt: 't1'});
      const b = buildCacheKey({version: '1.0.7', head: 'bbbbbbb', builtAt: 't1'});
      expect(a).to.not.eq(b);
    });
    it('changes when builtAt changes (rebuild without a commit)', () => {
      const a = buildCacheKey({version: '1.0.7', head: 'aaaaaaa', builtAt: 't1'});
      const b = buildCacheKey({version: '1.0.7', head: 'aaaaaaa', builtAt: 't2'});
      expect(a).to.not.eq(b);
    });
    it('is empty for missing settings (→ caller falls back to app version)', () => {
      expect(buildCacheKey(undefined)).to.eq('');
    });
    it('tolerates blank fields', () => {
      expect(buildCacheKey({})).to.eq('||');
    });
  });

  describe('cacheVersionChanged', () => {
    it('is true on first run (no stored key yet)', () => {
      expect(cacheVersionChanged(undefined, '1.0.7|abc|t1')).to.be.true;
    });
    it('is true when the build key changed (→ wipe the stale immutable cache)', () => {
      expect(cacheVersionChanged('1.0.7|abc|t1', '1.0.7|abc|t2')).to.be.true;
      expect(cacheVersionChanged('1.0.7|abc|t1', '1.0.8|def|t3')).to.be.true;
    });
    it('is false within one build (→ keep the fast immutable cache)', () => {
      expect(cacheVersionChanged('1.0.7|abc|t1', '1.0.7|abc|t1')).to.be.false;
    });
  });
});
