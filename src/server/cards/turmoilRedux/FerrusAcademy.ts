import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {TileType} from '../../../common/TileType';
import {Size} from '../../../common/cards/render/Size';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {SpaceId} from '../../../common/Types';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {tiersOf} from '../../boards/cityStack';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {CorporationCard} from '../corporation/CorporationCard';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {PlayerInput} from '../../PlayerInput';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {Priority} from '../../deferredActions/Priority';
import {cardEffect} from '../../inputs/choiceContext';
import {chip, optionResult} from '../../inputs/optionMetadata';
import * as actionPreviews from '../actionPreviews';
import * as placementPreviews from '../placementPreviews';

/** «Double the placement bonus you get from this» — the first city's printed bonus counts this many times. */
export const FERRUS_PRINTED_BONUS_MULTIPLIER = 2;
/** «Add 3 data resources to ANY card» — the effect's data count. */
export const FERRUS_DATA_PER_BUILD = 3;

/**
 * TR79 — FERRUS ACADEMY («Ferrus Academy»), the SECOND of the eight NEW corporations of Turmoil Redux (not a
 * replacement — `common/cards/turmoilReduxCorporations.ts`, numbered TR79 by the order of the scan folder). Its own
 * art and its own printed lore, both keyed TR79; no `reimplements`.
 *
 * SCAN READING — the Science tag and the City tag (the skyline under a dome) in the corner; «40» + a plant
 * production box; a city tile with «*» and «6 [cube]*» — the first action (a city, then up to six cubes around it).
 * ⚠ THE SCAN'S OWN TYPO: the plate prints 40 M€, the rules text says «You start with 45 M€» — the PLATE is right
 * (the owner, 2026-10-26: «считаем, что в тексте опечатка, а нарисовано правильно»); 45 appears nowhere. The EFFECT
 * box: «[cube in a hex]* : 3 [data]* OR [card]» — «whenever you place a tile in a space that has your player cube,
 * either add 3 data resources to ANY card, or draw a card». Printed lore: «At the dawn of the terraforming effort 5
 * rich academics…». No VP. The purple Turmoil diamond is the module itself (no `compatibility`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/FerrusAcademy.spec.ts):
 *  1. THE FIRST ACTION places a city by the ordinary rules of cities (`getAvailableSpacesForCity`). «Double the
 *     placement bonus» is the cell's PRINTED bonus only (the owner's decision 1): `AddTileOptions
 *     .printedBonusMultiplier` — ONE thread from the commit to the tile language's record; the ocean adjacency, the
 *     Ares neighbours and the parties stay × 1 by construction. The prompt announces the same multiple to the preview
 *     (`SelectSpace.printedBonusMultiplier`), so the dossier's numbers are the commit's.
 *  2. THEN — in the same synchronous answer (a reload between the city and its cubes cannot happen) — the player's
 *     cube lands on EVERY adjacent cell the marker predicate admits (`MarsBoard.isNonReservedLand` — Land Claim's,
 *     one for the three sources: land, not Noctis, no tile, no cube of anyone's; a hazard is inherited). 0…6 cubes.
 *     The cube is `space.player` — ONE board state, no provenance (the owner's decision 6).
 *  3. RESERVED: a rival can neither build there nor move a camp there (the engine's own reading of a cube).
 *  4. THE EFFECT — the owner places a tile on a cell their OWN cube reserved, WHOEVER laid the cube (Land Claim,
 *     Arcadian Communities, this card): `ICard.onOwnMarkerBuilt`, read once by `Game.addTile` before the tile
 *     overwrites the marker. A city TIER (Skyscrapers) on the owner's own city ANSWERS too — the Redux FAQ: «If I
 *     place a city over my existing tile with "Skyscrapers", does that trigger Ferrus Academy's effect? Yes. You are
 *     placing a tile in a space that already has your player cube. So it counts.» A rival's tile, a marker move —
 *     nothing. With Arcadian Communities on the
 *     same table both answer one tile (+3 M€ AND this choice).
 *  5. THE QUESTION — «3 data onto ANY card» or «draw a card» (`question` — ONE builder: the live hook defers it, the
 *     preview names it). The data branch asks which holder (`AddResourcesToCard`, `autoSelect: false` — never applied
 *     silently); with NO data holder it stays VISIBLE, disabled with its reason (the owner's decision 3), and the
 *     draw is the one live branch — still asked.
 *  6. THE SILHOUETTES — while the first city's cell is pointed at, the ring this city WOULD reserve is a fact of the
 *     card (`placementPreview` → `spaces`, the SAME predicate as the commit), so the board draws the cubes before the
 *     press; the cells the cubes land on are told to the console by the board itself (`space.player`).
 */
