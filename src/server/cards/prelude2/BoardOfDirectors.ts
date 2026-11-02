import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';
import {IActionCard} from '../ICard';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {message} from '../../logs/MessageBuilder';
import {PreludesExpansion} from '../../preludes/PreludesExpansion';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {IPreludeCard} from '../prelude/IPreludeCard';
import {cardSource} from '../../inputs/choiceContext';
import {TITLES} from '../../inputs/titles';
import {DeckPickPlayPrice} from '../../../common/models/PlayerInputModel';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** The printed price of playing the drawn prelude («pay 12 M€ …»). */
export const BOARD_OF_DIRECTORS_PRICE = 12;
/** How many directors the play removes from this card («… and remove 1 director resource from here»). */
export const BOARD_OF_DIRECTORS_DIRECTORS_PER_PLAY = 1;
/** WHY the action is blocked when the prelude deck cannot deal — ONE honest reason (`canDraw` counts the discard pile too). */
export const BOARD_OF_DIRECTORS_DECK_REASON = 'The prelude deck is empty';

/**
 * P45 — BOARD OF DIRECTORS («Совет директоров»), a Prelude 2 prelude: Earth tag, «add 4 director resources here»,
 * and an ACTION — «draw 1 prelude card: either discard it, or pay 12 M€ and remove 1 director resource from here to
 * play it». The only prelude of the set that PLAYS OTHER PRELUDES mid-game, by a repeatable action, with a price and a
 * decision AFTER the reveal.
 *
 * SCAN READING — the PRELUDE frame, the Earth disc top right; the action block «ACTION →» printed as TEXT (no result
 * icons); four square bust icons (the director resource) under it and «(Add 4 director resources here.)». Lore:
 * «Strong voices in the board room, advocating for ambitious and sometimes unrealistic ideas».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/BoardOfDirectors.spec.ts):
 *  1. ACTION — available while a director is on the card AND the prelude deck can deal (draw pile + discard pile);
 *     otherwise blocked and NAMED (the directors' «0 of 1», or «The prelude deck is empty»). Money is NOT a gate:
 *     drawing and discarding is a real effect (the deck turns), so the action stays open without the 12 M€.
 *  2. The drawn prelude is ALWAYS SHOWN — and named publicly (it either goes face up to the prelude discard pile or is
 *     played; nothing about it stays hidden). The fork replaces upstream's silent discard without the 12 M€ (and its
 *     public-anonymous + reserved log pair): the prompt is asked with `max 0`, so the player SEES what was drawn and
 *     lets it go knowingly (no silent loss, no hidden target).
 *  3. THE VERDICT is ONE question (`PreludesExpansion.selectPreludeToPlay` in verdict mode — the deck-pick marker in
 *     `play` mode with the PRICE): `[]` → the prelude discard pile; `[card]` → pay 12 M€ (a payment prompt only when
 *     the server WILL ask one — Helion's heat; its `cause` names this card so a pre-selected payment lands) → remove 1
 *     director → play it, or burn it for 15 M€ when its effect cannot resolve (the 12 M€ and the director stay spent —
 *     the upstream rule). The «will fizzle» verdict is judged with the 12 M€ held back.
 *  4. PREVIEW — one branch, `revealVerdict` (the deck, the price with the directors, affordability and the deficit,
 *     the open counts); nothing counted in the effects (the result is the deck's and the player's). Read-only.
 */
