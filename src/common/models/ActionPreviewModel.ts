import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Tag} from '../cards/Tag';
import {Color} from '../Color';
import {Message} from '../logs/Message';
import {Units} from '../Units';
import {PlayerInputModel, SelectCardModel} from './PlayerInputModel';

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
  /** Why this branch can't be used right now (when `available === false`) — an
   *  English i18n template; `unavailableReasonParams` fills its `${0}`… slots. */
  unavailableReason?: string | Message;
  /** Params for `unavailableReason`'s template (e.g. the M€ deficit). */
  unavailableReasonParams?: ReadonlyArray<string>;
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
  /**
   * The card-target steps in this branch are SLOTS of ONE SelectCard (e.g. Astra
   * Mechanica "return UP TO 2 events to hand"): the live play produces a SINGLE
   * SelectCard prompt (min..max), so on confirm the modal MERGES the slots' picked
   * cards into ONE `{type:'card', cards:[...]}` response — and requires only `min`
   * slots filled (the rest stay empty). Absent → each card step is its OWN response
   * (Cyberia Systems defers two separate SelectCards, both required).
   *
   * `emptyWarning` (only meaningful when `min === 0`, where the rules allow picking
   * NOTHING): the i18n text shown in a confirm popup when the player submits with no
   * slot filled — so an empty submit (valid but easy to do by accident) is a
   * conscious choice, not a misclick.
   */
  mergeCardSteps?: {min: number, emptyWarning?: string | Message};
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
    /**
     * For an "add a CARD RESOURCE to a card" pick (microbe / animal / floater / …):
     * the resource icon key, so the picker prompt shows the resource ICON + count
     * (`[microbe] ×3`) — unambiguous about WHICH resource this picker adds, and
     * grammar-safe (no per-language plural agreement, unlike a text resource name).
     */
    cardResource?: string,
    /**
     * Indices of EARLIER card-target steps whose chosen card must be EXCLUDED from
     * this step's candidates (no-duplicate across linked picks — e.g. Cyberia
     * Systems copies TWO DIFFERENT building cards). The client filters this step's
     * candidate list by the cards captured in those steps.
     */
    dedupeFromSteps?: ReadonlyArray<number>,
    /**
     * This card-target step COPIES production into the player's production (the
     * RoboticWorkforce / Cyberia Systems mechanic). Maps each candidate card name
     * to the production it would copy — computed AUTHORITATIVELY server-side
     * (`copiedProductionUnits`, mirroring the live copy logic) so it's correct for
     * EVERY copyable card (bespoke `productionBox()`, counted production, …), not
     * just full-Units declarative ones. The modal folds the CHOSEN card's units
     * into the displayed RESULT so the player sees EXACTLY what is copied — updating
     * live as they pick / change cards. A candidate whose production can't be
     * previewed (a bespoke `produce()` that mutates) is simply absent from the map.
     */
    copyProductionBox?: Partial<Record<CardName, Units>>,
    /**
     * A MULTI-select card pick (`input.max > 1`): instead of listing the chosen
     * cards (the pick can be large — e.g. Public Plans "reveal ANY NUMBER of cards
     * from your hand"), the modal hosts it via the КАРТЫ В РУКЕ overlay's
     * multi-select mode and shows a COUNT summary. `countLabel` is the i18n label
     * for that count ("Cards to reveal"); `revealGain` (optional) folds a
     * per-selected-card stock gain into the live RESULT (`+1 M€` per revealed card)
     * so the player sees the M€ change BEFORE submit. The whole `{type:'card',
     * cards:[...]}` set is captured as this step's single response.
     */
    multiSelect?: {countLabel: string | Message, revealGain?: {resource: string, amount: number}},
  }
  | {kind: 'boardPlacement', placementType: string}
  /** A `warning` note flags an effect that WILL BE SKIPPED for lack of a valid
   *  target (e.g. "add an animal" with no animal card) — shown as an orange block
   *  so the player is never surprised by a silently-lost effect. */
  | {kind: 'note', noteKind: 'colony' | 'board' | 'generic' | 'warning', text?: string | Message,
    /** For a `warning` about a card-resource that can't be placed (no eligible
     *  card): the NORMALIZED resource icon key (lowercase-hyphenated, via
     *  `cardResourceIcon` — the SAME form as `ActionPreviewStep.cardResource`, NOT
     *  the raw `CardResource` value) so `iconClassFor` resolves the sprite and the
     *  modal names WHICH resource is lost via its icon, not an ambiguous "this
     *  resource". */
    resource?: string}
  | TabbedTargetsStep;

/** One player target in the "remove plants" tab of a `TabbedTargetsStep`. */
export type TabbedPlantTarget = {
  color: Color;
  name: string;
  /** The player's plants now → after the removal (the impact preview). */
  current: number;
  resulting: number;
  /** The OrOptions index of this player's plant-removal option — the submit is
   *  `{type:'or', index, response:{type:'option'}}`. */
  optionIndex: number;
};

/**
 * A "remove X OR Y from any player" choice presented as TABS (Virus: up to 2
 * animals OR 5 plants). Each tab shows its VALID targets — animal-holding cards
 * (grouped by owner) for the animal tab, player targets for the plant tab — with a
 * `current → resulting` impact so the player sees EXACTLY what is removed before
 * the single submit. The chosen target maps to ONE top-level OrOptions response
 * (the indices are computed server-side from the live OrOptions the card builds, so
 * the pre-collected pick replays byte-for-byte). A tab is absent when it has no
 * valid target.
 */
export type TabbedTargetsStep = {
  kind: 'tabbedTargets';
  /** Remove from a CARD (animals) — a card pick hosted by `ActionTargetCard`. The
   *  chosen card nests into `{type:'or', index: branchIndex, response:{type:'card',
   *  cards:[name]}}`. */
  animal?: {label: string | Message, icon: string, amount: number, branchIndex: number, input: SelectCardModel};
  /** Remove from a PLAYER (plants) — player targets, each its own OrOptions option. */
  plant?: {label: string | Message, icon: string, amount: number, targets: ReadonlyArray<TabbedPlantTarget>};
};
