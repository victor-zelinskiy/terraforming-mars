import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {DiscardCards} from '../../deferredActions/DiscardCards';
import {cardSource} from '../../inputs/discardPrompt';
import {ColonyName} from '../../../common/colonies/ColonyName';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as actionPreviews from '../actionPreviews';
import * as reason from '../actionReasons';

/** The colony tiles whose BUILD bonus draws cards — a build there grows the hand the discard then reads. */
const DRAWING_BUILDS: ReadonlyArray<ColonyName> = [ColonyName.PLUTO, ColonyName.PLUTO_REDUX];

/**
 * P55 · Old Mining Colony — «Increase your titanium production 1 step. Place 1 colony. Discard 1 card.»
 *
 * THE ORDER IS THE PRINTED ONE AND THE ENGINE'S: the declarative half raises the titanium production and queues the
 * build (`Priority.BUILD_COLONY`, 11, with `cause` = this card — `BuildColony.queuedFor` finds it), then
 * `bespokePlay` queues the discard (`DiscardCards`' class default, `Priority.DISCARD_CARDS`, 24) — the colony is asked
 * FIRST, the discard SECOND. The discard stays bespoke on purpose: the declarative `spend.cards` is a PRICE — it asks
 * before the rest of the behaviour (the discard before the colony, on Pluto before its +2 draw) and refuses a short
 * hand, neither of which is this card.
 *
 * The discard is never mute: with one card left in hand it is discarded automatically (`DiscardCards` records it
 * `{auto: true}`), the preview names that BEFORE the press; an empty hand is a named reason, and the order fix — a
 * prelude that draws first — is declared to the outlook engine (`preludeNeeds: 'cardInHand'`).
 */
export class OldMiningColony extends PreludeCard {
  constructor() {
    super({
      name: CardName.OLD_MINING_COLONY,
      tags: [Tag.SPACE],

      behavior: {
        production: {titanium: 1},
        colonies: {buildColony: {}},
      },

      metadata: {
        cardNumber: 'P55',
        infoText: [
          {kind: 'remainder', text: 'Discard 1 card from your hand.', tokens: ['cards']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.titanium(1)).colonies(1).minus().cards(1);
        }),
        description: 'Increase your titanium production 1 step. Place 1 colony. Discard 1 card.',
      },
    });
  }

  /** The discard reads the hand: nothing in it — the effect cannot resolve, and a prelude that DRAWS can fix that. */
  public readonly preludeNeeds = 'cardInHand' as const;

  public override bespokeCanPlay(player: IPlayer) {
    return player.cardsInHand.length > 0;
  }

  // The colony half has its own reason (the behaviour reasons: «no colony available to build on»); the discard's.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.cardsInHand.length === 0) {
      return reason.ruleReason('No card in hand to discard');
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new DiscardCards(player, 1, 1, undefined, {source: cardSource(this)}));
    return undefined;
  }

  // The two steps IN EXECUTION ORDER — the colony (chosen after the confirm), then the discard. The discard reads the
  // hand as it is now: more than one card → the pick (the live `DiscardCards` asks); exactly one → it is discarded
  // automatically, named. A build on Pluto draws 2 BEFORE the discard is asked — the preview says so, since an «auto»
  // read off the hand now becomes a pick there. Built read-only.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    // The live discard reads the hand AFTER this card has left it — never offer the card itself (a copy / a harness
    // that plays it from the hand).
    const hand = player.cardsInHand.filter((c) => c.name !== this.name);
    const discardStep = hand.length > 1 ?
      actionPreviews.selectCardStep(player, 'Select 1 card to discard', 'Discard', hand, {
        for: {role: 'discard', source: cardSource(this)},
        discard: {min: 1, max: 1, source: cardSource(this)},
      }) :
      actionPreviews.noteStep('generic', 'The last card in hand is discarded automatically');
    const drawingBuild = player.colonies.getPlayableColonies()
      .some((colony) => DRAWING_BUILDS.includes(colony.name));
    return actionPreviews.playPreview(this, player, [], [
      {kind: 'boardPlacement', placementType: 'colony'},
      drawingBuild ? actionPreviews.noteStep('colony', 'A colony on Pluto draws 2 cards first — then you choose the card to discard') : undefined,
      discardStep,
    ]);
  }
}
