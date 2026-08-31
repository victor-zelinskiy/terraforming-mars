/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORKSPACE STACK — the ONE model of «how deep am I, and inside what».
 *
 * ── WHY A STACK AND NOT FOUR PARALLEL MODELS ────────────────────────────────
 *
 * The console already had four answers to that question — `consoleState.section`
 * / `.sheet`, a `workspaceStage` record (the pre-commit descent),
 * `workspaceOutcomeState` (the post-commit claim) and a `workspaceEmbed` record
 * (a whole screen hosted as a step) — plus a shell-local latch per case. Two of
 * those modules were DELETED into this one; none of them expressed DEPTH, so
 * every consumer re-derived it from a different subset of the flags, and B was a
 * twelve-branch chain that had to guess which of them was in charge.
 *
 * That is not a style problem. It shipped a soft-lock that cost a turn:
 *
 *   Playing «Торговая колония» from the hand, the card's SelectColony follow-up
 *   teleports the colonies INTO the hand's stage zone. Pressing B closed the
 *   hand section, but a guard (added so the sponsor chain would not tear down
 *   mid-prompt) deliberately kept the STAGE claim alive across that section
 *   change. So the flow OWNED a zone whose host was no longer mounted: the
 *   colonies rendered nowhere, the "stranded" self-heal could not fire (the
 *   claim still named a host), and nothing was deferred, so no card offered the
 *   way back. The prompt was live and unreachable.
 *
 * The two truths that disagreed were OWNERSHIP («the flow claims this zone»)
 * and PRESENCE («the host is on screen»). This module removes the disagreement
 * by making one derive from the other:
 *
 *   ▸ INVARIANT 1 — PRESENCE IS DERIVED FROM THE STACK. A surface mounts
 *     because a frame of its kind is in the stack, and for no other reason.
 *     «Own a zone whose host is unmounted» stops being expressible: the frame's
 *     existence IS what mounts the host, so the zone is always on its way.
 *     Embed rule 4's «render nowhere» goes back to being genuinely ONE FRAME —
 *     the gap between a claim and its slot — instead of a terminal state.
 *
 *   ▸ INVARIANT 2 — A FRAME LIVES ONLY WHILE ITS ANCHOR HOLDS. Every frame
 *     carries a serializable, STRUCTURAL proof of its right to exist (never a
 *     title — see CLAUDE.md § cross-cutting invariant 1). One reconciler
 *     truncates the stack at the first frame whose anchor no longer checks out
 *     against server truth. That single rule replaces the per-case stranded
 *     predicates, the liveness latches and the safety timers — AND it is what
 *     makes a RELOAD honest: the same walk that heals a dead claim in-session
 *     is the one that decides how much of a persisted stack may come back.
 *
 * Everything else falls out of those two. B is `pop`. «Свернуть» parks the
 * WHOLE stack rather than closing one surface. The breadcrumb is the stack read
 * left to right. Nesting is `slot of the frame below me`. «Does anything serve
 * this prompt?» is `stackServes(kind)`.
 *
 * ── PERSISTED vs RUNTIME ────────────────────────────────────────────────────
 *
 * A frame is plain data: no DOM node, no closure, no timer. `slot` is the one
 * exception and is RUNTIME — it names an element that exists only while the
 * host is mounted, so it is deliberately excluded from `serializeWorkspaceStack`
 * and comes back empty after a cold restore. Anything a running cinematic owns
 * (arrival gates, beat flags, expected counts) stays where it already lives; a
 * restored stack must never wait on a beat that nobody is going to play.
 *
 * PURE-ish: one reactive record + pure accessors. No DOM, no Vue components,
 * no i18n. The surfaces own rendering; this owns the shape of the flow.
 */
import {reactive} from 'vue';
import {
  WorkspacePhase,
  WorkspaceBackVerb,
  acceptsInput,
  backVerbFor,
  isCommitted,
} from '@/client/console/consoleWorkspaceFlow';
// TYPE-ONLY, both of them. `consoleRouter` IMPORTS this module (its
// `section`/`sheet` are projections of the stack, and `closeConsoleLayers`
// closes sheet frames), so a value import either way would close a runtime
// cycle. At runtime this file depends on nothing but Vue and the phase model.
import type {TaskKind} from '@/client/console/consoleTaskRouter';
import type {ConsoleSection, ConsoleSheetId} from '@/client/console/consoleRouter';

/**
 * The screens that can be a frame. A CLOSED union on purpose: a frame has to
 * bring a root name, a mount condition and an anchor, so a new one is a
 * deliberate addition — never a string that silently starts matching.
 */
export type WorkspaceFrameKind =
  /** «ДЕЙСТВИЯ КАРТ» — the action centre (ConsoleCardActions + composer). */
  | 'card-actions'
  /** «КАРТЫ В РУКЕ» — the hand carousel and the play-a-card flow. */
  | 'hand'
  /** «КОЛОНИИ» — the colony rail, standalone or hosted as a step. */
  | 'colonies'
  /** «ГИДРОСЕТЬ» — the Delta Project track. */
  | 'hydro'
  /** The GAME START WORKSPACE — the whole opening. */
  | 'start'
  /** «ДРАФТ» — the between-generations draft + research buy, one flow. */
  | 'draft'
  /** «СТАНДАРТНЫЕ ПРОЕКТЫ» — the premium standard-projects screen. */
  | 'standard-projects'
  /** «ВЕХИ» / «НАГРАДЫ» — the premium MA screen, one kind each. */
  | 'milestones'
  | 'awards'
  /**
   * «ПОВТОР ДЕЙСТВИЯ» — the action centre reused to pick an ALREADY-ACTIVATED
   * action to copy (Viron, «Проверка проекта», the Hydronetwork's stage 7).
   *
   * A KIND OF ITS OWN even though it shares the card centre's chassis, for the
   * same reason milestones and awards are two kinds on one root: to the player
   * it is a different screen, and — decisively — it is always a STEP INSIDE
   * the flow that asked for it. As a frame it inherits the whole contract for
   * free: the crumb reads the stack («ДЕЙСТВИЯ КАРТ › ШТОРМОВОЙ БАРЬЕР ›
   * ПОВТОР ДЕЙСТВИЯ»), B pops exactly one level, and its host cannot fold
   * under it. While it was a bare neighbour on a module flag it had none of
   * those: it titled itself, its host stayed posed mid-handoff, and the second
   * `ConsoleCardActions` answered «has a step taken my screen?» with the
   * GLOBAL stack — so the browser dissolved its own body.
   */
  | 'repeat-pick'
  /** «ФИНАЛЬНЫЙ ПОДСЧЁТ» — the post-game scoring ceremony + action list. */
  | 'endgame';

/**
 * THE WORKSPACE REGISTRY — one row per workspace, and the reason this file
 * exists as much as the stack itself.
 *
 * Everything that used to be re-stated per case now lives here: the crumb root,
 * the DOM root the leak detector probes for, and which of the shell's two legacy
 * navigation axes the frame projects onto. ADDING A WORKSPACE IS A ROW — not a
 * new latch in the shell, not a new arm in `handleSectionBack`, not a new entry
 * in `KIND_SURFACES`, not a new «is my host still alive» computed.
 *
 * The three things deliberately NOT in here, because they are genuinely not
 * constant per workspace:
 *  · `serves` — a frame earns the right to serve a prompt at runtime (an action
 *    only serves a card pick once its preview promised cards), so it lives on
 *    the FRAME;
 *  · `slot` — a host can publish DIFFERENT zones for different children (the
 *    start scene has one zone for a hosted hand and another for hosted
 *    colonies), so the host publishes it at runtime;
 *  · the anchor — it depends on what the frame is carrying, not on its kind.
 */
