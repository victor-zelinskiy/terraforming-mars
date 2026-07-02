/*
 * Focus SCOPES — "which layer owns the controller right now"
 * (GAMEPAD_SUPPORT_DESIGN.md §5.1).
 *
 * An ordered, highest-priority-first list of scope definitions resolved
 * against the RENDERED DOM (never the Vue tree — teleports and structural
 * sharing make the DOM the only truth). The order encodes the audited
 * z-stack once: native <dialog> top layer → mandatory modal → app-level
 * modals → board placement → the activeOverlay surface → the base chrome.
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
};

/**
 * Floating chrome that stays reachable alongside the LOW scopes (never
 * alongside dialogs/modals, which trap focus by design): awaiting-prompt
 * pills + notification cards.
 */
const COEXIST: ReadonlyArray<string> = [
  '.mandatory-input-modal-pill--visible',
  '.placement-banner',
  '.hand-select-pill',
  '.colonies-overlay-pill',
  '.eg-pill',
  '.rematch-pill',
  '.initial-draft-pills',
  '.notification-layer',
];

/** Highest priority first. */
export const SCOPE_DEFS: ReadonlyArray<ScopeDef> = [
  // 1. Native top layer (CardZoomModal, ConfirmDialog).
  {id: 'dialog', root: 'dialog[open]', back: {kind: 'dialog-close'}},

  // 2. The mandatory-input modal (payment, option pickers, card selection,
  //    play/action confirm, draft steps…). B = minimize where allowed —
  //    mirroring its own affordance; a non-minimizable modal keeps its own
  //    Cancel button as an ordinary focusable.
  {
    id: 'mandatoryModal',
    root: '.mandatory-input-modal:not(.mandatory-input-modal--minimized):not(.mandatory-input-modal--picker-mode):not(.mandatory-input-modal--suppressed)',
    back: {kind: 'click', selectors: ['.mandatory-input-modal__minimize-btn', '.play-confirm__cancel', '.action-confirm__cancel', '.colony-trade-pay__cancel']},
  },

  // 3. App-level modals (audited roots), in their own z order.
  {id: 'drawReveal', root: '.draw-reveal', back: {kind: 'none'}},
  {id: 'revealViewer', root: '.reveal-viewer__card', back: {kind: 'escape'}},
  {id: 'revealResult', root: '.reveal-overlay__card', back: {kind: 'click', selectors: ['[data-test="reveal-ok"]']}},
  {id: 'effectDetail', root: '.effect-detail-modal', back: {kind: 'escape'}},
  {id: 'resourceDetail', root: '.additional-resource-detail', back: {kind: 'escape'}},
  {id: 'rematchCreated', root: '.rematch-modal--created', back: {kind: 'click', selectors: ['.rematch-modal__min']}},
  {id: 'rematchPrompt', root: '.rematch-modal', back: {kind: 'click', selectors: ['.rematch-modal__min']}},
  {id: 'placementDetails', root: '.placement-details', back: {kind: 'click', selectors: ['.placement-details__btn--close']}},
  {id: 'startGameFlow', root: '.start-game-flow', back: {kind: 'click', selectors: ['.start-game-flow__minimize-btn']}},
  {id: 'colonies', root: '.colonies-overlay', back: {kind: 'click', selectors: ['.colonies-overlay__close', '.colonies-overlay__cancel', '.colonies-overlay__minimize']}},
  {id: 'endgame', root: '.eg-results', back: {kind: 'click', selectors: ['.eg-results__ctl--min']}},

  // 4. Board placement picker (SelectSpace active). The whole board is
  //    navigable (illegal cells stay inspectable — one unavailability
  //    system); A commits only on --available cells (their own onclick).
  {
    id: 'placement',
    root: 'body.placement-pending #player-home',
    back: {kind: 'escape'},
    extraFocusables: ['.board-space'],
    coexistingRoots: COEXIST,
  },

  // 5. The activeOverlay surfaces + the journal side panel.
  {id: 'overlay-hand', root: '.hand-board-overlay', back: {kind: 'escape'}, coexistingRoots: COEXIST},
  {id: 'overlay-played', root: '.played-board-overlay', back: {kind: 'escape'}, coexistingRoots: COEXIST},
  {id: 'overlay-actions', root: '.actions-board-overlay', back: {kind: 'escape'}, coexistingRoots: COEXIST},
  {id: 'overlay-effects', root: '.effects-board-overlay', back: {kind: 'escape'}, coexistingRoots: COEXIST},
  {id: 'overlay-vp', root: '.vp-board-overlay', back: {kind: 'escape'}, coexistingRoots: COEXIST},
  {id: 'overlay-hydro', root: '.hydronetwork-overlay', back: {kind: 'escape'}, coexistingRoots: COEXIST},
  // Milestones / Awards / Standard-Projects dropdowns have NO Esc handler —
  // B clicks their close button (audit §2.1).
  {
    id: 'overlay-dropdown',
    root: '.top-bar-dropdown',
    back: {kind: 'click', selectors: ['.milestones-overlay-close', '.awards-overlay-close', '.std-projects-overlay-close']},
    coexistingRoots: COEXIST,
  },

  // 6. Base chrome: bars, left panel, pills, board (hover inspection), journal.
  {
    id: 'base',
    root: '#player-home',
    back: {kind: 'escape'},
    extraFocusables: ['.board-space'],
    coexistingRoots: [...COEXIST, '.journal-panel'],
  },
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
