/**
 * THE RENDERER HANG WATCH — the one observer that lives OUTSIDE the page.
 *
 * A stop inside native rendering (style / layout / paint / the compositor — CI 42626840874's 15-minute hand-album hang
 * on SwiftShader; the box's 11 s stop with the renderer's main thread in R and VizCompositor at 99 %) never returns to
 * JS: the liveness arbiter, the wait graph and the beat-stall guard all run on that very thread, so none of them sees
 * it, let alone cures it. Only the main process does — Electron's `unresponsive` / `responsive` / `render-process-gone`.
 *
 * What it does:
 *  - every few seconds it keeps the page's LAST field-recorder heartbeat (`window.__conFieldRecorder`, one probe in
 *    flight at most — a hung page never piles them up), so a stop can name WHERE the screen stood before the silence;
 *  - `unresponsive` → one line (console export, stdout = the Deck wrapper's log, the server's field log): the last
 *    screen and how long before the silence it was read;
 *  - still silent after `reloadAfterMs` → the renderer is crashed on purpose and the page reloads — a reload raises
 *    the start / the live prompt by itself (the game is the server's), so the player gets the table back instead of a
 *    frozen picture; bounded (`maxReloads` per `reloadWindowMs`) so a page that hangs on boot is not reloaded forever;
 *  - `responsive` → how long the stop lasted; `render-process-gone` (not a clean exit) → named and reloaded.
 *
 * The core is PURE of Electron (`createRendererHangWatch(deps)`) — unit-tested with fake timers.
 */

/** The page facts the probe returns (`PROBE_SCRIPT`) — the field recorder's identity + its last heartbeat. */
export type HangProbe = {
  session?: string, game?: string, player?: string, profile?: string, build?: string, ua?: string,
  beat?: {prompt?: string, accepting?: boolean, frames?: ReadonlyArray<string>, section?: string, quietS?: number, graph?: string, at?: number} | null,
};

/** Read in the page: a compact JSON of the recorder's identity and its LAST heartbeat ('' when there is no recorder). */
export const PROBE_SCRIPT = `(() => {
  const r = window.__conFieldRecorder && window.__conFieldRecorder();
  if (!r) return '';
  const b = r.heartbeats && r.heartbeats.length > 0 ? r.heartbeats[r.heartbeats.length - 1] : null;
  return JSON.stringify({session: r.session, game: r.game, player: r.player, profile: r.profile, build: r.build, ua: r.ua, beat: b});
})()`;

export type HangWatchDeps = {
  /** Runs `PROBE_SCRIPT` in the page; resolves with its string (never resolves while the page hangs). */
  probe: () => Promise<string>,
  /** One line for the console export + stdout. */
  note: (line: string) => void,
  /** One record for the server's field log (`POST /api/field-log`). */
  post: (body: {kind: string, record: object}) => void,
  /** Crash the hung renderer (its `render-process-gone` then reloads the page). */
  crash: () => void,
  /** Reload the page. */
  reload: () => void,
  now: () => number,
  setTimer: (fn: () => void, ms: number) => unknown,
  clearTimer: (handle: unknown) => void,
};

export type HangWatchOptions = {
  /** How long the page may stay unresponsive before it is reloaded. */
  reloadAfterMs: number,
  /** Reload budget: at most `maxReloads` within `reloadWindowMs`. */
  maxReloads: number,
  reloadWindowMs: number,
};

export const HANG_WATCH_DEFAULTS: HangWatchOptions = {reloadAfterMs: 30_000, maxReloads: 3, reloadWindowMs: 5 * 60_000};

/** «where the screen stood» — the last heartbeat in one line (PURE). */
export function describeLastScreen(last: HangProbe | undefined, readAt: number, now: number): string {
  const beat = last?.beat ?? undefined;
  if (last === undefined || beat === undefined || beat === null) {
    return 'no heartbeat read yet';
  }
  const age = Math.round((now - readAt) / 1000);
  return `read ${age}s before: prompt ${beat.prompt === undefined || beat.prompt === '' ? 'none' : beat.prompt}` +
    `, ${beat.accepting === true ? 'accepting' : 'NOT accepting'}, frames ${(beat.frames ?? []).join(';') || '-'}` +
    `, section ${beat.section ?? '-'}, quiet ${beat.quietS ?? 0}s` +
    (beat.graph !== undefined && beat.graph !== '' ? `, waits ${beat.graph}` : '');
}