type WorkspaceKindSpec = {
  /** Breadcrumb root. An EXISTING i18n key the host already passes to
   *  `ConsoleWsHead` (English text IS the key) — nothing new is coined. */
  root: string,
  /**
   * The surface's own DOM root. The leak detector's presence probe, and the
   * one place it is written down — a workspace that renders somewhere the
   * detector cannot see is exactly how a stranded prompt goes unnoticed.
   */
  rootSelector: string,
  /** The legacy `consoleState.section` this frame projects onto, if any. */
  section?: ConsoleSection,
  /** The legacy `consoleState.sheet` this frame projects onto, if any. */
  sheet?: ConsoleSheetId,
  /**
   * What a FRESH frame of this kind is entitled to serve. A DEFAULT, not the
   * truth: a frame earns and loses prompts at runtime (an action only serves a
   * card pick once its preview promised cards), so the live list is on the
   * frame. This is what «enter this workspace» starts from.
   */
  serves: ReadonlyArray<TaskKind>,
  /**
   * MAY THIS WORKSPACE HOST ANOTHER SCREEN as a step of its own flow — i.e.
   * does it publish a `[data-embed-slot]` zone? `'inFlow'` means only while it
   * is genuinely inside one (the hand's zone IS its card-play stage; at its
   * browse layer there is no flow for a follow-up to belong to, so the
   * follow-up is a screen of its own). Absent = never a host.
   *
   * This is «the host is the NEAREST live unfinished step, never the outermost
   * root» stated once, for every workspace, instead of a depth-first `if`
   * chain that had to be re-authored each time a new host appeared.
   */
  hosts?: 'always' | 'inFlow',
  /**
   * The workspace's IDENTITY SYMBOL (a `BarButtonIcon` name) and, when that
   * symbol is a wheel flight's landing anchor, its `data-wheel-anchor` id.
   *
   * It lives here rather than only in the host's own markup because it is part
   * of the CRUMB'S PARENT ANCHOR, and a nested screen draws the crumb of the
   * frame the player actually started in: a card's Hydronetwork step reads
   * «⚡ ДЕЙСТВИЯ КАРТ › <карта> › ПРОДВИЖЕНИЕ», symbol included. A per-case
   * table in the nested surface would be one more thing a new host silently
   * fails to update.
   */
  emblem?: string,
  wheelAnchor?: string,
  /**
   * DOES THIS ROOT YIELD THE SCREEN TO THE BOARD AND COME BACK?
   *
   * A board placement needs the board, so every workspace gets out of its way —
   * but «the board needs the screen» is not «this flow is over», and until now
   * those were the same code (`goBoardHome`, which THROWS THE FRAMES AWAY).
   * That is right for a flow whose last act IS the placement; it is wrong for a
   * flow the placement happens INSIDE. A Hydronetwork stage-7 repeat that moves
   * the Mars Nomads asks for its space in the middle of a traversal that still
   * owes its own reward wave and result read: unwound there, the player's walk
   * simply ended on the board — no return, no payoff, and nothing to go back to.
   *
   * A kind that declares this steps ASIDE instead (`yieldStackToBoard`): the
   * frames are moved out of the live stack, so nothing renders over the board
   * and nothing else can reach them, and they come back at the SAME depth when
   * the board's business is done. Deliberately a REGISTRY row and not a check
   * at the placement watcher — «which workspaces survive somebody else's
   * business» is a property of the workspace, and the one that already had it
   * (the start scene, via its phase anchor) proved that a per-case answer is
   * how the next one gets forgotten.
   */
  yieldsToBoard?: boolean,
};

const WORKSPACE_KINDS: Record<WorkspaceFrameKind, WorkspaceKindSpec> = {
  'card-actions': {
    root: 'Card actions', rootSelector: '.con-cardactions', sheet: 'cardActions',
    serves: [], hosts: 'always',
    emblem: 'actions',
    wheelAnchor: 'card-actions',
  },
  'hand': {
    root: 'Cards in hand', rootSelector: '.con-hand', section: 'hand',
    serves: ['projectCard', 'handSelect'], hosts: 'inFlow',
  },
  'colonies': {
    root: 'Colonies', rootSelector: '.con-colonies', section: 'colonies',
    // (`handSelect` is EARNED at runtime, never a default: the shell adds it
    // to the live frame's `serves` for the span of a colony RESOLUTION —
    // Pluto's «draw 1, discard 1» — so a colonies screen idling at its browse
    // layer can never mask an unrelated stranded hand pick.)
    serves: ['colony'],
    // A colony flow hosts steps of its own resolution (the Pluto discard runs
    // on the real hand INSIDE this workspace). `inFlow`: at the browse layer
    // there is no flow for a follow-up to belong to.
    hosts: 'inFlow',
    emblem: 'colonies',
    wheelAnchor: 'trading',
  },
  'hydro': {
    root: 'Mars Hydronetwork', rootSelector: '.con-hydro', section: 'hydro',
    // (`deckSelect` etc. are EARNED at runtime, never a default: the shell
    // sets the live frame's `serves` for the span of a committed advance —
    // the landed stage's follow-up — so a hydro screen idling at its browse
    // layer can never mask an unrelated stranded pick.)
    serves: [],
    // The track hosts steps of its own resolution (a repeated action's colony
    // trade runs INSIDE this workspace). `inFlow`: at the browse layer there
    // is no flow for a follow-up to belong to.
    hosts: 'inFlow',
    // A TRAVERSAL IS A SEQUENCE THE BOARD CAN INTERRUPT. The stage-7 repeat can
    // copy an action whose target is a SPACE («Кочевники Марса»), and that
    // question is answered on the board — with the walk still parked on cell 7,
    // its reward wave unplayed and its result unread. The track steps aside for
    // the placement and takes the screen back after it.
    yieldsToBoard: true,
    emblem: 'hydronetwork',
    wheelAnchor: 'hydro',
  },
  // The start workspace is a full-bleed scene: it owns the screen outright and
  // projects onto neither axis.
  'start': {
    root: 'Start of the game', rootSelector: '.con-start',
    serves: ['startSequence', 'initialDraft', 'corpFirstAction'], hosts: 'always',
  },
  // The DRAFT workspace — a PHASE-anchored root like 'start': it IS the
  // between-generations sequence (picks → waits → research buy → done) and
  // projects onto neither navigation axis (the board stays its backdrop).
  'draft': {
    root: 'Draft', rootSelector: '.con-draftws',
    serves: ['cardSelect', 'draftWait'],
  },
  'standard-projects': {
    root: 'Standard Projects', rootSelector: '.con-stdp', sheet: 'standardProjects',
    // (`space` is EARNED at runtime, never a default: the shell adds it to the
    // live frame's `serves` for the span of a submitted pay-on-commit project —
    // City / Ocean / Greenery — so an idle browse layer can never mask an
    // unrelated stranded placement.)
    serves: ['projectCard'],
    // A standard project's own follow-up (the Build-Colony pick, the patent
    // sale's hand, the alt-resource payment) is a STEP of this flow, not a
    // screen of its own. `inFlow`: at the browse layer there is no flow for a
    // follow-up to belong to.
    hosts: 'inFlow',
    emblem: 'standard-projects',
  },
  // Milestones and awards are two kinds on one chassis — the same DOM root,
  // two sheet identities, because they are two different screens to the player.
  'milestones': {
    root: 'Milestones', rootSelector: '.con-ma', sheet: 'milestones',
    serves: [],
  },
  'awards': {
    root: 'Awards', rootSelector: '.con-ma', sheet: 'awards',
    serves: ['awardFunding'],
  },
  // The FINAL SCORING workspace — a PHASE-anchored root like 'start'/'draft':
  // it IS the post-game (the ceremony, the ranking, the action list), owns the
  // screen outright and projects onto neither navigation axis. It serves no
  // prompt: at Phase.END the transport is down and nothing is ever owed.
  // The repeat pick shares the action centre's DOM root (one chassis, two
  // screens — the milestones/awards precedent) and its sheet projection: what
  // the player is looking at IS a card-actions-shaped surface, so the axis
  // must say so, or the command bar and the input router disagree with the
  // screen. It never hosts and never serves: it is a pure client PICK.
  'repeat-pick': {
    root: 'Repeat action', rootSelector: '.con-cardactions', sheet: 'cardActions',
    serves: [],
  },
  'endgame': {
    root: 'Final scoring', rootSelector: '.con-endgame',
    serves: [],
  },
};

