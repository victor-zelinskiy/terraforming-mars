/*
 * The gamepad FOCUS ENGINE (docs/GAMEPAD_SUPPORT_DESIGN.md §5) — a DOM-driving
 * spatial navigator over the SAME elements the mouse clicks.
 *
 * Central ideas (why this survives the fork's architecture):
 *  - Everything is computed from the RENDERED DOM (teleports + structural
 *    sharing + reset-epoch proof): the scope resolver picks the topmost
 *    layer, focusables are queried inside it, geometry decides direction.
 *  - There is NO parallel submit path: A = a real synthetic `click()` into
 *    the existing handlers (capture-phase guards like the placement lock
 *    fire unchanged); B mirrors each surface's OWN back affordance
 *    (Esc synthesis / close / minimize — per focusScopes.ts).
 *  - Focus is never lost: the focused element is re-resolved by DESCRIPTOR
 *    when Vue re-renders replace it, by nearest-rect when it's gone, by the
 *    scope seed as the last resort (§5.4).
 *  - Perf: DOM rect reads happen ONLY on navigation/validity events; the
 *    hot state is non-reactive module vars; the reactive `focusState` feeds
 *    exactly two tiny components (ring + hint bar).
 */

import {reactive} from 'vue';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {BackSpec, ResolvedScope, isElementVisible, resolveScope} from '@/client/gamepad/focusScopes';
import {NavRect, pickDirectional, pickNearest, rectCenter} from '@/client/gamepad/spatialNav';

export type RingVariant = 'default' | 'illegal' | 'card';
export type FocusKind = 'none' | 'action' | 'board-cell' | 'board-cell-available' | 'card' |
  /** A text field the pad can ENTER (A → real focus + caret + OSK attempt). */
  'text-input' |
  /** A text field currently being edited (B = done/blur; nav is inert). */
  'text-editing' |
  /** A disabled control — focusable for context, but A is not offered. */
  'disabled';

/** Reactive surface for the ring + hint bar (tiny components; everything else is module-local). */
export const focusState = reactive({
  scopeId: '',
  focusKind: 'none' as FocusKind,
  /** Focused element carries a data-hint tooltip (hint bar can say so). */
  focusHasHint: false,
  /** The focused element's exact A-verb (data-gp-verb, an i18n key) — the
   *  hint bar shows it instead of a generic «Select» (P19). */
  focusVerb: '',
  ring: {
    visible: false,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    variant: 'default' as RingVariant,
    /** Bumped on a denied action → the ring plays a short refusal shake. */
    deniedEpoch: 0,
  },
});

/**
 * Generic actionables. Native buttons dominate the premium surfaces;
 * inputs/selects cover legacy fallbacks; the curated div-classes are the
 * audited clickable <div>s (bottom-bar buttons, notification cards).
 */
const ACTIONABLE_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  '[tabindex="0"]',
  '[data-gp-focusable]',
  'input:not([type="hidden"])',
  'select',
  '.bottom-bar-btn',
  '.notification-card--expandable',
  '.bar-rail__viewing',
  '.compact-action',
  '.left-panel-card',
  '.colony-tile',
].join(', ');

/** Card hosts — lets Y (inspect) find the zoomable card for the focused control. */
const CARD_HOST_SELECTOR = [
  '.hand-card-item',
  '.played-card-item',
  '.card-selection__card',
  '.initial-draft-pick__card',
  '.draw-reveal__slot',
  '.start-game-flow__prelude-item',
  '.start-game-flow__corp-item',
  '.action-target-card',
].join(', ');

/** Known premium scroll containers (fallback when the focused chain has none). */
const SCROLL_CONTAINER_SELECTOR = [
  '.journal-feed',
  '.actions-board__master',
  '.effects-board__master',
  '.hand-board__body',
  '.played-board__body',
  '.vp-board__body',
  '.eg-results__body',
  '.contextual-choice__scroll',
  '.action-detail__scroll',
  '.card-selection',
  '.modal-input',
].join(', ');

