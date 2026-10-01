import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {SpaceType} from '../../../common/boards/SpaceType';
import {BoardType} from '../../boards/BoardType';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {Size} from '../../../common/cards/render/Size';
import {CardRenderer} from '../render/CardRenderer';
import {all, digit} from '../Options';
import {PlayerInput} from '../../PlayerInput';
import {Priority} from '../../deferredActions/Priority';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastTile} from '../EffectForecastContext';
import * as placementPreviews from '../placementPreviews';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';
import {censusAction, censusActionPreview} from './censusAction';

/**
 * TR15 — MARTIAN CENSUS («Марсианская перепись»), the thirteenth Turmoil Redux
 * PROJECT card — and the set's FIRST card with a PARTY REQUIREMENT (TR14–TR27
 * and more follow with the same plate; what this card did for the requirement
 * — the emblem on the face, the named reason with its «now», the hand's
 * counter — they all inherit).
 *
 * SCAN READING — cost 6; one tag in the corner (the red planet: Mars). The
 * orange MIN plate beside the cost holds the MARS FIRST emblem: the
 * REQUIREMENT («Requires Mars First to be ruling or that you have 2 delegates
 * there»), never a tag. No VP badge. One row split by a vertical rule: on the
 * left the EFFECT — a city hex in the red «any player» frame with a small
 * ORANGE HEX at its shoulder («on Mars», the set's icon language) : one data;
 * on the right the ACTION in two lines — «→ [data] OR» / «3 [data] → [delegate]».
 * The purple Turmoil symbol at the bottom left is the module itself (no
 * `compatibility`). The card holds data (`CardResource.DATA`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MartianCensus.spec.ts):
 *  1. The requirement is `{party: MARS}`: Mars First RULES, or the player has 2
 *     delegates on its resolution in the Voting Area (rulebook p.13). Checked
 *     at the PLAY only — the effect and the action work whatever rules later.
 *     A party effect GRANTED by a card (Septem Tribus, Council Seat) is not a
 *     road (FAQ p.19). The unmet requirement is a NAMED reason: the party, «does
 *     not rule», the delegates on its resolution N of 2 — or that resolution is
 *     not up for a vote (`unplayableReasons` → `PARTY_REQUIREMENT_REASON`).
 *  2. The effect: whenever ANY player — the owner, an opponent, MarsBot —
 *     places a CITY ON MARS, +1 data on THIS card. «On Mars» excludes every
 *     off-Mars cell (Ganymede, Phobos and the other `SpaceType.COLONY` slots —
 *     the Tharsis Republic reading) and the Moon (`BoardType`); the Capital IS
 *     a city; a city placed ON TOP of one's own city by the Skyscrapers law is
 *     a tile placed (FAQ p.19) and counts. Greeneries and oceans never do.
 *     The card places no city itself — nothing to model at its own play.
 *  3. Action A: +1 data on THIS card. Always available.
 *  4. Action B: 3 data off THIS card → 1 delegate onto a resolution of the
 *     VOTING AREA, by the grant's law (reserve, free, the lobby's cube
 *     untouched). Refused by ONE reason in order: fewer than 3 data («N of 3
 *     data on this card»), no resolution up for a vote, no delegate in the
 *     reserve. A refused B is shown disabled, never hidden.
 *  5. The card's delegate is an ordinary delegate (the vote count, the party
 *     effect at two, a «delegates» chairman quest, TR02's requirement, any
 *     card's party requirement). The data leave and the cube lands in ONE
 *     answer — the data are the grant's PRICE (`PlaceDelegatesOnResolution`
 *     `price`): «paid and placed nothing» cannot happen.
 *  6. The action is an ordinary blue-card action: once per generation, A OR B.
 *  7. Data here are ordinary card resources: «data on ANY card» (TR01, Pluto)
 *     may land here; resource attacks take the shared path.
 *  8. MarsBot never plays the card; its cities ARE counted (rule 2).
 *
 * SISTER: TR24 Venusian Census prints the same action word for word (Unity's
 * requirement, a Venus-step trigger) — the action lives in `censusAction.ts`,
 * shared, so TR24 takes it without a copy.
 */
export class MartianCensus extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.MARTIAN_CENSUS,
      type: CardType.ACTIVE,
      tags: [Tag.MARS],
      cost: 6,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.MARS},

      metadata: {
        cardNumber: 'TR15',
        infoText: [
          {kind: 'effect-short', text: 'Any city placed on Mars: add a data here', tokens: ['city']},
          // B's full rule is 57 (RU ≈ 78) — over the browser's caption budget; A reads short as printed.
          {kind: 'action-short', text: 'Spend 3 data for a delegate on a resolution', tokens: ['delegates']},
        ],
        // The scan splits the row with a vertical rule (the effect | the two actions); the DSL has no
        // vertical divider, so the effect stands on its own row above the action pair.
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever ANY player places a city on Mars, add a data resource to this card.', (eb) => {
            eb.city({size: Size.SMALL, all}).asterix().startEffect.resource(CardResource.DATA);
          }).br;
          b.action('Add 1 data resource here.', (eb) => {
            eb.empty().startAction.resource(CardResource.DATA);
          }).br;
          b.or().br;
          b.action('Spend 3 data from here to add a delegate to a resolution.', (eb) => {
            eb.resource(CardResource.DATA, {amount: 3, digit}).startAction.delegates(1);
          });
        }),
      },
    });
  }

  /** Rule 2 — ANY player's city ON MARS (never off Mars, never the Moon): +1 data here. */
  private countsCity(space: Space, boardType: BoardType): boolean {
    return boardType === BoardType.MARS && Board.isCitySpace(space) && space.spaceType !== SpaceType.COLONY;
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, boardType: BoardType) {
    if (this.countsCity(space, boardType)) {
      cardOwner.game.defer(
        new AddResourcesToCard(cardOwner, CardResource.DATA, {filter: (c) => c.name === this.name}),
        cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined,
      );
    }
  }

  /** The forecast mirror of `onTilePlaced` — the same predicate: a city, and not on a reserved off-Mars slot. */
  public tilePlacedForecast(cardOwner: IPlayer, activePlayer: IPlayer, tile: EffectForecastTile): ReadonlyArray<EffectForecastFact> {
    if (!tile.countsAsCity || tile.offMars) {
      return [];
    }
    return [forecast.deferred(forecast.sourceOf(this, cardOwner, 'tile-placed'),
      [actionPreviews.cardGain(this, tile.count)],
      'A city tile is placed on Mars', {
        recipient: forecast.recipientOf(activePlayer, cardOwner),
        sequence: forecast.triggerSequence(cardOwner, activePlayer),
      })];
  }

  /** The placement dossier's mirror of `onTilePlaced`: a city about to land on a Mars cell pays a data here. */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!ctx.countsAsCity || space.spaceType === SpaceType.COLONY) {
      return [];
    }
    return [placementPreviews.cardResourceGain(this, CardResource.DATA, 1, 'City placed on Mars', {
      recipient: placementPreviews.recipientOf(activePlayer, cardOwner),
    })];
  }

  /** Branch A is always open (rule 3). */
  public canAct(): boolean {
    return true;
  }

  public action(player: IPlayer): PlayerInput | undefined {
    return censusAction(player, this);
  }

  public actionPreview(player: IPlayer): ActionPreview {
    return censusActionPreview(player, this);
  }
}
