import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {CardName} from '../../common/cards/CardName';
import {isICorporationCard} from '../cards/corporation/ICorporationCard';
import {isPreludeCard} from '../cards/prelude/IPreludeCard';
import {isIProjectCard} from '../cards/IProjectCard';
import {SelectCard} from '../inputs/SelectCard';
import {Behavior} from '../behavior/Behavior';
import {CardType} from '../../common/cards/CardType';
import {Resource} from '../../common/Resource';
import {ActionEffect, ActionPreview, ActionPreviewBranch, ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {deriveOrBranches, effectsForBehavior, stepsForBehavior, withImpliedRatings} from './actionPreview';
import {withPreselectAddresses} from './preselectAddresses';
import {withDivertedTerraforming} from './divertedTerraforming';
import {attachStagedPlacement, stagedPlacementForBehavior} from './stagedBehaviorPlacement';

/**
 * READ-ONLY preview of PLAYING a project card — the analog of `actionPreview`
 * (`src/server/models/actionPreview.ts`) but for a card's ON-PLAY behavior
 * (`card.behavior`) instead of its repeatable action (`card.actionBehavior`). It
 * lets the play modal (`HandCardPaymentContent.vue`) show the on-play effects
 * (resource / production / global-parameter / TR / draw chips) and host the
 * interactive target choices BEFORE the card is submitted, then submit the play
 * + the choices as ONE batch request (no follow-up modal spam).
 *
 * Strategy mirrors actionPreview's bespoke → declarative → dynamic split:
 *   1. BESPOKE cards supply it via the co-located `ICard.cardPlayPreview?(player)`
 *      hook (built from the shared `actionPreviews.ts` builders).
 *   2. DECLARATIVE cards auto-derive from `card.behavior` using the SAME generic
 *      `effectsForBehavior` / `stepsForBehavior` walkers the action preview uses
 *      (no parallel system).
 *   3. Otherwise (a bespoke `bespokePlay` with no hook and no behavior) → a single
 *      confirm-only branch; the card's own prompts ride the post-batch follow-up
 *      routing (the existing premium modal / PlacementBanner / overlay surfaces).
 *
 * NOTHING here mutates game state. It never calls `Executor.execute`/`canExecute`
 * — only read-only checks + pure model construction (each step uses a deferred
 * action's read-only `previewSelect*`).
 *
 * `card` is a plain `ICard`: everything read here (the hook / type / card
 * resource / behavior) lives on ICard, and the generic walkers take ICard —
 * so a PRELUDE previews through the exact same path as a project card (the
 * route decides WHICH cards may be previewed).
 */
/**
 * WHICH of the player's OWN cards may be previewed right now (the route's
 * gate — kept here so it is unit-testable alongside the preview itself):
 *  - a currently PLAYABLE project card (hand + Self-replicating Robots hosts);
 *  - a PRELUDE in the player's own prelude hand;
 *  - a PRELUDE OFFERED BY THE LIVE PROMPT (the drew-N pick — New Partner /
 *    Valley Trust: freshly drawn preludes live ONLY inside the `preludeSelection`
 *    prompt, never in `preludeCardsInHand`, so the prompt is the only handle);
 *  - the CHOSEN but not-yet-played corporation (the deferred `corporationPlay`
 *    window — it lives in `pickedCorporationCard`, not the hand/tableau);
 *  - a corporation OFFERED BY THE LIVE PROMPT (Merger's `corporationSelection`:
 *    its dealt corps are local to Merger's `bespokePlay`, so the prompt the
 *    server is showing this player is the only honest handle on them).
 * Everything else → undefined (the route answers notFound). Read-only.
 */
export function previewableCard(player: IPlayer, name: CardName): ICard | undefined {
  const playable = player.getPlayableCards().find((c) => c.name === name);
  if (playable !== undefined && isIProjectCard(playable)) {
    return playable;
  }
  const prelude = player.preludeCardsInHand.find((c) => c.name === name);
  if (prelude !== undefined) {
    return prelude;
  }
  const picked = player.pickedCorporationCard;
  if (picked?.name === name) {
    return picked;
  }
  return offeredPrelude(player, name) ?? offeredCorporation(player, name);
}

/**
 * A prelude offered by the player's own live `preludeSelection` prompt. The
 * drew-N pick (New Partner / Valley Trust) deals its candidates straight from
 * the prelude deck into the `SelectCard` — they are in NEITHER
 * `preludeCardsInHand` NOR the tableau, so without this branch the console's
 * start scene asked for a preview it could never get (a 404 per candidate, and
 * the press silently lost its premium reward beat). Mirrors
 * `offeredCorporation`: gated on the explicit marker + the card type, so an
 * arbitrary prompt's cards can never be previewed through it. Double Down's
 * 'copy' candidates resolve too — they are the player's own played preludes, and
 * a read-only preview of one is truthful.
 */
function offeredPrelude(player: IPlayer, name: CardName): ICard | undefined {
  const waitingFor = player.getWaitingFor();
  if (!(waitingFor instanceof SelectCard) || waitingFor.startGamePrompt?.kind !== 'preludeSelection') {
    return undefined;
  }
  const card = (waitingFor.cards as ReadonlyArray<ICard>).find((c) => c.name === name);
  return card !== undefined && isPreludeCard(card) ? card : undefined;
}

/** A corporation offered by the player's own live `corporationSelection`
 *  prompt (Merger). Gated on the explicit marker + the corporation type, so
 *  an arbitrary prompt's cards can never be previewed through it. */
function offeredCorporation(player: IPlayer, name: CardName): ICard | undefined {
  const waitingFor = player.getWaitingFor();
  if (!(waitingFor instanceof SelectCard) || waitingFor.startGamePrompt?.kind !== 'corporationSelection') {
    return undefined;
  }
  const card = (waitingFor.cards as ReadonlyArray<ICard>).find((c) => c.name === name);
  return card !== undefined && isICorporationCard(card) ? card : undefined;
}

export function cardPlayPreview(player: IPlayer, card: ICard): ActionPreview {
  // The door's exit passes, in order (hook or declaration alike): a replacing law strikes the printed units and
  // pre-collects the «where» (`divertedTerraforming.ts`, RX35 — the played card is a holder of its own data), a scale
  // step's own rating stated after the scale (PL-147; none for a struck chip), and every step addressed to its own
  // prompt (the pre-select law, `preselectAddresses.ts`).
  return withPreselectAddresses(withImpliedRatings(withDivertedTerraforming(player, cardPlayPreviewOf(player, card), card)));
}

function cardPlayPreviewOf(player: IPlayer, card: ICard): ActionPreview {
  if (card.cardPlayPreview !== undefined) {
    return card.cardPlayPreview(player);
  }
  return declarativeCardPlayPreview(player, card);
}

/**
 * THE DECLARATIVE DOOR, exported — the preview a card's `behavior` derives
 * (the chips, the pre-collected steps, the staged placement), the way the
 * route builds it for a card WITHOUT a hook. A card whose play has a bespoke
 * TAIL beyond its declaration (Turmoil Redux TR47 Ecological Experiment —
 * «THEN decrease each Mars global parameter…») calls this from its own
 * `cardPlayPreview` and APPENDS to the branch it returns, so the first half
 * of its formula is never rewritten by hand and the guards that cover a
 * declaration (`cardPlayReplayCoverage`, `stagedPlacementParity`) keep
 * covering it. Read-only. The route's exit passes (`withImpliedRatings`,
 * `withPreselectAddresses`) run on the hook's result as on any.
 */
export function declarativeCardPlayPreview(player: IPlayer, card: ICard): ActionPreview {
  const base = {
    card: card.name,
    isCorporation: card.type === CardType.CORPORATION,
    cardResource: card.resourceType !== undefined ? {type: card.resourceType, count: card.resourceCount} : undefined,
  };

  // A CORPORATION's starting M€ are applied by `playCorporationCard` OUTSIDE
  // its behavior (`megaCredits += startingMegaCredits`), so the generic walker
  // can't see them — they are prepended here. Without this the corporation's
  // single biggest on-play gain would be missing from its preview.
  const startingEffects = corporationStartingEffects(player, card);

  const behavior = card.behavior;
  if (behavior !== undefined) {
    const branches = deriveCardPlayBranches(player, card, behavior);
    return {...base, kind: 'declarative', branches: withStartingEffects(branches, startingEffects)};
  }

  if (startingEffects.length > 0) {
    // A corporation whose only computable on-play result is its starting M€
    // (its rule text is a passive effect / a first action — neither is a play
    // reward). Still declarative: the chip is exact.
    return {
      ...base,
      kind: 'declarative',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: startingEffects, steps: []}],
    };
  }

  // Bespoke `bespokePlay` with no hook: a single confirm-only branch. Whatever
  // prompts the card produces flow through the existing post-batch routing.
  return {
    ...base,
    kind: 'dynamic',
    branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
  };
}

