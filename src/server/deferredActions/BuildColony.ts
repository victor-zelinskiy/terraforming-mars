import {CanAffordOptions, IPlayer} from '../IPlayer';
import {SelectColony} from '../inputs/SelectColony';
import {InputError} from '../inputs/InputError';
import {IColony} from '../colonies/IColony';
import {BuildDoorOptions} from '../player/Colonies';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {recordSkippedEffect} from './skippedEffect';
import type {SkippedEffect} from '../cards/actionPreviews';
import {ChoiceContextSource, PlacementContext, SelectColonyModel} from '../../common/models/PlayerInputModel';
import {ColonyBuildSite} from '../../common/colonies/ColonyBuildSite';
import {berthIsOverLimit} from '../../common/colonies/colonyBerths';

/** The skip label — the effect a lost «place a colony» is NAMED by. */
export const BUILD_COLONY_LABEL = 'Build a colony';

/** The cause of the skip when no tile in play takes the colony. */
export const NO_COLONY_TO_BUILD_ON_REASON = 'No colony available to build on';

/**
 * What a lost «place a colony» is NAMED by — the one description the play
 * preview's warning (`actionPreviews.colonyPickStep`) and the after-the-fact
 * record share. No magnitude: a colony is not an amount.
 */
export function skippedColonyBuild(reason: string = NO_COLONY_TO_BUILD_ON_REASON): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: BUILD_COLONY_LABEL}};
}

type Offer = {
  /** The tiles the build may land on. */
  candidates: Array<IColony>,
  /** Every OTHER tile in play, each with the ONE reason it is refused. */
  disabled: Array<{colony: IColony, reason: string}>,
};

/**
 * «PLACE A COLONY» — the shared step every build of a colony asks through:
 * the standard project, a card's on-play effect, a resolution's free colony,
 * a cell's placement bonus.
 *
 * WHO IS ASKED ABOUT WHAT: every tile in play. A tile the build may land on
 * is a candidate; every other is SHOWN disabled with the ONE reason the
 * build's own door names (`Colonies.buildBlockedReason`, the conditions asked
 * in order). Which rules the door applies is the caller's: `allowDuplicate`
 * («even if you already have a colony there») and `ignoreLimit` («this ignores
 * the 3-colony limit» — Turmoil Redux TR25 Exclusive Colony) each lift exactly
 * one, and neither lifts an inactive tile, the TR a build bonus costs or the
 * track's last free cell.
 *
 * WHAT THE PICK DOES is the marker's (`buildSites`): the berth the cube takes
 * on each candidate, whether it lies beyond the printed limit, the player's
 * own cubes there. It rides EVERY build prompt — it is what makes the pick's
 * act `build` on the client, never the button label.
 *
 * `cause` — the CARD whose on-play effect this build is. It gives the prompt
 * its `choiceContext.source` (the address of a staged colony tail,
 * `deferredInputBatch`) and turns «no tile takes the colony» into a NAMED
 * skip (`recordSkippedEffect`). Without it the prompt is what it always was.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and
 * `previewSelectColony()` describes it without touching anything — the play
 * preview's staged door (`actionPreviews.colonyPickStep`) shows the very
 * prompt the commit will ask. `canAffordOptions` is the PREVIEW's: before the
 * play the card is not paid yet, so «can the TR of the build bonus be
 * afforded» must fold the card's own price in; the live step is built without
 * it (the price is paid by then).
 *
 * Priority: `BUILD_COLONY` — ahead of a card's `DEFAULT` inputs. A staged
 * tail is ADDRESSED, so the queue's order does not concern it.
 */
export class BuildColony extends DeferredAction<IColony> {
  constructor(
    player: IPlayer,
    private options?: {
      allowDuplicate?: boolean, // Allow placing a colony on a tile that already has a colony.
      ignoreLimit?: boolean, // Allow placing a colony on a tile that already carries the printed limit of colonies.
      title?: string,
      colonies?: Array<IColony>, // If not specified, will accept all playable colonies.
      giveBonusTwice?: boolean, // Custom for Vital Colony. Rewards the bonus when placing a colony a second time.
      // The CARD whose on-play effect this build is: the prompt's
      // `choiceContext.source` (a staged tail's address) and the named skip.
      cause?: ChoiceContextSource,
      // The PREVIEW's: the unpaid price of the card folded into «can the TR be afforded».
      canAffordOptions?: CanAffordOptions,
      // Cancellability (pay-on-commit Build-Colony standard project). Cards leave
      // these unset → the colony build is a committed effect (not cancellable).
      placementContext?: PlacementContext,
      onCancel?: () => void,
      // When set, runs INSTEAD of the default `place()` on commit — the standard
      // project uses it to pay + place inside one analytics scope. `place` builds
      // the colony; call it from inside the closure.
      commit?: (colony: IColony, place: () => void) => void,
    },
  ) {
    super(player, Priority.BUILD_COLONY);
  }

