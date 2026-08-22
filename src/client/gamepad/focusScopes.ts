/*
 * Focus SCOPES — "which layer owns the controller right now"
 * (docs/GAMEPAD_SUPPORT_DESIGN.md §5.1).
 *
 * An ordered, highest-priority-first list of scope definitions resolved
 * against the RENDERED DOM (never the Vue tree — teleports and structural
 * sharing make the DOM the only truth). The order encodes the audited
 * z-stack once: native <dialog> top layer → app-level modals → the lobby.
 * (The desktop in-game scopes — mandatory modal, board placement, the
 * activeOverlay surfaces, the PlayerHome base chrome — went with their DOM
 * in the desktop-removal waves; the console shell owns those layers.)
 *
 * B-button ("back") semantics are declared per scope and MIRROR each
 * surface's own affordances — Esc where the surface has an Esc handler,
 * its close/cancel/minimize button otherwise; a non-dismissable prompt is
 * 'none' (never invent a close). Adding a NEW modal = one entry here (the
 * generic `dialog[open]` def is the safety net for native dialogs).
 *
 * Resolution runs on INPUT EVENTS only (never per frame) — a handful of
 * querySelector calls per button press.
 */

export type BackSpec =
  /** Synthesize a window Escape keydown (drives the audited Esc handlers). */
  | {kind: 'escape'}
  /** Click the first visible match (searched inside the scope root, then document-wide). */
  | {kind: 'click', selectors: ReadonlyArray<string>}
  /** Call .close() on the open native dialog (synthetic Esc can't cancel a native dialog). */
  | {kind: 'dialog-close'}
  /** Non-dismissable — B is a no-op here. */
  | {kind: 'none'};

export type ScopeDef = {
  id: string,
  /** Selector for the scope root; first VISIBLE match wins. */
  root: string,
  back: BackSpec,
  /** Extra focusable selectors collected WITHIN the root (besides the generic actionables). */
  extraFocusables?: ReadonlyArray<string>,
  /** Also collect candidates from these document-level roots (pills, notifications). */
  coexistingRoots?: ReadonlyArray<string>,
  /**
   * CONSOLE-NATIVE surface: the console shell owns this layer's pad
   * completely (its own cursor, its own command bar), so the DOM focus
   * engine must be fully INERT here — no focusable collection, no ring, no
   * B/A synthesis. It still matters that the scope RESOLVES (rather than
   * being excluded by selector): resolving it CLAIMS the layer, so the
   * engine can't fall through and start ringing a surface UNDERNEATH.
   */
  consoleOwned?: boolean,
};

/** Highest priority first. */
export const SCOPE_DEFS: ReadonlyArray<ScopeDef> = [
  // -1. The BLOCKING desktop-update cover (P15) — an update-required wall
  //     above everything; its buttons (install / retry / download) are the
  //     only actionables and there is nothing to go back to.
  {id: 'desktopUpdate', root: '.desktop-update--cover', back: {kind: 'none'}},

  // 0. The premium loading curtain (P10) — covers EVERYTHING while up; its
  //    only actionables are the Retry / Restore-fullscreen buttons.
  {id: 'loadingScreen', root: '.con-load', back: {kind: 'none'}},

  // 0.5 The CONSOLE fullscreen card inspector — console-native, so the DOM
  //     engine stays INERT (ConsoleShell owns the pad: LB/RB browse, A act,
  //     B close; `.con-zoom__bar` inside the dialog IS the button truth).
  //     It MUST be listed (above the generic `dialog` net) rather than
  //     excluded by selector: matching CLAIMS the layer, so the engine can
  //     neither ring the viewer's own buttons nor fall through and ring a
  //     surface underneath it. Without this the generic net grabbed it and
  //     drew a focus frame + «A» chip over the actions bar — and because
  //     `isElementVisible` only checks client RECTS (not opacity), it did so
  //     even while the bar was held at `opacity: 0` by `--flight`: a floating
  //     outline with an A and no bar behind it, flashing on open/close.
  {id: 'consoleZoom', root: 'dialog.con-zoom[open]', back: {kind: 'none'}, consoleOwned: true},

  // 1. Native top layer (CardZoomModal, ConfirmDialog, the quit confirm).
  {id: 'dialog', root: 'dialog[open]', back: {kind: 'dialog-close'}},

  // 2. App-level modals (audited roots), in their own z order. (The desktop
  //    overlay/mandatory-modal scopes were removed with their DOM in the
  //    desktop-removal waves — the console shell owns those layers natively.)
  {id: 'effectDetail', root: '.effect-detail-modal', back: {kind: 'escape'}},
  {id: 'resourceDetail', root: '.additional-resource-detail', back: {kind: 'escape'}},
  {id: 'rematchCreated', root: '.rematch-modal--created', back: {kind: 'click', selectors: ['.rematch-modal__min']}},
  {id: 'rematchPrompt', root: '.rematch-modal', back: {kind: 'click', selectors: ['.rematch-modal__min']}},
  // Lifecycle modals/screens (console full-lifecycle iteration).
  {id: 'finalReveal', root: '.fsr', back: {kind: 'escape'}},
  {id: 'endgame', root: '.eg-results', back: {kind: 'click', selectors: ['.eg-results__ctl--min']}},

  // 3. Lifecycle SCREENS (outside the game shell): the lobby stays
  //    pad-drivable via this engine; hints come from hintModel per scope id.
  {id: 'lobby', root: '#game-home', back: {kind: 'none'}},
];

/** Is this element actually rendered (cheap check, no layout thrash beyond rects)? */
export function isElementVisible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

export type ResolvedScope = {
  def: ScopeDef,
  rootEl: HTMLElement,
};

/**
 * Resolve the active scope from the rendered DOM: the first def whose root
 * has a visible match. Returns undefined only when nothing (not even the
 * base surface) is mounted — e.g. outside the game screen.
 */
export function resolveScope(doc: Document = document): ResolvedScope | undefined {
  for (const def of SCOPE_DEFS) {
    const candidates = doc.querySelectorAll<HTMLElement>(def.root);
    for (const el of candidates) {
      if (isElementVisible(el)) {
        return {def, rootEl: el};
      }
    }
  }
  return undefined;
}
