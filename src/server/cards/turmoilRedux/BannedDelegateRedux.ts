import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {NO_DELEGATE_ON_TABLE_REASON, RemoveDelegate} from '../../parliament/RemoveDelegate';
import {all} from '../Options';
import * as actionPreviews from '../actionPreviews';

/** The printed «− [delegate]» in the red «any player» frame — ONE delegate, anybody's. */
export const DELEGATES_REMOVED = 1;

/**
 * TR72 — BANNED DELEGATE («Изгнание делегата»), the Turmoil Redux REPLACEMENT of the classic Turmoil T02 —
 * the SECOND of the set's seven replacements (`common/cards/turmoilReduxReplacements.ts`,
 * `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2), registered as `Banned Delegate:redux` (the plain name stays
 * the classic card's; the Redux manifest's `cardsToRemove` keeps the classic one out of every Redux deck).
 * The FIRST card that takes ONE cube of anybody's off the Parliament's table: the step is the shared
 * `parliament/RemoveDelegate` (the figures, the forecast, the prompt, the named skip), the requirement is
 * the TR12 class (`{chairman: true}` — the facade, the named reason, the chair glyph). Nothing of the classic
 * card's engine (`Turmoil`, `SelectDelegate`, the party leader) is carried over: under Redux the delegates
 * stand on RESOLUTIONS and in POPULAR SUPPORT areas, never in a party.
 *
 * SCAN READING — cost 0; the yellow disc with the down arrow is the EVENT marker, never a tag: `tags` is
 * empty. The orange MIN box beside the cost holds the seated figure — the CHAIRMAN, the requirement. One
 * row: «−» and a white delegate in the red «any player» frame (`delegates(1, {all})` — the classic card's
 * own row). No VP badge. The module's symbol at the bottom left only (no `compatibility`). The number box
 * prints the placeholder «TR00» (all six project replacements do) — the card is TR72, the second project
 * row of the replacement registry. Printed lore: «You are not welcome in our chambers.» — keyed `T02` in
 * `lore_texts.json` (the owner's line, 2026-10-24) and borrowed with the T02 art through `reimplements`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/BannedDelegateRedux.spec.ts):
 *  1. «Requires you to be Chairman» — the player's delegate holds the chair NOW (`politics.isChairman`),
 *     checked at the play only; the hand names who holds it instead.
 *  2. «Remove ANY delegate» — anybody's: an opponent's, MarsBot's, the neutral player's, the player's own.
 *     NO «non-leader» clause (the classic card's is gone): the leader's cube is a target too.
 *  3. «…from a resolution or Popular Support area» — a resolution UP FOR A VOTE (the enacted card is not
 *     one) or a party's support area (neutral cubes); never the chairman's seat, never the lobby.
 *  4. Which of an owner's cubes on a resolution leaves is the rule's: the LATEST (the earliest is the
 *     owner's tie-breaker). A seat's cube returns to its reserve, a neutral one to the common supply; the
 *     leader, the winner, every party effect re-read the table at once. The sitting's
 *     `onDelegatesDiscarded` is never called.
 *  5. No figure anywhere → the card is NOT playable (an event whose only effect would hit nothing),
 *     with the named reason `NO_DELEGATE_ON_TABLE_REASON`.
 *  6. PREVIEW = EXECUTION: the staged door into the Parliament's delegate mode carries the very prompt
 *     the play raises, with the server's forecast for every figure.
 *  7. MarsBot never plays the card; its cubes are targets like a human's.  8. Save / load: an ordinary card.
 */
export class BannedDelegateRedux extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.BANNED_DELEGATE_REDUX,
      type: CardType.EVENT,
      tags: [],
      cost: 0,
      // Rule 1 — the TR12 class: the facade's chair, the named reason.
      requirements: {chairman: true},

      metadata: {
        cardNumber: 'TR72',
        // The classic T02's art and lore — the same illustration and the printed quote.
        reimplements: CardName.BANNED_DELEGATE,
        renderData: CardRenderer.builder((b) => {
          b.minus().delegates(DELEGATES_REMOVED, {all});
        }),
        description: 'Requires you to be Chairman. Remove any delegate from a resolution or Popular Support area.',
      },
    });
  }

  /** THE step `bespokePlay` defers — built once, asked by the preview (its twin), by the play and by the gate. */
  private removal(player: IPlayer): RemoveDelegate {
    return new RemoveDelegate(player, {kind: 'card', card: this.name});
  }

  /** Rule 5 — a figure must stand somewhere the card reaches. */
  public override bespokeCanPlay(player: IPlayer): boolean {
    const parliament = player.game.parliament;
    return parliament !== undefined && RemoveDelegate.targetsOf(player.game, parliament).length > 0;
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    return this.bespokeCanPlay(player) ? undefined : {type: 'target', message: NO_DELEGATE_ON_TABLE_REASON};
  }

  public override bespokePlay(player: IPlayer) {
    if (player.game.parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate).
      return undefined;
    }
    player.game.defer(this.removal(player));
    return undefined;
  }

  /** Rule 6 — the DOOR into the Parliament's delegate mode, the very prompt the play raises. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [actionPreviews.delegateRemovalStep(this, this.removal(player))]);
  }
}
