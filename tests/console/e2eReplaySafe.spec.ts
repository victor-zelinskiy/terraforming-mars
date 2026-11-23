import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {connectionWasReset, replaySafe, replaySafeRequest} from '../e2e/replaySafe';

/**
 * THE E2E API CONTEXT AND THE STALE SOCKET (FLAKE ZERO — `tests/e2e/replaySafe.ts`). A keep-alive connection the
 * server closed in the instant a request went out answers «socket hang up (ECONNRESET)» before the server has read a
 * byte. The harness resends ONCE what is safe to send again — and never a player's input.
 */
describe('the e2e request fixture — a stale socket resends what is safe, once', () => {
  const reset = () => Promise.reject(new Error('apiRequestContext.post: socket hang up (ECONNRESET)'));

  /** A fake API context: each method answers from its queue, counting the calls. */
  function fake(answers: Record<string, Array<() => Promise<unknown>>>) {
    const calls: Array<string> = [];
    const method = (name: string) => function(this: unknown, url: string): Promise<unknown> {
      calls.push(`${name} ${url}`);
      const next = answers[name]?.shift();
      return next === undefined ? Promise.resolve({ok: true}) : next();
    };
    return {calls, context: {get: method('get'), head: method('head'), post: method('post'), put: method('put'), baseURL: 'http://x'}};
  }

  it('the rule: a GET, a HEAD and a POST to a SEED door are safe; an input never is', () => {
    expect(replaySafe('get', '/api/player?id=p1')).is.true;
    expect(replaySafe('head', '/')).is.true;
    expect(replaySafe('post', '/api/creategame')).is.true;
    expect(replaySafe('post', '/api/dev/load-game')).is.true;
    expect(replaySafe('post', 'http://localhost:8080/api/dev/load-game?x=1')).is.true;
    expect(replaySafe('post', '/player/input?id=p1'), 'an answer the server may have taken is not asked twice').is.false;
    expect(replaySafe('post', '/api/campaign/abc/launch')).is.false;
    expect(connectionWasReset(new Error('read ECONNRESET'))).is.true;
    expect(connectionWasReset(new Error('Request timed out after 30000ms'))).is.false;
  });

  it('a reset on a seed door is sent again — once — and its answer is the request\'s', async () => {
    const f = fake({post: [reset, () => Promise.resolve({ok: true, id: 'second'})]});
    const answer = await replaySafeRequest(f.context).post('/api/dev/load-game');
    expect(answer).to.deep.eq({ok: true, id: 'second'});
    expect(f.calls).to.deep.eq(['post /api/dev/load-game', 'post /api/dev/load-game']);
  });

  it('…and a second reset is the failure it is — never a loop', async () => {
    const f = fake({get: [reset, reset]});
    let failed = '';
    await replaySafeRequest(f.context).get('/api/player?id=p1').catch((err: unknown) => {
      failed = String(err);
    });
    expect(failed).to.contain('ECONNRESET');
    expect(f.calls).to.have.length(2);
  });

  it('a player\'s input is NEVER sent twice, whatever failed', async () => {
    const f = fake({post: [reset]});
    let failed = '';
    await replaySafeRequest(f.context).post('/player/input?id=p1').catch((err: unknown) => {
      failed = String(err);
    });
    expect(failed).to.contain('socket hang up');
    expect(f.calls).to.deep.eq(['post /player/input?id=p1']);
  });

  it('any other failure of a safe request is not resent; everything else of the context passes through', async () => {
    const f = fake({get: [() => Promise.reject(new Error('Request timed out after 30000ms'))]});
    let failed = '';
    const wrapped = replaySafeRequest(f.context);
    await wrapped.get('/api/player?id=p1').catch((err: unknown) => {
      failed = String(err);
    });
    expect(failed).to.contain('timed out');
    expect(f.calls).to.have.length(1);
    expect(wrapped.baseURL).to.eq('http://x');
    await wrapped.put('/x');
    expect(f.calls[1]).to.eq('put /x');
  });

  it('the harness uses it for EVERY spec\'s `request`', () => {
    const harness = fs.readFileSync(path.resolve(__dirname, '../e2e/consoleTest.ts'), 'utf8').replace(/\r\n/g, '\n');
    expect(harness).to.match(/request: async \(\{request\}, use\) => \{\s+await use\(replaySafeRequest\(request\)\);\s+\},/);
  });
});
