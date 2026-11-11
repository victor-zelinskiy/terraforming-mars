/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * PROMPT ADMISSION — the ONE answer to "may a prompt surface come alive RIGHT
 * NOW?". Every console surface that is DERIVED from `waitingFor` asks here
 * instead of hand-rolling its own boolean.
 *
 * WHY THIS EXISTS. One server response routinely carries a finished EFFECT and
 * the NEXT prompt together — the executor runs `drawCard` synchronously and only
 * DEFERS the tile placement, so Experimental Forest answers with the drawn cards
 * AND `SelectSpace` in the same payload. The console then played both at once:
 * the drawn-cards reveal assembled over the board while the board simultaneously
 * went live for the greenery, forcing the section switch and closing every layer
 * under the modal. Two demands on the player in the same frame, from one play.
 *
 * The shell already had the right machinery — `animationHold` → `presentationFlow`
 * → the shell's hold computeds — but admission was written out BY HAND at each
 * surface, four times, with four slightly different expressions. Board placement,
 * the fifth family, had no gate at all: it read `waitingFor.type === 'space'` raw.
 * A hand-copied gate is a gate that drifts, and the one nobody copied is the one
 * that spams. So the policy moves here: one table, one evaluation, exhaustive
 * over the surface union — a new surface family cannot compile without declaring
 * what it waits for.
 *
 * THE CONTRACT A DRAW MUST HONOUR: a draw's prompt is over only when the LAST
 * card has physically landed in the dock — deck-draw search → reveal overlay →
 * the player takes each card → the intake flight touches down. Nothing new may
 * be asked of the player before that. The chain is continuous by construction:
 * `deckDrawHolds()` covers the search, `revealOpen`/`revealPending` the modal,
 * and the intake appends its flight synchronously as the take commits, so no
 * frame falls between the links.
 *
 * PURE + a tiny reactive mirror (mirrors consoleMandatoryGate): the shell owns
 * the signals, this module owns the policy, so it is unit-testable with no DOM.
 */
import {reactive} from 'vue';
import {sessionState} from '@/client/console/session/consoleSession';

/**
 * The surface FAMILIES that serve a server prompt. Each declares its own wait
 * list below; the union is exhaustive, so adding a family is a compile error
 * until it has a policy.
 */
export type PromptSurface =
  /** The ConsoleTaskHost (+ the panels that cascade off it: WGT, production loss). */
  | 'host'
  /** A shell SECTION task (T3/T4): projectCard → hand / std sheet, colony → rail. */
  | 'section'
  /**
   * A section-family surface that hosts NONE of the running cinematics — the
   * corporation first-action confirm. It therefore also waits out the
   * 'notification-only' holds (the card intake / the deal), which legitimately
   * play OVER the other sections and so must not hold them.
   */
  | 'standaloneModal'
  /** The T5 full-screen START SCENE (initial cards wizard / start ceremony). */
  | 'scene'
  /**
   * THE SCALE BONUS'S STANDALONE BAND (P89 · ledger DZ — the alternative Venus board's 18–30 % bonus with no surface
   * to host it): `host`'s list plus `board-story` — a surface that asks about a scale step never stands over the
   * board's untold story of that step. Raised only while the board is in plain view (the park drains there), so a
   * covered board never holds it.
   */
  | 'scaleBonus'
  /**
   * BOARD PLACEMENT — the server's top-level `SelectSpace`. Served by the
   * ALWAYS-MOUNTED board, so it has no `v-if` of its own: admission decides
   * whether the board goes LIVE, whether the section is force-switched and
   * whether the context panel / command bar flip to placement.
   */
  | 'placement'
  /**
   * A FOLLOW-UP SURFACE'S OWN DOOR — the prompt-routed OPENING of a screen for
   * a prompt that arrived beside an effect the player is still working through.
   *
   * WHY IT IS ITS OWN FAMILY. One press routinely produces SEVERAL effects and
   * the server sends them in ONE response: «Научная колония» draws 2 cards
   * (synchronously, in the executor) and DEFERS a `SelectColony`. The other
   * families here are PRESENCE computeds — they decide whether a surface stays
   * MOUNTED, and a surface torn down mid-cinematic is worse than one that came
   * up early, which is exactly why `section` deliberately does not wait for
   * `card-arrival` (the hydro draw lands its cards INSIDE a section pick, and
   * the card deal plays inside the host). A DOOR carries no such cost: nothing
   * of it is on screen yet, so it can wait out the whole arrival chain — and it
   * MUST, or the next surface is handed to the player on top of the one they
   * have not finished. That shipped as the colony grid standing under a live
   * drawn-cards reveal, both from one play, the lower one unreachable.
   *
   * The list is therefore `host`'s: a follow-up step is the same thing — a
   * continuation handed to the player after something finished, so it waits out
   * everything that «something» is still showing.
   *
   * `announce-gate` is deliberately ABSENT. That gate holds a prompt CLOSED
   * until the player's own press, and the press IS this door
   * (`openMandatoryAnnounce`) — a door that ALSO opened on the gate's falling
   * edge would open twice.
   */
  | 'followUp';

