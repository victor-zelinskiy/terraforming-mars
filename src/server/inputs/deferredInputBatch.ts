import type {IPlayer} from '../IPlayer';
import {InputResponse, isOrOptionsResponse} from '../../common/inputs/InputResponse';
import type {PlayerInput} from '../PlayerInput';
import {OrOptions} from './OrOptions';

/**
 * THE PRE-COLLECTED BATCH — replay, and the TAIL THAT HAS NOT LANDED YET.
 *
 * A play / action confirmed through the premium play modal or the console
 * composer arrives as an ORDERED array of responses (`PlayerInputBatch`): the
 * pick itself, then every choice the preview pre-collected. The server flow is
 * sequential (`player.process` answers one `waitingFor`, then the deferred queue
 * advances to the next), so the array is replayed in order.
 *
 * ⚠ THE ORDER IS NOT GUARANTEED TO BE THE PREVIEW'S. The card's own on-play
 * input is deferred at `Priority.DEFAULT`, while an effect the SAME play
 * triggers can queue AHEAD of it — Olympus Conference (`OLYMPUS_CONFERENCE`),
 * Pharmacy Union (`PHARMACY_UNION`) and Hyperspace Drive Prototype
 * (`HYPERSPACE_DRIVE_PROTOTYPE`) all jump the queue on a SCIENCE tag. The
 * pre-collected response then meets a prompt it was never meant for, and the
 * positional replay stops.
 *
 * Dropping the rest there is what made a PRE-SELECTED choice come back as a
 * live prompt: Astra Mechanica's "return up to 2 events" is chosen inside the
 * play composer, the play triggers Olympus Conference, and the already-made
 * choice was thrown away and asked again a moment later — the one thing a
 * pre-select must never do.
 *
 * So the unconsumed responses are PARKED instead of dropped, and drained
 * against the next prompt the player answers (`drainBatchTail`, called by the
 * single-input route). A parked response only ever lands on an input that
 * ACCEPTS it — `process` validates and restores its own `waitingFor` on
 * failure — and the park is bounded to the action it was collected for
 * (`Player.takeAction` clears it), so it can never leak into the next decision.
 * A tail that never finds its prompt simply expires, which degrades to exactly
 * the old behaviour: the leftover prompt is served to the client.
 *
 * The park is deliberately WEAK and NEVER serialized: it is a plan for the
 * prompt that is about to be asked, not game state. A reloaded game gets fresh
 * `Player` objects and no park.
 */

/**
 * Reconcile a PRE-COLLECTED batch response with the input ACTUALLY waiting.
 *
 * The action-preview batch is assembled from a preview whose branches model a
 * card's `action()` as an OrOptions (each branch is given a runtime OR index).
 * But a card's `action()` COLLAPSES a multi-branch OrOptions to a BARE input at
 * runtime when only ONE branch is live — e.g. Factorum returns the bare
 * "Spend 3 M€ to draw a building card" SelectOption (not an OrOptions) once the
 * player already has energy. The pre-collected `{type:'or', index, response}`
 * then can't process against the bare input: the batch stops and the bare input
 * surfaces as a REDUNDANT follow-up modal, right after the player confirmed.
 *
 * This reconciles the wrap/no-wrap ambiguity WITHOUT changing any game logic —
 * it only reshapes the pre-collected response to the live input:
 *  - an OR-wrapped response against a NON-OrOptions input → UNWRAP to the inner
 *    response (the server already picked the sole live option; the OR index is
 *    irrelevant, only the inner response matters);
 *  - a bare response against a SINGLE-option OrOptions → WRAP it (index 0).
 * Every OTHER mismatch is a genuine divergence and is left to fail, so the
 * batch's graceful fallback still surfaces the real leftover prompt.
 *
 * Affects BOTH platforms (desktop `submitCardActionBatch` + console composer
 * both post here). Pure + unit-tested (tests/routes/PlayerInputBatch.spec.ts).
 */
export function reconcileBatchResponse(response: InputResponse, input: PlayerInput): InputResponse {
  if (input.type !== 'or' && isOrOptionsResponse(response)) {
    return response.response;
  }
  if (input.type === 'or' && !isOrOptionsResponse(response) && (input as OrOptions).options.length === 1) {
    return {type: 'or', index: 0, response};
  }
  return response;
}

/**
 * The unconsumed pre-collected responses of the batch the player most recently
 * submitted, keyed weakly by the player instance (see the module comment: a
 * plan, never game state).
 */
const parkedTails = new WeakMap<IPlayer, ReadonlyArray<InputResponse>>();

/**
 * Replay a submitted batch, response by response, against whatever the player
 * is waiting for.
 *
 * GRACEFUL FALLBACK: each `player.process` validates server-side and restores
 * its `waitingFor` on failure. The FIRST response failing (the action pick
 * itself) is a real error and is rethrown. A LATER response that doesn't match
 * is either a genuine divergence (state drifted from the preview) or a prompt
 * that jumped the queue — either way the rest is PARKED for `drainBatchTail`
 * and the leftover prompt renders through the normal client routing.
 */
