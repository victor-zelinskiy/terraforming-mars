import {expect} from 'chai';
import {HttpStatusError, isNetworkFailure, isStaleChunkFailure, requestFailed, requestRefused} from '@/client/diagnostics/requestFailure';
import {classifyLine} from '@/common/diagnostics/classify';

/*
 * A REQUEST THAT FAILED IS THE NETWORK'S WORD — UNLESS SOMETHING OF OURS THREW (the audit of what reaches the collector,
 * 2026-11-19: 15 of the 34 sites sent as errors were a connection blinking or a server answering — and the same catch
 * hid real throws under «cannot contact the server»).
 */
describe('requestFailure — the network\'s word is a note, a throw of our own is an error', () => {
  const warned: Array<string> = [];
  const errored: Array<string> = [];
  let realWarn: typeof console.warn;
  let realError: typeof console.error;

  beforeEach(() => {
    warned.length = 0;
    errored.length = 0;
    realWarn = console.warn;
    realError = console.error;
    console.warn = (...args: Array<unknown>) => warned.push(args.map(String).join(' '));
    console.error = (...args: Array<unknown>) => errored.push(args.map(String).join(' '));
  });
  afterEach(() => {
    console.warn = realWarn;
    console.error = realError;
  });

  it('what a browser\'s fetch rejects with — and an abort, a timeout, a status — is the network\'s', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).to.eq(true);
    expect(isNetworkFailure(new TypeError('NetworkError when attempting to fetch resource.'))).to.eq(true);
    expect(isNetworkFailure(new TypeError('Load failed'))).to.eq(true);
    expect(isNetworkFailure(Object.assign(new Error('The user aborted a request.'), {name: 'AbortError'}))).to.eq(true);
    expect(isNetworkFailure(Object.assign(new Error('signal timed out'), {name: 'TimeoutError'}))).to.eq(true);
    expect(isNetworkFailure(new HttpStatusError(503, 'Service Unavailable'))).to.eq(true);
  });

  it('a throw of OUR code inside the same catch is not', () => {
    expect(isNetworkFailure(new TypeError('Cannot read properties of undefined (reading \'game\')'))).to.eq(false);
    expect(isNetworkFailure(new SyntaxError('Unexpected token < in JSON at position 0'))).to.eq(false);
    expect(isNetworkFailure(new Error('the presenter threw'))).to.eq(false);
    expect(isNetworkFailure('a string')).to.eq(false);
    expect(isNetworkFailure(undefined)).to.eq(false);
  });

  it('the network\'s word is printed as a NOTE of the family `net` — never an untagged error', () => {
    expect(requestFailed('the journal\'s poll', new TypeError('Failed to fetch'))).to.eq('network');
    requestRefused('the submit', 502, 'Bad Gateway');
    expect(warned).to.deep.eq([
      '[net] the journal\'s poll — TypeError: Failed to fetch',
      '[net] the submit — the server answered 502 Bad Gateway',
    ]);
    expect(errored, 'nothing reached the error channel').to.deep.eq([]);
    for (const line of warned) {
      expect(classifyLine(line, 'warn')).to.deep.include({family: 'net', kind: 'note', known: true});
    }
  });

  it('a chunk of an OLDER BUILD is the deployment\'s word — read by what the browser says, whatever the bundler', () => {
    expect(isStaleChunkFailure(new TypeError('Failed to fetch dynamically imported module: https://example.test/chunks/console-x.js'))).to.eq(true);
    expect(isStaleChunkFailure(new TypeError('error loading dynamically imported module'))).to.eq(true);
    expect(isStaleChunkFailure(new TypeError('Importing a module script failed.'))).to.eq(true);
    expect(isStaleChunkFailure(Object.assign(new Error('Loading chunk 12 failed.'), {name: 'ChunkLoadError'})), 'the old bundler\'s name still reads').to.eq(true);
    expect(isStaleChunkFailure(new TypeError('Failed to fetch')), 'a plain network failure is not a stale page').to.eq(false);
    expect(isStaleChunkFailure(new TypeError('x is not a function'))).to.eq(false);
  });

  it('a throw of our own is reported as an ERROR, named by the request that caught it', () => {
    expect(requestFailed('the submit', new TypeError('presenter is not a function'))).to.eq('bug');
    expect(warned, 'not a note').to.deep.eq([]);
  });
});