/** The overlay ring for LB/RB cycling — PlayerHome bar buttons carry data-gp-overlay. */
const OVERLAY_RING: ReadonlyArray<string> = [
  'cards', 'actions', 'effects', 'played', 'victoryPoints',
  'milestones', 'standardProjects', 'awards', 'colonies', 'hydronetwork',
];

/** Pixels per full-deflection frame for right-stick scrolling. */
const SCROLL_STEP_PX = 24;

// --- non-reactive hot state ---------------------------------------------------
let focusedEl: HTMLElement | undefined;
let focusedDescriptor = '';
let lastRect: NavRect | undefined;
const scopeMemory = new Map<string, string>();

function rectOf(el: Element): NavRect {
  const r = el.getBoundingClientRect();
  return {left: r.left, top: r.top, width: r.width, height: r.height};
}

function isDisabledLike(el: HTMLElement): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
}

// --- focusable collection ------------------------------------------------------

function collectRoots(scope: ResolvedScope): Array<HTMLElement> {
  const roots: Array<HTMLElement> = [scope.rootEl];
  for (const sel of scope.def.coexistingRoots ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (isElementVisible(el)) {
        roots.push(el);
      }
    }
  }
  return roots;
}

function collectFocusables(scope: ResolvedScope): Array<HTMLElement> {
  const selector = scope.def.extraFocusables !== undefined ?
    `${ACTIONABLE_SELECTOR}, ${scope.def.extraFocusables.join(', ')}` :
    ACTIONABLE_SELECTOR;
  const seen = new Set<HTMLElement>();
  const out: Array<HTMLElement> = [];
  for (const root of collectRoots(scope)) {
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      if (seen.has(el) || el.closest('[data-gp-skip]') !== null || !isElementVisible(el)) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 4) {
        continue;
      }
      seen.add(el);
      out.push(el);
    }
  }
  return out;
}

// --- descriptors (focus persistence across re-renders, §5.4) -------------------

function baseDescriptor(el: HTMLElement): string {
  const key = el.getAttribute('data-gp-key');
  if (key !== null && key !== '') {
    return `k:${key}`;
  }
  const spaceId = el.getAttribute('data_space_id');
  if (spaceId !== null && spaceId !== '') {
    return `s:${spaceId}`;
  }
  const test = el.getAttribute('data-test');
  if (test !== null && test !== '') {
    return `t:${test}`;
  }
  const cls = Array.from(el.classList).filter((c) => !c.startsWith('gp-')).slice(0, 3).join('.');
  return `c:${el.tagName}.${cls}`;
}

function descriptorFor(el: HTMLElement, all: ReadonlyArray<HTMLElement>): string {
  const base = baseDescriptor(el);
  if (!base.startsWith('c:')) {
    return base;
  }
  // Class-based descriptors get an ordinal among same-shaped siblings.
  let ordinal = 0;
  for (const other of all) {
    if (other === el) {
      break;
    }
    if (baseDescriptor(other) === base) {
      ordinal++;
    }
  }
  return `${base}#${ordinal}`;
}

function resolveDescriptor(desc: string, all: ReadonlyArray<HTMLElement>): HTMLElement | undefined {
  if (desc === '') {
    return undefined;
  }
  if (!desc.startsWith('c:')) {
    return all.find((el) => baseDescriptor(el) === desc);
  }
  const [base, ordinalStr] = [desc.slice(0, desc.lastIndexOf('#')), desc.slice(desc.lastIndexOf('#') + 1)];
  const ordinal = Number(ordinalStr);
  let seen = 0;
  for (const el of all) {
    if (baseDescriptor(el) === base) {
      if (seen === ordinal) {
        return el;
      }
      seen++;
    }
  }
  return undefined;
}

// --- classification -------------------------------------------------------------

function classify(el: HTMLElement): {kind: FocusKind, variant: RingVariant} {
  // P19: text fields get the EDITING grammar (A = enter text, B = done).
  if (isTextInput(el)) {
    return {kind: document.activeElement === el ? 'text-editing' : 'text-input', variant: 'default'};
  }
  if (isDisabledLike(el)) {
    return {kind: 'disabled', variant: 'default'};
  }
  if (el.classList.contains('board-space')) {
    if (el.classList.contains('board-space--available')) {
      return {kind: 'board-cell-available', variant: 'default'};
    }
    const placing = document.body.classList.contains('placement-pending');
    return {kind: 'board-cell', variant: placing ? 'illegal' : 'default'};
  }
  if (el.closest(CARD_HOST_SELECTOR) !== null || el.querySelector(':is(.card-container, .pcard)') !== null) {
    return {kind: 'card', variant: 'card'};
  }
  return {kind: 'action', variant: 'default'};
}