/** The corporation's starting M€ as a gain chip (empty for every other card,
 *  and for a corp that starts at 0 M€). Read-only. */
function corporationStartingEffects(player: IPlayer, card: ICard): ReadonlyArray<ActionEffect> {
  if (!isICorporationCard(card) || card.startingMegaCredits <= 0) {
    return [];
  }
  const current = player.megaCredits;
  return [{
    direction: 'gain',
    icon: Resource.MEGACREDITS,
    amount: card.startingMegaCredits,
    current,
    resulting: current + card.startingMegaCredits,
  }];
}

/** Prepend the starting chips to every branch (a corp's starting M€ are paid
 *  whichever on-play branch it takes). */
function withStartingEffects(
  branches: ReadonlyArray<ActionPreviewBranch>,
  startingEffects: ReadonlyArray<ActionEffect>,
): ReadonlyArray<ActionPreviewBranch> {
  if (startingEffects.length === 0) {
    return branches;
  }
  return branches.map((b) => ({...b, effects: [...startingEffects, ...b.effects]}));
}

function deriveCardPlayBranches(player: IPlayer, card: ICard, behavior: Behavior): ReadonlyArray<ActionPreviewBranch> {
  // On-play `behavior.or` → the shared derivation (`deriveOrBranches` — one
  // branch per sub-behavior, runtime indices among the executable ones, the
  // keys beside the choice on every branch, the optional choice's general
  // branch); the live path defers an OrOptions after play. Only the steps
  // differ from the action twin: a play branch carries its staged placement.
  const orBranches = deriveOrBranches(player, card, behavior,
    (b) => withStagedPlacement(player, card, b, stepsForBehavior(player, card, b)));
  if (orBranches !== undefined) {
    return orBranches;
  }

  // The common case: the whole on-play behavior is ONE branch (no pick). The card
  // is already in getPlayableCards() (the route gate), so it's available; the
  // play itself is response[0], assembled client-side (not part of this preview).
  return [{
    index: -1,
    title: '',
    available: true,
    renderKeys: [],
    effects: effectsForBehavior(player, card, behavior),
    steps: withStagedPlacement(player, card, behavior, stepsForBehavior(player, card, behavior)),
  }];
}

