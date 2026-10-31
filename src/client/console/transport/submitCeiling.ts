/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SUBMIT'S ONE HONEST CEILING — the SERVER did not answer at all (the owner, 2026-10-31: «ограничение должно
 * срабатывать только если сервер РЕАЛЬНО не отвечает, таймаут достаточно большой, и затем явно ошибка о том, что
 * сервер не отвечает»).
 *
 * WHAT IT MEASURES: the silence from the press to the response's headers — nothing else. The presentation that
 * follows an answer (the cinematic gates of the transport) is never timed here: a slow scene is not a dead server, and
 * a wedged scene is the liveness arbiter's (`consoleLiveness.ts`), which never cuts a request still on the wire. A move
 * is processed in milliseconds and a bot's turn is paced AFTER the answer, so `SUBMIT_NO_RESPONSE_MS` of silence is a
 * server that is down, restarting or wedged — never a busy one.
 *
 * WHAT IT DOES: the request is CANCELLED (the `AbortController`'s signal rides the fetch), the caller learns it was the
 * server's silence (`silent()`), and says so in so many words; the next view tells whether the move landed anyway.
 *
 * Pure apart from the injected clock (the scheduler is a parameter, so the server runner pins it with no fake timers).
 */

/** A minute: far above any honest answer, far below a player giving up and reloading. */
export const SUBMIT_NO_RESPONSE_MS = 60_000;

export type SubmitCeiling = {
  /** The signal for the fetch (undefined where `AbortController` does not exist). */
  signal: AbortSignal | undefined,
  /** The server answered (headers in) or the request failed otherwise — the ceiling stands down. Idempotent. */
  clear: () => void,
  /** Did the ceiling fire — was it the SERVER'S SILENCE that ended this request? */
  silent: () => boolean,
};

export type CeilingClock = {
  schedule: (run: () => void, ms: number) => unknown,
  cancel: (handle: unknown) => void,
};

const realClock: CeilingClock = {
  schedule: (run, ms) => setTimeout(run, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function armSubmitCeiling(
  onSilent: (ms: number) => void,
  ms: number = SUBMIT_NO_RESPONSE_MS,
  clock: CeilingClock = realClock,
): SubmitCeiling {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  let fired = false;
  let done = false;
  const handle = clock.schedule(() => {
    if (done) {
      return;
    }
    done = true;
    fired = true;
    onSilent(ms);
    controller?.abort();
  }, ms);
  return {
    signal: controller?.signal,
    clear: () => {
      if (done) {
        return;
      }
      done = true;
      clock.cancel(handle);
    },
    silent: () => fired,
  };
}