// --- synthetic hover (§5.6) ------------------------------------------------------

function hoverHostFor(el: HTMLElement): HTMLElement | undefined {
  const host = el.closest<HTMLElement>('[data-hint]');
  return host !== null && host !== el ? host : undefined;
}

function dispatchHover(el: HTMLElement, entering: boolean, related: HTMLElement | undefined): void {
  const {x, y} = rectCenter(rectOf(el));
  const init = {bubbles: true, cancelable: true, clientX: x, clientY: y, relatedTarget: related ?? null};
  if (entering) {
    el.dispatchEvent(new MouseEvent('mouseover', init));
    el.dispatchEvent(new MouseEvent('mouseenter', {...init, bubbles: false}));
  } else {
    el.dispatchEvent(new MouseEvent('mouseout', init));
    el.dispatchEvent(new MouseEvent('mouseleave', {...init, bubbles: false}));
  }
}

// --- ring sync -------------------------------------------------------------------

function syncRing(): void {
  if (focusedEl === undefined || !focusedEl.isConnected || !isElementVisible(focusedEl)) {
    focusState.ring.visible = false;
    return;
  }
  const r = rectOf(focusedEl);
  lastRect = r;
  const {kind, variant} = classify(focusedEl);
  focusState.focusKind = kind;
  focusState.focusHasHint = focusedEl.closest('[data-hint]:not([data-hint=""])') !== null;
  focusState.focusVerb = focusedEl.getAttribute('data-gp-verb') ?? '';
  focusState.ring.visible = true;
  focusState.ring.left = r.left;
  focusState.ring.top = r.top;
  focusState.ring.width = r.width;
  focusState.ring.height = r.height;
  focusState.ring.variant = variant;
}

/** A refused action — the ring shakes, nothing else happens. */
function deny(): void {
  focusState.ring.deniedEpoch++;
}

// --- focus set/clear --------------------------------------------------------------

function applyFocus(el: HTMLElement, all: ReadonlyArray<HTMLElement>, opts: {scroll?: boolean} = {}): void {
  if (focusedEl === el) {
    syncRing();
    return;
  }
  const prev = focusedEl;
  if (prev !== undefined && prev.isConnected) {
    prev.classList.remove('gp-focus');
    hoverHostFor(prev)?.classList.remove('gp-focus');
    dispatchHover(prev, false, el);
  }
  focusedEl = el;
  focusedDescriptor = descriptorFor(el, all);
  el.classList.add('gp-focus');
  hoverHostFor(el)?.classList.add('gp-focus');
  dispatchHover(el, true, prev);
  if (opts.scroll !== false) {
    el.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }
  syncRing();
  if (focusState.scopeId !== '') {
    scopeMemory.set(focusState.scopeId, focusedDescriptor);
  }
}

/** Full reset — mode exit / screen change. Removes every synthetic residue. */
export function clearGamepadFocus(): void {
  if (focusedEl !== undefined && focusedEl.isConnected) {
    focusedEl.classList.remove('gp-focus');
    hoverHostFor(focusedEl)?.classList.remove('gp-focus');
    dispatchHover(focusedEl, false, undefined);
  }
  focusedEl = undefined;
  focusedDescriptor = '';
  lastRect = undefined;
  focusState.ring.visible = false;
  focusState.focusKind = 'none';
  focusState.scopeId = '';
}

// --- seeding / recovery -------------------------------------------------------------