/** Every registered workspace, for the guards that must be exhaustive. */
export const WORKSPACE_FRAME_KINDS =
  Object.keys(WORKSPACE_KINDS) as ReadonlyArray<WorkspaceFrameKind>;

/**
 * The registry row of one workspace kind — READ-ONLY, for the guards that must
 * check a declaration rather than a behaviour («does every hostable workspace
 * say HOW it hosts?»). The table itself stays private: it is a declaration, not
 * a thing to reach into at runtime.
 */
export function workspaceKindSpec(kind: WorkspaceFrameKind): Readonly<WorkspaceKindSpec> {
  return WORKSPACE_KINDS[kind];
}

/** The DOM root a mounted frame of this kind renders (leak-detector probe). */
export function workspaceFrameSelector(kind: WorkspaceFrameKind): string {
  return WORKSPACE_KINDS[kind].rootSelector;
}

/**
 * The DOM roots of every workspace entitled to serve this prompt kind — the
 * leak detector's per-kind probe, DERIVED from the registry.
 *
 * A new workspace must not mean a new row in `KIND_SURFACES` as well: that
 * list is invisible to the compiler and fails only at runtime, hours later,
 * as an amber guard over a screen that is working perfectly.
 */
export function workspaceSurfacesFor(kind: TaskKind): ReadonlyArray<string> {
  const seen = new Set<string>();
  for (const spec of Object.values(WORKSPACE_KINDS)) {
    if (spec.serves.includes(kind)) {
      seen.add(spec.rootSelector);
    }
  }
  // …AND THE SERVES A LIVE FRAME HAS EARNED. The registry row is only the
  // DEFAULT: several workspaces deliberately declare `serves: []` and take a
  // kind at runtime for the span of one prompt (the Hydronetwork's
  // card-granted bonus offer, the landed stage's follow-up), precisely so an
  // idling screen cannot mask an unrelated stranded prompt. Reading the
  // registry alone made the detector blind to exactly those spans — the amber
  // guard rose over a Hydronetwork that was rendering the offer correctly
  // underneath it. A parked frame counts too: its surface comes back with it.
  for (const frame of [...workspaceStackState.frames, ...workspaceStackState.parked]) {
    if (frame.serves.includes(kind)) {
      seen.add(WORKSPACE_KINDS[frame.kind].rootSelector);
    }
  }
  return [...seen];
}

/**
 * WHY THIS FRAME IS ALLOWED TO EXIST — a structural, serializable proof that
 * can be re-checked against a fresh `playerView`.
 *
 * Deliberately NOT `promptIdentityKey`: that key interpolates the TRANSLATED
 * title (`turnIntents.ts`), so it changes with the interface language and would
 * truncate a perfectly live stack the first time somebody switches to English.
 * Anchors name structure — a prompt TYPE, a card, a phase.
 */
export type FrameAnchor =
  /** A browse layer that is always legitimate while the player has a turn
   *  (the action menu, the colony rail the player walked into themselves). */
  | {type: 'always'}
  /** A play-from-hand stage: the carried card must still be IN HAND. */
  | {type: 'cardInHand', card: string}
  /** An activation: the acting card must still be on the table. */
  | {type: 'actionAvailable', card: string}
  /** A surface that only exists to answer a prompt of this `waitingFor.type`. */
  | {type: 'prompt', promptType: string}
  /** A phase-scoped workspace (the start workspace IS the opening phases). */
  | {type: 'phase', phase: string};

/**
 * One place the player can stand.
 *
 * Everything except `slot` is STRUCTURAL and survives serialization. `slot` is
 * RUNTIME — see the file header.
 */
export interface WorkspaceFrame {
  readonly kind: WorkspaceFrameKind;
  /** The carried object — a CardName / ColonyName. '' on a browse layer. */
  subject: string;
  /**
   * This frame's own step name (an i18n key), published UP by whatever is
   * rendering inside it. The crumb's TAIL while this frame is on top.
   */
  stage: string;
  /** Where this frame stands relative to its commit — B's verb comes from it. */
  phase: WorkspacePhase;
  /** Which server prompt kinds this frame is entitled to serve. */
  serves: ReadonlyArray<TaskKind>;
  /** The proof of life re-checked by `reconcileWorkspaceStack`. */
  anchor: FrameAnchor;
  /**
   * This frame stands OVER its host instead of INSIDE it.
   *
   * The client PICK BRIDGE is the case: a composer asks the real hand for a
   * card, so the hand takes the whole screen and the composer waits underneath
   * with its captures intact — it is still the frame below, it just is not
   * hosting a zone. An EMBEDDED frame teleports into the host's zone and must
   * wait for it (embed rule 4); an overlay frame has no zone to wait for, so
   * making it wait would hold it off screen forever.
   */
  overlay: boolean;
  /**
   * RUNTIME. The CSS selector of the zone this frame publishes for the frame
   * ABOVE it, or '' while that zone is not standing.
   *
   * Reactive on purpose and published `flush: 'post'` by the host (embed rule
   * 4): the host's mount is what makes the target real, and a `querySelector`
   * inside a consumer's computed would never re-run when the node appears. A
   * teleport whose target does not exist yet drops its content on the floor.
   */
  slot: string;
  /**
   * THE CARD THIS FRAME'S STEP IS BEING DONE FOR — the answer to «почему я
   * здесь?» for anything hosted INSIDE it, and the target of the console-wide
   * `L3 Источник`.
   *
   * PUBLISHED BY THE HOST, never guessed by the guest. It used to be guessed:
   * `colonyEmbedSourceCard` read `workspaceFrameSubject(host)` and carved out
   * the one host it knew was different (`card-actions` keeps its card in the
   * outcome claim, not in the crumb). That is a per-case `if` masquerading as a
   * rule, and it was already wrong for a third host — a Hydronetwork traversal's
   * subject is its STAGE NAME («Микробная фиксация»), so a colony step opened by
   * a repeated action would have offered `L3 Источник` on a string that is not a
   * card at all.
   *
   * A host that carries a card publishes it here; a host that carries none
   * publishes nothing and the verb simply is not offered. A NEW workspace joins
   * by publishing — there is no table to extend and nothing to remember.
   *
   * '' = this frame's step is not being done for a card.
   */
  sourceCard: string;
}

/** What `pushWorkspaceFrame` is given — `slot` is never an input, and a frame
 *  is EMBEDDED unless it says otherwise. */
export type NewWorkspaceFrame =
  Omit<WorkspaceFrame, 'slot' | 'overlay' | 'sourceCard'> &
  {overlay?: boolean, sourceCard?: string};

export const workspaceStackState = reactive({
  /** Outermost first. `frames[0]` is the workspace the player entered. */
  frames: [] as Array<WorkspaceFrame>,
  /**
   * THE PARKED STACK — «свернуть» sets the whole flow ASIDE at full depth.
   *
   * A SEPARATE stack, not a flag on the live one, and that is the whole point:
   * the player parks precisely so they can go and open other screens. While it
   * was a flag, the first lateral move (`enterWorkspace` → `goBoardHome`) wiped
   * the parked frames, so «свернуть» silently became «закрыть» — the sponsor's
   * card-play step was lost by walking to the colonies and back, and A returned
   * the player to the deployment instead of their own unfinished play.
   *
   * Restoring re-shows exactly these frames: same subject, same picks, no
   * replayed cinematic and no second trip to the server.
   */
  parked: [] as Array<WorkspaceFrame>,
});

// ── reading the stack ───────────────────────────────────────────────────────

export function workspaceStackDepth(): number {
  return workspaceStackState.frames.length;
}

/** Is the player inside a workspace at all (parked or not)? */
export function workspaceStackActive(): boolean {
  return workspaceStackState.frames.length > 0;
}

export function workspaceStackCollapsed(): boolean {
  return workspaceStackState.parked.length > 0;
}

