import {expect} from 'chai';
import * as path from 'path';
import {resolveFile, contentType} from '../../electron/protocol';

// Pure unit test of the app:// request mapping (electron/protocol.ts). It does
// NOT launch Electron: resolveFile/contentType use only `path`, so they run
// under the server test runner. Assertions are on the trailing relative segment
// (the ROOT differs between the compiled build/electron/ location and this
// source location, but the subdir + relative path — the thing under test — is
// identical).
//
//   npx mocha --import=tsx "tests/electron/protocol.spec.ts"

function endsWith(actual: string | undefined, ...segments: Array<string>): boolean {
  return actual !== undefined && actual.endsWith(path.join(...segments));
}

describe('electron/protocol resolveFile', () => {
  it('serves index.html for the root', () => {
    expect(endsWith(resolveFile('/'), 'assets', 'index.html')).to.be.true;
  });

  it('serves index.html for an SPA route (extensionless path)', () => {
    for (const route of ['/player', '/spectator', '/the-end', '/create-game', '/game']) {
      expect(endsWith(resolveFile(route), 'assets', 'index.html'), route).to.be.true;
    }
  });

  it('maps the bundle JS to build-desktop/', () => {
    expect(endsWith(resolveFile('/main.js'), 'build-desktop', 'main.js')).to.be.true;
    expect(endsWith(resolveFile('/vendors.js'), 'build-desktop', 'vendors.js')).to.be.true;
    expect(endsWith(resolveFile('/sw.js'), 'build-desktop', 'sw.js')).to.be.true;
    expect(endsWith(resolveFile('/main.js.map'), 'build-desktop', 'main.js.map')).to.be.true;
  });

  it('maps lazy chunks to build-desktop/chunks/', () => {
    expect(endsWith(resolveFile('/chunks/116.js'), 'build-desktop', 'chunks', '116.js')).to.be.true;
    expect(endsWith(resolveFile('/chunks/player-home.js'), 'build-desktop', 'chunks', 'player-home.js')).to.be.true;
  });

  it('maps styles.css to build/ (shared make:css output)', () => {
    expect(endsWith(resolveFile('/styles.css'), 'build', 'styles.css')).to.be.true;
  });

  it('maps /assets/** (art, fonts, locales) to assets/', () => {
    expect(endsWith(resolveFile('/assets/locales/ru.json'), 'assets', 'locales', 'ru.json')).to.be.true;
    expect(endsWith(resolveFile('/assets/Prototype.ttf'), 'assets', 'Prototype.ttf')).to.be.true;
    expect(endsWith(resolveFile('/assets/misc/production.png'), 'assets', 'misc', 'production.png')).to.be.true;
  });

  it('maps favicon.ico to assets/', () => {
    expect(endsWith(resolveFile('/favicon.ico'), 'assets', 'favicon.ico')).to.be.true;
  });

  it('maps a bare asset-extension path to assets/', () => {
    expect(endsWith(resolveFile('/futureforces.ttf'), 'assets', 'futureforces.ttf')).to.be.true;
  });

  it('preserves the query-less pathname (identity/route ride window.location)', () => {
    // The handler only sees the pathname; ?id=… never reaches resolveFile.
    expect(endsWith(resolveFile('/player'), 'assets', 'index.html')).to.be.true;
  });

  it('refuses path traversal (→ undefined → 403)', () => {
    expect(resolveFile('/chunks/../../../etc/passwd')).to.be.undefined;
    expect(resolveFile('/assets/../../secret')).to.be.undefined;
  });
});

describe('electron/protocol contentType', () => {
  it('maps common extensions', () => {
    expect(contentType('x/index.html')).to.match(/text\/html/);
    expect(contentType('x/main.js')).to.match(/javascript/);
    expect(contentType('x/styles.css')).to.match(/text\/css/);
    expect(contentType('x/ru.json')).to.match(/application\/json/);
    expect(contentType('x/Prototype.ttf')).to.eq('font/ttf');
    expect(contentType('x/tile.png')).to.eq('image/png');
    expect(contentType('x/main.js.map')).to.match(/application\/json/);
  });

  it('falls back to octet-stream for the unknown', () => {
    expect(contentType('x/weird.xyz')).to.eq('application/octet-stream');
  });
});
