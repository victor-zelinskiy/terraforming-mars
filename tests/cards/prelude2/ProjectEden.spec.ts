import {expect} from 'chai';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {ProjectEden, OCEANS_AT_MAXIMUM, PROJECT_EDEN_PLACEMENT_REASON} from '../../../src/server/cards/prelude2/ProjectEden';
import {IGame} from '../../../src/server/IGame';
import {fakeCard, maxOutOceans, runAllActions} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {assertPlaceCity, assertPlaceGreenery, assertPlaceOcean} from '../../assertions';
import {ArcticAlgae} from '../../../src/server/cards/base/ArcticAlgae';
import {BiomassCombustors} from '../../../src/server/cards/base/BiomassCombustors';
import {Comet} from '../../../src/server/cards/base/Comet';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {toName} from '../../../src/common/utils/utils';
import {DoubleDown} from '../../../src/server/cards/promo/DoubleDown';
import {EarthOffice} from '../../../src/server/cards/base/EarthOffice';
import {FieldCappedCity} from '../../../src/server/cards/promo/FieldCappedCity';
import {GanymedeColony} from '../../../src/server/cards/base/GanymedeColony';
import {Whales} from '../../../src/server/cards/underworld/Whales';
import {cast} from '../../../src/common/utils/utils';
import {TileType} from '../../../src/common/TileType';
import {CardName} from '../../../src/common/cards/CardName';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {computePreludeOutlooks} from '../../../src/server/preludes/preludeOutlook';
import {Biolab} from '../../../src/server/cards/prelude/Biolab';
import {IoResearchOutpost} from '../../../src/server/cards/prelude/IoResearchOutpost';
import {UNMIContractor} from '../../../src/server/cards/prelude/UNMIContractor';
import {OrOptionsModel, SelectOptionModel} from '../../../src/common/models/PlayerInputModel';

/**
 * P58 Project Eden — the FORK's rules, pinned on purpose (upstream's own spec encoded four OR questions with «Discard
 * 3 cards» in each — `upstream-spec-encodes-upstream-rules`): the ORDER of the three placements is the player's, the
 * discard is NOT a choice (it runs last, unconditionally), one placement left asks nothing, every question is marked
 * (no title is ever the identity), every placement names its source / its plan / its non-cancellable context, the ocean
 * at the maximum is a NAMED skip. Double Down and Whales keep upstream's behaviour.
 */