function seedFor(scope: ResolvedScope, all: ReadonlyArray<HTMLElement>): HTMLElement | undefined {
  if (all.length === 0) {
    return undefined;
  }
  if (scope.def.id === 'placement' || scope.def.id === 'base') {
    // Board-centric scopes: land on the cell nearest the board center —
    // available cells first during placement (predictable landing, §5.7).
    const cells = all.filter((el) => el.classList.contains(scope.def.id === 'placement' ? 'board-space--available' : 'board-space'));
    const pool = cells.length > 0 ? cells : all;
    const board = document.querySelector('.board-cont, #shortkey-board');
    if (board !== null && cells.length > 0) {
      const c = rectCenter(rectOf(board));
      const idx = pickNearest(c, pool.map(rectOf));
      if (idx !== undefined) {
        return pool[idx];
      }
    }
    if (scope.def.id === 'placement' && cells.length > 0) {
      return cells[0];
    }
  }
  // Prefer a non-close control as the first landing.
  return all.find((el) => !/close/.test(el.className)) ?? all[0];
}

function ensureFocusValid(scope: ResolvedScope, all: ReadonlyArray<HTMLElement>): void {
  if (focusedEl !== undefined && focusedEl.isConnected && isElementVisible(focusedEl) && all.includes(focusedEl)) {
    return;
  }
  // 1. Descriptor re-resolution (same logical element re-rendered).
  const remembered = focusedDescriptor !== '' ? focusedDescriptor : scopeMemory.get(scope.def.id) ?? '';
  const byDescriptor = resolveDescriptor(remembered, all);
  if (byDescriptor !== undefined) {
    applyFocus(byDescriptor, all, {scroll: false});
    return;
  }
  // 2. Nearest to where focus last was (calm glide, no jump to a corner).
  if (lastRect !== undefined) {
    const idx = pickNearest(rectCenter(lastRect), all.map(rectOf));
    if (idx !== undefined) {
      applyFocus(all[idx], all, {scroll: false});
      return;
    }
  }
  // 3. Scope seed.
  const seed = seedFor(scope, all);
  if (seed !== undefined) {
    applyFocus(seed, all);
  } else {
    focusedEl = undefined;
    focusState.ring.visible = false;
  }
}

function onScopeChanged(scope: ResolvedScope): void {
  focusState.scopeId = scope.def.id;
  // Entering a scope re-seats focus: remembered spot first, else the seed.
  focusedDescriptor = scopeMemory.get(scope.def.id) ?? '';
  focusedEl = undefined;
}

// --- movement / actions ----------------------------------------------------------------

function moveFocus(dir: NavDirection, scope: ResolvedScope): void {
  const all = collectFocusables(scope);
  if (all.length === 0) {
    return;
  }
  ensureFocusValid(scope, all);
  if (focusedEl === undefined) {
    return;
  }
  const from = rectOf(focusedEl);
  const candidates = all.filter((el) => el !== focusedEl);
  const idx = pickDirectional(from, candidates.map(rectOf), dir);
  if (idx === undefined) {
    return; // Bounded — the edge of the surface is felt, no wrap.
  }
  applyFocus(candidates[idx], all);
}

function activate(): void {
  if (focusedEl === undefined || !focusedEl.isConnected) {
    return;
  }
  if (focusState.ring.variant === 'illegal' || isDisabledLike(focusedEl)) {
    deny();
    return;
  }
  // P19: A on a text field ENTERS it for real — DOM focus + caret at the
  // end + a virtual-keyboard attempt (never a fake visual-only focus).
  if (isTextInput(focusedEl)) {
    enterEditing(focusedEl as HTMLInputElement | HTMLTextAreaElement);
    return;
  }
  focusedEl.click();
  scheduleSync();
}

// --- P19: text-input editing mode -------------------------------------------------
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set(['text', 'search', 'number', 'email', 'password', 'url', 'tel']);

function isTextInput(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement) {
    return true;
  }
  return el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type);
}

/** Is a REAL text edit in progress (DOM focus sits in a text field)? */
function isEditingActive(): boolean {
  const ae = document.activeElement;
  return ae instanceof HTMLElement && isTextInput(ae);
}

