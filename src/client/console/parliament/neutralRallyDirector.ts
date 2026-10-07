/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ДЕЛЕГАТЫ» — THE PHRASE of a card's rally of neutral delegates (Turmoil
 * Redux TR31 Nationalist Movement): FOUR BEATS on ONE pose, in the card's
 * printed order, each cube from its real source to its real place, nothing
 * ticking before its cause:
 *
 *   VOTES   — one cube per neutral vote of the record, from the common supply
 *             on the bench (`[data-parl-neutral-cube]`) to its own place on
 *             the card's ribbon (`[data-seq]`); the pool's count drops on the
 *             LIFT-OFF, the cube shows and the tally ticks on the TOUCHDOWN —
 *             and the WINNING marker moves on the touchdown of the cube that
 *             moved it (decision 6). One after another (`RALLY_CUBE_GAP_MS`
 *             after each landing);
 *   SUPPORT — one cube per area that takes one, from the supply to the next
 *             free place of the party's plaque (`flySupport`'s addresses); an
 *             area that takes NONE is READ on its plaque for a beat (the named
 *             zero in the quiet register) and no cube flies;
 *   COUNT   — the RECOUNT: every neutral cube in use is MARKED in the table's
 *             order (the ribbons by slot, then the six plaques' places — the
 *             record's `counted`, never the live table), the kicker's number
 *             growing by one per mark; a TASK PER TICK on the motion clock
 *             (`gsap.delayedCall`s fired in one tick batch into one render),
 *             fourteen marks inside ≈ 1.7 s;
 *   COIN    — ONE «+N M€» born at the kicker's counter, flying to the rail's
 *             M€ row (`flyRailReward` — the row held since the answer, ticking
 *             on the touchdown with its delta chip);
 * then the READ (`RALLY_READ_MS`) and `onDone`. Beats ride the motion clock
 * (`parliamentBeat.ts`), never a wall clock; `skip()` is idempotent and tears
 * the pending beats down — the holds go with the caller's teardown.
 *
 * The DOM half is handed in (`NeutralRallyStage`): the section measures the
 * places and flies the cubes; this file owns the ORDER and the WAITS, so the
 * unit tests drive the phrase with a stage of callbacks.
 */
import {ParliamentRallyModel, ParliamentRallySupportModel, ParliamentRallyVoteModel} from '@/common/models/ParliamentModel';
import {ReduxParty, ResolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {Rect} from './consoleParliamentVoteMotion';
import {ParliamentBeat, scheduleParliamentBeat} from './parliamentBeat';
import {SUPPORT_CUBE_STAGGER_MS} from './consoleParliamentModel';
import {rallyPlaceKey, rallyVoteKey} from './neutralRally';

/** The breath between a cube's touchdown and the next cube's launch. */
export const RALLY_CUBE_GAP_MS = 140;
/** The breath between the last area and the first mark of the recount. */
export const RALLY_COUNT_LEAD_MS = 260;
/** One mark of the recount — fourteen inside ≈ 1.7 s (decision 5). */
export const RALLY_COUNT_TICK_MS = 120;
/** The read after the coin's touchdown — the `CARD_EFFECT_READ_MS` class. */
export const RALLY_READ_MS = 520;
/** The rally's animation hold: a base, plus one per cube flown and per mark counted. */
export const RALLY_HOLD_BASE_MS = 6000;
export const RALLY_HOLD_ITEM_MS = 700;

/** ONE item of the recount, in the order it is marked. */
export type RallyCountItem =
  | {kind: 'vote', key: string, instance: ResolutionInstanceId, seq: number}
  | {kind: 'place', key: string, party: ReduxParty, place: number};

/** THE RECOUNT'S ORDER (pure): the record's `counted` flattened — every neutral vote by slot in the table's order, then every area's places. */
export function rallyCountOrder(record: Pick<ParliamentRallyModel, 'counted'>): Array<RallyCountItem> {
  const out: Array<RallyCountItem> = [];
  for (const slot of record.counted.votes) {
    for (const seq of slot.seqs) {
      out.push({kind: 'vote', key: rallyVoteKey(slot.instance, seq), instance: slot.instance, seq});
    }
  }
  for (const area of record.counted.support) {
    for (let place = 1; place <= area.count; place++) {
      out.push({kind: 'place', key: rallyPlaceKey(area.party, place), party: area.party, place});
    }
  }
  return out;
}

/** The rally's hold ceiling: the base, plus one per cube and per mark. */
export function neutralRallyHoldMs(record: Pick<ParliamentRallyModel, 'votes' | 'support' | 'counted'>): number {
  const cubes = record.votes.length + record.support.reduce((n, s) => n + s.gained, 0);
  return RALLY_HOLD_BASE_MS + RALLY_HOLD_ITEM_MS * (cubes + rallyCountOrder(record).length);
}

/**
 * THE BUDGET (pure, base ms): what the phrase costs before the coin — the
 * cube flights (`cubeMs` each, the caller's constant), the gaps, the areas'
 * reads, the recount's ticks. What the storyboards and the specs reason about.
 */
export function neutralRallyBudgetMs(record: Pick<ParliamentRallyModel, 'votes' | 'support' | 'counted'>, cubeMs: number): number {
  let total = record.votes.length * (cubeMs + RALLY_CUBE_GAP_MS);
  for (const entry of record.support) {
    total += entry.gained > 0 ? entry.gained * (cubeMs + RALLY_CUBE_GAP_MS) : SUPPORT_CUBE_STAGGER_MS;
  }
  total += RALLY_COUNT_LEAD_MS + rallyCountOrder(record).length * RALLY_COUNT_TICK_MS;
  return total;
}

/** The clock a director hands in (the motion clock by default). */
export type RallyBeatScheduler = (ms: number, fire: () => void) => ParliamentBeat;

/** What the section gives the phrase — the DOM half, one callback per physical act. Every measure is made at the launch. */
export type NeutralRallyStage = {
  beat?: RallyBeatScheduler;
  /** The common supply's place on the bench (the source of every cube). */
  pool: () => Rect | undefined;
  /** The ribbon place of a neutral vote (`[data-instance] [data-seq]`). */
  votePlace: (vote: ParliamentRallyVoteModel) => Rect | undefined;
  /** The `place`-th socket of `party`'s plaque. */
  supportPlace: (party: ReduxParty, place: number) => Rect | undefined;
  /** FLY one neutral cube; `onLanded` on the touchdown, `onLifted` when the proxy stands over the source. Returns the flight's id (undefined = settled on the spot). */
  fly: (from: Rect | undefined, to: Rect | undefined, onLanded: () => void, onLifted: () => void) => string | undefined;
  /** The kicker's counter — where the coin is born. */
  coinOrigin: () => TransferPoint | undefined;
  /** FLY the coin from `origin` to the rail; resolves when the row has ticked. */
  coin: (origin: TransferPoint | undefined) => Promise<unknown>;
  onBeat: (beat: 'votes' | 'support' | 'count' | 'coin' | 'read') => void;
  onLifted: () => void;
  onVoteLanded: (vote: ParliamentRallyVoteModel) => void;
  onSupportLanded: (entry: ParliamentRallySupportModel) => void;
  onSupportRead: (entry: ParliamentRallySupportModel) => void;
  onCounted: (item: RallyCountItem) => void;
  /** A flight could not be measured — named, never silent. */
  onDegraded: (why: string) => void;
  /** The read is over. */
  onDone: () => void;
};

export type NeutralRallyHandle = {
  /** Tear the pending beats down (idempotent); the flights already in the air are the caller's. */
  skip: () => void;
  active: () => boolean;
  /** The flights launched so far (the caller drops them on an abort). */
  flights: ReadonlyArray<string>;
};

/**
 * THE PHRASE: votes → support → the recount → the coin → the read. Each wait is
 * a real callback (a touchdown, the coin's promise) or a beat on the clock
 * handed in; nothing here is a timer.
 */
export function runNeutralRally(record: ParliamentRallyModel, stage: NeutralRallyStage): NeutralRallyHandle {
  const beat: RallyBeatScheduler = stage.beat ?? scheduleParliamentBeat;
  const reduced = consoleReducedMotionActive();
  const flights: Array<string> = [];
  let pending: ParliamentBeat | undefined;
  let active = true;
  const wait = (ms: number, then: () => void): void => {
    pending?.kill();
    pending = beat(ms, () => {
      pending = undefined;
      if (active) {
        then();
      }
    });
  };
  const flyOne = (from: Rect | undefined, to: Rect | undefined, what: string, onLanded: () => void): void => {
    if (!reduced && (from === undefined || to === undefined)) {
      stage.onDegraded(from === undefined ? `${what}: the neutral supply has no measurable place` : `${what}: no measurable place`);
    }
    const id = stage.fly(from, to, () => {
      if (active) {
        onLanded();
      }
    }, () => {
      if (active) {
        stage.onLifted();
      }
    });
    if (id !== undefined) {
      flights.push(id);
    }
  };

  // ── beat 4: the coin, then the read ──
  const coin = (): void => {
    stage.onBeat('coin');
    void stage.coin(stage.coinOrigin()).then(() => {
      if (!active) {
        return;
      }
      stage.onBeat('read');
      wait(RALLY_READ_MS, () => {
        active = false;
        stage.onDone();
      });
    }, () => {
      if (active) {
        active = false;
        stage.onDone();
      }
    });
  };

  // ── beat 3: the recount, a task per tick ──
  const order = rallyCountOrder(record);
  const count = (index: number): void => {
    if (index === 0) {
      stage.onBeat('count');
    }
    if (index >= order.length) {
      coin();
      return;
    }
    stage.onCounted(order[index]);
    wait(RALLY_COUNT_TICK_MS, () => count(index + 1));
  };

  // ── beat 2: the areas, in the record's order ──
  const support = (index: number): void => {
    if (index === 0) {
      stage.onBeat('support');
    }
    if (index >= record.support.length) {
      wait(RALLY_COUNT_LEAD_MS, () => count(0));
      return;
    }
    const entry = record.support[index];
    if (entry.gained <= 0) {
      stage.onSupportRead(entry);
      wait(SUPPORT_CUBE_STAGGER_MS, () => support(index + 1));
      return;
    }
    const cube = (n: number): void => {
      if (n >= entry.gained) {
        wait(RALLY_CUBE_GAP_MS, () => support(index + 1));
        return;
      }
      flyOne(stage.pool(), stage.supportPlace(entry.party, entry.current + n + 1), `support ${entry.party}`, () => {
        stage.onSupportLanded(entry);
        cube(n + 1);
      });
    };
    cube(0);
  };

  // ── beat 1: the votes, in the record's order ──
  const votes = (index: number): void => {
    if (index === 0) {
      stage.onBeat('votes');
    }
    if (index >= record.votes.length) {
      wait(index === 0 ? 0 : RALLY_CUBE_GAP_MS, () => support(0));
      return;
    }
    const vote = record.votes[index];
    flyOne(stage.pool(), stage.votePlace(vote), `vote ${vote.resolution}`, () => {
      stage.onVoteLanded(vote);
      if (index + 1 < record.votes.length) {
        wait(RALLY_CUBE_GAP_MS, () => votes(index + 1));
      } else {
        votes(index + 1);
      }
    });
  };

  votes(0);
  return {
    skip: () => {
      active = false;
      pending?.kill();
      pending = undefined;
    },
    active: () => active,
    flights,
  };
}