/** What is holding the foreground, in the order the reason is resolved. */
export type AdmissionBlock =
  /** A reveal overlay is up (drawn cards / deck-check result / viewer). */
  | 'reveal'
  /** The played-card hero scene (lift → arc → landing → result beat). */
  | 'played-hero'
  /** The tile-placement hero (flight → touchdown → printed-bonus reward beat). */
  | 'tile-hero'
  /** Cards are physically arriving: the deck-draw search, an intake flight. */
  | 'card-arrival'
  /** The board card-BONUS cover lift (off a placed cell / the Venus marker). */
  | 'board-bonus'
  /** A card-discard transaction is live (answered, cards still flying). */
  | 'card-discard'
  /** A blocking presentation hold: turn theater, bot-turn card, ceremony. */
  | 'presentation'
  /** The mandatory ANNOUNCE gate holds this prompt closed until B. */
  | 'announce-gate'
  /**
   * THE STAGE GATE — this prompt belongs to a presentation STEP the flow has
   * not reached yet.
   *
   * Every other block here is about TIMING («something is still moving»); this
   * one is about OWNERSHIP («this surface's own stage does not exist yet»), and
   * it is the only one whose answer does not become true merely by waiting for
   * animations to finish. A Hydronetwork traversal resolves atomically on the
   * server but presents as a walk, so a stage-7 «reuse a card action» reward
   * puts its prompt on the wire while the marker is still on cell 5. Holding it
   * for the exits alone opened it the moment stage 5 stopped moving — over
   * stage 5's own scene. See `hydroStepAdmission`.
   */
  | 'stage-gate'
  /** ANY animation hold, including the 'notification-only' scopes. */
  | 'animation'
  /**
   * THE BOARD OWES A STORY (TR47 «ВВЕРХ И ОБРАТНО», PL-336): the board-beat park holds scale values a covered board
   * could not show, the board is now in plain view — and only a live placement keeps the park from draining (the
   * drain never plays while the player aims). A NEW placement waits for that story first: one response, several
   * effects — the raise is told, THEN the next board demand comes alive. Raised only while the board is otherwise
   * watchable, so a covered board (a workspace still up) never waits on a drain that cannot run.
   */
  | 'board-story'
  /**
   * ANOTHER SEAT'S TILE IS OWED TO THIS BOARD (state delivery, 2026-10-28 — `docs/claude/console/state-delivery-and-
   * handoff.md`): the remote stage has a landing queued, parked for the board or in the air. A NEW placement waits for
   * it — the board's TRUTH lands first, the demand on the player comes alive after: a player who was handed the grid
   * and the foreign tile in the same frame («the grid appearing had priority over the tile») read a cell as free that
   * the landing was about to cover. Raised only while no placement is LIVE already (the shell's latch): a tile that
   * arrives mid-aim lands on the visible board beside the aim, never by tearing the aim down. The shell's
   * `placementTakesBoardForLanding` watcher makes the board visible for the landing (the stack yields exactly as the
   * placement's own rising edge would), so the block can never wait on a board a workspace covers.
   */
  | 'remote-landing'
  /**
   * THE TABLE'S ANSWER IS BEING TOLD (the owner, 2026-11-01 — «модалка исчезает на время анимации срабатывания эффекта и
   * опять появляется»): a card's REACTION to the cause (the ruling Greens' «+2 M€ per TR step» for the ocean's rating)
   * is on stage or waits for the same scenes a decision waits for. A decision asked in the SAME response comes AFTER it,
   * once — the player's eye on one story at a time. Bounded by the chain's own ceiling; never raised while the chain waits
   * on something long of its own (`cardReactionTellsTableAnswer`), so no decision waits on a story that waits elsewhere.
   * An ENTRY block only: a surface already on screen is never taken down by it (the presence latch below).
   */
  | 'table-answer';