export class BoardOfDirectors extends PreludeCard implements IActionCard {
  constructor() {
    super({
      name: CardName.BOARD_OF_DIRECTORS,
      tags: [Tag.EARTH],
      resourceType: CardResource.DIRECTOR,

      behavior: {
        addResources: 4,
      },

      metadata: {
        cardNumber: 'P45',
        // The action browser's one-liner: the full rule is over the caption budget (tests/cards/actionCaption.spec.ts).
        infoText: [{kind: 'action-short', text: 'Draw a prelude: discard, or 12 M€ + director to play'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Draw 1 prelude card. Either discard it, or pay 12 M€ and remove 1 director resource from here to play it.', (eb) => {
            eb.empty().startAction.prelude().colon().megacredits(BOARD_OF_DIRECTORS_PRICE).resource(CardResource.DIRECTOR).asterix();
          });
          b.br;
          b.resource(CardResource.DIRECTOR, 4);
        }),
        description: 'Add 4 director resources here.',
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return this.resourceCount >= BOARD_OF_DIRECTORS_DIRECTORS_PER_PLAY && player.game.preludeDeck.canDraw(1);
  }

  /** Rule 1 — one blocker, the directors first (the card's own stock), the deck second. */
  public actionUnavailableReason(player: IPlayer) {
    if (this.resourceCount < BOARD_OF_DIRECTORS_DIRECTORS_PER_PLAY) {
      return actionReason.resourcesHereShort(CardResource.DIRECTOR, this.resourceCount, BOARD_OF_DIRECTORS_DIRECTORS_PER_PLAY);
    }
    if (!player.game.preludeDeck.canDraw(1)) {
      return actionReason.ruleReason(BOARD_OF_DIRECTORS_DECK_REASON);
    }
    return undefined;
  }

  /** The price of the «play it» outcome — ONE builder for the preview and the verdict's marker. */
  public playPrice(player: IPlayer): DeckPickPlayPrice {
    const deficit = player.affordabilityDeficitFor({cost: BOARD_OF_DIRECTORS_PRICE});
    return {
      megacredits: BOARD_OF_DIRECTORS_PRICE,
      resourcesHere: {card: this.name, resource: CardResource.DIRECTOR, count: BOARD_OF_DIRECTORS_DIRECTORS_PER_PLAY, have: this.resourceCount},
      affordable: deficit === 0,
      ...(deficit > 0 ? {deficit} : {}),
    };
  }

  private payment(player: IPlayer): SelectPaymentDeferred {
    return new SelectPaymentDeferred(player, BOARD_OF_DIRECTORS_PRICE, {title: TITLES.payForCardAction(this.name), cause: cardSource(this)});
  }

  /** Rule 4 — the verdict reveal, structure only. */
  public actionPreview(player: IPlayer): ActionPreview {
    const deck = player.game.preludeDeck;
    return actionPreviews.singleBranch(this, player, [], [], {revealVerdict: {
      deck: 'prelude',
      count: 1,
      deckSize: deck.drawPile.length,
      discardSize: deck.discardPile.length,
      play: this.playPrice(player),
      miss: {kind: 'discard'},
    }});
  }

  public action(player: IPlayer) {
    const game = player.game;
    const prelude = game.preludeDeck.drawOrThrow(game);
    // Rule 2 — the draw is public, named, and a fact.
    game.events?.recordCardReveal(player, this, {origin: 'prelude', result: 'revealed', count: 1});
    game.log('${0} draws a prelude from ${1}: ${2}', (b) => b.player(player).card(this).card(prelude),
      {reveal: {origin: 'prelude', result: 'revealed', source: this.name}});

    // Rule 3 — ONE verdict.
    return PreludesExpansion.selectPreludeToPlay(player, [prelude], undefined, 'add', {
      source: this,
      verdict: {
        title: message('Play ${0} for 12 M€ and 1 director, or discard it', (b) => b.card(prelude)),
        price: this.playPrice(player),
        payment: this.payment(player).previewPaymentModel(),
        resolve: (card) => card === undefined ? this.discard(player, prelude) : this.buy(player, card),
      },
    });
  }

  private discard(player: IPlayer, prelude: IPreludeCard): void {
    player.game.preludeDeck.discard(prelude);
    player.game.log('${0} discards ${1} to the prelude discard pile', (b) => b.player(player).card(prelude));
  }

  /** Rule 3 — the price FIRST (M€, then the director), the play after. */
  private buy(player: IPlayer, prelude: IPreludeCard): void {
    const game = player.game;
    game.defer(this.payment(player)).andThen(() => {
      player.removeResourceFrom(this, BOARD_OF_DIRECTORS_DIRECTORS_PER_PLAY, {log: false});
      game.log('${0} pays 12 M€ and 1 director to play ${1}', (b) => b.player(player).card(prelude));
      PreludesExpansion.playOrFizzle(player, prelude);
    });
  }
}