export class FerrusAcademy extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.FERRUS_ACADEMY,
      tags: [Tag.SCIENCE, Tag.CITY],
      startingMegaCredits: 40,
      initialActionText: 'Place a city tile with its printed bonus doubled, then your cube on each adjacent non-reserved area',

      behavior: {
        production: {plants: 1},
      },

      metadata: {
        cardNumber: 'TR79',
        description: 'You start with 40 M€ and 1 plant production. As your first action, place a city tile. Double the placement bonus you get from this. Then place your player cube on each adjacent, non-reserved space. Only you can place tiles there.',
        infoText: [
          {text: 'As your first action, place a city tile. Double the placement bonus you get from it.', tokens: ['city']},
          {text: 'Place your cube on each adjacent non-reserved area. Only you can place tiles there.', tokens: ['community']},
          {kind: 'effect-short', text: 'Tile on your marked area: 3 data or a card', tokens: ['community', 'data']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(40).nbsp.production((pb) => pb.plants(1)).nbsp.city().asterix().nbsp.text('6', Size.LARGE).community().asterix();
          b.corpBox('effect', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.effect('Whenever you place a tile in a space that has your player cube, either add 3 data resources to ANY card, or draw a card.', (eb) => {
              eb.community().emptyTile().asterix().startEffect.resource(CardResource.DATA, FERRUS_DATA_PER_BUILD).asterix().or().cards(1);
            });
          });
        }),
      },
    });
  }

  /** Rule 1 — the city, its printed bonus doubled; rule 2 — the ring of cubes, in the same answer. */
  public override initialAction(player: IPlayer): PlayerInput | undefined {
    const game = player.game;
    const spaces = game.board.getAvailableSpacesForCity(player);
    if (spaces.length === 0) {
      return undefined;
    }
    return createMarsSelectSpace(player, 'Select space for city tile', spaces, {
      placementType: 'city',
      tileType: TileType.CITY,
      sourceCard: this.name,
      printedBonusMultiplier: FERRUS_PRINTED_BONUS_MULTIPLIER,
    }).andThen((space) => {
      game.addTile(player, space, {tileType: TileType.CITY}, {printedBonusMultiplier: FERRUS_PRINTED_BONUS_MULTIPLIER});
      const ring = FerrusAcademy.reservableRing(player, space);
      for (const cell of ring) {
        cell.player = player;
      }
      if (ring.length > 0) {
        game.log('${0} placed their cube on ${1} areas around the city on ${2}', (b) => b.player(player).number(ring.length).space(space));
      }
      return undefined;
    });
  }

  /**
   * The cells the first city's cubes reserve — its neighbours the marker predicate admits, in the board's clockwise
   * order (`getAdjacentSpaces`). ONE reading for the commit and the preview's silhouettes. Read BEFORE the city when
   * previewing: the city's own cell is never its own neighbour, so the answer is the same before and after.
   */
  public static reservableRing(player: IPlayer, space: Space): ReadonlyArray<Space> {
    const board = player.game.board;
    return board.getAdjacentSpaces(space).filter((cell) => board.isNonReservedLand(cell));
  }

  public firstActionPreview(): ActionPreview {
    return actionPreviews.firstActionBranch(this, [], [
      actionPreviews.boardPlacementStep('city', {tileType: TileType.CITY}),
      actionPreviews.noteStep('board', 'The printed bonus of the city\'s cell is doubled.'),
      actionPreviews.noteStep('board', 'Then your cube lands on each adjacent non-reserved area — up to 6. Only you can build there.'),
    ]);
  }

  /**
   * Rule 6 — what the FIRST city does about the pointed cell: the doubled printed bonus said by its source, and the
   * ring of cubes named by its cells (`spaces` — the board draws the silhouettes from them). Only for this card's own
   * multiplied city prompt (`printedBonusMultiplier`), never for a later city.
   */
  public placementPreview(player: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!ctx.placesTile || ctx.printedBonusMultiplier <= 1) {
      return [];
    }
    const facts: Array<BoardFact> = [];
    if (space.bonus.length > 0 && !ctx.bonusesCovered) {
      facts.push(placementPreviews.upcomingChoice(this, 'Printed cell bonus ×${0}', {
        id: 'ferrus-printed-bonus',
        params: [String(ctx.printedBonusMultiplier)],
        severity: 'positive',
      }));
    }
    const ring = FerrusAcademy.reservableRing(player, space);
    const spaces: ReadonlyArray<SpaceId> = ring.map((cell) => cell.id);
    // The ring is a STATEMENT with its count (no chip: the player's cube has no sprite in the chip vocabulary — the board
    // draws the cubes themselves, as silhouettes on these very cells).
    facts.push(ring.length > 0 ?
      {
        id: 'marked-area-reserve',
        category: 'card-trigger',
        timing: 'immediate',
        severity: 'positive',
        recipient: {kind: 'current-player'},
        title: 'Marked areas around the city: ${0}',
        params: [String(ring.length)],
        description: 'Your cube on each adjacent non-reserved area — only you can build there.',
        source: placementPreviews.cardSource(this),
        spaces,
        reservesSpaces: true,
      } :
      placementPreviews.noEffectHere(this, 'No free area around this city for your cube', {id: 'marked-area-reserve'}));
    return facts;
  }

  /** Rule 4 — a tile on a cell the owner's own cube reserved asks the question (rule 5). */
  public onOwnMarkerBuilt(player: IPlayer, space: Space): void {
    // A stack stands on the cell by now when the tile was a city TIER (the FAQ's case) — the question says so.
    player.defer(this.question(player, {tier: tiersOf(space) > 1}), Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  /**
   * Rule 4's preview twin — the cell still shows the cube before the tile lands, so the read is the engine's own
   * (`builtOnOwnMarker`): a tile of the owner, the owner's cube on the cell, and either no real tile under it or a
   * city TIER onto the owner's own city (the FAQ).
   */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (cardOwner.id !== activePlayer.id || !ctx.placesTile || (ctx.covering && !ctx.stacking) || space.player?.id !== cardOwner.id) {
      return [];
    }
    const holders = this.dataHolders(cardOwner).length;
    return [placementPreviews.upcomingChoice(this, holders > 0 ? '3 data onto any card, or draw a card' : 'Draw a card — no card can hold data', {
      id: 'marked-area-ferrus',
      severity: 'positive',
    })];
  }

  private dataHolders(player: IPlayer) {
    return player.getResourceCards(CardResource.DATA);
  }

  /** Rule 5 — THE question, one builder. */
  public question(player: IPlayer, opts?: {tier?: boolean}): OrOptions {
    const draw = new SelectOption('Draw a card', 'Draw a card')
      .withMetadata(optionResult({effects: [chip('gain', 'cards', 1)]}))
      .andThen(() => {
        player.drawCard(1);
        return undefined;
      });
    const dataTitle = 'Add 3 data to ANY card';
    const dataMetadata = optionResult({effects: [chip('gain', 'data', FERRUS_DATA_PER_BUILD, {note: 'to a card'})]});
    const options: Array<PlayerInput> = [];
    const hasHolder = this.dataHolders(player).length > 0;
    if (hasHolder) {
      options.push(new SelectOption(dataTitle, 'Add data')
        .withMetadata(dataMetadata)
        .andThen(() => {
          player.game.defer(new AddResourcesToCard(player, CardResource.DATA, {
            count: FERRUS_DATA_PER_BUILD,
            autoSelect: false,
            cause: {kind: 'corporation', card: this.name},
          }), Priority.GAIN_RESOURCE_OR_PRODUCTION);
          return undefined;
        }));
    }
    options.push(draw);
    const prompt = new OrOptions(...options)
      .setTitle('Select an option for Ferrus Academy')
      .markChoiceContext(cardEffect(this,
        opts?.tier === true ? 'You built a city tier on your own city — a space with your cube.' : 'You placed a tile on your marked area.',
        'effect-choice'));
    if (!hasHolder) {
      prompt.setDisabledOptions([{title: dataTitle, metadata: dataMetadata, reason: 'No card can hold data'}]);
    }
    return prompt;
  }
}