export function createRendererHangWatch(deps: HangWatchDeps, options: HangWatchOptions = HANG_WATCH_DEFAULTS) {
  let last: HangProbe | undefined;
  let lastAt = 0;
  let probing = false;
  let hungSince = 0;
  let reloadTimer: unknown;
  let crashedOnPurpose = false;
  const reloads: Array<number> = [];

  const record = (text: string): object => ({
    session: last?.session ?? '', startedAt: hungSince, game: last?.game ?? '', player: last?.player ?? '',
    profile: last?.profile ?? '', build: last?.build ?? '', ua: last?.ua ?? '',
    lines: [{at: deps.now(), text}], heartbeats: last?.beat !== undefined && last.beat !== null ? [last.beat] : [],
  });
  const say = (kind: string, text: string): void => {
    deps.note(text);
    deps.post({kind, record: record(text)});
  };
  const reloadBudgetLeft = (): boolean => {
    const now = deps.now();
    while (reloads.length > 0 && now - reloads[0] > options.reloadWindowMs) {
      reloads.shift();
    }
    return reloads.length < options.maxReloads;
  };
  const reloadNow = (why: string): void => {
    if (!reloadBudgetLeft()) {
      say('renderer-hang', `[renderer-hang] ${why} — NOT reloaded: ${options.maxReloads} reloads in ${Math.round(options.reloadWindowMs / 60_000)} min already`);
      return;
    }
    reloads.push(deps.now());
    deps.reload();
  };

  return {
    /** Keep the last heartbeat (call every few seconds). One probe in flight at most. */
    probeTick(): void {
      if (probing || hungSince !== 0) {
        return;
      }
      probing = true;
      deps.probe().then((json) => {
        if (json !== '') {
          last = JSON.parse(json) as HangProbe;
          lastAt = deps.now();
        }
      }).catch(() => undefined).finally(() => {
        probing = false;
      });
    },
    onUnresponsive(): void {
      if (hungSince !== 0) {
        return;
      }
      hungSince = deps.now();
      say('renderer-hang', `[renderer-hang] the page stopped answering — the last screen (${describeLastScreen(last, lastAt, hungSince)})`);
      reloadTimer = deps.setTimer(() => {
        reloadTimer = undefined;
        if (hungSince === 0) {
          return;
        }
        const s = Math.round((deps.now() - hungSince) / 1000);
        say('renderer-hang', `[renderer-hang] still not answering after ${s}s — the renderer is restarted and the page reloads (the game restores itself)`);
        if (reloadBudgetLeft()) {
          crashedOnPurpose = true;
          deps.crash();
        } else {
          reloadNow(`not answering after ${s}s`);
        }
      }, options.reloadAfterMs);
    },
    onResponsive(): void {
      if (hungSince === 0) {
        return;
      }
      const s = Math.round((deps.now() - hungSince) / 1000);
      hungSince = 0;
      if (reloadTimer !== undefined) {
        deps.clearTimer(reloadTimer);
        reloadTimer = undefined;
      }
      say('renderer-hang', `[renderer-hang] the page answers again after ${s}s`);
    },
    onGone(reason: string, exitCode: number): void {
      if (reloadTimer !== undefined) {
        deps.clearTimer(reloadTimer);
        reloadTimer = undefined;
      }
      hungSince = 0;
      const purposeful = crashedOnPurpose;
      crashedOnPurpose = false;
      if (reason === 'clean-exit') {
        return;
      }
      if (!purposeful) {
        say('renderer-hang', `[renderer-hang] the renderer process is gone (${reason}, exit ${exitCode}) — the page reloads (last screen: ${describeLastScreen(last, lastAt, deps.now())})`);
      }
      reloadNow(`the renderer process is gone (${reason})`);
    },
  };
}
