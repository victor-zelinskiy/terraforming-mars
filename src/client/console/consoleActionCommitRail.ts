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
 *   FOLD   — the workspace may fold once it is neither the SOURCE nor the
 *            DESTINATION of a token in the air (`foldable` = the chain's last
 *            tokens STARTED, then `surfaceClear` of the surface — the law of
 *            the fold, T09 / BY): a result born on the card holds it to its
 *            pop, a landing ON the surface (a mech onto the card the player
 *            chose in the composer's target row — TR29) and a PRICE drawn into
 *            the printed cost icon hold it to their ABSORB — told by the
 *            tokens, never by a beat of the clock beside them;
 *   ANSWER — the table's answer FLIES from the composer's «Сработает» chip that
 *            promised it (PL-220 — the owner's decision 2026-10-12): born there
 *            one beat after the last touchdown, its row ticking on its own
 *            touchdown, and the workspace stands until the token has LEFT the
 *            chip — the chip is the answer's cause on screen. With no such chip
 *            standing at the flight's start the answer ticks a beat after the
 *            cause, as before, and the fold keeps its old moment.
 *
 * A SPEND (`ActionCommitRail.spendLinks` — PL-064 in general, TR29) is a link
 * of its own, flown FROM its real source: the capsule of the card it leaves
 * as the player sees it — the hero's, or the miniature of the chosen card in
 * the composer's source row (`data-composer-card`) — never a synthetic point;
 * a source with no measurable face falls back to the ДОП. РЕСУРСЫ satellite
 * and says so (`actionCommitRailState.fallback`). The counter of that card
 * (and its derived points) tick on the DEPARTURE; the token is absorbed at the
 * selected variant's printed result icon, and the result is born there, on the
 * spend's touchdown — never before it.
 *
 * Every hold is bounded and names itself: a seeded half nobody flies is
 * released by the commit's release (`onActionCommitRelease`) or, at the
 * latest, by the hold registry's ceiling of its own named hold
 * (`action-commit-rail-owed` — never a timer on the animation clock, which
 * stands still with the compositor); the chain holds the foreground under its
 * own name with its own ceiling; reduced motion seeds nothing
 * (`seedRailReward` refuses), so the counters tick with the commit. Every way a
 * half begins and ends is written into the flights' trail (`rail:seed` by the
 * rail module, `rail:end {why}` here).
 */
import {reactive, shallowRef, toRaw} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {ActionCommitPlan, ActionCommitRail, actionCommitState, onActionCommitRelease} from '@/client/console/consoleActionCommit';
import {centreEndOf, pulseCommitRing} from '@/client/console/consoleActionCommitMotion';
import {ResourceTransferSpec, TransferEnd, TransferEndLike} from '@/client/console/resourceTransfer/resourceTransferModel';
import {RailAnswerFlight, flyRailReward, flyRailRewardLink, railRewardHoldsAnswer, railRewardOwed, railRewardPending, releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {cardReactionAnswerFlight, composeAnswerFlights, markReactionCause, reactionDeclarationBlock} from '@/client/console/cardReaction/cardReactionDirector';
import {noteTransferTrail, surfaceClear, surfaceHoldsTokens} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {firstVisibleEnd} from '@/client/console/resourceTransfer/transferEndVisible';
import {railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {RECEIVE_READ_MS, runCardReceive} from '@/client/console/cardReceive/cardReceiveDirector';
import {claimVpShares, dropVpClaim, releaseVpShares} from '@/client/console/scoreCell/vpShareLedger';

/** The score cell's ledger owner of an action's chain (TR55): the cards its links feed score on their touchdowns. */
export const ACTION_COMMIT_VP_OWNER = 'action-commit';

export type ActionCommitRailPhase = 'idle' | 'seeded' | 'flying';

export const actionCommitRailState = reactive({
  /** The card whose rail half is held ('' when none). */
  /** The commit's source KEY — a card's name, or a political source's key (`ActionCommitSource`). */
  card: '' as string,
  phase: 'idle' as ActionCommitRailPhase,
  /** The link in the air (−1 between links / when none) — the e2e probe's reading of the order. */
  link: -1,
  /** The half holds this card's CAPSULE (a timeline): the composer's hero reads the held capsule. */
  capsule: false,
  /** The cards whose capsule the half holds — the hero and the composer rows' miniatures read `heldCardCapsule` then. */
  capsules: [] as Array<string>,
  /** A spend that could not be born on its card's own face and fell back to the satellite — named. */
  fallback: '',
  /** Why the last half ended early ('' after a full flight) — diagnostics. */
  lastEnd: '',
  /** Halves ended since load — EVERY way out (a full flight, «not flown», superseded): what a stage waiting on the half watches. */
  ended: 0,
});

/**
 * THE ARMED PLAN'S LAST LINK LANDS ON A COMPOSER ROW's card (TR53 iteration — a unit onto the card the player CHOSE in
 * the composer's own step): that row must STAND for the landing, so a stage that would replace the decision column
 * (a draw the choice decided — the pending reveal zone) waits for the half to end (`ended`). Read at the confirm:
 * the composer arms the plan before it emits.
 */
export function armedRailLandsOnRow(): boolean {
  const plan = toRaw(actionCommitState.plan);
  const rail = plan === undefined ? undefined : toRaw(plan.rail);
  if (plan === undefined || rail === undefined || rail.links.length === 0) {
    return false;
  }
  const last = rail.links[rail.links.length - 1];
  return last.some((i) => {
    const spec = rail.reward.cause[i];
    return spec !== undefined && spec.channel === 'card-resource' && spec.direction !== 'loss' &&
      spec.targetCard !== undefined && spec.targetCard !== plan.sourceCard;
  });
}

/** The armed plan the half was seeded from — a plan is seeded ONCE (a later frame re-seeding would release the rows early). */
let seededPlan: ActionCommitPlan | undefined;
/**
 * The seeded half's rail — a SHALLOW REF, never a plain `let`: the `action-commit-rail-owed` hold supplier reads it, and
 * a half ended while the phase stood still must reach every cache (`reactivityWitness.ts`). Shallow: the rail stays
 * raw (identity compares against `toRaw(plan.rail)`).
 */
const seededRailRef = shallowRef<ActionCommitRail | undefined>(undefined);
/** An armed plan a view has been applied for that had paid NOTHING of it yet — still waiting for the view that pays it. */
let owedPlan: ActionCommitPlan | undefined;
/** The apply block the seeded half's answer was declared in (`reactionDeclarationBlock`) — its reactor flight asks for that block only. */
let seededReactionBlock: number | undefined;

/**
 * The longest a seeded half waits for its flight — the CEILING of its own named hold (`action-commit-rail-owed`), on
 * the hold registry's wall clock, never a delayed call on the animation clock (T09, decision 6: GSAP's clock stands
 * still with the compositor, and a net on it either never fires or fires before a slow dismissal). The shell flies the
 * half when the commit beat has settled — its own backstop is 1.4 s after the PRESS, on the wall clock — so anything
 * past this is a dismissal that never came.
 */
const OWED_FLY_MS = 6000;
/** The chain's own ceiling: three short flights and a beat — anything past this is a wedge. */
const CHAIN_MAX_MS = 9000;

function resetHalf(why: string): void {
  if (actionCommitRailState.phase !== 'idle' || why !== '') {
    noteTransferTrail('rail:end', {card: actionCommitRailState.card, phase: actionCommitRailState.phase, link: actionCommitRailState.link, why: why === '' ? 'flown' : why});
  }
  // The score cell's shares of the cards this chain fed tick on their tokens' touchdowns; whatever is left ends here, named.
  releaseVpShares(ACTION_COMMIT_VP_OWNER, {why});
  dropVpClaim(ACTION_COMMIT_VP_OWNER);
  actionCommitRailState.ended++;
  actionCommitRailState.card = '';
  actionCommitRailState.phase = 'idle';
  actionCommitRailState.link = -1;
  actionCommitRailState.capsule = false;
  actionCommitRailState.capsules = [];
  actionCommitRailState.lastEnd = why;
  seededRailRef.value = undefined;
}

/** End the half early: every row it still holds ticks now (honestly late, never lost). */
function endHalf(why: string): void {
  const rail = seededRailRef.value;
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
  // A view that has paid NOTHING of the promise yet (a poll / WS frame applied before the answer — the same state the
  // press was made in) is not the response that pays it: the plan stays armed for the view that does (T09 — H5: the
  // first view applied after the press is not always the submit's own; `App.update` seeds through here too).
  if (railRewardOwed(rail.reward, before, after)) {
    owedPlan = plan;
    noteTransferTrail('rail:seed', {key: rail.key, verdict: 'owed — waiting for the paying view'});
    return;
  }
  owedPlan = undefined;
  seededPlan = plan;
  if (actionCommitRailState.phase !== 'idle') {
    endHalf('superseded');
  }
  if (!seedRailReward(rail.key, rail.reward, before, after)) {
    // The half never began (the views did not bear the promise out): it is OVER all the same — a stage waiting on
    // the half (`ended`) must not wait for a flight that will never come.
    actionCommitRailState.ended++;
    return;
  }
  seededRailRef.value = rail;
  // ONE ANSWER (P82 · H1): the reactors this commit's answer raises are THIS block's.
  seededReactionBlock = reactionDeclarationBlock();
  // THE SCORE CELL (TR55, К-V2): a card a link LANDS a resource on scores with that touchdown — its share (the server's
  // attribution, whatever the preview printed — Security Fleet's fighter has no `vpBox`) is held by the ledger, seeded
  // last in this very block, and released by the contact beat of the first token onto that card.
  const fed = new Set(rail.reward.cause.flatMap((spec) =>
    spec.channel === 'card-resource' && spec.direction !== 'loss' && spec.targetCard !== undefined ? [spec.targetCard as string] : []));
  if (fed.size > 0) {
    claimVpShares(ACTION_COMMIT_VP_OWNER, (share) => share.source.kind === 'card' && fed.has(share.source.card), 5, {releaseOnLanding: true});
  }
  actionCommitRailState.card = plan.sourceCard;
  actionCommitRailState.phase = 'seeded';
  actionCommitRailState.link = -1;
  actionCommitRailState.capsules = [...(rail.capsules ?? (rail.holdsSurface ? [plan.sourceCard] : []))];
  actionCommitRailState.capsule = actionCommitRailState.capsules.length > 0;
  actionCommitRailState.fallback = '';
  actionCommitRailState.lastEnd = '';
}

/** The half holds this card's capsule right now (the composer's hero and its rows' miniatures read `heldCardCapsule` only then). */
export function actionCommitRailHoldsCapsule(card: CardName | string): boolean {
  return actionCommitRailState.phase !== 'idle' && actionCommitRailState.capsules.includes(card as CardName);
}

/**
 * The capsule of the card standing in the action composer — where a link onto (or off) the card lands. An OBJECT end
 * (T06): re-measured on the token's final approach — the capsule of a composer that moved or folded is never a landing.
 */
function capsuleEnd(card: CardName): TransferEnd | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card.replace(/"/g, '\\"');
  const el = document.querySelector<HTMLElement>(`.con-composer__actcardwrap[data-zoom-slot="${esc}"] .pcard__res`);
  return centreEndOf(el);
}

/**
 * A card standing in a row of the action workspace's composer (`.con-composer` — a card's action, a party's, a law's:
 * the Scientists' party action and Manufacturing Run's law put a resource on the card the player chose in their
 * «КАРТА-ЦЕЛЬ» row — PL-427, the class the TR53 director closes for every composer).
 */
function composerCardSelector(esc: string): string {
  return `.con-cardactions .con-composer [data-composer-card="${esc}"]`;
}

/** A card standing in one of the composer's rows (a spend's chosen SOURCE, a reward's chosen TARGET) — its own capsule, else its face — as an OBJECT end. */
function composerCardEnd(card: CardName): TransferEnd | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card.replace(/"/g, '\\"');
  const face = document.querySelector<HTMLElement>(composerCardSelector(esc));
  return centreEndOf(face?.querySelector<HTMLElement>('.pcard__res')) ?? centreEndOf(face);
}

/**
 * THE MINIATURE RECEIVES (TR53 iteration — the action composer's half of «ПРИЁМ РЕСУРСА КАРТОЙ», case 2): the card the
 * player chose in a composer row is PRESENTED while its token flies — lifted a hair and ringed (an ATTRIBUTE, never a
 * class: the row's reactive `:class` rewrites `className` whole on any re-render) — and SETTLES back after the read.
 * The rail module's own beat, the director's order; the hero's own capsule needs no lift (it IS the hero).
 */
function presentComposerCard(card: CardName, on: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card.replace(/"/g, '\\"');
  const el = document.querySelector<HTMLElement>(composerCardSelector(esc));
  if (el === null) {
    return;
  }
  if (on) {
    el.setAttribute('data-receiving', '1');
  } else {
    el.removeAttribute('data-receiving');
  }
}


/**
 * WHERE THE TABLE'S ANSWER WAS PROMISED (PL-220): the composer's own «Сработает» chip for that rail row — the row's
 * (`data-forecast-rail` on `ConsoleForecastRow`) or a variant card's note (`ConsoleForecastReactions`) — as
 * PAINTED (`firstVisibleEnd`: a covered, faded or unmounted chip is no birth place); else the row's own bolt, the
 * answer folded into «+N»; else nothing — the answer ticks.
 */
function answerChipPoint(spec: ResourceTransferSpec): TransferEnd | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const row = railRowKey(spec);
  const scope = '.con-cardactions .con-composer';
  return centreEndOf(firstVisibleEnd(`${scope} [data-forecast-rail="${row}"]`)) ??
    centreEndOf(firstVisibleEnd(`${scope} [data-forecast-row] .con-forecast__bolt`));
}

/** Some chip of the composer can carry an answer right now — the flight then lets the surface go only after it. */
function answerChipStands(): boolean {
  return typeof document !== 'undefined' &&
    firstVisibleEnd('.con-cardactions .con-composer [data-forecast-rail], .con-cardactions .con-composer [data-forecast-row] .con-forecast__bolt') !== undefined;
}

export type ActionCommitRailFlight = {
  /**
   * The chain keeps the workspace standing BETWEEN its links — a timeline, a spend before its result, a landing on the
   * surface, an answer that will fly from the composer's chip (PL-220): the shell then waits for `foldable` before it
   * even asks the surface. Otherwise the chain's tokens are all STARTED by the time this returns, and the shell's own
   * `surfaceClear` of the surface waits for them.
   */
  holdsSurface: boolean;
  /**
   * The workspace may fold now: the chain's last tokens have STARTED and the surface is CLEAR of them — no token still
   * to be born on it, none still to be absorbed on it (`surfaceClear`, the law of the fold — T09 / BY).
   */
  foldable: Promise<void>;
  /** Every row of the half has ticked (the table's answer included). */
  done: Promise<void>;
};

/** The surface the action commit's tokens are born on and land on: the action workspace's band (the composer, its hero, its rows). */
function commitSurface(): Element | null {
  return typeof document === 'undefined' ? null : document.querySelector('.con-cardactions');
}

/**
 * FLY — the shell's handoff. A plan whose half was not seeded (reduced motion,
 * a mismatch, no rail half at all) flies nothing and may fold at once.
 * `surface` — the surface the shell folds (its motion surface); the action workspace's band by default.
 */
export function flyActionCommitRail(armed: ActionCommitPlan | undefined, surface?: Element | null): ActionCommitRailFlight {
  const plan = armed === undefined ? undefined : toRaw(armed);
  const rail = plan === undefined ? undefined : toRaw(plan.rail);
  if (plan === undefined || rail === undefined || seededRailRef.value !== rail || actionCommitRailState.phase !== 'seeded') {
    return {holdsSurface: false, foldable: Promise.resolve(), done: Promise.resolve()};
  }
  actionCommitRailState.phase = 'flying';
  const card = plan.sourceCard;
  const surfaceEl = (): Element | null => (surface !== undefined && surface !== null && surface.isConnected ? surface : commitSurface());
  // The card-level fallback: the hero's spawn band as an OBJECT (T06 — re-measured at the birth), else its point.
  const fallback: TransferEndLike | undefined = plan.source ?? plan.sourcePoint;
  const originOf = (spec: ResourceTransferSpec): TransferEndLike | undefined => {
    // The rail module keeps its entries in a reactive store: the spec it hands back may be a PROXY of ours.
    const at = rail.reward.cause.indexOf(toRaw(spec));
    return at >= 0 ? (rail.origins[at] ?? fallback) : fallback;
  };
  let markFoldable: () => void = () => {};
  const foldable = new Promise<void>((resolve) => {
    markFoldable = resolve;
  });
  let foldAsked = false;
  /**
   * THE LAW OF THE FOLD (T09 / BY), the one door of `foldable`: asked once the chain's last tokens that may touch the
   * surface have STARTED (a run registers its tokens in the call) — then the engine, which knows both ends of every token
   * as objects, says when the surface is neither the source nor the destination of one of them. No pop on the clock, no
   * contact beat on the clock: the absorb IS the token's own end.
   */
  const foldWhenClear = (): void => {
    if (foldAsked) {
      return;
    }
    foldAsked = true;
    const el = surfaceEl();
    if (surfaceHoldsTokens(el)) {
      void surfaceClear(el).then(() => markFoldable());
    } else {
      markFoldable(); // nothing of the chain stands on the surface — at once, in this very call
    }
  };
  const last = rail.links.length - 1;
  const spends = new Set(rail.spendLinks ?? []);
  // THE ANSWER FLIES when the composer still shows where it was promised (PL-220): the surface then stands until the
  // answer has left its chip, and every «fold now» below defers to that moment. Decided ONCE, at the flight's start —
  // with no chip standing nothing changes (the answer ticks, the fold keeps its old moment).
  const chipStands = answerChipStands();
  // «СРАБАТЫВАНИЕ КАРТЫ» (the owner's decision 2): a reaction the server RECORDED is born on the REACTOR (risen at a
  // seat beside the rail); the chip that promised it is MARKED. A reaction with no record keeps PL-220's chip birth.
  const reaction = railRewardHoldsAnswer(rail.key) ? cardReactionAnswerFlight({block: seededReactionBlock}) : undefined;
  const answerFlies = railRewardHoldsAnswer(rail.key) && (chipStands || reaction !== undefined);
  const chipFlight: RailAnswerFlight | undefined = chipStands ? {originOf: answerChipPoint, onLeft: foldWhenClear} : undefined;
  const reactorFlight: RailAnswerFlight | undefined = reaction === undefined ? undefined : {
    ...reaction,
    originOf: (spec) => {
      const origin = reaction.originOf(spec);
      if (origin !== undefined && chipStands) {
        markReactionCause(answerChipPoint(spec)?.el);
      }
      return origin;
    },
    onLeft: foldWhenClear,
  };
  const answer: RailAnswerFlight | undefined = answerFlies ? composeAnswerFlights(reactorFlight, chipFlight) : undefined;
  const foldUnlessAnswering = (): void => {
    if (!answerFlies) {
      foldWhenClear();
    }
  };
  /**
   * WHERE A LINK'S TOKEN MEETS THE CARD it moves on: the card's own face as the player sees it — the hero's
   * capsule, a composer row's miniature — or the transfer ladder (a rail row; the satellite for a card nobody
   * stands on screen). A SPEND that cannot be born on its source's face names the fallback.
   */
  const pointOf = (spec: ResourceTransferSpec, index: number): TransferEnd | undefined => {
    if (spec.channel !== 'card-resource' || spec.targetCard === undefined) {
      return undefined;
    }
    const point = spec.targetCard === card ? capsuleEnd(card) : composerCardEnd(spec.targetCard);
    if (point === undefined && spends.has(index)) {
      actionCommitRailState.fallback = `satellite:${spec.targetCard}`;
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[action-commit-rail] ${card}: the spend leaves ${spec.targetCard}, whose face is not on screen — born on the satellite`);
      }
    }
    return point;
  };
  const run = async (): Promise<void> => {
    for (let k = 0; k <= last; k++) {
      if (actionCommitRailState.phase !== 'flying' || seededRailRef.value !== rail) {
        break; // ended from outside (the ceiling, a reset) — whatever was held has ticked
      }
      actionCommitRailState.link = k;
      const indices = rail.links[k];
      const specs = indices.map((i) => rail.reward.cause[i]);
      const points = indices.map((i, n) => pointOf(specs[n], i));
      if (k === last) {
        // The last link is born now: a later link gets its ring (a timeline's TR, a spend's result — born where the
        // spend was absorbed). Whatever it is, the surface is let go only by `foldWhenClear` — the tokens say when.
        if (rail.links.length > 1) {
          pulseCommitRing(rail.ring);
        }
        const landing = specs.findIndex((spec, n) => points[n] !== undefined && spec.direction !== 'loss');
        if (landing >= 0) {
          const onSurface = specs.filter((spec, n) => points[n] !== undefined && spec.direction !== 'loss');
          // The result lands on the surface and is absorbed QUICKLY (PL-138 — the owner's decision 2026-10-10): the
          // capsule ticks on the touchdown, the token sinks into it in the quick absorb with no settle on the box, and
          // the surface is let go once that absorb is over — the link's own `onAbsorbed`, never a beat of the clock
          // beside it (BY). EACH token lands on ITS card (TR44's action: the animal into the hero's capsule, the data
          // onto the Census's miniature — one link, two touchdowns; one destination for all sent the data into the
          // hero's capsule).
          const landingOf = (spec: ResourceTransferSpec): TransferEndLike | undefined => points[specs.indexOf(spec)] ?? points[landing];
          const land = (): Promise<void> => new Promise<void>((resolve) => {
            void flyRailRewardLink(rail.key, onSurface, originOf, {destination: points[landing], destinationOf: landingOf, absorb: 'quick', onAbsorbed: resolve});
          });
          // A card the player CHOSE in a composer row receives in the ONE grammar (TR53 iteration, case 2 — the parity
          // with the «Разыграно» stage): PRESENT (the miniature lifts as the token is born — never a wait before it),
          // PAY (the link), READ (a short beat over «1 → 2»), RETURN (the miniature settles). The hero's own capsule
          // keeps the plain link.
          const rowCard = onSurface.find((spec) => spec.targetCard !== undefined && spec.targetCard !== card)?.targetCard;
          if (rowCard === undefined) {
            await land();
          } else {
            await runCardReceive({
              host: 'composer',
              card: rowCard,
              readMs: RECEIVE_READ_MS.composer,
              alive: () => actionCommitRailState.phase === 'flying',
              present: () => {
                presentComposerCard(rowCard, true);
                return Promise.resolve(true);
              },
              pay: async () => {
                await land();
                return true;
              },
              // RETURN: the miniature settles back (its CSS transition) WHILE the flow goes on — the workspace's own
              // fold (or the draw's door) carries it; the A/B budget of the parity is the READ alone (≤ +0.3 s).
              ret: () => {
                presentComposerCard(rowCard, false);
                return Promise.resolve();
              },
              release: () => presentComposerCard(rowCard, false),
            });
          }
          foldUnlessAnswering();
          await flyRailReward(rail.key, originOf, answer);
        } else if (specs.every((spec) => spec.direction === 'loss')) {
          // THE PRICE IS THE LAST LINK (PL-099 — TR41's 8 heat into the printed heat before a scale step, a tile's price
          // before the board, a spend off the capsule with no rail result): a loss is ABSORBED at the hero's own printed
          // icon, so the surface it stands on stays to the token's absorb — the engine knows the icon as the token's
          // DESTINATION (BY): asked at the token's departure, `surfaceClear` waits for exactly that absorb. A CARD's own
          // resource leaving (a draw's spend — PL-201) departs from its card's face as the player sees it, drawn into the
          // printed result QUICKLY, exactly as a spend before a result does; a rail price keeps its row.
          const departure = points.find((p) => p !== undefined);
          await flyRailRewardLink(rail.key, specs, originOf, {
            ...(departure !== undefined ? {destination: departure, absorb: 'quick' as const} : {}),
            onLeft: foldUnlessAnswering,
          });
          await flyRailReward(rail.key, originOf, answer);
        } else {
          // The surface is let go once EVERY token of the last link has left its printed icon (the run's own `onLeft`)
          // and nothing else stands on it (`surfaceClear`).
          await flyRailReward(rail.key, originOf, answer, foldUnlessAnswering);
        }
      } else {
        const destination = points.find((p) => p !== undefined);
        // A SPEND drawn into the printed result it buys is absorbed QUICKLY (PL-140): no settle on the box, one short
        // beat, the result born out of it — a token standing on the result for half a second read as a pause.
        await flyRailRewardLink(rail.key, specs, originOf, destination !== undefined ? {destination, absorb: 'quick'} : {});
        actionCommitRailState.link = -1;
      }
    }
  };
  const done = run().finally(() => {
    // Every way the chain ends asks the surface too: what it started may still be absorbing on it.
    foldWhenClear();
    if (seededRailRef.value === rail) {
      resetHalf('');
    }
  });
  if (!rail.holdsSurface && !answerFlies) {
    // A single link with nothing between its parts (a plain TR, a result off the card): its tokens STARTED in the call
    // above — the run registered them — so the surface's own answer is already the honest one.
    foldWhenClear();
  }
  return {holdsSurface: rail.holdsSurface || answerFlies, foldable, done};
}

/**
 * A STAGED ACTION VOTE'S PRICE OFF THE RAIL (T07 Martian Media Center — «pay 3 M€ → add a delegate»). The vote mode's
 * A commits the action, but its answer never reaches the shell's handoff (`flyActionCommitRail` above is the shell's):
 * so the Parliament's landing flies the armed commit's SEEDED half itself — the price token off the row's digits,
 * sideways into the printed cost icon, the row ticking on the departure (PL-104) — and resolves once the token has been
 * ABSORBED (the surface is clear of it), the moment the cube may lift off the reserve: price, then cube (TR15 §6).
 * `undefined` when no half is seeded (reduced motion, views that did not bear the promise out, a plain vote) — the
 * cube flies at once and the row ticks with the release.
 */
export function flyStagedVotePrice(): Promise<void> | undefined {
  const plan = actionCommitState.plan;
  if (plan === undefined || plan.rail === undefined || actionCommitRailState.phase !== 'seeded' || seededRailRef.value !== toRaw(plan.rail)) {
    return undefined;
  }
  return flyActionCommitRail(plan, commitSurface()).foldable;
}

// A commit released WITHOUT its handoff (the workspace hosts the result, a rejected submit, a reset) owes no
// flight: a half still waiting for one ticks now. A half in the air keeps flying — its own chain releases it.
onActionCommitRelease((why) => {
  if (actionCommitRailState.phase === 'seeded') {
    endHalf(why);
  } else if (owedPlan !== undefined && owedPlan !== seededPlan) {
    // A half whose paying view never came is OVER all the same — a stage waiting on the half (`ended` — every way out,
    // PL-430) must not wait for a flight that will never be seeded.
    owedPlan = undefined;
    actionCommitRailState.ended++;
    noteTransferTrail('rail:end', {why: `never seeded — ${why}`});
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

// A SEEDED half waits for the shell's handoff under its own name: the feed waits with it (notification-only — the
// next prompt is the commit's own business), and the registry's ceiling on the WALL clock is its net (T09, decision 6 —
// the old net was a delayed call on the animation clock). Past it the dismissal never came: the rows tick, named. It
// stands only while the half's rows are really HELD — a half whose rows were released elsewhere holds nothing.
registerAnimationHoldSupplier('action-commit-rail-owed', () => actionCommitRailState.phase === 'seeded' && seededRailRef.value !== undefined && railRewardPending(seededRailRef.value.key), {
  scope: 'notification-only',
  maxHoldMs: OWED_FLY_MS,
  diagnose: () => ({card: actionCommitRailState.card}),
  expire: () => endHalf('not flown'),
});

/** Test-only reset. */
export function resetActionCommitRail(): void {
  endHalf('reset');
  seededPlan = undefined;
  owedPlan = undefined;
  actionCommitRailState.lastEnd = '';
}
