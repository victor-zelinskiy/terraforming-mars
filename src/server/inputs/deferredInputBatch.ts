import type {IPlayer} from '../IPlayer';
import {InputResponse, isOrOptionsResponse, SelectSpaceResponse} from '../../common/inputs/InputResponse';
import type {PlayerInput} from '../PlayerInput';
import {CardName} from '../../common/cards/CardName';
import {SpaceId} from '../../common/Types';
import {tiersOf} from '../../common/boards/cityStack';
import {OrOptions} from './OrOptions';
import {AddressableInput, AddressVerdict, PreselectAddress, addressVerdict, answerAddressOf, withoutAddress} from '../../common/inputs/preselectAddress';

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
 *
 * THE ADDRESS DECIDES (2026-10-11 — docs/claude/action-prompt-audit.md
 * § CLASS 8). Every rung that used to answer «is this my question?» guessed
 * from the response's TYPE or the prompt's KIND, and each new rung broke a
 * neighbour — «every discard is hidden information» (`186ddae340`, the Redux
 * Venus bonus) made EVERY pre-collected discard unlandable, so Sponsored
 * Academies asked its discard twice. Now an answer carries the address it was
 * collected for (`for` — `common/inputs/preselectAddress.ts`; a staged cell /
 * resolution / colony tile's `stagedFor` is the same address in its older
 * spelling) and the prompt's address is read off its structural markers by the
 * ONE reader both sides share (`promptAddressOf`):
 *  · `own` — the prompt is the answer's: it is processed; a refusal is an
 *    honest divergence — the rest of the batch is dropped and the player
 *    answers for real;
 *  · `foreign` — another asker or another kind of question: the answer is
 *    PARKED UNTRIED (never offered to the wrong question, never read as a
 *    divergence);
 *  · `anonymous` — the prompt names no asker: the positional rules decide,
 *    exactly as before the address existed;
 *  · an UNADDRESSED answer (a client that predates the address) — the
 *    positional rules too, byte-identical.
 * The only prompt-KIND rule left is the deck pick (`hiddenInfoPrompt`): cards
 * revealed only now cannot have been answered by any composer, so an answer
 * that is not ADDRESSED to it never meets it.
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

/** An answer as the batch carries it — perhaps with its address (`for`). */
type BatchAnswer = InputResponse & {for?: PreselectAddress};

/**
 * WHOSE QUESTION the waiting prompt is for this answer — `undefined` for an
 * UNADDRESSED answer (the positional rules decide). See the module comment.
 */
function verdictOf(answer: InputResponse, waitingFor: PlayerInput): AddressVerdict | undefined {
  const address = answerAddressOf(answer as BatchAnswer);
  // A server PlayerInput carries every marker `promptAddressOf` reads under the
  // model's own names (`choiceContext`, `discardPrompt`, `sourceCard`, …).
  return address === undefined ? undefined : addressVerdict(address, waitingFor as unknown as AddressableInput);
}

/** The answer as `process` validates it — the address is the batch's, never the input's. */
function bare(answer: InputResponse): InputResponse {
  return withoutAddress(answer as BatchAnswer);
}

