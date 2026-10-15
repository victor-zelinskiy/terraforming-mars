/*
 * «ПРИЁМ РЕСУРСА КАРТОЙ» — THE ONE GRAMMAR of a resource landing on a card the
 * player can see (Turmoil Redux TR53, the iteration «ресурс на карту — один
 * стандарт», 2026-10-15; contract: docs/TURMOIL_REDUX_FRONTIER_LABS.md).
 *
 * Four hosts used to say it four ways — the «Разыграно» stage (the card
 * emerged out of its strip, the token landed, it went back: the reference),
 * the action composer (the miniature stood still, a quick absorb, nothing
 * read), the live «on which card» prompt (the chosen card dived off the
 * bottom of the screen like a draft pick and NOTHING flew), the board (the
 * card rose out of its satellite cell only for the TR21 family). ONE phrase
 * now, in four phases, whatever the host:
 *
 *   PRESENT — the receiving card is SHOWN and singled out, by the host's own
 *             move (the stage's emergence · the composer's lift · the prompt's
 *             seal while the other candidates recede · the board's rise out of
 *             its satellite cell, or out of the plate the player chose it on);
 *   PAY     — a token per unit leaves its REAL source (the paying cell, the
 *             colony's planet, the source card's printed icon, the card that
 *             landed) and lands on the card's capsule; the capsule ticks ON THE
 *             TOUCHDOWN, never before;
 *   READ    — «before → after» stands (the host's `readMs`);
 *   RETURN  — the card goes home (its strip · its row · its satellite cell).
 *
 * The director owns the ORDER, the probe state, the named hold and the honest
 * degrade; the hosts own the DOM (they plug their moves in as hooks). A PRESENT
 * or a PAY that finds nothing to measure DEGRADES: the scene stops, every hold
 * the host seeded is released at once (the numbers tick, nothing flies) and the
 * state says so (`degraded`). Reduced motion: no hook runs, every hold is
 * released (the counters tick with the commit).
 *
 * The hold is NOTIFICATION-ONLY (`card-receive`): a scene often plays INSIDE a
 * standing decision surface (the prompt's own plate, the colony stage), and a
 * blocking hold retracts every mandatory surface — the plate would unmount under
 * its own payout (the `inSurface` contract of the transfer framework). A host
 * whose scene owns the board keeps its OWN blocking hold (`city-data-payout`,
 * `played-hero`) — the director never replaces it.
 */
import {reactive} from 'vue';
import {gsap} from 'gsap';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** WHERE the scene plays — the four hosts, the prompt split by its source (the colony stage is a prompt's host too). */
export type CardReceiveHost = 'played' | 'composer' | 'prompt' | 'colony' | 'board' | 'resolution';

export type CardReceivePhase = 'idle' | 'present' | 'pay' | 'read' | 'return';

/** How a scene ended — a probe's and a caller's verdict. */
export type CardReceiveOutcome = 'done' | 'degraded' | 'aborted' | 'reduced';

/**
 * The READ beat per host (ms, before `motionMs`): long enough for «2 → 3» to
 * register where the card was carried for it (the board, the plate), a breath
 * where the host's own settle already presses the card (the played stage's
 * confirmation press is its read), short in a composer row whose workspace
 * folds right after (a long read there is a stall).
 */
export const RECEIVE_READ_MS: Record<CardReceiveHost, number> = {
  played: 0,
  composer: 240,
  prompt: 520,
  colony: 520,
  board: 680,
  resolution: 260,
};

export const cardReceiveState = reactive({
  host: undefined as CardReceiveHost | undefined,
  phase: 'idle' as CardReceivePhase,
  /** The receiving card of the scene on stage. */
  card: undefined as string | undefined,
  /** The last scene's verdict — `degraded` names a scene that found nothing to measure. */
  outcome: undefined as CardReceiveOutcome | undefined,
  /** Scenes played since load (a probe's liveness witness). */
  runs: 0,
  /** The phases the last scene walked, in order (a probe reads the grammar, not a guess). */
  walked: [] as Array<CardReceivePhase>,
});

/** A scene is on stage (the notification-only hold). */
export function cardReceiveActive(): boolean {
  return cardReceiveState.phase !== 'idle';
}

registerAnimationHoldSupplier('card-receive', cardReceiveActive, {
  scope: 'notification-only',
  diagnose: () => ({host: cardReceiveState.host, phase: cardReceiveState.phase, card: cardReceiveState.card}),
  expire: () => abortCardReceive(),
});

/** ONE scene: the host's four moves, in the grammar's order. */
export type CardReceiveScene = {
  host: CardReceiveHost;
  /** The receiving card (a probe's name for it). */
  card: string;
  /** PRESENT — show and single the card out. `false`: nothing measurable — the scene degrades. */
  present: () => Promise<boolean>;
  /** PAY — the tokens from the source to the capsule, each ticking on its touchdown. `false`: degraded. */
  pay: () => Promise<boolean>;
  /** RETURN — the card goes home. */
  ret: () => Promise<void>;
  /** The READ beat (ms, before `motionMs`); default `RECEIVE_READ_MS[host]`. */
  readMs?: number;
  /** Every hold the host seeded, released — called EXACTLY once on every way out (done, degrade, abort, reduced). */
  release?: () => void;
  /** The host is still there to play on (an abort mid-scene stops at the next phase). */
  alive?: () => boolean;
};

let epoch = 0;
let owedRelease: (() => void) | undefined;

function payRelease(): void {
  const release = owedRelease;
  owedRelease = undefined;
  release?.();
}

/** A wait on the GSAP clock — the clock every proxy of a scene animates on (a wall-clock wait drifts on a starved renderer). */
function beat(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    gsap.delayedCall(motionMs(ms) / 1000, () => resolve());
  });
}