/** Is a frame of this kind anywhere — live OR parked? (A parked chain still
 *  owns its workspace; standing a SECOND one up beside it is a duplicate.) */
export function workspaceFrameKnown(kind: WorkspaceFrameKind): boolean {
  return workspaceFrameIndex(kind) !== -1 || workspaceFrameParked(kind);
}

/**
 * Is this kind set ASIDE — owned by the park rather than on screen?
 *
 * The question every «is my surface gone?» reader actually means, and the one
 * the global `workspaceStackCollapsed()` cannot answer: that one says «somebody,
 * somewhere is parked», so a reader asking it about ITSELF acts on a different
 * player's flow. Hiding a live workspace on it is what put a correct command bar
 * over a blank screen; skipping a claim release on it is what orphans a claim
 * whose own host is perfectly alive.
 */
export function workspaceFrameParked(kind: WorkspaceFrameKind): boolean {
  return workspaceStackState.parked.some((f) => f.kind === kind);
}

export function workspaceFrameAt(depth: number): WorkspaceFrame | undefined {
  return workspaceStackState.frames[depth];
}

export function workspaceStackTop(): WorkspaceFrame | undefined {
  return workspaceStackState.frames[workspaceStackState.frames.length - 1];
}

export function workspaceStackRoot(): WorkspaceFrame | undefined {
  return workspaceStackState.frames[0];
}

/** The depth of `kind`'s frame, or -1. Kinds are unique within a stack. */
export function workspaceFrameIndex(kind: WorkspaceFrameKind): number {
  return workspaceStackState.frames.findIndex((f) => f.kind === kind);
}

/**
 * THE PRESENCE PREDICATE (invariant 1). A hostable surface's `v-if` is this and
 * nothing else — never `consoleState.section`, never a latch, never a
 * conjunction of the two.
 *
 * A COLLAPSED stack answers false: the surfaces are genuinely gone (that is
 * what makes the board live and the restore card appear), and the frames are
 * what brings them back untouched.
 */
export function workspaceFrameMounted(kind: WorkspaceFrameKind): boolean {
  return workspaceFrameIndex(kind) !== -1;
}

/**
 * The TELEPORT TARGET for `kind` — the zone published by the frame directly
 * below it. `undefined` at depth 0 (the frame stands in its own band) and
 * `undefined` while the parent's zone has not mounted yet.
 *
 * OWNERSHIP AND READINESS STAY SEPARATE QUESTIONS (embed rule 4): a claimant
 * that treats «no slot yet» as «not mine» hands the surface to the standalone
 * band for one frame, which is exactly the modal-on-top-of-modal impression the
 * embed architecture removes. What invariant 1 buys is that the gap is now
 * PROVABLY transient — the parent frame exists, so the parent is mounted, so
 * its zone is coming.
 */
export function workspaceFrameTarget(kind: WorkspaceFrameKind): string | undefined {
  const depth = workspaceFrameIndex(kind);
  if (depth <= 0 || workspaceStackState.frames[depth].overlay) {
    return undefined;
  }
  const slot = workspaceStackState.frames[depth - 1].slot;
  return slot === '' ? undefined : slot;
}

/** Does this frame stand OVER its host rather than inside it? */
export function workspaceFrameIsOverlay(kind: WorkspaceFrameKind): boolean {
  const depth = workspaceFrameIndex(kind);
  return depth > 0 && workspaceStackState.frames[depth].overlay;
}

/**
 * MAY THIS SURFACE RENDER RIGHT NOW? The ONE `v-if` of every hostable console
 * screen — and the death of the `…HeldForWorkspace` family.
 *
 * A frame at depth 0 stands in its own band. A NESTED frame must wait for its
 * host's zone: a `<Teleport>` whose target is missing AT MOUNT keeps its
 * content in place, and the later arrival of the target does NOT reliably
 * relocate an already-mounted subtree — that is how a restored workspace once
 * stood up around a hand trapped under its own plate. So the claimant renders
 * NOWHERE for the gap frame (embed rule 4), never in its standalone band
 * first, and invariant 1 is what makes that gap provably transient: the host
 * frame exists, so the host is mounted, so its zone is coming.
 */
export function workspaceFrameRenders(kind: WorkspaceFrameKind): boolean {
  const depth = workspaceFrameIndex(kind);
  if (depth === -1) {
    return false;
  }
  return depth === 0 || workspaceStackState.frames[depth].overlay ||
    workspaceFrameTarget(kind) !== undefined;
}

/**
 * Is anything standing INSIDE this frame?
 *
 * THE ONE FORM OF «the chain is not over yet» — the shell carried five
 * hand-written copies of it (each spelling out a different subset of latch +
 * prompt + transaction flags), and the copy that was never written is the
 * soft-lock this module exists to remove. A host may not fold, release its
 * claim or let its zone go while a step it is hosting is still up: an inner
 * frame cannot outlive its host, so the host cannot leave first.
 */
export function workspaceFrameHasNested(kind: WorkspaceFrameKind): boolean {
  const depth = workspaceFrameIndex(kind);
  return depth !== -1 && depth < workspaceStackState.frames.length - 1;
}

/** The frame's OWN zone — what it publishes for whatever stands inside it
 *  (a descent's composer, or the frame above). '' while it is not standing. */
export function workspaceFrameSlot(kind: WorkspaceFrameKind): string {
  const depth = workspaceFrameIndex(kind);
  return depth === -1 ? '' : workspaceStackState.frames[depth].slot;
}

/** The object this frame carries ('' at its browse layer). */
export function workspaceFrameSubject(kind: WorkspaceFrameKind): string {
  const depth = workspaceFrameIndex(kind);
  return depth === -1 ? '' : workspaceStackState.frames[depth].subject;
}

/** This frame's own step name (the crumb tail while it is on top). */
export function workspaceFrameStage(kind: WorkspaceFrameKind): string {
  const depth = workspaceFrameIndex(kind);
  return depth === -1 ? '' : workspaceStackState.frames[depth].stage;
}

/** WHO IS HOSTING ME — the kind of the frame directly below, or undefined
 *  when this frame stands on its own (depth 0 / absent). */
export function workspaceFrameHost(kind: WorkspaceFrameKind): WorkspaceFrameKind | undefined {
  const depth = workspaceFrameIndex(kind);
  return depth <= 0 ? undefined : workspaceStackState.frames[depth - 1].kind;
}

/**
 * WHY this frame is allowed to exist. Its first consumer is «did the PROMPT
 * bring the player here, or did they walk in themselves» — a frame the server
 * demanded returns the screen when the demand is met, a frame the player chose
 * stays exactly where they left it. That used to be a shell data field
 * (`colonyOpenedByPrompt`) somebody had to remember to clear.
 */
export function workspaceFrameAnchor(kind: WorkspaceFrameKind): FrameAnchor | undefined {
  const depth = workspaceFrameIndex(kind);
  return depth === -1 ? undefined : workspaceStackState.frames[depth].anchor;
}

/** Where this frame stands relative to its commit (`undefined` = no frame). */
export function workspaceFramePhase(kind: WorkspaceFrameKind): WorkspacePhase | undefined {
  const depth = workspaceFrameIndex(kind);
  return depth === -1 ? undefined : workspaceStackState.frames[depth].phase;
}

/**
 * The phase of this frame WHEREVER it stands — live or PARKED.
 *
 * A park is a frame set aside, not a frame gone, so «what stage is it on» has
 * the same answer either way; a reader that only consults the live stack gets
 * `undefined` for a workspace the player is one press away from returning to,
 * which reads as «browse» to anything that defaults.
 */
export function workspaceFrameKnownPhase(kind: WorkspaceFrameKind): WorkspacePhase | undefined {
  return workspaceFramePhase(kind) ??
    workspaceStackState.parked.find((f) => f.kind === kind)?.phase;
}

/** Has the player descended INSIDE this screen (picked an object up)? */
export function workspaceFrameDescended(kind: WorkspaceFrameKind): boolean {
  const phase = workspaceFramePhase(kind);
  return phase !== undefined && phase !== 'browse';
}

