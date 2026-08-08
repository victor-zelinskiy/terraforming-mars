import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {TileType} from '../../../common/TileType';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {Space} from '../../boards/Space';
import {cathedral} from '../render/DynamicVictoryPoints';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {Board} from '../../boards/Board';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {TITLES} from '../../inputs/titles';
import {message} from '../../logs/MessageBuilder';
import {Resource} from '../../../common/Resource';
import {chip, optionResult, skip} from '../../inputs/optionMetadata';
import {cardEffect} from '../../inputs/choiceContext';
import {AutomaResolver} from '../../automa/AutomaResolver';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

const ACTION_COST = 5;
/** What the CITY OWNER may pay to draw a card once a cathedral lands there. */
const OWNER_CARD_COST = 2;

export class StJosephOfCupertinoMission extends Card implements IActionCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.ST_JOSEPH_OF_CUPERTINO_MISSION,
      cost: 7,
      victoryPoints: 'special',

      metadata: {

        infoText: [
          {kind: 'action-short', text: 'Build a cathedral in a city for 5 M€'},

          {kind: 'victory-points', text: '1 VP per City with a Cathedral in it.'},

        ],
        cardNumber: 'X64',
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 5 M€ (STEEL MAY BE USED) to build 1 Cathedral in a city. Max 1 per city. City owner can pay 2 M€ to draw 1 card.', (eb) => {
            eb.megacredits(5).super((b) => b.steel(1)).startAction.cathedral().asterix();
          });
        }),
        description: '1 VP per City with a Cathedral in it.',
        victoryPoints: cathedral(),
      },
    });
  }

  private getEligibleCities(game: IGame): Array<Space> {
    return game.board.getCities().filter((space) => !game.stJosephCathedrals.includes(space.id));
  }

  canAct(player: IPlayer): boolean {
    return this.getEligibleCities(player.game).length > 0 && player.canAfford({cost: 5, steel: true});
  }

  actionUnavailableReason(player: IPlayer) {
    // canAct fails if EITHER there's no eligible city OR you can't pay; if you
    // CAN pay, the blocker is the city, otherwise it's M€.
    return player.canAfford({cost: 5, steel: true}) ?
      actionReason.placementReason('No eligible city for this mission') :
      actionReason.notEnoughMC();
  }

  // Pay 5 M€ (steel usable) then place a Cathedral in a city. When steel is
  // usable the payment is dialed INSIDE the confirm modal (no separate
  // SelectPayment follow-up); otherwise a flat M€ cost chip. The city placement
  // is an after-submit SelectSpace shown as a board-placement note.
  public actionPreview(player: IPlayer) {
    const pay = actionPreviews.paymentStep(player, ACTION_COST, {canUseSteel: true, title: TITLES.payForCardAction(this.name)});
    const place = actionPreviews.boardPlacementStep('city', {tileType: TileType.CITY});
    if (pay !== undefined) {
      return actionPreviews.singleBranch(this, player, [pay, place]);
    }
    return actionPreviews.singleBranch(this, player, [place], [
      actionPreviews.stockCost(player, Resource.MEGACREDITS, ACTION_COST),
    ]);
  }

  action(player: IPlayer): undefined {
    const cities = this.getEligibleCities(player.game);
    if (cities.length === 0) {
      return undefined;
    }

    player.game.defer(new SelectPaymentDeferred(player, 5, {canUseSteel: true, title: TITLES.payForCardAction(this.name)}))
      .andThen(() => {
        const cathedralIds = new Set(player.game.stJosephCathedrals);
        player.defer(createMarsSelectSpace(
          player,
          message('Select new space for ${0}', (b) => b.card(this)),
          cities,
          {
            // The cathedral moves on a LATER turn than the card was played, so
            // without this the prompt arrives with nothing naming it.
            sourceCard: this.name,
            customReasoner: (space) => {
              // Operates on city tiles, not empty cells. Two reasons:
              if (space.tile === undefined || !Board.isCitySpace(space)) {
                return 'not-a-city';
              }
              if (cathedralIds.has(space.id)) {
                return 'already-has-cathedral';
              }
              return undefined;
            },
          })
          .andThen((space) => {
            player.game.stJosephCathedrals.push(space.id);
            const spaceOwner = space.player;
            if (spaceOwner === undefined || spaceOwner.color === 'neutral') {
              return undefined;
            }
            // Automa FAQ (rulebook p.11): "If you place a cathedral at one of
            // MarsBot's cities, it spends 2 MC if able, but instead of drawing
            // a card, it advances its least-advanced track (topmost if tied)."
            // Never a prompt — the bot resolves deterministically.
            if (spaceOwner.isMarsBot) {
              const automa = player.game.automa;
              if (automa !== undefined && spaceOwner.megaCredits >= 2) {
                spaceOwner.stock.deduct(Resource.MEGACREDITS, 2, {log: true});
                AutomaResolver.advanceTrack(player.game, automa.board.getLeastAdvancedTrackIndex());
              }
              return undefined;
            }
            // Built LAZILY (a `defer` CLOSURE, not a ready-made input): the
            // offer belongs to ANOTHER player and is created inside this
            // action's resolution, so both the affordability gate and the
            // premium `current → resulting` M€ chip must be PROMPT-TIME truth.
            spaceOwner.defer(() => this.cathedralCardOffer(spaceOwner));
            return undefined;
          }));
      });
    return undefined;
  }

  /**
   * The city OWNER's optional «pay 2 M€ → draw a card» offer.
   *
   * The pay branch is a LEAF `SelectOption` carrying premium RESULT metadata
   * (the M€ cost with its `current → resulting` wallet + the drawn card) —
   * deliberately NOT a nested `SelectPayment`: a fixed 2 M€ has nothing to
   * dial, so the choice confirms in ONE press and the payment itself rides
   * `SelectPaymentDeferred`, which auto-pays when M€ is the only way and
   * prompts only when the owner genuinely has a choice (Helion heat, Luna
   * titanium…). The draw is attributed to this card, so the "cards received"
   * reveal names its source.
   */
  private cathedralCardOffer(owner: IPlayer): OrOptions | undefined {
    if (!owner.canAfford(OWNER_CARD_COST)) {
      return undefined;
    }
    const mc = owner.megaCredits;
    // `current → resulting` is honest ONLY when the 2 M€ really come out of the
    // M€ pool; an owner who has to pay with heat/titanium sees the bare cost.
    const wallet = mc >= OWNER_CARD_COST ? {current: mc, resulting: mc - OWNER_CARD_COST} : {};
    return new OrOptions(
      new SelectOption('Pay 2 M€ to draw a card')
        .withMetadata(optionResult({
          effects: [
            chip('cost', 'megacredits', OWNER_CARD_COST, wallet),
            chip('gain', 'cards', 1),
          ],
        }))
        .andThen(() => {
          owner.game.defer(new SelectPaymentDeferred(owner, OWNER_CARD_COST))
            .andThen(() => {
              owner.drawCard(1, {source: {type: 'card', cardName: this.name}});
            });
          return undefined;
        }),
      new SelectOption('Do not buy a card').withMetadata(skip()),
    ).markChoiceContext(cardEffect(this, 'A Cathedral was built in one of your cities.', 'optional-effect'));
  }

  public override getVictoryPoints(player: IPlayer) {
    return player.game.stJosephCathedrals.length;
  }
}