/** Park the rest of a batch (appended behind anything parked earlier in this action — the queue serves them in order). */
function park(player: IPlayer, responses: ReadonlyArray<InputResponse>): void {
  recordStagedParkBaselines(player, responses);
  parkedTails.set(player, [...(parkedTails.get(player) ?? []), ...responses]);
}

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
    const verdict = verdictOf(responses[i], waitingFor);
    // (i > 0: the HEAD answers the standing prompt by definition — the prompt
    // identity gate already vouched for it; a batch that OPENS on a mismatch
    // is a real error and falls through to process.)
    if (i > 0) {
      // SOMEBODY ELSE'S QUESTION — an interloper the same play raised ahead of
      // the answer's own prompt (Olympus Conference on a science tag, the
      // threshold bonus ocean ahead of a staged cell, the chairman's seat ahead
      // of a staged vote, a colony owner's discard ahead of a reward target).
      // Never even TRY the answer: a same-shaped answer could be CONSUMED by
      // the wrong question, or refused and read as a divergence. It waits for
      // its own prompt. The park RECORDS what stands on a pinned cell right
      // now — staging and this park are the same request, so this IS the state
      // the player picked against, and the drain's staleness question is «did
      // it change since?».
      if (verdict === 'foreign') {
        park(player, responses.slice(i));
        return;
      }
      // A DECK PICK («look at the top N») asks about cards that did not exist
      // when the batch was assembled — an answer not addressed to it is never
      // its (a Delta Surge traversal's stage-7 pick behind the stage-5 draw).
      if (verdict !== 'own' && hiddenInfoPrompt(waitingFor)) {
        park(player, responses.slice(i));
        return;
      }
    }
    // Reshape a pre-collected OR-wrapper to the live input shape when the
    // card's action() collapsed to a bare input (Factorum &c.), so the
    // confirmed step lands instead of popping a redundant modal.
    const response = reconcileBatchResponse(bare(responses[i]), waitingFor);
    try {
      player.process(response);
    } catch (e) {
      if (i === 0) {
        throw e; // the action pick itself failed — surface it.
      }
      // The answer's OWN prompt refused it: the state moved since the preview
      // and the question really is being asked — the rest of THIS batch is
      // dropped and the player answers for real. An anonymous prompt or an
      // unaddressed answer keeps the positional reading: a refusal by another
      // TYPE of question is a queue jump (APPEND, never replace: an answer
      // parked by an earlier submit in this action is still owed its prompt).
      if (verdict !== 'own' && jumpedTheQueue(response, waitingFor)) {
        park(player, responses.slice(i));
      }
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
    const verdict = verdictOf(rest[0], waitingFor);
    if (verdict === 'foreign') {
      // Its own prompt has not surfaced yet — it stays parked. Trying it here
      // is the same-type trap: the interloper would eat it or refuse it.
      break;
    }
    if (verdict !== 'own' && hiddenInfoPrompt(waitingFor)) {
      // The player must SEE the drawn cards to answer — a parked answer not
      // addressed to the pick is never its (see replayBatch). It stays parked.
      break;
    }
    if (stagedParkStale(player, rest[0])) {
      // Its own prompt IS asking, but the pinned cell CHANGED since the park
      // (a hazard landed on it while the interloper resolved). The pick is
      // about a cell the player has not seen — honest re-ask, tail dropped.
      rest.length = 0;
      break;
    }
    const response = reconcileBatchResponse(bare(rest[0]), waitingFor);
    try {
      player.process(response);
    } catch (e) {
      if (verdict === 'own' || !jumpedTheQueue(response, waitingFor)) {
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
 * The POSITIONAL reading of a refusal — what remains where no address speaks
 * (an unaddressed answer, or a prompt that names no asker): a response the
 * live input rejects on its VALUE (same input type — a `card` answer naming a
 * card that is no longer a candidate) is a genuine divergence, the question
 * really is being asked; a response the input rejects because it is a
 * DIFFERENT KIND of question is a queue-jump — the prompt in front is somebody
 * else's (a triggered effect), and the answer is still owed its own.
 *
 * Two questions of the SAME type from DIFFERENT askers — the threshold bonus
 * ocean beside the card's own tile, the chairman's seat beside a delegate
 * grant, a colony owner's discard beside a reward target — are exactly what
 * this reading cannot tell apart, and what the ADDRESS exists for
 * (`verdictOf`; the staged cell / resolution / colony tile of TR21 / TR03 /
 * TR07 are the address in its older spelling, `stagedFor`, read by the same
 * `answerAddressOf` — one law, not a second one beside it).
 */
function jumpedTheQueue(response: InputResponse, waitingFor: PlayerInput): boolean {
  return response.type !== waitingFor.type;
}

/** The address of a staged CELL — the only kind the cell baselines and the parked pin are about. */
function stagedCellAddress(response: InputResponse): CardName | undefined {
  return response.type === 'space' ? (response as SelectSpaceResponse).stagedFor : undefined;
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
 * A MOVE (TR14 Re-settlement — the answer names `movedFrom` too) pins TWO
 * cells and records both: the cell the city leaves (its tile AND its height —
 * a stack that lost or gained a tier is not the stack the player lifted the
 * top of) and the cell it comes to. Either one changing drops the tail.
 *
 * Weak and never serialized, exactly like the park itself; first park wins
 * (later re-parks of the same entry must not refresh the reference point).
 */
const stagedParkBaselines = new WeakMap<IPlayer, Map<SpaceId, string>>();

/** What stands on a cell, as the baseline compares it: the tile and how many of it (`empty` for none). */
function cellSignature(player: IPlayer, spaceId: SpaceId): string | undefined {
  const space = player.game.board.spaces.find((s) => s.id === spaceId);
  if (space === undefined) {
    return undefined;
  }
  return space.tile === undefined ? 'empty' : `${space.tile.tileType}x${tiersOf(space)}`;
}

/** Every cell an addressed staged response pins: the cell picked, and — for a move — the cell the city leaves. */
function stagedCellsOf(response: InputResponse): ReadonlyArray<SpaceId> {
  if (stagedCellAddress(response) === undefined) {
    return [];
  }
  const space = response as SelectSpaceResponse;
  return space.movedFrom === undefined ? [space.spaceId] : [space.movedFrom, space.spaceId];
}

function recordStagedParkBaselines(player: IPlayer, responses: ReadonlyArray<InputResponse>): void {
  for (const r of responses) {
    // Cells only: a staged RESOLUTION needs no baseline — the voting area's
    // membership cannot change inside an action, and `SelectParty.process`
    // validates the party against the live prompt.
    for (const spaceId of stagedCellsOf(r)) {
      const map = stagedParkBaselines.get(player) ?? new Map<SpaceId, string>();
      if (!map.has(spaceId)) {
        const signature = cellSignature(player, spaceId);
        if (signature !== undefined) {
          map.set(spaceId, signature);
        }
      }
      stagedParkBaselines.set(player, map);
    }
  }
}

/**
 * The pinned cell changed since its park. No recorded baseline (the tail
 * never parked — there was no window for the world to move) means no check:
 * `process` still validates membership and refuses an illegal cell.
 */
function stagedParkStale(player: IPlayer, response: InputResponse): boolean {
  const baselines = stagedParkBaselines.get(player);
  if (baselines === undefined) {
    return false;
  }
  // ANY pinned cell that changed — a move's two cells are one pick.
  return stagedCellsOf(response).some((spaceId) => {
    const baseline = baselines.get(spaceId);
    if (baseline === undefined) {
      return false;
    }
    const now = cellSignature(player, spaceId);
    return now !== undefined && now !== baseline;
  });
}

/**
 * The player is about to answer a prompt MANUALLY that a parked answer was
 * addressed to (an opponent's request advanced the queue past our drain
 * window, so the placement — the delegate grant, the colony pick, the card
 * target — surfaced live). Their live answer supersedes the parked plan —
 * expire it, or the drain would land the stale answer on the SAME card's NEXT
 * same-shaped prompt (a two-ocean card's second ocean). Only an answer whose
 * address names THIS prompt as its own (`own`) is superseded — never one the
 * address cannot judge (an anonymous prompt), never an unaddressed one.
 * Called by the single-input route BEFORE processing.
 */
export function expireSupersededStagedTail(player: IPlayer): void {
  const tail = parkedTails.get(player);
  const waitingFor = player.getWaitingFor();
  if (tail === undefined || waitingFor === undefined) {
    return;
  }
  const rest = tail.filter((r) => verdictOf(r, waitingFor) !== 'own');
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
export function parkedStagedPlacement(player: IPlayer): {card: CardName, spaceId: SpaceId, movedFrom?: SpaceId} | undefined {
  const entry = parkedTails.get(player)?.find((r) => stagedCellAddress(r) !== undefined);
  if (entry === undefined) {
    return undefined;
  }
  const space = entry as SelectSpaceResponse;
  const pending: {card: CardName, spaceId: SpaceId, movedFrom?: SpaceId} = {card: space.stagedFor as CardName, spaceId: space.spaceId};
  if (space.movedFrom !== undefined) {
    // A parked MOVE (TR14): the pin holds the cell the city leaves too.
    pending.movedFrom = space.movedFrom;
  }
  return pending;
}

/**
 * A prompt whose answer CANNOT have been pre-collected, whatever its type: a
 * deck pick asks about cards revealed only now. The marker is the server's own
 * (`ChooseCards.execute` → `markDeckPickPrompt`, the single funnel of the
 * draw-and-select family), never a title.
 *
 * ONLY the deck pick. A mandatory DISCARD was a second rung here from
 * `186ddae340` (2026-09-28) to 2026-10-11 («the card it must name may have
 * been drawn by the very action») — and it made every PRE-COLLECTED discard
 * unlandable: Sponsored Academies asked its discard twice. The Redux Venus case
 * that rung was written for (a reward TARGET meeting the owner's «draw 1, then
 * discard 1» in front of it) is the address's to decide: the target is
 * addressed to the colony's reward pick, the discard is another role of
 * another asker — `foreign`, parked untried, the hand untouched.
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
  park(player, responses);
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