/**
 * Does ANY frame serve this prompt kind? The leak detector's question — and a
 * PARKED stack still answers yes: a decision the player deliberately set aside
 * is not stranded, its way back is the board-home restore card.
 */
export function stackServes(kind: TaskKind): boolean {
  return workspaceStackState.frames.some((f) => f.serves.includes(kind)) ||
    // A PARKED chain still serves: a decision the player deliberately set aside
    // is not stranded — its way back is the board-home restore card.
    workspaceStackState.parked.some((f) => f.serves.includes(kind));
}

/** Which frame serves `kind`, if any (for routing a prompt to its host) —
 *  including a PARKED one, which is still that prompt's home. */
export function frameServing(kind: TaskKind): WorkspaceFrame | undefined {
  return workspaceStackState.frames.find((f) => f.serves.includes(kind)) ??
    workspaceStackState.parked.find((f) => f.serves.includes(kind));
}

/**
 * WHERE A FOLLOW-UP BELONGS — the deepest frame that may host a step of its own
 * flow right now, or `undefined` when the follow-up is a screen of its own.
 *
 * THE CONTINUATION RULE, stated once. Inside the start's play-from-hand prelude
 * a played card's SelectColony belongs to the CARD-PLAY step, not to the start
 * — so the colonies land one level deeper in the SAME teleport chain
 * (start ⊃ hand ⊃ colonies). Getting that wrong used to overwrite the sponsor's
 * own claim, tear the hand out and show the start screen with the project's
 * effect still unresolved. Registry-driven, so a new host is a row.
 */
export function workspaceHostForStep(): WorkspaceFrameKind | undefined {
  // THE TOP FRAME OR NOBODY. A step teleports into the zone published by the
  // frame IMMEDIATELY below it, so walking further down would name a host whose
  // zone the new frame can never reach — it would render nowhere, forever,
  // which is the exact shape of the strand this module exists to remove.
  const top = workspaceStackState.frames[workspaceStackState.frames.length - 1];
  if (top === undefined) {
    return undefined;
  }
  const hosts = WORKSPACE_KINDS[top.kind].hosts;
  return hosts === 'always' || (hosts === 'inFlow' && top.phase !== 'browse') ?
    top.kind : undefined;
}

// ── the breadcrumb ──────────────────────────────────────────────────────────

/**
 * The crumb for the WHOLE stack, in the one grammar every workspace uses:
 * STABLE CONTEXT BEFORE MUTABLE STAGE.
 *
 *   root    — the outermost frame: what the player entered. Never changes.
 *   subject — the DEEPEST carried object. A nested step that carries nothing of
 *             its own (the colonies answering a played card's effect) keeps
 *             naming the card that owes it, which is what makes three levels
 *             read as one flow instead of three screens.
 *   stage   — the TOP frame's step name. The only segment that animates.
 *
 * Feeds `buildWorkspaceHeader` unchanged.
 */
export function workspaceStackCrumb(): {
  root: string,
  subject?: {text: string, translate?: boolean},
  stage?: string,
  committed: boolean,
} | undefined {
  const frames = workspaceStackState.frames;
  const root = frames[0];
  if (root === undefined) {
    return undefined;
  }
  const top = frames[frames.length - 1];
  let subject = '';
  for (const frame of frames) {
    if (frame.subject !== '') {
      subject = frame.subject;
    }
  }
  return {
    root: WORKSPACE_KINDS[root.kind].root,
    subject: subject === '' ? undefined : {text: subject},
    stage: top.stage === '' ? undefined : top.stage,
    committed: isCommitted(top.phase),
  };
}

/** The root i18n key for a kind (hosts that draw their own head read this). */
export function workspaceFrameRoot(kind: WorkspaceFrameKind): string {
  return WORKSPACE_KINDS[kind].root;
}

/**
 * The OUTERMOST frame's kind — what the whole chain is a flow of.
 *
 * A nested step draws the identity symbol of the workspace it belongs to, and
 * that symbol belongs to the PARENT: it must be the same box, in the same
 * place, before and after the step opened. Asking the stack for its root is
 * the only way to get that without every step naming its possible hosts.
 */
export function workspaceStackRootKind(): WorkspaceFrameKind | undefined {
  return workspaceStackState.frames[0]?.kind;
}

/** The identity symbol of a kind's parent anchor (+ its wheel anchor id). */
export function workspaceFrameEmblem(kind: WorkspaceFrameKind): {emblem?: string, wheelAnchor?: string} {
  const spec = WORKSPACE_KINDS[kind];
  return {emblem: spec.emblem, wheelAnchor: spec.wheelAnchor};
}

// ── the projections onto the shell's two legacy navigation axes ─────────────

/*
 * `consoleState.section` and `.sheet` were two of the FIVE parallel answers to
 * «where am I». From stage D they stop being independent state and become these
 * two reads, which is what makes «the player drives the surface they SEE» true
 * by construction instead of by a per-case `…Embedded` flag.
 *
 * The DEEPEST projecting frame wins, not the root: standing on colonies hosted
 * inside a card play, the player IS on the colonies, and every section-keyed
 * branch in the shell should agree with their eyes.
 *
 * A PARKED stack projects to the board home with no sheet — deliberately BOTH,
 * because a park that left `sheet` set is precisely the documented
 * «half-collapse» (`workspace-band.md`): the restore card keys off `sheet`
 * being clear, so input kept routing into an invisible workspace.
 */

export function workspaceStackSection(): ConsoleSection {
  for (let i = workspaceStackState.frames.length - 1; i >= 0; i--) {
    const section = WORKSPACE_KINDS[workspaceStackState.frames[i].kind].section;
    if (section !== undefined) {
      return section;
    }
  }
  return 'board';
}

export function workspaceStackSheet(): ConsoleSheetId | undefined {
  for (let i = workspaceStackState.frames.length - 1; i >= 0; i--) {
    const sheet = WORKSPACE_KINDS[workspaceStackState.frames[i].kind].sheet;
    if (sheet !== undefined) {
      return sheet;
    }
  }
  return undefined;
}

/**
 * WHICH AXIS THE PLAYER IS ACTUALLY DRIVING — the axis the DEEPEST projecting
 * frame publishes on.
 *
 * `section` and `sheet` each answer «what is open on my axis», and both can be
 * set at once (`card-actions ⊃ colonies` publishes sheet `cardActions` AND
 * section `colonies`). Every consumer that has to pick ONE — input routing
 * above all — needs the tie broken by DEPTH, exactly as presence is: the
 * surface the player sees on top is the surface their presses belong to.
 * Hand-ordering the two checks instead is how a hosted colony grid ended up
 * handing its d-pad to the composer parked underneath it.
 */
export function workspaceStackTopAxis(): 'section' | 'sheet' | undefined {
  for (let i = workspaceStackState.frames.length - 1; i >= 0; i--) {
    const spec = WORKSPACE_KINDS[workspaceStackState.frames[i].kind];
    if (spec.section !== undefined) {
      return 'section';
    }
    if (spec.sheet !== undefined) {
      return 'sheet';
    }
  }
  return undefined;
}

// ── B, and what it means at this depth ──────────────────────────────────────

/**
 * WHAT B DOES HERE — derived from the top frame's phase, never hand-rolled at a
 * call site. `undefined` = the stack has no opinion (no workspace is open), and
 * the shell's other B branches own the press.
 */
export function workspaceStackBackVerb(): WorkspaceBackVerb | undefined {
  const top = workspaceStackTop();
  if (top === undefined) {
    return undefined;
  }
  return backVerbFor(top.phase);
}

/**
 * PERFORM B. One function, so the button can never do one thing and say
 * another: the command bar labels itself from `workspaceStackBackVerb` and this
 * executes exactly that verb.
 *
 * Returns what it did, so the caller knows whether the press was consumed.
 */
