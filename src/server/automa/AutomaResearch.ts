import {BonusCardId} from '../../common/automa/AutomaTypes';
import {CardResource} from '../../common/CardResource';
import {inplaceShuffle} from '../utils/shuffle';
import {IGame} from '../IGame';
import {IProjectCard} from '../cards/IProjectCard';
import {AutomaActionCard, AutomaState} from './AutomaState';
import {marsBotOf} from './AutomaUtil';

/**
 * MarsBot's Research Phase (generation 2+).
 *
 * Non-draft (rulebook p.4): 3 project cards (4 on Brutal) + 1 bonus card
 * (reshuffling the bonus discard — never the destroyed cards — when the bonus
 * deck is empty) + every recurring card, shuffled.
 *
 * Draft variant: AutomaDraft collects the bot's 4 drafted cards and hands them
 * to `finishDraftedActionDeck`.
 *
 * Floater spending (Adding Expansions p.2, also active with Colonies alone):
 * at the end of the Research Phase, if the Hoverlord milestone is no longer
 * available to be claimed and MarsBot has 5+ floaters, it spends 5 floaters —
 * non-draft: gains an extra project card; draft: keeps its 4th drafted card
 * instead of discarding it; Brutal (which always keeps all 4): gains an extra
 * card from the project deck in both variants.
 */
export class AutomaResearch {
  /** Bonus deck empty → reshuffle the discard pile face down. Destroyed cards live elsewhere. */
  public static reshuffleBonusDeckIfEmpty(game: IGame, automa: AutomaState): void {
    if (automa.bonusDeck.length === 0 && automa.bonusDiscard.length > 0) {
      automa.bonusDeck = automa.bonusDiscard;
      automa.bonusDiscard = [];
      inplaceShuffle(automa.bonusDeck, game.rng);
    }
  }

  /**
   * "No longer available to be claimed": claimed already, the 3-milestone limit
   * is reached, or Hoverlord is not part of this game at all — which by RB-C p.4
   * is exactly the "playing without Venus Next" case ("assuming that the
   * Hoverlord Milestone is no longer available").
   */
  public static hoverlordUnavailable(game: IGame): boolean {
    const hoverlord = game.milestones.find((m) => m.name === 'Hoverlord');
    if (hoverlord === undefined) {
      return true;
    }
    if (game.claimedMilestones.length >= 3) {
      return true;
    }
    return game.claimedMilestones.some((cm) => cm.milestone.name === 'Hoverlord');
  }

  /**
   * The end-of-Research floater spend. Returns true when 5 floaters were spent
   * (the caller then keeps the 4th drafted card / draws an extra card).
   */
  public static trySpendFloaters(game: IGame): boolean {
    const automa = game.automa;
    if (automa === undefined || automa.floaters < 5) {
      return false;
    }
    if (!AutomaResearch.hoverlordUnavailable(game)) {
      return false;
    }
    automa.floaters -= 5;
    game.log('${0} spent ${1} ${2} for an extra action card', (b) => b.player(marsBotOf(game)).number(5).cardResource(CardResource.FLOATER));
    return true;
  }

  /**
   * Common tail of every Research Phase deck build: move Shipping Lines (and,
   * once the 2nd trade fleet is unlocked, Extended Shipping Lines) into the
   * recurring pool — they join "after the Research Phase... excluding the first
   * round" (RB-C p.4), and this runs only from generation 2 on — then add the
   * top bonus card + every recurring card and shuffle.
   */
  public static finishActionDeck(game: IGame, projectEntries: Array<AutomaActionCard>): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    if (game.gameOptions.coloniesExtension) {
      AutomaResearch.moveSetAsideToRecurring(automa, BonusCardId.B19_SHIPPING_LINES);
      if (automa.secondFleetUnlocked) {
        AutomaResearch.moveSetAsideToRecurring(automa, BonusCardId.B20_EXTENDED_SHIPPING_LINES);
      }
    }

    const actionDeck = [...projectEntries];
    AutomaResearch.reshuffleBonusDeckIfEmpty(game, automa);
    const topBonus = automa.bonusDeck.shift();
    if (topBonus !== undefined) {
      actionDeck.push({kind: 'bonus', id: topBonus});
    }
    for (const recurring of automa.recurringBonusCards) {
      actionDeck.push({kind: 'bonus', id: recurring});
    }
    inplaceShuffle(actionDeck, game.rng);
    automa.actionDeck = actionDeck;
  }

  private static moveSetAsideToRecurring(automa: AutomaState, id: BonusCardId): void {
    const idx = automa.setAsideBonusCards.indexOf(id);
    if (idx !== -1) {
      automa.setAsideBonusCards.splice(idx, 1);
      automa.recurringBonusCards.push(id);
    }
  }

  /** The non-draft Research Phase build. */
  public static buildActionDeck(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    let projectCount = automa.difficulty === 'brutal' ? 4 : 3;
    if (AutomaResearch.trySpendFloaters(game)) {
      projectCount++; // Normal: a 4th card; Brutal: a 5th.
    }
    const projectEntries: Array<AutomaActionCard> =
      game.projectDeck.drawN(game, projectCount).map((card) => ({kind: 'project' as const, name: card.name}));
    AutomaResearch.finishActionDeck(game, projectEntries);
  }

  /**
   * The draft-variant build: called by AutomaDraft with the bot's 4 drafted
   * cards. "Shuffle the cards MarsBot drafted, then discard 1 card to the
   * project discard pile" — Brutal keeps all 4; the floater spend keeps the 4th
   * too (Brutal spends floaters for an extra card from the deck instead).
   */
  public static finishDraftedActionDeck(game: IGame, draftedCards: Array<IProjectCard>): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const drafted = [...draftedCards];
    inplaceShuffle(drafted, game.rng);

    const spentFloaters = AutomaResearch.trySpendFloaters(game);
    if (automa.difficulty === 'brutal') {
      if (spentFloaters) {
        const extra = game.projectDeck.draw(game);
        if (extra !== undefined) {
          drafted.push(extra);
        }
      }
    } else if (!spentFloaters) {
      const discarded = drafted.shift();
      if (discarded !== undefined) {
        game.projectDeck.discard(discarded);
      }
    }
    AutomaResearch.finishActionDeck(game, drafted.map((card) => ({kind: 'project' as const, name: card.name})));
  }
}