describe('ProjectEden', () => {
  let card: ProjectEden;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new ProjectEden();
    [game, player] = testGame(2);
  });

  /** The tile an option of the order step places — read off its metadata, never its title. */
  function tilesOf(or: OrOptions): Array<TileType | undefined> {
    return or.options.map((o) => cast(o, SelectOption).metadata?.tileType);
  }

  function choose(or: OrOptions, tile: TileType): void {
    const option = or.options.find((o) => cast(o, SelectOption).metadata?.tileType === tile);
    expect(option, `the order step offers ${tile}`).is.not.undefined;
    option!.cb(undefined);
    runAllActions(game);
  }

  function place(input: SelectSpace): void {
    input.cb(input.spaces[0]);
    runAllActions(game);
  }

  it('is adapted — dealt and covered', () => {
    expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.PROJECT_EDEN)).is.false;
  });

  it('canPlay — three cards in hand', () => {
    player.cardsInHand.push(fakeCard(), fakeCard());
    expect(card.canPlay(player)).is.false;
    expect(card.unplayableReason(player)?.message ?? card.unplayableReason(player)).to.exist;
    player.cardsInHand.push(fakeCard());
    expect(card.canPlay(player)).is.true;
    expect(card.unplayableReason(player)).is.undefined;
  });

  it('the order is the player\'s — a marked OR of the tiles still owed, the last one asks nothing, the discard runs LAST', () => {
    const [a, b, c, d] = [new ArcticAlgae(), new BiomassCombustors(), new Comet(), new Decomposers()];
    player.cardsInHand.push(a, b, c, d);

    cast(card.play(player), undefined);
    runAllActions(game);

    // 1 / 3 — the three tiles, in the PRINTED order; no discard among them.
    let or = cast(player.popWaitingFor(), OrOptions);
    expect(tilesOf(or)).deep.eq([TileType.OCEAN, TileType.CITY, TileType.GREENERY]);
    expect(or.options.map((o) => cast(o, SelectOption).metadata?.kind)).deep.eq(['placement', 'placement', 'placement']);
    expect(or.placementOrderPrompt).deep.eq({
      source: CardName.PROJECT_EDEN, done: [], remaining: [TileType.OCEAN, TileType.CITY, TileType.GREENERY], index: 1, of: 3,
    });
    expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.PROJECT_EDEN});
    expect(or.choiceContext?.mode).eq('effect-choice');
    // The marker survives the model (nesting-safe, on the input's own toModel).
    const model = or.toModel(player) as OrOptionsModel;
    expect(model.placementOrderPrompt?.index).eq(1);
    expect((model.options[2] as SelectOptionModel).metadata).deep.eq({kind: 'placement', tileType: TileType.GREENERY});

    // The GREENERY first (rules-first: free of «next to your own tile») — its placement names the source and the plan.
    choose(or, TileType.GREENERY);
    const greenery = cast(player.popWaitingFor(), SelectSpace);
    assertPlaceGreenery(player, greenery);
    expect(greenery.sourceCard).eq(CardName.PROJECT_EDEN);
    expect(greenery.placementContext).deep.eq({cancellable: false, reason: PROJECT_EDEN_PLACEMENT_REASON,
      source: {kind: 'card', card: CardName.PROJECT_EDEN}});
    expect(greenery.followUpPlacements).deep.eq([{tileType: TileType.OCEAN}, {tileType: TileType.CITY}]);
    runAllActions(game);

    // 2 / 3 — the greenery placed, two left.
    or = cast(player.popWaitingFor(), OrOptions);
    expect(tilesOf(or)).deep.eq([TileType.OCEAN, TileType.CITY]);
    expect(or.placementOrderPrompt).deep.eq({
      source: CardName.PROJECT_EDEN, done: [TileType.GREENERY], remaining: [TileType.OCEAN, TileType.CITY], index: 2, of: 3,
    });
    expect(player.cardsInHand).has.length(4);
    choose(or, TileType.CITY);
    const city = cast(player.popWaitingFor(), SelectSpace);
    assertPlaceCity(player, city);
    expect(city.followUpPlacements).deep.eq([{tileType: TileType.OCEAN}]);
    runAllActions(game);

    // The LAST tile asks no question (OrOptions.reduce's exemption) — straight to its placement, nothing after it.
    const ocean = cast(player.popWaitingFor(), SelectSpace);
    assertPlaceOcean(player, ocean);
    expect(ocean.followUpPlacements ?? []).deep.eq([]);
    expect(ocean.placementContext?.cancellable).is.false;
    expect(player.cardsInHand, 'nothing discarded before the third tile').has.length(4);
    runAllActions(game);

    // …then the discard — three cards exactly, named by this card.
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.config.min).eq(3);
    expect(selectCard.config.max).eq(3);
    expect(selectCard.discardPrompt?.source).deep.eq({kind: 'card', card: CardName.PROJECT_EDEN});
    selectCard.cb([a, c, d]);
    expect(player.cardsInHand.map(toName)).deep.eq([b.name]);
    expect(game.projectDeck.discardPile.map(toName)).to.have.members([a.name, c.name, d.name]);
    runAllActions(game);
    cast(player.popWaitingFor(), undefined);
    expect(game.board.getOceanSpaces()).has.length(1);
    expect(game.board.getGreeneries(player)).has.length(1);
    expect(game.board.getCities(player)).has.length(1);
  });

  it('oceans at the maximum — the ocean is a NAMED skip, the order counts two placements', () => {
    player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard());
    maxOutOceans(player);
    const tr = player.terraformRating;

    cast(card.play(player), undefined);
    runAllActions(game);
    const or = cast(player.popWaitingFor(), OrOptions);
    expect(tilesOf(or)).deep.eq([TileType.CITY, TileType.GREENERY]);
    expect(or.placementOrderPrompt).deep.eq({
      source: CardName.PROJECT_EDEN, done: [], remaining: [TileType.CITY, TileType.GREENERY], skipped: [TileType.OCEAN], index: 1, of: 2,
    });
    const skips = game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
    expect(skips).deep.eq([{label: 'Placing an ocean tile', reason: OCEANS_AT_MAXIMUM, effect: {direction: 'gain', icon: 'oceans', amount: 1}}]);
    choose(or, TileType.CITY);
    place(cast(player.popWaitingFor(), SelectSpace));
    // The greenery is the last placement — no question.
    place(cast(player.popWaitingFor(), SelectSpace));
    cast(player.popWaitingFor(), SelectCard);
    expect(game.board.getOceanSpaces()).has.length(9);
    expect(player.terraformRating, 'only the oxygen step rated').eq(tr + 1);
  });

  it('Compatible with Double Down — the second pass is a full one', () => {
    const doubleDown = new DoubleDown();
    player.preludeCardsInHand.push(doubleDown, card);
    player.cardsInHand.push(new ArcticAlgae(), new BiomassCombustors(), new Comet(), new Decomposers(),
      new EarthOffice(), new FieldCappedCity(), new GanymedeColony());

    player.playCard(card);
    runAllActions(game);
    playThrough();

    expect(player.canPlay(doubleDown)).is.true;
    player.playCard(doubleDown);
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards[0]).deep.eq(card);
    selectCard.cb([card]);
    runAllActions(game);
    playThrough();
    expect(game.projectDeck.discardPile, 'two full passes — six cards discarded').has.length(6);
  });

  it('Compatible with Whales — upstream\'s road: the ocean is still offered at the maximum and pays the animal', () => {
    player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard());
    const whales = new Whales();
    player.playedCards.push(whales);
    maxOutOceans(player);
    player.setTerraformRating(20);

    cast(card.play(player), undefined);
    runAllActions(game);
    let or = cast(player.popWaitingFor(), OrOptions);
    expect(tilesOf(or)).deep.eq([TileType.OCEAN, TileType.CITY, TileType.GREENERY]);
    choose(or, TileType.OCEAN);
    or = cast(player.popWaitingFor(), OrOptions);
    expect(player.terraformRating).eq(20);
    expect(whales.resourceCount).eq(1);
    expect(tilesOf(or)).deep.eq([TileType.CITY, TileType.GREENERY]);
  });

  describe('the preview', () => {
    it('the three placements in the printed order, the order the player\'s, the discard last and NOT pre-collected', () => {
      player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard());
      const preview = card.cardPlayPreview(player);
      const steps = preview.branches[0].steps;
      expect(steps.filter((s) => s.kind === 'boardPlacement').map((s) => s.kind === 'boardPlacement' ? s.tileType : undefined))
        .deep.eq([TileType.OCEAN, TileType.CITY, TileType.GREENERY]);
      expect(steps.some((s) => s.kind === 'input'), 'nothing pre-collected — the discard is live').is.false;
      expect(steps.filter((s) => s.kind === 'note').map((s) => s.kind === 'note' ? s.text : undefined))
        .deep.eq(['The order of the placements is yours', 'Then discard 3 cards from your hand']);
    });

    it('oceans at the maximum — the ocean step is a named warning', () => {
      player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard());
      maxOutOceans(player);
      const steps = card.cardPlayPreview(player).branches[0].steps;
      expect(steps.filter((s) => s.kind === 'boardPlacement')).has.length(2);
      const warning = steps.find((s) => s.kind === 'note' && s.noteKind === 'warning');
      expect(warning?.kind === 'note' ? warning.skipped?.label : undefined).eq('Placing an ocean tile');
    });
  });

  describe('the outlook — a counted need', () => {
    it('two cards short: a prelude that draws three GUARANTEES it, one that draws one does not, two of them may', () => {
      player.cardsInHand.push(fakeCard());
      const biolab = new Biolab();
      const io = new IoResearchOutpost();
      const unmi = new UNMIContractor();
      expect(card.preludeNeedAmount(player)).eq(2);
      expect(computePreludeOutlooks(player, [card], [card, biolab]).get(CardName.PROJECT_EDEN))
        .deep.eq({state: 'deferred', certainty: 'guaranteed', enablers: [CardName.BIOLAB], need: 'cardInHand', amount: 2});
      expect(computePreludeOutlooks(player, [card], [card, io]).get(CardName.PROJECT_EDEN))
        .deep.eq({state: 'noEffect', need: 'cardInHand', amount: 2});
      expect(computePreludeOutlooks(player, [card], [card, io, unmi]).get(CardName.PROJECT_EDEN))
        .deep.eq({state: 'deferred', certainty: 'possible', enablers: [CardName.IO_RESEARCH_OUTPOST, CardName.UNMI_CONTRACTOR], need: 'cardInHand', amount: 2});
    });

    it('one card short: a one-card draw is enough', () => {
      player.cardsInHand.push(fakeCard(), fakeCard());
      expect(computePreludeOutlooks(player, [card], [card, new IoResearchOutpost()]).get(CardName.PROJECT_EDEN))
        .deep.eq({state: 'deferred', certainty: 'guaranteed', enablers: [CardName.IO_RESEARCH_OUTPOST], need: 'cardInHand', amount: 1});
    });
  });

  function playThrough() {
    runAllActions(game);
    let or = cast(player.popWaitingFor(), OrOptions);
    expect(tilesOf(or)).deep.eq([TileType.OCEAN, TileType.CITY, TileType.GREENERY]);
    choose(or, TileType.OCEAN);
    place(cast(player.popWaitingFor(), SelectSpace));
    or = cast(player.popWaitingFor(), OrOptions);
    expect(tilesOf(or)).deep.eq([TileType.CITY, TileType.GREENERY]);
    choose(or, TileType.GREENERY);
    place(cast(player.popWaitingFor(), SelectSpace));
    place(cast(player.popWaitingFor(), SelectSpace));
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.cb(player.cardsInHand.slice(0, 3));
    runAllActions(game);
    cast(player.popWaitingFor(), undefined);
  }
});
