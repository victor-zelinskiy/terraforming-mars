import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {CardType} from '../../../common/cards/CardType';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {noteStep, playPreview, stockGain} from '../actionPreviews';

/** The bonus actions the card hands the player, immediately. */
export const HEAD_START_BONUS_ACTIONS = 2;

/**
 * «Фора» — 2 steel, 2 M€ per project card in hand, and TWO IMMEDIATE ACTIONS.
 *
 * The bonus actions are the whole card, and they are the reason it shipped
 * disabled upstream (issue #5852): the original implementation derived «how
 * many bonus actions are left» from `actionsTakenThisRound`, a counter this
 * engine ALSO increments for every prelude played, so the card handed out one
 * bonus action when it was the player's first prelude and none when it was
 * their second — and the menu it opened still offered «Pass», which put the
 * player into `passedPlayers` before the action phase had cleared it and cost
 * them the whole of generation 1.
 *
 * The rewrite grants a DEDICATED, serialized counter (`IPlayer.bonusActions`);
 * `Player.takeAction` spends it and serves a turn-control-free action menu.
 */
export class HeadStart extends PreludeCard {
  constructor() {
    super({
      name: CardName.HEAD_START,

      behavior: {
        stock: {
          steel: 2,
        },
      },

      metadata: {
        cardNumber: 'X43',
        renderData: CardRenderer.builder((b) => {
          b.steel(2).br;
          b.text('GAIN 2 STEEL.', Size.TINY).br;
          b.megacredits(1, {text: '?'}).br;
          b.text('GAIN 2 M€ PER PROJECT CARD YOU HAVE IN HAND.', Size.TINY, true, false).br;
          b.arrow().arrow().br;
          b.text('IMMEDIATELY TAKE 2 ACTIONS.', Size.TINY, true, false).br;
        }),
        // Authored by hand: no `behavior` field describes «take two actions
        // now», so the generator cannot see the card's main mechanic. One
        // block per bonus, in render (= execution) reading order.
        infoText: [

          {text: 'Gain 2 steel.', tokens: ['steel']},

          {text: 'Gain 2 M€ for each project card in your hand.', tokens: ['megacredits']},

          // Deliberately UNLINKED: the double-arrow row this rule belongs to
          // produces no graphic id, and the only other handle («text») would
          // tether it to the FIRST printed line — a backwards jump the render
          // reading-order guard would rightly reject.
          {text: 'Take 2 extra actions immediately, before your remaining preludes. They are additional to the two actions of your normal turn, so you cannot pass or end your turn during them.'},

        ],
      },
    });
  }

  private static PROJECT_CARD_TYPES = [CardType.ACTIVE, CardType.AUTOMATED, CardType.EVENT];

  private static projectCardsInHand(player: IPlayer): number {
    return player.cardsInHand.filter((card) => HeadStart.PROJECT_CARD_TYPES.includes(card.type)).length;
  }

  public override bespokePlay(player: IPlayer) {
    const megacredits = HeadStart.projectCardsInHand(player) * 2;
    player.stock.add(Resource.MEGACREDITS, megacredits, {log: true});
    // The two immediate actions. GRANTED, not executed: `takeAction` hands the
    // player a real action menu (minus Pass / End Turn) once per bonus, and the
    // counter is what the «БОНУСНОЕ ДЕЙСТВИЕ 1 / 2» readout and the console's
    // board hand-off both read.
    player.grantBonusActions(HEAD_START_BONUS_ACTIONS, this.name);
    return undefined;
  }

  /**
   * Co-located play preview (`.claude/rules/game-logic.md`): the steel is
   * declarative and auto-included, the M€ scales with the hand (so it must be
   * computed), and the two actions are a follow-up no chip can carry — they get
   * an honest note instead of being silently absent.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const megacredits = HeadStart.projectCardsInHand(player) * 2;
    return playPreview(
      this,
      player,
      [stockGain(player, Resource.MEGACREDITS, megacredits)],
      [noteStep('generic', 'After this prelude you take 2 extra actions immediately.')]);
  }
}