export function workspaceStackBack(): WorkspaceBackVerb | undefined {
  const verb = workspaceStackBackVerb();
  switch (verb) {
  // The BROWSE layer is the bottom of this screen: there is nothing under us
  // inside it, so B leaves the frame entirely.
  case 'close':
    popWorkspaceFrame();
    return verb;
  // ONE reversible level. A descent into an object is a PHASE of its screen,
  // not a second screen (the hand's browse grid is parked, never unmounted —
  // which is exactly why its selection, filter and scroll survive the fold),
  // so folding is a phase change and popping would throw away the workspace
  // the player is still standing in.
  case 'back':
    foldWorkspaceFrame();
    return verb;
  case 'collapse':
    collapseWorkspaceStack();
    return verb;
  // 'none' — a beat is in flight: the press is ABSORBED (a double submit is
  // impossible by construction rather than by a flag somebody remembers to
  // check), but it is still consumed so it cannot reach the board underneath.
  case 'none':
    return verb;
  default:
    return undefined;
  }
}

/** Is the pad live at the current depth? */
export function workspaceStackAcceptsInput(): boolean {
  const top = workspaceStackTop();
  return top === undefined ? true : acceptsInput(top.phase);
}

// ── mutating the stack ──────────────────────────────────────────────────────

/**
 * Enter a frame. Pushing a kind that is already in the stack is a no-op on the
 * SHAPE — the existing frame is updated in place and the stack is truncated to
 * it, which is the honest meaning of «go there»: you cannot be inside the same
 * workspace twice, and re-entering it means leaving whatever you opened on top.
 */
export function pushWorkspaceFrame(frame: NewWorkspaceFrame): number {
  const existing = workspaceFrameIndex(frame.kind);
  if (existing !== -1) {
    const live = workspaceStackState.frames[existing];
    live.subject = frame.subject;
    live.stage = frame.stage;
    live.phase = frame.phase;
    live.serves = [...frame.serves];
    live.anchor = frame.anchor;
    live.overlay = frame.overlay === true;
    truncateWorkspaceStack(existing + 1);
    return existing;
  }
  workspaceStackState.frames.push({
    ...frame, serves: [...frame.serves], overlay: frame.overlay === true, slot: '',
    sourceCard: frame.sourceCard ?? '',
  });
  return workspaceStackState.frames.length - 1;
}

/**
 * ── THE NAVIGATION VERBS ────────────────────────────────────────────────────
 *
 * `consoleState.section = X` was the console's whole navigation vocabulary, and
 * it is a LOSSY verb: it cannot tell «park this, I want to read the board» from
 * «this flow is finished» from «take me to that screen». All three wrote
 * `'board'`, so every consumer had to re-guess which had happened — and B, the
 * one button whose entire job is to answer that question, ended up as a
 * twelve-branch chain that guessed differently from the branch next to it.
 *
 * These are those three intents, named. A navigation site now DECLARES what it
 * meant, and the stack — not the reader — remembers it.
 */

/**
 * THE PLAYER GOES TO A SCREEN. The stack becomes exactly `[kind]`.
 *
 * A lateral move between top-level screens is NOT a descent — walking from the
 * colonies to the hydro track does not make the colonies the hydro's host. Only
 * a FLOW nests, and a flow nests with `pushWorkspaceFrame` (the start workspace
 * hosting the hand for a prelude, a played card hosting the colony pick).
 * Keeping the two verbs apart is what stops «go there» from quietly building a
 * chain nobody meant.
 *
 * The unwind is UNCONDITIONAL and atomic, and that is the whole point. The old
 * section watcher did the same thing by hand and GUARDED it («…unless a colony
 * follow-up is live inside the hand»), which is exactly how a step came to
 * outlive the host it was standing in.
 */
export function enterWorkspace(
  kind: WorkspaceFrameKind,
  opts?: {subject?: string, serves?: ReadonlyArray<TaskKind>, anchor?: FrameAnchor},
): void {
  // `goBoardHome`, not `resetWorkspaceStack`: a PHASE-anchored root survives a
  // lateral move for the same reason it survives a finished flow — walking from
  // the deployment to the colonies does not end the opening.
  goBoardHome();
  pushWorkspaceFrame({
    kind,
    subject: opts?.subject ?? '',
    stage: '',
    phase: 'browse',
    serves: opts?.serves ?? WORKSPACE_KINDS[kind].serves,
    anchor: opts?.anchor ?? {type: 'always'},
    // A LATERAL MOVE NEVER BECOMES A HOSTED STEP. If a phase-anchored root
    // survived the unwind, this screen stands OVER it — it must not wait for a
    // zone that root never offered it, which would hold it off screen forever.
    // Only a FLOW nests, and a flow nests with `pushWorkspaceFrame`.
    overlay: workspaceStackState.frames.length > 0,
  });
}

/** Leave the deepest workspace — one screen back towards the board. */
export function leaveWorkspace(): void {
  popWorkspaceFrame();
}

/**
 * The flow is FINISHED — unwind to the board home.
 *
 * Distinct from `collapseWorkspaceStack` on purpose: this one throws the frames
 * away, so there is nothing to come back to and no restore card is offered.
 * Using it where a park was meant is how a live decision gets silently dropped.
 *
 * ⚠️ A PHASE-ANCHORED ROOT SURVIVES, and that is not an exception — it is the
 * definition. Such a frame is not part of any flow: it IS the game phase (the
 * start workspace is the whole opening), so a step INSIDE it can never finish
 * it. It yields the screen to the board and comes back by itself when the
 * board's business is done; only its own anchor going dead ends it. Unwinding
 * it here is what would make a placement mid-deployment look like «the start
 * screen is gone», with the deployment still owed.
 */
export function goBoardHome(): void {
  const root = workspaceStackState.frames[0];
  truncateWorkspaceStack(root !== undefined && root.anchor.type === 'phase' ? 1 : 0);
  // The PARK is deliberately untouched: it is a different flow, set aside on
  // purpose, and finishing the one the player is looking at says nothing about
  // it. (Wiping it here is the same bug as wiping it on a lateral move.)
}

/**
 * DESCEND inside the top frame: the player picked up an object in the screen
 * they are already standing in (a card in the hand, an action in the centre).
 *
 * This is deliberately a PHASE of the same frame rather than a new one. The
 * browse layer is parked, not unmounted — which is what makes its selection,
 * filter and scroll survive the descent for free, and it keeps `kind` unique
 * within the stack so `workspaceFrameMounted` stays a straight answer.
 */
export function descendWorkspaceFrame(
  kind: WorkspaceFrameKind,
  subject: string,
  stage: string,
  anchor?: FrameAnchor,
): void {
  const depth = workspaceFrameIndex(kind);
  if (depth === -1) {
    return;
  }
  const frame = workspaceStackState.frames[depth];
  frame.subject = subject;
  frame.stage = stage;
  frame.phase = 'configure';
  if (anchor !== undefined) {
    // The frame's right to exist now depends on the object it picked up: a
    // card that leaves the hand takes its own configure stage with it.
    frame.anchor = anchor;
  }
}

/** Fold the top frame back to its browse layer (the reversible level of B). */
export function foldWorkspaceFrame(): void {
  const frame = workspaceStackTop();
  if (frame === undefined) {
    return;
  }
  frame.subject = '';
  frame.stage = '';
  frame.phase = 'browse';
}

/**
 * Close the SHEET-shaped frames sitting on top — the quick screens (the action
 * centre, standard projects, milestones/awards, the hydro card pick) — and
 * leave whatever full screen stands beneath them.
 *
 * REGISTRY-DRIVEN, not a list: «which screens are sheets» is already stated
 * once, in `WORKSPACE_KINDS`. This is what `closeConsoleLayers()` means by
 * «the transient layers go away», and it is why the hydro pick needs no
 * `stayInSection` special case — closing the pick simply uncovers the track.
 */
export function closeWorkspaceSheet(): void {
  let keep = workspaceStackState.frames.length;
  while (keep > 0 && WORKSPACE_KINDS[workspaceStackState.frames[keep - 1].kind].sheet !== undefined) {
    keep--;
  }
  truncateWorkspaceStack(keep);
}

