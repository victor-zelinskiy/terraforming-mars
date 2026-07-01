import {expect} from 'chai';
import {apiBaseUrl, apiUrl, identitySearch, wsBaseUrl} from '../../src/client/utils/runtimeConfig';

// runtimeConfig reads the (browser) `window`; stub it so the pure resolution
// logic is testable under the server runner.
const g = global as unknown as {window?: unknown};

describe('client/runtimeConfig', () => {
  let saved: unknown;
  beforeEach(() => {
    saved = g.window;
    g.window = {location: {protocol: 'https:', host: 'tm.example.com', search: '?id=p1'}};
  });
  afterEach(() => {
    g.window = saved;
  });

  it('defaults to same-origin API base + location-derived WS + URL identity', () => {
    expect(apiBaseUrl()).to.eq('');
    expect(apiUrl('api/player')).to.eq('api/player');
    expect(wsBaseUrl()).to.eq('wss://tm.example.com');
    expect(identitySearch()).to.eq('?id=p1');
  });

  it('honours an injected tmRuntimeConfig (an Electron host)', () => {
    (g.window as {tmRuntimeConfig?: unknown}).tmRuntimeConfig = {
      apiBase: 'https://api.example.com',
      wsBase: 'wss://rt.example.com',
      participantId: 'p-secret',
    };
    expect(apiBaseUrl()).to.eq('https://api.example.com');
    expect(apiUrl('api/player')).to.eq('https://api.example.com/api/player');
    expect(wsBaseUrl()).to.eq('wss://rt.example.com');
    expect(identitySearch()).to.eq('?id=p-secret');
  });

  it('derives ws:// for a plain-http origin', () => {
    g.window = {location: {protocol: 'http:', host: 'localhost:8080', search: ''}};
    expect(wsBaseUrl()).to.eq('ws://localhost:8080');
  });
});
