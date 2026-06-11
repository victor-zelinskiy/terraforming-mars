import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Tag} from '../cards/Tag';
import {Message} from '../logs/Message';
import {PlayerInputModel} from './PlayerInputModel';

/**
 * Read-only PREVIEW of an activatable blue-card / corporation action, fetched
 * by the client when the action confirmation modal opens (GET
 * `/api/action-preview`). It lets the player make EVERY required choice INSIDE
 * the confirmation modal — before the final submit — instead of discovering the
 * choices in follow-up modals AFTER confirming (the legacy flow).
 *
 * Built by `src/server/models/actionPreview.ts`:
 *   - DECLARATIVE action cards (`actionBehavior` set) auto-derive their preview
 *     by mirroring `Executor.execute` over the behavior tree (READ-ONLY — never
 *     calling `Executor.execute`/`canExecute`, which mutate `card.warnings`).
 *   - BESPOKE action cards (custom `action()`) supply it via the co-located
 *     `ICard.actionPreview?(player)` hook (the analog of `actionUnavailableReason`).
 *   - Cards that resist a static description (Viron copies another action, etc.)
 *     fall to `kind: 'dynamic'` — a single confirm-only branch; the legacy
 *     follow-up routing handles whatever the action produces.
 *
 * NOTHING here mutates game state. The shape deliberately reuses the existing
 * `PlayerInputModel` union for choice steps, so the client renders each step
 * with the SAME premium `Modern*` components the live follow-up flow uses.
 */
export type ActionPreview = {
  card: CardName;
  isCorporation: boolean;
  /** Current resource on the source card (microbes/animals/floaters/…) — the count chip. */
  cardResource?: {type: CardResource, count: number};
  kind: 'declarative' | 'bespoke' | 'dynamic';
  branches: ReadonlyArray<ActionPreviewBranch>;
};

/**
 * One at-a-glance EFFECT of a branch — a cost the player pays or a gain they get,
 * rendered as a premium chip (icon + `current → resulting` + unit). This is the
 * "maximum information before submit" layer: the player sees exactly what changes
 * and the resulting value BEFORE confirming. Display-only (the interactive
 * choices live in `steps`).
 */
export type ActionEffect = {
  /** 'cost' (spent / lost) or 'gain' (produced / raised) — drives the chip colour. */
  direction: 'cost' | 'gain';
  /**
   * Icon key. Resolved client-side: standard resources (`megacredits`/`steel`/…)
   * and global parameters (`oxygen`/`temperature`/`venus`) and card resources
   * (`microbe`/`animal`/`floater`/…) all map through `iconClassFor`. The two
   * pseudo-keys `tr` and `cards` render a styled badge instead of a sprite.
   */
  icon: string;
  /** Magnitude of the change (always positive; `direction` conveys the sign). */
  amount: number;
  /** Current value of the affected pool, for a `current → resulting` preview.
   *  Omitted when there's no single pool to show (e.g. add to ANY card, draw). */
  current?: number;
  resulting?: number;
  /** Unit suffix for global parameters (`'%'` / `'°C'`); omitted for plain counts. */
  unit?: string;
  /** Optional i18n note under the value (e.g. `'on this card'`, `'to a card'`). */
  note?: string;
  /**
   * For a VARIABLE amount computed from game state ("1 M€ per city on Mars"),
   * the live BASIS of that computation — so the player sees WHY the amount is
   * what it is (e.g. `{count: 3, label: 'Cities on Mars'}` → "+3 M€ · Cities on
   * Mars: 3"). `label` is an English i18n key; `count` is the current count of
   * the counted entity. Omitted for plain fixed amounts.
   */
  basis?: {count: number, label: string};
};

/**
 * Describes a REVEAL / DECK-CHECK action: it reveals the top card of a deck and
 * checks a CONDITION on it; on a match the player gets `reward`, otherwise nothing.
 * The outcome is random, so it can't be shown as a fixed `effect` chip — instead
 * the confirm modal renders a dedicated "reveal slot": before confirming it shows
 * WHAT will be checked + the reward on a match; after confirming the live result
 * (the revealed card + a success/fail marker) arrives via `PlayerViewModel.lastReveal`.
 * Declared by the card's co-located `actionPreview` hook. SearchForLife (microbe
 * tag → science resource) and AsteroidDeflectionSystem (space tag → asteroid) are
 * the in-scope cases — both check a TAG.
 */
