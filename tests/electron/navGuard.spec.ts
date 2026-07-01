import {expect} from 'chai';
import {originOf, isSameOrigin, isExternalHttp} from '../../electron/navGuard';

// Regression test for the packaged-app "Join does nothing" bug: Node's URL parser
// returns origin 'null' for the non-standard `app://` scheme, so the will-navigate
// same-origin check must compute the origin as scheme://host manually.
//   npx mocha --import=tsx "tests/electron/navGuard.spec.ts"

const APP = 'app://bundle';

describe('electron/navGuard', () => {
  describe('originOf', () => {
    it('computes app:// origin as scheme://host (NOT the Node "null")', () => {
      expect(originOf('app://bundle/player?id=X')).to.eq('app://bundle');
      expect(originOf('app://bundle/')).to.eq('app://bundle');
      expect(originOf('app://bundle/spectator?id=Y&z=1')).to.eq('app://bundle');
    });
    it('computes http(s) origins with host+port', () => {
      expect(originOf('http://localhost:8080/player?id=X')).to.eq('http://localhost:8080');
      expect(originOf('https://tm.example.com/api/player')).to.eq('https://tm.example.com');
    });
    it('is undefined for garbage', () => {
      expect(originOf('not a url')).to.be.undefined;
    });
  });

  describe('isSameOrigin (the regression)', () => {
    it('accepts same-origin app:// navigation (Join / create / leave / rematch)', () => {
      expect(isSameOrigin('app://bundle/player?id=X', APP)).to.be.true;
      expect(isSameOrigin('app://bundle/', APP)).to.be.true;
      expect(isSameOrigin('app://bundle/create-game', APP)).to.be.true;
      expect(isSameOrigin('app://bundle/the-end?id=Z', APP)).to.be.true;
    });
    it('rejects cross-origin navigation from an app:// renderer', () => {
      expect(isSameOrigin('https://evil.example.com/x', APP)).to.be.false;
      expect(isSameOrigin('http://localhost:8080/player', APP)).to.be.false;
    });
    it('works in server mode (http origin)', () => {
      const server = originOf('http://localhost:8080') ?? '';
      expect(isSameOrigin('http://localhost:8080/player?id=X', server)).to.be.true;
      expect(isSameOrigin('app://bundle/x', server)).to.be.false;
    });
    it('never treats an unparseable/opaque target as same-origin', () => {
      expect(isSameOrigin('not a url', APP)).to.be.false;
    });
  });

  describe('isExternalHttp', () => {
    it('is true only for http(s)', () => {
      expect(isExternalHttp('http://x.com')).to.be.true;
      expect(isExternalHttp('https://x.com/y')).to.be.true;
      expect(isExternalHttp('app://bundle/player')).to.be.false;
      expect(isExternalHttp('mailto:a@b.c')).to.be.false;
      expect(isExternalHttp('garbage')).to.be.false;
    });
  });
});
