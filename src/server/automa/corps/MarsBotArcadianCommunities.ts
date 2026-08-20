import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {Space} from '../../boards/Space';
import {AutomaMarkerPlacer} from '../AutomaMarkerPlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {failedAction} from '../AutomaFailedAction';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES);
/**
 * What a build on an own marked area pays. It is the SAME reserved-area bonus
 * the human Arcadian Communities collects, granted by the SAME line in
 * `Game.grantPlacementBonuses` — this constant only mirrors it for the
 * counter, and `MarsBotArcadianCommunities.spec.ts` asserts the two agree.
 */
const RESERVED_BONUS_MC = 3;

/**
 * MarsBot Arcadian Communities — official card C18:
 *
 *   STARTING TAG         building
 *   SETUP                Resolve Settlers now.
 *   EFFECT               Only MarsBot may build on the areas reserved by its
 *                        player markers, and receives 3 MC when it does so.
 *   BEFORE ACTION PHASE  Add Settlers to MarsBot's action deck.
 *
 * plus its corporation-specific bonus card B22 Settlers:
 *
 *   "Place one of MarsBot's player markers on the map on a non-reserved area,
 *    using the usual tiebreakers. Before using the final tiebreak (flip a
 *    card), MarsBot first looks for the space with the most adjacent spaces
 *    that are reserved for oceans. At the beginning of every generation,
 *    shuffle this into MarsBot's action deck."
 *
 * THE FIRST HALF OF THE EFFECT IS FREE. «Only MarsBot may build on the areas
 * reserved by its player markers» is the engine's own reservation rule: a
 * tile-less cell carrying `space.player` is refused to everyone else by
 * `Board.getAvailableSpacesOnLand`. Claiming IS the block — there is nothing
 * to implement and nothing that could drift from the human card's behaviour.
 *
 * THE SECOND HALF RIDES THE HUMAN CARD'S OWN PAYOUT. `Game.addTile` already
 * computes an «own marked area» bonus before the tile seats; this corporation
 * answers the same question for the bot through `onBuildOnOwnMarker`, so the
 * 3 M€ is granted by the SAME line, in the same scope, with the same ordering
 * and the same covering/Solar-phase exclusions. The bot never gets a parallel
 * payout that could drift from the human one.
 *
 * LIFECYCLE. B22 rides the recurring mechanism of B23/B25/B28, and the SETUP
 * box is simply «resolve it now» — so the corporation claims one area the
 * moment it is seated and one more every generation, until the map runs out
 * (which is a Failed Action: B22 prints no fallback).
 */
export const MarsBotArcadianCommunities: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    // «Resolve Settlers now» — the same routine the card runs, before the
    // corporation's starting building tag resolves.
    claimArea(game);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B22_SETTLERS)) {
      automa.recurringBonusCards.push(BonusCardId.B22_SETTLERS);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.B22_SETTLERS);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.B22_SETTLERS});
      // Journal-only (no scope): the deck join is public bookkeeping, not an
      // event worth a notification — the card announces itself when flipped.
      game.log('${0} shuffled Settlers into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  onBuildOnOwnMarker(game: IGame, _space: Space): 'pays' | void {
    bumpCorpStat(game, 'arcadianBuilds');
    bumpCorpStat(game, 'arcadianMc', RESERVED_BONUS_MC);
    game.log('${0} built on an area reserved by its corporation ${1}',
      (b) => b.player(marsBotOf(game)).string('Arcadian Communities'));
    return 'pays';
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.B22_SETTLERS) {
      throw new Error(`MarsBot Arcadian Communities does not own bonus card ${id}`);
    }
    bumpCorpStat(game, 'settlersPlayed');
    const space = claimArea(game);
    if (space === undefined) {
      // Nothing left to claim. The card prints no else-branch, so the general
      // rule applies: an action MarsBot cannot perform is a Failed Action.
      AutomaTurnLog.setBonusBranch(game, {key: 'No area left to claim'});
      bumpCorpStat(game, 'settlersBlocked');
      failedAction(game, 'no-tile-space');
    } else {
      AutomaTurnLog.setBonusBranch(game, {key: 'Claimed another area'});
    }
    return 'discard'; // Recurring: `routeBonusCard` keeps it in the holding pool.
  },
};

/** One claim, counted. Returns the claimed space, or undefined when the map is full. */
function claimArea(game: IGame): Space | undefined {
  const space = AutomaMarkerPlacer.claimSpace(game);
  if (space !== undefined) {
    bumpCorpStat(game, 'arcadianMarkers');
  }
  return space;
}