export function replayBatch(player: IPlayer, responses: ReadonlyArray<InputResponse>): void {
  for (let i = 0; i < responses.length; i++) {
    const waitingFor = player.getWaitingFor();
    if (waitingFor === undefined) {
      // The action already fully resolved server-side (e.g. an auto-selected
      // single branch with no further steps). Nothing left to answer.
      break;
    }
    // A HIDDEN-INFORMATION prompt (a deck pick — «look at the top N») asks
    // about cards that did not exist when the batch was assembled, so the
    // batch can never contain its answer BY CONSTRUCTION. Never even TRY the
    // next response against it: a same-shaped answer aimed at a LATER prompt
    // (a Delta Surge traversal's card pick behind the stage-5 draw) would
    // either be refused and read as a genuine divergence — wiping the tail —
    // or, worse, name a card the draw happens to contain and be CONSUMED by
    // the wrong question. Park the rest (i > 0; a batch that OPENS on a
    // hidden prompt is a real divergence and falls through to process).
    if (i > 0 && hiddenInfoPrompt(waitingFor)) {
      parkedTails.set(player, [...(parkedTails.get(player) ?? []), ...responses.slice(i)]);
      return;
    }
    // Reshape a pre-collected OR-wrapper to the live input shape when the
    // card's action() collapsed to a bare input (Factorum &c.), so the
    // confirmed step lands instead of popping a redundant modal.
    const response = reconcileBatchResponse(responses[i], waitingFor);
    try {
      player.process(response);
    } catch (e) {
      if (i === 0) {
        throw e; // the action pick itself failed — surface it.
      }
      if (jumpedTheQueue(response, waitingFor)) {
        // APPEND, never replace: an answer parked by an earlier submit in this
        // same action is still owed its own prompt, and the queue serves them
        // in the order they were given.
        parkedTails.set(player, [...(parkedTails.get(player) ?? []), ...responses.slice(i)]);
      }
      // A genuine divergence simply drops the rest of THIS batch — the live
      // prompt is the question being asked, and the player answers it for real.
      return;
    }
  }
  // Everything landed. An answer parked earlier in this action may be next.
  drainBatchTail(player);
}

/**
 * Try to land the parked tail on the prompt the player is waiting for now.
 * Called by the SINGLE-input route after a response is processed: the prompt
 * that jumped the queue has just been answered, so the pre-collected response
 * behind it is very likely next.
 *
 * Opportunistic and silent: a response that still doesn't fit stays parked (its
 * prompt has not been asked yet), and the player is never blocked by it.
 */
export function drainBatchTail(player: IPlayer): void {
  const tail = parkedTails.get(player);
  if (tail === undefined) {
    return;
  }
  const rest = [...tail];
  while (rest.length > 0) {
    const waitingFor = player.getWaitingFor();
    if (waitingFor === undefined) {
      break;
    }
    if (hiddenInfoPrompt(waitingFor)) {
      // The player must SEE the drawn cards to answer — a parked response is
      // never theirs (see replayBatch). It stays parked for its own prompt.
      break;
    }
    const response = reconcileBatchResponse(rest[0], waitingFor);
    try {
      player.process(response);
    } catch (e) {
      if (!jumpedTheQueue(response, waitingFor)) {
        // The prompt this answer was collected for IS the one being asked, and
        // it refused the answer: the state drifted since the preview. Stale —
        // drop the whole tail and let the player answer for real.
        rest.length = 0;
      }
      break;
    }
    rest.shift();
  }
  if (rest.length === 0) {
    parkedTails.delete(player);
  } else {
    parkedTails.set(player, rest);
  }
}

/**
 * WHY a pre-collected response was refused — and therefore whether it is worth
 * keeping.
 *
 * A response the live input rejects on its VALUE (same input type, e.g. a
 * `card` answer to a `card` prompt naming a card that is no longer a candidate)
 * is a genuine divergence: the state moved since the preview was built, the
 * question really is being asked now, and the player must answer it for real.
 *
 * A response the live input rejects because it is a DIFFERENT KIND of question
 * altogether is the queue-jump this module exists for — the prompt in front is
 * somebody else's (a triggered effect), and the answer is still owed its own.
 */
function jumpedTheQueue(response: InputResponse, waitingFor: PlayerInput): boolean {
  return response.type !== waitingFor.type;
}

/**
 * A prompt whose answer CANNOT have been pre-collected, whatever its type: a
 * deck pick asks about cards revealed only now. The marker is the server's own
 * (`ChooseCards.execute` → `markDeckPickPrompt`, the single funnel of the
 * draw-and-select family), never a title.
 */
function hiddenInfoPrompt(waitingFor: PlayerInput): boolean {
  return waitingFor.deckPickPrompt !== undefined;
}

/**
 * PARK responses for prompts that are ABOUT to be asked — the server-side
 * door of a pre-answered nested plan. A consumed Hydronetwork stage answer
 * (`DeltaProjectExpansion.resolveReward`) runs its repeated action through
 * the REAL pipeline; the action's own inputs then rise as ordinary prompts,
 * and these responses are what the drain feeds them. Append semantics —
 * exactly what `replayBatch`'s own parking does.
 */
export function parkBatchTail(player: IPlayer, responses: ReadonlyArray<InputResponse>): void {
  if (responses.length === 0) {
    return;
  }
  parkedTails.set(player, [...(parkedTails.get(player) ?? []), ...responses]);
}

/**
 * Drop the parked tail. Called when the action it belongs to is over
 * (`Player.takeAction`, once the deferred queue has drained): a pre-collected
 * answer that never found its prompt is stale, and must not be able to land on
 * a question the NEXT action asks. Also called at each traversal stage
 * boundary (`DeltaProjectExpansion.advance`'s per-position steps): a leftover
 * of the PREVIOUS stage's repeat (its prompt auto-resolved past the answer)
 * must never be able to land on the NEXT stage's same-shaped runtime ask.
 */
export function clearBatchTail(player: IPlayer): void {
  parkedTails.delete(player);
}

/** Test seam: how many pre-collected responses are still waiting for a prompt. */
export function parkedBatchTailLength(player: IPlayer): number {
  return parkedTails.get(player)?.length ?? 0;
}
