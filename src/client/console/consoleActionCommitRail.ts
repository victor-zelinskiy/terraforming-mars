/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ACTION COMMIT'S RAIL HALF — «a gain is a reward» for a CARD ACTION
 * (PL-001 for actions; TR28 Earth Army Contract; docs/claude/console/
 * workspace-band.md § ACTION COMMIT).
 *
 * The commit's own wave (`ActionCommitPlan.specs`) is held by the shell
 * WITHOUT a check against the views — fine for a resource the response
 * certainly paid, wrong for a TERRAFORM RATING: an unverified hold of the
 * rating is a phantom «−1» the day the response does not pay it. So what the
 * branch pays on the rail's rating — and the moves on the card's own capsule
 * when the printed row is a TIMELINE — is held through the ONE module that
 * checks a promise against the diff of the two views (`railReward.ts`, its
 * second owner after the fleet dock):
 *
 *   ARM    — the composer builds the rail half at the press
 *            (`consoleActionCommit.commitRailPlan`, origins measured then);
 *   SEED   — the transport's apply block (`gameTransport.seedRewardHolds`),
 *            the SAME synchronous block as the view: `seedRailReward` keeps
 *            the pre-reward rows (the rating, the VP cell derived from it, the
 *            table's answer, the capsule) when the views agree with the
 *            promise — and names the mismatch when they do not;
 *   FLY    — the shell's handoff (`flyActionCommitRail`): the links in the
 *            printed order, link k + 1 on link k's touchdown, each counter
 *            ticking on its own touchdown (a loss on its departure), the TR's
 *            ring when its token is born, the table's answer one beat after
 *            the last touchdown;
 *   FOLD   — the workspace may fold once the card is no longer a TARGET or a
 *            SOURCE of a token (`foldable`): at once for a plain TR (the token
 *            is born over the standing icon and the surface folds under it),
 *            at the birth of the last link for a timeline.
 *
 * Every hold is bounded and names itself: a seeded half nobody flies is
 * released by the commit's release (`onActionCommitRelease`) or, at the
 * latest, by its own short net on the animation clock; the chain holds the
 * foreground under its own name with its own ceiling; reduced motion seeds
 * nothing (`seedRailReward` refuses), so the counters tick with the commit.
 */
import {reactive, toRaw} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {ActionCommitPlan, ActionCommitRail, actionCommitState, onActionCommitRelease} from '@/client/console/consoleActionCommit';
import {pulseCommitRing} from '@/client/console/consoleActionCommitMotion';
import {ResourceTransferSpec, TRANSFER_POP_MS, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {flyRailReward, flyRailRewardLink, releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';

export type ActionCommitRailPhase = 'idle' | 'seeded' | 'flying';

export const actionCommitRailState = reactive({
  /** The card whose rail half is held ('' when none). */
  card: '' as CardName | '',
  phase: 'idle' as ActionCommitRailPhase,
  /** The link in the air (−1 between links / when none) — the e2e probe's reading of the order. */
  link: -1,
  /** The half holds this card's CAPSULE (a timeline): the composer's hero reads the held capsule. */
  capsule: false,
  /** Why the last half ended early ('' after a full flight) — diagnostics. */
  lastEnd: '',
});

/** The armed plan the half was seeded from — a plan is seeded ONCE (a later frame re-seeding would release the rows early). */
let seededPlan: ActionCommitPlan | undefined;
let seededRail: ActionCommitRail | undefined;
/** The net under a seeded half the owner never flies. */
let owedFly: gsap.core.Tween | undefined;

/**
 * The longest a seeded half waits for its flight: the shell flies it when the
 * commit beat has settled (its own backstop is 1.4 s after the PRESS, which is
 * before the answer), so anything past this is a dismissal that never came.
 */
const OWED_FLY_MS = 3000;
/** The chain's own ceiling: three short flights and a beat — anything past this is a wedge. */
const CHAIN_MAX_MS = 9000;

function clearOwedFly(): void {
  owedFly?.kill();
  owedFly = undefined;
}

function resetHalf(why: string): void {
  clearOwedFly();
  actionCommitRailState.card = '';
  actionCommitRailState.phase = 'idle';
  actionCommitRailState.link = -1;
  actionCommitRailState.capsule = false;
  actionCommitRailState.lastEnd = why;
  seededRail = undefined;
}

/** End the half early: every row it still holds ticks now (honestly late, never lost). */
function endHalf(why: string): void {
  const rail = seededRail;
  resetHalf(why);
  if (rail !== undefined) {
    releaseRailReward(rail.key, why);
  }
}

/**
 * SEED — from the transport's apply block, beside every other reward hold.
 * Only the ARMED plan's rail half, once: the response that pays it is the
 * first view applied after the press.
 */
export function seedActionCommitRail(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  // RAW objects: the armed plan lives in a reactive store, and a proxy is never the object it wraps — the held
  // specs are matched by identity later (the link's tokens against the entry's cause).
  const plan = toRaw(actionCommitState.plan);
  const rail = plan === undefined ? undefined : toRaw(plan.rail);
  if (plan === undefined || rail === undefined || plan === seededPlan) {
    return;
  }
  seededPlan = plan;
  if (actionCommitRailState.phase !== 'idle') {
    endHalf('superseded');
  }
  if (!seedRailReward(rail.key, rail.reward, before, after)) {
    return;
  }
  seededRail = rail;
  actionCommitRailState.card = plan.sourceCard;
  actionCommitRailState.phase = 'seeded';
  actionCommitRailState.link = -1;
  actionCommitRailState.capsule = rail.holdsSurface;
  actionCommitRailState.lastEnd = '';
  owedFly = gsap.delayedCall(motionMs(OWED_FLY_MS) / 1000, () => {
    owedFly = undefined;
    if (actionCommitRailState.phase === 'seeded') {
      endHalf('not flown');
    }
  });
}

/** The half holds this card's capsule right now (the composer's hero reads `heldCardCapsule` only then). */
export function actionCommitRailHoldsCapsule(card: CardName | string): boolean {
  return actionCommitRailState.capsule && actionCommitRailState.phase !== 'idle' && actionCommitRailState.card === card;
}

/** The capsule of the card standing in the action composer — where a link onto (or off) the card lands. */
function capsulePoint(card: CardName): TransferPoint | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card.replace(/"/g, '\\"');
  const el = document.querySelector<HTMLElement>(`.con-composer__actcardwrap[data-zoom-slot="${esc}"] .pcard__res`);
  const r = el?.getBoundingClientRect();
  return r !== undefined && r.width > 2 ? {x: r.left + r.width / 2, y: r.top + r.height / 2} : undefined;
}

export type ActionCommitRailFlight = {
  /** The workspace may fold now — the card is no longer a target or a source of a token. */
  foldable: Promise<void>;
  /** Every row of the half has ticked (the table's answer included). */
  done: Promise<void>;
};

/**
 * FLY — the shell's handoff. A plan whose half was not seeded (reduced motion,
 * a mismatch, no rail half at all) flies nothing and may fold at once.
 */
export function flyActionCommitRail(armed: ActionCommitPlan | undefined): ActionCommitRailFlight {
  const plan = armed === undefined ? undefined : toRaw(armed);
  const rail = plan === undefined ? undefined : toRaw(plan.rail);
  if (plan === undefined || rail === undefined || seededRail !== rail || actionCommitRailState.phase !== 'seeded') {
    return {foldable: Promise.resolve(), done: Promise.resolve()};
  }
  clearOwedFly();
  actionCommitRailState.phase = 'flying';
  const card = plan.sourceCard;
  const originOf = (spec: ResourceTransferSpec): TransferPoint | undefined => {
    // The rail module keeps its entries in a reactive store: the spec it hands back may be a PROXY of ours.
    const at = rail.reward.cause.indexOf(toRaw(spec));
    return at >= 0 ? (rail.origins[at] ?? plan.sourcePoint) : plan.sourcePoint;
  };
  let markFoldable: () => void = () => {};
  const foldable = new Promise<void>((resolve) => {
    markFoldable = resolve;
  });
  const last = rail.links.length - 1;
  const run = async (): Promise<void> => {
    for (let k = 0; k <= last; k++) {
      if (actionCommitRailState.phase !== 'flying' || seededRail !== rail) {
        break; // ended from outside (the ceiling, a reset) — whatever was held has ticked
      }
      actionCommitRailState.link = k;
      if (k === last) {
        // The last link is born now: a timeline's TR gets its ring; the surface folds UNDER the token once it has
        // popped out of its printed icon (one pop of the transfer language, on the animation clock) — the token is
        // born over a card that is still there, and the card dissolves under it in flight.
        if (rail.links.length > 1) {
          pulseCommitRing(rail.ring);
        }
        const flight = flyRailReward(rail.key, originOf);
        gsap.delayedCall(motionMs(TRANSFER_POP_MS) / 1000, markFoldable);
        await flight;
      } else {
        const specs = rail.links[k].map((i) => rail.reward.cause[i]);
        const onCard = specs.every((spec) => spec.channel === 'card-resource' && spec.targetCard === card);
        await flyRailRewardLink(rail.key, specs, originOf, onCard ? {destination: capsulePoint(card)} : {});
        actionCommitRailState.link = -1;
      }
    }
  };
  const done = run().finally(() => {
    markFoldable();
    if (seededRail === rail) {
      resetHalf('');
    }
  });
  if (!rail.holdsSurface) {
    markFoldable();
  }
  return {foldable, done};
}

// A commit released WITHOUT its handoff (the workspace hosts the result, a rejected submit, a reset) owes no
// flight: a half still waiting for one ticks now. A half in the air keeps flying — its own chain releases it.
onActionCommitRelease((why) => {
  if (actionCommitRailState.phase === 'seeded') {
    endHalf(why);
  }
  if (why === 'reset') {
    seededPlan = undefined;
  }
});

// The chain holds the foreground under its OWN name and ceiling: the next prompt, the feed and the bot's turn
// wait for the phrase (the rail's own hold covers the rows; this one covers the beats between them).
registerAnimationHoldSupplier('action-commit-rail', () => actionCommitRailState.phase === 'flying', {
  maxHoldMs: CHAIN_MAX_MS,
  diagnose: () => ({card: actionCommitRailState.card, link: actionCommitRailState.link, capsule: actionCommitRailState.capsule}),
  expire: () => endHalf('ceiling'),
});

/** Test-only reset. */
export function resetActionCommitRail(): void {
  endHalf('reset');
  seededPlan = undefined;
  actionCommitRailState.lastEnd = '';
}
