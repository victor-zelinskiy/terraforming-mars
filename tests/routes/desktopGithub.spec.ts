import {expect} from 'chai';
import {githubCacheTtlMs, githubHeaders, hasGithubToken} from '../../src/server/routes/desktopGithub';

// Pure unit test of the desktop GitHub-gate helpers (token → shorter caches → faster update pickup).
//   npx mocha --import=tsx --require tests/testing/setup.ts "tests/routes/desktopGithub.spec.ts"

describe('server/routes/desktopGithub', () => {
  const KEYS = ['TM_DESKTOP_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'TM_DESKTOP_GITHUB_TTL_MS'];
  const saved: Record<string, string | undefined> = {};
  before(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
    }
  });
  beforeEach(() => {
    for (const k of KEYS) {
      delete process.env[k];
    }
  });
  after(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = saved[k];
      }
    }
  });

  describe('hasGithubToken / githubHeaders', () => {
    it('no token → no Authorization header (unchanged behaviour)', () => {
      expect(hasGithubToken()).to.be.false;
      const h = githubHeaders('tm-desktop-gate');
      expect(h.Authorization).to.be.undefined;
      expect(h['User-Agent']).to.equal('tm-desktop-gate');
      expect(h.Accept).to.equal('application/vnd.github+json');
    });

    it('any of the three token envs → Bearer auth', () => {
      for (const key of ['TM_DESKTOP_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) {
        for (const k of KEYS) {
          delete process.env[k];
        }
        process.env[key] = '  ghp_secret  ';
        expect(hasGithubToken(), key).to.be.true;
        expect(githubHeaders('x').Authorization, key).to.equal('Bearer ghp_secret');
      }
    });
  });

  describe('githubCacheTtlMs', () => {
    it('no token → the LONG (rate-limit-safe) ttl', () => {
      expect(githubCacheTtlMs(30_000, 120_000)).to.equal(120_000);
    });
    it('token present → the SHORT (fast-pickup) ttl', () => {
      process.env.GITHUB_TOKEN = 'ghp_x';
      expect(githubCacheTtlMs(30_000, 120_000)).to.equal(30_000);
    });
    it('a positive numeric override wins regardless of token', () => {
      expect(githubCacheTtlMs(30_000, 120_000, '5000')).to.equal(5000);
      process.env.GITHUB_TOKEN = 'ghp_x';
      expect(githubCacheTtlMs(30_000, 120_000, '5000')).to.equal(5000);
    });
    it('a blank / non-numeric / non-positive override is ignored', () => {
      expect(githubCacheTtlMs(30_000, 120_000, '')).to.equal(120_000);
      expect(githubCacheTtlMs(30_000, 120_000, 'abc')).to.equal(120_000);
      expect(githubCacheTtlMs(30_000, 120_000, '0')).to.equal(120_000);
      expect(githubCacheTtlMs(30_000, 120_000, '-5')).to.equal(120_000);
    });
  });
});