/**
 * The live signals, all owned + computed by ConsoleShell. Grouped as ONE object
 * so a new signal reaches every policy at once instead of being threaded into
 * whichever gates its author happened to remember.
 */
export type AdmissionSignals = {
  /** `consoleRevealMode !== undefined` — an overlay is mounted. */
  revealOpen: boolean;
  /** A drawn batch is pending even before its overlay mounts (`rawDrawnRevealPending`). */
  revealPending: boolean;
  /** `playedHeroHolding()`. */
  playedHero: boolean;
  /** `tilePlacementHolding()` — deliberately FALSE while merely 'armed'. */
  tileHero: boolean;
  /**
   * Cards in transit that NO placement can have armed: the deck-draw search and
   * the hand-intake flights. Kept apart from `boardBonus` on purpose — see there.
   */
  cardArrival: boolean;
  /**
   * The board card-bonus cover lift. Split out because this scene is armed BY the
   * placement's own confirm (A on the cell, before the POST): folding it into
   * `cardArrival` would make a placement cancel ITSELF the instant the player
   * pressed A. Its meaningful window — the cards actually being shown — is
   * covered for `placement` by `reveal*`, which the same response raises.
   */
  boardBonus: boolean;
  /** `cardDiscardTransaction.active`. */
  cardDiscard: boolean;
  /** `isMandatoryPromptsHeld()` — blocking holds / theater / holding notification. */
  presentation: boolean;
  /** `isMandatoryBeatHeld(...)` — announced, awaiting the player's B. */
  announceGate: boolean;
  /** `isAnimationHoldActive()` — every scope, including 'notification-only'. */
  anyAnimation: boolean;
  /** The park owes / plays a scale story over a board that is watchable but for the placement itself (PL-336). */
  boardStory: boolean;
  /** Another seat's tile is owed to this board and no placement is live yet (see the block). */
  remoteLanding: boolean;
  /** A card's reaction to the cause is being told (`cardReactionTellsTableAnswer`). */
  tableAnswer: boolean;
  /**
   * The prompt is owned by a traversal step whose cell the marker has not
   * settled on (`hydroStepQueuedFor`). Ownership, not timing — see the block.
   */
  stageGated: boolean;
};

/**
 * Resolution order. Fixed so the reported reason is deterministic (it feeds the
 * ?gpDebug readout and the specs); the ordering is "what the player is actually
 * looking at" first, the ambient holds last.
 */
const BLOCK_ORDER: ReadonlyArray<AdmissionBlock> = [
  // `stage-gate` leads: it is the only block that is about the prompt's OWN
  // identity rather than about what else is on screen, so when it applies it is
  // always the honest reason — and the ?gpDebug readout must say «stage 7 has
  // not been reached» rather than «a card is still flying».
  'stage-gate',
  'reveal', 'played-hero', 'tile-hero', 'card-arrival', 'board-bonus',
  // The board's TRUTH before the board's STORY: a foreign tile lands, then the scales tell what it did.
  'card-discard', 'presentation', 'announce-gate', 'remote-landing', 'board-story', 'table-answer', 'animation',
];

/** Is this block RAISED by the current signals? */
function raised(block: AdmissionBlock, s: AdmissionSignals): boolean {
  switch (block) {
  case 'reveal': return s.revealOpen || s.revealPending;
  case 'played-hero': return s.playedHero;
  case 'tile-hero': return s.tileHero;
  case 'card-arrival': return s.cardArrival;
  case 'board-bonus': return s.boardBonus;
  case 'card-discard': return s.cardDiscard;
  case 'presentation': return s.presentation;
  case 'announce-gate': return s.announceGate;
  case 'stage-gate': return s.stageGated;
  case 'animation': return s.anyAnimation;
  case 'board-story': return s.boardStory;
  case 'remote-landing': return s.remoteLanding;
  case 'table-answer': return s.tableAnswer;
  }
}

/**
 * WHAT EACH FAMILY WAITS FOR.
 *
 * `host` and `placement` share the full list: both are continuations the player
 * is handed after something finished, so both must wait out everything that
 * "something" is still showing — except that `placement` skips `board-bonus`
 * (see `AdmissionSignals.boardBonus`).
 *
 * `section` waits for less on purpose: the hydro draw lands its cards INSIDE a
 * section pick and the card deal plays inside the host, so holding a section for
 * `card-arrival` would unmount the very stage the cinematic runs on.
 *
 * `scene` is the opening ceremony — it owns the screen and hosts its own
 * cinematics, so only a reveal or a blocking presentation outranks it.
 *
 * `followUp` shares `host`'s list minus the announce gate — see the member's
 * own doc for both halves of that.
 */
