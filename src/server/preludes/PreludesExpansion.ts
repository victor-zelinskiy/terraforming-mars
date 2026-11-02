import {inplaceRemove} from '../../common/utils/utils';
import {Resource} from '../../common/Resource';
import {CardAction, IPlayer} from '../IPlayer';
import {IPreludeCard} from '../cards/prelude/IPreludeCard';
import {SelectCard} from '../inputs/SelectCard';
import {computePreludeOutlooks} from './preludeOutlook';
import {Phase} from '../../common/Phase';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {deckPickPrompt} from '../inputs/deckPickPrompt';
import {cardSource} from '../inputs/choiceContext';
import {ICard} from '../cards/ICard';

export class PreludesExpansion {
  public static fizzle(player: IPlayer, card: IPreludeCard): void {
    player.game.log('${0} fizzled. ${1} gains 15 M€.', (b) => b.card(card).player(player));
    // The 15 M€ have a SOURCE — the prelude that burned: the console's rail
    // reads them as a token born on that card, never an anonymous tick.
    player.stock.add(Resource.MEGACREDITS, 15, {log: false, from: {card}});
    player.defer(() => {
      // This is deferred because it is possible for the parent card to
      // be moved from hand to play area. So, wait until this action finishes and
      // then follow up with cleanup.
      inplaceRemove(player.preludeCardsInHand, card);
      player.playedCards.remove(card);
      player.game.preludeDeck.discard(card);
    });
  }

  /**
   * Is a prelude pick asked RIGHT NOW part of the GAME START, or a pick in the
   * middle of the game (P91 WG Project, and every prelude it plays: New
   * Partner, Merger, Double Down)?
   *
   * The start sequence is the prelude phase (and the CEO / drafting phases
   * around it) PLUS the corporation's mandatory first action — Valley Trust's
   * «draw 3 preludes» runs in `Phase.ACTION` of generation 1, but under the
   * root its first action opened (`corporation-action`). Everything else in
   * the action phase is mid-game. Structural on purpose: a generation number
   * would misfile a chairman's WG Project the moment one is possible in
   * generation 1, and the console routes a start marker to the START scene —
   * raised over the hand that is playing the card that asked.
   */
  public static inStartSequence(player: IPlayer): boolean {
    if (player.game.phase !== Phase.ACTION || PreludesExpansion.startChainDepth > 0) {
      return true;
    }
    return player.game.events?.currentRoot()?.category === 'corporation-action';
  }

  /**
   * A prelude PLAYED from a start pick is still the start (Valley Trust draws
   * New Partner, which draws two more) — but the answer that plays it arrives
   * in a later request, outside the first action's root. The pick decided its
   * side when it was asked, and the play it answers runs inside that decision;
   * a card that asks LATER (Merger's deferred corporation pick) reads it
   * synchronously in its `bespokePlay`.
   */
  private static startChainDepth = 0;

  private static playInStartChain(fn: () => void): void {
    PreludesExpansion.startChainDepth++;
    try {
      fn();
    } finally {
      PreludesExpansion.startChainDepth--;
    }
  }

  /**
   * The MID-GAME prelude pick's marker: the deck-pick family's own, over the
   * PRELUDE deck, in `play` mode (the pick is played at once, the rest is
   * discarded) — the second, documented attachment point of the marker (see
   * `inputs/deckPickPrompt.ts`).
   */
  private static markMidGamePick(selectCard: SelectCard<IPreludeCard>, cards: ReadonlyArray<IPreludeCard>, source: ChoiceContextSource | undefined): void {
    selectCard.markDeckPickPrompt(deckPickPrompt({
      revealed: cards.length,
      min: 1,
      max: 1,
      origin: 'prelude',
      mode: 'play',
      source,
    }));
  }

