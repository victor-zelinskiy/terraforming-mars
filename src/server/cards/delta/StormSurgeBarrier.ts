import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {Resource} from '../../../common/Resource';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {nextTo} from '../Options';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {DeltaAdvanceOffer} from '../../../common/models/DeltaBonusPromptModel';
import {DeltaProjectExpansion, DP04_ADVANCE} from '../../delta/DeltaProjectExpansion';
import {DeltaProjectInput} from '../../delta/DeltaProjectInput';

/**
 * DP04 — STORM SURGE BARRIER.
 *
 * ONE blue-card action with two MUTUALLY EXCLUSIVE modes, so taking either
 * spends the card for the generation (`Player.getPlayableActionCards` gates on
 * `actionsThisGeneration`, which `playActionCard` stamps for BOTH):
 *
 *   1. Gain 1 energy per OWN tile standing next to an ocean tile.
 *   2. Spend exactly 1 energy and advance 1 step on the Hydronetwork.
 *
 * MODE 2 IS NOT A SECOND MOVEMENT IMPLEMENTATION. It is the shared bonus-move
 * entry point ({@link DeltaProjectExpansion.advance}) carrying this card's own
 * context, {@link DP04_ADVANCE} — `free` (no per-step price) + `energyToll: 1`
 * (the move's own price, charged once) + NO `tagWaiver`, because this card buys
 * a STEP and not a requirement. It therefore differs from Dynamic Ocean
 * Barrier's grant in exactly the two fields that describe those two rules, and
 * in nothing else: same destination validation, same rewards, same choices,
 * same repeat-blue-action pick, same journal scope.
 *
 * AND IT NEVER TOUCHES THE GENERATION'S OWN ADVANCE. The once-per-generation
 * limit is not a term of `advance` at all — it lives in `Player.getActions`'
 * own option callback (`deltaProjectData.usedThisGeneration`), which this move
 * does not go through. So the standard advance can be taken before or after
 * this one, and this one is available whether or not it has been.
 *
 * THE REQUIREMENT IS A PLAY-TIME REQUIREMENT ONLY (`bespokeCanPlay`): once the
 * card is on the table it stays activatable even if the city that let it be
 * played is later covered.
 */
