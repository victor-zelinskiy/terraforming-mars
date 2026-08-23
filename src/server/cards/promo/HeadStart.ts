import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {noteStep, playPreview, stockGain} from '../actionPreviews';

/** The bonus actions the card hands the player, immediately. */
export const HEAD_START_BONUS_ACTIONS = 2;

/**
 * «Фора» — 2 steel, 2 M€ per project card in hand, and TWO IMMEDIATE ACTIONS.
 *
 * The official card text makes the ORDER the player's: «You may take one or
 * both actions before gaining the M€ and/or steel, but both actions must be
 * taken.» So the play GRANTS everything and executes nothing:
 *
 *  - the two actions ride `IPlayer.bonusActions` (a dedicated, serialized
 *    counter — `Player.takeAction` spends it and serves a turn-control-free
 *    action menu);
 *  - the steel and the M€ ride `IPlayer.pendingBonusGains` — claimable on any
 *    bonus-window prompt without spending an action, auto-resolved when the
 *    window closes. The M€ amount is computed AT CLAIM TIME (2 per project
 *    card then in hand), which is the whole strategic point of the choice.
 *
 * Why the card shipped disabled upstream (issue #5852): the original
 * implementation derived «how many bonus actions are left» from
 * `actionsTakenThisRound`, a counter this engine ALSO increments for every
 * prelude played — one bonus when Head Start was the first prelude, none when
 * it was the second — and the menu it opened still offered «Pass», which put
 * the player into `passedPlayers` before the action phase cleared it and cost
 * them the whole of generation 1.
 */
export class HeadStart extends PreludeCard {
  constructor() {
    super({
      name: CardName.HEAD_START,

      metadata: {
        cardNumber: 'X43',
        // SYMBOLS ONLY. The premium face is an iconography card — the printed
        // sentences belong to the rules blocks below (`infoText` → the card's
        // `information`), never to the face, where three lines of tiny caps
        // read as a wall of text beside every other card in the game.
        renderData: CardRenderer.builder((b) => {
          b.steel(2).br;
          b.megacredits(2).slash().cards(1).br;
          b.arrow().arrow();
        }),
        description: 'Gain 2 steel. Gain 2 M€ per project card you have in hand. Immediately take 2 actions.',
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

          {text: 'You choose when to receive the steel and the M€ — before or after the two actions. The M€ are counted from your hand at that moment.'},

        ],
      },
    });
  }

  /** Exported to `ClientCard` — the start flow declares its bonus chapter
   *  the moment this card is among the picked preludes. */
  public readonly grantsBonusActions = HEAD_START_BONUS_ACTIONS;

  public override bespokePlay(player: IPlayer) {
    // EVERYTHING is granted, nothing is executed: the two actions come off
    // the ledger one real action menu at a time, and the two gains wait for
    // the player's own claim (or the window's end). See the class doc.
    player.grantBonusActions(HEAD_START_BONUS_ACTIONS, this.name, [
      {steel: 2},
      {megacreditsPerCardInHand: 2},
    ]);
    return undefined;
  }

  /**
   * Co-located play preview (`.claude/rules/game-logic.md`): both gains WILL
   * arrive (only their timing is a choice), so they are honest chips — the M€
   * at today's hand size; the two actions are a follow-up no chip can carry,
   * so they get a note.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const megacredits = player.cardsInHand.length * 2;
    return playPreview(
      this,
      player,
      [stockGain(player, Resource.STEEL, 2), stockGain(player, Resource.MEGACREDITS, megacredits)],
      [noteStep('generic', 'After this prelude you take 2 extra actions immediately; you choose whether the steel and M€ arrive before or after them.')]);
  }
}
