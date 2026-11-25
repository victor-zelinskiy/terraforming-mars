/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHO KEPT THE BOARD COVERED — the witness of a wait for «a board the player can see».
 *
 * Another seat's tile, a nomad's hop, a law's own tile wait for a board that is not covered, and their ceiling is the
 * designed end when the VIEWER keeps it covered: the tile is revealed without its flight. Those waits used to DECLARE
 * that reason unconditionally (`CeilingWaitSpec.planned`) — and «covered» is a list of very different owners: the
 * viewer's own workspace or a reveal waiting for their take, but also a resource wave, a card on its way into the dock,
 * the played card's scene, the deck dealing, a sitting on its way up. A wave that never ends hides the foreign tile and
 * holds the `remote-landing` block — no placement grid for the viewer — and the line read «planned: the viewer keeps
 * the board covered» with nothing in it to say otherwise (the tier audit of 2026-11-18, row 3: four such lines of one
 * box session were «not judgeable»).
 *
 * THE LAW (who is waited for decides the wait — and a planned verdict is PROOF over the wait, never a declaration):
 * the wait looks at the cover's terms at every poll; its ceiling is the player's own time when a cover of the
 * PLAYER's stood at the ceiling or until moments before it, and a DEFECT — naming the terms — when nothing but the
 * game's own scenes has kept the board for `GAME_ONLY_TAIL_MS`. A leaked scene hidden behind the player's own cover
 * is not this wait's to name: its hold has its own ceiling.
 *
 * Pure: no DOM, no Vue, no timers — spec'd under the server runner (`tests/console/boardCoverWitness.spec.ts`).
 */

/** What the PLAYER looks at instead of the board: their own workspace, a reveal that waits for their take. */
export const PLAYER_COVER_TERMS: ReadonlySet<string> = new Set(['workspace', 'reveal']);

/** The game's own scenes alone kept the board for this long at the ceiling: no player is being waited for. */
export const GAME_ONLY_TAIL_MS = 5000;

/**
 * A COVER THAT ENDS AT A BOUND OF ITS OWN, and the bound: a sitting on its way up keeps the board until its frame
 * stands — or, left behind its plate, until its own net gives the board back (`sittingRise.SITTING_RISE_NET_MS`; the
 * spec holds the two numbers equal). While that cover ALONE has stood for less than its bound nothing leaks: the
 * scene is inside its designed life, and a wait whose ceiling comes first ends as designed — the tile revealed without
 * its flight. (The box's whole games in a real browser, 2026-11-24 — game 181: «held by the game's own scenes for
 * the last 13 s: sitting-rise», a sitting waiting behind its plate, filed as a defect of the landing's wait.) Past
 * its bound the cover no longer exists; beside any other scene of the game's the tail is judged as before.
 */
export const SELF_BOUNDED_COVERS: ReadonlyMap<string, number> = new Map([['sitting-rise', 15_000]]);

/**
 * THE COVER THAT TAKES THE BOARD OFF THE SCREEN — the player's own workspace. (A reveal's band is the player's time
 * too, but it stands OVER a board in view: a tile held hidden under it is a lie the player can see, and stays bounded.)
 */
export const BOARD_OFF_SCREEN_TERM = 'workspace';

/**
 * THE CLOCK OF A WAIT FOR THE BOARD — it runs only while the board could have shown the thing (the story law, the
 * owner's bar of 2026-11-25: «the nets are insurance»). A tile of another seat waits for a board the player can see;
 * while the player's own screen stands over the board nothing can be shown and nobody is lied to — the board is not on
 * screen, every instrument outside it reads the applied view — so that time is the PLAYER's and the wait's ceiling
 * does not count it. The ceiling stays for what it was written for: a board in view that the game's own scenes keep.
 *
 * `look(behind, now)` — one look of the wait; `behind`: the board is behind the player's own screen right now. The
 * span since the previous look belongs to the state that stood THROUGH it (the previous look's). Returns the time the
 * wait has stood on its own clock.
 */
export type BoardWaitClock = {
  look: (behind: boolean, now: number) => number,
  /** The time that was the player's own — behind their screen. */
  behindMs: () => number,
};

export function boardWaitClock(started: number): BoardWaitClock {
  let last = started;
  let own = 0;
  let behindTotal = 0;
  let wasBehind = false;
  return {
    look: (behind, now) => {
      const span = Math.max(0, now - last);
      if (wasBehind) {
        behindTotal += span;
      } else {
        own += span;
      }
      last = now;
      wasBehind = behind;
      return own;
    },
    behindMs: () => behindTotal,
  };
}

export type BoardCoverWitness = {
  /** One look of the wait: the terms that cover the board right now. Returns the wait's detail (what holds it). */
  look: (terms: ReadonlyArray<string>, now: number) => string,
  /** At the ceiling: `planned` — why it was the wait's honest end — or `undefined` (a defect); `detail` names the holders. */
  verdict: (now: number) => {planned: string | undefined, detail: string},
};

export function watchBoardCover(): BoardCoverWitness {
  /** Since when nothing of the player's has covered the board (`undefined` — a player's cover stands). */
  let gameOnlySince: number | undefined;
  const gameTerms = new Set<string>();
  const playerTerms = new Set<string>();
  let last: ReadonlyArray<string> = [];
  return {
    look: (terms, now) => {
      last = terms;
      const players = terms.filter((term) => PLAYER_COVER_TERMS.has(term));
      for (const term of players) {
        playerTerms.add(term);
      }
      if (players.length > 0 || terms.length === 0) {
        gameOnlySince = undefined;
        gameTerms.clear();
      } else {
        gameOnlySince ??= now;
        for (const term of terms) {
          gameTerms.add(term);
        }
      }
      return `covered by ${terms.join(' + ') || 'nothing'}`;
    },
    verdict: (now) => {
      const tailMs = gameOnlySince === undefined ? 0 : now - gameOnlySince;
      if (tailMs >= GAME_ONLY_TAIL_MS) {
        const held = [...gameTerms];
        const detail = `held by the game's own scenes for the last ${Math.round(tailMs / 1000)} s: ${held.join(' + ')}`;
        const bound = held.length === 1 ? SELF_BOUNDED_COVERS.get(held[0]) : undefined;
        if (bound !== undefined && tailMs < bound) {
          return {planned: `${held[0]} kept the board inside its own bound of ${Math.round(bound / 1000)} s`, detail};
        }
        return {planned: undefined, detail};
      }
      const by = [...playerTerms].join(' + ') || last.join(' + ');
      return {planned: `the viewer kept the board covered by ${by}`, detail: `covered by ${last.join(' + ') || 'nothing'}`};
    },
  };
}