function enterEditing(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.focus();
  try {
    const len = el.value.length;
    el.setSelectionRange(len, len);
  } catch {
    // number inputs throw on setSelectionRange — the focus itself is enough.
  }
  // Chromium's VirtualKeyboard API (Steam Deck / touch / TV shells that
  // support it) — a best-effort show; platforms without it no-op.
  try {
    (navigator as {virtualKeyboard?: {show?: () => void}}).virtualKeyboard?.show?.();
  } catch {
    // Not available — the platform OSK (Steam+X etc.) still works.
  }
  syncRing(); // the kind flips to text-editing → the hint bar says B = Done
}

function exitEditing(): void {
  const ae = document.activeElement;
  if (ae instanceof HTMLElement) {
    ae.blur();
  }
  syncRing(); // the ring stays on the field; the kind flips back
}

function dispatchSecondary(): void {
  if (focusedEl === undefined || !focusedEl.isConnected) {
    return;
  }
  const {x, y} = rectCenter(rectOf(focusedEl));
  focusedEl.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true, clientX: x, clientY: y}));
  scheduleSync();
}

function inspectCard(): void {
  if (focusedEl === undefined) {
    return;
  }
  const host = focusedEl.closest<HTMLElement>(CARD_HOST_SELECTOR) ?? focusedEl;
  const card = host.querySelector<HTMLElement>(':is(.card-container, .pcard)') ??
    ((host.classList.contains('card-container') || host.classList.contains('pcard')) ? host : null);
  if (card !== null) {
    card.click();
    scheduleSync();
  } else {
    deny();
  }
}

function clickFirstVisible(selectors: ReadonlyArray<string>, rootEl: HTMLElement): boolean {
  for (const sel of selectors) {
    const inRoot = rootEl.querySelector<HTMLElement>(sel);
    const el = inRoot !== null && isElementVisible(inRoot) ? inRoot :
      Array.from(document.querySelectorAll<HTMLElement>(sel)).find(isElementVisible);
    if (el !== undefined && el !== null) {
      el.click();
      return true;
    }
  }
  return false;
}

function dispatchEscape(): void {
  const target = document.body ?? document;
  target.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', code: 'Escape', bubbles: true, cancelable: true}));
}

function doBack(scope: ResolvedScope): void {
  const back: BackSpec = scope.def.back;
  switch (back.kind) {
  case 'dialog-close': {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (dialog !== null && typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dispatchEscape();
    }
    break;
  }
  case 'escape':
    dispatchEscape();
    break;
  case 'click':
    if (!clickFirstVisible(back.selectors, scope.rootEl)) {
      dispatchEscape();
    }
    break;
  case 'none':
    deny();
    break;
  }
  scheduleSync();
}

// --- scrolling -------------------------------------------------------------------------

function isScrollable(el: HTMLElement): boolean {
  if (el.scrollHeight <= el.clientHeight + 4 && el.scrollWidth <= el.clientWidth + 4) {
    return false;
  }
  const style = getComputedStyle(el);
  return /(auto|scroll)/.test(style.overflowY + style.overflowX);
}

function scrollTargetFor(scope: ResolvedScope): HTMLElement | undefined {
  let node: HTMLElement | null = focusedEl ?? null;
  while (node !== null && node !== document.body) {
    if (isScrollable(node)) {
      return node;
    }
    node = node.parentElement;
  }
  for (const el of scope.rootEl.querySelectorAll<HTMLElement>(SCROLL_CONTAINER_SELECTOR)) {
    if (isElementVisible(el) && isScrollable(el)) {
      return el;
    }
  }
  return isScrollable(scope.rootEl) ? scope.rootEl : undefined;
}

function scrollBy(dx: number, dy: number, scope: ResolvedScope): void {
  const target = scrollTargetFor(scope);
  if (target === undefined) {
    return;
  }
  target.scrollTop += dy * SCROLL_STEP_PX;
  target.scrollLeft += dx * SCROLL_STEP_PX;
  syncRing();
}

// --- overlay ring (LB/RB) + View/L3 ------------------------------------------------------

function overlayButtons(): Array<{id: string, el: HTMLElement}> {
  const out: Array<{id: string, el: HTMLElement}> = [];
  for (const id of OVERLAY_RING) {
    const el = document.querySelector<HTMLElement>(`[data-gp-overlay="${id}"]`);
    if (el !== null && isElementVisible(el)) {
      out.push({id, el});
    }
  }
  return out;
}

