import type {IPlayer} from '../IPlayer';
import {InputResponse, isOrOptionsResponse, SelectSpaceResponse} from '../../common/inputs/InputResponse';
import type {PlayerInput} from '../PlayerInput';
import {CardName} from '../../common/cards/CardName';
import {SpaceId} from '../../common/Types';
import {TileType} from '../../common/TileType';
import {OrOptions} from './OrOptions';
import {SelectSpace} from './SelectSpace';

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
      recordStagedParkBaselines(player, responses.slice(i));
      parkedTails.set(player, [...(parkedTails.get(player) ?? []), ...responses.slice(i)]);
      return;
    }
    // An ADDRESSED staged cell meeting a prompt that is not its own placement
    // is the exact same law with the exact same failure modes — Nuclear Zone's
    // temperature raise defers a bonus ocean AHEAD of the card's own tile, and
    // an ocean-placing card's bonus twin would silently CONSUME the cell while
    // a land tile's would read as a stale divergence and wipe it. Park the rest
    // untried; the drain lands it once its own `sourceCard` prompt surfaces.
    // The park RECORDS what stands on the pinned cell right now — staging and
    // this park are the same request, so this IS the state the player picked
    // against, and the drain's staleness question is «did it change since?».
    if (i > 0 && stagedMismatch(responses[i], waitingFor)) {
      recordStagedParkBaselines(player, responses.slice(i));
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
        recordStagedParkBaselines(player, responses.slice(i));
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
    if (stagedMismatch(rest[0], waitingFor)) {
      // An addressed staged cell whose OWN placement has not surfaced yet —
      // it stays parked. Trying it here is the same-type trap: the interloper
      // ocean would either eat it or read its refusal as staleness.
      break;
    }
    if (stagedParkStale(player, rest[0])) {
      // Its own prompt IS asking, but the pinned cell CHANGED since the park
      // (a hazard landed on it while the interloper resolved). The pick is
      // about a cell the player has not seen — honest re-ask, tail dropped.
      rest.length = 0;
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
 * ⚠ The TYPE alone cannot tell two PLACEMENTS apart — the threshold bonus
 * ocean is a `space` prompt exactly like the card's own tile — so an ADDRESSED
 * staged cell adds its own term: a prompt that is not the placement it names
 * is a queue-jump whatever its type.
 */
function jumpedTheQueue(response: InputResponse, waitingFor: PlayerInput): boolean {
  return response.type !== waitingFor.type || stagedMismatch(response, waitingFor);
}

/** The staged-placement address of a response, when it carries one. */
function stagedAddress(response: InputResponse): CardName | undefined {
  return response.type === 'space' ? (response as SelectSpaceResponse).stagedFor : undefined;
}

/**
 * An ADDRESSED response meeting a prompt that is NOT the placement it was
 * staged for. The address is the server's own `SelectSpace.sourceCard` —
 * every card-owned placement carries it (the Executor threads it, bespoke
 * paths pass it to `createMarsSelectSpace`), while every threshold/bonus
 * placement (the 0°C ocean, a Hellas placement-bonus ocean) leaves it
 * undefined — which is exactly what makes the two distinguishable at all.
 * Unaddressed responses answer `false` everywhere: the positional replay is
 * unchanged for every non-staged flow.
 */
function stagedMismatch(response: InputResponse, waitingFor: PlayerInput): boolean {
  const address = stagedAddress(response);
  if (address === undefined) {
    return false;
  }
  if (!(waitingFor instanceof SelectSpace)) {
    return true;
  }
  return waitingFor.sourceCard !== address;
}

/**
 * WHAT STOOD ON EACH ADDRESSED CELL WHEN IT PARKED — the state the player's
 * pick was made about (staging and the park land in the SAME request as the
 * play, so nothing can move between them). The drain's staleness question is
 * a COMPARISON against this, never a bare «is the cell occupied»: an Ares
 * hazard that already stood at staging was PRICED by the dossier and CHOSEN
 * («расчистить за 8 M€») — dropping the pin for it re-asked a placement the
 * player had already decided, which is the exact defect this module exists
 * to prevent. Only a cell that CHANGED during the parked window (an erosion
 * spawned by the interloper ocean's own placement, a tile landed on it)
 * carries a toll the player never saw.
 *
 * Weak and never serialized, exactly like the park itself; first park wins
 * (later re-parks of the same entry must not refresh the reference point).
 */
const stagedParkBaselines = new WeakMap<IPlayer, Map<SpaceId, TileType | 'empty'>>();

function recordStagedParkBaselines(player: IPlayer, responses: ReadonlyArray<InputResponse>): void {
  for (const r of responses) {
    if (stagedAddress(r) === undefined) {
      continue;
    }
    const spaceId = (r as SelectSpaceResponse).spaceId;
    const map = stagedParkBaselines.get(player) ?? new Map<SpaceId, TileType | 'empty'>();
    if (!map.has(spaceId)) {
      const space = player.game.board.spaces.find((s) => s.id === spaceId);
      if (space !== undefined) {
        map.set(spaceId, space.tile?.tileType ?? 'empty');
      }
    }
    stagedParkBaselines.set(player, map);
  }
}

/**
 * The pinned cell changed since its park. No recorded baseline (the tail
 * never parked — there was no window for the world to move) means no check:
 * `process` still validates membership and refuses an illegal cell.
 */
function stagedParkStale(player: IPlayer, response: InputResponse): boolean {
  const address = stagedAddress(response);
  if (address === undefined) {
    return false;
  }
  const spaceId = (response as SelectSpaceResponse).spaceId;
  const baseline = stagedParkBaselines.get(player)?.get(spaceId);
  if (baseline === undefined) {
    return false;
  }
  const space = player.game.board.spaces.find((s) => s.id === spaceId);
  if (space === undefined) {
    return false;
  }
  return (space.tile?.tileType ?? 'empty') !== baseline;
}

/**
 * The player is about to answer a prompt MANUALLY that a parked staged cell
 * was addressed to (an opponent's request advanced the queue past our drain
 * window, so the placement surfaced live). Their live answer supersedes the
 * parked plan — expire it, or the drain would land the stale cell on the SAME
 * card's NEXT same-shaped prompt (a two-ocean card's second ocean). Called by
 * the single-input route BEFORE processing.
 */
export function expireSupersededStagedTail(player: IPlayer): void {
  const tail = parkedTails.get(player);
  const waitingFor = player.getWaitingFor();
  if (tail === undefined || waitingFor === undefined) {
    return;
  }
  const rest = tail.filter((r) => stagedAddress(r) === undefined || stagedMismatch(r, waitingFor));
  if (rest.length === tail.length) {
    return;
  }
  if (rest.length === 0) {
    parkedTails.delete(player);
  } else {
    parkedTails.set(player, rest);
  }
}

/**
 * The staged placement still WAITING for its own prompt — the server-side
 * truth the self player model carries (`stagedPlacementPending`), so the
 * client can tell «the commit landed and the cell is parked behind an
 * interloper» from «the tail was dropped and the placement will be re-asked»,
 * and an F5 mid-chain re-derives the same fact instead of losing it.
 */
export function parkedStagedPlacement(player: IPlayer): {card: CardName, spaceId: SpaceId} | undefined {
  const entry = parkedTails.get(player)?.find((r) => stagedAddress(r) !== undefined);
  if (entry === undefined) {
    return undefined;
  }
  const space = entry as SelectSpaceResponse;
  return {card: space.stagedFor as CardName, spaceId: space.spaceId};
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
  recordStagedParkBaselines(player, responses);
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
  stagedParkBaselines.delete(player);
}

/** Test seam: how many pre-collected responses are still waiting for a prompt. */
export function parkedBatchTailLength(player: IPlayer): number {
  return parkedTails.get(player)?.length ?? 0;
}
