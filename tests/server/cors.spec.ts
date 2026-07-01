import {expect} from 'chai';
import {paths} from '../../src/common/app/paths';
import {Request} from '../../src/server/Request';
import {Response} from '../../src/server/Response';
import {handleDesktopCors, isCorsEligiblePath, resolveAllowedOrigin} from '../../src/server/server/cors';

// Pure unit test of the desktop CORS layer (src/server/server/cors.ts). No HTTP
// server: a minimal Request/Response mock captures the headers/status.
//   npx mocha --import=tsx "tests/server/cors.spec.ts"

function mockReq(method: string, origin?: string, host?: string): Request {
  const headers: Record<string, string> = {};
  if (origin !== undefined) {
    headers.origin = origin;
  }
  if (host !== undefined) {
    headers.host = host;
  }
  return {method, url: '/', headers} as unknown as Request;
}

type Captured = {
  headers: Record<string, string>,
  status: number | undefined,
  ended: boolean,
  res: Response,
};

function mockRes(): Captured {
  const captured: Captured = {headers: {}, status: undefined, ended: false, res: undefined as unknown as Response};
  captured.res = {
    setHeader(name: string, value: string | number | ReadonlyArray<string>) {
      captured.headers[name] = String(value);
      return captured.res as never;
    },
    writeHead(status: number) {
      captured.status = status;
      return captured.res as never;
    },
    write() {
      return true;
    },
    end() {
      captured.ended = true;
    },
  } as unknown as Response;
  return captured;
}

const ELIGIBLE = paths.API_PLAYER; // 'api/player'
const ADMIN = paths.API_GAMES; // 'api/games' — deliberately NOT in the CORS surface

describe('server/cors', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.TM_DESKTOP_ALLOWED_ORIGINS;
    delete process.env.TM_DESKTOP_ALLOWED_ORIGINS;
  });
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.TM_DESKTOP_ALLOWED_ORIGINS;
    } else {
      process.env.TM_DESKTOP_ALLOWED_ORIGINS = saved;
    }
  });

  it('is a no-op for a same-origin (no Origin) request', () => {
    const c = mockRes();
    const handled = handleDesktopCors(mockReq('GET'), c.res, ELIGIBLE);
    expect(handled).to.be.false;
    expect(c.headers).to.deep.eq({});
  });

  it('is a no-op for a same-origin POST (Origin host === request host — no false warning)', () => {
    const c = mockRes();
    const handled = handleDesktopCors(mockReq('POST', 'http://localhost:8080', 'localhost:8080'), c.res, paths.PLAYER_INPUT);
    expect(handled).to.be.false;
    expect(c.headers).to.deep.eq({});
  });

  it('reflects the allowlisted app://bundle origin on an eligible GET (no wildcard, no credentials)', () => {
    const c = mockRes();
    const handled = handleDesktopCors(mockReq('GET', 'app://bundle'), c.res, ELIGIBLE);
    expect(handled).to.be.false; // not a preflight — dispatch continues
    expect(c.headers['Access-Control-Allow-Origin']).to.eq('app://bundle');
    expect(c.headers['Access-Control-Allow-Origin']).to.not.eq('*');
    expect(c.headers['Vary']).to.eq('Origin');
    expect(c.headers).to.not.have.property('Access-Control-Allow-Credentials');
  });

  it('answers an eligible allowlisted OPTIONS preflight with 204 and stops', () => {
    const c = mockRes();
    const handled = handleDesktopCors(mockReq('OPTIONS', 'app://bundle'), c.res, ELIGIBLE);
    expect(handled).to.be.true;
    expect(c.status).to.eq(204);
    expect(c.ended).to.be.true;
    expect(c.headers['Access-Control-Allow-Origin']).to.eq('app://bundle');
  });

  it('does NOT grant CORS to an admin/auth path even from the allowlisted origin', () => {
    const c = mockRes();
    const handled = handleDesktopCors(mockReq('GET', 'app://bundle'), c.res, ADMIN);
    expect(handled).to.be.false;
    expect(c.headers).to.not.have.property('Access-Control-Allow-Origin');
  });

  it('rejects an admin-path preflight from the allowlisted origin with 403', () => {
    const c = mockRes();
    const handled = handleDesktopCors(mockReq('OPTIONS', 'app://bundle'), c.res, ADMIN);
    expect(handled).to.be.true;
    expect(c.status).to.eq(403);
    expect(c.headers).to.not.have.property('Access-Control-Allow-Origin');
  });

  it('blocks a non-allowlisted origin on an eligible path (no ACAO; preflight 403)', () => {
    const c1 = mockRes();
    handleDesktopCors(mockReq('GET', 'https://evil.example.com'), c1.res, ELIGIBLE);
    expect(c1.headers).to.not.have.property('Access-Control-Allow-Origin');

    const c2 = mockRes();
    const handled = handleDesktopCors(mockReq('OPTIONS', 'https://evil.example.com'), c2.res, ELIGIBLE);
    expect(handled).to.be.true;
    expect(c2.status).to.eq(403);
  });

  it('honours TM_DESKTOP_ALLOWED_ORIGINS (comma-separated, explicit)', () => {
    process.env.TM_DESKTOP_ALLOWED_ORIGINS = 'app://bundle, https://desktop.example.com';
    expect(resolveAllowedOrigin('https://desktop.example.com')).to.eq('https://desktop.example.com');
    const c = mockRes();
    handleDesktopCors(mockReq('GET', 'https://desktop.example.com'), c.res, ELIGIBLE);
    expect(c.headers['Access-Control-Allow-Origin']).to.eq('https://desktop.example.com');
    // The default is replaced by the explicit env list.
    expect(resolveAllowedOrigin('app://bundle')).to.eq('app://bundle');
  });

  it('defaults to app://bundle only when the env var is unset', () => {
    expect(resolveAllowedOrigin('app://bundle')).to.eq('app://bundle');
    expect(resolveAllowedOrigin('app://other')).to.be.undefined;
    expect(resolveAllowedOrigin(undefined)).to.be.undefined;
    expect(resolveAllowedOrigin('')).to.be.undefined;
  });

  it('scopes eligibility to the game-runtime + create/join surface', () => {
    for (const p of [paths.API_PLAYER, paths.PLAYER_INPUT, paths.API_WAITING_FOR, paths.API_CREATEGAME, paths.API_GAMES_JOINABLE, paths.API_GAME_REMATCH]) {
      expect(isCorsEligiblePath(p), p).to.be.true;
    }
    for (const p of [paths.API_GAMES, paths.API_GAME_DELETE, paths.API_PROFILE, paths.LOGIN, paths.API_METRICS, 'admin']) {
      expect(isCorsEligiblePath(p), p).to.be.false;
    }
  });
});