/** Leave the top frame — one logical level. */
export function popWorkspaceFrame(): void {
  workspaceStackState.frames.pop();
}

/**
 * THIS WORKSPACE IS OVER — it goes, and takes everything standing inside it.
 *
 * The ONE call that may unwind a PHASE-anchored root, and the reason it has to
 * exist: `goBoardHome` protects such a root from being FINISHED BY A STEP
 * INSIDE IT (a placement mid deployment is not the end of the opening). It must
 * not protect it from its own lifecycle owner too — that way the frame could
 * never be dropped at all, and the start scene would stay mounted over the rest
 * of the game.
 */
export function closeWorkspaceRoot(kind: WorkspaceFrameKind): void {
  const depth = workspaceFrameIndex(kind);
  if (depth !== -1) {
    truncateWorkspaceStack(depth);
  }
}

/**
 * Keep the first `depth` frames and drop the rest.
 *
 * The ONE way the stack ever shrinks from above — used by re-entry into an
 * existing frame, by the anchor reconciler and by rehydration, so «a flow
 * degraded» always looks the same to every consumer.
 */
export function truncateWorkspaceStack(depth: number): void {
  const keep = Math.max(0, Math.min(depth, workspaceStackState.frames.length));
  if (keep === workspaceStackState.frames.length) {
    return;
  }
  workspaceStackState.frames.splice(keep);
}

/** The top frame names the step it is showing (the crumb's tail). */
export function setWorkspaceFrameStage(kind: WorkspaceFrameKind, stage: string): void {
  const depth = workspaceFrameIndex(kind);
  if (depth !== -1) {
    workspaceStackState.frames[depth].stage = stage;
  }
}

/** The carried object changed (a different card picked up in the same frame). */
export function setWorkspaceFrameSubject(kind: WorkspaceFrameKind, subject: string): void {
  const depth = workspaceFrameIndex(kind);
  if (depth !== -1) {
    workspaceStackState.frames[depth].subject = subject;
  }
}

/** The host publishes the card its step is being done FOR (see the field). */
export function setWorkspaceFrameSourceCard(kind: WorkspaceFrameKind, card: string): void {
  const depth = workspaceFrameIndex(kind);
  if (depth !== -1) {
    workspaceStackState.frames[depth].sourceCard = card;
  }
}

/**
 * THE CARD A NESTED STEP IS BEING DONE FOR — asked by the step, answered by its
 * HOST. One question, one answer, whatever the host is: that is what makes
 * `L3 Источник` work the same in a colony step opened from the hand, from the
 * action centre and from the Hydronetwork without any of them knowing about the
 * others.
 *
 * The fallback is the crumb SUBJECT, and it is deliberately narrow: it holds
 * only while the subject really is a card (every host that carries one puts it
 * there), so a host whose subject is a stage name contributes nothing rather
 * than a broken zoom target. A host with a card that does NOT live in its crumb
 * publishes it explicitly.
 */
export function workspaceStepSourceCard(kind: WorkspaceFrameKind, isCard: (name: string) => boolean): string {
  const depth = workspaceFrameIndex(kind);
  if (depth === -1) {
    return '';
  }
  const frame = workspaceStackState.frames[depth];
  if (frame.sourceCard !== '') {
    return frame.sourceCard;
  }
  return isCard(frame.subject) ? frame.subject : '';
}

/**
 * Move a frame across the commit boundary (or back, when the server refuses).
 *
 * A rollback is a PEER of the commit, not an afterthought: leaving a refused
 * move past the boundary strands the player in a state where B does nothing and
 * the crumb claims a move that was never made.
 */
export function setWorkspaceFramePhase(kind: WorkspaceFrameKind, phase: WorkspacePhase): void {
  const depth = workspaceFrameIndex(kind);
  if (depth !== -1) {
    workspaceStackState.frames[depth].phase = phase;
  }
}

/** What this frame is entitled to serve changed (a follow-up was promised). */
export function setWorkspaceFrameServes(kind: WorkspaceFrameKind, serves: ReadonlyArray<TaskKind>): void {
  const depth = workspaceFrameIndex(kind);
  if (depth !== -1) {
    workspaceStackState.frames[depth].serves = [...serves];
  }
}

/** The frame's zone mounted (or went away) — publish the target for its child. */
export function setWorkspaceFrameSlot(kind: WorkspaceFrameKind, selector: string): void {
  const depth = workspaceFrameIndex(kind);
  if (depth !== -1) {
    workspaceStackState.frames[depth].slot = selector;
  }
}

/*
 * ── YIELDED TO THE BOARD ──────────────────────────────────────────────────
 *
 * NOT a park. `parked` is the PLAYER's «свернуть»: they set a decision aside to
 * go and look at something, it is reachable from the board-home restore card,
 * and it is legitimately DISCARDED the moment the server asks for something
 * else (a set-aside decision that no longer exists must not be restorable).
 *
 * This is the same flow, mid-step, with the step happening somewhere the
 * workspace cannot draw — so all three of those are false for it: there is no
 * restore card (the player is answering the very thing that took the screen),
 * and the server asking for something else is precisely the EXPECTED state, not
 * evidence of staleness. Keeping the frames in `parked` would have them thrown
 * away by `discardWorkspacePark` on the placement's own prompt identity.
 *
 * Module-level and deliberately NOT serialized: a reload during a placement
 * lands on the board with the server's prompt intact, which is the honest
 * recovery — a resurrected mid-walk workspace would be a lie about a client
 * sequence the server never knew about.
 */
const boardYielded: Array<WorkspaceFrame> = [];

/**
 * The board is taking the screen. If the root DECLARES that it yields (see
 * `yieldsToBoard`), step aside and report `true`; otherwise report `false` and
 * let the caller finish the flow the way it always has.
 */
export function yieldStackToBoard(): boolean {
  if (boardYielded.length > 0) {
    return true; // already aside — a second placement inside the same step
  }
  const root = workspaceStackState.frames[0];
  if (root === undefined || workspaceKindSpec(root.kind).yieldsToBoard !== true) {
    return false;
  }
  boardYielded.push(...workspaceStackState.frames.splice(0));
  return true;
}

/** The board's business is over — take the screen back at the SAME depth. */
export function resumeStackFromBoard(): boolean {
  if (boardYielded.length === 0) {
    return false;
  }
  const frames = boardYielded.splice(0);
  for (const frame of frames) {
    // The hosts are about to re-mount and must re-publish; a stale selector
    // would teleport a surface into a detached node. (Same reason as
    // `restoreWorkspaceStack` — one rule, stated at both doors.)
    frame.slot = '';
  }
  workspaceStackState.frames.splice(0, workspaceStackState.frames.length, ...frames);
  return true;
}

/** Is a flow currently standing aside for the board? */
export function stackYieldedToBoard(): boolean {
  return boardYielded.length > 0;
}

/** Park the whole stack (B past the commit boundary — «свернуть»). */
export function collapseWorkspaceStack(): void {
  if (workspaceStackState.frames.length === 0) {
    return;
  }
  // MOVED, not flagged — the live stack is now free for wherever the player
  // wants to go, and the parked one cannot be destroyed by going there.
  workspaceStackState.parked.splice(0, workspaceStackState.parked.length,
    ...workspaceStackState.frames.splice(0));
}

/**
 * Un-park. The frames were never touched, so the player lands back at the SAME
 * depth on the SAME decision. Slots are deliberately cleared: the hosts are
 * about to re-mount and must re-publish, and a stale selector would teleport a
 * surface into a detached node.
 */
export function restoreWorkspaceStack(): void {
  if (workspaceStackState.parked.length === 0) {
    return;
  }
  // Whatever the player was browsing gives way — coming back to a set-aside
  // decision means leaving the screen they went to look at.
  const frames = workspaceStackState.parked.splice(0);
  for (const frame of frames) {
    // The hosts are about to re-mount and must re-publish; a stale selector
    // would teleport a surface into a detached node.
    frame.slot = '';
  }
  workspaceStackState.frames.splice(0, workspaceStackState.frames.length, ...frames);
}

