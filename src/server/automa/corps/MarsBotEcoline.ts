import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {failedAction} from '../AutomaFailedAction';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';

/**
 * MarsBot Ecoline — official card C02:
 *
 *   BEFORE ACTION PHASE  Add Rapid Sprouting to MarsBot's action deck.
 *
 * plus its corporation-specific bonus card B23 Rapid Sprouting:
 *
 *   "If the Ecoline corporation card has a plant resource on it, remove it,
 *    MarsBot places a greenery tile, and it raises oxygen 1 step. Otherwise,
 *    add a plant resource to the Ecoline corporation card. At the beginning
 *    of every generation, shuffle this into MarsBot's action deck."
 *
 * LIFECYCLE. B23 is a corporation-owned RECURRING action card — exactly the
 * existing B16/B19/B20 mechanism (`AutomaState.recurringBonusCards`): it is
 * never part of the random bonus-deck rotation, never discarded, and
 * `AutomaResearch.finishActionDeck` re-shuffles it into the action deck every
 * generation from 2 on. Generation 1 (the deck was built at game creation,
 * before the corporation existed — RB-B setup order is compressed by the
 * asynchronous multiplayer start) is covered by `beforeActionPhase` inserting
 * it at a seeded-random position, which is equivalent to having shuffled it
 * in (SG v1.3 step 19). The presence check makes the hook idempotent — there
 * is exactly ONE B23 in the game, ever.
 *
 * The plant lives in `AutomaState.corpResources` (serialized, public). The
 * greenery goes through the standard `AutomaTilePlacer.placeGreenery` →
 * `game.addGreenery` pipeline, so oxygen, TR, placement bonuses, milestones,
 * Ares hooks and human on-tile triggers all behave exactly like any other
 * bot greenery — the printed "raises oxygen 1 step" IS the greenery's own
 * standard raise, not an extra one (unlike Lobbyists' oxygen branch).
 */
export const MarsBotEcoline: MarsBotCorp = {
  info: marsBotCorpInfo(MarsBotCorpId.C02_ECOLINE),

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B23_RAPID_SPROUTING)) {
      automa.recurringBonusCards.push(BonusCardId.B23_RAPID_SPROUTING);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.B23_RAPID_SPROUTING);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.B23_RAPID_SPROUTING});
      // Journal-only (no scope): the deck join is public bookkeeping, not an
      // event worth a notification — the card announces itself when flipped.
      // The card name lives IN the template so the RU journal can name it.
      game.log('${0} shuffled Rapid Sprouting into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.B23_RAPID_SPROUTING) {
      throw new Error(`MarsBot Ecoline does not own bonus card ${id}`);
    }
    return rapidSprouting(game);
  },
};

/** B23 Rapid Sprouting. Always ends in the recurring holding (never destroyed). */
function rapidSprouting(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  bumpCorpStat(game, 'sproutingsPlayed');

  if (automa.corpResources >= 1) {
    if (game.board.getAvailableSpacesForGreenery(bot).length === 0) {
      // The action cannot be completed → official Failed Action compensation;
      // the plant stays on the corporation card.
      AutomaTurnLog.setBonusBranch(game, {key: 'No legal space for a greenery'});
      failedAction(game, 'no-tile-space');
      return 'discard';
    }
    AutomaTurnLog.setBonusBranch(game, {key: 'The plant becomes a greenery'});
    automa.corpResources--;
    game.log('${0} removed the plant from its corporation ${1}', (b) => b.player(bot).string('Ecoline'));
    bumpCorpStat(game, 'plantsSpent');
    const oxygenBefore = game.getOxygenLevel();
    // Standard greenery: tile + oxygen (+TR) through game.addGreenery — the
    // card's "raises oxygen 1 step" is that standard raise.
    AutomaTilePlacer.placeGreenery(game);
    bumpCorpStat(game, 'greeneries');
    bumpCorpStat(game, 'oxygenSteps', game.getOxygenLevel() - oxygenBefore);
  } else {
    AutomaTurnLog.setBonusBranch(game, {key: 'A plant grows on the corporation card'});
    automa.corpResources++;
    game.log('${0} added a plant to its corporation ${1}', (b) => b.player(bot).string('Ecoline'));
    bumpCorpStat(game, 'plantsAdded');
  }
  return 'discard'; // In the recurring pool → routeBonusCard keeps it in holding.
}
