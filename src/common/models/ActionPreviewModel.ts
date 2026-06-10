import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
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
 */
export type ActionPreviewStep =
  | {kind: 'input', input: PlayerInputModel}
  | {kind: 'boardPlacement', placementType: string};
