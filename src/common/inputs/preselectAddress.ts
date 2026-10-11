import {CardName} from '../cards/CardName';
import {Message} from '../logs/Message';
import {ChoiceContextSource} from '../models/PlayerInputModel';

/**
 * THE PRE-COLLECTED ANSWER IS ADDRESSED — the law every pre-select stands on.
 *
 * A composer (the play, a blue action, a trade, a standard project, a repeat)
 * collects the player's choices BEFORE the one submit and posts them as one
 * ordered batch. The server replays the batch against whatever it is asking —
 * and what it asks is NOT always the question an answer was collected for: an
 * effect the same play triggers can be asked first (Olympus Conference on a
 * science tag, the Reds tax, a colony owner's «draw 1, then discard 1»).
 *
 * Every rung that used to decide «is this my question?» guessed from the
 * response's TYPE or the prompt's KIND — and each new rung broke a neighbour:
 * «a discard is hidden information» (`186ddae340`, the Redux Venus bonus) made
 * EVERY pre-collected discard unlandable, so Sponsored Academies asked its
 * discard twice. The honest instrument (docs/claude/action-prompt-audit.md
 * § CLASS 6, «make the batch state what each response was collected FOR») is
 * this module:
 *
 *  · an ANSWER carries `for: PreselectAddress` — WHO asked (the source) and
 *    WHAT KIND of question (the role) — stamped by the composer from the
 *    preview step it answers (the server stamps the steps — one exit pass per
 *    preview family);
 *  · a PROMPT has an address too, read by ONE function (`promptAddressOf`)
 *    over the SAME structural markers the console routes by
 *    (`choiceContext` / `placementContext` / `discardPrompt` / `deckPickPrompt`
 *    and a placement's `sourceCard`) — server PlayerInputs and client models
 *    carry those fields under the same names, so the server's replay and the
 *    client's «re-asked» witness read one function;
 *  · the replay lands an answer ONLY on a prompt whose address MATCHES
 *    (`addressVerdict`); a prompt that does not match is somebody else's
 *    question — the answer waits for its own, untouched; its own prompt
 *    refusing it is an honest divergence (re-asked on purpose).
 *
 * Pure — no server, no Vue: the server runner tests it, both sides import it.
 */

/**
 * WHAT KIND of question. The input's own type, except where one type carries
 * two questions the batch must never confuse:
 *  · `discard` — a `card` pick carrying the `discardPrompt` marker (the hand
 *    gives a card UP; a target pick of the same source names a card that
 *    RECEIVES something);
 *  · `deckPick` — a pick over cards just turned off the deck (hidden
 *    information: no composer can have collected its answer).
 */
export type PreselectRole = 'discard' | 'deckPick' | string;

export type PreselectAddress = {
  /** Who asks — the same shape the prompt's marker names its source with. */
  source?: ChoiceContextSource,
  role: PreselectRole,
};

/**
 * The fields `promptAddressOf` reads — present under these names on a server
 * `PlayerInput` AND on the client's `PlayerInputModel`.
 */
export type AddressableInput = {
  type: string,
  choiceContext?: {source: ChoiceContextSource},
  placementContext?: {source?: ChoiceContextSource},
  discardPrompt?: {source?: ChoiceContextSource},
  deckPickPrompt?: {source?: ChoiceContextSource},
  /** A placement's own card (`SelectSpace.sourceCard`) — the staged cell's address since TR21. */
  sourceCard?: CardName,
  /** A party question: only a GRANT or a SUPPORT AREA pick is a card's own; the chairman's seat is nobody's pre-select. */
  votePrompt?: {source: string},
  supportPrompt?: unknown,
  options?: ReadonlyArray<unknown>,
};

/** The role of a prompt (or of a preview step's input model). */
export function roleOf(input: AddressableInput): PreselectRole {
  if (input.deckPickPrompt !== undefined) {
    return 'deckPick';
  }
  if (input.type === 'card' && input.discardPrompt !== undefined) {
    return 'discard';
  }
  return input.type;
}

/**
 * THE ADDRESS OF A PROMPT — who asks it and what kind of question it is. The
 * source is read off the structural markers in a FIXED order per role:
 *  · a placement (`space`) — `sourceCard`, the card whose OWN tile this is (a
 *    threshold / bonus placement leaves it undefined, which is exactly what
 *    tells the two apart — the staged-cell law of TR21);
 *  · a party question — the card behind a GRANT (`votePrompt.source ===
 *    'grant'`) or a SUPPORT AREA pick (`supportPrompt`); every other party
 *    question (the chairman's seat, a vote) has no card address;
 *  · everything else — `choiceContext`, then `placementContext`,
 *    `discardPrompt`, `deckPickPrompt` (the same precedence as the console's
 *    `promptSourceView`).
 */
export function promptAddressOf(input: AddressableInput): PreselectAddress {
  const role = roleOf(input);
  return {role, source: promptSourceOf(input)};
}

function promptSourceOf(input: AddressableInput): ChoiceContextSource | undefined {
  if (input.type === 'space') {
    return input.sourceCard === undefined ? undefined : {kind: 'card', card: input.sourceCard};
  }
  if (input.type === 'party') {
    const own = input.votePrompt?.source === 'grant' || input.supportPrompt !== undefined;
    return own ? input.choiceContext?.source : undefined;
  }
  return input.choiceContext?.source ??
    input.placementContext?.source ??
    input.discardPrompt?.source ??
    input.deckPickPrompt?.source;
}

