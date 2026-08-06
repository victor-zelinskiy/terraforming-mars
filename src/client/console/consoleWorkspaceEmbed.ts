/*
 * consoleWorkspaceEmbed — AN EMBEDDED STEP SURFACE inside a live workspace.
 *
 * ── THE CONTRACT THIS MODULE CARRIES (the workspace architecture's whole
 *    advantage — guaranteed here, never re-invented per case) ─────────────
 *
 * A workspace may host a FULL EXISTING SCREEN as one of its steps: the Game
 * Start Workspace hosts «Карты в руке» while a prelude's effect is «play a
 * card from your hand». The rules that make that composable — so that
 * TOMORROW's case (the card play opening the colonies rail, the colonies
 * rail opening a target pick, …) sits down the same way with no new
 * machinery:
 *
 *  1. A STEP SURFACE IS HOST-AGNOSTIC. It renders CONTENT only; the shell
 *     chrome — frame plate, workspace header, `con-ws` rail marker — belongs
 *     to whoever hosts it. One `embedded` prop strips the shell
 *     (`ConsoleHandSection`, `ConsolePlayCardConfirm`, `ConsoleTaskHost`,
 *     `ConsoleRevealOverlay` all already speak it); the logic, the module
 *     state, the input path and the captures are NOT touched by embedding.
 *  2. ONE INSTANCE, TELEPORTED. The shell mounts each surface once and
 *     `<Teleport>`s it into the host's zone — never a second copy (a copy
 *     forks input and loses captures).
 *  3. SLOTS COMPOSE — this is what makes nesting free. Every surface that
 *     can host a deeper step publishes its OWN `[data-embed-slot]` zone even
 *     while it is itself embedded: the hand publishes `hand-play` for the
 *     composer whether it stands alone or inside the start; the composer's
 *     own outcome zone works the same one level deeper. Arbitrary depth is
 *     the teleport chain, not a feature anyone implements.
 *  4. OWNERSHIP ≠ READINESS. The HOST publishes its zone's selector from a
 *     `flush: 'post'` watcher (the element must genuinely stand — a teleport
 *     whose target does not resolve drops its content to `body`, i.e. a
 *     full-screen surface OUTSIDE the workspace), and retracts it before the
 *     zone unmounts. The claimant renders NOWHERE for the one frame between
 *     claim and slot — never in its standalone band first.
 *  5. THE CRUMB IS THE HOST'S. Root and subject come from the outermost
 *     workspace; the embedded surface hands its stage name UP
 *     (`setWorkspaceStageName` / `setWorkspaceOutcomePhase`) and never draws
 *     its own header. Browse-layer chrome (filters, counters, toolbars)
 *     HIDES past the descent — on every level, in every host.
 *  6. THE CLAIM IS STRUCTURAL and derived from server truth (which prompt,
 *     which workspace serves) — never a card name or title match. It holds
 *     across the commit round trip (`committing`): between a submit and the
 *     result landing, `waitingFor` names nothing, and a claim that lapsed
 *     there would tear the surface out from under a card still in the air.
 *
 * Sibling mechanisms, one family:
 *   · `consoleWorkspaceStage`   — the composer descending INTO a surface's
 *     own stage zone (pre-commit depth);
 *   · `consoleWorkspaceOutcome` — post-commit follow-ups (reveal / drawn
 *     cards) claimed into a workspace;
 *   · THIS — a whole EXISTING SCREEN hosted as a workspace step.
 *
 * First client: host `'start'` × surface `'hand'` («Эпатажный спонсор»).
 * Both unions are deliberately CLOSED: a new host/surface is a conscious
 * addition that must bring a zone, a crumb subject and a claim — never a
 * string that silently starts matching.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

/** Workspaces that can host an embedded step surface. */
export type WorkspaceEmbedHost = 'start' | 'hand' | 'card-actions';

/** Full screens that can serve as an embedded step. */
export type WorkspaceEmbedSurface = 'hand' | 'colonies';

export const workspaceEmbedState = reactive({
  /** The hosting workspace, or undefined when nothing is embedded. */
  host: undefined as WorkspaceEmbedHost | undefined,
  /** The screen being hosted as a step. */
  surface: undefined as WorkspaceEmbedSurface | undefined,
  /** The host zone's selector — '' until the element genuinely stands
   *  (published `flush: 'post'`, retracted before unmount — rule 4). */
  slot: '',
  /**
   * The card whose effect caused the step (the crumb's subject). Captured by
   * the host at the moment it plays that card — the server's prompt carries
   * no attribution. '' degrades to a generic crumb, never to a broken flow.
   */
  source: '' as CardName | '',
  /**
   * The step's commit is on the wire (rule 6): the claim must survive the
   * prompt gap between the submit and the result physically landing.
   */
  committing: false,
});

/**
 * Mirror the shell's claim verdict. The SHELL decides (the admission signals
 * live there — one computed, one watcher); plain-TS consumers (the leak
 * detector, the scenes, input gates) read the mirror. Never derive the claim
 * a second time at a call site.
 */
export function setWorkspaceEmbed(host: WorkspaceEmbedHost, surface: WorkspaceEmbedSurface | undefined): void {
  if (surface === undefined) {
    if (workspaceEmbedState.host === host) {
      workspaceEmbedState.host = undefined;
      workspaceEmbedState.surface = undefined;
      workspaceEmbedState.committing = false;
    }
    return;
  }
  workspaceEmbedState.host = host;
  workspaceEmbedState.surface = surface;
}

/** Is `surface` currently hosted (by `host`, when given)? */
export function workspaceEmbedActive(surface: WorkspaceEmbedSurface, host?: WorkspaceEmbedHost): boolean {
  return workspaceEmbedState.surface === surface &&
    (host === undefined || workspaceEmbedState.host === host);
}

/** The host zone is standing / gone (rule 4 — `flush: 'post'` only). */
export function setWorkspaceEmbedSlot(selector: string): void {
  workspaceEmbedState.slot = selector;
}

/** The teleport target, or undefined while the zone does not exist yet. */
export function workspaceEmbedSlot(): string | undefined {
  return workspaceEmbedState.slot === '' ? undefined : workspaceEmbedState.slot;
}

/** The host records WHICH card caused the step as it plays it. */
export function noteWorkspaceEmbedSource(card: CardName): void {
  workspaceEmbedState.source = card;
}

export function workspaceEmbedSource(): CardName | '' {
  return workspaceEmbedState.source;
}

/** The embedded step's commit is on the wire (rule 6). */
export function markWorkspaceEmbedCommitting(): void {
  workspaceEmbedState.committing = true;
}

export function workspaceEmbedCommitting(): boolean {
  return workspaceEmbedState.committing;
}

/** A fresh flow (new deal / workspace release) — forget everything. */
export function resetWorkspaceEmbed(): void {
  workspaceEmbedState.host = undefined;
  workspaceEmbedState.surface = undefined;
  workspaceEmbedState.slot = '';
  workspaceEmbedState.source = '';
  workspaceEmbedState.committing = false;
}
