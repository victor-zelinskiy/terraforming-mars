/*
 * THE API CONTEXT DOES NOT FAIL ON A STALE SOCKET (FLAKE ZERO — the class «socket hang up (ECONNRESET)»).
 *
 * Playwright's API context keeps its connections alive; the server closes an idle one after its keep-alive time; a
 * request sent on that socket in the same instant is reset before the server has read a byte of it. Thirty-three
 * specs carried a private retry for it, the driver's `fetchPlayerModel` another — and the SEED doors had none: 108
 * sites post `/api/creategame`, every fixture goes through `/api/dev/load-game` (`console-parliament-quest-plate`
 * tv4k, flaky on CI run 45140395156: the sixth fixture of one test, posted after a long look at the fifth).
 *
 * Once, in the harness's `request` fixture (`consoleTest.ts`): a request that is SAFE TO SEND AGAIN is sent again
 * when — and only when — the connection was reset. Safe: a GET / HEAD (idempotent), and a POST to a seed door (a game
 * created twice is one orphan game and changes nothing a spec reads). NEVER a player's input: an answer the server
 * may already have taken is not asked twice.
 *
 * No import of Playwright here — the rule is a pure module the server runner's guard reads (`e2eReplaySafe.spec`).
 */

const CONNECTION_RESET = /ECONNRESET|socket hang up/;
/** The doors that only CREATE a table. */
const SEED_DOORS = /\/api\/(creategame|dev\/load-game)(\?|$)/;

export type ReplayMethod = 'get' | 'head' | 'post';

/** Was this failure the stale socket's reset (and nothing else)? */
export function connectionWasReset(err: unknown): boolean {
  return CONNECTION_RESET.test(String(err));
}

/** May this request be sent a second time without changing what the game is? */
export function replaySafe(method: ReplayMethod, url: string): boolean {
  return method === 'get' || method === 'head' || SEED_DOORS.test(url);
}

type Sender = (url: string, ...rest: Array<unknown>) => Promise<unknown>;

/** `request`, with the stale-socket reset answered by ONE resend of a request that is safe to send again. */
export function replaySafeRequest<T extends object>(request: T): T {
  return new Proxy(request, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop, target);
      if (typeof value !== 'function') {
        return value;
      }
      const bound = (value as (...args: Array<unknown>) => unknown).bind(target);
      if (prop !== 'get' && prop !== 'head' && prop !== 'post') {
        return bound;
      }
      const send = bound as Sender;
      return (url: string, ...rest: Array<unknown>): Promise<unknown> => send(url, ...rest).catch((err: unknown) => {
        if (!replaySafe(prop, url) || !connectionWasReset(err)) {
          throw err;
        }
        return send(url, ...rest);
      });
    },
  });
}
