import {Resource} from '../../../common/Resource';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {NearBonusBranch, pushNearestBonus} from '../AutomaNearBonusPush';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';

/** The reward of the printed effect (card C05). */
const REWARD_MC = 2;

/** «Lobbyists» is one card with two printings — the base one and the Venus one. */
const LOBBYISTS = [BonusCardId.B06_LOBBYISTS, BonusCardId.B15_LOBBYISTS_VENUS] as const;

/** Which counter a resolved Do It Right branch bumps. */
const BRANCH_STAT: Partial<Record<NearBonusBranch, string>> = {
  temperature: 'doItRightTemperature',
  oxygen: 'doItRightGreeneries',
  ocean: 'doItRightOceans',
};

/**
 * MarsBot Inventrix — official card C05:
 *
 *   SETUP                Destroy Lobbyists from the bonus deck.
 *   EFFECT               When resolving a card with a requirement, MarsBot
 *                        gains 2 MC.
 *   BEFORE ACTION PHASE  Add Do It Right to MarsBot's action deck.
 *
 * plus its corporation-specific bonus card B25 Do It Right, which is the very
 * card the setup box removes: Lobbyists' printed a/b/c options word for word,
 * minus the self-destruction, with «d. No effect» instead of the furthest-
 * parameter fallback, and «at the beginning of every generation, shuffle this
 * into MarsBot's action deck». That is WHY the setup destroys Lobbyists —
 * Inventrix trades a card that fires once for one that fires forever, and the
 * two must never both be in the deck. The ladder itself lives in
 * `AutomaNearBonusPush` so the two cards can never drift apart.
 *
 * LIFECYCLE. B25 rides the same recurring mechanism as Ecoline's B23
 * (`AutomaState.recurringBonusCards` + `AutomaResearch.finishActionDeck`),
 * with the generation-1 insertion done here because the deck was built before
 * the corporation existed. The presence check keeps it idempotent — there is
 * exactly ONE B25 in the game, ever.
 */
export const MarsBotInventrix: MarsBotCorp = {
  info: marsBotCorpInfo(MarsBotCorpId.C05_INVENTRIX),

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    for (const id of LOBBYISTS) {
      const inDeck = automa.bonusDeck.indexOf(id);
      if (inDeck !== -1) {
        automa.bonusDeck.splice(inDeck, 1);
      }
      const inDiscard = automa.bonusDiscard.indexOf(id);
      if (inDiscard !== -1) {
        automa.bonusDiscard.splice(inDiscard, 1);
      }
      // This engine builds generation 1's action deck at game creation —
      // BEFORE the corporation exists — so Lobbyists may already hold that
      // deck's one bonus slot. At the table the setup box runs first and the
      // slot would have gone to the next bonus card: hand it over, so the
      // deck keeps its printed size instead of losing a card.
      const inAction = automa.actionDeck.findIndex((entry) => entry.kind === 'bonus' && entry.id === id);
      if (inAction !== -1) {
        const replacement = automa.bonusDeck.shift();
        if (replacement === undefined) {
          automa.actionDeck.splice(inAction, 1);
        } else {
          automa.actionDeck[inAction] = {kind: 'bonus', id: replacement};
        }
      }
      if (inDeck === -1 && inDiscard === -1 && inAction === -1) {
        continue; // This printing is not part of this game (only one ever is).
      }
      automa.destroyedBonusCards.push(id);
      game.log('${0} destroyed Lobbyists from its bonus deck — Do It Right replaces it',
        (b) => b.player(marsBotOf(game)));
    }
  },

  onProjectCardResolving(game: IGame, card: IProjectCard): void {
    // «A card with a requirement» is the printed requirement row — any of
    // them, met or not: MarsBot never checks requirements, it resolves tags.
    if (card.requirements.length === 0) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: this.info.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.add(Resource.MEGACREDITS, REWARD_MC, {log: false});
      game.log('${0} gained ${1} M€ from its corporation ${2} for resolving a card with a requirement',
        (b) => b.player(bot).number(REWARD_MC).string('Inventrix'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'inventrixTriggers');
    bumpCorpStat(game, 'inventrixMc', REWARD_MC);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B25_DO_IT_RIGHT)) {
      automa.recurringBonusCards.push(BonusCardId.B25_DO_IT_RIGHT);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.B25_DO_IT_RIGHT);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.B25_DO_IT_RIGHT});
      // Journal-only (no scope): the deck join is public bookkeeping, not an
      // event worth a notification — the card announces itself when flipped.
      game.log('${0} shuffled Do It Right into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.B25_DO_IT_RIGHT) {
      throw new Error(`MarsBot Inventrix does not own bonus card ${id}`);
    }
    return doItRight(game);
  },
};

/** B25 Do It Right. Always ends in the recurring holding (never destroyed). */
function doItRight(game: IGame): BonusCardOutcome {
  bumpCorpStat(game, 'doItRightPlayed');
  // The printed third option is the OCEAN one — this card has no Venus
  // variant, and Venus Next changes nothing about it.
  const branch = pushNearestBonus(game, 'ocean');
  const stat = branch === undefined ? undefined : BRANCH_STAT[branch];
  if (stat !== undefined) {
    bumpCorpStat(game, stat);
  } else {
    // «d. No effect» — printed as an outcome, so it is NOT a Failed Action
    // (nothing was attempted and failed; the card simply does nothing).
    AutomaTurnLog.setBonusBranch(game, {key: 'No effect'});
    bumpCorpStat(game, 'doItRightNoEffect');
    game.log('${0} played Do It Right with no parameter close enough — no effect',
      (b) => b.player(marsBotOf(game)));
  }
  return 'discard'; // Recurring: `routeBonusCard` keeps it in the holding pool.
}
