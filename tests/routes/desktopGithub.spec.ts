import {expect} from 'chai';
import {githubCacheTtlMs, githubFetch, githubHeaders, hasGithubToken} from '../../src/server/routes/desktopGithub';

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

  describe('githubFetch auth fallback (a bad token must never be worse than no token)', () => {
    // A fake fetch recording the Authorization header of each call and returning scripted statuses.
    function fakeFetch(statuses: number[]) {
      const calls: Array<{auth: string | undefined}> = [];
      const impl = ((_url: string, init?: {headers?: Record<string, string>}) => {
        calls.push({auth: init?.headers?.Authorization});
        const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
        return Promise.resolve({status, ok: status >= 200 && status < 300} as Response);
      }) as unknown as typeof fetch;
      return {impl, calls};
    }

    it('no token → ONE unauthenticated call, no retry', async () => {
      const {impl, calls} = fakeFetch([200]);
      const res = await githubFetch('https://x', 'ua', 5000, impl);
      expect(res.status).to.equal(200);
      expect(calls).to.have.length(1);
      expect(calls[0].auth).to.be.undefined;
    });

    it('valid token → ONE authenticated call, no retry', async () => {
      process.env.GITHUB_TOKEN = 'ghp_ok';
      const {impl, calls} = fakeFetch([200]);
      await githubFetch('https://x', 'ua', 5000, impl);
      expect(calls).to.have.length(1);
      expect(calls[0].auth).to.equal('Bearer ghp_ok');
    });

    it('rejected token (401) → RETRIES unauthenticated, returns the second response', async () => {
      process.env.GITHUB_TOKEN = 'ghp_bad';
      const {impl, calls} = fakeFetch([401, 200]);
      const res = await githubFetch('https://x', 'ua', 5000, impl);
      expect(res.status).to.equal(200);
      expect(calls).to.have.length(2);
      expect(calls[0].auth).to.equal('Bearer ghp_bad'); // first: with token
      expect(calls[1].auth).to.be.undefined;             // retry: no token
    });

    it('insufficient token (403 — e.g. missing Actions:Read) → also retries unauthenticated', async () => {
      process.env.GITHUB_TOKEN = 'ghp_limited';
      const {impl, calls} = fakeFetch([403, 200]);
      const res = await githubFetch('https://x', 'ua', 5000, impl);
      expect(res.status).to.equal(200);
      expect(calls).to.have.length(2);
    });

    it('no token + 403 (rate limit) → does NOT retry (nothing to fall back from)', async () => {
      const {impl, calls} = fakeFetch([403, 200]);
      const res = await githubFetch('https://x', 'ua', 5000, impl);
      expect(res.status).to.equal(403);
      expect(calls).to.have.length(1);
    });
  });
});