/**
 * The parked flow is STALE (the server moved on to a different prompt) — drop
 * it, or a restore would put the player back inside a decision that is gone.
 *
 * ⚠️ A PHASE-ANCHORED ROOT SURVIVES, exactly as it does in `goBoardHome`, and
 * for the same reason: it is not part of anybody's flow, it IS the game phase,
 * so «the server asked for something else» is never news about it — the new
 * prompt is usually its own next step. Discarding it left the frame in NEITHER
 * stack while the scene's lifetime hold still said it serves, and the shell's
 * `startFrameLive` watcher only re-enters on a rising edge, so nothing ever
 * stood it back up: park the opening during «ожидаем остальных», let the table
 * finish, and the deployment arrived to an unmounted scene that still owned the
 * pad — every press swallowed, recoverable only by reloading.
 *
 * Whatever was standing ON it still goes: those frames are a flow, and the flow
 * is what the server moved on from.
 */
export function discardWorkspacePark(): void {
  const root = workspaceStackState.parked[0];
  workspaceStackState.parked.splice(root !== undefined && root.anchor.type === 'phase' ? 1 : 0);
}

/** Full reset (game switch, shell unmount, test cleanup). */
export function resetWorkspaceStack(): void {
  workspaceStackState.frames.splice(0);
  workspaceStackState.parked.splice(0);
  boardYielded.splice(0);
}

// ── invariant 2: the anchor reconciler ──────────────────────────────────────

/**
 * Walk the stack from the ROOT outwards and truncate at the first frame whose
 * anchor no longer holds. Returns the surviving depth.
 *
 * OUTWARDS, not inwards, and truncating rather than filtering: a frame's
 * meaning depends on its ancestors (the colonies inside a card play are that
 * card's follow-up), so an inner frame cannot outlive an outer one. Dropping
 * only the dead frame would leave a step hanging under a parent that no longer
 * exists — which is the shape of the bug this module was written for.
 *
 * The same walk serves three jobs that used to be three mechanisms: healing a
 * claim whose flow ended, degrading an embedded step to standalone, and
 * deciding how much of a PERSISTED stack may come back after a reload.
 */
export function reconcileWorkspaceStack(isAnchorLive: (anchor: FrameAnchor) => boolean): number {
  const frames = workspaceStackState.frames;
  for (let depth = 0; depth < frames.length; depth++) {
    if (!isAnchorLive(frames[depth].anchor)) {
      truncateWorkspaceStack(depth);
      return depth;
    }
  }
  return frames.length;
}

/**
 * THE PRESENCE PROBE — the runtime detector for the entire «ownership without
 * presence» class, and the thing that makes a future regression LOUD.
 *
 * Invariant 1 makes the bad state unexpressible *within this module*: a frame
 * implies its host is mounted. But the DOM is downstream of a render, and a
 * surface can still fail to appear for reasons the stack cannot see — a `v-if`
 * inside a scene, a prompt-admission hold, a component that threw. Rather than
 * trust the invariant, this checks it against the only authority that matters:
 * what is actually on screen.
 *
 * Returns the kinds the stack believes are mounted and the DOM does not show.
 * A caller MUST debounce (the shell's detector confirms over consecutive passes
 * — a single frame gap is the legitimate claim-before-slot window of embed rule
 * 4, not a fault) and then truncate at the shallowest offender, because a frame
 * whose surface is gone cannot host the ones above it.
 *
 * `seen` is injected so this stays pure and unit-testable; the caller passes a
 * `document.querySelector`-backed predicate.
 */
export function probeWorkspacePresence(
  seen: (selector: string) => boolean,
): ReadonlyArray<WorkspaceFrameKind> {
  const missing: Array<WorkspaceFrameKind> = [];
  for (const frame of workspaceStackState.frames) {
    if (!seen(WORKSPACE_KINDS[frame.kind].rootSelector)) {
      missing.push(frame.kind);
    }
  }
  return missing;
}

/**
 * The depth that is still genuinely on screen — the shallowest absent frame
 * bounds it. Feeds the detector's truncation: a prompt may degrade from
 * embedded to standalone, but it may never strand.
 */
export function workspacePresentDepth(seen: (selector: string) => boolean): number {
  const frames = workspaceStackState.frames;
  for (let depth = 0; depth < frames.length; depth++) {
    if (!seen(WORKSPACE_KINDS[frames[depth].kind].rootSelector)) {
      return depth;
    }
  }
  return frames.length;
}

// ── persistence ─────────────────────────────────────────────────────────────

/**
 * Bumped whenever the frame shape changes. A stored stack from an older schema
 * is DROPPED, never migrated: the cost of being wrong is putting the player
 * inside a workspace that does not match their game, and a dropped stack simply
 * means the prompt opens its standalone surface — the pre-stack behaviour.
 */
export const WORKSPACE_STACK_SCHEMA = 1;

/**
 * `slot` and `sourceCard` are RUNTIME, not history: both are PUBLISHED BY THE
 * HOST on mount, so a restore that carried them would be asserting a fact about
 * a component that has not rendered yet. They come back as '' and the host
 * fills them, exactly as it does on a first open.
 */
export type SerializedWorkspaceFrame = Omit<WorkspaceFrame, 'slot' | 'sourceCard'>;

export type SerializedWorkspaceStack = {
  v: number,
  frames: ReadonlyArray<SerializedWorkspaceFrame>,
  parked: ReadonlyArray<SerializedWorkspaceFrame>,
};

/**
 * The STRUCTURAL half of the stack, ready for storage.
 *
 * Fields are listed explicitly rather than spread, so a new RUNTIME field
 * cannot silently start being persisted — that is how a restored workspace ends
 * up waiting on a beat nobody is going to play. The spec fences this.
 */
function serializeFrame(f: WorkspaceFrame): SerializedWorkspaceFrame {
  return {
    kind: f.kind,
    subject: f.subject,
    stage: f.stage,
    phase: f.phase,
    serves: [...f.serves],
    anchor: f.anchor,
    overlay: f.overlay,
  };
}

export function serializeWorkspaceStack(): SerializedWorkspaceStack {
  return {
    v: WORKSPACE_STACK_SCHEMA,
    frames: workspaceStackState.frames.map(serializeFrame),
    parked: workspaceStackState.parked.map(serializeFrame),
  };
}

/**
 * Rebuild from storage, keeping only what server truth still justifies.
 *
 * COLD by construction: `slot` starts empty and every phase past the commit
 * boundary is re-seated at `committed` rather than `executing`/`completing`. A
 * beat and a completion are things that were HAPPENING; after a reload nothing
 * is in flight, and a frame parked in a transient phase would swallow input
 * forever (`acceptsInput` is false there) while waiting for a signal whose
 * sender no longer exists.
 *
 * Returns the depth that survived — 0 means nothing came back, which is a
 * legitimate answer and simply restores the pre-stack behaviour.
 */
export function hydrateWorkspaceStack(
  stored: SerializedWorkspaceStack | undefined,
  isAnchorLive: (anchor: FrameAnchor) => boolean,
): number {
  resetWorkspaceStack();
  if (stored === undefined || stored.v !== WORKSPACE_STACK_SCHEMA) {
    return 0;
  }
  // A stack that was PARKED comes back parked: it was set aside on purpose, and
  // a reload is not the player changing their mind about that.
  const cold = stored.parked.length > 0 ? stored.parked : stored.frames;
  for (const frame of cold) {
    workspaceStackState.frames.push({
      kind: frame.kind,
      subject: frame.subject,
      stage: frame.stage,
      phase: isCommitted(frame.phase) ? 'committed' : frame.phase,
      serves: [...frame.serves],
      anchor: frame.anchor,
      overlay: frame.overlay,
      slot: '',
      sourceCard: '',
    });
  }
  const depth = reconcileWorkspaceStack(isAnchorLive);
  if (depth > 0 && stored.parked.length > 0) {
    collapseWorkspaceStack();
  }
  return depth;
}