  /**
   * Return a `SelectCard` that asks a `player` to choose one of the `cards` to play,
   * and then plays it.
   *
   * `opts.source` names the card that drew the preludes (WG Project, New
   * Partner, Double Down) — the console anchors a mid-game pick on it.
   */
  public static selectPreludeToPlay(
    player: IPlayer,
    cards: Array<IPreludeCard>,
    remainders: undefined | 'discard' = undefined,
    cardAction: CardAction = 'add',
    opts: {source?: ICard} = {}): SelectCard<IPreludeCard> {
    // This preps the warning attribute in preludes.
    // All preludes can be presented. Unplayable ones just fizzle.
    //
    // ORDER-AWARE: `preludeFizzle` answers «not now», which is one bit and was
    // read by the UI as both «wait for another prelude» and «this is over» — so
    // it once advertised the order fix over a button that burned the card. The
    // structured verdict (`computePreludeOutlooks`) is the SAME question asked
    // properly, and the legacy warning is DERIVED from it here, so the two can
    // never disagree. The verdict the CLIENT reads is recomputed on every
    // serialization instead (`SelectCard.toModel`): a warning set at prompt
    // creation is wiped by anything that later re-evaluates the card, and a
    // verdict that silently disappears is worse than no verdict at all.
    const outlooks = computePreludeOutlooks(player, cards, player.preludeCardsInHand);
    for (const card of cards) {
      card.clearWarnings();
      const outlook = outlooks.get(card.name);
      if (outlook !== undefined && outlook.state !== 'playable') {
        card.addWarning('preludeFizzle');
      }
      if (card.behavior?.addResources && player.game.inDoubleDown) {
        card.addWarning('ineffectiveDoubleDown');
      }
    }

    // 'hand' = the player's own starting preludes (Player.takeAction plays them
    // one at a time); 'draw' = freshly drawn preludes where the player picks ONE
    // and the rest are discarded (New Partner / Valley Trust); 'copy' = pick one
    // ALREADY-PLAYED prelude to copy (Double Down, `cardAction === 'double-down'`)
    // — the source stays in play, nothing is discarded, so the premium modal must
    // NOT drop it from the grid. Authoritative on the server, so the modal never
    // has to guess (and `cardAction` is the only reliable signal for 'copy' —
    // Double Down's candidates are played preludes, but can include New Partner
    // from the hand, so a cards-vs-hand check would misclassify it).
    const preludeMode: 'hand' | 'draw' | 'copy' =
      cardAction === 'double-down' ?
        'copy' :
        (cards.every((c) => player.preludeCardsInHand.includes(c)) ? 'hand' : 'draw');
    const selectCard = new SelectCard('Select prelude card to play', 'Play', cards);
    const midGame = !PreludesExpansion.inStartSequence(player);
    if (midGame) {
      const source = opts.source !== undefined ? cardSource(opts.source) : undefined;
      if (preludeMode === 'copy') {
        // A copy picks among the player's OWN played preludes — a card
        // target named by its asker, not a reveal off a deck.
        selectCard.markChoiceContext({source: source ?? {kind: 'system'}, mode: 'effect-choice'});
      } else {
        PreludesExpansion.markMidGamePick(selectCard, cards, source);
      }
    } else {
      selectCard.markStartGamePrompt({kind: 'preludeSelection', preludeMode});
    }
    return selectCard
      .andThen(([card]) => {
        if (card.canPlay?.(player) === false) {
          PreludesExpansion.fizzle(player, card);
        } else {
          if (cardAction === 'double-down') {
            player.game.doubleDownPrelude = card.name;
          }
          const play = () => player.playCard(card, undefined, cardAction);
          if (midGame) {
            play();
          } else {
            PreludesExpansion.playInStartChain(play);
          }
        }
        if (remainders === 'discard') {
          const discarded = cards.filter((c) => c !== card);
          for (const c of discarded) {
            player.game.preludeDeck.discard(c);
          }
          // Mid-game the discard pile is a pile on the table, face up —
          // public: say what went there.
          if (midGame && discarded.length > 0) {
            player.game.log('${0} discards preludes ${1}', (b) => b.player(player).cards(discarded));
          }
        }
        return undefined;
      });
  }
}