/**
 * STAGED PLAY enrichment for a DECLARATIVE play branch: compute the staged
 * board payload for the branch's FIRST Mars placement and attach it to that
 * step's `boardPlacement` entry (see `StagedPlacementModel`). Bespoke cards
 * attach theirs through `actionPreviews.placementPreview({staged})` — this
 * walker never sees them. Read-only.
 *
 * The derivation MIRRORS `Executor.execute`'s placement block (the fixed
 * ocean → city → greenery → tile order and the exact `Place*Tile` args) — the
 * same mirroring contract `stepsForBehavior` already carries, guarded by
 * `tests/boards/stagedPlacementParity.spec.ts`. Deliberate exclusions:
 *   - a colony-coupled play (`colonies.buildColony`) — the colony prompt comes
 *     FIRST at runtime (BUILD_COLONY < PLACE_OCEAN_TILE), so the cell cannot
 *     honestly be the play's last step; it stays a follow-up (v1);
 *   - oceans while `canAddOcean()` is false — the runtime placement silently
 *     skips, so the play produces no placement prompt at all;
 *   - a fixed off-grid `city.space` — placed without any prompt (D3).
 */
export function withStagedPlacement(
  player: IPlayer,
  card: ICard,
  behavior: Behavior,
  steps: ReadonlyArray<ActionPreviewStep>,
): ReadonlyArray<ActionPreviewStep> {
  // The UNPAID card's own price competes with an Ares cell's cost — the play folds it into the legal set.
  const canAffordOptions = isIProjectCard(card) && card.type !== CardType.PRELUDE ?
    player.affordOptionsForCard(card) : undefined;
  return attachStagedPlacement(steps, stagedPlacementForBehavior(player, card, behavior, canAffordOptions));
}