  /** What this door tells the build's one reason function about itself. */
  private door(): BuildDoorOptions {
    return {
      allowDuplicate: this.options?.allowDuplicate,
      ignoreLimit: this.options?.ignoreLimit,
      canAffordOptions: this.options?.canAffordOptions,
    };
  }

  /** The candidates and the disabled tiles with their ONE reason each, in the table's order. */
  private offer(): Offer {
    const candidates = this.options?.colonies || this.player.colonies.getPlayableColonies(this.door());
    // Surface the OTHER in-play colonies the player can't build on right now as
    // DISABLED cards with a reason (full / already-owned / TR affordability),
    // instead of dropping them from the picker. `candidates` stays the
    // selectable set the server validates against.
    const selectable = new Set(candidates.map((c) => c.name));
    const disabled = this.player.game.colonies
      .filter((colony) => !selectable.has(colony.name))
      .map((colony) => ({colony, reason: this.disabledReason(colony)}));
    return {candidates, disabled};
  }

  /** Where the cube lands on one candidate — the marker's entry, counted by the engine. */
  private site(colony: IColony): ColonyBuildSite {
    const slot = colony.colonies.length;
    return {
      colony: colony.name,
      slot,
      overLimit: berthIsOverLimit(slot),
      own: colony.colonies.filter((id) => id === this.player.id).length,
    };
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(offer: Offer): SelectColony {
    const title = this.options?.title ?? 'Select where to build a colony';
    const select = new SelectColony(title, 'Build', offer.candidates);
    select.placementContext = this.options?.placementContext;
    select.onCancel = this.options?.onCancel;
    select.disabledColonies = offer.disabled;
    select.buildSites = offer.candidates.map((colony) => this.site(colony));
    if (this.options?.cause !== undefined) {
      select.markChoiceContext({source: this.options.cause, mode: 'effect-choice'});
    }
    return select;
  }

  /**
   * READ-ONLY: the `SelectColonyModel` the live path WOULD raise — the same
   * title, candidates, disabled tiles, `buildSites` projection and giver — or
   * `undefined` exactly where `execute()` has nothing to ask (no candidate).
   * Nothing is mutated, logged or queued. `choiceContext` is decorated
   * centrally on a live prompt (`ServerModel.getWaitingFor`), so it is
   * attached here by hand.
   */
  public previewSelectColony(): SelectColonyModel | undefined {
    const offer = this.offer();
    if (offer.candidates.length === 0) {
      return undefined;
    }
    const select = this.prompt(offer);
    const model = select.toModel(this.player);
    if (select.choiceContext !== undefined) {
      model.choiceContext = select.choiceContext;
    }
    return model;
  }

  /** The named skip the preview promises where `previewSelectColony()` has no prompt — the cause `execute()` records. */
  public previewSkip(): {reason: string, skipped: SkippedEffect} {
    return skippedColonyBuild();
  }

  public execute() {
    const offer = this.offer();

    if (offer.candidates.length === 0) {
      // A CARD's build that finds no tile names itself (no silent loss). The
      // other doors answer for themselves: the standard project and a cell's
      // bonus are refused before they are offered, a resolution reports its
      // own skip — nothing is recorded twice.
      if (this.options?.cause !== undefined) {
        const lost = skippedColonyBuild();
        recordSkippedEffect(this.player, lost.reason, lost.skipped);
      }
      return undefined;
    }

    return this.prompt(offer)
      .andThen((colony: IColony) => {
        // Re-read at the answer: the world may have moved between the question
        // and the answer (a staged tail parked behind another prompt). The
        // door's OWN rule, asked with the same options — a caller's custom
        // subset is that card's rule and is not second-guessed here.
        if (this.options?.colonies === undefined) {
          const refused = this.player.colonies.buildBlockedReason(colony, this.door());
          if (refused !== undefined) {
            throw new InputError(refused);
          }
        }
        const place = () => colony.addColony(this.player, {giveBonusTwice: this.options?.giveBonusTwice ?? false});
        if (this.options?.commit !== undefined) {
          this.options.commit(colony, place);
        } else {
          place();
        }
        this.cb(colony);
        return undefined;
      });
  }

  /**
   * Why an in-play colony can't be built on now — the build's ONE reason
   * function (`Colonies.buildBlockedReason`, the very predicate
   * `getPlayableColonies` filters by), so a disabled tile is named by the
   * condition that actually excluded it.
   */
  private disabledReason(colony: IColony): string {
    // It answers `undefined` only when the CALLER passed a custom `colonies`
    // subset: the exclusion is then that card's own rule and this deferred
    // action genuinely cannot name it — so it states no cause it hasn't
    // verified rather than guessing one.
    return this.player.colonies.buildBlockedReason(colony, this.door()) ??
      'Cannot build on this colony right now';
  }
}