function nameOf(name: string | Message | undefined): string | undefined {
  if (name === undefined) {
    return undefined;
  }
  return typeof name === 'string' ? name : name.message;
}

/**
 * THE SAME ASKER — the answer's source against the prompt's. A card is a card
 * whatever its kind says (a corporation, a standard project: one name, one
 * card); a colony payout ROUTED BY a card (`via` — Habitat Science's «gain all
 * your colony bonuses») is that card's own question too; a colony is its tile
 * name; a resolution its id; a party its name.
 */
export function sameSource(stamped: ChoiceContextSource, live: ChoiceContextSource): boolean {
  if (stamped.card !== undefined) {
    return live.card === stamped.card || live.via === stamped.card;
  }
  if (live.card !== undefined) {
    return stamped.via === live.card;
  }
  if (stamped.kind !== live.kind) {
    return false;
  }
  switch (stamped.kind) {
  case 'colony':
    return nameOf(stamped.name) === nameOf(live.name) && stamped.via === live.via;
  case 'resolution':
    return stamped.resolution === live.resolution;
  case 'party':
    return stamped.party === live.party;
  default:
    return nameOf(stamped.name) === nameOf(live.name);
  }
}

/**
 * The roles of a PLACEMENT-shaped question: their anonymous prompts are by
 * construction somebody else's (a threshold bonus ocean, the chairman's seat,
 * a trade's destination or a build, a deck pick) — so an answer of one of
 * these roles lands ONLY on a prompt that names its source.
 */
const SOURCE_REQUIRED: ReadonlySet<string> = new Set(['space', 'party', 'colony', 'deckPick']);

/**
 * WHOSE QUESTION IS THIS, for an answer collected with `stamped`?
 *  · `own`       — the prompt names its asker, it is the answer's asker, and
 *                  the question is of the answer's kind: process it; a refusal
 *                  is an honest divergence (the state moved since the preview)
 *                  and the player is asked for real;
 *  · `foreign`   — another asker, or another kind of question: the answer is
 *                  NOT tried — it waits, untouched, for its own prompt;
 *  · `anonymous` — the kind matches but the prompt names no asker (an
 *                  unmarked prompt): the address cannot decide, so the old
 *                  positional rules do (try; a refusal by a prompt of another
 *                  TYPE parks, by one of the same type drops). The one residual
 *                  hazard — an UNMARKED interloper of the same kind — lives
 *                  here; the replay guard names the in-scope pre-selects that
 *                  meet one.
 *
 * THE KIND matches with the two reshapes `reconcileBatchResponse` performs on
 * the wire: an OR-wrapped branch pick meets the bare input its card's action
 * collapsed to (Factorum), and a bare answer meets a ONE-option OrOptions.
 */
export type AddressVerdict = 'own' | 'foreign' | 'anonymous';

export function addressVerdict(stamped: PreselectAddress, live: AddressableInput): AddressVerdict {
  const address = promptAddressOf(live);
  const kindOk = stamped.role === address.role ||
    (stamped.role === 'or' && address.role !== 'deckPick') ||
    (address.role === 'or' && (live.options?.length ?? 0) === 1);
  if (!kindOk) {
    return 'foreign';
  }
  if (address.source === undefined || stamped.source === undefined) {
    return SOURCE_REQUIRED.has(address.role) || SOURCE_REQUIRED.has(stamped.role) ? 'foreign' : 'anonymous';
  }
  return sameSource(stamped.source, address.source) ? 'own' : 'foreign';
}

/**
 * WAS THE PLAYER ASKED TWICE? The prompt standing after a batch is the SAME
 * question one of its answers was collected for — the same asker AND the same
 * kind of question (the wire reshapes do not count: a branch pick that landed
 * is not re-asked by its card's next prompt of another kind, a placement the
 * branch declared). The one reading the replay guard and the client's witness
 * (`console/preselectWitness.ts`) share.
 */
export function reaskedBy(stamped: PreselectAddress, live: AddressableInput): boolean {
  return addressVerdict(stamped, live) === 'own' && stamped.role === promptAddressOf(live).role;
}

/**
 * The address an ANSWER carries — its `for`, or, for the three staged forms
 * that predate it, the card named by `stagedFor` (a cell, a resolution, a
 * colony tile picked before the play — TR21 / TR03 / TR07). ONE reader, so the
 * staged law is a case of the general one rather than a second law beside it.
 */
export function answerAddressOf(response: {type: string, for?: PreselectAddress, stagedFor?: CardName}): PreselectAddress | undefined {
  if (response.for !== undefined) {
    return response.for;
  }
  if (response.stagedFor !== undefined) {
    return {role: response.type, source: {kind: 'card', card: response.stagedFor}};
  }
  return undefined;
}

/**
 * STAMP an answer with its address — the one function every composer's batch
 * builder calls (never seven hand-written spreads). An absent address leaves
 * the answer as it was (the positional path, byte-identical).
 */
export function addressed<T>(response: T, address: PreselectAddress | undefined): T {
  if (address === undefined || response === undefined || response === null || typeof response !== 'object') {
    return response;
  }
  return {...response, for: address};
}

/** The answer without its address — what `process` validates (the wire key belongs to the batch, never to an input). */
export function withoutAddress<T extends object>(response: T): T {
  if (!('for' in response)) {
    return response;
  }
  const copy = {...response} as T & {for?: unknown};
  delete copy.for;
  return copy;
}
