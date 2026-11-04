import {PreludeCard} from '../prelude/PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../../server/IPlayer';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {SelectOption} from '../../inputs/SelectOption';
import {PlaceGreeneryTile} from '../../deferredActions/PlaceGreeneryTile';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {OrOptions} from '../../inputs/OrOptions';
import {DiscardCards} from '../../deferredActions/DiscardCards';
import {cardSource} from '../../inputs/discardPrompt';
import {committedPlacement} from '../../inputs/placementContext';
import {effectChoice} from '../../inputs/choiceContext';
import {TileType} from '../../../common/TileType';
import {Behavior} from '../../behavior/Behavior';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';
import * as actionPreviews from '../actionPreviews';
import * as reason from '../actionReasons';
import {stepsForBehavior} from '../../models/actionPreview';

/** The three tiles of the card, in the PRINTED order (the order of the asked rows — never the order they are placed in). */
type Placement = 'ocean' | 'city' | 'greenery';
const PRINTED: ReadonlyArray<Placement> = ['ocean', 'city', 'greenery'];
const TILE: Readonly<Record<Placement, TileType>> = {ocean: TileType.OCEAN, city: TileType.CITY, greenery: TileType.GREENERY};
const TITLE: Readonly<Record<Placement, string>> = {ocean: 'Place an ocean', city: 'Place a city', greenery: 'Place a greenery'};
/** The printed placements as the declarative DSL spells them — read ONLY by the preview (the engine's own steps and chips). */
const PRINTED_BEHAVIOR: Behavior = {ocean: {}, city: {}, greenery: {}};
const DISCARD = 3;

/** Why a placement of the card cannot be taken back (the banner's honest reason, never a cancel button). */
export const PROJECT_EDEN_PLACEMENT_REASON = 'The prelude is already played — each of its tiles is placed.';
/** The order step's question and its «why». */
export const PROJECT_EDEN_ORDER_TITLE = 'Which tile do you place next?';
export const PROJECT_EDEN_ORDER_TRIGGER = 'The order of the placements is yours.';
/** The ocean the board has no room for — the CAUSE the record names. */
export const OCEANS_AT_MAXIMUM = 'All oceans are on the board';

/**
 * P58 · Project Eden — «Place 1 ocean tile, 1 city tile, and 1 greenery tile. Discard 3 cards.»
 *
 * THE ORDER IS THE PLAYER'S (upstream's, and rules-first: the print sets none, and the order CHANGES the outcome — a
 * greenery placed first is free of «next to your own tile», a city placed after it may stand beside it, an ocean beside
 * your own tile pays +2 M€). Each placement but the last is asked as ONE marked `OrOptions` of the tiles still owed —
 * `placementOrderPrompt` (index / of / done / remaining) + `choiceContext` + every option's metadata `{kind:
 * 'placement', tileType}`, so the client names a tile off the marker and never off a title (invariant 1). ONE tile left
 * asks nothing (the `OrOptions.reduce` exemption of invariant 3 — the placement is deferred directly).
 *
 * THE DISCARD IS NOT A CHOICE (fork law, the futile-actions doctrine): upstream offered «Discard 3 cards» beside the
 * placements on every step, a question whose answer changes nothing — the hand takes no part in the placements. It runs
 * LAST, unconditionally, after the third tile (`DiscardCards`, the card as its `source`).
 *
 * Every placement names its source and its plan: `sourceCard`, a NON-cancellable `placementContext` (the prelude is
 * played) and `followUpPlacements` — the tiles still owed after this one (the dossier's «Затем ещё размещения (N)»).
 *
 * THE OCEAN AT THE MAXIMUM IS NAMED, never silent (invariant 4): nine oceans stand → the ocean is skipped with a record
 * (`effect-skipped`, «Пропущено · Размещение океана»), the order step reads «k / 2» — before the press the preview's own
 * ocean step says the same (`stepsForBehavior`'s named skip). Whales (underworld, out of scope) keeps upstream's road:
 * the ocean is still offered and pays its animal.
 *
 * `placed` is the INSTANCE's state (upstream's): reset in `play` so Double Down's second pass is a full one.
 */
export class ProjectEden extends PreludeCard {
  constructor() {
    super({
      name: CardName.PROJECT_EDEN,
      tags: [Tag.CITY, Tag.PLANT],
      tr: {oceans: 1, oxygen: 1},
      // The bespoke play places three tiles (the green-card class «places a tile», TR80 — `greenTilePlacers`).
      placesTile: true,

      metadata: {
        cardNumber: 'P58',
        renderData: CardRenderer.builder((b) => {
          b.oceans(1).city().greenery().text('-3').cards(1);
        }),
        description: 'Place 1 ocean tile, 1 city tile, and 1 greenery tile. Discard 3 cards.',
      },
    });
  }