export class StormSurgeBarrier extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.STORM_SURGE_BARRIER,
      tags: [Tag.POWER, Tag.BUILDING],
      cost: 12,

      // The printed «city next to an ocean» pair — the same two descriptors
      // Aqueduct Systems states the identical requirement with. They render the
      // icon pair; `bespokeCanPlay` below is what actually decides, because
      // neither descriptor can express «a city OF YOURS, ADJACENT to a real
      // ocean TILE» (the counted requirement would accept an opponent's city,
      // and the ocean one is a global count).
      requirements: [{cities: 1, nextTo}, {oceans: 1}],

      metadata: {
        cardNumber: 'DP04',
        // ONE CAPTION PER PRINTED ACTION ROW: the console draws the two rows as
        // two variants, so a single card-level caption would describe the wrong
        // one half the time. Bound to each row by its own graphic token
        // (`tests/cards/actionCaption.spec.ts` is the budget's worklist).
        infoText: [
          {kind: 'action-short', text: 'Gain 1 energy per ocean-side tile of yours', tokens: ['oceans']},
          {kind: 'action-short', text: 'Advance 1 step on the Hydronetwork for 1 energy', tokens: ['plate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Gain 1 energy for each of your tiles next to an ocean tile.', (ab) => {
            ab.empty().startAction.emptyTile('normal', {size: Size.SMALL}).oceans(1, {size: Size.SMALL})
              .colon().text('X').energy(1);
          }).br;
          b.or().br;
          b.action('Spend 1 energy to advance 1 step on the Hydronetwork track.', (ab) => {
            ab.energy(1).startAction.plate('Hydronetwork');
          });
        }),
        description: 'Requires that you have a city tile adjacent to an ocean tile.',
      },
    });
  }

  /**
   * THE ONE PLACE THE TILE COUNT IS COMPUTED — the action, its preview and the
   * tests all ask HERE, so «what N is» can never be answered twice.
   *
   * Deliberately built out of the shared board primitives and nothing else:
   *  - `Board.ownedBy` is the server's ownership model, coOwner included. It is
   *    also what keeps a neutral ocean out of the count without a special case
   *    (`simpleAddTile` leaves a plain OCEAN unowned) while still counting an
   *    OWNED ocean derivative — a Wetlands of yours is a tile of yours, and the
   *    card counts «your tiles», not «your dry tiles»;
   *  - `space.tile !== undefined` — a RESERVED space (Land Claim) is owned but
   *    holds no tile, and the card counts tiles;
   *  - `board.getAdjacentSpaces` is the board's own geometry (never a
   *    coordinate table here), and it never yields the space itself, so a tile
   *    can never be its own neighbour;
   *  - `Board.isOceanSpace` is the standard «an ocean tile is really there»
   *    predicate — the global ocean PARAMETER is not consulted at all.
   *
   * A tile touching two oceans is ONE tile: this counts tiles, never pairs.
   */
  public static oceanAdjacentTiles(player: IPlayer): ReadonlyArray<Space> {
    const board = player.game.board;
    return board.spaces.filter((space) =>
      space.tile !== undefined &&
      Board.spaceOwnedBy(space, player) &&
      board.getAdjacentSpaces(space).some(Board.isOceanSpace));
  }

  /** N — the energy mode's yield, recomputed from the live board every time. */
  public static oceanAdjacentTileCount(player: IPlayer): number {
    return StormSurgeBarrier.oceanAdjacentTiles(player).length;
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    const board = player.game.board;
    return board.getOceanSpaces({upgradedOceans: true, wetlands: true}).some((ocean) =>
      board.getAdjacentSpaces(ocean).some((space) =>
        Board.isCitySpace(space) && Board.spaceOwnedBy(space, player)));
  }

  /**
   * The city/ocean requirements are auto-explained by their descriptors; the
   * bespoke nuance is that the city must be YOURS and the ocean must really be
   * NEXT TO IT. Only surfaced once a city of theirs and an ocean both exist, so
   * the generic requirement reasons are never duplicated. (Mirrors the identical
   * hook on Aqueduct Systems, which states the same printed requirement.)
   */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const board = player.game.board;
    const ownsCity = board.getCities(player).length > 0;
    const hasOcean = board.getOceanSpaces({upgradedOceans: true, wetlands: true}).length > 0;
    if (ownsCity && hasOcean && !this.bespokeCanPlay(player)) {
      return reason.targetReason('No city of yours next to an ocean');
    }
    return undefined;
  }

  /**
   * Mode 2's availability — the SHARED movement pipeline's verdict, never a
   * client-side or card-local re-derivation of tags / position / VP occupancy.
   *
   * The TOLL is asked separately and must be: `getValidAdvanceSteps` bounds a
   * `free` move by what the CARD grants, deliberately NOT by the player's stock
   * (a bonus step pays no per-step energy), so it answers «is this step legal»
   * and says nothing about whether its price can be paid. `BonusDeltaAdvance`
   * splits the same question the same way for the waiver it sells.
   */
  private canAdvance(player: IPlayer): boolean {
    return player.deltaProjectData !== undefined &&
      player.energy >= (DP04_ADVANCE.energyToll ?? 1) &&
      DeltaProjectExpansion.getValidAdvanceSteps(player, DP04_ADVANCE).includes(1);
  }

  /**
   * Either mode is enough. Notably NOT gated on energy: the first mode is the
   * one that PRODUCES energy, so a player at 0 energy must still be able to
   * activate this card — that is the whole point of the pair.
   */
  public canAct(player: IPlayer): boolean {
    return StormSurgeBarrier.oceanAdjacentTileCount(player) > 0 || this.canAdvance(player);
  }

  /**
   * ONE blocker, never «X or Y». `canAct` is false only when BOTH modes are —
   * which, by its own definition, means no tile of the player's touches an
   * ocean. That is the card's PREMISE and the one condition true in every such
   * state, so it is what the card says. The advance's own, more specific
   * refusal (no energy / the tag path / the end of the track / an occupied VP
   * slot) belongs to that VARIANT and is carried by its branch, where the
   * player is actually looking at it.
   */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    return this.canAct(player) ?
      undefined :
      reason.targetReason('No tile of yours is next to an ocean');
  }

  /**
   * The SERVER's description of mode 2's move, handed to the console so the
   * Hydronetwork workspace can present it without deriving a single term of it.
   * The same shape a card-granted OFFER carries (`DeltaAdvanceOffer`), because
   * it IS the same kind of move — only its provenance differs.
   */
  private advanceOffer(player: IPlayer): DeltaAdvanceOffer {
    const from = player.deltaProjectData?.position ?? 0;
    // The PASSIVE half of the move's outcome (Social Heating's heat), from the
    // same hooks the commit pays out — the workspace states it beside the
    // stage reward exactly as it does for a standard advance.
    const movementBonuses = DeltaProjectExpansion.projectedMovementBonuses(player, from + 1, DP04_ADVANCE);
    return {
      source: this.name,
      steps: 1,
      fromPosition: from,
      toPosition: from + 1,
      energyCost: DP04_ADVANCE.energyToll ?? 1,
      // This card buys a STEP, never a requirement — a missing path tag stops
      // it exactly as it stops the standard action.
      waivesTag: false,
      ...(movementBonuses.length > 0 ? {movementBonuses} : {}),
    };
  }

  /**
   * Two declared branches, in the SAME order `action()` pushes its options, so
   * `orBranches` hands each available one its runtime `OrOptions` index. The
   * advance branch carries no interactive step of its own: its `deltaAdvance`
   * marker tells the console the commit is a NAVIGATION into the Hydronetwork
   * workspace, where the destination is studied and the move is confirmed.
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const tiles = StormSurgeBarrier.oceanAdjacentTileCount(player);
    const canAdvance = this.canAdvance(player);
    return actionPreviews.orBranches(this, [
      {
        available: tiles > 0,
        title: 'Gain 1 energy per ocean-side tile',
        unavailableReason: reason.targetReason('No tile of yours is next to an ocean'),
        effects: tiles > 0 ? [{
          ...actionPreviews.stockGain(player, Resource.ENERGY, tiles),
          // WHY the amount is what it is — the live board, counted once.
          basis: [{count: tiles, label: 'Your tiles next to an ocean'}],
        }] : [],
      },
      {
        available: canAdvance,
        title: 'Spend 1 energy and advance on the Hydronetwork',
        unavailableReason: DeltaProjectExpansion.bonusAdvanceUnavailableReason(player, DP04_ADVANCE),
        effects: [actionPreviews.stockCost(player, Resource.ENERGY, DP04_ADVANCE.energyToll ?? 1)],
        steps: canAdvance ? [actionPreviews.deltaAdvanceStep(this.advanceOffer(player))] : [],
      },
    ]);
  }

  /**
   * The two modes, in preview order. A lone available mode collapses to its own
   * input (the `autoResolveSingle` convention every bespoke `or` action here
   * follows, and the shape `orBranches` mirrors) — the batch then carries no
   * branch wrapper at all.
   *
   * NOTHING IS SPENT BY CHOOSING. The advance branch answers with a
   * `DeltaProjectInput`, so the move itself commits only when THAT response
   * arrives — one atomic `advance` call that re-validates the whole move,
   * charges the toll and moves the marker, or throws before touching anything.
   */
  public action(player: IPlayer): PlayerInput | undefined {
    const options: Array<SelectOption> = [];
    if (StormSurgeBarrier.oceanAdjacentTileCount(player) > 0) {
      options.push(new SelectOption('Gain 1 energy per ocean-side tile', 'Gain energy').andThen(() => {
        // RECOMPUTED HERE, at the commit: the board may have moved since the
        // preview, and the preview is never the source of the amount.
        const amount = StormSurgeBarrier.oceanAdjacentTileCount(player);
        player.stock.add(Resource.ENERGY, amount, {log: true, from: {card: this.name}});
        return undefined;
      }));
    }
    if (this.canAdvance(player)) {
      options.push(new SelectOption('Spend 1 energy and advance on the Hydronetwork', 'Advance').andThen(() => {
        // `[1]` — the card grants exactly one step, so the input has exactly
        // one legal answer and re-validates it on arrival. Kept by reference:
        // `waiveReward` (the conscious decline of a pos 7/9 target reward) is
        // set on it by process() before the callback runs.
        const input = new DeltaProjectInput(DeltaProjectExpansion.getValidAdvanceSteps(player, DP04_ADVANCE));
        return input.andThen((amount) => {
          DeltaProjectExpansion.advance(player, amount, DP04_ADVANCE, {
            waiveTargetReward: input.waiveReward,
            answers: input.answers,
          });
          return undefined;
        });
      }));
    }
    if (options.length === 0) {
      return undefined;
    }
    if (options.length === 1) {
      return options[0].cb(undefined);
    }
    return new OrOptions(...options);
  }
}