const POLICY: Record<PromptSurface, ReadonlySet<AdmissionBlock>> = {
  host: new Set<AdmissionBlock>([
    'stage-gate',
    'reveal', 'played-hero', 'tile-hero', 'card-arrival', 'board-bonus',
    'card-discard', 'presentation', 'announce-gate', 'table-answer',
  ]),
  scaleBonus: new Set<AdmissionBlock>([
    'stage-gate',
    'reveal', 'played-hero', 'tile-hero', 'card-arrival', 'board-bonus',
    'card-discard', 'presentation', 'announce-gate', 'board-story', 'table-answer',
  ]),
  // `section` waits for less than the others by design (see above), but the
  // stage gate is NOT a cinematic: a section standing up for a step that has
  // not been reached is the same defect in a different surface.
  section: new Set<AdmissionBlock>([
    'stage-gate',
    'reveal', 'played-hero', 'presentation', 'announce-gate',
  ]),
  standaloneModal: new Set<AdmissionBlock>([
    'stage-gate',
    'reveal', 'played-hero', 'presentation', 'announce-gate', 'animation',
  ]),
  // `scene` is the opening ceremony — it predates any traversal by
  // construction, so the gate can never apply and is left out rather than
  // stated as a term that is always false.
  scene: new Set<AdmissionBlock>([
    'reveal', 'presentation',
  ]),
  placement: new Set<AdmissionBlock>([
    'stage-gate',
    'reveal', 'played-hero', 'tile-hero', 'card-arrival',
    'card-discard', 'presentation', 'announce-gate', 'remote-landing', 'board-story', 'table-answer',
  ]),
  followUp: new Set<AdmissionBlock>([
    'stage-gate',
    'reveal', 'played-hero', 'tile-hero', 'card-arrival', 'board-bonus',
    'card-discard', 'presentation', 'table-answer',
  ]),
};

/**
 * WHY this surface may not come alive, or undefined when it may. PURE.
 */
export function promptAdmissionBlock(
  surface: PromptSurface, signals: AdmissionSignals): AdmissionBlock | undefined {
  const policy = POLICY[surface];
  return BLOCK_ORDER.find((block) => policy.has(block) && raised(block, signals));
}

/** May this surface serve its prompt right now? PURE. */
export function isPromptAdmitted(surface: PromptSurface, signals: AdmissionSignals): boolean {
  return promptAdmissionBlock(surface, signals) === undefined;
}

/**
 * ENTRY IS NOT PRESENCE — THE PRESENCE LATCH (the owner, 2026-11-01: «модалка не должна мигать и исчезать, если уже
 * появилась»). Every policy above answers «may this surface COME ALIVE now?», and the shell used to ask it every frame
 * as «may it STAY?» too: a decision that had come to the screen was taken DOWN by the next scene that raised a block —
 * Neptunian Power Consultants' question stood 650 ms, the ruling Greens' token flight raised `resource-transfer`
 * (blocking → `presentation`), the question vanished for 650 ms and came back: a blink, a cheap screen. Once a
 * surface has come alive for a prompt it STAYS for that prompt until the player answers it (the submit funnel closes)
 * or the server asks something else — a later scene plays beside it, never by taking it away. Only the blocks that by
 * their meaning take the question's place withdraw it:
 *  · `reveal` — a modal of its own owns the opening and the pad (two modals stacked is worse than one at a time);
 *  · `card-discard` — the answer is already in flight (the pick surface let go of it);
 *  · `stage-gate` — the prompt is not this stage's (ownership, never timing).
 * `followUp` is a DOOR (it opens once; nothing of it stands) and is never latched.
 */
export const PRESENCE_WITHDRAWS: ReadonlySet<AdmissionBlock> = new Set<AdmissionBlock>(['reveal', 'card-discard', 'stage-gate']);

/** The families whose surface STANDS once admitted (every presence family but the opening's scene, which the start director owns; the door is not one). */
export const LATCHED_SURFACES: ReadonlySet<PromptSurface> =
  new Set<PromptSurface>(['host', 'section', 'standaloneModal', 'scaleBonus', 'placement']);

/** The prompt each family was ADMITTED for (its identity — the server's prompt id with its type), '' for none. */
export const promptPresenceState = reactive({
  latched: {} as Partial<Record<PromptSurface, string>>,
});