/**
 * PLAY one scene. Never rejects: a hook that throws degrades the scene (its
 * holds released), the next scene starts clean. Scenes do not overlap — a new
 * one aborts the previous (its holds released first).
 */
export async function runCardReceive(scene: CardReceiveScene): Promise<CardReceiveOutcome> {
  if (cardReceiveActive()) {
    abortCardReceive();
  }
  const myEpoch = ++epoch;
  let released = false;
  owedRelease = () => {
    if (!released) {
      released = true;
      scene.release?.();
    }
  };
  cardReceiveState.runs++;
  cardReceiveState.walked = [];
  cardReceiveState.host = scene.host;
  cardReceiveState.card = scene.card;
  const end = (outcome: CardReceiveOutcome): CardReceiveOutcome => {
    if (epoch === myEpoch) {
      cardReceiveState.phase = 'idle';
      cardReceiveState.outcome = outcome;
      payRelease();
    }
    return outcome;
  };
  if (consoleReducedMotionActive()) {
    return end('reduced');
  }
  const live = () => epoch === myEpoch && (scene.alive?.() ?? true);
  const enter = (phase: CardReceivePhase) => {
    cardReceiveState.phase = phase;
    cardReceiveState.walked = [...cardReceiveState.walked, phase];
  };
  try {
    enter('present');
    if (!await scene.present()) {
      return end('degraded');
    }
    if (!live()) {
      return epoch === myEpoch ? end('aborted') : 'aborted';
    }
    enter('pay');
    if (!await scene.pay()) {
      return end('degraded');
    }
    if (!live()) {
      return epoch === myEpoch ? end('aborted') : 'aborted';
    }
    enter('read');
    await beat(scene.readMs ?? RECEIVE_READ_MS[scene.host]);
    if (!live()) {
      return epoch === myEpoch ? end('aborted') : 'aborted';
    }
    enter('return');
    await scene.ret();
    return epoch === myEpoch ? end('done') : 'aborted';
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[card-receive] a host move threw — the scene degrades', scene.host, scene.card, e);
    }
    return epoch === myEpoch ? end('degraded') : 'aborted';
  }
}

/** Abort the scene on stage (an unmount, a ceiling): its holds are released, the state goes idle (idempotent). */
export function abortCardReceive(): void {
  epoch++;
  if (cardReceiveState.phase !== 'idle') {
    cardReceiveState.outcome = 'aborted';
  }
  cardReceiveState.phase = 'idle';
  payRelease();
}