  /** The discard reads the hand: fewer than three cards — the order fix is a prelude that DRAWS (with its count). */
  public readonly preludeNeeds = 'cardInHand' as const;
  /** How many cards the hand is SHORT of the discard (the outlook's count — «2 of 3»). */
  public preludeNeedAmount(player: IPlayer): number {
    return Math.max(0, DISCARD - this.handWithoutSelf(player).length);
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    if (player.cardsInHand.length >= DISCARD && player.canAfford({cost: 0, tr: {oceans: 1, oxygen: 1}})) {
      if (!player.game.canAddOcean()) {
        this.addWarning('maxoceans');
      }
      return true;
    }
    return false;
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.cardsInHand.length < DISCARD) {
      return reason.ruleReason('Fewer than 3 cards in hand to discard');
    }
    return undefined;
  }

  private placed: Array<Placement> = [];
  /** The ocean was skipped at the maximum (the order then counts two placements). */
  private oceanSkipped = false;

  public override play(player: IPlayer) {
    this.placed = []; // Double Down: a full second pass.
    this.oceanSkipped = false;
    this.nextStep(player);
    return undefined;
  }

  /** The tiles still owed, in the printed order. */
  private remaining(): ReadonlyArray<Placement> {
    return PRINTED.filter((p) => !this.placed.includes(p));
  }

  private nextStep(player: IPlayer): void {
    const game = player.game;
    // Upstream's skip, asked at EVERY step (a greenery's 8 % oxygen can raise the temperature to 0 °C, whose bonus
    // ocean may fill the board mid-chain) — and NAMED.
    if (!this.placed.includes('ocean') && !game.canAddOcean() && !player.playedCards.has(CardName.WHALES)) {
      this.placed.push('ocean');
      this.oceanSkipped = true;
      recordSkippedEffect(player, OCEANS_AT_MAXIMUM, {label: actionPreviews.SKIPPED_LABEL.placeOcean,
        effect: {direction: 'gain', icon: 'oceans', amount: 1}});
    }
    const remaining = this.remaining();
    if (remaining.length === 0) {
      game.defer(new DiscardCards(player, DISCARD, DISCARD, undefined, {source: cardSource(this)}));
      return;
    }
    if (remaining.length === 1) {
      this.place(player, remaining[0]);
      return;
    }
    const of = this.oceanSkipped ? PRINTED.length - 1 : PRINTED.length;
    const done = this.placed.filter((p) => !(p === 'ocean' && this.oceanSkipped));
    const options = remaining.map((p) => new SelectOption(TITLE[p])
      .withMetadata({kind: 'placement', tileType: TILE[p]})
      .andThen(() => {
        this.place(player, p);
        return undefined;
      }));
    player.defer(new OrOptions(...options)
      .setTitle(PROJECT_EDEN_ORDER_TITLE)
      .markChoiceContext(effectChoice(this, PROJECT_EDEN_ORDER_TRIGGER))
      .markPlacementOrderPrompt({
        source: this.name,
        done: done.map((p) => TILE[p]),
        remaining: remaining.map((p) => TILE[p]),
        ...(this.oceanSkipped ? {skipped: [TileType.OCEAN]} : {}),
        index: done.length + 1,
        of,
      }));
  }

  /** One tile: its source, its non-cancellable context and the plan after it — then the next step. */
  private place(player: IPlayer, placement: Placement): void {
    this.placed.push(placement);
    const followUpPlacements = this.remaining().map((p) => ({tileType: TILE[p]}));
    const common = {
      sourceCard: this.name,
      placementContext: committedPlacement(PROJECT_EDEN_PLACEMENT_REASON, cardSource(this)),
      followUpPlacements,
    };
    const next = () => this.nextStep(player);
    const game = player.game;
    switch (placement) {
    case 'ocean':
      game.defer(new PlaceOceanTile(player, common)).andThen(next);
      break;
    case 'city':
      game.defer(new PlaceCityTile(player, common)).andThen(next);
      break;
    case 'greenery':
      game.defer(new PlaceGreeneryTile(player, 'greenery', common)).andThen(next);
      break;
    }
  }

  /** The hand the live discard reads (a harness that plays the card FROM the hand never offers the card itself). */
  private handWithoutSelf(player: IPlayer) {
    return player.cardsInHand.filter((c) => c.name !== this.name);
  }

  // THE PLAY, BEFORE THE PRESS: the three placements in the PRINTED order (the engine's own declarative steps — the
  // ocean's named skip at the maximum, the law that replaces a tile), the order the player's (a note), then the discard
  // — LIVE and last, never pre-collected (it follows three placements on the board). Built read-only.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [
      ...stepsForBehavior(player, this, PRINTED_BEHAVIOR),
      actionPreviews.noteStep('board', 'The order of the placements is yours'),
      actionPreviews.noteStep('generic', 'Then discard 3 cards from your hand'),
    ]);
  }
}