function cycleOverlay(step: 1 | -1): void {
  const ring = overlayButtons();
  if (ring.length === 0) {
    // Generic TABLIST fallback (P11 — endgame formalization): a
    // fallback-scope surface exposing a `role="tablist"` (the endgame
    // results tabs) cycles its tabs on LB/RB — the standard pad
    // convention for tabbed screens. Purely additive: the in-game
    // overlay ring above always takes precedence.
    cycleScopeTablist(step);
    return;
  }
  const activeIdx = ring.findIndex((e) => e.el.classList.contains('bottom-bar-btn--active'));
  const next = activeIdx === -1 ?
    (step === 1 ? ring[0] : ring[ring.length - 1]) :
    ring[(activeIdx + step + ring.length) % ring.length];
  next.el.click();
  scheduleSync();
}

/** LB/RB cycles the current scope's `role="tab"` buttons (aria-selected aware). */
function cycleScopeTablist(step: 1 | -1): void {
  const scope = resolveScope();
  const root: HTMLElement | Document = scope?.rootEl ?? document;
  const list = root.querySelector('[role="tablist"]');
  if (!(list instanceof HTMLElement) || !isElementVisible(list)) {
    return;
  }
  const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter(isElementVisible);
  if (tabs.length === 0) {
    return;
  }
  const activeIdx = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  const next = activeIdx === -1 ?
    (step === 1 ? tabs[0] : tabs[tabs.length - 1]) :
    tabs[(activeIdx + step + tabs.length) % tabs.length];
  next.click();
  scheduleSync();
}

function toggleJournal(): void {
  const el = document.querySelector<HTMLElement>('[data-gp-overlay="log"]');
  if (el !== null && isElementVisible(el)) {
    el.click();
    scheduleSync();
  }
}

/** L3: snap focus board ↔ chrome (base scopes only). */
function snapZone(scope: ResolvedScope): void {
  if (scope.def.id !== 'base' && scope.def.id !== 'placement') {
    return;
  }
  const all = collectFocusables(scope);
  const onBoard = focusedEl?.classList.contains('board-space') === true;
  const pool = all.filter((el) => el.classList.contains('board-space') !== onBoard);
  if (pool.length === 0) {
    return;
  }
  if (onBoard) {
    applyFocus(pool[0], all);
  } else {
    const board = document.querySelector('.board-cont, #shortkey-board');
    const center = board !== null ? rectCenter(rectOf(board)) : {x: window.innerWidth / 2, y: window.innerHeight / 2};
    const idx = pickNearest(center, pool.map(rectOf));
    applyFocus(pool[idx ?? 0], all);
  }
}

// --- fast-adjust (LT/RT on steppers, §5.5) -------------------------------------------------

const STEPPER_CLUSTER_SELECTOR = '.modal-input__stepper, .modal-input__dist-row, .payment-v2-row';

function fastAdjust(direction: -1 | 1): void {
  const cluster = focusedEl?.closest<HTMLElement>(STEPPER_CLUSTER_SELECTOR);
  if (cluster === undefined || cluster === null) {
    deny();
    return;
  }
  const btn = cluster.querySelector<HTMLElement>(direction === 1 ?
    '.payment-v2-step--plus, [data-test^="modern-amount-inc"], [data-test^="modern-resources-inc"], [data-test^="modern-ptl-inc"]' :
    '.payment-v2-step--minus, [data-test^="modern-amount-dec"], [data-test^="modern-resources-dec"], [data-test^="modern-ptl-dec"]');
  if (btn === null || isDisabledLike(btn)) {
    deny();
    return;
  }
  for (let i = 0; i < 5; i++) {
    if (isDisabledLike(btn)) {
      break;
    }
    btn.click();
  }
  scheduleSync();
}

// --- validity tick + intent router ----------------------------------------------------------

let syncScheduled = false;

/** Re-measure focus + ring on the next frame (after DOM settles post-action). */
function scheduleSync(): void {
  if (syncScheduled || typeof window === 'undefined') {
    return;
  }
  syncScheduled = true;
  window.requestAnimationFrame(() => {
    syncScheduled = false;
    gamepadFocusTick();
  });
}

