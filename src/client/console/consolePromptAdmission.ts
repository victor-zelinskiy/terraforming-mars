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
   * BOARD PLACEMENT — the server's top-level `SelectSpace`. Served by the
   * ALWAYS-MOUNTED board, so it has no `v-if` of its own: admission decides
   * whether the board goes LIVE, whether the section is force-switched and
   * whether the context panel / command bar flip to placement.
   */
  | 'placement';

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
  /** ANY animation hold, including the 'notification-only' scopes. */
  | 'animation';

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
};

/**
 * Resolution order. Fixed so the reported reason is deterministic (it feeds the
 * ?gpDebug readout and the specs); the ordering is "what the player is actually
 * looking at" first, the ambient holds last.
 */
const BLOCK_ORDER: ReadonlyArray<AdmissionBlock> = [
  'reveal', 'played-hero', 'tile-hero', 'card-arrival', 'board-bonus',
  'card-discard', 'presentation', 'announce-gate', 'animation',
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
  case 'animation': return s.anyAnimation;
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
 */
const POLICY: Record<PromptSurface, ReadonlySet<AdmissionBlock>> = {
  host: new Set<AdmissionBlock>([
    'reveal', 'played-hero', 'tile-hero', 'card-arrival', 'board-bonus',
    'card-discard', 'presentation', 'announce-gate',
  ]),
  section: new Set<AdmissionBlock>([
    'reveal', 'played-hero', 'presentation', 'announce-gate',
  ]),
  standaloneModal: new Set<AdmissionBlock>([
    'reveal', 'played-hero', 'presentation', 'announce-gate', 'animation',
  ]),
  scene: new Set<AdmissionBlock>([
    'reveal', 'presentation',
  ]),
  placement: new Set<AdmissionBlock>([
    'reveal', 'played-hero', 'tile-hero', 'card-arrival',
    'card-discard', 'presentation', 'announce-gate',
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
}