export type ActionRevealDescriptor = {
  /** Which deck the top card is revealed from (only the project deck today). */
  deck: 'project';
  /** The condition checked on the revealed card. A tag check, with a label. */
  check: {tag?: Tag, label: string | Message};
  /** What the player gains on a match — reuses the chip type (e.g. science +1 here). */
  reward: ActionEffect;
  /**
   * The VP the SOURCE card scores NOW → after a successful match (`from` → `to`).
   * Drives a clarity note so the player never has to wonder why a match did or
   * didn't move their score: `to > from` → "you'll gain +N VP"; `to === from` →
   * an amber "you already have these VP — finding more won't add any". Search For
   * Life (binary 3 VP once it holds a science) is the case that needs the warning;
   * Asteroid Deflection (1 VP per asteroid) always gains. Omit for VP-less cards.
   */
  vp?: {from: number, to: number};
};

export type ActionPreviewBranch = {
  /**
   * The RUNTIME index of this branch in the `OrOptions` the server builds when
   * the action runs (`Executor.execute` filters out unexecutable sub-behaviors
   * THEN maps, so this is the index into the FILTERED list — NOT the raw
   * `or.behaviors` index). `-1` means there is no branch pick (a single-action
   * card, or a disabled branch that is never submitted).
   */
  index: number;
  title: string | Message;
  available: boolean;
  /** Why this branch can't be used right now (when `available === false`). */
  unavailableReason?: string | Message;
  /**
   * Keys identifying which of the card's action render nodes belong to THIS
   * branch (matched by ordinal to the client's extracted action nodes), so the
   * overlay can draw a per-branch button graphic. Empty → the whole card render.
   */
  renderKeys: ReadonlyArray<string>;
  /** The branch's costs + gains as premium chips (icon + current→resulting). */
  effects: ReadonlyArray<ActionEffect>;
  /**
   * When the branch's `OrOptions` option is a DIRECT input (a `SelectAmount` /
   * `SelectCard`, NOT a `SelectOption`), this is that input — the modal hosts it
   * and its response is NESTED into the branch pick (`{type:'or', index,
   * response:<this input's response>}`) instead of the default `{type:'option'}`.
   * Absent for the common `SelectOption` case (whose follow-ups, if any, arrive
   * as separate `steps`).
   */
  optionInput?: PlayerInputModel;
  /** Ordered INTERACTIVE choices that arrive as SEPARATE prompts AFTER the branch
   *  pick (a SelectOption's deferred follow-ups), collected in the confirm modal. */
  steps: ReadonlyArray<ActionPreviewStep>;
  /** Present when this action REVEALS a deck card to check a condition — the modal
   *  shows the premium reveal slot instead of (or alongside) a fixed result chip. */
  reveal?: ActionRevealDescriptor;
};

/**
 * One INTERACTIVE choice the player makes inside the confirm modal for a branch.
 * (Display-only costs/gains live in `ActionPreviewBranch.effects`, not here.)
 *  - `input`         — a real follow-up input (player/card/amount/resource/…),
 *                      carried as the existing `PlayerInputModel` so the client
 *                      hosts it with the matching `Modern*` component and
 *                      captures its response locally.
 *  - `boardPlacement`— an inherently-interactive board tile placement that CANNOT
 *                      be pre-chosen in the modal; the client submits everything
 *                      up to it, then the leftover `SelectSpace` hands off to
 *                      `PlacementBanner`. Shown as an honest note.
 *  - `note`          — a generic "what happens next" context line for a follow-up
 *                      the modal can't pre-collect and that isn't a standard tile
 *                      placement (a colony pick, a special board move, etc.). The
 *                      `noteKind` selects the premium copy; `text` overrides it.
 */
export type ActionPreviewStep =
  | {
    kind: 'input',
    input: PlayerInputModel,
    /**
     * For a card-/player-TARGET step that ADDS (or removes) a resource, the signed
     * delta applied to the chosen target — so the picker can show a `current →
     * resulting` impact per candidate (e.g. "+2 microbe" → "2 → 4" on each card).
     * Positive = add, negative = remove. Omitted when there's no single per-target
     * delta to preview (the candidate then shows just its current count).
     */
    amount?: number,
  }
  | {kind: 'boardPlacement', placementType: string}
  | {kind: 'note', noteKind: 'colony' | 'board' | 'generic', text?: string | Message};