/**
 * The light validity tick (400 ms while in gamepad mode + post-action):
 * re-resolves a detached focus, re-glues the ring after server-driven
 * re-renders / structural-sharing patches. isConnected + one rect read.
 */
export function gamepadFocusTick(): void {
  const scope = resolveScope();
  if (scope === undefined) {
    focusState.ring.visible = false;
    return;
  }
  if (scope.def.consoleOwned === true) {
    // A console-native layer owns the pad: the DOM engine draws NOTHING and
    // leaves no residue there (see ScopeDef.consoleOwned). A FULL reset, not
    // just hiding the ring — a `gp-focus` class / synthetic hover left on a
    // button under the console surface would keep it lit.
    clearGamepadFocus();
    return;
  }
  if (scope.def.id !== focusState.scopeId) {
    onScopeChanged(scope);
    const all = collectFocusables(scope);
    ensureFocusValid(scope, all);
    return;
  }
  if (focusedEl === undefined || !focusedEl.isConnected || !isElementVisible(focusedEl)) {
    const all = collectFocusables(scope);
    ensureFocusValid(scope, all);
    return;
  }
  syncRing();
}

/** The single entry point — GamepadLayer subscribes gamepadCore intents to this. */
export function handleGamepadIntent(intent: GamepadIntent): void {
  // P19: while a REAL text edit is in progress the OSK/keyboard owns the
  // keys — pad navigation is inert, B closes the edit (blur) and stays on
  // the field, A never re-clicks mid-typing. Everything else no-ops.
  if (isEditingActive()) {
    if (intent.kind === 'press' && intent.button === 'back') {
      exitEditing();
    }
    return;
  }
  const scope = resolveScope();
  if (scope === undefined) {
    return;
  }
  if (scope.def.consoleOwned === true) {
    // The console shell handles this layer's pad itself (its handler runs
    // first and claims the intent); the DOM engine must not ALSO act on it —
    // no focus move, no synthetic A-click, no B. Stay fully inert.
    return;
  }
  if (scope.def.id !== focusState.scopeId) {
    onScopeChanged(scope);
  }
  switch (intent.kind) {
  case 'nav':
    // Fullscreen card browser: ←/→ PAGE cards through its own audited
    // window-keydown handler (animating guard included); ↑/↓ still move
    // focus among the #actions-slot buttons.
    if (scope.def.id === 'dialog' && (intent.dir === 'left' || intent.dir === 'right') &&
        scope.rootEl.querySelector('.card-zoom-nav') !== null) {
      const key = intent.dir === 'left' ? 'ArrowLeft' : 'ArrowRight';
      (document.body ?? document).dispatchEvent(
        new KeyboardEvent('keydown', {key, code: key, bubbles: true, cancelable: true}));
      scheduleSync();
      break;
    }
    moveFocus(intent.dir, scope);
    break;
  case 'scroll':
    scrollBy(intent.dx, intent.dy, scope);
    break;
  case 'press':
    onPress(intent.button, scope);
    break;
  case 'release':
    break;
  }
}

function onPress(button: SemanticButton, scope: ResolvedScope): void {
  // Any press ensures focus exists so A/X/Y always have a target.
  if (button === 'confirm' || button === 'secondary' || button === 'inspect') {
    const all = collectFocusables(scope);
    ensureFocusValid(scope, all);
  }
  switch (button) {
  case 'confirm':
    activate();
    break;
  case 'back':
    doBack(scope);
    break;
  case 'secondary':
    dispatchSecondary();
    break;
  case 'inspect':
    inspectCard();
    break;
  case 'bumperL':
    cycleOverlay(-1);
    break;
  case 'bumperR':
    cycleOverlay(1);
    break;
  case 'view':
    toggleJournal();
    break;
  case 'stickL':
    snapZone(scope);
    break;
  case 'triggerL':
    fastAdjust(-1);
    break;
  case 'triggerR':
    fastAdjust(1);
    break;
  case 'menu':
    // Handled by GamepadLayer (legend overlay) via the same intent stream.
    break;
  case 'stickR':
    break;
  }
}