/**
 * MAY THIS SURFACE BE ON SCREEN — entry for a surface not yet up, presence for one that is. PURE in its inputs:
 * `latched` = this family was admitted for THIS prompt and its answer has not been sent.
 */
export function isPromptPresent(surface: PromptSurface, signals: AdmissionSignals, latched: boolean): boolean {
  if (isPromptAdmitted(surface, signals)) {
    return true;
  }
  if (!latched || !LATCHED_SURFACES.has(surface)) {
    return false;
  }
  const policy = POLICY[surface];
  return ![...PRESENCE_WITHDRAWS].some((block) => policy.has(block) && raised(block, signals));
}

/** The shell records that a family came alive for a prompt (from a watcher — never from a computed). */
export function latchPromptPresence(surface: PromptSurface, identity: string): void {
  if (LATCHED_SURFACES.has(surface) && promptPresenceState.latched[surface] !== identity) {
    promptPresenceState.latched[surface] = identity;
  }
}

/**
 * The answer was sent (or the game switched): every family lets go — its next presence is an entry again — except the
 * families in `keep`, whose surface PLAYS THAT ANSWER IN PLACE (see `presenceOutlivesAnswer`).
 */
export function releasePromptPresence(keep: ReadonlyArray<PromptSurface> = []): void {
  const kept: Partial<Record<PromptSurface, string>> = {};
  for (const surface of keep) {
    const identity = promptPresenceState.latched[surface];
    if (identity !== undefined) {
      kept[surface] = identity;
    }
  }
  if (Object.keys(promptPresenceState.latched).length !== Object.keys(kept).length) {
    promptPresenceState.latched = kept;
  }
}

/**
 * …AND AN ANSWER PLAYED IN PLACE KEEPS ITS SURFACE (Arabia Terra's data cell, 2026-11-06). «Until the answer is sent»
 * is the latch's end for a surface the answer LEAVES; a live «on which card» pick answers as a SCENE on the plate
 * itself — the chosen card sealed in its slot, the others receded, and the field's scene carries THAT card out of the
 * plate (`cardReceive/promptReceive.ts`, `riseFrom`). Released at the send, the plate was re-judged by ENTRY while the
 * answer was in flight — any blocking story of the same table (the oxygen step's board story, a starved frame's long
 * tail) took it down, the scene found no card to carry, degraded, and the units ticked with nothing on screen. So the
 * family that hosts an armed in-place answer stays latched through the request and the scene the transport holds the
 * commit for; the server's next prompt (a new identity) or the disarm lets it go. PURE.
 */
export function presenceOutlivesAnswer(surface: PromptSurface, inPlaceAnswer: boolean): boolean {
  return inPlaceAnswer && surface === 'host';
}

/**
 * A live mirror of the shell's PLACEMENT verdict, for the readers that cannot
 * recompute the signals themselves.
 *
 * The legacy `WaitingFor.vue` is one: it mounts the legacy `SelectSpace` (whose
 * `mounted()` paints `.board-space--available` onto the hexes) and teleports the
 * `PlacementBanner` to `<body>`, both keyed off `waitingFor` alone. Without this
 * the hexes would still light up under a reveal modal while every OTHER placement
 * affordance was correctly held — the half-live board the gate exists to prevent.
 *
 * Module-level so it survives the App-level `playerkey` remount, and DESKTOP-SAFE
 * by construction: only ConsoleShell ever writes it, so outside console mode it
 * stays false and every reader degrades to a no-op. Mirrors
 * `setMandatoryGateHeld` / `setConsoleTaskSpacePlacement`.
 */
export const promptAdmissionState = reactive({
  placementHeld: false,
});

/** The shell mirrors its live placement verdict here. */
export function setConsolePlacementHeld(held: boolean): void {
  promptAdmissionState.placementHeld = held;
}

/** Is the server's top-level placement being HELD behind a cinematic? */
export function isConsolePlacementHeld(): boolean {
  return promptAdmissionState.placementHeld;
}

/** Full reset (game switch / test cleanup). */
export function resetPromptAdmission(): void {
  promptAdmissionState.placementHeld = false;
  releasePromptPresence();
}

// THE GAME SCREEN LEAVES: this state goes with it — declared here, taken down by the session's ordered pass
// (architecture v2 — PLAN §10 · C5; the number is its place in that pass — `leaveConsoleSession`).
// Shell gone → the placement can never stay held (desktop reads the mirror too)
sessionState('prompt-admission', resetPromptAdmission, 360);
